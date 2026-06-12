import type { RGB } from "./colorExtract";

export interface RemoveOptions {
  /** The background color to remove. */
  bg: RGB;
  /** Color distance below which a pixel is fully removed, 0–120. */
  tolerance: number;
  /** Feather band above the tolerance — pixels fade out instead of hard-cutting, 0–60. */
  soft: number;
  /**
   * "edges": flood fill from the borders only — enclosed areas (letter counters,
   * shapes inside the logo) keep their color even if it matches the background.
   * "global": remove the color everywhere.
   */
  mode: "edges" | "global";
}

function colorDist(data: Uint8ClampedArray, i: number, [r, g, b]: RGB): number {
  const dr = data[i] - r;
  const dg = data[i + 1] - g;
  const db = data[i + 2] - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Detect the background color by binning every border pixel and averaging the
 * most common bin — robust even when the logo touches an edge.
 */
export function detectBgColor(img: ImageData): RGB {
  const { data, width, height } = img;
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  const visit = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 200) return; // already-transparent border pixels carry no info
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bin.count++;
    bin.r += data[i];
    bin.g += data[i + 1];
    bin.b += data[i + 2];
    bins.set(key, bin);
  };
  for (let x = 0; x < width; x++) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    visit(0, y);
    visit(width - 1, y);
  }
  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const bin of bins.values()) {
    if (!best || bin.count > best.count) best = bin;
  }
  if (!best) return [255, 255, 255];
  return [
    Math.round(best.r / best.count),
    Math.round(best.g / best.count),
    Math.round(best.b / best.count),
  ];
}

/**
 * Remove the background, feather the boundary and defringe semi-transparent
 * pixels (un-mixes the old background color so edges don't halo).
 */
export function removeBackground(img: ImageData, opts: RemoveOptions): ImageData {
  const { width, height } = img;
  const out = new ImageData(new Uint8ClampedArray(img.data), width, height);
  const data = out.data;
  const limit = opts.tolerance + Math.max(opts.soft, 0.001);
  const [br, bg, bb] = opts.bg;

  const apply = (i: number) => {
    const d = colorDist(img.data, i, opts.bg);
    if (d <= opts.tolerance) {
      data[i + 3] = 0;
      return;
    }
    // Feather band: partial alpha + defringe (subtract the background's share).
    const a = (d - opts.tolerance) / (limit - opts.tolerance);
    const alpha = Math.round(a * 255);
    if (alpha < data[i + 3]) data[i + 3] = alpha;
    if (alpha > 0) {
      data[i] = Math.min(255, Math.max(0, Math.round((img.data[i] - br * (1 - a)) / a)));
      data[i + 1] = Math.min(255, Math.max(0, Math.round((img.data[i + 1] - bg * (1 - a)) / a)));
      data[i + 2] = Math.min(255, Math.max(0, Math.round((img.data[i + 2] - bb * (1 - a)) / a)));
    }
  };

  if (opts.mode === "global") {
    for (let i = 0; i < data.length; i += 4) {
      if (colorDist(img.data, i, opts.bg) <= limit) apply(i);
    }
    return out;
  }

  // Flood fill from every border pixel that looks like background.
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const tryPush = (p: number) => {
    if (visited[p]) return;
    if (colorDist(img.data, p * 4, opts.bg) <= limit) {
      visited[p] = 1;
      queue.push(p);
    }
  };
  for (let x = 0; x < width; x++) {
    tryPush(x);
    tryPush((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    tryPush(y * width);
    tryPush(y * width + width - 1);
  }
  while (queue.length) {
    const p = queue.pop()!;
    apply(p * 4);
    const x = p % width;
    if (x > 0) tryPush(p - 1);
    if (x < width - 1) tryPush(p + 1);
    if (p >= width) tryPush(p - width);
    if (p < width * (height - 1)) tryPush(p + width);
  }
  return out;
}

/** Crop to the opaque content's bounding box, with optional padding. */
export function trimTransparent(img: ImageData, padding = 0): ImageData | null {
  const { data, width, height } = img;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // fully transparent
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    const src = ((y + minY) * width + minX) * 4;
    out.data.set(data.subarray(src, src + w * 4), y * w * 4);
  }
  return out;
}

export function rgbToHexStr([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
