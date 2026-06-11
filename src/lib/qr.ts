import QRCode from "qrcode";
import type { QrOptions } from "@/types";

function toLibOptions(options: QrOptions) {
  return {
    errorCorrectionLevel: options.errorLevel,
    width: options.size,
    margin: 2,
    color: { dark: options.fgColor, light: options.bgColor },
  } as const;
}

/** Render a QR code (plus optional centered logo) to a PNG data URL. */
export async function qrToPngDataUrl(text: string, options: QrOptions): Promise<string> {
  const base = await QRCode.toDataURL(text, toLibOptions(options));
  if (!options.logoDataUrl) return base;
  return overlayLogo(base, options.logoDataUrl, options.size, options.bgColor);
}

export async function qrToSvgString(text: string, options: QrOptions): Promise<string> {
  return QRCode.toString(text, { ...toLibOptions(options), type: "svg" });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

async function overlayLogo(
  qrDataUrl: string,
  logoDataUrl: string,
  size: number,
  bgColor: string
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return qrDataUrl;

  const [qr, logo] = await Promise.all([loadImage(qrDataUrl), loadImage(logoDataUrl)]);
  ctx.drawImage(qr, 0, 0, size, size);

  // Keep the logo under ~20% of the QR area so it stays scannable.
  const logoSize = Math.round(size * 0.2);
  const pad = Math.round(logoSize * 0.15);
  const x = (size - logoSize) / 2;
  const y = (size - logoSize) / 2;

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, pad);
  ctx.fill();
  ctx.drawImage(logo, x, y, logoSize, logoSize);

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
