/**
 * Loop Studio engine. Turns a wordmark, an SVG or a logo image into a seamless
 * looping animation, rendered on a <canvas> as a pure function of loop progress.
 *
 * Everything is deterministic: `renderFrame(ctx, cfg, subject, t)` with the same
 * arguments always draws the same pixels. That is what lets the preview, the GIF
 * encoder, the sprite sheet and the PNG sequence all share one renderer and
 * agree exactly — and why nothing here uses a timer, a random seed or the clock.
 *
 * Every preset is periodic in `t`, so frame 0 and frame N are identical and the
 * loop has no visible seam.
 */

import { encodeGif } from "./gif-encode";

/* ---------------------------------- types --------------------------------- */

export type SourceKind = "text" | "svg" | "image";

export type PresetId =
  | "breathe"
  | "float"
  | "shimmer"
  | "wipe"
  | "glitch"
  | "orbit"
  | "drawOn"
  | "stagger"
  | "spin"
  | "pulse";

export type BgType = "transparent" | "solid" | "gradient";

export interface LoopConfig {
  source: SourceKind;

  // Text source
  text: string;
  font: string;
  weight: number;
  tracking: number;

  preset: PresetId;
  /** Output is square — the format every avatar, sticker and badge wants. */
  size: number;
  fps: number;
  /** Seconds per loop. */
  duration: number;
  /** Preset intensity, 0–1. */
  amount: number;

  color: string;
  color2: string;
  useGradient: boolean;

  bgType: BgType;
  bg1: string;
  bg2: string;
  bgAngle: number;

  /** Fraction of the canvas kept clear around the subject. */
  padding: number;
  glow: number;
  shadow: number;
}

