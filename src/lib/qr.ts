import QRCode from "qrcode";
import { contrastRatio, parseHex } from "./contrast";
import type { QrEyeStyle, QrModuleStyle, QrOptions } from "@/types";

/**
 * Custom QR renderer. We read the raw module matrix from `qrcode` and draw it
 * ourselves as a single SVG — which unlocks styled modules (dots, rounded),
 * shaped finder "eyes", gradient fills, transparency and an embedded logo.
 * PNGs are rasterized from the exact same SVG, so vector and bitmap always match.
 */

interface Resolved {
  fgColor: string;
  bgColor: string;
  size: number;
  moduleStyle: QrModuleStyle;
  eyeStyle: QrEyeStyle;
  eyeColor?: string;
  gradient: QrOptions["gradient"];
  transparent: boolean;
  margin: number;
  logoDataUrl?: string;
  logoScale: number;
  errorLevel: QrOptions["errorLevel"];
}

function resolve(o: QrOptions): Resolved {
  return {
    fgColor: o.fgColor,
    bgColor: o.bgColor,
    size: o.size,
    moduleStyle: o.moduleStyle ?? "square",
    eyeStyle: o.eyeStyle ?? "square",
    eyeColor: o.eyeColor,
    gradient: o.gradient ?? null,
    transparent: o.transparent ?? false,
    margin: o.margin ?? 2,
    logoDataUrl: o.logoDataUrl,
    logoScale: o.logoScale ?? 0.22,
    errorLevel: o.errorLevel,
  };
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return (
    `M ${x + rr} ${y} h ${w - 2 * rr} a ${rr} ${rr} 0 0 1 ${rr} ${rr} ` +
    `v ${h - 2 * rr} a ${rr} ${rr} 0 0 1 ${-rr} ${rr} h ${-(w - 2 * rr)} ` +
    `a ${rr} ${rr} 0 0 1 ${-rr} ${-rr} v ${-(h - 2 * rr)} a ${rr} ${rr} 0 0 1 ${rr} ${-rr} Z`
  );
}

function circle(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
}

function modulePath(style: QrModuleStyle, x: number, y: number, cell: number): string {
  if (style === "dots") return circle(x + cell / 2, y + cell / 2, cell * 0.46);
  if (style === "rounded") return roundedRect(x, y, cell, cell, cell * 0.35);
  return `M ${x} ${y} h ${cell} v ${cell} h ${-cell} Z`;
}

/** A single even-odd path for one eye: outer ring + center dot. */
function eyePath(style: QrEyeStyle, x: number, y: number, cell: number): string {
  const s = 7 * cell;
  const shape = (sx: number, sy: number, side: number, kind: "outer" | "hole" | "inner") => {
    if (style === "circle") return circle(sx + side / 2, sy + side / 2, side / 2);
    if (style === "rounded") {
      const r = kind === "inner" ? side * 0.35 : side * 0.28;
      return roundedRect(sx, sy, side, side, r);
    }
    return `M ${sx} ${sy} h ${side} v ${side} h ${-side} Z`;
  };
  const outer = shape(x, y, s, "outer");
  const hole = shape(x + cell, y + cell, 5 * cell, "hole");
  const inner = shape(x + 2 * cell, y + 2 * cell, 3 * cell, "inner");
  return `${outer} ${hole} ${inner}`;
}

function gradientDef(g: NonNullable<QrOptions["gradient"]>): string {
  const stops = `<stop offset="0%" stop-color="${g.from}"/><stop offset="100%" stop-color="${g.to}"/>`;
  if (g.type === "radial") {
    return `<radialGradient id="qrg" cx="50%" cy="50%" r="75%">${stops}</radialGradient>`;
  }
  const a = ((g.angle ?? 0) * Math.PI) / 180;
  const x1 = 50 - Math.cos(a) * 50;
  const y1 = 50 - Math.sin(a) * 50;
  const x2 = 50 + Math.cos(a) * 50;
  const y2 = 50 + Math.sin(a) * 50;
  return `<linearGradient id="qrg" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`;
}

