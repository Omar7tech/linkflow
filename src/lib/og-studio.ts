/**
 * OG Image Studio engine. Designs social share cards (Open Graph / Twitter /
 * LinkedIn / stories / YouTube thumbnails …) and renders them onto a <canvas>
 * so the PNG export is pixel-for-pixel what you see, at any resolution.
 *
 * Everything is config-driven: one design re-lays out across every size preset.
 * The renderer also powers the code exporters (meta tags + a drop-in Next.js
 * `opengraph-image` route) further down.
 */

import { drawBlurred } from "@/lib/canvas-blur";

/* ------------------------------- size presets ----------------------------- */

export type SizeId =
  | "og"
  | "x"
  | "linkedin"
  | "square"
  | "story"
  | "youtube"
  | "devto"
  | "producthunt";

export interface SizePreset {
  id: SizeId;
  name: string;
  group: string;
  w: number;
  h: number;
}

export const SIZES: SizePreset[] = [
  { id: "og", name: "Open Graph", group: "Universal · 1.91:1", w: 1200, h: 630 },
  { id: "x", name: "X / Twitter", group: "Post image · 16:9", w: 1600, h: 900 },
  { id: "linkedin", name: "LinkedIn", group: "Link post", w: 1200, h: 627 },
  { id: "devto", name: "Dev.to cover", group: "Article cover", w: 1000, h: 420 },
  { id: "youtube", name: "YouTube", group: "Thumbnail · 16:9", w: 1280, h: 720 },
  { id: "producthunt", name: "Product Hunt", group: "Gallery", w: 1270, h: 760 },
  { id: "square", name: "Square", group: "Instagram · 1:1", w: 1080, h: 1080 },
  { id: "story", name: "Story", group: "Vertical · 9:16", w: 1080, h: 1920 },
];

/* ----------------------------------- fonts -------------------------------- */