export const FONTS: { label: string; value: string }[] = [
  { label: "Space Grotesk", value: "--font-space-grotesk" },
  { label: "Geist Sans", value: "--font-geist-sans" },
  { label: "Geist Mono", value: "--font-geist-mono" },
  { label: "System Sans", value: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
];

export const SIZES = [256, 400, 512, 720, 1024] as const;
export const FPS_OPTIONS = [12, 15, 24, 30] as const;

export interface PresetMeta {
  id: PresetId;
  label: string;
  hint: string;
  /** Presets that animate individual glyphs or paths need a divisible subject. */
  needsParts?: boolean;
  /** Draw-on strokes an outline, so it only means anything for vector sources. */
  needsVector?: boolean;
}

export const PRESETS: PresetMeta[] = [
  { id: "breathe", label: "Breathe", hint: "a slow, confident scale pulse" },
  { id: "float", label: "Float", hint: "gentle rise and fall with a moving shadow" },
  { id: "shimmer", label: "Shimmer", hint: "a light sweep travelling across the mark" },
  { id: "pulse", label: "Pulse", hint: "a glow that swells and settles" },
  { id: "wipe", label: "Wipe", hint: "reveals edge to edge, then clears" },
  { id: "glitch", label: "Glitch", hint: "channel split and slice displacement" },
  { id: "orbit", label: "Orbit", hint: "a dot circling the mark" },
  { id: "spin", label: "Spin", hint: "a full turn on the vertical axis" },
  { id: "stagger", label: "Stagger", hint: "letters or paths arrive in sequence", needsParts: true },
  { id: "drawOn", label: "Draw on", hint: "strokes the outline, then fills", needsVector: true },
];

export const DEFAULT_LOOP: LoopConfig = {
  source: "text",
  text: "FORMA",
  font: "--font-space-grotesk",
  weight: 800,
  tracking: 0.02,
  preset: "shimmer",
  size: 512,
  fps: 24,
  duration: 2.5,
  amount: 0.6,
  color: "#ecfdf5",
  color2: "#34d399",
  useGradient: true,
  bgType: "gradient",
  bg1: "#04140f",
  bg2: "#052e26",
  bgAngle: 145,
  padding: 0.16,
  glow: 0.4,
  shadow: 0.3,
};

export const THEMES: { name: string; swatch: string; patch: Partial<LoopConfig> }[] = [
  {
    name: "Emerald",
    swatch: "linear-gradient(135deg,#04140f,#34d399)",
    patch: { color: "#ecfdf5", color2: "#34d399", useGradient: true, bgType: "gradient", bg1: "#04140f", bg2: "#052e26", glow: 0.4 },
  },
  {
    name: "Midnight",
    swatch: "linear-gradient(135deg,#020617,#38bdf8)",
    patch: { color: "#e2e8f0", color2: "#38bdf8", useGradient: true, bgType: "gradient", bg1: "#0b1020", bg2: "#020617", glow: 0.35 },
  },
  {
    name: "Paper",
    swatch: "linear-gradient(135deg,#f4f4f5,#047857)",
    patch: { color: "#0b1120", color2: "#047857", useGradient: true, bgType: "solid", bg1: "#f4f4f5", glow: 0 },
  },
  {
    name: "Cutout",
    swatch: "repeating-conic-gradient(#d4d4d8 0% 25%, #fafafa 0% 50%) 0 0/12px 12px",
    patch: { color: "#0b1120", color2: "#059669", useGradient: false, bgType: "transparent", glow: 0, shadow: 0 },
  },
];

/* -------------------------------- subjects -------------------------------- */

/**
 * One animatable piece — a glyph, or one path from an SVG. Presets that stagger
 * or draw on operate over these; everything else just paints them all.
 */
export interface SubjectPart {
  /** Path in subject space, or null for a raster part. */
  path: Path2D | null;
  /** Outline length, for the draw-on dash. */
  length: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Text parts carry their glyph so they can be drawn with fillText. */
  glyph?: string;
}

export interface Subject {
  kind: SourceKind;
  parts: SubjectPart[];
  /** Bounds of the whole mark in subject space. */
  w: number;
  h: number;
  image?: CanvasImageSource;
  /** Font shorthand text subjects were measured with. */
  font?: string;
  /** Baseline offset that centres the measured glyphs on the origin. */
  baseline?: number;
}

export function resolveFont(value: string): string {
  if (value.startsWith("--")) {
    if (typeof window === "undefined") return "system-ui, sans-serif";
    const v = getComputedStyle(document.documentElement).getPropertyValue(value).trim();
    return v || "system-ui, sans-serif";
  }
  return value;
}

/** Measured at a fixed size; the renderer scales the result to fit the canvas. */
const TEXT_EM = 100;

/**
 * Null on the server: measuring glyphs needs a real canvas, and this runs
 * during the client component's SSR pass before any effect has fired.
 */
export function buildTextSubject(cfg: LoopConfig): Subject | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const family = resolveFont(cfg.font);
  const font = `${cfg.weight} ${TEXT_EM}px ${family}`;
  const parts: SubjectPart[] = [];
  if (!ctx) return { kind: "text", parts, w: 1, h: 1, font };
  ctx.font = font;

  const letters = [...(cfg.text || " ")];
  const spacing = TEXT_EM * cfg.tracking;
  let x = 0;
  for (const glyph of letters) {
    const w = ctx.measureText(glyph).width;
    parts.push({ path: null, length: 0, x, y: 0, w, h: TEXT_EM, glyph });
    x += w + spacing;
  }
  const width = Math.max(1, x - spacing);
  // Cap height is a good visual centre for uppercase wordmarks.
  const metrics = ctx.measureText(cfg.text || "M");
  const ascent = metrics.actualBoundingBoxAscent || TEXT_EM * 0.72;
  const descent = metrics.actualBoundingBoxDescent || TEXT_EM * 0.05;
  // Putting the baseline here centres the inked area — not the em box — on the
  // origin, which is what actually looks centred for a wordmark.
  return { kind: "text", parts, w: width, h: ascent + descent, font, baseline: (ascent - descent) / 2 };
}

/* ------------------------------ SVG ingestion ----------------------------- */

