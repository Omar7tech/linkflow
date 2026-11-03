"use client";

import * as React from "react";
import { assembleFont, type BuiltFont, type ShapeSettings } from "@/lib/font-maker/build";
import { glyphMask, type Pen, type Stroke } from "@/lib/font-maker/strokes";
import { adjustWeight, inkRatio, traceMask, type Mask, type TracedContour } from "@/lib/font-maker/trace";

export interface SlotData {
  strokes: Stroke[];
  scan?: Mask;
  /** Bumped on every change, so traces can be cached per letter. */
  rev: number;
}

export const hasInk = (slot: SlotData | undefined) => !!slot && (slot.strokes.some((s) => !s.erase) || !!slot.scan);

export interface BuildState {
  status: "empty" | "building" | "ready" | "error";
  progress: number;
  font: BuiltFont | null;
  /** CSS family name the live preview can use. */
  family: string | null;
  error?: string;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
let faceCounter = 0;

/**
 * Rebuilds the font shortly after anything changes. Tracing is the slow part,
 * so traced outlines are cached per letter and only redone for letters whose
 * drawing, pen or weight changed; the rest of the build takes milliseconds.
 */
export function useFontBuild(
  slots: Record<string, SlotData>,
  pen: Pen,
  weight: number,
  shape: ShapeSettings,
  name: string
): BuildState {
  const cache = React.useRef(new Map<string, { sig: string; contours: TracedContour[] }>());
  const face = React.useRef<FontFace | null>(null);
  const [state, setState] = React.useState<BuildState>({ status: "empty", progress: 0, font: null, family: null });
  const shapeKey = JSON.stringify(shape);

  React.useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const keys = Object.keys(slots).filter((key) => hasInk(slots[key]));
      if (!keys.length) {
        setState({ status: "empty", progress: 0, font: null, family: null });
        return;
      }
      const shapeSettings = JSON.parse(shapeKey) as ShapeSettings;
      const stale = keys.filter((key) => {
        const sig = `${slots[key].rev}|${pen.style}|${pen.size}|${weight}`;
        return cache.current.get(key)?.sig !== sig;
      });

      if (stale.length) setState((s) => ({ ...s, status: "building", progress: 0 }));
      try {
        for (let i = 0; i < stale.length; i++) {
          const key = stale[i];
          const slot = slots[key];
          const mask = adjustWeight(glyphMask(slot.strokes, slot.scan, pen), weight);
          const contours = inkRatio(mask) > 0 ? await traceMask(mask) : [];
          if (cancelled) return;
          cache.current.set(key, { sig: `${slot.rev}|${pen.style}|${pen.size}|${weight}`, contours });
          if (i % 4 === 3) {
            setState((s) => ({ ...s, progress: (i + 1) / stale.length }));
            await tick();
            if (cancelled) return;
          }
        }
        for (const key of cache.current.keys()) if (!keys.includes(key)) cache.current.delete(key);

        const traced = new Map(keys.map((key) => [key, cache.current.get(key)!.contours]));
        const font = assembleFont(traced, name.trim() || "My Handwriting", shapeSettings);
        if (!font) {
          setState({ status: "empty", progress: 0, font: null, family: null });
          return;
        }

        // Load it for the preview. The browser's font sanitiser rejects
        // anything malformed, so this doubles as a validity check.
        const family = `FontMakerPreview${++faceCounter}`;
        const next = new FontFace(family, font.ttf.slice().buffer);
        await next.load();
        if (cancelled) return;
        document.fonts.add(next);
        if (face.current) document.fonts.delete(face.current);
        face.current = next;
        setState({ status: "ready", progress: 1, font, family });
      } catch (error) {
        if (!cancelled)
          setState((s) => ({ ...s, status: "error", error: (error as Error).message || "The font could not be built." }));
      }
    }, 380);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slots, pen, weight, shapeKey, name]);

  React.useEffect(
    () => () => {
      if (face.current) document.fonts.delete(face.current);
    },
    []
  );

  return state;
}
