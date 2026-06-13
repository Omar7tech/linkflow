/**
 * Contrast engine — WCAG 2.1 ratio, modern APCA lightness contrast, and a
 * "smart fix" that nudges a colour to the nearest accessible variant.
 * Pure functions; reuses the colour helpers from colorExtract / palette.
 */
import { luminance, rgbToHex, type RGB } from "./colorExtract";
import { hexToHsl, hslToRgb } from "./palette";

/** Parse "#abc", "#aabbcc", "aabbcc" → RGB, or null if malformed. */
export function parseHex(input: string): RGB | null {
  const v = input.trim().replace(/^#/, "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(rgb: RGB): string {
  return rgbToHex(rgb);
}

/** WCAG 2.1 contrast ratio, 1–21. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface WcagLevels {
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
  uiComponent: boolean;
}

export function wcagLevels(ratio: number): WcagLevels {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    uiComponent: ratio >= 3,
  };
}

/** Highest WCAG grade earned, used for the headline verdict. */
export function overallGrade(ratio: number): "AAA" | "AA" | "AA Large" | "Fail" {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}

/**
 * APCA (Lc) — perceptual lightness contrast, the algorithm behind WCAG 3.
 * Returns a signed Lc value (negative = light text on dark bg). 0.98G constants.
 */
export function apcaLc(text: RGB, bg: RGB): number {
  const lin = (c: number) => Math.pow(c / 255, 2.4);
  const Y = (rgb: RGB) => 0.2126729 * lin(rgb[0]) + 0.7151522 * lin(rgb[1]) + 0.072175 * lin(rgb[2]);

  const blkThrs = 0.022;
  const blkClmp = 1.414;
  const clamp = (y: number) => (y > blkThrs ? y : y + Math.pow(blkThrs - y, blkClmp));

  const Ytxt = clamp(Y(text));
  const Ybg = clamp(Y(bg));
  if (Math.abs(Ybg - Ytxt) < 0.0005) return 0;

  const scale = 1.14;
  const offset = 0.027;
  let sapc: number;
  let out: number;

  if (Ybg > Ytxt) {
    // Dark text on a light background (normal polarity).
    sapc = (Math.pow(Ybg, 0.56) - Math.pow(Ytxt, 0.57)) * scale;
    out = sapc < 0.001 ? 0 : sapc - offset;
  } else {
    // Light text on a dark background (reverse polarity).
    sapc = (Math.pow(Ybg, 0.65) - Math.pow(Ytxt, 0.62)) * scale;
    out = sapc > -0.001 ? 0 : sapc + offset;
  }
  return out * 100;
}

/** Plain-language read of an APCA Lc magnitude. */
export function apcaVerdict(lc: number): string {
  const a = Math.abs(lc);
  if (a >= 90) return "Excellent · any text";
  if (a >= 75) return "Good · body text";
  if (a >= 60) return "OK · larger body text";
  if (a >= 45) return "Headlines only";
  if (a >= 30) return "Large / non-text";
  return "Not readable";
}

/**
 * Nearest accessible variant of `fgHex` against `bg`: keeps hue and saturation,
 * shifts lightness the minimum amount toward black/white until it clears `target`.
 */
export function nearestAccessible(fgHex: string, bg: RGB, target = 4.5): RGB {
  const { h, s, l } = hexToHsl(fgHex);
  // Push toward whichever extreme increases contrast with the background.
  const dir = luminance(bg) > 0.18 ? -1 : 1;
  for (let nl = l; nl >= 0 && nl <= 100; nl += dir) {
    const rgb = hslToRgb(h, s, nl);
    if (contrastRatio(rgb, bg) >= target) return rgb;
  }
  return dir < 0 ? [0, 0, 0] : [255, 255, 255];
}

/** Two apply-ready fixes: the minimal AA pass and a stronger AAA pass. */
export function accessibleSuggestions(fgHex: string, bg: RGB): { aa: RGB; aaa: RGB } {
  return {
    aa: nearestAccessible(fgHex, bg, 4.5),
    aaa: nearestAccessible(fgHex, bg, 7),
  };
}

/** A pleasing, guaranteed-accessible (AAA) random pairing. */
export function randomAccessiblePair(): { fg: RGB; bg: RGB } {
  const h = Math.floor(Math.random() * 360);
  const dark = Math.random() > 0.5;
  const bg = hslToRgb(h, 30 + Math.floor(Math.random() * 50), dark ? 12 + Math.floor(Math.random() * 14) : 82 + Math.floor(Math.random() * 14));
  const fgHue = (h + 150 + Math.floor(Math.random() * 60)) % 360;
  const fg = nearestAccessible(rgbToHex(hslToRgb(fgHue, 60, dark ? 80 : 25)), bg, 7);
  return { fg, bg };
}
