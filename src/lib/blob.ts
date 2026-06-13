/**
 * Organic SVG shape engine — blobs and layered waves. Pure, seeded math so a
 * given seed always reproduces the same shape (and "shuffle" just bumps the
 * seed). One SVG string drives the preview and every export.
 */

export type ShapeMode = "blob" | "wave";

export interface ShapeConfig {
  mode: ShapeMode;
  seed: number;
  // blob
  points: number;
  randomness: number; // 0–100
  // wave
  layers: number;
  amplitude: number; // 0–100
  complexity: number; // segments
  flip: boolean;
  // fill (shared)
  gradient: boolean;
  c1: string;
  c2: string;
  angle: number;
}

export const DEFAULT_SHAPE: ShapeConfig = {
  mode: "blob",
  seed: 1234,
  points: 6,
  randomness: 45,
  layers: 3,
  amplitude: 45,
  complexity: 5,
  flip: false,
  gradient: true,
  c1: "#34d399",
  c2: "#0ea5e9",
  angle: 45,
};

export const BLOB_SIZE = 512;
export const WAVE_W = 1440;
export const WAVE_H = 320;

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/** Linear blend between two hex colors. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

type Pt = [number, number];

/** Smooth a closed loop of points into a cubic-bezier path (Catmull-Rom). */
function closedSpline(pts: Pt[]): string {
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + " Z";
}

/** Smooth an open run of points into a cubic-bezier path (Catmull-Rom). */
function openSpline(pts: Pt[]): string {
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** The `d` for a blob path, centered in a BLOB_SIZE square. */
export function blobPath(config: ShapeConfig): string {
  const rand = rng(config.seed);
  const c = BLOB_SIZE / 2;
  const base = BLOB_SIZE * 0.34;
  const vary = (config.randomness / 100) * base * 0.7;
  const pts: Pt[] = [];
  for (let i = 0; i < config.points; i++) {
    const a = (i / config.points) * Math.PI * 2;
    const r = base + (rand() * 2 - 1) * vary;
    pts.push([c + Math.cos(a) * r, c + Math.sin(a) * r]);
  }
  return closedSpline(pts);
}

interface WaveLayer {
  d: string;
  fill: string;
}

/** Build the wave layers, back to front. */
export function waveLayers(config: ShapeConfig): WaveLayer[] {
  const rand = rng(config.seed);
  const out: WaveLayer[] = [];
  const segs = Math.max(2, config.complexity);
  for (let l = 0; l < config.layers; l++) {
    const t = config.layers === 1 ? 0 : l / (config.layers - 1);
    const baseline = WAVE_H * (0.28 + 0.5 * t);
    const amp = (config.amplitude / 100) * WAVE_H * 0.3 * (1 - t * 0.35);
    const pts: Pt[] = [];
    for (let k = 0; k <= segs; k++) {
      const x = (k / segs) * WAVE_W;
      const y = baseline + (rand() * 2 - 1) * amp;
      pts.push([x, y]);
    }
    const d = `${openSpline(pts)} L ${WAVE_W},${WAVE_H} L 0,${WAVE_H} Z`;
    const fill = config.gradient ? mix(config.c1, config.c2, t) : config.c1;
    out.push({ d, fill });
  }
  return out;
}

function gradientDef(config: ShapeConfig): string {
  const a = ((config.angle ?? 0) * Math.PI) / 180;
  const x1 = (50 - Math.cos(a) * 50).toFixed(1);
  const y1 = (50 - Math.sin(a) * 50).toFixed(1);
  const x2 = (50 + Math.cos(a) * 50).toFixed(1);
  const y2 = (50 + Math.sin(a) * 50).toFixed(1);
  return `<defs><linearGradient id="g" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"><stop offset="0%" stop-color="${config.c1}"/><stop offset="100%" stop-color="${config.c2}"/></linearGradient></defs>`;
}

/** A standalone SVG string for the current config. */
export function toSvg(config: ShapeConfig): string {
  if (config.mode === "blob") {
    const fill = config.gradient ? "url(#g)" : config.c1;
    const defs = config.gradient ? gradientDef(config) : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BLOB_SIZE} ${BLOB_SIZE}" width="${BLOB_SIZE}" height="${BLOB_SIZE}">${defs}<path fill="${fill}" d="${blobPath(config)}"/></svg>`;
  }
  const layers = waveLayers(config);
  const paths = layers
    .map((l, i) => `<path fill="${l.fill}" fill-opacity="${(1 - i * 0.12).toFixed(2)}" d="${l.d}"/>`)
    .join("");
  const inner = config.flip
    ? `<g transform="translate(0,${WAVE_H}) scale(1,-1)">${paths}</g>`
    : paths;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WAVE_W} ${WAVE_H}" width="${WAVE_W}" height="${WAVE_H}" preserveAspectRatio="none">${inner}</svg>`;
}

/** CSS `background-image` data-URI snippet for the shape. */
export function toCss(config: ShapeConfig): string {
  const svg = toSvg(config);
  const encoded = encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22");
  const sizing =
    config.mode === "wave"
      ? "background-size: cover;\n  background-repeat: no-repeat;"
      : "background-size: contain;\n  background-repeat: no-repeat;\n  background-position: center;";
  return `.shape {\n  background-image: url("data:image/svg+xml,${encoded}");\n  ${sizing}\n}`;
}
