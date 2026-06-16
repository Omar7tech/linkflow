import type { RGB } from "./colorExtract";

/**
 * Gradient-map duotone: every pixel's brightness is remapped onto a two-color
 * ramp (shadows → `shadow`, highlights → `highlight`). We precompute a 256-entry
 * lookup table from the tone curve so the per-pixel loop is just a luminance
 * read + table lookup — fast enough to recolor on every slider drag.
 */

export interface DuotoneOptions {
  shadow: RGB;
  highlight: RGB;
  /** Tone contrast multiplier around the midpoint. 1 = linear. */
  contrast: number;
  /** Brightness pivot (0–1) that lands in the middle of the ramp. */
  midpoint: number;
  /** Blend with the original image. 1 = full duotone, 0 = untouched. */
  amount: number;
  /** Film-grain strength (0–40 of added ± noise per channel). */
  grain: number;
}

export const DEFAULT_DUOTONE: Omit<DuotoneOptions, "shadow" | "highlight"> = {
  contrast: 1,
  midpoint: 0.5,
  amount: 1,
  grain: 0,
};

function ramp(shadow: RGB, highlight: RGB, contrast: number, midpoint: number) {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    let t = i / 255;
    t = (t - 0.5) * contrast + 0.5; // stretch contrast around the centre
    t += 0.5 - midpoint; // slide the pivot
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    lut[i * 3] = Math.round(shadow[0] + (highlight[0] - shadow[0]) * t);
    lut[i * 3 + 1] = Math.round(shadow[1] + (highlight[1] - shadow[1]) * t);
    lut[i * 3 + 2] = Math.round(shadow[2] + (highlight[2] - shadow[2]) * t);
  }
  return lut;
}

/** Return a new ImageData with the duotone applied; the source is untouched. */
export function applyDuotone(src: ImageData, o: DuotoneOptions): ImageData {
  const lut = ramp(o.shadow, o.highlight, o.contrast, o.midpoint);
  const out = new Uint8ClampedArray(src.data); // copy keeps alpha + originals
  const d = src.data;
  const { amount, grain } = o;

  for (let p = 0; p < d.length; p += 4) {
    const lum = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) | 0;
    let r = lut[lum * 3];
    let g = lut[lum * 3 + 1];
    let b = lut[lum * 3 + 2];

    if (amount < 1) {
      r = d[p] + (r - d[p]) * amount;
      g = d[p + 1] + (g - d[p + 1]) * amount;
      b = d[p + 2] + (b - d[p + 2]) * amount;
    }
    if (grain > 0) {
      const n = (Math.random() - 0.5) * grain;
      r += n;
      g += n;
      b += n;
    }
    // Uint8ClampedArray clamps + rounds on assignment.
    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = b;
  }
  return new ImageData(out, src.width, src.height);
}

export interface DuotonePreset {
  name: string;
  shadow: string;
  highlight: string;
}

export const DUOTONE_PRESETS: DuotonePreset[] = [
  { name: "Emerald", shadow: "#04241a", highlight: "#34d399" },
  { name: "Midnight", shadow: "#0f172a", highlight: "#38bdf8" },
  { name: "Berry", shadow: "#2d0b3a", highlight: "#f72585" },
  { name: "Sunset", shadow: "#4a0e4e", highlight: "#ff9e6d" },
  { name: "Gold", shadow: "#161616", highlight: "#f5c518" },
  { name: "Mono", shadow: "#111111", highlight: "#f5f5f5" },
  { name: "Ultraviolet", shadow: "#1b0245", highlight: "#9d4edd" },
  { name: "Cyanotype", shadow: "#06283d", highlight: "#47b5ff" },
];
