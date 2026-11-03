/**
 * The paper route: a printable template, and reading a photo of it back.
 *
 * Only the four corner markers (and the page code) are printed in black.
 * Everything else, the boxes, guides and hints, is printed in a light blue
 * that the reader ignores, so only the handwriting is picked up. The markers
 * give four known points, which straighten the photo however it was taken.
 */
import { DIGITS, LOWER, PAD_GUIDES, PUNCT, UPPER } from "./charset";
import { MASK_SIZE, type Mask } from "./trace";

/* ---------------------------------------------------------------- layout */

export const PAGE = { width: 210, height: 297 } as const;
const MARKER = 8;
/** Marker centres in mm: top-left, top-right, bottom-left, bottom-right. */
export const MARKERS: [number, number][] = [
  [16, 16],
  [194, 16],
  [16, 281],
  [194, 281],
];
const CODE_BOXES: [number, number][] = [
  [97, 281],
  [113, 281],
];
const GRID = { x: 17, y: 30, width: 176, height: 240, cols: 7, rows: 8 };
const CELL = { width: GRID.width / GRID.cols, height: GRID.height / GRID.rows };
const SQUARE = 23;

export const PAGE_SLOTS: string[][] = [
  [...UPPER, ...LOWER],
  [...DIGITS, ...PUNCT, ...LOWER.map((c) => `${c}.alt`)],
];

/** The writing square of a cell, in mm. */
function cellSquare(index: number) {
  const col = index % GRID.cols;
  const row = Math.floor(index / GRID.cols);
  const x = GRID.x + col * CELL.width + (CELL.width - SQUARE) / 2;
  const y = GRID.y + row * CELL.height + 5.5;
  return { x, y, size: SQUARE };
}

const BLUE = "#38bdf8";
const PALE = "#bae6fd";

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One template page as an SVG document, sized in millimetres. */
export function templateSvg(page: number, fontName: string): string {
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.width}mm" height="${PAGE.height}mm" viewBox="0 0 ${PAGE.width} ${PAGE.height}">`,
    `<rect width="${PAGE.width}" height="${PAGE.height}" fill="#fff"/>`
  );
  for (const [x, y] of MARKERS)
    parts.push(`<rect x="${x - MARKER / 2}" y="${y - MARKER / 2}" width="${MARKER}" height="${MARKER}" fill="#000"/>`);
  CODE_BOXES.forEach(([x, y], i) =>
    parts.push(
      i === page
        ? `<rect x="${x - 2.5}" y="${y - 2.5}" width="5" height="5" fill="#000"/>`
        : `<rect x="${x - 2.5}" y="${y - 2.5}" width="5" height="5" fill="none" stroke="${PALE}" stroke-width="0.3"/>`
    )
  );

  const font = `font-family="Helvetica, Arial, sans-serif"`;
  parts.push(
    `<text x="105" y="15" text-anchor="middle" ${font} font-size="4.2" font-weight="700" fill="${BLUE}">${escapeXml(fontName || "My font")} · page ${page + 1} of 2</text>`,
    `<text x="105" y="21.5" text-anchor="middle" ${font} font-size="2.8" fill="${BLUE}">Write one character per box with a dark pen. Sit letters on the solid line; tails go below it.</text>`,
    `<text x="105" y="25.5" text-anchor="middle" ${font} font-size="2.8" fill="${BLUE}">Keep the black squares in the photo, and photograph the page flat and well lit.</text>`
  );

  PAGE_SLOTS[page].forEach((key, index) => {
    const sq = cellSquare(index);
    const label = key.endsWith(".alt") ? `${key[0]}  (2nd)` : key;
    const k = sq.size / 1000;
    parts.push(
      `<text x="${sq.x}" y="${sq.y - 1.3}" ${font} font-size="3.4" fill="${BLUE}">${escapeXml(label)}</text>`,
      `<rect x="${sq.x}" y="${sq.y}" width="${sq.size}" height="${sq.size}" rx="1.2" fill="none" stroke="${PALE}" stroke-width="0.3"/>`,
      `<line x1="${sq.x}" x2="${sq.x + sq.size}" y1="${sq.y + PAD_GUIDES.cap * k}" y2="${sq.y + PAD_GUIDES.cap * k}" stroke="${PALE}" stroke-width="0.2" stroke-dasharray="0.8 0.8"/>`,
      `<line x1="${sq.x}" x2="${sq.x + sq.size}" y1="${sq.y + PAD_GUIDES.xHeight * k}" y2="${sq.y + PAD_GUIDES.xHeight * k}" stroke="${PALE}" stroke-width="0.2" stroke-dasharray="0.8 0.8"/>`,
      `<line x1="${sq.x}" x2="${sq.x + sq.size}" y1="${sq.y + PAD_GUIDES.baseline * k}" y2="${sq.y + PAD_GUIDES.baseline * k}" stroke="${BLUE}" stroke-width="0.35"/>`
    );
  });
  parts.push("</svg>");
  return parts.join("");
}

