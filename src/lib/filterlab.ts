import type { CSSProperties } from "react";

export interface FilterConfig {
  /** Gaussian blur in px (0–20). */
  blur: number;
  /** Brightness, percent (0–200, 100 = unchanged). */
  brightness: number;
  /** Contrast, percent (0–200). */
  contrast: number;
  /** Saturation, percent (0–300). */
  saturate: number;
  /** Grayscale, percent (0–100). */
  grayscale: number;
  /** Sepia, percent (0–100). */
  sepia: number;
  /** Hue rotation in degrees (0–360). */
  hue: number;
  /** Color inversion, percent (0–100). */
  invert: number;
  /** Opacity, percent (0–100). */
  opacity: number;
  /** Drop-shadow toggle + look. */
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
}

const DEFAULTS: FilterConfig = {
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  sepia: 0,
  hue: 0,
  invert: 0,
  opacity: 100,
  shadow: false,
  shadowColor: "#000000",
  shadowBlur: 16,
};

/** The CSS `filter` value, omitting every channel left at its neutral default. */
export function toFilter(config: FilterConfig): string {
  const parts: string[] = [];
  if (config.blur > 0) parts.push(`blur(${config.blur}px)`);
  if (config.brightness !== 100) parts.push(`brightness(${config.brightness}%)`);
  if (config.contrast !== 100) parts.push(`contrast(${config.contrast}%)`);
  if (config.saturate !== 100) parts.push(`saturate(${config.saturate}%)`);
  if (config.grayscale > 0) parts.push(`grayscale(${config.grayscale}%)`);
  if (config.sepia > 0) parts.push(`sepia(${config.sepia}%)`);
  if (config.hue !== 0) parts.push(`hue-rotate(${config.hue}deg)`);
  if (config.invert > 0) parts.push(`invert(${config.invert}%)`);
  if (config.opacity !== 100) parts.push(`opacity(${config.opacity}%)`);
  if (config.shadow) parts.push(`drop-shadow(0 8px ${config.shadowBlur}px ${config.shadowColor})`);
  return parts.join(" ") || "none";
}

export function toStyle(config: FilterConfig): CSSProperties {
  const filter = toFilter(config);
  return { filter, WebkitFilter: filter };
}

export function toCss(config: FilterConfig, className = "filtered"): string {
  return [`.${className} {`, `  filter: ${toFilter(config)};`, `}`].join("\n");
}

const pct = (n: number) => `${Math.round((n / 100) * 1000) / 1000}`;

export function toTailwind(config: FilterConfig): string {
  const c: string[] = [];
  if (config.blur > 0) c.push(`blur-[${config.blur}px]`);
  if (config.brightness !== 100) c.push(`brightness-[${pct(config.brightness)}]`);
  if (config.contrast !== 100) c.push(`contrast-[${pct(config.contrast)}]`);
  if (config.saturate !== 100) c.push(`saturate-[${pct(config.saturate)}]`);
  if (config.grayscale > 0) c.push(`grayscale-[${pct(config.grayscale)}]`);
  if (config.sepia > 0) c.push(`sepia-[${pct(config.sepia)}]`);
  if (config.hue !== 0) c.push(`hue-rotate-[${config.hue}deg]`);
  if (config.invert > 0) c.push(`invert-[${pct(config.invert)}]`);
  if (config.opacity !== 100) c.push(`opacity-[${pct(config.opacity)}]`);
  if (config.shadow)
    c.push(`drop-shadow-[0_8px_${config.shadowBlur}px_${config.shadowColor}]`);
  return c.length ? c.join(" ") : "filter-none";
}

export function defaults(): FilterConfig {
  return { ...DEFAULTS };
}

export interface FilterPreset {
  id: string;
  name: string;
  config: FilterConfig;
}

const b = DEFAULTS;

export const FILTER_PRESETS: FilterPreset[] = [
  { id: "original", name: "Original", config: { ...b } },
  { id: "vivid", name: "Vivid", config: { ...b, saturate: 160, contrast: 115, brightness: 105 } },
  { id: "noir", name: "Noir", config: { ...b, grayscale: 100, contrast: 135, brightness: 95 } },
  { id: "vintage", name: "Vintage", config: { ...b, sepia: 55, saturate: 120, contrast: 95, brightness: 105 } },
  { id: "cool", name: "Cool", config: { ...b, hue: 200, saturate: 120, brightness: 102 } },
  { id: "warm", name: "Warm", config: { ...b, sepia: 25, saturate: 130, hue: 340, brightness: 104 } },
  { id: "dramatic", name: "Dramatic", config: { ...b, contrast: 150, brightness: 92, saturate: 120 } },
  { id: "faded", name: "Faded", config: { ...b, saturate: 75, contrast: 88, brightness: 110, sepia: 12 } },
  { id: "mono", name: "Mono", config: { ...b, grayscale: 100, contrast: 105 } },
  { id: "dreamy", name: "Dreamy", config: { ...b, blur: 1, saturate: 140, brightness: 110, contrast: 95 } },
  { id: "invert", name: "Invert", config: { ...b, invert: 100 } },
  { id: "infrared", name: "Infrared", config: { ...b, hue: 130, saturate: 200, contrast: 120 } },
];

export interface FilterScene {
  id: string;
  name: string;
  /** A built-in colorful subject so filters read without an upload. */
  background: string;
}

export const FILTER_SCENES: FilterScene[] = [
  {
    id: "spectrum",
    name: "Spectrum",
    background:
      "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)",
  },
  {
    id: "sunset",
    name: "Sunset",
    background:
      "radial-gradient(at 20% 80%, #f97316 0, transparent 55%), radial-gradient(at 80% 20%, #e11d48 0, transparent 55%), linear-gradient(160deg, #fbbf24, #7c3aed)",
  },
  {
    id: "lagoon",
    name: "Lagoon",
    background:
      "radial-gradient(at 70% 30%, #22d3ee 0, transparent 50%), radial-gradient(at 30% 70%, #10b981 0, transparent 55%), linear-gradient(200deg, #0ea5e9, #1e3a8a)",
  },
  {
    id: "blocks",
    name: "Color Blocks",
    background:
      "repeating-linear-gradient(45deg, #f43f5e 0 50px, #fb923c 50px 100px, #facc15 100px 150px, #4ade80 150px 200px, #38bdf8 200px 250px, #a78bfa 250px 300px)",
  },
];
