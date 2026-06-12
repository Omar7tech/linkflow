/**
 * On-device image enhancement: high-quality resampling (iterative halving for
 * downscales so detail survives), unsharp-mask sharpening, per-channel auto
 * levels and brightness / contrast / saturation adjustments. Pure pixel math —
 * nothing is uploaded.
 */

export interface EnhanceSettings {
  /** Unsharp-mask strength, 0–100. */
  sharpen: number;
  /** -50 … 50 */
  brightness: number;
  /** -50 … 50 */
  contrast: number;
  /** -50 … 50 */
  saturation: number;
  /** Per-channel histogram stretch (fixes flat/hazy images and color casts). */
  autoLevels: boolean;
}

export const DEFAULT_SETTINGS: EnhanceSettings = {
  sharpen: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  autoLevels: false,
};

/** A gentle, safe one-click combination. */
export const AUTO_ENHANCE: EnhanceSettings = {
  sharpen: 35,
  brightness: 2,
  contrast: 10,
  saturation: 8,
  autoLevels: true,
};

export const MAX_OUTPUT_PIXELS = 16_000_000;
export const MAX_OUTPUT_SIDE = 8192;

export function hasAdjustments(s: EnhanceSettings): boolean {
  return (
    s.sharpen > 0 || s.brightness !== 0 || s.contrast !== 0 || s.saturation !== 0 || s.autoLevels
  );
}

/**
 * Resize with quality: upscales in one high-smoothing pass; downscales by
 * repeated halving (single-pass canvas downscales beyond 2× drop detail).
 */
export function resizeCanvas(
  src: HTMLCanvasElement,
  width: number,
  height: number
): HTMLCanvasElement {
  let current = src;
  let cw = src.width;
  let ch = src.height;

  while (cw / 2 >= width && ch / 2 >= height) {
    cw = Math.max(width, Math.round(cw / 2));
    ch = Math.max(height, Math.round(ch / 2));
    const step = document.createElement("canvas");
    step.width = cw;
    step.height = ch;
    const ctx = step.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, cw, ch);
    current = step;
  }

  if (cw === width && ch === height) return current;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, 0, 0, width, height);
  return out;
}

/** Per-channel 0.5%–99.5% histogram stretch, in place. */
export function autoLevels(img: ImageData): void {
  const { data } = img;
  const n = img.width * img.height;
  const lowCut = n * 0.005;
  const highCut = n * 0.995;

  for (let ch = 0; ch < 3; ch++) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) hist[data[i * 4 + ch]]++;
    let acc = 0;
    let lo = 0;
    let hi = 255;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= lowCut) {
        lo = v;
        break;
      }
    }
    acc = 0;
    for (let v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc >= n - highCut) {
        hi = v;
        break;
      }
    }
    const range = hi - lo;
    if (range < 16) continue; // already near full range or degenerate — skip
    const scale = 255 / range;
    for (let i = 0; i < n; i++) {
      const idx = i * 4 + ch;
      data[idx] = Math.min(255, Math.max(0, Math.round((data[idx] - lo) * scale)));
    }
  }
}

/** Brightness / contrast / saturation in one pass, in place. */
export function applyAdjustments(img: ImageData, s: EnhanceSettings): void {
  if (s.brightness === 0 && s.contrast === 0 && s.saturation === 0) return;
  const { data } = img;
  const bright = (s.brightness / 50) * 60;
  const c = (s.contrast / 50) * 110;
  const contrastF = (259 * (c + 255)) / (255 * (259 - c));
  const satF = 1 + (s.saturation / 50) * 0.85;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r = contrastF * (r - 128) + 128 + bright;
    g = contrastF * (g - 128) + 128 + bright;
    b = contrastF * (b - 128) + 128 + bright;

    if (satF !== 1) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * satF;
      g = gray + (g - gray) * satF;
      b = gray + (b - gray) * satF;
    }

    data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}

/**
 * Unsharp mask, in place: out = src + k · (src − blur(src)).
 * Separable 3×3-ish blur per channel; k scales with `amount` (0–100).
 */
export function unsharpMask(img: ImageData, amount: number): void {
  if (amount <= 0) return;
  const { width: w, height: h, data } = img;
  const n = w * h;
  const k = (amount / 100) * 1.4;

  for (let ch = 0; ch < 3; ch++) {
    const src = new Float32Array(n);
    for (let i = 0; i < n; i++) src[i] = data[i * 4 + ch];

    // Horizontal then vertical 1-radius box blur.
    const tmp = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const l = src[row + Math.max(x - 1, 0)];
        const m = src[row + x];
        const r = src[row + Math.min(x + 1, w - 1)];
        tmp[row + x] = (l + m + r) / 3;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const t = tmp[Math.max(y - 1, 0) * w + x];
        const m = tmp[y * w + x];
        const b = tmp[Math.min(y + 1, h - 1) * w + x];
        const blurred = (t + m + b) / 3;
        const v = src[y * w + x] + k * (src[y * w + x] - blurred);
        const idx = (y * w + x) * 4 + ch;
        data[idx] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
  }
}

/** Full pipeline: resize, then (only if needed) pixel passes. */
export function renderEnhanced(
  src: HTMLCanvasElement,
  width: number,
  height: number,
  settings: EnhanceSettings
): HTMLCanvasElement {
  const resized = resizeCanvas(src, width, height);
  if (!hasAdjustments(settings)) return resized;

  // resizeCanvas may return the source itself for 1:1 — never mutate that.
  const out =
    resized === src
      ? (() => {
          const c = document.createElement("canvas");
          c.width = width;
          c.height = height;
          c.getContext("2d")!.drawImage(src, 0, 0);
          return c;
        })()
      : resized;

  const ctx = out.getContext("2d")!;
  const img = ctx.getImageData(0, 0, width, height);
  if (settings.autoLevels) autoLevels(img);
  applyAdjustments(img, settings);
  unsharpMask(img, settings.sharpen);
  ctx.putImageData(img, 0, 0);
  return out;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
