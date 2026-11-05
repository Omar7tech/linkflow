/**
 * Wallpapers behind the recording: soft multi-light gradients, a few calm
 * solids, and "blur", which uses the recording itself, heavily blurred.
 * Each is painted once per output size and cached.
 */

export interface Wallpaper {
  id: string;
  label: string;
  base: string;
  /** Soft lights: x, y (0–1), radius (× the longer side), colour. */
  lights: [number, number, number, string][];
}

export const WALLPAPERS: Wallpaper[] = [
  { id: "aurora", label: "Aurora", base: "#04130f", lights: [[0.15, 0.1, 0.8, "#10b981"], [0.9, 0.2, 0.7, "#0e7490"], [0.6, 1, 0.8, "#065f46"], [0.4, 0.55, 0.4, "#34d399"]] },
  { id: "dusk", label: "Dusk", base: "#1a0b1f", lights: [[0.1, 0.9, 0.8, "#f97316"], [0.85, 0.15, 0.8, "#7c3aed"], [0.5, 0.5, 0.45, "#ec4899"]] },
  { id: "ocean", label: "Ocean", base: "#04101f", lights: [[0.2, 0.2, 0.8, "#2563eb"], [0.85, 0.85, 0.8, "#06b6d4"], [0.6, 0.3, 0.4, "#60a5fa"]] },
  { id: "sand", label: "Sand", base: "#efe6d8", lights: [[0.1, 0.1, 0.8, "#f5d0a9"], [0.9, 0.9, 0.8, "#e7c6a5"], [0.75, 0.2, 0.5, "#fde68a"]] },
  { id: "mist", label: "Mist", base: "#e8eef3", lights: [[0.2, 0.15, 0.7, "#c7d7fe"], [0.85, 0.8, 0.8, "#d1fae5"], [0.5, 0.5, 0.5, "#ffffff"]] },
  { id: "graphite", label: "Graphite", base: "#0b0b0d", lights: [[0.5, 0, 0.9, "#3f3f46"], [0.5, 1.1, 0.7, "#18181b"]] },
  { id: "lime", label: "Lime", base: "#0c1406", lights: [[0.85, 0.1, 0.8, "#84cc16"], [0.1, 0.9, 0.8, "#14532d"], [0.5, 0.5, 0.35, "#bef264"]] },
  { id: "rose", label: "Rose", base: "#1c0a10", lights: [[0.2, 0.2, 0.8, "#e11d48"], [0.9, 0.9, 0.8, "#fb7185"], [0.7, 0.3, 0.4, "#f9a8d4"]] },
];

export const SOLIDS = ["#ffffff", "#f4f4f5", "#18181b", "#000000", "#10b981", "#2563eb"];

const cache = new Map<string, HTMLCanvasElement>();

function paint(w: Wallpaper, width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = w.base;
  ctx.fillRect(0, 0, width, height);
  const long = Math.max(width, height);
  ctx.globalCompositeOperation = "screen";
  for (const [x, y, r, color] of w.lights) {
    const g = ctx.createRadialGradient(x * width, y * height, 0, x * width, y * height, r * long);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.globalAlpha = w.base.startsWith("#e") || w.base.startsWith("#f") ? 0.9 : 0.75;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  // A whisper of grain keeps big gradients from banding in video.
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  let seed = 7;
  for (let i = 0; i < d.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const n = ((seed / 2147483647) - 0.5) * 7;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Draws the chosen background; returns false when the caller must draw it (blur). */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  id: string,
  width: number,
  height: number,
  image?: HTMLImageElement | null
) {
  if (id === "image" && image?.naturalWidth) {
    const s = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * s;
    const h = image.naturalHeight * s;
    ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
    return true;
  }
  if (id.startsWith("#")) {
    ctx.fillStyle = id;
    ctx.fillRect(0, 0, width, height);
    return true;
  }
  const w = WALLPAPERS.find((x) => x.id === id);
  if (!w) return false;
  const key = `${id}|${width}x${height}`;
  let c = cache.get(key);
  if (!c) {
    c = paint(w, width, height);
    if (cache.size > 12) cache.clear();
    cache.set(key, c);
  }
  ctx.drawImage(c, 0, 0);
  return true;
}

/** A small swatch for pickers, as a CSS background. */
export function wallpaperCss(id: string) {
  if (id.startsWith("#")) return id;
  const w = WALLPAPERS.find((x) => x.id === id);
  if (!w) return "#333";
  return [...w.lights.map(([x, y, r, c]) => `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${c}, transparent ${r * 110}%)`), w.base].join(",");
}
