import type { CSSProperties } from "react";

export interface MeshPoint {
  id: string;
  /** Horizontal position, 0–100 (% of the stage). */
  x: number;
  /** Vertical position, 0–100 (%). */
  y: number;
  /** Blob color (hex). */
  color: string;
}

export interface MeshConfig {
  /** Base fill behind every blob (hex). */
  base: string;
  /** Reach of each blob as a % of the canvas — bigger = softer blend. */
  spread: number;
  /** Color points painted on top of the base. */
  points: MeshPoint[];
  /** Whisper of film grain baked over the blend. */
  grain: boolean;
}

/** Tiling fractal-noise SVG with alpha baked in — the classic grain trick. */
const GRAIN_LAYER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='linear' slope='0.06'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

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

/** One blob: a radial gradient that fades to a transparent version of itself. */
function blob(point: MeshPoint, spread: number): string {
  const { r, g, b } = hexToRgb(point.color);
  return `radial-gradient(circle at ${point.x}% ${point.y}%, rgba(${r}, ${g}, ${b}, 0.9) 0px, rgba(${r}, ${g}, ${b}, 0) ${spread}%)`;
}

function backgroundImage(config: MeshConfig): string {
  const blobs = config.points.map((p) => blob(p, config.spread));
  return config.grain ? [GRAIN_LAYER, ...blobs].join(", ") : blobs.join(", ");
}

export function toStyle(config: MeshConfig): CSSProperties {
  return {
    backgroundColor: config.base,
    backgroundImage: backgroundImage(config),
  };
}

export function toCss(config: MeshConfig, className = "mesh"): string {
  const blobs = config.points.map((p) => blob(p, config.spread));
  const layers = config.grain ? [GRAIN_LAYER, ...blobs] : blobs;
  const indented = layers
    .map((l, i) => `    ${l}${i < layers.length - 1 ? "," : ";"}`)
    .join("\n");
  return [
    `.${className} {`,
    `  background-color: ${config.base};`,
    `  background-image:`,
    indented,
    `}`,
  ].join("\n");
}

/** A standalone SVG with the same blobs — drop into Figma or an <img>. */
export function toSvg(config: MeshConfig, width = 1200, height = 800): string {
  const defs = config.points
    .map((p, i) => {
      const { r, g, b } = hexToRgb(p.color);
      return [
        `    <radialGradient id="m${i}" cx="${p.x}%" cy="${p.y}%" r="${config.spread}%">`,
        `      <stop offset="0%" stop-color="rgb(${r},${g},${b})" stop-opacity="0.9"/>`,
        `      <stop offset="100%" stop-color="rgb(${r},${g},${b})" stop-opacity="0"/>`,
        `    </radialGradient>`,
      ].join("\n");
    })
    .join("\n");
  const rects = config.points
    .map((_, i) => `  <rect width="100%" height="100%" fill="url(#m${i})"/>`)
    .join("\n");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <defs>`,
    defs,
    `  </defs>`,
    `  <rect width="100%" height="100%" fill="${config.base}"/>`,
    rects,
    `</svg>`,
  ].join("\n");
}

let counter = 0;
export function makePoint(x: number, y: number, color: string): MeshPoint {
  counter += 1;
  return { id: `p${Date.now()}-${counter}`, x, y, color };
}

export interface MeshPreset {
  id: string;
  name: string;
  base: string;
  /** [x, y, color] tuples. */
  stops: [number, number, string][];
}

export const MESH_PRESETS: MeshPreset[] = [
  {
    id: "aurora",
    name: "Aurora",
    base: "#0f172a",
    stops: [
      [18, 22, "#7c3aed"],
      [82, 14, "#06b6d4"],
      [70, 84, "#ec4899"],
      [25, 78, "#22d3ee"],
    ],
  },
  {
    id: "emerald",
    name: "Emerald",
    base: "#022c22",
    stops: [
      [20, 25, "#10b981"],
      [80, 20, "#34d399"],
      [65, 80, "#0ea5e9"],
      [25, 75, "#a7f3d0"],
    ],
  },
  {
    id: "sunset",
    name: "Sunset",
    base: "#3b0764",
    stops: [
      [15, 80, "#f97316"],
      [85, 25, "#e11d48"],
      [55, 55, "#fbbf24"],
      [30, 20, "#db2777"],
    ],
  },
  {
    id: "candy",
    name: "Candy",
    base: "#fdf2f8",
    stops: [
      [20, 30, "#fda4af"],
      [80, 75, "#c4b5fd"],
      [70, 20, "#7dd3fc"],
      [30, 80, "#fcd34d"],
    ],
  },
  {
    id: "ocean",
    name: "Ocean",
    base: "#082f49",
    stops: [
      [25, 20, "#22d3ee"],
      [78, 30, "#3b82f6"],
      [60, 82, "#0ea5e9"],
      [20, 75, "#5eead4"],
    ],
  },
  {
    id: "mono",
    name: "Graphite",
    base: "#111827",
    stops: [
      [22, 24, "#475569"],
      [80, 30, "#64748b"],
      [60, 80, "#1e293b"],
      [30, 70, "#94a3b8"],
    ],
  },
];

export function presetToConfig(preset: MeshPreset, spread = 55, grain = false): MeshConfig {
  return {
    base: preset.base,
    spread,
    grain,
    points: preset.stops.map(([x, y, color]) => makePoint(x, y, color)),
  };
}

/** Curated swatches for shuffling — vivid but harmonious. */
const SHUFFLE_COLORS = [
  "#7c3aed", "#06b6d4", "#ec4899", "#22d3ee", "#10b981", "#34d399",
  "#f97316", "#e11d48", "#fbbf24", "#db2777", "#3b82f6", "#0ea5e9",
  "#a78bfa", "#f472b6", "#5eead4", "#818cf8", "#fb7185", "#facc15",
];

export function shuffleColors(points: MeshPoint[]): MeshPoint[] {
  const pool = [...SHUFFLE_COLORS].sort(() => Math.random() - 0.5);
  return points.map((p, i) => ({ ...p, color: pool[i % pool.length] }));
}
