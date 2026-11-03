"use client";

import * as React from "react";
import { PAD_GUIDES } from "@/lib/font-maker/charset";
import { paintMask, renderStrokes, type Pen, type Stroke, type StrokePoint } from "@/lib/font-maker/strokes";
import type { Mask } from "@/lib/font-maker/trace";

const GUIDES: { y: number; label: string; strong?: boolean }[] = [
  { y: PAD_GUIDES.cap, label: "Capitals" },
  { y: PAD_GUIDES.xHeight, label: "Lowercase" },
  { y: PAD_GUIDES.baseline, label: "Baseline", strong: true },
];

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

/** Draws a glyph's ink (scan + strokes) tinted, onto a context of `size` px. */
export function paintInk(
  ctx: CanvasRenderingContext2D,
  size: number,
  strokes: Stroke[],
  scan: Mask | undefined,
  pen: Pen,
  color: string,
  layer: HTMLCanvasElement
) {
  if (layer.width !== size) {
    layer.width = size;
    layer.height = size;
  }
  const lctx = layer.getContext("2d")!;
  lctx.clearRect(0, 0, size, size);
  if (scan) paintMask(lctx, scan, size, "#000000");
  renderStrokes(lctx, strokes, pen, size / 1000, "#000000");
  lctx.save();
  lctx.globalCompositeOperation = "source-in";
  lctx.fillStyle = color;
  lctx.fillRect(0, 0, size, size);
  lctx.restore();
  ctx.drawImage(layer, 0, 0);
}

interface DrawPadProps {
  char: string;
  strokes: Stroke[];
  scan?: Mask;
  pen: Pen;
  erasing: boolean;
  showGhost: boolean;
  onStroke: (stroke: Stroke) => void;
}

/**
 * The drawing surface: a square with the font's guides, the letter being
 * drawn as a faint hint, and the ink on top. Pen pressure is used when the
 * device reports it; coalesced pointer events keep fast strokes smooth.
 */
export function DrawPad({ char, strokes, scan, pen, erasing, showGhost, onStroke }: DrawPadProps) {
  const wrap = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const layer = React.useRef<HTMLCanvasElement | null>(null);
  const live = React.useRef<Stroke | null>(null);
  const frame = React.useRef(0);
  const [px, setPx] = React.useState(480);

  React.useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setPx(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const render = React.useCallback(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.round(px * dpr);
    if (el.width !== size) {
      el.width = size;
      el.height = size;
    }
    const ctx = el.getContext("2d")!;
    const k = size / 1000;
    ctx.clearRect(0, 0, size, size);

    const muted = cssVar("--muted-foreground");
    const primary = cssVar("--primary");
    const ink = cssVar("--foreground");

    // Descender zone, shaded so it reads as "below the line".
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = ink;
    ctx.fillRect(0, PAD_GUIDES.baseline * k, size, (PAD_GUIDES.descender - PAD_GUIDES.baseline) * k);
    ctx.restore();

    ctx.save();
    ctx.font = `${Math.round(11 * dpr)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "bottom";
    for (const g of GUIDES) {
      ctx.strokeStyle = g.strong ? primary : muted;
      ctx.globalAlpha = g.strong ? 0.7 : 0.35;
      ctx.lineWidth = (g.strong ? 1.5 : 1) * dpr;
      ctx.setLineDash(g.strong ? [] : [6 * dpr, 6 * dpr]);
      ctx.beginPath();
      ctx.moveTo(0, g.y * k);
      ctx.lineTo(size, g.y * k);
      ctx.stroke();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = g.strong ? primary : muted;
      ctx.fillText(g.label, 10 * dpr, g.y * k - 4 * dpr);
    }
    ctx.restore();

    if (showGhost) {
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = `600 ${Math.round(1000 * k)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(char, size / 2, PAD_GUIDES.baseline * k);
      ctx.restore();
    }

    layer.current ??= document.createElement("canvas");
    const all = live.current ? [...strokes, live.current] : strokes;
    paintInk(ctx, size, all, scan, pen, ink, layer.current);
  }, [px, strokes, scan, pen, char, showGhost]);

  React.useEffect(() => {
    render();
  }, [render]);

  const point = (event: PointerEvent | React.PointerEvent): StrokePoint => {
    const rect = canvas.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1000,
      y: ((event.clientY - rect.top) / rect.height) * 1000,
      p: event.pointerType === "pen" && event.pressure > 0 ? event.pressure : 0.5,
    };
  };

  const schedule = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(render);
  };

  return (
    <div ref={wrap} className="relative w-full">
      <canvas
        ref={canvas}
        aria-label={`Drawing area for ${char}`}
        className="block aspect-square w-full cursor-crosshair touch-none rounded-xl"
        style={{ height: px }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Some pointers (and synthetic events) cannot be captured; drawing still works.
          }
          live.current = { points: [point(event)], erase: erasing || undefined };
          schedule();
        }}
        onPointerMove={(event) => {
          const stroke = live.current;
          if (!stroke) return;
          const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
          const events = coalesced.length ? coalesced : [event.nativeEvent];
          for (const e of events) {
            const p = point(e);
            const last = stroke.points[stroke.points.length - 1];
            if (Math.hypot(p.x - last.x, p.y - last.y) >= 2) stroke.points.push(p);
          }
          schedule();
        }}
        onPointerUp={() => {
          const stroke = live.current;
          live.current = null;
          if (stroke) onStroke(stroke);
        }}
        onPointerCancel={() => {
          live.current = null;
          schedule();
        }}
      />
    </div>
  );
}
