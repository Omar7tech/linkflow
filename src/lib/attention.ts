/**
 * Predictive visual-attention (saliency) mapping — a fast, on-device proxy for
 * eye-tracking, built from the cues attention research keeps confirming:
 *
 *  - multi-scale local contrast (Itti–Koch style center–surround)
 *  - edge / detail density (Sobel)
 *  - color rarity with a warm-hue boost (Achanta-style; warm saturated colors
 *    attract more fixations than cool ones)
 *  - text likelihood (fine-edge bands with horizontal coherence — text and UI
 *    chrome light up here)
 *  - people / skin tones (YCbCr skin segmentation — faces dominate attention)
 *  - global structure via Spectral Residual saliency (Hou & Zhang 2007, a 2D
 *    FFT on a 128px thumbnail — highlights what stands out from the scene's
 *    statistical background)
 *  - reading-pattern bias (center, F-pattern, Z-pattern)
 *
 * Runs on a downscaled copy in milliseconds.
 */

export interface AttentionWeights {
  /** Multi-scale luminance contrast, 0–100. */
  contrast: number;
  /** Edge / detail density, 0–100. */
  edges: number;
  /** Color distinctiveness with warm-hue boost, 0–100. */
  colorPop: number;
  /** Text-likeness — fine horizontal edge bands, 0–100. */
  text: number;
  /** Skin-tone regions (people, faces), 0–100. */
  people: number;
  /** Spectral-residual "what stands out globally", 0–100. */
  structure: number;
}

export type BiasMode = "center" | "f" | "z" | "none";

export interface Hotspot {
  /** Normalized 0–1 coordinates. */
  x: number;
  y: number;
  /** Relative strength 0–1. */
  strength: number;
}

export interface SaliencyResult {
  /** Per-pixel attention 0–1 at the working resolution. */
  map: Float32Array;
  width: number;
  height: number;
  hotspots: Hotspot[];
  /** 0–100 — how concentrated the attention is (high = clear focal point). */
  focus: number;
}

/* ------------------------------ helpers ------------------------------ */

/** Separable box blur with independent horizontal / vertical radii. */
function boxBlur(src: Float32Array, w: number, h: number, rx: number, ry = rx): Float32Array {
  if (rx < 1 && ry < 1) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  if (rx >= 1) {
    const size = rx * 2 + 1;
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = -rx; x <= rx; x++) sum += src[y * w + Math.min(Math.max(x, 0), w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = sum / size;
        const add = Math.min(x + rx + 1, w - 1);
        const sub = Math.max(x - rx, 0);
        sum += src[y * w + add] - src[y * w + sub];
      }
    }
  } else {
    tmp.set(src);
  }
  if (ry >= 1) {
    const size = ry * 2 + 1;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -ry; y <= ry; y++) sum += tmp[Math.min(Math.max(y, 0), h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / size;
        const add = Math.min(y + ry + 1, h - 1);
        const sub = Math.max(y - ry, 0);
        sum += tmp[add * w + x] - tmp[sub * w + x];
      }
    }
  } else {
    out.set(tmp);
  }
  return out;
}

function normalize(map: Float32Array): void {
  let min = Infinity;
  let max = -Infinity;
  for (const v of map) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  for (let i = 0; i < map.length; i++) map[i] = (map[i] - min) / range;
}

/** Robust normalization — clips the 2%/98% percentile tails so a single
 *  extreme pixel can't flatten the rest of the map. */
function normalizeRobust(map: Float32Array): void {
  const sorted = Float32Array.from(map).sort();
  const lo = sorted[Math.floor(sorted.length * 0.02)];
  const hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))];
  const range = hi - lo || 1;
  for (let i = 0; i < map.length; i++) {
    map[i] = Math.min(Math.max((map[i] - lo) / range, 0), 1);
  }
}

