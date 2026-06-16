import { rgbToHex, type RGB } from "./colorExtract";

/**
 * Halftone screening: lay a rotated grid of dots over the image, sizing each dot
 * by the local brightness (darker = bigger). It's the classic newsprint / comic
 * look, and because it's just primitives it exports cleanly to scalable SVG.
 */

export type DotShape = "circle" | "square" | "diamond";

export interface HalftoneOptions {
  /** Grid spacing in source pixels. */
  cell: number;
  /** Max dot size as a fraction of the cell (0–~1.4). */
  scale: number;
  /** Screen angle in degrees. */
  angle: number;
  shape: DotShape;
  ink: RGB;
  bg: RGB;
  /** Tone contrast around the midpoint. 1 = linear. */
  contrast: number;
  /** Swap which tones grow dots (dark vs light). */
  invert: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Walk every dot, calling `cb(x, y, r)` with its centre and radius. */
function forEachDot(src: ImageData, o: HalftoneOptions, cb: (x: number, y: number, r: number) => void) {
  const { width: w, height: h, data } = src;
  const cell = Math.max(2, o.cell);
  const a = (o.angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const ux = cos * cell;
  const uy = sin * cell;
  const vx = -sin * cell;
  const vy = cos * cell;
  const cx = w / 2;
  const cy = h / 2;
  const n = Math.ceil(Math.hypot(w, h) / (2 * cell)) + 1;

  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const x = cx + i * ux + j * vx;
      const y = cy + i * uy + j * vy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const idx = ((y | 0) * w + (x | 0)) * 4;
      const lum = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
      let t = o.invert ? lum : 1 - lum;
      t = clamp01((t - 0.5) * o.contrast + 0.5);
      const r = (cell / 2) * o.scale * t;
      if (r >= 0.3) cb(x, y, r);
    }
  }
}

function shapePath(ctx: CanvasRenderingContext2D, shape: DotShape, x: number, y: number, r: number) {
  if (shape === "circle") {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  } else if (shape === "square") {
    ctx.rect(x - r, y - r, r * 2, r * 2);
  } else {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  }
}

/** Render the halftone onto a canvas context (fast path for preview + PNG). */
export function drawHalftone(ctx: CanvasRenderingContext2D, src: ImageData, o: HalftoneOptions) {
  const { width: w, height: h } = src;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = rgbToHex(o.bg);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgbToHex(o.ink);
  ctx.beginPath();
  forEachDot(src, o, (x, y, r) => shapePath(ctx, o.shape, x, y, r));
  ctx.fill();
}

/** Build a scalable SVG of the halftone — vector, perfect for print. */
export function halftoneSvg(src: ImageData, o: HalftoneOptions): string {
  const { width: w, height: h } = src;
  const ink = rgbToHex(o.ink);
  const parts: string[] = [];
  forEachDot(src, o, (x, y, r) => {
    const cx = x.toFixed(1);
    const cy = y.toFixed(1);
    const rr = r.toFixed(1);
    if (o.shape === "circle") {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${rr}"/>`);
    } else if (o.shape === "square") {
      parts.push(`<rect x="${(x - r).toFixed(1)}" y="${(y - r).toFixed(1)}" width="${(r * 2).toFixed(1)}" height="${(r * 2).toFixed(1)}"/>`);
    } else {
      parts.push(`<path d="M${cx} ${(y - r).toFixed(1)}L${(x + r).toFixed(1)} ${cy}L${cx} ${(y + r).toFixed(1)}L${(x - r).toFixed(1)} ${cy}Z"/>`);
    }
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${rgbToHex(o.bg)}"/>` +
    `<g fill="${ink}">${parts.join("")}</g>` +
    `</svg>`
  );
}

export const HALFTONE_PRESETS: { name: string; ink: string; bg: string }[] = [
  { name: "Newsprint", ink: "#111111", bg: "#f4f1ea" },
  { name: "Comic", ink: "#1d1d1f", bg: "#ffd84d" },
  { name: "Emerald", ink: "#04241a", bg: "#ecfdf5" },
  { name: "Risograph", ink: "#ff4d6d", bg: "#fff0f3" },
  { name: "Blueprint", ink: "#e6f0ff", bg: "#0a2540" },
  { name: "Inkjet", ink: "#1f6feb", bg: "#f5f9ff" },
];
