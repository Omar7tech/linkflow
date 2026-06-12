/**
 * Predictive visual-attention (saliency) mapping — a fast, on-device proxy for
 * eye-tracking, built from the cues attention research keeps confirming:
 * local contrast, edge density, color rarity (Achanta-style) and reading-
 * pattern bias. Runs on a downscaled copy in milliseconds.
 */

export interface AttentionWeights {
  /** Local luminance contrast, 0–100. */
  contrast: number;
  /** Edge / detail density (text and UI chrome light up here), 0–100. */
  edges: number;
  /** Color distinctiveness — how far a pixel sits from the page's average color, 0–100. */
  colorPop: number;
}

export type BiasMode = "center" | "f" | "none";

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

function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius < 1) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const size = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += src[y * w + Math.min(Math.max(x, 0), w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / size;
      const add = Math.min(x + radius + 1, w - 1);
      const sub = Math.max(x - radius, 0);
      sum += src[y * w + add] - src[y * w + sub];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(Math.max(y, 0), h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / size;
      const add = Math.min(y + radius + 1, h - 1);
      const sub = Math.max(y - radius, 0);
      sum += tmp[add * w + x] - tmp[sub * w + x];
    }
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

  // Local contrast — distance from the neighbourhood mean.
  const radius = Math.max(2, Math.round(Math.min(w, h) / 24));
  const local = boxBlur(lum, w, h, radius);
  const contrast = new Float32Array(n);
  for (let i = 0; i < n; i++) contrast[i] = Math.abs(lum[i] - local[i]);

  // Color rarity — distance from the global mean color (slightly smoothed).
  const rB = boxBlur(rC, w, h, 1);
  const gB = boxBlur(gC, w, h, 1);
  const bB = boxBlur(bC, w, h, 1);
  const pop = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const dr = rB[i] - meanR;
    const dg = gB[i] - meanG;
    const db = bB[i] - meanB;
    pop[i] = Math.sqrt(dr * dr + dg * dg + db * db);
  }

  normalize(edges);
  normalize(contrast);
  normalize(pop);

  const map = new Float32Array(n);
  const wSum = weights.contrast + weights.edges + weights.colorPop || 1;
  for (let i = 0; i < n; i++) {
    map[i] =
      (contrast[i] * weights.contrast + edges[i] * weights.edges + pop[i] * weights.colorPop) /
      wSum;
  }

  // Viewing-pattern bias.
  if (bias !== "none") {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (bias === "center") {
          const dx = (x / w - 0.5) * 2;
          const dy = (y / h - 0.5) * 2;
          map[i] *= 0.35 + 0.65 * Math.exp(-(dx * dx + dy * dy) * 1.6);
        } else {
          // F-pattern: a strong top band and a left rail, like web reading.
          const top = Math.exp(-3 * Math.pow(y / h, 1.3));
          const left = Math.exp(-4 * (x / w));
          map[i] *= 0.3 + 0.7 * Math.min(1, top * 0.85 + left * 0.4);
        }
      }
    }
  }

  // Smooth into gaze-like blobs and stretch the range.
  const smoothed = boxBlur(boxBlur(map, w, h, Math.max(2, Math.round(w / 60))), w, h, Math.max(2, Math.round(w / 60)));
  normalize(smoothed);
  for (let i = 0; i < n; i++) smoothed[i] = Math.pow(smoothed[i], 1.4);

  return {
    map: smoothed,
    width: w,
    height: h,
    hotspots: findHotspots(smoothed, w, h, hotspotCount),
    focus: focusScore(smoothed),
  };
}

/** 
 * Merges algorithmic saliency (visual cues) with AI saliency (semantic cues).
 * Instead of a simple average, we use the AI map as a "boost" for the visual 
 * cues while maintaining a baseline of attention for the whole design.
 */
export function mergeSaliencyMaps(
  algo: Float32Array,
  ai: Float32Array,
  aiWeight: number = 0.5
): Float32Array {
  const n = algo.length;
  const out = new Float32Array(n);
  
  // Weights: 0 = pure algo, 1 = algo modulated by AI.
  // We use the AI map to "amplify" the importance of objects it found.
  for (let i = 0; i < n; i++) {
    // We blend the raw algo with a boosted version of it.
    // aiWeight controls how much the AI "objectness" influences the result.
    const boost = 0.4 + 1.2 * ai[i];
    out[i] = algo[i] * (boost * aiWeight + (1 - aiWeight));
  }
  
  normalize(out);
  return out;
}

/** Greedy peak picking with a minimum spacing between hotspots. */
export function findHotspots(map: Float32Array, w: number, h: number, count: number): Hotspot[] {
  if (count <= 0) return [];
  
  // Sort indices by map value
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
    
    // Check if this peak is far enough from already picked ones
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

/* ------------------------------ rendering ------------------------------ */

export type ColormapId = "heat" | "viridis" | "mono";

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