function resizeBilinear(
  src: Float32Array,
  sw: number,
  sh: number,
  dw: number,
  dh: number
): Float32Array {
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = ((y + 0.5) * sh) / dh - 0.5;
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(sh - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < dw; x++) {
      const sx = ((x + 0.5) * sw) / dw - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(sw - 1, x0 + 1);
      const fx = sx - x0;
      const a = src[y0 * sw + x0] * (1 - fx) + src[y0 * sw + x1] * fx;
      const b = src[y1 * sw + x0] * (1 - fx) + src[y1 * sw + x1] * fx;
      out[y * dw + x] = a * (1 - fy) + b * fy;
    }
  }
  return out;
}

/* ------------------------- spectral residual ------------------------- */

/** In-place iterative radix-2 FFT. Length must be a power of two. */
function fft1d(re: Float32Array, im: Float32Array, inverse: boolean): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 1 : -1) * 2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curR = 1;
      let curI = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = i + k + len / 2;
        const vR = re[b] * curR - im[b] * curI;
        const vI = re[b] * curI + im[b] * curR;
        re[b] = re[a] - vR;
        im[b] = im[a] - vI;
        re[a] += vR;
        im[a] += vI;
        const nR = curR * wr - curI * wi;
        curI = curR * wi + curI * wr;
        curR = nR;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

function fft2d(re: Float32Array, im: Float32Array, size: number, inverse: boolean): void {
  const rowR = new Float32Array(size);
  const rowI = new Float32Array(size);
  for (let y = 0; y < size; y++) {
    rowR.set(re.subarray(y * size, (y + 1) * size));
    rowI.set(im.subarray(y * size, (y + 1) * size));
    fft1d(rowR, rowI, inverse);
    re.set(rowR, y * size);
    im.set(rowI, y * size);
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      rowR[y] = re[y * size + x];
      rowI[y] = im[y * size + x];
    }
    fft1d(rowR, rowI, inverse);
    for (let y = 0; y < size; y++) {
      re[y * size + x] = rowR[y];
      im[y * size + x] = rowI[y];
    }
  }
}

/**
 * Spectral Residual saliency (Hou & Zhang 2007): suppress the statistically
 * expected part of the log-amplitude spectrum; what survives is what stands
 * out. Computed on a 128×128 thumbnail and upscaled.
 */
function spectralResidual(lum: Float32Array, w: number, h: number): Float32Array {
  const S = 128;
  const re = resizeBilinear(lum, w, h, S, S);
  const im = new Float32Array(S * S);
  fft2d(re, im, S, false);

  const n = S * S;
  const amp = new Float32Array(n);
  const logAmp = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    amp[i] = Math.hypot(re[i], im[i]);
    logAmp[i] = Math.log(amp[i] + 1e-9);
  }
  const avgLog = boxBlur(logAmp, S, S, 1);
  for (let i = 0; i < n; i++) {
    const scale = Math.exp(logAmp[i] - avgLog[i]) / (amp[i] + 1e-9);
    re[i] *= scale;
    im[i] *= scale;
  }
  fft2d(re, im, S, true);

  const sal = new Float32Array(n);
  for (let i = 0; i < n; i++) sal[i] = re[i] * re[i] + im[i] * im[i];
  const smoothed = boxBlur(sal, S, S, 3);
  normalize(smoothed);
  return resizeBilinear(smoothed, S, S, w, h);
}

/* ----------------------------- skin cue ------------------------------ */

/**
 * Soft skin-tone probability via the classic YCbCr ellipse — a cheap,
 * surprisingly reliable prior for faces and people.
 */
export function computeSkinMap(img: ImageData): Float32Array {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const skin = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const yy = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    if (yy > 40 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
      // Soft membership — strongest at the ellipse center.
      const dc = (cb - 102) / 25;
      const dr = (cr - 153) / 20;
      skin[i] = Math.max(0, 1 - 0.5 * (dc * dc + dr * dr));
    }
  }
  const blurred = boxBlur(skin, w, h, Math.max(2, Math.round(Math.min(w, h) / 50)));
  normalize(blurred);
  return blurred;
}

