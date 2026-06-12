import { rgbToHex, rgbToHsl, type RGB } from "./colorExtract";

export interface PaletteColor {
  id: string;
  /** HSL components: h 0–360, s 0–100, l 0–100. */
  h: number;
  s: number;
  l: number;
  /** Locked colors survive a re-randomize. */
  locked: boolean;
}

export type HarmonyMode =
  | "auto"
  | "monochrome"
  | "analogous"
  | "complementary"
  | "split"
  | "triadic"
  | "tetradic";

export const HARMONY_MODES: { id: HarmonyMode; name: string; hint: string }[] = [
  { id: "auto", name: "Surprise me", hint: "A random harmony every time." },
  { id: "monochrome", name: "Monochrome", hint: "One hue, many shades." },
  { id: "analogous", name: "Analogous", hint: "Neighbouring hues — calm and cohesive." },
  { id: "complementary", name: "Complementary", hint: "Opposite hues — high contrast." },
  { id: "split", name: "Split complementary", hint: "Contrast without the clash." },
  { id: "triadic", name: "Triadic", hint: "Three evenly spaced hues — vibrant." },
  { id: "tetradic", name: "Tetradic", hint: "Two complementary pairs — rich." },
];

const HARMONY_OFFSETS: Record<Exclude<HarmonyMode, "auto">, number[]> = {
  monochrome: [0],
  analogous: [0, 30, -30, 60, -60],
  complementary: [0, 180],
  split: [0, 150, 210],
  triadic: [0, 120, 240],
  tetradic: [0, 90, 180, 270],
};

export function hslToRgb(h: number, s: number, l: number): RGB {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : value;
  const num = parseInt(full, 16);
  const rgb: RGB = [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  const [h, s, l] = rgbToHsl(rgb);
  return { h, s, l };
}

export function paletteHex(color: PaletteColor): string {
  return rgbToHex(hslToRgb(color.h, color.s, color.l));
}

const wrap = (h: number) => ((h % 360) + 360) % 360;
const jitter = (range: number) => (Math.random() - 0.5) * 2 * range;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

let colorId = 0;
function makeColor(h: number, s: number, l: number): PaletteColor {
  return { id: `c-${++colorId}-${Date.now()}`, h: wrap(Math.round(h)), s: Math.round(clamp(s, 0, 100)), l: Math.round(clamp(l, 0, 100)), locked: false };
}

function resolveMode(mode: HarmonyMode): Exclude<HarmonyMode, "auto"> {
  if (mode !== "auto") return mode;
  const modes = Object.keys(HARMONY_OFFSETS) as Exclude<HarmonyMode, "auto">[];
  return modes[Math.floor(Math.random() * modes.length)];
}

/** Hues for a random harmony — used by the gradient randomizer too. */
export function randomHarmonyHues(count: number): number[] {
  return harmonyHues(Math.random() * 360, resolveMode("auto"), count);
}

function harmonyHues(baseHue: number, mode: Exclude<HarmonyMode, "auto">, count: number): number[] {
  const offsets = HARMONY_OFFSETS[mode];
  return Array.from({ length: count }, (_, i) => wrap(baseHue + offsets[i % offsets.length] + jitter(6)));
}

/**
 * Generate a palette, keeping locked colors in place. The base hue comes from
 * `baseHex` if given, else from the first locked color, else random.
 */
export function generatePalette(
  count: number,
  mode: HarmonyMode,
  existing: PaletteColor[] = [],
  baseHex?: string
): PaletteColor[] {
  const resolved = resolveMode(mode);
  const firstLocked = existing.find((c) => c.locked);
  const baseHue = baseHex
    ? hexToHsl(baseHex).h
    : firstLocked
      ? firstLocked.h
      : Math.random() * 360;

  const hues = harmonyHues(baseHue, resolved, count);
  // Spread lightness across the palette so swatches read as a scale, not noise.
  const lightSteps = Array.from(
    { length: count },
    (_, i) => 28 + (i / Math.max(count - 1, 1)) * 48 + jitter(5)
  );

  return Array.from({ length: count }, (_, i) => {
    const kept = existing[i];
    if (kept?.locked) return kept;
    const sat = resolved === "monochrome" ? 35 + (i % 3) * 18 + jitter(6) : 58 + jitter(18);
    return makeColor(hues[i], sat, lightSteps[i]);
  });
}

/** Replace one color from a hex picked by the user, preserving its lock state. */
export function withHex(color: PaletteColor, hex: string): PaletteColor {
  const { h, s, l } = hexToHsl(hex);
  return { ...color, h, s, l };
}