/** Opens the browser's print dialog with both pages, one per A4 sheet. */
export function printTemplate(fontName: string) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(
    `<!doctype html><html><head><title>Font template</title><style>@page{size:A4;margin:0}html,body{margin:0}svg{display:block;width:210mm;height:297mm;page-break-after:always}</style></head><body>${templateSvg(0, fontName)}${templateSvg(1, fontName)}</body></html>`
  );
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 250);
}

/** A page as a PNG at 200 dpi, for people who would rather save than print. */
export async function templatePng(page: number, fontName: string): Promise<Blob> {
  const svg = new Blob([templateSvg(page, fontName)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svg);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = 200 / 25.4;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(PAGE.width * scale);
    canvas.height = Math.round(PAGE.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render the template"))), "image/png")
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* --------------------------------------------------------------- reading */

export type Point = [number, number];

export interface Photo {
  /** Brightness per pixel: the brightest channel, so light blue reads as paper. */
  value: Uint8Array;
  width: number;
  height: number;
  /** A small copy for showing on screen. */
  previewUrl: string;
}

export async function loadPhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, width, height);
  const value = new Uint8Array(width * height);
  for (let i = 0; i < value.length; i++) value[i] = Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const previewUrl = canvas.toDataURL("image/jpeg", 0.8);
  return { value, width, height, previewUrl };
}

function otsu(values: Uint8Array) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < values.length; i++) hist[values[i]]++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Finds the four corner markers: solid, square dark blobs, the ones nearest
 * each corner of the photo. Returns them in template order, or null.
 */
export function detectMarkers(photo: Photo): Point[] | null {
  // Work on a smaller copy; markers are big enough to survive it.
  const step = Math.max(1, Math.round(Math.max(photo.width, photo.height) / 1000));
  const w = Math.floor(photo.width / step);
  const h = Math.floor(photo.height / step);
  const small = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) small[y * w + x] = photo.value[y * step * photo.width + x * step];
  const t = otsu(small);
  const dark = new Uint8Array(w * h);
  for (let i = 0; i < dark.length; i++) dark[i] = small[i] < t ? 1 : 0;

  const labels = new Int32Array(w * h);
  const stack: number[] = [];
  const blobs: { area: number; cx: number; cy: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let start = 0; start < dark.length; start++) {
    if (!dark[start] || labels[start]) continue;
    const id = blobs.length + 1;
    let area = 0;
    let sx = 0;
    let sy = 0;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    stack.push(start);
    labels[start] = id;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      area++;
      sx += x;
      sy += y;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
      const near = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const n of near)
        if (n >= 0 && dark[n] && !labels[n]) {
          labels[n] = id;
          stack.push(n);
        }
    }
    blobs.push({ area, cx: sx / area, cy: sy / area, x0, y0, x1, y1 });
  }

  const squares = blobs
    .filter((b) => {
      const bw = b.x1 - b.x0 + 1;
      const bh = b.y1 - b.y0 + 1;
      const aspect = bw / bh;
      return bw >= 6 && bh >= 6 && aspect > 0.55 && aspect < 1.8 && b.area / (bw * bh) > 0.72;
    })
    .sort((a, b) => b.area - a.area)
    .slice(0, 8);
  if (squares.length < 4) return null;

  const corners: Point[] = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ];
  const used = new Set<number>();
  const found: Point[] = [];
  for (const [x, y] of corners) {
    let best = -1;
    let bestDist = Infinity;
    squares.forEach((s, i) => {
      if (used.has(i)) return;
      const d = Math.hypot(s.cx - x, s.cy - y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best < 0) return null;
    used.add(best);
    found.push([(squares[best].cx + 0.5) * step, (squares[best].cy + 0.5) * step]);
  }
  return found;
}

/** Corners for a photo where detection failed: a guess the user can drag. */
export function defaultCorners(photo: Photo): Point[] {
  const mx = photo.width * 0.12;
  const my = photo.height * 0.12;
  return [
    [mx, my],
    [photo.width - mx, my],
    [mx, photo.height - my],
    [photo.width - mx, photo.height - my],
  ];
}

/* ------------------------------------------------------------ homography */

type H = number[];

function solve(a: number[][], b: number[]) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[pivot][i])) pivot = r;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    [b[i], b[pivot]] = [b[pivot], b[i]];
    for (let r = i + 1; r < n; r++) {
      const f = a[r][i] / a[i][i];
      for (let c = i; c < n; c++) a[r][c] -= f * a[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < n; c++) s -= a[i][c] * x[c];
    x[i] = s / a[i][i];
  }
  return x;
}

