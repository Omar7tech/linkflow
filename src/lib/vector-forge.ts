import type { TraceColor, TraceData, TraceOptions } from "imagetracerjs";

export type VectorPreset = "logo" | "illustration" | "detailed";

export interface VectorSettings {
  preset: VectorPreset;
  colors: number;
  detail: number;
  smoothing: number;
  cleanup: number;
  sharpCorners: boolean;
  removeBackground: boolean;
  backgroundThreshold: number;
}

export interface VectorSource {
  data: ImageData;
  previewUrl: string;
  name: string;
  originalBytes: number;
  originalWidth: number;
  originalHeight: number;
}

export const VECTOR_PRESETS: Record<VectorPreset, Omit<VectorSettings, "preset">> = {
  logo: {
    colors: 6,
    detail: 48,
    smoothing: 18,
    cleanup: 54,
    sharpCorners: true,
    removeBackground: false,
    backgroundThreshold: 18,
  },
  illustration: {
    colors: 12,
    detail: 66,
    smoothing: 42,
    cleanup: 34,
    sharpCorners: false,
    removeBackground: false,
    backgroundThreshold: 18,
  },
  detailed: {
    colors: 20,
    detail: 84,
    smoothing: 24,
    cleanup: 14,
    sharpCorners: false,
    removeBackground: false,
    backgroundThreshold: 18,
  },
};

export const DEFAULT_VECTOR_SETTINGS: VectorSettings = {
  preset: "logo",
  ...VECTOR_PRESETS.logo,
};

const MAX_EDGE = 1100;
const MAX_PIXELS = 720_000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function fileToVectorSource(file: File): Promise<VectorSource> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Choose a PNG, JPG, WebP, GIF, AVIF or BMP image.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("That image is over 20 MB. Try a smaller export.");
  }

  const previewUrl = URL.createObjectURL(file);
  const image = await loadImage(previewUrl).catch((error) => {
    URL.revokeObjectURL(previewUrl);
    throw error;
  });
  const originalWidth = image.naturalWidth;
  const originalHeight = image.naturalHeight;
  const edgeScale = Math.min(1, MAX_EDGE / Math.max(originalWidth, originalHeight));
  const pixelScale = Math.min(1, Math.sqrt(MAX_PIXELS / (originalWidth * originalHeight)));
  const scale = Math.min(edgeScale, pixelScale);
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    URL.revokeObjectURL(previewUrl);
    throw new Error("Your browser could not start the image processor.");
  }
  context.drawImage(image, 0, 0, width, height);

  return {
    data: context.getImageData(0, 0, width, height),
    previewUrl,
    name: file.name,
    originalBytes: file.size,
    originalWidth,
    originalHeight,
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That image could not be decoded."));
    image.src = url;
  });
}

export function removeCornerBackground(imageData: ImageData, threshold: number): ImageData {
  const copy = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  const { data, width, height } = copy;
  const corners = [0, (width - 1) * 4, (height - 1) * width * 4, (height * width - 1) * 4];
  const background = corners.reduce(
    (sum, index) => ({
      r: sum.r + data[index] / corners.length,
      g: sum.g + data[index + 1] / corners.length,
      b: sum.b + data[index + 2] / corners.length,
    }),
    { r: 0, g: 0, b: 0 }
  );
  const cutoff = Math.max(6, threshold * 3.2);
  const feather = Math.max(8, cutoff * 0.3);

  for (let index = 0; index < data.length; index += 4) {
    const distance = Math.sqrt(
      (data[index] - background.r) ** 2 +
        (data[index + 1] - background.g) ** 2 +
        (data[index + 2] - background.b) ** 2
    );
    if (distance <= cutoff) {
      data[index + 3] = Math.round(data[index + 3] * Math.max(0, (distance - cutoff + feather) / feather));
    }
  }
  return copy;
}

export function settingsToTraceOptions(settings: VectorSettings): TraceOptions {
  return {
    ltres: 0.35 + ((100 - settings.detail) / 100) * 1.65,
    qtres: 0.35 + ((100 - settings.detail) / 100) * 1.65,
    pathomit: Math.max(0, Math.round(settings.cleanup / 4)),
    rightangleenhance: settings.sharpCorners,
    colorsampling: 2,
    numberofcolors: settings.colors,
    mincolorratio: 0.01,
    colorquantcycles: settings.preset === "detailed" ? 2 : 1,
    layering: 0,
    strokewidth: 0,
    linefilter: true,
    scale: 1,
    roundcoords: 2,
    viewbox: true,
    desc: false,
    blurradius: Math.round((settings.smoothing / 100) * 3),
    blurdelta: 24,
  };
}

export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, "")
    .replace(/\s(?:href|xlink:href)\s*=\s*(["'])javascript:.*?\1/gi, "");
}

export function colorToHex(color: TraceColor): string {
  return `#${[color.r, color.g, color.b]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function hexToColor(hex: string, alpha = 255): TraceColor {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
    a: alpha,
  };
}

export function traceStats(svg: string, data: TraceData) {
  return {
    paths: data.layers.reduce((total, layer) => total + layer.length, 0),
    colors: data.palette.filter((color) => color.a > 0).length,
    bytes: new Blob([svg]).size,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function svgToPng(svg: string, width: number, height: number, scale = 2) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is not available in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("PNG export failed."))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
