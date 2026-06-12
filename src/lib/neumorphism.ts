import { rgbToHex, rgbToHsl, type RGB } from "./colorExtract";
import { hexToHsl, hslToRgb } from "./palette";

export type NeuShape = "flat" | "concave" | "convex" | "pressed";
export type LightCorner = "tl" | "tr" | "br" | "bl";

export interface NeuConfig {
  /** Base color — element AND page background share it; that's the whole trick. */
  color: string;
  /** Element size in px (preview + radius ceiling). */
  size: number;
  /** Corner radius in px. */
  radius: number;
  /** Shadow offset in px. */
  distance: number;
  /** How far the shadows depart from the base color, 0–100. */
  intensity: number;
  /** Shadow blur in px. */
  blur: number;
  shape: NeuShape;
  light: LightCorner;
}

/** Shift a color's lightness, keeping hue/saturation — soft-UI shadow colors. */
function shifted(hex: string, delta: number): string {
  const { h, s, l } = hexToHsl(hex);
  return rgbToHex(hslToRgb(h, s, Math.min(Math.max(l + delta, 0), 100)));
}

export function shadowColors({ color, intensity }: NeuConfig): { light: string; dark: string } {
  // intensity 0–100 → lightness shift up to ±30.
  const delta = (intensity / 100) * 30;
  return { light: shifted(color, delta), dark: shifted(color, -delta) };
}

const CORNER_SIGNS: Record<LightCorner, { x: number; y: number }> = {
  tl: { x: 1, y: 1 },
  tr: { x: -1, y: 1 },
  br: { x: -1, y: -1 },
  bl: { x: 1, y: -1 },
};

/** Gradient angle pointing away from the light source. */
const CORNER_ANGLES: Record<LightCorner, number> = { tl: 145, tr: 215, br: 325, bl: 35 };

export function neuBoxShadow(config: NeuConfig): string {
  const { light, dark } = shadowColors(config);
  const { x, y } = CORNER_SIGNS[config.light];
  const d = config.distance;
  const inset = config.shape === "pressed" ? "inset " : "";
  return [
    `${inset}${x * d}px ${y * d}px ${config.blur}px ${dark}`,
    `${inset}${-x * d}px ${-y * d}px ${config.blur}px ${light}`,
  ].join(", ");
}

export function neuBackground(config: NeuConfig): string {
  if (config.shape === "concave" || config.shape === "convex") {
    // Gentler shift than the shadows so the surface curve stays subtle.
    const hi = shifted(config.color, 6);
    const lo = shifted(config.color, -6);
    const [from, to] = config.shape === "convex" ? [hi, lo] : [lo, hi];
    return `linear-gradient(${CORNER_ANGLES[config.light]}deg, ${from}, ${to})`;
  }
  return config.color;
}

export function toCss(config: NeuConfig, className = "neumorphic"): string {
  return [
    `.${className} {`,
    `  border-radius: ${config.radius}px;`,
    `  background: ${neuBackground(config)};`,
    `  box-shadow: ${neuBoxShadow(config)};`,
    `}`,
    ``,
    `/* The parent must share the same background for the effect to work */`,
    `.${className}-surface {`,
    `  background: ${config.color};`,
    `}`,
  ].join("\n");
}

export function toTailwind(config: NeuConfig): string {
  const classes = [
    `rounded-[${config.radius}px]`,
    `bg-[${neuBackground(config).replace(/\s/g, "_")}]`,
    `shadow-[${neuBoxShadow(config).replace(/\s/g, "_")}]`,
  ];
  return `<div class="bg-[${config.color}]">\n  <div class="${classes.join(" ")}">\n    <!-- content -->\n  </div>\n</div>`;
}

/** Neumorphism needs a midtone — pure white/black leaves nowhere for shadows to go. */
export function surfaceWarning(color: string): string | null {
  const { l } = hexToHsl(color);
  if (l > 92) return "Almost white — the light shadow has nowhere to go. Try a slightly darker base.";
  if (l < 12) return "Almost black — the dark shadow disappears. Try a slightly lighter base.";
  return null;
}

/** Readable text color on the base surface. */
export function neuText(color: string): string {
  const { h, s, l } = hexToHsl(color);
  return rgbToHex(hslToRgb(h, Math.min(s, 40), l > 50 ? Math.max(l - 45, 8) : Math.min(l + 45, 92)));
}

export function rgbOf(hex: string): RGB {
  const { h, s, l } = hexToHsl(hex);
  return hslToRgb(h, s, l);
}

export function lightnessOf(hex: string): number {
  return rgbToHsl(rgbOf(hex))[2];
}

export const NEU_SWATCHES = [
  "#e0e0e0",
  "#e8ecf3",
  "#dde5d4",
  "#f3e3d3",
  "#e3d3f3",
  "#d3e8f3",
  "#3a3f47",
  "#2d3436",
];

export const DEFAULT_NEU: NeuConfig = {
  color: "#e0e0e0",
  size: 200,
  radius: 40,
  distance: 16,
  intensity: 50,
  blur: 32,
  shape: "flat",
  light: "tl",
};
