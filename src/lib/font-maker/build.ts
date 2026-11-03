/**
 * Traced glyphs + settings → a finished font.
 *
 * The cleanup here is what turns a page of handwriting into a font that sets
 * well: letters are seated on the baseline, sizes are evened out towards the
 * cap and x-heights, spacing is measured from each letter's real edges, and
 * pairs are kerned by comparing the shapes of their facing sides.
 */
import { LOWER, METRICS, SLOTS, UPM, sitsOnBaseline, targetTop } from "./charset";
import { bounds, finalizeContours, flatten, type TracedContour } from "./trace";
import { buildTtf, type Contour, type FontGlyph, type Pt } from "./ttf";

export interface ShapeSettings {
  /** Degrees, positive leans right. */
  slant: number;
  /** Side bearing in font units, each side of every letter. */
  spacing: number;
  sitOnBaseline: boolean;
  /** 0–1: how far sizes move towards the guides. */
  evenSizes: number;
  kerning: boolean;
  variation: boolean;
  fillLowercase: boolean;
}

export interface BuiltFont {
  ttf: Uint8Array;
  glyphCount: number;
  kernPairs: number;
  alternates: number;
  filled: number;
}

interface Shape {
  contours: { points: Pt[]; hole: boolean }[];
}

const toFontSpace = (contours: TracedContour[]): Shape => ({
  contours: contours.map((c) => ({
    hole: c.hole,
    points: c.points.map((p) => ({ x: p.x, y: METRICS.ascender - p.y, on: p.on })),
  })),
});

const mapPoints = (shape: Shape, fn: (p: Pt) => Pt): Shape => ({
  contours: shape.contours.map((c) => ({ hole: c.hole, points: c.points.map(fn) })),
});

function cleanup(shape: Shape, char: string, s: ShapeSettings): Shape {
  let out = shape;
  let b = bounds(out.contours);

  if (s.sitOnBaseline && sitsOnBaseline(char) && Math.abs(b.yMin) < 220) {
    const dy = -b.yMin;
    out = mapPoints(out, (p) => ({ ...p, y: p.y + dy }));
    b = bounds(out.contours);
  }

  const top = targetTop(char);
  if (s.evenSizes > 0 && top && b.yMax > 60 && b.yMin > -40) {
    const raw = Math.min(1.4, Math.max(0.72, top / b.yMax));
    const k = 1 + (raw - 1) * s.evenSizes;
    const cx = (b.xMin + b.xMax) / 2;
    out = mapPoints(out, (p) => ({ ...p, x: cx + (p.x - cx) * k, y: p.y * k }));
  }
  return out;
}

function slantAndPlace(shape: Shape, s: ShapeSettings) {
  const tan = Math.tan((s.slant * Math.PI) / 180);
  let out = tan ? mapPoints(shape, (p) => ({ ...p, x: p.x + p.y * tan })) : shape;
  const b = bounds(out.contours);
  const dx = s.spacing - b.xMin;
  out = mapPoints(out, (p) => ({ ...p, x: p.x + dx }));
  return { shape: out, advance: Math.round(b.xMax - b.xMin + s.spacing * 2) };
}

/* ---------------------------------------------------------------- kerning */

const BAND = 20;
const BANDS = Math.ceil((METRICS.ascender - METRICS.descender + 200) / BAND);
const bandOf = (y: number) => Math.floor((y - METRICS.descender + 100) / BAND);

function profile(contours: Contour[]) {
  const left = new Float32Array(BANDS).fill(NaN);
  const right = new Float32Array(BANDS).fill(NaN);
  for (const c of contours)
    for (const p of flatten(c, 10)) {
      const band = bandOf(p.y);
      if (band < 0 || band >= BANDS) continue;
      if (!(left[band] <= p.x)) left[band] = p.x;
      if (!(right[band] >= p.x)) right[band] = p.x;
    }
  return { left, right };
}

