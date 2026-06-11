/**
 * Image color extraction — median-cut palette quantization plus color
 * conversion helpers. Pure functions; pixel data comes from a canvas on-device.
 */

export type RGB = [number, number, number];

export interface Swatch {
  rgb: RGB;
  hex: string;
  /** Share of sampled pixels this color represents (0–1). */
  population: number;
}

/* ------------------------------ Quantization ------------------------------ */

interface Box {
  pixels: RGB[];
  ranges: [number, number, number];
}

function makeBox(pixels: RGB[]): Box {
  const min: RGB = [255, 255, 255];
  const max: RGB = [0, 0, 0];
  for (const p of pixels) {
    for (let c = 0; c < 3; c++) {
      if (p[c] < min[c]) min[c] = p[c];
      if (p[c] > max[c]) max[c] = p[c];
    }
  }
  return { pixels, ranges: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

/** Split a box along its longest color axis at the median. */
function splitBox(box: Box): [Box, Box] {
  const channel = box.ranges[0] >= box.ranges[1] && box.ranges[0] >= box.ranges[2] ? 0 : box.ranges[1] >= box.ranges[2] ? 1 : 2;
  const sorted = [...box.pixels].sort((a, b) => a[channel] - b[channel]);
  const mid = sorted.length >> 1;
  return [makeBox(sorted.slice(0, mid)), makeBox(sorted.slice(mid))];
}

function boxScore(box: Box): number {
  return Math.max(...box.ranges) * box.pixels.length;
}

function averageColor(pixels: RGB[]): RGB {
  const sum: RGB = [0, 0, 0];
  for (const p of pixels) {
    sum[0] += p[0];
    sum[1] += p[1];
    sum[2] += p[2];
  }
  const n = pixels.length || 1;
  return [Math.round(sum[0] / n), Math.round(sum[1] / n), Math.round(sum[2] / n)];
}

/**
 * Extract `count` representative colors from a flat RGBA pixel buffer using
 * median cut, splitting the highest-scoring box until we reach the target.
 */
export function extractPalette(data: Uint8ClampedArray, count: number): Swatch[] {
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 125) continue; // skip mostly-transparent pixels
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (pixels.length === 0) return [];

  let boxes: Box[] = [makeBox(pixels)];
  while (boxes.length < count) {
    const splittable = boxes.filter((b) => b.pixels.length > 1);
    if (splittable.length === 0) break;
    splittable.sort((a, b) => boxScore(b) - boxScore(a));
    const target = splittable[0];
    boxes = boxes.filter((b) => b !== target);
    boxes.push(...splitBox(target));
  }

  const total = pixels.length;
  return boxes
    .map((box) => {
      const rgb = averageColor(box.pixels);
      return { rgb, hex: rgbToHex(rgb), population: box.pixels.length / total };
    })
    .sort((a, b) => b.population - a.population);
}

/* ------------------------------ Conversions ------------------------------- */

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function rgbString([r, g, b]: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return [h, Math.round(s * 100), Math.round(l * 100)];
}

export function hslString(rgb: RGB): string {
  const [h, s, l] = rgbToHsl(rgb);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Relative luminance per WCAG, for choosing readable overlay text. */
export function luminance([r, g, b]: RGB): number {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastText(rgb: RGB): "#000000" | "#ffffff" {
  return luminance(rgb) > 0.4 ? "#000000" : "#ffffff";
}

export function hue(rgb: RGB): number {
  return rgbToHsl(rgb)[0];
}

const NAMED_COLORS: [string, RGB][] = [
  ["Black", [0, 0, 0]],
  ["White", [255, 255, 255]],
  ["Gray", [128, 128, 128]],
  ["Silver", [192, 192, 192]],
  ["Charcoal", [54, 69, 79]],
  ["Red", [255, 0, 0]],
  ["Maroon", [128, 0, 0]],
  ["Crimson", [220, 20, 60]],
  ["Orange", [255, 140, 0]],
  ["Amber", [255, 191, 0]],
  ["Gold", [255, 215, 0]],
  ["Yellow", [255, 225, 0]],
  ["Olive", [128, 128, 0]],
  ["Lime", [120, 220, 60]],
  ["Green", [34, 160, 70]],
  ["Forest", [22, 90, 50]],
  ["Teal", [0, 128, 128]],
  ["Cyan", [0, 200, 210]],
  ["Sky", [120, 190, 235]],
  ["Blue", [40, 90, 230]],
  ["Navy", [20, 30, 90]],
  ["Indigo", [75, 0, 130]],
  ["Purple", [128, 0, 160]],
  ["Violet", [150, 90, 230]],
  ["Magenta", [220, 40, 200]],
  ["Pink", [255, 150, 190]],
  ["Rose", [225, 90, 120]],
  ["Brown", [120, 72, 40]],
  ["Tan", [210, 180, 140]],
  ["Beige", [232, 222, 195]],
  ["Coral", [255, 120, 95]],
  ["Mint", [150, 230, 190]],
  ["Lavender", [200, 190, 235]],
];

/** Nearest human-readable name for a color, by squared RGB distance. */
export function colorName([r, g, b]: RGB): string {
  let best = NAMED_COLORS[0][0];
  let min = Infinity;
  for (const [name, [nr, ng, nb]] of NAMED_COLORS) {
    const d = (r - nr) ** 2 + (g - ng) ** 2 + (b - nb) ** 2;
    if (d < min) {
      min = d;
      best = name;
    }
  }
  return best;
}

export type ColorFormat = "hex" | "rgb" | "hsl";

export function formatColor(rgb: RGB, format: ColorFormat): string {
  if (format === "rgb") return rgbString(rgb);
  if (format === "hsl") return hslString(rgb);
  return rgbToHex(rgb);
}

/* -------------------------------- Exports --------------------------------- */

export type ExportFormat = "css" | "scss" | "json" | "tailwind";

export function exportPalette(swatches: Swatch[], format: ExportFormat): string {
  const colors = swatches.map((s) => s.hex);
  switch (format) {
    case "css":
      return [":root {", ...colors.map((c, i) => `  --color-${i + 1}: ${c};`), "}"].join("\n");
    case "scss":
      return colors.map((c, i) => `$color-${i + 1}: ${c};`).join("\n");
    case "json":
      return JSON.stringify(colors, null, 2);
    case "tailwind":
      return [
        "// tailwind.config.js",
        "theme: {",
        "  extend: {",
        "    colors: {",
        "      palette: {",
        ...colors.map((c, i) => `        ${(i + 1) * 100}: '${c}',`),
        "      },",
        "    },",
        "  },",
        "},",
      ].join("\n");
  }
}
