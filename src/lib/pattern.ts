import type { CSSProperties } from "react";

export type PatternType =
  | "dots"
  | "grid"
  | "lines"
  | "diagonal"
  | "checks"
  | "crosshatch"
  | "triangles"
  | "zigzag";

export interface PatternConfig {
  type: PatternType;
  /** Foreground (ink) color — hex. */
  fg: string;
  /** Background color — hex (gradient start when gradient is on). */
  bg: string;
  /** Tile size in px (8–120). */
  size: number;
  /** Dot radius / line thickness in px (1–20). */
  weight: number;
  /** Rotation for striped patterns, in degrees (0–180). */
  angle: number;
  /** Foreground opacity, 0–100 (%). */
  opacity: number;
  /** Use a two-color gradient behind the pattern instead of a flat fill. */
  gradient: boolean;
  /** Gradient end color — hex. */
  bg2: string;
  /** Gradient angle in degrees (0–360). */
  bgAngle: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : value;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgba(hex: string, alphaPct: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${(alphaPct / 100).toFixed(2)})`;
}

interface Layer {
  image: string;
  /** background-size for this layer; "auto" when the gradient self-tiles. */
  size: string;
}

/**
 * Every pattern is built from gradients alone — no images, no SVG — so it
 * stays razor-sharp at any zoom and weighs nothing. Each layer carries its
 * own background-size, so layers (and the optional gradient backdrop) compose
 * cleanly without the single-background-size trap.
 */
function patternLayers(config: PatternConfig): Layer[] {
  const fg = rgba(config.fg, config.opacity);
  const s = config.size;
  const w = config.weight;
  const tile = `${s}px ${s}px`;

  switch (config.type) {
    case "dots":
      return [
        { image: `radial-gradient(${fg} ${w}px, transparent ${w + 1}px)`, size: tile },
      ];
    case "grid":
      return [
        { image: `linear-gradient(${fg} ${w}px, transparent ${w}px)`, size: tile },
        { image: `linear-gradient(90deg, ${fg} ${w}px, transparent ${w}px)`, size: tile },
      ];
    case "lines":
      return [
        { image: `repeating-linear-gradient(${config.angle}deg, ${fg} 0 ${w}px, transparent ${w}px ${s}px)`, size: "auto" },
      ];
    case "diagonal":
      return [
        { image: `repeating-linear-gradient(45deg, ${fg} 0 ${w}px, transparent ${w}px ${s}px)`, size: "auto" },
      ];
    case "crosshatch":
      return [
        { image: `repeating-linear-gradient(45deg, ${fg} 0 ${w}px, transparent ${w}px ${s}px)`, size: "auto" },
        { image: `repeating-linear-gradient(-45deg, ${fg} 0 ${w}px, transparent ${w}px ${s}px)`, size: "auto" },
      ];
    case "checks":
      return [
        { image: `conic-gradient(${fg} 0 25%, transparent 0 50%, ${fg} 0 75%, transparent 0)`, size: tile },
      ];
    case "triangles":
      return [
        { image: `linear-gradient(45deg, ${fg} 25%, transparent 25%)`, size: tile },
        { image: `linear-gradient(-45deg, ${fg} 25%, transparent 25%)`, size: tile },
      ];
    case "zigzag":
      return [
        { image: `linear-gradient(135deg, ${fg} 25%, transparent 25%)`, size: tile },
        { image: `linear-gradient(225deg, ${fg} 25%, transparent 25%)`, size: tile },
        { image: `linear-gradient(315deg, ${fg} 25%, transparent 25%)`, size: tile },
        { image: `linear-gradient(45deg, ${fg} 25%, transparent 25%)`, size: tile },
      ];
  }
}

function gradientLayer(config: PatternConfig): Layer {
  return {
    image: `linear-gradient(${config.bgAngle}deg, ${config.bg}, ${config.bg2})`,
    size: "100% 100%",
  };
}

function assemble(config: PatternConfig): Layer[] {
  const layers = patternLayers(config);
  return config.gradient ? [...layers, gradientLayer(config)] : layers;
}

export function toStyle(config: PatternConfig): CSSProperties {
  const layers = assemble(config);
  return {
    backgroundColor: config.bg,
    backgroundImage: layers.map((l) => l.image).join(", "),
    backgroundSize: layers.map((l) => l.size).join(", "),
  };
}

export function toCss(config: PatternConfig, className = "pattern"): string {
  const layers = assemble(config);
  const img = layers
    .map((l, i) => `    ${l.image}${i < layers.length - 1 ? "," : ";"}`)
    .join("\n");
  return [
    `.${className} {`,
    `  background-color: ${config.bg};`,
    `  background-image:`,
    img,
    `  background-size: ${layers.map((l) => l.size).join(", ")};`,
    `}`,
  ].join("\n");
}

export function toTailwind(config: PatternConfig): string {
  const layers = assemble(config);
  const image = layers.map((l) => l.image).join(", ").replace(/\s+/g, "_");
  const size = layers.map((l) => l.size).join(", ").replace(/\s+/g, "_");
  return `bg-[${config.bg}] bg-[image:${image}] bg-[length:${size}]`;
}

/* ------------------------------------------------------------------ *
 * Canvas raster — used for PNG export (transparent or filled). Drawn
 * with plain 2D geometry, so the canvas never taints and a transparent
 * background "just works". Geometry mirrors the CSS patterns above.
 * ------------------------------------------------------------------ */

function drawStripes(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: number,
  w: number,
  angle: number,
) {
  const diag = Math.hypot(W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((angle * Math.PI) / 180);
  for (let y = -diag; y < diag; y += s) {
    ctx.fillRect(-diag, y, diag * 2, w);
  }
  ctx.restore();
}

export function drawPattern(
  ctx: CanvasRenderingContext2D,
  config: PatternConfig,
  W: number,
  H: number,
  transparent: boolean,
) {
  ctx.clearRect(0, 0, W, H);
  if (!transparent) {
    if (config.gradient) {
      const rad = (config.bgAngle * Math.PI) / 180;
      const x = Math.cos(rad - Math.PI / 2);
      const y = Math.sin(rad - Math.PI / 2);
      const g = ctx.createLinearGradient(
        W / 2 - (x * W) / 2, H / 2 - (y * H) / 2,
        W / 2 + (x * W) / 2, H / 2 + (y * H) / 2,
      );
      g.addColorStop(0, config.bg);
      g.addColorStop(1, config.bg2);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = config.bg;
    }
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = rgba(config.fg, config.opacity);
  const s = config.size;
  const w = config.weight;

  switch (config.type) {
    case "dots":
      for (let y = s / 2; y < H + s; y += s)
        for (let x = s / 2; x < W + s; x += s) {
          ctx.beginPath();
          ctx.arc(x, y, w, 0, Math.PI * 2);
          ctx.fill();
        }
      break;
    case "grid":
      for (let x = 0; x < W; x += s) ctx.fillRect(x, 0, w, H);
      for (let y = 0; y < H; y += s) ctx.fillRect(0, y, W, w);
      break;
    case "lines":
      drawStripes(ctx, W, H, s, w, config.angle);
      break;
    case "diagonal":
      drawStripes(ctx, W, H, s, w, 45);
      break;
    case "crosshatch":
      drawStripes(ctx, W, H, s, w, 45);
      drawStripes(ctx, W, H, s, w, -45);
      break;
    case "checks": {
      const c = s / 2;
      for (let j = 0; j * c < H; j++)
        for (let i = 0; i * c < W; i++)
          if ((i + j) % 2 === 0) ctx.fillRect(i * c, j * c, c, c);
      break;
    }
    case "triangles":
      for (let y = 0; y < H; y += s)
        for (let x = 0; x < W; x += s) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + s, y);
          ctx.lineTo(x, y + s);
          ctx.closePath();
          ctx.fill();
        }
      break;
    case "zigzag":
      ctx.strokeStyle = rgba(config.fg, config.opacity);
      ctx.lineWidth = w;
      for (let y = 0; y < H + s; y += s) {
        ctx.beginPath();
        let up = false;
        for (let x = 0; x <= W + s; x += s / 2) {
          ctx.lineTo(x, up ? y : y + s / 2);
          up = !up;
        }
        ctx.stroke();
      }
      break;
  }
}

export function renderPng(
  config: PatternConfig,
  transparent: boolean,
  W = 1600,
  H = 1000,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("no canvas"));
    drawPattern(ctx, config, W, H, transparent);
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no blob"))), "image/png");
  });
}

export interface PatternMeta {
  type: PatternType;
  name: string;
  /** Which controls are meaningful for this pattern. */
  uses: { weight: boolean; angle: boolean };
}

export const PATTERNS: PatternMeta[] = [
  { type: "dots", name: "Dots", uses: { weight: true, angle: false } },
  { type: "grid", name: "Grid", uses: { weight: true, angle: false } },
  { type: "lines", name: "Lines", uses: { weight: true, angle: true } },
  { type: "diagonal", name: "Diagonal", uses: { weight: true, angle: false } },
  { type: "crosshatch", name: "Crosshatch", uses: { weight: true, angle: false } },
  { type: "checks", name: "Checks", uses: { weight: false, angle: false } },
  { type: "triangles", name: "Triangles", uses: { weight: false, angle: false } },
  { type: "zigzag", name: "Zigzag", uses: { weight: true, angle: false } },
];

export interface PatternPreset {
  id: string;
  name: string;
  config: PatternConfig;
}

const base = { angle: 0, opacity: 100, gradient: false, bg2: "#0ea5e9", bgAngle: 135 };

export const PATTERN_PRESETS: PatternPreset[] = [
  { id: "blueprint", name: "Blueprint", config: { ...base, type: "grid", fg: "#bae6fd", bg: "#0c4a6e", size: 24, weight: 1, opacity: 40 } },
  { id: "polka", name: "Polka", config: { ...base, type: "dots", fg: "#10b981", bg: "#022c22", size: 28, weight: 3, opacity: 90 } },
  { id: "graph", name: "Graph", config: { ...base, type: "grid", fg: "#94a3b8", bg: "#f8fafc", size: 20, weight: 1, opacity: 35 } },
  { id: "barber", name: "Barber", config: { ...base, type: "lines", fg: "#e11d48", bg: "#fff1f2", size: 28, weight: 12, angle: 45, opacity: 90 } },
  { id: "carbon", name: "Carbon", config: { ...base, type: "crosshatch", fg: "#1e293b", bg: "#0f172a", size: 16, weight: 2, opacity: 80 } },
  { id: "checker", name: "Checker", config: { ...base, type: "checks", fg: "#0f172a", bg: "#e2e8f0", size: 48, weight: 1, opacity: 100 } },
  { id: "mint", name: "Mint Dots", config: { ...base, type: "dots", fg: "#34d399", bg: "#ecfdf5", size: 22, weight: 2, opacity: 80 } },
  { id: "aurora-dots", name: "Aurora", config: { ...base, type: "dots", fg: "#f0abfc", bg: "#4c1d95", size: 26, weight: 2, opacity: 60, gradient: true, bg2: "#0ea5e9", bgAngle: 135 } },
  { id: "sunset-grid", name: "Sunset Grid", config: { ...base, type: "grid", fg: "#ffffff", bg: "#f97316", size: 32, weight: 1, opacity: 25, gradient: true, bg2: "#db2777", bgAngle: 120 } },
  { id: "emerald-hatch", name: "Emerald Hatch", config: { ...base, type: "crosshatch", fg: "#a7f3d0", bg: "#022c22", size: 14, weight: 1, opacity: 50, gradient: true, bg2: "#0f766e", bgAngle: 160 } },
  { id: "candy-zig", name: "Candy Zigzag", config: { ...base, type: "zigzag", fg: "#ffffff", bg: "#f472b6", size: 28, weight: 4, opacity: 70, gradient: true, bg2: "#a78bfa", bgAngle: 110 } },
  { id: "tri-ocean", name: "Ocean Tri", config: { ...base, type: "triangles", fg: "#bae6fd", bg: "#0c4a6e", size: 40, weight: 1, opacity: 30, gradient: true, bg2: "#1e3a8a", bgAngle: 145 } },
  { id: "neon-lines", name: "Neon Lines", config: { ...base, type: "lines", fg: "#22d3ee", bg: "#020617", size: 18, weight: 2, angle: 90, opacity: 80 } },
  { id: "noir", name: "Noir", config: { ...base, type: "diagonal", fg: "#1f2937", bg: "#030712", size: 12, weight: 6, opacity: 100 } },
  { id: "paper", name: "Paper", config: { ...base, type: "lines", fg: "#cbd5e1", bg: "#ffffff", size: 28, weight: 1, angle: 0, opacity: 60 } },
  { id: "violet-checks", name: "Violet Checks", config: { ...base, type: "checks", fg: "#7c3aed", bg: "#ede9fe", size: 36, weight: 1, opacity: 30 } },
];

const RANDOM_PALETTES: [string, string, string][] = [
  ["#10b981", "#022c22", "#0f766e"],
  ["#f0abfc", "#4c1d95", "#0ea5e9"],
  ["#22d3ee", "#020617", "#1e3a8a"],
  ["#f472b6", "#3b0764", "#a78bfa"],
  ["#fbbf24", "#7c2d12", "#dc2626"],
  ["#bae6fd", "#0c4a6e", "#1e3a8a"],
  ["#a7f3d0", "#064e3b", "#10b981"],
];
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const pick = <T,>(arr: T[]): T => arr[rand(0, arr.length - 1)];

/** A fresh random pattern — type, palette, scale and (sometimes) a gradient. */
export function randomPattern(prev: PatternConfig): PatternConfig {
  const [fg, bg, bg2] = pick(RANDOM_PALETTES);
  const type = pick(PATTERNS).type;
  const gradient = Math.random() < 0.5;
  return {
    ...prev,
    type,
    fg,
    bg,
    bg2,
    gradient,
    bgAngle: rand(0, 360),
    size: rand(16, 56),
    weight: rand(1, 6),
    angle: rand(0, 180),
    opacity: rand(40, 100),
  };
}
