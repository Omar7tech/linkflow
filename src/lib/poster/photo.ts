/**
 * Photos, Swiss style: printed the way a 1960s poster would print them, in
 * one or two inks. Duotone maps light and shadow onto two poster colours,
 * halftone turns tone into a grid of dots, threshold is pure black and white.
 */

export type Treatment = "duotone" | "halftone" | "threshold" | "mono";

export const TREATMENTS: { id: Treatment; label: string }[] = [
  { id: "duotone", label: "Duotone" },
  { id: "halftone", label: "Halftone" },
  { id: "threshold", label: "Threshold" },
  { id: "mono", label: "Mono" },
];

export interface Photo {
  /** Luminance 0–255. */
  luma: Uint8ClampedArray;
  width: number;
  height: number;
  /** Small RGB sample for picking colours. */
  sample: Uint8ClampedArray;
}

export interface TreatedPhoto {
  url: string;
  width: number;
  height: number;
}

export async function loadPhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const luma = new Uint8ClampedArray(width * height);
  for (let i = 0; i < luma.length; i++) luma[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];

  // Auto levels: stretch the tones so every photo prints with punch.
  const hist = new Array(256).fill(0);
  for (const v of luma) hist[v]++;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < luma.length * 0.01; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < luma.length * 0.01; hi--);
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < luma.length; i++) luma[i] = ((luma[i] - lo) / span) * 255;

  const small = document.createElement("canvas");
  small.width = 48;
  small.height = 48;
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(bitmap, 0, 0, 48, 48);
  bitmap.close();
  return { luma, width, height, sample: sctx.getImageData(0, 0, 48, 48).data };
}

const hexRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Prints the photo in the poster's inks. `dark` is the shadow ink, `light` the paper. */
export function treatPhoto(photo: Photo, treatment: Treatment, dark: string, light: string): TreatedPhoto {
  const { width, height, luma } = photo;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const [dr, dg, db] = hexRgb(dark);
  const [lr, lg, lb] = hexRgb(light);

  if (treatment === "halftone") {
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = dark;
    const cell = Math.max(5, Math.round(Math.max(width, height) / 90));
    // Dots on a 45° screen, sized by how dark the area is.
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(Math.PI / 4);
    const reach = Math.hypot(width, height) / 2;
    for (let y = -reach; y < reach; y += cell)
      for (let x = -reach; x < reach; x += cell) {
        const px = Math.round(width / 2 + (x * Math.SQRT1_2 - y * Math.SQRT1_2));
        const py = Math.round(height / 2 + (x * Math.SQRT1_2 + y * Math.SQRT1_2));
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const ink = 1 - luma[py * width + px] / 255;
        const r = (cell / 2) * Math.sqrt(ink) * 1.15;
        if (r < 0.4) continue;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    ctx.restore();
  } else {
    const image = ctx.createImageData(width, height);
    for (let i = 0; i < luma.length; i++) {
      let t = luma[i] / 255;
      if (treatment === "threshold") t = t > 0.52 ? 1 : 0;
      else if (treatment === "duotone") t = t * t * (3 - 2 * t);
      const mono = treatment === "mono";
      image.data[i * 4] = mono ? luma[i] : dr + (lr - dr) * t;
      image.data[i * 4 + 1] = mono ? luma[i] : dg + (lg - dg) * t;
      image.data[i * 4 + 2] = mono ? luma[i] : db + (lb - db) * t;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }
  return { url: canvas.toDataURL("image/png"), width, height };
}

/* ---------------------------------------------------------- photo palette */

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

const lum = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const sat = ([r, g, b]: number[]) => (Math.max(r, g, b) - Math.min(r, g, b)) / (Math.max(r, g, b) || 1);

/**
 * A poster palette from a photo: a quiet paper, a deep ink and the photo's
 * most vivid colour as the accent, all pulled toward print-like values.
 */
export function paletteFromPhoto(photo: Photo) {
  const px: number[][] = [];
  for (let i = 0; i < photo.sample.length; i += 4) px.push([photo.sample[i], photo.sample[i + 1], photo.sample[i + 2]]);
  // Tiny k-means.
  let centers = [0, 0.25, 0.5, 0.75, 0.95].map((f) => px[Math.floor(f * (px.length - 1))]);
  for (let iter = 0; iter < 8; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let best = 0;
      let dist = Infinity;
      centers.forEach((c, i) => {
        const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2;
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
      sums[best][0] += p[0];
      sums[best][1] += p[1];
      sums[best][2] += p[2];
      sums[best][3]++;
    }
    centers = sums.map((s, i) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[i]));
  }
  const byLum = [...centers].sort((a, b) => lum(a) - lum(b));
  const vividOrder = [...centers].sort((a, b) => sat(b) * (1 - Math.abs(lum(b) - 128) / 255) - sat(a) * (1 - Math.abs(lum(a) - 128) / 255));
  const accent = vividOrder[0];
  const second = vividOrder[1] ?? vividOrder[0];
  const dark = byLum[0];
  const light = byLum[byLum.length - 1];
  // Paper: very light and slightly warm; ink: very dark.
  const paper = light.map((v) => v * 0.2 + 230);
  const ink = dark.map((v) => v * 0.35);
  // Accent: push saturation so it reads like a spot ink.
  const mean = (accent[0] + accent[1] + accent[2]) / 3;
  const vivid = accent.map((v) => mean + (v - mean) * 1.6);
  const mean2 = (second[0] + second[1] + second[2]) / 3;
  const vivid2 = second.map((v) => mean2 + (v - mean2) * 1.5);
  return {
    bg: hex(paper[0], paper[1], paper[2]),
    ink: hex(ink[0], ink[1], ink[2]),
    accent: hex(vivid[0], vivid[1], vivid[2]),
    accent2: hex(vivid2[0], vivid2[1], vivid2[2]),
  };
}