function kernPairs(glyphs: { gid: number; advance: number; contours: Contour[] }[], spacing: number) {
  const profiles = glyphs.map((g) => profile(g.contours));
  const target = spacing * 2;
  const pairs: [number, number, number][] = [];
  glyphs.forEach((l, li) => {
    const pl = profiles[li];
    glyphs.forEach((r, ri) => {
      const pr = profiles[ri];
      let min = Infinity;
      let shared = 0;
      for (let b = 0; b < BANDS; b++) {
        // Compare each band of the left letter with its neighbours on the
        // right, so thin diagonals still meet something.
        const lr = pl.right[b];
        if (Number.isNaN(lr)) continue;
        let rl = NaN;
        for (let o = -1; o <= 1; o++) {
          const v = pr.left[b + o];
          if (!Number.isNaN(v) && !(rl <= v)) rl = v;
        }
        if (Number.isNaN(rl)) continue;
        shared++;
        const gap = l.advance - lr + rl;
        if (gap < min) min = gap;
      }
      if (shared < 3) return;
      let kern = target - min;
      kern = kern < 0 ? kern * 0.7 : kern * 0.5;
      kern = Math.max(-(spacing * 1.6 + 40), Math.min(spacing * 0.6, kern));
      if (Math.abs(kern) >= 10) pairs.push([l.gid, r.gid, Math.round(kern)]);
    });
  });
  return pairs.sort((a, b) => Math.abs(b[2]) - Math.abs(a[2])).slice(0, 10900);
}

/* ------------------------------------------------------------------ build */

function notdef(): FontGlyph {
  const box = (x0: number, y0: number, x1: number, y1: number, cw: boolean): Contour => {
    const pts = [
      { x: x0, y: y0, on: true },
      { x: x0, y: y1, on: true },
      { x: x1, y: y1, on: true },
      { x: x1, y: y0, on: true },
    ];
    return cw ? pts : pts.reverse();
  };
  return { advance: 500, contours: [box(50, 0, 450, 700, true), box(100, 50, 400, 650, false)] };
}

export function assembleFont(
  traced: Map<string, TracedContour[]>,
  family: string,
  settings: ShapeSettings
): BuiltFont | null {
  const placed = new Map<string, { contours: Contour[]; advance: number }>();
  let filled = 0;

  const place = (key: string, char: string, shape: Shape) => {
    const cleaned = cleanup(shape, char, settings);
    const { shape: final, advance } = slantAndPlace(cleaned, settings);
    const contours = finalizeContours(final.contours);
    if (contours.length) placed.set(key, { contours, advance });
  };

  for (const slot of SLOTS) {
    const contours = traced.get(slot.key);
    if (contours?.length) place(slot.key, slot.char, toFontSpace(contours));
  }

  // Lowercase that was never drawn borrows its capital, scaled to x-height.
  if (settings.fillLowercase) {
    for (const char of LOWER) {
      if (placed.has(char)) continue;
      const upper = traced.get(char.toUpperCase());
      if (!upper?.length) continue;
      const k = METRICS.xHeight / METRICS.capHeight;
      const shape = toFontSpace(upper);
      const b = bounds(shape.contours);
      const base = settings.sitOnBaseline ? b.yMin : 0;
      const cx = (b.xMin + b.xMax) / 2;
      place(
        char,
        "",
        mapPoints(shape, (p) => ({ ...p, x: cx + (p.x - cx) * k, y: (p.y - base) * k }))
      );
      filled++;
    }
  }

  const baseKeys = SLOTS.filter((s) => !s.alt && placed.has(s.key));
  if (!baseKeys.length) return null;

  const glyphs: FontGlyph[] = [notdef()];
  const gidOf = new Map<string, number>();

  const lowercase = LOWER.map((c) => placed.get(c)?.advance).filter((a): a is number => !!a);
  const avg = lowercase.length ? lowercase.reduce((s, a) => s + a, 0) / lowercase.length : 520;
  glyphs.push({ unicode: 32, advance: Math.round(Math.max(200, avg * 0.55)), contours: [] });

  for (const slot of baseKeys) {
    const g = placed.get(slot.key)!;
    gidOf.set(slot.key, glyphs.length);
    glyphs.push({ unicode: slot.char.codePointAt(0), advance: g.advance, contours: g.contours });
  }
  // Second versions are only reachable through the calt feature.
  const alternates: [number, number][] = [];
  if (settings.variation) {
    for (const slot of SLOTS) {
      if (!slot.alt) continue;
      const g = placed.get(slot.key);
      const base = gidOf.get(slot.char);
      if (!g || base === undefined) continue;
      gidOf.set(slot.key, glyphs.length);
      alternates.push([base, glyphs.length]);
      glyphs.push({ advance: g.advance, contours: g.contours });
    }
  }

  const kerning = settings.kerning
    ? kernPairs(
        glyphs.flatMap((g, gid) => (gid > 1 && g.contours.length ? [{ gid, advance: g.advance, contours: g.contours }] : [])),
        settings.spacing
      )
    : [];

  const ttf = buildTtf({
    family,
    glyphs,
    kerning,
    alternates,
    slant: settings.slant,
    metrics: { ...METRICS, unitsPerEm: UPM },
  });
  return { ttf, glyphCount: glyphs.length - 2, kernPairs: kerning.length, alternates: alternates.length, filled };
}
