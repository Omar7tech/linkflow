/**
 * Single-image random-dot stereogram ("Magic Eye") generator.
 *
 * The trick: a horizontal pattern is repeated across each row, but the repeat
 * spacing is nudged by a depth map. When you diverge your eyes so two repeats
 * overlap, your brain reads the spacing differences as depth and the hidden
 * shape floats out. Based on Thimbleby/Witten/Inglis' classic algorithm.
 */

export type ColorMode = "confetti" | "mono" | "emerald";

export interface StereogramOptions {
  /** Depth pop (mu): higher = more dramatic but harder to fuse. ~0.1–0.6 */
  depthStrength: number;
  /** Eye separation / pattern period in pixels. Larger = wider repeats. */
  eyeSep: number;
  colorMode: ColorMode;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function randomColor(mode: ColorMode): [number, number, number] {
  if (mode === "mono") {
    const v = 40 + Math.floor(Math.random() * 185);
    return [v, v, v];
  }
  if (mode === "emerald") {
    return hslToRgb(135 + Math.random() * 50, 55 + Math.random() * 35, 32 + Math.random() * 42);
  }
  return hslToRgb(Math.random() * 360, 65 + Math.random() * 25, 45 + Math.random() * 22);
}

/**
 * Build a stereogram from a grayscale depth map (white = nearest).
 * Returns fresh ImageData of the same dimensions.
 */
export function generateStereogram(depth: ImageData, opts: StereogramOptions): ImageData {
  const { width: W, height: H, data: dd } = depth;
  const E = Math.max(24, Math.round(opts.eyeSep));
  const mu = opts.depthStrength;
  const out = new Uint8ClampedArray(W * H * 4);
  const same = new Int32Array(W);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) same[x] = x;

    for (let x = 0; x < W; x++) {
      const z = dd[(y * W + x) * 4] / 255; // depth: 0 far … 1 near
      const sep = Math.round(((1 - mu * z) * E) / (2 - mu * z));
      const left = x - (sep >> 1);
      const right = left + sep;
      if (left >= 0 && right < W) same[right] = left;
    }

    // Resolve left→right: a constrained pixel copies its linked partner's color
    // (always to its left, hence already assigned in this ascending pass).
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (same[x] === x) {
        const [r, g, b] = randomColor(opts.colorMode);
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
      } else {
        const s = (y * W + same[x]) * 4;
        out[i] = out[s];
        out[i + 1] = out[s + 1];
        out[i + 2] = out[s + 2];
      }
      out[i + 3] = 255;
    }
  }
  return new ImageData(out, W, H);
}

export const STEREO_SHAPES = ["heart", "star", "circle", "triangle"] as const;
export type StereoShape = (typeof STEREO_SHAPES)[number];
