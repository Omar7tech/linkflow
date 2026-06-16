import { PANTONE_COLORS, type PantoneColor } from "./pantone-data";
import type { RGB } from "./colorExtract";

/**
 * Pantone matching. The interesting part is *perceptual* distance: a naive RGB
 * distance puts visually-different colors close together, which makes a Pantone
 * finder feel dumb. We convert to CIE L*a*b* and compare with the CIEDE2000
 * formula, the current standard for how different two colors actually look.
 */

export interface PantoneMatch extends PantoneColor {
  rgb: RGB;
  /** CIEDE2000 difference from the query — 0 is identical, <2 is near-exact. */
  deltaE: number;
}

/* ----------------------------- parsing helpers ---------------------------- */

/** Parse "#abc", "abc", "#aabbcc" or "aabbcc" into RGB, or null if malformed. */
export function parseHex(input: string): RGB | null {
  let v = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(v)) {
    v = v
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-f]{6}$/.test(v)) return null;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/* ------------------------------ color science ----------------------------- */

type Lab = [number, number, number];

/** sRGB (0–255) → CIE L*a*b* under the D65 illuminant. */
export function rgbToLab([r, g, b]: RGB): Lab {
  // sRGB companding → linear
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const rl = lin(r);
  const gl = lin(g);
  const bl = lin(b);

  // linear RGB → XYZ (D65), then normalize by the reference white
  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  let z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** CIEDE2000 color-difference between two Lab colors. */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const toRad = Math.PI / 180;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const hp = (bp: number, ap: number) => {
    if (bp === 0 && ap === 0) return 0;
    const h = Math.atan2(bp, ap) * (180 / Math.PI);
    return h < 0 ? h + 360 : h;
  };
  const h1p = hp(b1, a1p);
  const h2p = hp(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * toRad);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbarp += h1p + h2p < 360 ? 360 : -360;
    hbarp /= 2;
  }

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * toRad) +
    0.24 * Math.cos(2 * hbarp * toRad) +
    0.32 * Math.cos((3 * hbarp + 6) * toRad) -
    0.2 * Math.cos((4 * hbarp - 63) * toRad);

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(2 * dTheta * toRad) * Rc;

  return Math.sqrt(
    (dLp / Sl) ** 2 +
      (dCp / Sc) ** 2 +
      (dHp / Sh) ** 2 +
      Rt * (dCp / Sc) * (dHp / Sh)
  );
}

/* ------------------------------- public API ------------------------------- */

// Precompute every Pantone color's RGB + Lab once — the finder runs on each
// keystroke / picker drag, so we never want to re-parse the table.
const INDEX: (PantoneColor & { rgb: RGB; lab: Lab })[] = PANTONE_COLORS.map((c) => {
  const rgb = parseHex(c.hex)!;
  return { ...c, rgb, lab: rgbToLab(rgb) };
});

/** The full library, RGB-decoded, for browsing. */
export const PANTONE_INDEX: readonly (PantoneColor & { rgb: RGB })[] = INDEX;

/** Closest `count` Pantone colors to a target, nearest first. */
export function nearestPantone(target: RGB, count = 6): PantoneMatch[] {
  const lab = rgbToLab(target);
  return INDEX.map((c) => ({ code: c.code, hex: c.hex, rgb: c.rgb, deltaE: deltaE2000(lab, c.lab) }))
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, count);
}

/** A short, human verdict on how close a match is. */
export function matchQuality(deltaE: number): { label: string; tone: "exact" | "close" | "near" | "far" } {
  if (deltaE < 1) return { label: "Exact match", tone: "exact" };
  if (deltaE < 2) return { label: "Near-perfect", tone: "exact" };
  if (deltaE < 5) return { label: "Very close", tone: "close" };
  if (deltaE < 10) return { label: "Close", tone: "near" };
  return { label: "Approximate", tone: "far" };
}

/** Filter the library by code/name substring (case-insensitive). */
export function searchPantone(query: string): readonly (PantoneColor & { rgb: RGB })[] {
  const q = query.trim().toLowerCase();
  if (!q) return PANTONE_INDEX;
  return PANTONE_INDEX.filter(
    (c) => c.code.toLowerCase().includes(q) || `pantone ${c.code}`.toLowerCase().includes(q)
  );
}