/* ------------------------------ saliency ------------------------------ */

export function computeSaliency(
  img: ImageData,
  weights: AttentionWeights,
  bias: BiasMode,
  hotspotCount: number
): SaliencyResult {
  const { width: w, height: h, data } = img;
  const n = w * h;

  const lum = new Float32Array(n);
  const rC = new Float32Array(n);
  const gC = new Float32Array(n);
  const bC = new Float32Array(n);
  let meanR = 0;
  let meanG = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    rC[i] = r;
    gC[i] = g;
    bC[i] = b;
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    meanR += r;
    meanG += g;
    meanB += b;
  }
  meanR /= n;
  meanG /= n;
  meanB /= n;

  // Edge density — Sobel magnitude on luminance.
  const edges = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1] +
        lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
      const gy =
        -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] +
        lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
      edges[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // Multi-scale local contrast — center–surround at two surround sizes.
  const rFine = Math.max(2, Math.round(Math.min(w, h) / 24));
  const rCoarse = Math.max(4, Math.round(Math.min(w, h) / 8));
  const localFine = boxBlur(lum, w, h, rFine);
  const localCoarse = boxBlur(lum, w, h, rCoarse);
  const contrast = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    contrast[i] = 0.6 * Math.abs(lum[i] - localFine[i]) + 0.4 * Math.abs(lum[i] - localCoarse[i]);
  }

  // Color rarity — distance from the global mean color, boosted for warm,
  // saturated pixels (reds/oranges pull the eye harder than blues).
  const rB = boxBlur(rC, w, h, 1);
  const gB = boxBlur(gC, w, h, 1);
  const bB = boxBlur(bC, w, h, 1);
  const pop = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const dr = rB[i] - meanR;
    const dg = gB[i] - meanG;
    const db = bB[i] - meanB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    const maxC = Math.max(rB[i], gB[i], bB[i]);
    const sat = maxC > 0 ? (maxC - Math.min(rB[i], gB[i], bB[i])) / maxC : 0;
    const warmth = Math.max(0, (rB[i] - bB[i]) / 255);
    pop[i] = dist * (1 + 0.5 * sat * warmth);
  }

  // Text likelihood — fine edges, capped so big borders don't dominate, then
  // smeared horizontally so letterforms fuse into the bands readers see.
  normalize(edges);
  const textRaw = new Float32Array(n);
  for (let i = 0; i < n; i++) textRaw[i] = Math.min(edges[i], 0.45) / 0.45;
  const text = boxBlur(textRaw, w, h, Math.max(3, Math.round(w / 44)), 1);
  const textSm = boxBlur(text, w, h, 1, Math.max(1, Math.round(h / 120)));

  // People / skin prior.
  const skin = computeSkinMap(img);

  // Global structure — spectral residual.
  const spectral = spectralResidual(lum, w, h);

  normalize(contrast);
  normalize(pop);
  normalize(textSm);

  const map = new Float32Array(n);
  const wSum =
    weights.contrast +
      weights.edges +
      weights.colorPop +
      weights.text +
      weights.people +
      weights.structure || 1;
  for (let i = 0; i < n; i++) {
    map[i] =
      (contrast[i] * weights.contrast +
        edges[i] * weights.edges +
        pop[i] * weights.colorPop +
        textSm[i] * weights.text +
        skin[i] * weights.people +
        spectral[i] * weights.structure) /
      wSum;
  }

  // Viewing-pattern bias.
  if (bias !== "none") {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const nx = x / w;
        const ny = y / h;
        if (bias === "center") {
          const dx = (nx - 0.5) * 2;
          const dy = (ny - 0.5) * 2;
          map[i] *= 0.35 + 0.65 * Math.exp(-(dx * dx + dy * dy) * 1.6);
        } else if (bias === "f") {
          // F-pattern: a strong top band and a left rail, like web reading.
          const top = Math.exp(-3 * Math.pow(ny, 1.3));
          const left = Math.exp(-4 * nx);
          map[i] *= 0.3 + 0.7 * Math.min(1, top * 0.85 + left * 0.4);
        } else {
          // Z-pattern: top band, diagonal sweep, closing bottom band.
          const top = Math.exp(-4 * Math.pow(ny, 1.6));
          const bottom = Math.exp(-4 * Math.pow(1 - ny, 1.6));
          const d = nx + ny - 1;
          const diag = Math.exp(-d * d * 6);
          map[i] *= 0.3 + 0.7 * Math.min(1, top * 0.8 + diag * 0.5 + bottom * 0.35);
        }
      }
    }
  }

  // Smooth into gaze-like blobs and stretch the range.
  const blobR = Math.max(2, Math.round(w / 60));
  const smoothed = boxBlur(boxBlur(map, w, h, blobR), w, h, blobR);
  normalizeRobust(smoothed);
  for (let i = 0; i < n; i++) smoothed[i] = Math.pow(smoothed[i], 1.4);

  return {
    map: smoothed,
    width: w,
    height: h,
    hotspots: findHotspots(smoothed, w, h, hotspotCount),
    focus: focusScore(smoothed),
  };
}

