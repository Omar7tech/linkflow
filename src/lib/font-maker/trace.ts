/**
 * Bitmap in, font outlines out.
 *
 * Every glyph, drawn or scanned, ends up as a square ink mask. The mask is
 * traced into smooth quadratic curves (the same curve type TrueType stores, so
 * nothing is approximated twice), then holes and outer shapes are wound the
 * way font renderers expect.
 */
import type { Contour, Pt } from "./ttf";

/** Masks are square: MASK_SIZE × MASK_SIZE, one byte per pixel, 1 = ink. */
export const MASK_SIZE = 320;

export interface Mask {
  size: number;
  data: Uint8Array;
}

export interface TracedContour {
  /** Pad units (0–1000, y down). */
  points: Pt[];
  hole: boolean;
}

/* --------------------------------------------------------------- weight */

/** Grows (r > 0) or shrinks (r < 0) the ink by |r| pixels. */
export function adjustWeight(mask: Mask, r: number): Mask {
  if (!r) return mask;
  const { size } = mask;
  let src = mask.data;
  const grow = r > 0;
  for (let pass = 0; pass < Math.abs(r); pass++) {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const c = src[i];
        const n =
          (x > 0 ? src[i - 1] : 0) +
          (x < size - 1 ? src[i + 1] : 0) +
          (y > 0 ? src[i - size] : 0) +
          (y < size - 1 ? src[i + size] : 0);
        out[i] = grow ? (c || n > 0 ? 1 : 0) : c && n === 4 ? 1 : 0;
      }
    }
    src = out;
  }
  return { size, data: src };
}

export const inkRatio = (mask: Mask) => {
  let ink = 0;
  for (let i = 0; i < mask.data.length; i++) ink += mask.data[i];
  return ink / mask.data.length;
};

/* --------------------------------------------------------------- tracing */

interface Segment {
  type: "L" | "Q";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3?: number;
  y3?: number;
}

interface TracedPath {
  segments: Segment[];
  isholepath: boolean;
}

type Tracer = {
  imagedataToTracedata: (
    image: { width: number; height: number; data: Uint8ClampedArray },
    options: Record<string, unknown>
  ) => { layers: unknown[][] };
};

let tracerPromise: Promise<Tracer> | null = null;
const loadTracer = () => {
  tracerPromise ??= import("imagetracerjs").then((m) => m.default as unknown as Tracer);
  return tracerPromise;
};

const WHITE = { r: 255, g: 255, b: 255, a: 255 };
const BLACK = { r: 0, g: 0, b: 0, a: 255 };

export async function traceMask(mask: Mask): Promise<TracedContour[]> {
  const tracer = await loadTracer();
  const { size, data } = mask;
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i++) {
    const v = data[i] ? 0 : 255;
    pixels[i * 4] = v;
    pixels[i * 4 + 1] = v;
    pixels[i * 4 + 2] = v;
    pixels[i * 4 + 3] = 255;
  }
  const traced = tracer.imagedataToTracedata(
    { width: size, height: size, data: pixels },
    {
      pal: [WHITE, BLACK],
      numberofcolors: 2,
      colorsampling: 0,
      colorquantcycles: 1,
      mincolorratio: 0,
      ltres: 0.8,
      qtres: 0.8,
      pathomit: 10,
      rightangleenhance: false,
      blurradius: 0,
      layering: 0,
    }
  );

  const scale = 1000 / size;
  const layer = (traced.layers[1] ?? []) as TracedPath[];
  return layer
    .filter((path) => path.segments.length >= 3)
    .map((path) => ({
      hole: path.isholepath,
      points: path.segments.flatMap((s) =>
        s.type === "Q"
          ? [
              { x: s.x1 * scale, y: s.y1 * scale, on: true },
              { x: s.x2 * scale, y: s.y2 * scale, on: false },
            ]
          : [{ x: s.x1 * scale, y: s.y1 * scale, on: true }]
      ),
    }));
}

/* ------------------------------------------------------------- geometry */

export function signedArea(points: Pt[]) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

/**
 * TrueType winding (y up): outer shapes clockwise, holes counter-clockwise.
 * Rounds to whole units and drops repeated points.
 */
export function finalizeContours(contours: { points: Pt[]; hole: boolean }[]): Contour[] {
  const out: Contour[] = [];
  for (const c of contours) {
    const rounded: Pt[] = [];
    for (const p of c.points) {
      const q = { x: Math.round(p.x), y: Math.round(p.y), on: p.on };
      const prev = rounded[rounded.length - 1];
      if (prev && prev.x === q.x && prev.y === q.y) {
        if (q.on) prev.on = true;
        continue;
      }
      rounded.push(q);
    }
    while (rounded.length > 1) {
      const first = rounded[0];
      const last = rounded[rounded.length - 1];
      if (first.x === last.x && first.y === last.y) rounded.pop();
      else break;
    }
    if (rounded.length < 3) continue;
    if (!rounded.some((p) => p.on)) rounded[0].on = true;
    const area = signedArea(rounded);
    if (Math.abs(area) < 40) continue;
    const clockwise = area < 0;
    if (c.hole === clockwise) rounded.reverse();
    out.push(rounded);
  }
  return out;
}

export function bounds(contours: { points: Pt[] }[]) {
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const c of contours)
    for (const p of c.points) {
      if (p.x < xMin) xMin = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.x > xMax) xMax = p.x;
      if (p.y > yMax) yMax = p.y;
    }
  return { xMin, yMin, xMax, yMax };
}

/** Polyline points along a contour, quadratics subdivided, for measuring. */
export function flatten(points: Pt[], step = 12): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const n = points.length;
  // Walk on-curve to on-curve, expanding implied on-points between two offs.
  const at = (i: number) => points[((i % n) + n) % n];
  const start = points.findIndex((p) => p.on);
  if (start < 0) return out;
  let cur = at(start);
  for (let k = 1; k <= n; k++) {
    const p = at(start + k);
    if (p.on) {
      const len = Math.hypot(p.x - cur.x, p.y - cur.y);
      const steps = Math.max(1, Math.ceil(len / step));
      for (let s = 0; s < steps; s++)
        out.push({ x: cur.x + ((p.x - cur.x) * s) / steps, y: cur.y + ((p.y - cur.y) * s) / steps });
      cur = p;
    } else {
      const next = at(start + k + 1);
      const end = next.on ? next : { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2, on: true };
      for (let s = 0; s < 8; s++) {
        const t = s / 8;
        const u = 1 - t;
        out.push({
          x: u * u * cur.x + 2 * u * t * p.x + t * t * end.x,
          y: u * u * cur.y + 2 * u * t * p.y + t * t * end.y,
        });
      }
      if (next.on) k++;
      cur = end as Pt;
    }
  }
  return out;
}