export const OG_FONTS: { label: string; value: string }[] = [
  { label: "Geist Sans", value: "--font-geist-sans" },
  { label: "Space Grotesk", value: "--font-space-grotesk" },
  { label: "Geist Mono", value: "--font-geist-mono" },
  { label: "System Sans", value: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
];

/** CSS-variable fonts (next/font) can't be used in canvas shorthand directly. */
export function resolveFont(value: string): string {
  if (value.startsWith("--")) {
    if (typeof window === "undefined") return "system-ui, sans-serif";
    const v = getComputedStyle(document.documentElement).getPropertyValue(value).trim();
    return v || "system-ui, sans-serif";
  }
  return value;
}

/* --------------------------------- config --------------------------------- */

export type BgType = "gradient" | "mesh" | "solid" | "image";
export type PatternType = "none" | "dots" | "grid" | "lines";
export type Align = "left" | "center";
export type VAnchor = "top" | "center" | "bottom";
export type LogoSlot = "none" | "top" | "footer";
/** How the card is arranged: words alone, words beside or above a screenshot, or a quotation. */
export type Layout = "stack" | "split" | "showcase" | "quote";
/** Graphics drawn behind the words in the accent colors. */
export type Decor = "none" | "rings" | "beams" | "orbs" | "horizon" | "waves" | "stars";
/** How an *accented* phrase in the title is marked. */
export type Highlight = "text" | "marker" | "underline" | "pill";
export type MediaFrame = "browser" | "card" | "none";

export interface MeshBlob {
  x: number; // 0..1
  y: number; // 0..1
  color: string;
}

export interface OgConfig {
  sizeId: SizeId;
  layout: Layout;

  // Screenshot (split and showcase layouts)
  mediaFrame: MediaFrame;
  mediaTilt: number; // degrees

  // Decoration
  decor: Decor;
  decorStrength: number; // 0..1
  highlight: Highlight;
  frame: boolean;

  // Background
  bgType: BgType;
  gradFrom: string;
  gradTo: string;
  gradAngle: number;
  meshBase: string;
  mesh: MeshBlob[];
  solid: string;
  imageOverlay: string;
  imageOverlayOpacity: number; // 0..1
  imageBlur: number; // px in design space

  // Pattern overlay
  pattern: PatternType;
  patternColor: string;
  patternOpacity: number; // 0..1

  // Effects
  grain: number; // 0..1
  vignette: number; // 0..1
  topGlow: boolean;
  glass: boolean;

  // Content
  eyebrow: string;
  showEyebrow: boolean;
  title: string; // supports *highlight* markup
  description: string;
  titleFont: string;
  bodyFont: string;
  titleWeight: number;
  textColor: string;
  mutedColor: string;
  accentFrom: string;
  accentTo: string;
  accentGradient: boolean;
  align: Align;
  vAnchor: VAnchor;
  titleScale: number; // multiplier
  descScale: number;
  autoFit: boolean;

  // Branding
  logoSlot: LogoSlot;
  authorName: string;
  authorHandle: string;
  domain: string;
  showFooter: boolean;

  // Export
  scale: number;
}

export interface OgAssets {
  logo?: HTMLImageElement | null;
  avatar?: HTMLImageElement | null;
  bg?: HTMLImageElement | null;
  /** The product screenshot for the split and showcase layouts. */
  media?: HTMLImageElement | null;
}

export const DEFAULT_OG: OgConfig = {
  sizeId: "og",
  layout: "stack",
  mediaFrame: "browser",
  mediaTilt: 0,
  decor: "none",
  decorStrength: 0.8,
  highlight: "text",
  frame: false,

  bgType: "mesh",
  gradFrom: "#0b3d2e",
  gradTo: "#022c22",
  gradAngle: 135,
  meshBase: "#04140f",
  mesh: [
    { x: 0.15, y: 0.2, color: "#059669" },
    { x: 0.85, y: 0.15, color: "#0ea5e9" },
    { x: 0.75, y: 0.9, color: "#10b981" },
  ],
  solid: "#04140f",
  imageOverlay: "#02120c",
  imageOverlayOpacity: 0.5,
  imageBlur: 0,

  pattern: "none",
  patternColor: "#ffffff",
  patternOpacity: 0.06,

  grain: 0.12,
  vignette: 0.28,
  topGlow: true,
  glass: false,

  eyebrow: "Introducing",
  showEyebrow: true,
  title: "Ship *share cards* that actually convert",
  description:
    "Design once, export for Open Graph, X, LinkedIn and stories — all from your browser.",
  titleFont: "--font-space-grotesk",
  bodyFont: "--font-geist-sans",
  titleWeight: 800,
  textColor: "#f0fdf4",
  mutedColor: "#a7f3d0",
  accentFrom: "#34d399",
  accentTo: "#22d3ee",
  accentGradient: true,
  align: "left",
  vAnchor: "center",
  titleScale: 1,
  descScale: 1,
  autoFit: true,

  logoSlot: "top",
  authorName: "TM TOOLS",
  authorHandle: "@formatools",
  domain: "tools.twomindsengine.com",
  showFooter: true,

  scale: 2,
};

/* -------------------------------- templates ------------------------------- */

/** What every template starts from, so switching never leaves a setting behind from the last one. */
const BLANK: Partial<OgConfig> = {
  layout: "stack",
  decor: "none",
  decorStrength: 0.8,
  highlight: "text",
  frame: false,
  glass: false,
  pattern: "none",
  patternColor: "#ffffff",
  patternOpacity: 0.06,
  topGlow: false,
  showEyebrow: true,
  showFooter: true,
  align: "left",
  vAnchor: "center",
  titleScale: 1,
  descScale: 1,
  titleWeight: 800,
  titleFont: "--font-space-grotesk",
  bodyFont: "--font-geist-sans",
  accentGradient: true,
  grain: 0.1,
  vignette: 0.2,
  mediaFrame: "browser",
  mediaTilt: 0,
};

const mesh = (base: string, a: string, b: string, c: string): Partial<OgConfig> => ({
  bgType: "mesh",
  meshBase: base,
  mesh: [
    { x: 0.15, y: 0.2, color: a },
    { x: 0.85, y: 0.15, color: b },
    { x: 0.75, y: 0.9, color: c },
  ],
});
const gradient = (from: string, to: string, angle: number): Partial<OgConfig> => ({
  bgType: "gradient",
  gradFrom: from,
  gradTo: to,
  gradAngle: angle,
});
const ink = (text: string, muted: string, a: string, b: string): Partial<OgConfig> => ({
  textColor: text,
  mutedColor: muted,
  accentFrom: a,
  accentTo: b,
});

/** Curated starting points. Each one sets the whole look; the words stay yours. */
export const TEMPLATES: { id: string; name: string; patch: Partial<OgConfig> }[] = [
  {
    id: "editorial",
    name: "Editorial",
    patch: { ...BLANK, ...mesh("#04140f", "#059669", "#0ea5e9", "#10b981"), ...ink("#f0fdf4", "#a7f3d0", "#34d399", "#22d3ee"), topGlow: true, vignette: 0.28, grain: 0.12 },
  },
  {
    id: "product",
    name: "Product",
    patch: { ...BLANK, ...mesh("#020617", "#0ea5e9", "#8b5cf6", "#10b981"), ...ink("#f8fafc", "#cbd5e1", "#7dd3fc", "#c4b5fd"), layout: "split", mediaTilt: -4 },
  },
  {
    id: "launch",
    name: "Launch day",
    patch: { ...BLANK, ...gradient("#1e1b4b", "#020617", 170), ...ink("#ffffff", "#c7d2fe", "#a5b4fc", "#f0abfc"), layout: "showcase", decor: "beams", decorStrength: 0.9 },
  },
  {
    id: "beams",
    name: "Stage lights",
    patch: { ...BLANK, bgType: "solid", solid: "#05070d", ...ink("#f8fafc", "#94a3b8", "#22d3ee", "#a78bfa"), align: "center", decor: "beams", decorStrength: 1, vignette: 0.4 },
  },
  {
    id: "rings",
    name: "Signal",
    patch: { ...BLANK, ...gradient("#0b3d2e", "#03120d", 150), ...ink("#ecfdf5", "#a7f3d0", "#6ee7b7", "#fde68a"), decor: "rings", highlight: "underline", frame: true },
  },
  {
    id: "orbs",
    name: "Orbit",
    patch: { ...BLANK, ...gradient("#111827", "#030712", 150), ...ink("#f9fafb", "#9ca3af", "#34d399", "#06b6d4"), decor: "orbs", highlight: "pill", vignette: 0.1 },
  },
  {
    id: "horizon",
    name: "Synthwave",
    patch: { ...BLANK, ...gradient("#2e1065", "#0c0420", 180), ...ink("#fdf4ff", "#e9d5ff", "#f472b6", "#22d3ee"), align: "center", vAnchor: "top", decor: "horizon", decorStrength: 1, titleScale: 0.9, showFooter: false },
  },
  {
    id: "stars",
    name: "Night sky",
    patch: { ...BLANK, ...mesh("#020617", "#1d4ed8", "#7c3aed", "#0f172a"), ...ink("#ffffff", "#bfdbfe", "#fde68a", "#f9a8d4"), align: "center", decor: "stars", vignette: 0.35 },
  },
  {
    id: "waves",
    name: "Tide",
    patch: { ...BLANK, ...gradient("#0f766e", "#0c1a3a", 165), ...ink("#f0fdfa", "#99f6e4", "#5eead4", "#38bdf8"), vAnchor: "top", decor: "waves", decorStrength: 0.9, showFooter: false },
  },
  {
    id: "sunset",
    name: "Sunset poster",
    patch: { ...BLANK, ...mesh("#7c2d12", "#f97316", "#ec4899", "#7c3aed"), ...ink("#fff7ed", "#fed7aa", "#fde047", "#fde047"), accentGradient: false, highlight: "marker", titleScale: 1.2, showEyebrow: false, grain: 0.18, vignette: 0.15 },
  },
  {
    id: "quote",
    name: "Quote",
    patch: { ...BLANK, bgType: "solid", solid: "#faf5ee", ...ink("#1c1917", "#57534e", "#c2410c", "#c2410c"), accentGradient: false, layout: "quote", titleFont: "Georgia, 'Times New Roman', serif", titleWeight: 600, titleScale: 0.82, frame: true, grain: 0.14, vignette: 0 },
  },
  {
    id: "newsprint",
    name: "Newsprint",
    patch: { ...BLANK, bgType: "solid", solid: "#f3efe6", ...ink("#111111", "#44403c", "#111111", "#111111"), accentGradient: false, highlight: "pill", titleFont: "Georgia, 'Times New Roman', serif", titleWeight: 700, pattern: "lines", patternColor: "#111111", patternOpacity: 0.05, frame: true, grain: 0.2, vignette: 0 },
  },
  {
    id: "clean",
    name: "Clean light",
    patch: { ...BLANK, bgType: "solid", solid: "#f8fafc", ...ink("#0b1120", "#475569", "#059669", "#0ea5e9"), highlight: "underline", pattern: "dots", patternColor: "#0f172a", patternOpacity: 0.06, grain: 0, vignette: 0 },
  },
  {
    id: "showcase-light",
    name: "Showcase",
    patch: { ...BLANK, ...gradient("#d1fae5", "#e0f2fe", 135), ...ink("#042f2e", "#0f766e", "#059669", "#0284c7"), layout: "showcase", grain: 0, vignette: 0 },
  },
  {
    id: "terminal",
    name: "Terminal",
    patch: { ...BLANK, bgType: "solid", solid: "#05070a", ...ink("#e2fbf0", "#6ee7b7", "#34d399", "#34d399"), accentGradient: false, titleFont: "--font-geist-mono", bodyFont: "--font-geist-mono", titleWeight: 700, pattern: "grid", patternColor: "#34d399", patternOpacity: 0.08, grain: 0.06 },
  },
  {
    id: "glass",
    name: "Glass card",
    patch: { ...BLANK, ...mesh("#020617", "#0ea5e9", "#8b5cf6", "#10b981"), ...ink("#f8fafc", "#cbd5e1", "#a7f3d0", "#7dd3fc"), glass: true },
  },
];

/** Ready-made background swatches for the gradient picker. */
export const GRADIENT_PRESETS: { name: string; from: string; to: string; angle: number }[] = [
  { name: "Emerald", from: "#0b3d2e", to: "#022c22", angle: 135 },
  { name: "Deep sea", from: "#052e26", to: "#020617", angle: 160 },
  { name: "Teal sky", from: "#0f766e", to: "#0369a1", angle: 145 },
  { name: "Aurora", from: "#065f46", to: "#4c1d95", angle: 140 },
  { name: "Sunrise", from: "#059669", to: "#b45309", angle: 130 },
  { name: "Ink", from: "#111827", to: "#030712", angle: 150 },
  { name: "Mint light", from: "#d1fae5", to: "#e0f2fe", angle: 135 },
  { name: "Slate", from: "#334155", to: "#0f172a", angle: 160 },
];

export const MESH_PRESETS: { name: string; base: string; blobs: MeshBlob[] }[] = [
  {
    name: "Emerald haze",
    base: "#04140f",
    blobs: [
      { x: 0.15, y: 0.2, color: "#059669" },
      { x: 0.85, y: 0.15, color: "#0ea5e9" },
      { x: 0.75, y: 0.9, color: "#10b981" },
    ],
  },
  {
    name: "Nebula",
    base: "#020617",
    blobs: [
      { x: 0.2, y: 0.25, color: "#0ea5e9" },
      { x: 0.8, y: 0.2, color: "#8b5cf6" },
      { x: 0.6, y: 0.85, color: "#10b981" },
    ],
  },
  {
    name: "Citrus",
    base: "#0a0a0a",
    blobs: [
      { x: 0.5, y: 0.12, color: "#10b981" },
      { x: 0.9, y: 0.8, color: "#f59e0b" },
      { x: 0.1, y: 0.85, color: "#0ea5e9" },
    ],
  },
  {
    name: "Coral reef",
    base: "#03121a",
    blobs: [
      { x: 0.2, y: 0.8, color: "#2dd4bf" },
      { x: 0.85, y: 0.3, color: "#f472b6" },
      { x: 0.5, y: 0.1, color: "#38bdf8" },
    ],
  },
];

/* ------------------------------ color helpers ----------------------------- */

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/* ------------------------------ text layout ------------------------------- */

interface Word {
  text: string;
  hi: boolean;
}

/** Split a title into words, honouring *highlighted phrase* markup. */
export function parseTitle(title: string): Word[] {
  const segments = title
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((p) =>
      p.startsWith("*") && p.endsWith("*") && p.length > 2
        ? { text: p.slice(1, -1), hi: true }
        : { text: p, hi: false }
    );
  return segments.flatMap((s) =>
    s.text
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => ({ text: t, hi: s.hi }))
  );
}