/* --------------------------- AI integration --------------------------- */

/**
 * Refines a raw foreground matte into a saliency-shaped subject map:
 * emphasizes subject interiors over thin matte edges and boosts skin-tone
 * regions inside the subject (faces draw fixations within a figure).
 */
export function refineAiMap(
  ai: Float32Array,
  w: number,
  h: number,
  skin: Float32Array
): Float32Array {
  const blurred = boxBlur(ai, w, h, Math.max(2, Math.round(w / 40)));
  const out = new Float32Array(ai.length);
  for (let i = 0; i < ai.length; i++) {
    const interior = ai[i] * (0.45 + 0.55 * blurred[i]);
    out[i] = interior * (1 + 0.9 * skin[i]);
  }
  normalizeRobust(out);
  return out;
}

/**
 * Hybrid blend: additive so subject interiors stay visible even where the
 * design is flat, plus a multiplicative agreement term that rewards spots
 * where structure and subject coincide.
 */
export function mergeSaliencyMaps(
  algo: Float32Array,
  ai: Float32Array,
  aiWeight = 0.55
): Float32Array {
  const n = algo.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const subject = 0.55 * ai[i] + 0.45 * ai[i] * (0.4 + 1.2 * algo[i]);
    out[i] = (1 - aiWeight) * algo[i] + aiWeight * subject;
  }
  normalizeRobust(out);
  for (let i = 0; i < n; i++) out[i] = Math.pow(out[i], 1.15);
  return out;
}

/**
 * Subject-led map for pure AI mode — the refined subject map carries the
 * prediction, with a quarter of algorithmic texture so flat mattes still
 * show where, within the subject, the eye lands.
 */
export function blendSubjectLed(algo: Float32Array, ai: Float32Array): Float32Array {
  const out = new Float32Array(algo.length);
  for (let i = 0; i < algo.length; i++) out[i] = 0.75 * ai[i] + 0.25 * algo[i];
  normalizeRobust(out);
  return out;
}

/* ----------------------------- analytics ------------------------------ */

/** Greedy peak picking with a minimum spacing between hotspots. */
export function findHotspots(map: Float32Array, w: number, h: number, count: number): Hotspot[] {
  if (count <= 0) return [];

  const candidates: { i: number; v: number }[] = [];
  for (let i = 0; i < map.length; i++) {
    if (map[i] > 0.15) candidates.push({ i, v: map[i] });
  }
  candidates.sort((a, b) => b.v - a.v);

  const picked: Hotspot[] = [];
  const minDist = Math.min(w, h) / 6;

  for (const c of candidates.slice(0, 2000)) {
    const x = c.i % w;
    const y = Math.floor(c.i / w);
    let tooClose = false;
    for (const p of picked) {
      const dx = p.x * w - x;
      const dy = p.y * h - y;
      if (Math.sqrt(dx * dx + dy * dy) < minDist) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      picked.push({ x: x / w, y: y / h, strength: c.v });
      if (picked.length >= count) break;
    }
  }
  return picked;
}

