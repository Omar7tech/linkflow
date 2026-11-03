/**
 * Pen strokes for the drawing pad.
 *
 * Strokes are stored as centre lines with pressure, never as pixels, so the
 * pen can change after the fact: switch a whole alphabet from fineliner to
 * brush to broad nib, or make it thicker, and every letter redraws.
 */
import { MASK_SIZE, type Mask } from "./trace";

export type PenStyle = "fineliner" | "brush" | "nib";

export interface StrokePoint {
  /** Pad units, 0–1000. */
  x: number;
  y: number;
  /** Pressure 0–1 (0.5 for a mouse). */
  p: number;
}

export interface Stroke {
  points: StrokePoint[];
  erase?: boolean;
}

export interface Pen {
  style: PenStyle;
  /** Nominal width in pad units. */
  size: number;
}

/** Broad-nib angle, the classic 35° of a chisel pen. */
const NIB_ANGLE = (-35 * Math.PI) / 180;

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function strokeLength(points: StrokePoint[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++)
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

function drawRound(ctx: Ctx, stroke: Stroke, pen: Pen, scale: number) {
  const pts = stroke.points;
  const width = (i: number, travelled: number, total: number) => {
    if (stroke.erase) return pen.size * 2.2;
    if (pen.style === "fineliner") return pen.size;
    // Brush: pressure, speed (wide gaps between samples mean a fast hand) and
    // a taper at both ends.
    const p = pts[i].p;
    const gap = i > 0 ? Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) : 0;
    const speed = Math.min(1.2, Math.max(0.55, 1.25 - gap / 45));
    const ends = Math.min(1, Math.sqrt(travelled / 70), Math.sqrt(Math.max(0, total - travelled) / 70));
    return pen.size * (0.35 + 1.15 * p) * speed * Math.max(0.22, ends);
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (pts.length === 1) {
    const r = (width(0, 35, 70) * scale) / 2;
    ctx.beginPath();
    ctx.arc(pts[0].x * scale, pts[0].y * scale, Math.max(r, 0.5), 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const total = strokeLength(pts);
  let travelled = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    travelled += Math.hypot(b.x - a.x, b.y - a.y);
    // Midpoint smoothing: each piece runs from one midpoint to the next,
    // bending through the sample point.
    const startX = i === 1 ? a.x : (pts[i - 2].x + a.x) / 2;
    const startY = i === 1 ? a.y : (pts[i - 2].y + a.y) / 2;
    const endX = (a.x + b.x) / 2;
    const endY = (a.y + b.y) / 2;
    ctx.lineWidth = width(i, travelled, total) * scale;
    ctx.beginPath();
    ctx.moveTo(startX * scale, startY * scale);
    ctx.quadraticCurveTo(a.x * scale, a.y * scale, endX * scale, endY * scale);
    if (i === pts.length - 1) ctx.lineTo(b.x * scale, b.y * scale);
    ctx.stroke();
  }
}

function drawNib(ctx: Ctx, stroke: Stroke, pen: Pen, scale: number) {
  const pts = stroke.points;
  // A broad nib reads best a little wider than a round pen of the same size.
  const half = (pen.size * 1.35) / 2;
  const nx = Math.cos(NIB_ANGLE) * half;
  const ny = Math.sin(NIB_ANGLE) * half;
  const quad = (a: StrokePoint, b: StrokePoint) => {
    ctx.beginPath();
    ctx.moveTo((a.x + nx) * scale, (a.y + ny) * scale);
    ctx.lineTo((b.x + nx) * scale, (b.y + ny) * scale);
    ctx.lineTo((b.x - nx) * scale, (b.y - ny) * scale);
    ctx.lineTo((a.x - nx) * scale, (a.y - ny) * scale);
    ctx.closePath();
    ctx.fill();
  };
  if (pts.length === 1) {
    quad({ ...pts[0], x: pts[0].x - 0.5 }, { ...pts[0], x: pts[0].x + 0.5 });
    return;
  }
  // Densify so fast strokes stay continuous.
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    let prev = a;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const next = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: b.p };
      quad(prev, next);
      prev = next;
    }
  }
}

/**
 * Renders strokes onto a transparent context. Ink strokes paint, eraser
 * strokes cut back through everything beneath them, scanned ink included.
 */
export function renderStrokes(ctx: Ctx, strokes: Stroke[], pen: Pen, scale: number, color: string) {
  ctx.save();
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    if (pen.style === "nib" && !stroke.erase) drawNib(ctx, stroke, pen, scale);
    else drawRound(ctx, stroke, pen, scale);
  }
  ctx.restore();
}

/* --------------------------------------------------------------- masks */

const maskCanvases = new Map<number, OffscreenCanvas | HTMLCanvasElement>();

function scratch(size: number) {
  let canvas = maskCanvases.get(size);
  if (!canvas) {
    if (typeof OffscreenCanvas !== "undefined") canvas = new OffscreenCanvas(size, size);
    else {
      canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
    }
    maskCanvases.set(size, canvas);
  }
  return canvas;
}

/** Paints a scanned mask in ink onto a context, at the given pixel size. */
export function paintMask(ctx: Ctx, mask: Mask, size: number, color: string) {
  const tmp = scratch(mask.size);
  const tctx = tmp.getContext("2d") as Ctx;
  const image = tctx.createImageData(mask.size, mask.size);
  const [r, g, b] = parseColor(color);
  for (let i = 0; i < mask.data.length; i++) {
    image.data[i * 4] = r;
    image.data[i * 4 + 1] = g;
    image.data[i * 4 + 2] = b;
    image.data[i * 4 + 3] = mask.data[i] ? 255 : 0;
  }
  tctx.putImageData(image, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, size, size);
  ctx.restore();
}

function parseColor(color: string): [number, number, number] {
  const hex = color.replace("#", "");
  if (hex.length === 6) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  return [0, 0, 0];
}

/** Scanned ink plus strokes, flattened into one mask for tracing. */
export function glyphMask(strokes: Stroke[], scan: Mask | undefined, pen: Pen): Mask {
  const size = MASK_SIZE;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d")!;
  if (scan) paintMask(ctx, scan, size, "#000000");
  renderStrokes(ctx, strokes, pen, size / 1000, "#000000");
  const { data } = ctx.getImageData(0, 0, size, size);
  const out = new Uint8Array(size * size);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3] > 110 ? 1 : 0;
  return { size, data: out };
}

/* --------------------------------------------------------- persistence */

/** Run-length encodes a mask: alternating runs of 0s and 1s, starting with 0. */
export function encodeMask(mask: Mask): number[] {
  const runs: number[] = [];
  let current = 0;
  let count = 0;
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] === current) count++;
    else {
      runs.push(count);
      current = mask.data[i];
      count = 1;
    }
  }
  runs.push(count);
  return runs;
}

export function decodeMask(runs: number[], size = MASK_SIZE): Mask {
  const data = new Uint8Array(size * size);
  let at = 0;
  runs.forEach((run, i) => {
    if (i % 2) data.fill(1, at, at + run);
    at += run;
  });
  return { size, data };
}