function attrOf(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "is"));
  return m ? m[2] : null;
}

const num = (v: string | null, fallback = 0) => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Converts the shape elements a logo actually uses into path data, so every
 * part is a single uniform thing the renderer can fill, stroke and measure.
 */
function shapeToPathData(tag: string, name: string): string | null {
  if (name === "path") return attrOf(tag, "d");
  if (name === "rect") {
    const x = num(attrOf(tag, "x"));
    const y = num(attrOf(tag, "y"));
    const w = num(attrOf(tag, "width"));
    const h = num(attrOf(tag, "height"));
    if (w <= 0 || h <= 0) return null;
    return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  }
  if (name === "circle") {
    const cx = num(attrOf(tag, "cx"));
    const cy = num(attrOf(tag, "cy"));
    const r = num(attrOf(tag, "r"));
    if (r <= 0) return null;
    return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
  }
  if (name === "ellipse") {
    const cx = num(attrOf(tag, "cx"));
    const cy = num(attrOf(tag, "cy"));
    const rx = num(attrOf(tag, "rx"));
    const ry = num(attrOf(tag, "ry"));
    if (rx <= 0 || ry <= 0) return null;
    return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
  }
  if (name === "polygon" || name === "polyline") {
    const points = (attrOf(tag, "points") ?? "").trim().split(/[\s,]+/).map(Number);
    if (points.length < 4) return null;
    let d = `M${points[0]} ${points[1]}`;
    for (let i = 2; i + 1 < points.length; i += 2) d += `L${points[i]} ${points[i + 1]}`;
    return name === "polygon" ? `${d}Z` : d;
  }
  if (name === "line") {
    return `M${num(attrOf(tag, "x1"))} ${num(attrOf(tag, "y1"))}L${num(attrOf(tag, "x2"))} ${num(attrOf(tag, "y2"))}`;
  }
  return null;
}

/** Measures outline length via a detached SVG element — Path2D can't do it. */
function pathLength(d: string): number {
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
    return path.getTotalLength() || 0;
  } catch {
    return 0;
  }
}