/** Share of total attention captured by the hottest 10% of pixels → 0–100. */
export function focusScore(map: Float32Array): number {
  const sorted = Float64Array.from(map).sort().reverse();
  let total = 0;
  for (const v of sorted) total += v;
  if (total === 0) return 0;
  let top = 0;
  const cut = Math.max(1, Math.floor(sorted.length * 0.1));
  for (let i = 0; i < cut; i++) top += sorted[i];
  const share = top / total; // 0.1 (uniform) … 1 (single point)
  return Math.round(Math.min(Math.max((share - 0.12) / 0.55, 0), 1) * 100);
}

/**
 * Rule-of-thirds attention distribution — the share (0–100) of total
 * attention landing in each cell of a 3×3 grid, row-major.
 */
export function attentionGrid(map: Float32Array, w: number, h: number): number[] {
  const sums = new Array<number>(9).fill(0);
  let total = 0;
  for (let y = 0; y < h; y++) {
    const gy = Math.min(2, Math.floor((y * 3) / h));
    for (let x = 0; x < w; x++) {
      const gx = Math.min(2, Math.floor((x * 3) / w));
      const v = map[y * w + x];
      sums[gy * 3 + gx] += v;
      total += v;
    }
  }
  if (total === 0) return sums;
  return sums.map((s) => Math.round((s / total) * 100));
}

/* ------------------------------ rendering ------------------------------ */

export type ColormapId = "heat" | "viridis" | "cool" | "mono";

export const COLORMAPS: { id: ColormapId; name: string; stops: [number, number, number][] }[] = [
  {
    id: "heat",
    name: "Heat",
    stops: [
      [13, 8, 135],
      [84, 2, 163],
      [156, 23, 158],
      [216, 70, 121],
      [250, 136, 73],
      [240, 249, 33],
    ],
  },
  {
    id: "viridis",
    name: "Viridis",
    stops: [
      [68, 1, 84],
      [59, 82, 139],
      [33, 145, 140],
      [94, 201, 98],
      [253, 231, 37],
    ],
  },
  {
    id: "cool",
    name: "Cool",
    stops: [
      [12, 25, 68],
      [28, 90, 170],
      [60, 170, 230],
      [160, 230, 255],
      [255, 255, 255],
    ],
  },
  {
    id: "mono",
    name: "Mono",
    stops: [
      [30, 30, 30],
      [255, 60, 60],
    ],
  },
];

/** Paint the saliency map into RGBA pixels — cold areas stay transparent. */
export function renderHeatmap(result: SaliencyResult, colormap: ColormapId): ImageData {
  const stops = (COLORMAPS.find((c) => c.id === colormap) ?? COLORMAPS[0]).stops;
  const out = new ImageData(result.width, result.height);
  for (let i = 0; i < result.map.length; i++) {
    const v = result.map[i];
    const t = v * (stops.length - 1);
    const lo = Math.min(Math.floor(t), stops.length - 2);
    const f = t - lo;
    out.data[i * 4] = Math.round(stops[lo][0] + (stops[lo + 1][0] - stops[lo][0]) * f);
    out.data[i * 4 + 1] = Math.round(stops[lo][1] + (stops[lo + 1][1] - stops[lo][1]) * f);
    out.data[i * 4 + 2] = Math.round(stops[lo][2] + (stops[lo + 1][2] - stops[lo][2]) * f);
    // Fade out below ~0.25 so calm regions show the design underneath.
    out.data[i * 4 + 3] = Math.round(Math.min(Math.max((v - 0.18) / 0.5, 0), 1) * 255);
  }
  return out;
}
