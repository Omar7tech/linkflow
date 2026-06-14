import type { CSSProperties } from "react";

export interface ShadowConfig {
  /** Shadow color (hex). */
  color: string;
  /** Light direction in degrees — 0 casts straight down, 90 to the right. */
  angle: number;
  /** Final elevation: how far the deepest layer is offset, in px (0–80). */
  distance: number;
  /** Final blur of the deepest layer, in px (0–120). */
  blur: number;
  /** Spread of every layer, in px (-20–20). */
  spread: number;
  /** Peak opacity of the tightest layer, 0–100 (%). */
  opacity: number;
  /** Number of stacked layers, 1–8. More layers = smoother falloff. */
  layers: number;
  /** Carve the shadow inward instead of casting it out. */
  inset: boolean;
}

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  /** 0–1 alpha. */
  alpha: number;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
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

/**
 * A single flat shadow looks cheap. Real elevation is a *stack* of shadows:
 * the layer nearest the surface is small, tight and dark; each further layer
 * is pushed out, blurred more and faded — so the penumbra falls off smoothly,
 * the way light actually wraps an object. We distribute offset/blur on an
 * ease-in curve (so early layers stay close together) and fade opacity out.
 */
export function buildLayers(config: ShadowConfig): ShadowLayer[] {
  const { angle, distance, blur, spread, opacity, layers } = config;
  const rad = (angle * Math.PI) / 180;
  const dirX = Math.sin(rad);
  const dirY = Math.cos(rad);
  const n = Math.max(1, Math.min(8, Math.round(layers)));
  const peak = opacity / 100;

  return Array.from({ length: n }, (_, i) => {
    // p goes 0 → 1 across the stack; t is its ease-in form for offset & blur.
    const p = n === 1 ? 1 : i / (n - 1);
    const t = p * p;
    // Tightest layer (i = 0) carries the peak alpha; the rest fade toward 15%.
    const alpha = peak * (1 - 0.85 * p);
    return {
      x: Math.round(dirX * distance * t),
      y: Math.round(dirY * distance * t),
      blur: Math.round(blur * t),
      spread,
      alpha: Number(alpha.toFixed(3)),
    };
  });
}

function layerToString(layer: ShadowLayer, color: string, inset: boolean): string {
  const { r, g, b } = hexToRgb(color);
  const parts = [
    `${layer.x}px`,
    `${layer.y}px`,
    `${layer.blur}px`,
    `${layer.spread}px`,
    `rgba(${r}, ${g}, ${b}, ${layer.alpha})`,
  ];
  return `${inset ? "inset " : ""}${parts.join(" ")}`;
}

export function toValue(config: ShadowConfig): string {
  return buildLayers(config)
    .map((l) => layerToString(l, config.color, config.inset))
    .join(", ");
}

export function toStyle(config: ShadowConfig): CSSProperties {
  return { boxShadow: toValue(config) };
}

export function toCss(config: ShadowConfig, className = "elevation"): string {
  const layers = buildLayers(config);
  const indented = layers
    .map((l, i) => {
      const str = layerToString(l, config.color, config.inset);
      return `    ${str}${i < layers.length - 1 ? "," : ";"}`;
    })
    .join("\n");
  return [`.${className} {`, `  box-shadow:`, indented, `}`].join("\n");
}

export function toTailwind(config: ShadowConfig): string {
  const value = toValue(config).replace(/\s+/g, "_");
  return `shadow-[${value}]`;
}

export interface ShadowPreset {
  id: string;
  name: string;
  config: ShadowConfig;
}

const base = { angle: 0, spread: 0, inset: false };

export const SHADOW_PRESETS: ShadowPreset[] = [
  {
    id: "soft",
    name: "Soft",
    config: { ...base, color: "#0f172a", distance: 18, blur: 30, opacity: 14, layers: 5 },
  },
  {
    id: "crisp",
    name: "Crisp",
    config: { ...base, color: "#0f172a", distance: 8, blur: 12, opacity: 22, layers: 4 },
  },
  {
    id: "floating",
    name: "Floating",
    config: { ...base, color: "#0f172a", distance: 40, blur: 64, opacity: 18, layers: 6 },
  },
  {
    id: "dramatic",
    name: "Dramatic",
    config: { ...base, color: "#020617", distance: 60, blur: 90, opacity: 30, layers: 7 },
  },
  {
    id: "hard",
    name: "Hard",
    config: { ...base, color: "#0f172a", distance: 14, blur: 0, opacity: 18, layers: 1 },
  },
  {
    id: "long",
    name: "Long",
    config: { ...base, angle: 135, color: "#0f172a", distance: 70, blur: 40, opacity: 16, layers: 8 },
  },
  {
    id: "emerald",
    name: "Emerald Glow",
    config: { ...base, color: "#10b981", distance: 24, blur: 48, opacity: 36, layers: 6 },
  },
  {
    id: "pressed",
    name: "Pressed",
    config: { ...base, color: "#0f172a", distance: 10, blur: 18, spread: -2, opacity: 22, layers: 4, inset: true },
  },
];

export interface ShadowSurface {
  id: string;
  name: string;
  /** Stage background. */
  bg: string;
  /** Card face color. */
  card: string;
  /** Whether the card text reads light or dark. */
  fg: "light" | "dark";
}

export const SHADOW_SURFACES: ShadowSurface[] = [
  { id: "paper", name: "Paper", bg: "#f1f5f9", card: "#ffffff", fg: "dark" },
  { id: "warm", name: "Warm", bg: "#faf5ef", card: "#fffdf9", fg: "dark" },
  { id: "slate", name: "Slate", bg: "#1e293b", card: "#334155", fg: "light" },
  { id: "ink", name: "Ink", bg: "#020617", card: "#0f172a", fg: "light" },
  { id: "mint", name: "Mint", bg: "#ecfdf5", card: "#ffffff", fg: "dark" },
];