export function buildSvgSubject(markup: string): Subject | null {
  // Path2D and getTotalLength are both browser-only — see buildTextSubject.
  if (typeof document === "undefined") return null;
  const parts: SubjectPart[] = [];
  for (const match of markup.matchAll(/<(path|rect|circle|ellipse|polygon|polyline|line)\b[^>]*>/gi)) {
    const name = match[1].toLowerCase();
    const d = shapeToPathData(match[0], name);
    if (!d) continue;
    parts.push({ path: new Path2D(d), length: pathLength(d), x: 0, y: 0, w: 0, h: 0 });
  }
  if (!parts.length) return null;

  // viewBox is the reliable coordinate space; fall back to width/height.
  const svgTag = markup.match(/<svg\b[^>]*>/i)?.[0] ?? "";
  const viewBox = (attrOf(svgTag, "viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  const w = viewBox.length === 4 && viewBox[2] > 0 ? viewBox[2] : num(attrOf(svgTag, "width"), 100);
  const h = viewBox.length === 4 && viewBox[3] > 0 ? viewBox[3] : num(attrOf(svgTag, "height"), 100);
  const offsetX = viewBox.length === 4 ? viewBox[0] : 0;
  const offsetY = viewBox.length === 4 ? viewBox[1] : 0;
  for (const part of parts) {
    part.x = offsetX;
    part.y = offsetY;
    part.w = w;
    part.h = h;
  }
  return { kind: "svg", parts, w, h };
}

export function buildImageSubject(image: CanvasImageSource, w: number, h: number): Subject {
  return { kind: "image", parts: [{ path: null, length: 0, x: 0, y: 0, w, h }], w, h, image };
}

/* -------------------------------- utilities ------------------------------- */

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

/** Smooth 0→1→0 over the loop, so the first and last frame match exactly. */
const pingPong = (t: number) => (1 - Math.cos(t * Math.PI * 2)) / 2;
/** Smooth 0→1 across the loop with matching endpoints (eased sawtooth). */
const wave = (t: number) => Math.sin(t * Math.PI * 2);
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function frameCount(cfg: LoopConfig): number {
  return Math.max(2, Math.round(cfg.fps * cfg.duration));
}

export function presetAvailable(preset: PresetMeta, subject: Subject | null): boolean {
  if (!subject) return true;
  if (preset.needsVector && subject.kind === "image") return false;
  if (preset.needsParts && subject.parts.length < 2) return false;
  return true;
}

/* -------------------------------- renderer -------------------------------- */

interface Env {
  ctx: CanvasRenderingContext2D;
  cfg: LoopConfig;
  subject: Subject;
  t: number;
  size: number;
  /** Uniform scale from subject space into canvas space. */
  scale: number;
  amount: number;
}

/** Paints the subject's fill — a colour or the two-stop gradient. */
function paint(env: Env): string | CanvasGradient {
  const { ctx, cfg, size } = env;
  if (!cfg.useGradient) return cfg.color;
  const g = ctx.createLinearGradient(0, -size / 2, size * 0.4, size / 2);
  g.addColorStop(0, cfg.color);
  g.addColorStop(1, cfg.color2);
  return g;
}

/** Draws one part at the origin-centred subject transform. */
function drawPart(env: Env, part: SubjectPart, fill: string | CanvasGradient) {
  const { ctx, subject } = env;
  ctx.fillStyle = fill;
  if (subject.kind === "text" && part.glyph) {
    ctx.font = subject.font!;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(part.glyph, part.x - subject.w / 2, subject.baseline ?? TEXT_EM * 0.36);
  } else if (subject.kind === "image" && subject.image) {
    ctx.drawImage(subject.image, -subject.w / 2, -subject.h / 2, subject.w, subject.h);
  } else if (part.path) {
    ctx.save();
    ctx.translate(-subject.w / 2 - part.x, -subject.h / 2 - part.y);
    ctx.fill(part.path);
    ctx.restore();
  }
}

function drawSubject(env: Env, fill: string | CanvasGradient) {
  for (const part of env.subject.parts) drawPart(env, part, fill);
}

/**
 * Every preset receives a context already translated to the canvas centre and
 * scaled into subject space, so each one only describes its own motion.
 */
const RENDERERS: Record<PresetId, (env: Env) => void> = {
  breathe(env) {
    const s = 1 + pingPong(env.t) * 0.16 * env.amount;
    env.ctx.scale(s, s);
    drawSubject(env, paint(env));
  },

  float(env) {
    const lift = wave(env.t) * env.subject.h * 0.12 * env.amount;
    env.ctx.translate(0, -lift);
    drawSubject(env, paint(env));
  },

  pulse(env) {
    const { ctx } = env;
    const glow = pingPong(env.t);
    ctx.save();
    ctx.shadowColor = rgba(env.cfg.color2, 0.9);
    ctx.shadowBlur = (env.subject.h * 0.5 * glow * env.amount) / env.scale;
    drawSubject(env, paint(env));
    ctx.restore();
    // A second pass without shadow keeps the mark itself crisp.
    ctx.globalAlpha = 0.9 + glow * 0.1;
    drawSubject(env, paint(env));
    ctx.globalAlpha = 1;
  },

  shimmer(env) {
    const { ctx, subject } = env;
    drawSubject(env, paint(env));
    // The sweep is clipped to what's already painted, so it rides the mark.
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    const span = subject.w * 1.6;
    const head = (env.t * (span * 2)) - span * 0.5;
    const band = ctx.createLinearGradient(head - span * 0.22, 0, head + span * 0.22, 0);
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(0.5, `rgba(255,255,255,${0.85 * env.amount})`);
    band.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = band;
    ctx.fillRect(-subject.w, -subject.h * 1.5, subject.w * 2, subject.h * 3);
    ctx.restore();
  },

  wipe(env) {
    const { ctx, subject } = env;
    // Reveal across the first half, clear across the second — a clean loop.
    const phase = env.t < 0.5 ? easeInOut(env.t * 2) : 1 - easeInOut((env.t - 0.5) * 2);
    const edge = -subject.w / 2 + subject.w * phase * 1.02;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-subject.w, -subject.h * 1.5, edge + subject.w, subject.h * 3);
    ctx.clip();
    drawSubject(env, paint(env));
    ctx.restore();
  },

  glitch(env) {
    const { ctx, subject, amount } = env;
    // Deterministic pseudo-noise: a hash of the frame, never Math.random.
    const noise = (n: number) => {
      const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const beat = Math.floor(env.t * 8);
    const active = noise(beat) > 0.45;
    const shift = active ? subject.w * 0.03 * amount : 0;

    if (shift > 0) {
      // Channel split: same mark drawn twice, screened, offset either way.
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.translate(-shift, 0);
      drawSubject(env, "#ff2d55");
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.translate(shift, 0);
      drawSubject(env, "#00f0ff");
      ctx.restore();
    }
    drawSubject(env, paint(env));

    if (active) {
      // Slice displacement — cut three bands and nudge them sideways.
      for (let i = 0; i < 3; i++) {
        const y = (noise(beat * 3 + i) - 0.5) * subject.h;
        const h = subject.h * (0.06 + noise(beat * 5 + i) * 0.1);
        const dx = (noise(beat * 7 + i) - 0.5) * subject.w * 0.12 * amount;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-subject.w, y, subject.w * 2, h);
        ctx.clip();
        ctx.translate(dx, 0);
        drawSubject(env, paint(env));
        ctx.restore();
      }
    }
  },

  orbit(env) {
    const { ctx, subject, amount } = env;
    const angle = env.t * Math.PI * 2;
    const rx = subject.w * 0.62;
    const ry = subject.h * 0.72;
    const dot = subject.h * 0.11;
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    const behind = Math.sin(angle) < 0;

    const drawDot = () => {
      ctx.save();
      ctx.globalAlpha = behind ? 0.45 : 1;
      ctx.shadowColor = rgba(env.cfg.color2, 0.9);
      ctx.shadowBlur = (dot * 2 * amount) / env.scale;
      ctx.fillStyle = env.cfg.color2;
      ctx.beginPath();
      ctx.arc(x, y, dot * (behind ? 0.7 : 1), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    if (behind) drawDot();
    drawSubject(env, paint(env));
    if (!behind) drawDot();
  },

  spin(env) {
    const { ctx } = env;
    // Horizontal squash reads as a turn; the flip keeps the back face legible.
    const c = Math.cos(env.t * Math.PI * 2);
    const squash = Math.max(0.04, Math.abs(c));
    ctx.scale(squash * (c < 0 ? -1 : 1), 1);
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(c);
    drawSubject(env, paint(env));
    ctx.globalAlpha = 1;
  },

  stagger(env) {
    const { ctx, subject, amount } = env;
    const n = subject.parts.length;
    const fill = paint(env);
    // Each part gets its own slice of the first 60% of the loop, then all hold.
    const spread = 0.55;
    for (let i = 0; i < n; i++) {
      const start = (i / n) * spread;
      const local = clamp01((env.t - start) / 0.28);
      const out = clamp01((env.t - 0.78 - (i / n) * 0.12) / 0.18);
      const appear = easeInOut(local) * (1 - easeInOut(out));
      if (appear <= 0.001) continue;
      ctx.save();
      ctx.globalAlpha = appear;
      ctx.translate(0, (1 - appear) * subject.h * 0.45 * amount);
      drawPart(env, subject.parts[i], fill);
      ctx.restore();
    }
  },

  drawOn(env) {
    const { ctx, subject, amount } = env;
    const fill = paint(env);
    // Trace over the first half, then fade the solid fill in over the second.
    const trace = clamp01(env.t / 0.45);
    const fillIn = clamp01((env.t - 0.5) / 0.3) * (1 - clamp01((env.t - 0.9) / 0.1));

    for (const part of subject.parts) {
      if (!part.path) continue;
      ctx.save();
      ctx.translate(-subject.w / 2 - part.x, -subject.h / 2 - part.y);
      if (fillIn > 0.001) {
        ctx.globalAlpha = fillIn;
        ctx.fillStyle = fill;
        ctx.fill(part.path);
        ctx.globalAlpha = 1;
      }
      if (part.length > 0) {
        const drawn = easeInOut(trace) * part.length;
        ctx.setLineDash([drawn, part.length]);
        ctx.lineWidth = Math.max(0.5, (subject.h * 0.012 * (0.5 + amount)) );
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = env.cfg.color2;
        ctx.globalAlpha = 1 - fillIn * 0.65;
        ctx.stroke(part.path);
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  },
};

function drawBackground(ctx: CanvasRenderingContext2D, cfg: LoopConfig, size: number) {
  if (cfg.bgType === "transparent") return;
  if (cfg.bgType === "solid") {
    ctx.fillStyle = cfg.bg1;
    ctx.fillRect(0, 0, size, size);
    return;
  }
  const a = (cfg.bgAngle * Math.PI) / 180;
  const half = size / 2;
  const len = (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))) * half;
  const g = ctx.createLinearGradient(
    half - Math.cos(a) * len,
    half - Math.sin(a) * len,
    half + Math.cos(a) * len,
    half + Math.sin(a) * len
  );
  g.addColorStop(0, cfg.bg1);
  g.addColorStop(1, cfg.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

/**
 * Draws the frame at loop position `t` (0 ≤ t < 1) into a square canvas of
 * `size` pixels. Pure: no timers, no randomness, no external state.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  cfg: LoopConfig,
  subject: Subject | null,
  t: number,
  size: number
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  drawBackground(ctx, cfg, size);
  if (!subject || !subject.parts.length) return;

  const usable = size * (1 - cfg.padding * 2);
  const scale = Math.min(usable / subject.w, usable / subject.h);

  if (cfg.glow > 0) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.55);
    g.addColorStop(0, rgba(cfg.color2, 0.35 * cfg.glow));
    g.addColorStop(1, rgba(cfg.color2, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);

  if (cfg.shadow > 0) {
    ctx.shadowColor = `rgba(0,0,0,${0.45 * cfg.shadow})`;
    ctx.shadowBlur = (size * 0.05 * cfg.shadow) / scale;
    ctx.shadowOffsetY = (size * 0.02 * cfg.shadow) / scale;
  }

  const env: Env = { ctx, cfg, subject, t, size, scale, amount: cfg.amount };
  const render = RENDERERS[cfg.preset] ?? RENDERERS.breathe;
  render(env);
  ctx.restore();
}

/* --------------------------------- export --------------------------------- */

function offscreen(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  return { canvas, ctx };
}

/** Renders the whole loop as raw RGBA frames, ready for the GIF encoder. */
export function renderFrames(cfg: LoopConfig, subject: Subject | null, size = cfg.size): Uint8ClampedArray[] {
  const { ctx } = offscreen(size);
  const count = frameCount(cfg);
  const frames: Uint8ClampedArray[] = [];
  for (let i = 0; i < count; i++) {
    renderFrame(ctx, cfg, subject, i / count, size);
    frames.push(ctx.getImageData(0, 0, size, size).data);
  }
  return frames;
}

export function exportGif(cfg: LoopConfig, subject: Subject | null): Blob {
  const frames = renderFrames(cfg, subject);
  const bytes = encodeGif(frames, {
    width: cfg.size,
    height: cfg.size,
    delayMs: 1000 / cfg.fps,
    transparent: cfg.bgType === "transparent",
  });
  return new Blob([bytes as unknown as BlobPart], { type: "image/gif" });
}

export interface SpriteSheet {
  canvas: HTMLCanvasElement;
  columns: number;
  rows: number;
  css: string;
}

/**
 * Lays every frame out in a grid and writes the `steps()` rule that plays it.
 * A sprite sheet is a real PNG, so it keeps full alpha and none of GIF's 256
 * colour banding — the best-looking loop you can put on a web page.
 */
export function buildSpriteSheet(cfg: LoopConfig, subject: Subject | null, cell = 160): SpriteSheet {
  const count = frameCount(cfg);
  const columns = Math.min(count, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);
  const { canvas, ctx } = offscreen(1);
  canvas.width = columns * cell;
  canvas.height = rows * cell;

  const frame = offscreen(cell);
  for (let i = 0; i < count; i++) {
    renderFrame(frame.ctx, cfg, subject, i / count, cell);
    ctx.drawImage(frame.canvas, (i % columns) * cell, Math.floor(i / columns) * cell);
  }

  const css = `.loop {
  width: ${cell}px;
  height: ${cell}px;
  background-image: url("loop-sprite.png");
  background-size: ${columns * cell}px ${rows * cell}px;
  animation: loop-play ${cfg.duration}s steps(${columns}) infinite${
    rows > 1 ? `, loop-rows ${cfg.duration}s steps(${rows}) infinite` : ""
  };
}

@keyframes loop-play {
  from { background-position-x: 0; }
  to   { background-position-x: -${columns * cell}px; }
}${
    rows > 1
      ? `

@keyframes loop-rows {
  from { background-position-y: 0; }
  to   { background-position-y: -${rows * cell}px; }
}`
      : ""
  }`;

  return { canvas, columns, rows, css };
}

/**
 * CSS keyframes for the presets that are honestly expressible as CSS. The ones
 * that need per-pixel work (shimmer's clipped sweep, glitch, draw-on, stagger)
 * are better served by the sprite sheet, and say so rather than shipping a
 * rough approximation.
 */
export function exportCss(cfg: LoopConfig): string | null {
  const d = `${cfg.duration}s`;
  const a = cfg.amount;
  switch (cfg.preset) {
    case "breathe":
      return `@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(${(1 + 0.16 * a).toFixed(3)}); }
}

.mark { animation: breathe ${d} ease-in-out infinite; }`;
    case "float":
      return `@keyframes float {
  0%, 100% { transform: translateY(0); }
  25%      { transform: translateY(-${(12 * a).toFixed(1)}%); }
  75%      { transform: translateY(${(12 * a).toFixed(1)}%); }
}

.mark { animation: float ${d} ease-in-out infinite; }`;
    case "pulse":
      return `@keyframes pulse {
  0%, 100% { filter: drop-shadow(0 0 0 ${cfg.color2}); }
  50%      { filter: drop-shadow(0 0 ${(24 * a).toFixed(0)}px ${cfg.color2}); }
}

.mark { animation: pulse ${d} ease-in-out infinite; }`;
    case "spin":
      return `@keyframes spin {
  from { transform: perspective(600px) rotateY(0deg); }
  to   { transform: perspective(600px) rotateY(360deg); }
}

.mark { animation: spin ${d} linear infinite; }`;
    case "shimmer":
      // Only honest for text, where background-clip does the masking.
      return `@keyframes shimmer {
  from { background-position: -150% 0; }
  to   { background-position: 250% 0; }
}

.mark {
  background: linear-gradient(100deg, ${cfg.color} 40%, #fff 50%, ${cfg.color} 60%);
  background-size: 250% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: shimmer ${d} linear infinite;
}`;
    default:
      return null;
  }
}

export function loopFilename(cfg: LoopConfig, extension: string): string {
  const stem =
    (cfg.source === "text" ? cfg.text : cfg.preset)
      .trim()
      .toLowerCase()
      .slice(0, 28)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "loop";
  return `${stem}-${cfg.preset}.${extension}`;
}