/** Build the full styled QR as a standalone SVG string. */
export function buildQrSvg(text: string, options: QrOptions): string {
  const o = resolve(options);
  const qr = QRCode.create(text, { errorCorrectionLevel: o.errorLevel });
  const count = qr.modules.size;
  const data = qr.modules.data as unknown as Uint8Array;
  const dark = (r: number, c: number) => !!data[r * count + c];

  const total = count + o.margin * 2;
  const cell = o.size / total;
  const offset = o.margin * cell;
  const X = (c: number) => offset + c * cell;
  const Y = (r: number) => offset + r * cell;

  const finders: [number, number][] = [
    [0, 0],
    [0, count - 7],
    [count - 7, 0],
  ];
  const inFinder = (r: number, c: number) =>
    finders.some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);

  // Data modules → one path (skip the finder regions, drawn separately as eyes).
  let modules = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!dark(r, c) || inFinder(r, c)) continue;
      modules += modulePath(o.moduleStyle, X(c), Y(r), cell) + " ";
    }
  }

  const eyes = finders
    .map(([fr, fc]) => eyePath(o.eyeStyle, X(fc), Y(fr), cell))
    .join(" ");

  const useGrad = !!o.gradient;
  const fill = useGrad ? "url(#qrg)" : o.fgColor;
  const eyeFill = o.eyeColor || fill;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${o.size}" height="${o.size}" viewBox="0 0 ${o.size} ${o.size}">`
  );
  if (useGrad) parts.push(`<defs>${gradientDef(o.gradient!)}</defs>`);
  if (!o.transparent) parts.push(`<rect width="${o.size}" height="${o.size}" fill="${o.bgColor}"/>`);
  if (modules) parts.push(`<path d="${modules.trim()}" fill="${fill}"/>`);
  parts.push(`<path d="${eyes}" fill-rule="evenodd" fill="${eyeFill}"/>`);

  if (o.logoDataUrl) {
    const lw = o.size * Math.min(Math.max(o.logoScale, 0.1), 0.32);
    const pos = (o.size - lw) / 2;
    const pad = lw * 0.14;
    const plate = o.transparent ? "#ffffff" : o.bgColor;
    parts.push(
      `<path d="${roundedRect(pos - pad, pos - pad, lw + pad * 2, lw + pad * 2, pad * 1.4)}" fill="${plate}"/>`
    );
    parts.push(
      `<image href="${o.logoDataUrl}" x="${pos}" y="${pos}" width="${lw}" height="${lw}" preserveAspectRatio="xMidYMid meet"/>`
    );
  }

  parts.push("</svg>");
  return parts.join("");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

export async function qrToSvgString(text: string, options: QrOptions): Promise<string> {
  return buildQrSvg(text, options);
}

/** Rasterize the styled SVG to a PNG data URL, at 2× for crispness. */
export async function qrToPngDataUrl(text: string, options: QrOptions): Promise<string> {
  const svg = buildQrSvg(text, options);
  const scale = 2;
  const px = options.size * scale;
  const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0, px, px);
  return canvas.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function downloadText(content: string, filename: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}

/** PNG data URL → Blob, for clipboard image copy and ZIP packaging. */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

const relLum = (hex: string): number => {
  const rgb = parseHex(hex);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Smart scannability hint. Scanners need a dark pattern on a light, high-contrast
 * background — flag the common ways a styled QR quietly becomes unreadable.
 */
export function qrScanWarning(options: QrOptions): string | null {
  if (options.transparent) {
    return "Transparent background — only scans on a light surface. Add a light background to be safe.";
  }
  const bg = parseHex(options.bgColor);
  if (!bg) return null;

  const fgHexes = options.gradient
    ? [options.gradient.from, options.gradient.to]
    : [options.fgColor];

  // Inverted (light pattern on dark background) trips up many readers.
  const bgLum = relLum(options.bgColor);
  if (fgHexes.every((h) => relLum(h) > bgLum)) {
    return "Light pattern on a dark background — many scanners can't read this. Try a dark pattern on a light background.";
  }

  const minRatio = Math.min(
    ...fgHexes.map((h) => {
      const fg = parseHex(h);
      return fg ? contrastRatio(fg, bg) : 21;
    })
  );
  if (minRatio < 3) {
    return "Low contrast between pattern and background — this may not scan reliably.";
  }
  return null;
}
