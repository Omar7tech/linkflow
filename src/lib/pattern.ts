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
  /** Background color — hex. */
  bg: string;
  /** Tile size in px (8–120). */
  size: number;
  /** Dot radius / line thickness in px (1–20). */
  weight: number;
  /** Rotation for striped patterns, in degrees (0–180). */
  angle: number;
  /** Foreground opacity, 0–100 (%). */
  opacity: number;
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

function ink(config: PatternConfig): string {
  const { r, g, b } = hexToRgb(config.fg);
  return `rgba(${r}, ${g}, ${b}, ${(config.opacity / 100).toFixed(2)})`;
}

export interface PatternCss {
  /** background-image value. */
  image: string;
  /** background-size value, or null when the pattern doesn't tile by size. */
  size: string | null;
  /** background-position value, or null. */
  position: string | null;
}

/**
 * Every pattern is built from gradients alone — no images, no SVG — so it
 * stays razor-sharp at any zoom and weighs nothing. Each branch returns the
 * background-image plus the tiling values that make it repeat.
 */
export function build(config: PatternConfig): PatternCss {
  const fg = ink(config);
  const s = config.size;
  const w = config.weight;

  switch (config.type) {
    case "dots":
      return {
        image: `radial-gradient(${fg} ${w}px, transparent ${w + 1}px)`,
        size: `${s}px ${s}px`,
        position: null,
      };
    case "grid":
      return {
        image: `linear-gradient(${fg} ${w}px, transparent ${w}px), linear-gradient(90deg, ${fg} ${w}px, transparent ${w}px)`,
        size: `${s}px ${s}px`,
        position: null,
      };
    case "lines":
      return {
        image: `repeating-linear-gradient(${config.angle}deg, ${fg} 0 ${w}px, transparent ${w}px ${s}px)`,
        size: null,
        position: null,
      };
    case "diagonal":
      return {
        image: `repeating-linear-gradient(45deg, ${fg} 0 ${w}px, transparent ${w}px ${s}px)`,
        size: null,
        position: null,
      };
    case "crosshatch":
      return {
        image: `repeating-linear-gradient(45deg, ${fg} 0 ${w}px, transparent ${w}px ${s}px), repeating-linear-gradient(-45deg, ${fg} 0 ${w}px, transparent ${w}px ${s}px)`,
        size: null,
        position: null,
      };
    case "checks":
      return {
        image: `conic-gradient(${fg} 0 25%, transparent 0 50%, ${fg} 0 75%, transparent 0)`,
        size: `${s}px ${s}px`,
        position: null,
      };
    case "triangles":
      return {
        image: `linear-gradient(45deg, ${fg} 25%, transparent 25%), linear-gradient(-45deg, ${fg} 25%, transparent 25%)`,
        size: `${s}px ${s}px`,
        position: null,
      };
    case "zigzag":
      return {
        image: `linear-gradient(135deg, ${fg} 25%, transparent 25%) 0 0, linear-gradient(225deg, ${fg} 25%, transparent 25%) 0 0, linear-gradient(315deg, ${fg} 25%, transparent 25%) 0 0, linear-gradient(45deg, ${fg} 25%, transparent 25%) 0 0`,
        size: `${s}px ${s}px`,
        position: null,
      };
  }
}

export function toStyle(config: PatternConfig): CSSProperties {
  const css = build(config);
  return {
    backgroundColor: config.bg,
    backgroundImage: css.image,
    ...(css.size ? { backgroundSize: css.size } : {}),
    ...(css.position ? { backgroundPosition: css.position } : {}),
  };
}

export function toCss(config: PatternConfig, className = "pattern"): string {
  const css = build(config);
  const lines = [
    `.${className} {`,
    `  background-color: ${config.bg};`,
    `  background-image: ${css.image};`,
  ];
  if (css.size) lines.push(`  background-size: ${css.size};`);
  if (css.position) lines.push(`  background-position: ${css.position};`);
  lines.push(`}`);
  return lines.join("\n");
}

export function toTailwind(config: PatternConfig): string {
  const css = build(config);
  const classes = [
    `bg-[${config.bg}]`,
    `bg-[image:${css.image.replace(/\s+/g, "_")}]`,
  ];
  if (css.size) classes.push(`bg-[length:${css.size.replace(/\s+/g, "_")}]`);
  if (css.position) classes.push(`bg-[position:${css.position.replace(/\s+/g, "_")}]`);
  return classes.join(" ");
}

/** Standalone SVG snapshot — a single tile, set to repeat via pattern fill. */
export function toSvg(config: PatternConfig, width = 1200, height = 800): string {
  // Rasterizing arbitrary CSS gradients to SVG is lossy; instead we embed the
  // live CSS in a <foreignObject> so the export matches the preview exactly.
  const style = toCss(config, "p")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <foreignObject width="100%" height="100%">`,
    `    <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%">`,
    `      <style>${style}</style>`,
    `      <div class="p" style="width:100%;height:100%"></div>`,
    `    </div>`,
    `  </foreignObject>`,
    `</svg>`,
  ].join("\n");
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
  { type: "zigzag", name: "Zigzag", uses: { weight: false, angle: false } },
];

export interface PatternPreset {
  id: string;
  name: string;
  config: PatternConfig;
}

const base = { angle: 0, opacity: 100 };

export const PATTERN_PRESETS: PatternPreset[] = [
  {
    id: "blueprint",
    name: "Blueprint",
    config: { ...base, type: "grid", fg: "#bae6fd", bg: "#0c4a6e", size: 24, weight: 1, opacity: 40 },
  },
  {
    id: "polka",
    name: "Polka",
    config: { ...base, type: "dots", fg: "#10b981", bg: "#022c22", size: 28, weight: 3, opacity: 90 },
  },
  {
    id: "graph",
    name: "Graph",
    config: { ...base, type: "grid", fg: "#94a3b8", bg: "#f8fafc", size: 20, weight: 1, opacity: 35 },
  },
  {
    id: "barber",
    name: "Barber",
    config: { ...base, type: "lines", fg: "#e11d48", bg: "#fff1f2", size: 28, weight: 12, angle: 45, opacity: 90 },
  },
  {
    id: "carbon",
    name: "Carbon",
    config: { ...base, type: "crosshatch", fg: "#1e293b", bg: "#0f172a", size: 16, weight: 2, opacity: 80 },
  },
  {
    id: "checker",
    name: "Checker",
    config: { ...base, type: "checks", fg: "#0f172a", bg: "#e2e8f0", size: 48, weight: 1, opacity: 100 },
  },
  {
    id: "mint-dots",
    name: "Mint",
    config: { ...base, type: "dots", fg: "#34d399", bg: "#ecfdf5", size: 22, weight: 2, opacity: 80 },
  },
];