/** Strip markup for the plain-text exporters. */
export function plainTitle(title: string): string {
  return title.replace(/\*([^*]+)\*/g, "$1");
}

function wrap(ctx: CanvasRenderingContext2D, words: Word[], maxW: number): Word[][] {
  const space = ctx.measureText(" ").width;
  const lines: Word[][] = [];
  let cur: Word[] = [];
  let curW = 0;
  for (const w of words) {
    const ww = ctx.measureText(w.text).width;
    const add = cur.length ? space + ww : ww;
    if (curW + add > maxW && cur.length) {
      lines.push(cur);
      cur = [w];
      curW = ww;
    } else {
      cur.push(w);
      curW += add;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function lineWidth(ctx: CanvasRenderingContext2D, line: Word[]): number {
  const space = ctx.measureText(" ").width;
  return line.reduce((s, w, i) => s + (i ? space : 0) + ctx.measureText(w.text).width, 0);
}

/* -------------------------------- primitives ------------------------------ */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

let noisePattern: CanvasPattern | null = null;
function grainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (noisePattern) return noisePattern;
  const tile = document.createElement("canvas");
  tile.width = tile.height = 128;
  const tctx = tile.getContext("2d");
  if (!tctx) return null;
  const img = tctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  noisePattern = ctx.createPattern(tile, "repeat");
  return noisePattern;
}

/** Draw an image cropped to cover a box, honouring an optional blur. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  blur: number
) {
  const ir = img.width / img.height;
  const br = w / h;
  let dw = w;
  let dh = h;
  let dx = x;
  let dy = y;
  if (ir > br) {
    dw = h * ir;
    dx = x - (dw - w) / 2;
  } else {
    dh = w / ir;
    dy = y - (dh - h) / 2;
  }
  ctx.save();
  drawBlurred(ctx, img, dx, dy, dw, dh, blur);
  ctx.restore();
}

/* --------------------------------- renderer ------------------------------- */

const luminanceOf = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/** The accent as a fill: a left-to-right sweep between x0 and x1, or the flat color. */
function accentFill(ctx: CanvasRenderingContext2D, cfg: OgConfig, x0: number, x1: number, alpha = 1): string | CanvasGradient {
  if (!cfg.accentGradient) return rgba(cfg.accentFrom, alpha);
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, rgba(cfg.accentFrom, alpha));
  g.addColorStop(1, rgba(cfg.accentTo, alpha));
  return g;
}

/** A small seeded generator, so scattered decorations land the same on every render. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Graphics behind the words, drawn in the accent colors. */
function drawDecor(ctx: CanvasRenderingContext2D, cfg: OgConfig, W: number, H: number) {
  const k = cfg.decorStrength;
  if (cfg.decor === "none" || k <= 0) return;
  const a = cfg.accentFrom;
  const b = cfg.accentTo;
  const centered = cfg.align === "center";
  ctx.save();

  if (cfg.decor === "rings") {
    const cx = centered ? W / 2 : W * 0.88;
    const cy = centered ? -H * 0.04 : H * 0.14;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.7);
    glow.addColorStop(0, rgba(a, 0.3 * k));
    glow.addColorStop(1, rgba(a, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = Math.max(1, H * 0.0026);
    for (let i = 1; i <= 10; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, H * 0.105 * i, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(i % 2 ? a : b, k * 0.6 * (1 - i / 11));
      ctx.stroke();
    }
  } else if (cfg.decor === "beams") {
    ctx.globalCompositeOperation = "lighter";
    const ox = W * 0.5;
    const oy = -H * 0.32;
    const reach = H * 1.8;
    const beams: [number, number][] = [[-0.68, 0.05], [-0.44, 0.1], [-0.24, 0.04], [-0.06, 0.12], [0.14, 0.05], [0.33, 0.09], [0.56, 0.06]];
    beams.forEach(([angle, spread], i) => {
      const at = (t: number): [number, number] => [ox + Math.sin(t) * reach, oy + Math.cos(t) * reach];
      const [x1, y1] = at(angle - spread / 2);
      const [x2, y2] = at(angle + spread / 2);
      const [mx, my] = at(angle);
      const g = ctx.createLinearGradient(ox, oy, mx, my);
      g.addColorStop(0.12, rgba(i % 2 ? b : a, 0.36 * k));
      g.addColorStop(0.75, rgba(i % 2 ? b : a, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.fill();
    });
  } else if (cfg.decor === "orbs") {
    const orbs: [number, number, number][] = centered
      ? [[0.9, 0.2, 0.15], [0.1, 0.22, 0.1], [0.84, 0.86, 0.09], [0.14, 0.84, 0.07]]
      : [[0.88, 0.22, 0.2], [0.97, 0.7, 0.08], [0.56, 0.98, 0.08]];
    for (const [fx, fy, fr] of orbs) {
      const cx = W * fx;
      const cy = H * fy;
      const r = H * fr;
      const haze = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.1);
      haze.addColorStop(0, rgba(b, 0.34 * k));
      haze.addColorStop(1, rgba(b, 0));
      ctx.fillStyle = haze;
      ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
      // A lit ball: highlight up and to the left, falling into the second accent.
      const ball = ctx.createRadialGradient(cx - r * 0.36, cy - r * 0.42, r * 0.04, cx, cy, r);
      ball.addColorStop(0, rgba("#ffffff", 0.95 * k));
      ball.addColorStop(0.28, rgba(a, k));
      ball.addColorStop(1, rgba(b, 0.92 * k));
      ctx.fillStyle = ball;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (cfg.decor === "horizon") {
    const hy = H * 0.6;
    const sun = ctx.createRadialGradient(W / 2, hy, 0, W / 2, hy, H * 0.62);
    sun.addColorStop(0, rgba(b, 0.42 * k));
    sun.addColorStop(1, rgba(b, 0));
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = Math.max(1, H * 0.002);
    // A floor running off to the horizon: rails converge, sleepers bunch up.
    const rail = ctx.createLinearGradient(0, hy, 0, H);
    rail.addColorStop(0, rgba(a, 0));
    rail.addColorStop(1, rgba(a, 0.62 * k));
    ctx.strokeStyle = rail;
    for (let i = -16; i <= 16; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * W * 0.011, hy);
      ctx.lineTo(W / 2 + i * W * 0.13, H);
      ctx.stroke();
    }
    for (let j = 1; j <= 11; j++) {
      const y = hy + (H - hy) * Math.pow(j / 11, 2.3);
      ctx.strokeStyle = rgba(a, 0.62 * k * (j / 11));
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    const line = ctx.createLinearGradient(0, 0, W, 0);
    line.addColorStop(0, rgba(b, 0));
    line.addColorStop(0.5, rgba(b, 0.95 * k));
    line.addColorStop(1, rgba(b, 0));
    ctx.fillStyle = line;
    ctx.fillRect(0, hy - H * 0.003, W, H * 0.006);
  } else if (cfg.decor === "waves") {
    for (let l = 0; l < 4; l++) {
      const base = H * (0.76 + l * 0.065);
      const amp = H * (0.055 - l * 0.009);
      const sweep = ctx.createLinearGradient(0, 0, W, 0);
      sweep.addColorStop(0, rgba(l % 2 ? b : a, k * (0.16 + l * 0.11)));
      sweep.addColorStop(1, rgba(l % 2 ? a : b, k * (0.16 + l * 0.11)));
      ctx.fillStyle = sweep;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i <= 64; i++) {
        const x = (W * i) / 64;
        ctx.lineTo(x, base + Math.sin((i / 64) * Math.PI * 2 * (1.1 + l * 0.45) + l * 1.7) * amp);
      }
      ctx.lineTo(W, H);
      ctx.fill();
    }
  } else if (cfg.decor === "stars") {
    const rand = seeded(7);
    const unit = Math.min(W, H) / 630;
    for (let i = 0; i < 130; i++) {
      ctx.fillStyle = rgba("#ffffff", k * (0.2 + rand() * 0.8));
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H, (0.6 + rand() * 1.7) * unit, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 8; i++) {
      const cx = rand() * W;
      const cy = rand() * H;
      const s = (10 + rand() * 20) * unit;
      ctx.fillStyle = rgba(i % 2 ? a : b, k);
      // A four-point sparkle.
      ctx.beginPath();
      for (let p = 0; p < 8; p++) {
        const r = p % 2 ? s * 0.16 : s;
        const t = (p / 8) * Math.PI * 2;
        ctx.lineTo(cx + Math.sin(t) * r, cy - Math.cos(t) * r);
      }
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A stand-in product screen, so the screenshot layouts look designed before anything is uploaded. */
function drawMockScreen(ctx: CanvasRenderingContext2D, cfg: OgConfig, x: number, y: number, w: number, h: number, dark: boolean) {
  const ink = dark ? "#ffffff" : "#0f172a";
  ctx.fillStyle = dark ? "#0d1117" : "#ffffff";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rgba(ink, dark ? 0.035 : 0.04);
  ctx.fillRect(x, y, w * 0.2, h);
  const bar = (bx: number, by: number, bw: number, bh: number, alpha: number) => {
    roundRect(ctx, x + bx * w, y + by * h, bw * w, bh * h, Math.min(bw * w, bh * h) / 2);
    ctx.fillStyle = rgba(ink, alpha);
    ctx.fill();
  };
  bar(0.035, 0.07, 0.11, 0.035, 0.5);
  for (let i = 0; i < 6; i++) bar(0.035, 0.19 + i * 0.085, 0.08 + (i % 3) * 0.022, 0.026, i === 1 ? 0.5 : 0.16);
  bar(0.245, 0.07, 0.26, 0.05, 0.75);
  bar(0.245, 0.145, 0.38, 0.026, 0.2);
  // Three figures, then a chart in the accent.
  for (let i = 0; i < 3; i++) {
    const cx = x + (0.245 + i * 0.245) * w;
    roundRect(ctx, cx, y + 0.23 * h, 0.225 * w, 0.2 * h, h * 0.018);
    ctx.fillStyle = rgba(ink, dark ? 0.055 : 0.045);
    ctx.fill();
    bar(0.265 + i * 0.245, 0.27, 0.08, 0.022, 0.24);
    bar(0.265 + i * 0.245, 0.33, 0.13, 0.05, 0.7);
  }
  roundRect(ctx, x + 0.245 * w, y + 0.48 * h, 0.715 * w, 0.46 * h, h * 0.018);
  ctx.fillStyle = rgba(ink, dark ? 0.055 : 0.045);
  ctx.fill();
  const rand = seeded(11);
  for (let i = 0; i < 12; i++) {
    const bh = (0.1 + rand() * 0.26) * h;
    const bx = x + (0.275 + i * 0.055) * w;
    roundRect(ctx, bx, y + 0.9 * h - bh, 0.034 * w, bh, 0.008 * w);
    ctx.fillStyle = accentFill(ctx, cfg, x + 0.245 * w, x + 0.96 * w, 0.92);
    ctx.fill();
  }
}

/** The screenshot (or its stand-in) in its frame, tilted and lifted off the page. */
function drawMedia(
  ctx: CanvasRenderingContext2D,
  cfg: OgConfig,
  img: HTMLImageElement | null | undefined,
  box: { x: number; y: number; w: number; h: number },
  H: number,
  scale: number,
  bodyFamily: string
) {
  const dark = luminanceOf(cfg.textColor) > 0.55; // light words sit on a dark card: match it
  const { x, y, w, h } = box;
  const r = H * (cfg.mediaFrame === "none" ? 0.018 : 0.026);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((cfg.mediaTilt * Math.PI) / 180);
  ctx.translate(-(x + w / 2), -(y + h / 2));

  // Lift: shadows are set in device pixels, so they scale with the export.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = H * 0.11 * scale;
  ctx.shadowOffsetY = H * 0.04 * scale;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = dark ? "#0d1117" : "#ffffff";
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  let top = y;
  if (cfg.mediaFrame === "browser") {
    const barH = H * 0.062;
    ctx.fillStyle = dark ? "#161b22" : "#eef1f5";
    ctx.fillRect(x, y, w, barH);
    ["#ff5f56", "#ffbd2e", "#27c93f"].forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(x + barH * 0.62 + i * barH * 0.42, y + barH / 2, barH * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    });
    // The address bar carries the domain.
    const pillW = Math.min(w * 0.46, H * 0.7);
    roundRect(ctx, x + (w - pillW) / 2, y + barH * 0.2, pillW, barH * 0.6, barH * 0.3);
    ctx.fillStyle = dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)";
    ctx.fill();
    if (cfg.domain.trim()) {
      ctx.font = `500 ${barH * 0.34}px ${bodyFamily}`;
      ctx.fillStyle = dark ? "rgba(255,255,255,0.62)" : "rgba(15,23,42,0.62)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cfg.domain.trim(), x + w / 2, y + barH * 0.52, pillW * 0.9);
    }
    top = y + barH;
  }
  if (img) {
    // Fill the frame from the top of the screenshot down: the top is what people recognise.
    const s = Math.max(w / img.width, (y + h - top) / img.height);
    ctx.drawImage(img, x + (w - img.width * s) / 2, top, img.width * s, img.height * s);
  } else {
    drawMockScreen(ctx, cfg, x, top, w, y + h - top, dark);
  }
  ctx.restore();

  roundRect(ctx, x, y, w, h, r);
  ctx.lineWidth = Math.max(1, H * 0.0022);
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.12)";
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw the card. `scale` is device pixels per design pixel: the preview draws
 * small, the export at `cfg.scale`.
 */
export function renderOg(
  canvas: HTMLCanvasElement,
  cfg: OgConfig,
  assets: OgAssets = {},
  scale: number = cfg.scale
): { w: number; h: number } {
  const size = SIZES.find((s) => s.id === cfg.sizeId) ?? SIZES[0];
  const W = size.w;
  const H = size.h;

  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { w: W, h: H };
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const titleFamily = resolveFont(cfg.titleFont);
  const bodyFamily = resolveFont(cfg.bodyFont);

  /* ---- background ---- */
  if (cfg.bgType === "solid") {
    ctx.fillStyle = cfg.solid;
    ctx.fillRect(0, 0, W, H);
  } else if (cfg.bgType === "gradient") {
    const a = (cfg.gradAngle * Math.PI) / 180;
    const cx = W / 2;
    const cy = H / 2;
    const len = (Math.abs(Math.cos(a)) * W + Math.abs(Math.sin(a)) * H) / 2;
    const g = ctx.createLinearGradient(
      cx - Math.cos(a) * len,
      cy - Math.sin(a) * len,
      cx + Math.cos(a) * len,
      cy + Math.sin(a) * len
    );
    g.addColorStop(0, cfg.gradFrom);
    g.addColorStop(1, cfg.gradTo);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (cfg.bgType === "mesh") {
    ctx.fillStyle = cfg.meshBase;
    ctx.fillRect(0, 0, W, H);
    const radius = Math.max(W, H) * 0.75;
    for (const blob of cfg.mesh) {
      const bx = blob.x * W;
      const by = blob.y * H;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, radius);
      g.addColorStop(0, rgba(blob.color, 0.85));
      g.addColorStop(1, rgba(blob.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  } else if (cfg.bgType === "image") {
    if (assets.bg) {
      drawCover(ctx, assets.bg, 0, 0, W, H, cfg.imageBlur);
    } else {
      ctx.fillStyle = "#0b1120";
      ctx.fillRect(0, 0, W, H);
    }
    if (cfg.imageOverlayOpacity > 0) {
      ctx.fillStyle = rgba(cfg.imageOverlay, cfg.imageOverlayOpacity);
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---- top glow ---- */
  if (cfg.topGlow) {
    const g = ctx.createRadialGradient(W / 2, -H * 0.1, 0, W / 2, -H * 0.1, H * 0.9);
    g.addColorStop(0, rgba(cfg.accentFrom, 0.5));
    g.addColorStop(1, rgba(cfg.accentFrom, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  drawDecor(ctx, cfg, W, H);

  /* ---- pattern overlay ---- */
  if (cfg.pattern !== "none" && cfg.patternOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = cfg.patternOpacity;
    ctx.strokeStyle = cfg.patternColor;
    ctx.fillStyle = cfg.patternColor;
    const step = Math.round(W / 34);
    if (cfg.pattern === "dots") {
      const r = Math.max(1.5, step * 0.06);
      for (let x = step; x < W; x += step)
        for (let y = step; y < H; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
    } else if (cfg.pattern === "grid") {
      ctx.lineWidth = 1;
      for (let x = step; x < W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = step; y < H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    } else if (cfg.pattern === "lines") {
      ctx.lineWidth = 1;
      const gap = step * 1.4;
      for (let d = -H; d < W; d += gap) {
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d + H, H);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ---- layout: where the words go, and where the screenshot goes ---- */
  const padX = W * 0.075;
  const padY = H * 0.09;
  // Type is sized off the shorter side, so a tall story doesn't get a poster-sized headline.
  const tall = H > W * 0.95;
  const U = Math.min(H, W * (tall ? 0.85 : 0.62));
  // Side by side needs width; on a square or a story the screenshot goes underneath instead.
  const layout: Layout = cfg.layout === "split" && tall ? "showcase" : cfg.layout;

  let contentW = W - padX * 2;
  let align: Align = cfg.align;
  let vAnchor: VAnchor = cfg.vAnchor;
  let regionBottom = H - padY;
  let showFooter = cfg.showFooter;
  let titleBase = U * 0.115;
  let descBase = U * 0.044;
  let media: { x: number; y: number; w: number; h: number } | null = null;

  if (layout === "split") {
    contentW = W * 0.43;
    align = "left";
    titleBase = U * 0.098;
    media = { x: W * 0.555, y: H * 0.17, w: W * 0.62, h: H * 0.74 };
  } else if (layout === "showcase") {
    align = "center";
    vAnchor = "top";
    contentW = W * 0.82;
    titleBase = U * 0.094;
    descBase = U * 0.04;
    regionBottom = H * (tall ? 0.42 : 0.47);
    showFooter = false;
    const mw = W * (tall ? 0.84 : 0.7);
    media = { x: (W - mw) / 2, y: H * (tall ? 0.46 : 0.51), w: mw, h: H * 0.66 };
  } else if (layout === "quote") {
    contentW = W * 0.8;
  }
  const left = padX;
  const centerX = layout === "split" ? padX + contentW / 2 : W / 2;

  if (media) drawMedia(ctx, cfg, assets.media, media, H, scale, bodyFamily);

  let titlePx = titleBase * cfg.titleScale;
  let descPx = descBase * cfg.descScale;
  const eyebrowPx = Math.max(14, U * 0.028);
  const footerPx = Math.max(15, U * 0.03);
  const gap = U * 0.03;

  const words = parseTitle(cfg.title || " ");
  const quote = layout === "quote";
  const eyebrowOn = !quote && cfg.showEyebrow && cfg.eyebrow.trim().length > 0;
  const attribution = quote ? [cfg.authorName.trim(), cfg.authorHandle.trim()].filter(Boolean).join("  ·  ") : "";

  // Measure, then optionally shrink so the whole block fits the safe area.
  const measure = () => {
    ctx.font = `${cfg.titleWeight} ${titlePx}px ${titleFamily}`;
    const titleLines = wrap(ctx, words, contentW);
    const titleLH = titlePx * 1.12;
    ctx.font = `400 ${descPx}px ${bodyFamily}`;
    const descWords = (cfg.description || "").split(/\s+/).filter(Boolean).map((t) => ({ text: t, hi: false }));
    const descLines = cfg.description.trim() ? wrap(ctx, descWords, contentW) : [];
    const descLH = descPx * 1.4;
    const headH = quote ? U * 0.16 : eyebrowOn ? eyebrowPx * 2.4 : 0;
    const blockH =
      headH +
      titleLines.length * titleLH +
      (descLines.length ? gap * 0.7 + descLines.length * descLH : 0) +
      (attribution ? gap + descPx * 1.3 : 0);
    return { titleLines, titleLH, descLines, descLH, headH, blockH };
  };

  const footerH = showFooter ? footerPx * 2.6 : 0;
  const safeTop = padY + (cfg.logoSlot === "top" && assets.logo ? U * 0.11 : 0);
  const safeBottom = regionBottom - footerH;
  const safeH = safeBottom - safeTop;

  let m = measure();
  if (cfg.autoFit) {
    let guard = 0;
    while (m.blockH > safeH && guard < 28) {
      titlePx *= 0.94;
      descPx *= 0.94;
      m = measure();
      guard++;
    }
  }

  let blockTop: number;
  if (vAnchor === "top") blockTop = safeTop;
  else if (vAnchor === "bottom") blockTop = safeBottom - m.blockH;
  else blockTop = safeTop + (safeH - m.blockH) / 2;

  const alignX = align === "center" ? centerX : left;

  /* ---- glass card ---- */
  if (cfg.glass) {
    const gpad = U * 0.05;
    const cardW = contentW + gpad * 2;
    const cardX = align === "center" ? centerX - cardW / 2 : left - gpad;
    ctx.save();
    roundRect(ctx, cardX, blockTop - gpad, cardW, m.blockH + gpad * 2, U * 0.03);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.stroke();
    ctx.restore();
  }

  let y = blockTop;

  /* ---- opening quotation mark ---- */
  if (quote) {
    ctx.font = `700 ${U * 0.36}px Georgia, 'Times New Roman', serif`;
    ctx.textBaseline = "top";
    ctx.textAlign = align === "center" ? "center" : "left";
    const mw = ctx.measureText("“").width;
    const mx = align === "center" ? centerX : left - U * 0.012;
    ctx.fillStyle = accentFill(ctx, cfg, align === "center" ? mx - mw / 2 : mx, align === "center" ? mx + mw / 2 : mx + mw);
    ctx.fillText("“", mx, y - U * 0.065);
    y += m.headH;
  }

  /* ---- eyebrow badge ---- */
  if (eyebrowOn) {
    ctx.font = `600 ${eyebrowPx}px ${bodyFamily}`;
    const label = cfg.eyebrow.toUpperCase();
    const spacing = eyebrowPx * 0.06;
    const tw = [...label].reduce((s, ch) => s + ctx.measureText(ch).width + spacing, -spacing);
    const bpH = eyebrowPx * 1.9;
    const bpW = tw + eyebrowPx * 1.6;
    const bx = align === "center" ? centerX - bpW / 2 : left;
    roundRect(ctx, bx, y, bpW, bpH, bpH / 2);
    ctx.fillStyle = accentFill(ctx, cfg, bx, bx + bpW, 0.2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(cfg.accentFrom, 0.4);
    ctx.stroke();
    ctx.fillStyle = cfg.accentFrom;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let ex = bx + eyebrowPx * 0.8;
    for (const ch of label) {
      ctx.fillText(ch, ex, y + bpH / 2);
      ex += ctx.measureText(ch).width + spacing;
    }
    y += m.headH;
  }

  /* ---- title, with its accented phrases ---- */
  ctx.font = `${cfg.titleWeight} ${titlePx}px ${titleFamily}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const space = ctx.measureText(" ").width;
  const onAccent = luminanceOf(cfg.accentFrom) > 0.55 ? "#0b1120" : "#ffffff";
  for (const line of m.titleLines) {
    const lw = lineWidth(ctx, line);
    const startX = align === "center" ? centerX - lw / 2 : left;
    const xs: number[] = [];
    let cursor = startX;
    for (const word of line) {
      xs.push(cursor);
      cursor += ctx.measureText(word.text).width + space;
    }
    // Shapes behind (or under) each run of accented words.
    if (cfg.highlight !== "text") {
      for (let i = 0; i < line.length; i++) {
        if (!line[i].hi) continue;
        let j = i;
        while (j + 1 < line.length && line[j + 1].hi) j++;
        const x0 = xs[i];
        const x1 = xs[j] + ctx.measureText(line[j].text).width;
        const bleed = titlePx * 0.1;
        if (cfg.highlight === "marker") {
          ctx.fillStyle = accentFill(ctx, cfg, x0, x1, 0.6);
          roundRect(ctx, x0 - bleed, y + titlePx * 0.5, x1 - x0 + bleed * 2, titlePx * 0.5, titlePx * 0.06);
          ctx.fill();
        } else if (cfg.highlight === "underline") {
          ctx.fillStyle = accentFill(ctx, cfg, x0, x1);
          roundRect(ctx, x0, y + titlePx * 1.0, x1 - x0, titlePx * 0.075, titlePx * 0.04);
          ctx.fill();
        } else {
          ctx.fillStyle = accentFill(ctx, cfg, x0, x1);
          roundRect(ctx, x0 - bleed * 1.4, y - titlePx * 0.04, x1 - x0 + bleed * 2.8, titlePx * 1.12, titlePx * 0.2);
          ctx.fill();
        }
        i = j;
      }
    }
    line.forEach((word, i) => {
      if (!word.hi) ctx.fillStyle = cfg.textColor;
      else if (cfg.highlight === "text") ctx.fillStyle = accentFill(ctx, cfg, xs[i], xs[i] + ctx.measureText(word.text).width);
      else ctx.fillStyle = cfg.highlight === "pill" ? onAccent : cfg.textColor;
      ctx.fillText(word.text, xs[i], y);
    });
    y += m.titleLH;
  }
  ctx.textAlign = align === "center" ? "center" : "left";

  /* ---- description ---- */
  if (m.descLines.length) {
    y += gap * 0.7;
    ctx.font = `400 ${descPx}px ${bodyFamily}`;
    ctx.fillStyle = cfg.mutedColor;
    for (const line of m.descLines) {
      ctx.fillText(line.map((w) => w.text).join(" "), alignX, y);
      y += m.descLH;
    }
  }

  /* ---- who said it ---- */
  if (attribution) {
    y += gap;
    ctx.font = `600 ${descPx}px ${bodyFamily}`;
    ctx.fillStyle = cfg.textColor;
    ctx.fillText(`—  ${attribution}`, alignX, y);
  }

  /* ---- logo (top slot) ---- */
  if (cfg.logoSlot === "top" && assets.logo) {
    const lh = U * 0.07;
    const lw = (assets.logo.width / assets.logo.height) * lh;
    ctx.drawImage(assets.logo, align === "center" ? centerX - lw / 2 : left, padY, lw, lh);
  }

  /* ---- footer byline ---- */
  if (showFooter) {
    const fy = H - padY - footerPx * 1.4;
    ctx.textBaseline = "middle";
    let fx = padX;
    const avSize = footerPx * 1.8;
    if (cfg.logoSlot === "footer" && assets.logo) {
      const lw = (assets.logo.width / assets.logo.height) * avSize;
      ctx.drawImage(assets.logo, padX, fy - avSize / 2, lw, avSize);
      fx = padX + lw + footerPx * 0.7;
    } else if (assets.avatar && !quote) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(padX + avSize / 2, fy, avSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(assets.avatar, padX, fy - avSize / 2, avSize, avSize);
      ctx.restore();
      fx = padX + avSize + footerPx * 0.7;
    }
    ctx.textAlign = "left";
    // A quote already names its author under the words.
    if (cfg.authorName.trim() && !quote) {
      ctx.font = `600 ${footerPx}px ${bodyFamily}`;
      ctx.fillStyle = cfg.textColor;
      ctx.fillText(cfg.authorName, fx, fy - (cfg.authorHandle.trim() ? footerPx * 0.6 : 0));
      if (cfg.authorHandle.trim()) {
        ctx.font = `400 ${footerPx * 0.85}px ${bodyFamily}`;
        ctx.fillStyle = cfg.mutedColor;
        ctx.fillText(cfg.authorHandle, fx, fy + footerPx * 0.6);
      }
    }
    // Beside a screenshot the domain is already in its address bar.
    if (cfg.domain.trim() && layout !== "split") {
      ctx.font = `500 ${footerPx * 0.92}px ${bodyFamily}`;
      ctx.fillStyle = cfg.mutedColor;
      ctx.textAlign = "right";
      ctx.fillText(cfg.domain, W - padX, fy);
    }
    ctx.textAlign = "left";
  }

  /* ---- inner frame ---- */
  if (cfg.frame) {
    const inset = U * 0.034;
    roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, U * 0.03);
    ctx.lineWidth = Math.max(1.5, U * 0.003);
    ctx.strokeStyle = rgba(cfg.textColor, 0.22);
    ctx.stroke();
  }

  /* ---- vignette ---- */
  if (cfg.vignette > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${cfg.vignette})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---- grain ---- */
  if (cfg.grain > 0) {
    const pat = grainPattern(ctx);
    if (pat) {
      ctx.save();
      ctx.globalAlpha = cfg.grain * 0.14;
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  return { w: W, h: H };
}

/* ------------------------------ code exporters ---------------------------- */

export function buildMetaTags(cfg: OgConfig, imageUrl = "https://example.com/og.png"): string {
  const title = plainTitle(cfg.title).replace(/"/g, "&quot;");
  const desc = cfg.description.replace(/"/g, "&quot;");
  const size = SIZES.find((s) => s.id === cfg.sizeId) ?? SIZES[0];
  return [
    `<!-- Primary -->`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:image" content="${imageUrl}" />`,
    `<meta property="og:image:width" content="${size.w}" />`,
    `<meta property="og:image:height" content="${size.h}" />`,
    cfg.domain.trim() ? `<meta property="og:site_name" content="${cfg.domain}" />` : "",
    `<meta property="og:type" content="website" />`,
    ``,
    `<!-- Twitter / X -->`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${desc}" />`,
    `<meta name="twitter:image" content="${imageUrl}" />`,
    cfg.authorHandle.trim() ? `<meta name="twitter:creator" content="${cfg.authorHandle}" />` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/**
 * Emit a drop-in Next.js `opengraph-image.tsx` (App Router) that reproduces the
 * core layout with `next/og`'s ImageResponse — so the card is generated on the
 * fly per page instead of shipped as a static PNG. Mesh/grain are approximated
 * with a CSS gradient (Satori doesn't rasterize canvas effects).
 */
export function buildOgRoute(cfg: OgConfig): string {
  const size = SIZES.find((s) => s.id === cfg.sizeId) ?? SIZES[0];
  const bg =
    cfg.bgType === "solid"
      ? `"${cfg.solid}"`
      : cfg.bgType === "mesh"
        ? `"radial-gradient(at 20% 20%, ${cfg.mesh[0]?.color ?? cfg.accentFrom} 0px, transparent 55%), radial-gradient(at 85% 20%, ${cfg.mesh[1]?.color ?? cfg.accentTo} 0px, transparent 50%), ${cfg.meshBase}"`
        : `"linear-gradient(${cfg.gradAngle}deg, ${cfg.gradFrom}, ${cfg.gradTo})"`;
  const title = plainTitle(cfg.title).replace(/`/g, "\\`");
  const accent = cfg.accentGradient
    ? `background: "linear-gradient(90deg, ${cfg.accentFrom}, ${cfg.accentTo})", backgroundClip: "text", color: "transparent"`
    : `color: "${cfg.accentFrom}"`;
  const alignItems = cfg.align === "center" ? "center" : "flex-start";
  const textAlign = cfg.align === "center" ? "center" : "left";

  return `// app/opengraph-image.tsx  — Next.js App Router
import { ImageResponse } from "next/og";

export const size = { width: ${size.w}, height: ${size.h} };
export const contentType = "image/png";
export const alt = ${JSON.stringify(plainTitle(cfg.title))};

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "${cfg.vAnchor === "top" ? "flex-start" : cfg.vAnchor === "bottom" ? "flex-end" : "center"}",
          alignItems: "${alignItems}",
          textAlign: "${textAlign}",
          padding: "${Math.round(size.h * 0.09)}px ${Math.round(size.w * 0.075)}px",
          backgroundImage: ${bg},
          fontFamily: "sans-serif",
        }}
      >
        ${cfg.showEyebrow && cfg.eyebrow.trim() ? `<div style={{ fontSize: 28, letterSpacing: 2, textTransform: "uppercase", color: "${cfg.accentFrom}", marginBottom: 24 }}>${cfg.eyebrow}</div>` : ""}
        <div style={{ display: "flex", fontSize: ${Math.round(size.h * 0.115)}, fontWeight: ${cfg.titleWeight}, lineHeight: 1.1, ${accent}, maxWidth: "85%" }}>
          {\`${title}\`}
        </div>
        ${cfg.description.trim() ? `<div style={{ fontSize: ${Math.round(size.h * 0.044)}, color: "${cfg.mutedColor}", marginTop: 28, maxWidth: "80%" }}>${cfg.description.replace(/`/g, "\\`")}</div>` : ""}
        ${cfg.showFooter && (cfg.authorName.trim() || cfg.domain.trim()) ? `<div style={{ position: "absolute", bottom: ${Math.round(size.h * 0.09)}, left: ${Math.round(size.w * 0.075)}, right: ${Math.round(size.w * 0.075)}, display: "flex", justifyContent: "space-between", fontSize: 30, color: "${cfg.mutedColor}" }}><span style={{ color: "${cfg.textColor}", fontWeight: 600 }}>${cfg.authorName}</span><span>${cfg.domain}</span></div>` : ""}
      </div>
    ),
    { ...size }
  );
}
`;
}

export function ogFilename(cfg: OgConfig): string {
  const base = plainTitle(cfg.title).trim().slice(0, 40).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${base || "og-image"}-${cfg.sizeId}`;
}