/** Maps template millimetres onto photo pixels. */
export function homography(dst: Point[]): H {
  const a: number[][] = [];
  const b: number[] = [];
  MARKERS.forEach(([x, y], i) => {
    const [u, v] = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  });
  return solve(a, b);
}

const project = (h: H, x: number, y: number): Point => {
  const d = h[6] * x + h[7] * y + 1;
  return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
};

function sample(photo: Photo, x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 >= photo.width - 1 || y0 >= photo.height - 1) return 255;
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * photo.width + x0;
  const v = photo.value;
  return (
    v[i] * (1 - fx) * (1 - fy) + v[i + 1] * fx * (1 - fy) + v[i + photo.width] * (1 - fx) * fy + v[i + photo.width + 1] * fx * fy
  );
}

/** Which page the photo shows, read from the filled page-code box. */
export function detectPage(photo: Photo, corners: Point[]): number {
  const h = homography(corners);
  const darkness = CODE_BOXES.map(([cx, cy]) => {
    let total = 0;
    for (let dy = -1.5; dy <= 1.5; dy += 0.5)
      for (let dx = -1.5; dx <= 1.5; dx += 0.5) {
        const [x, y] = project(h, cx + dx, cy + dy);
        total += 255 - sample(photo, x, y);
      }
    return total;
  });
  return darkness[1] > darkness[0] ? 1 : 0;
}

/** Cuts every writing square out of the photo as a straightened ink mask. */
export function extractCells(photo: Photo, corners: Point[], page: number): Map<string, Mask> {
  const h = homography(corners);
  const out = new Map<string, Mask>();
  const size = MASK_SIZE;
  const values = new Float32Array(size * size);

  PAGE_SLOTS[page].forEach((key, index) => {
    const sq = cellSquare(index);
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const [x, y] = project(h, sq.x + ((i + 0.5) / size) * sq.size, sq.y + ((j + 0.5) / size) * sq.size);
        values[j * size + i] = sample(photo, x, y);
      }

    // Paper brightness for this square (light varies across a photo), then
    // anything clearly darker than the paper is ink.
    const sorted = Float32Array.from(values).sort();
    const paper = sorted[Math.floor(sorted.length * 0.8)];
    const threshold = paper * 0.58;
    // Ignore a thin rim so the printed box edge never counts as ink.
    const rim = Math.round(size * 0.012);
    const data = new Uint8Array(size * size);
    let ink = 0;
    for (let j = rim; j < size - rim; j++)
      for (let i = rim; i < size - rim; i++) {
        const k = j * size + i;
        if (values[k] < threshold) {
          data[k] = 1;
          ink++;
        }
      }
    if (ink / data.length > 0.0015) out.set(key, { size, data });
  });
  return out;
}
