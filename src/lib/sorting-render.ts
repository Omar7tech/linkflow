/**
 * Sorting Lab renderers. Five ways to look at the same array state, all drawn
 * to a canvas rather than to DOM nodes — a few hundred elements repainting at
 * 60fps is nothing for a canvas and death for a few hundred divs.
 *
 * Each renderer is a pure function of `PlayerState`, so the picture is fully
 * determined by where the scrubber sits.
 */

import type { PlayerState } from "./sorting";

export type ViewId = "bars" | "rainbow" | "dots" | "radial" | "spiral";

export const VIEWS: { id: ViewId; label: string; hint: string }[] = [
  { id: "bars", label: "Bars", hint: "the classic — height is value" },
  { id: "rainbow", label: "Rainbow", hint: "hue is value; sorted looks like a spectrum" },
  { id: "dots", label: "Dots", hint: "a scatter plot of position against value" },
  { id: "radial", label: "Radial", hint: "bars wrapped into a circle" },
  { id: "spiral", label: "Spiral", hint: "value as distance from the centre" },
];

export interface Palette {
  background: string;
  idle: string;
  compare: string;
  write: string;
  sorted: string;
  pivot: string;
  range: string;
  axis: string;
}

export const PALETTES: Record<"light" | "dark", Palette> = {
  dark: {
    background: "transparent",
    idle: "#3f5a54",
    compare: "#fbbf24",
    write: "#fb7185",
    sorted: "#34d399",
    pivot: "#c084fc",
    range: "rgba(52, 211, 153, 0.07)",
    axis: "rgba(255,255,255,0.10)",
  },
  light: {
    background: "transparent",
    idle: "#94a3b8",
    compare: "#d97706",
    write: "#e11d48",
    sorted: "#059669",
    pivot: "#7c3aed",
    range: "rgba(5, 150, 105, 0.08)",
    axis: "rgba(15,23,42,0.10)",
  },
};

/** Colour for one element, in priority order: compare beats sorted beats idle. */
function colorFor(state: PlayerState, index: number, p: Palette): string {
  if (index === state.a || index === state.b) return index === state.written ? p.write : p.compare;
  if (index === state.pivot) return p.pivot;
  if (state.sorted[index]) return p.sorted;
  return p.idle;
}

/** Sorted elements fade to the accent; everything else stays quiet. */
function hueFor(state: PlayerState, index: number, value: number, max: number, p: Palette): string {
  if (index === state.a || index === state.b) return index === state.written ? p.write : p.compare;
  return `hsl(${Math.round((value / max) * 300)} 78% 58%)`;
}

export interface RenderOptions {
  state: PlayerState;
  view: ViewId;
  palette: Palette;
  /** CSS pixel size of the canvas; the caller handles devicePixelRatio. */
  width: number;
  height: number;
  /** Hides the range band and pivot marks in the small race tiles. */
  compact?: boolean;
}

export function renderView(ctx: CanvasRenderingContext2D, options: RenderOptions) {
  const { state, view, palette, width, height } = options;
  ctx.clearRect(0, 0, width, height);
  const n = state.values.length;
  if (!n) return;
  const max = Math.max(1, ...state.values);

  // The band showing which sub-array is being worked on — merge and quicksort
  // are much easier to follow with it.
  if (!options.compact && state.rangeLo >= 0 && state.rangeHi >= state.rangeLo && view !== "radial" && view !== "spiral") {
    const slot = width / n;
    ctx.fillStyle = palette.range;
    ctx.fillRect(state.rangeLo * slot, 0, (state.rangeHi - state.rangeLo + 1) * slot, height);
  }

  switch (view) {
    case "bars":
    case "rainbow": {
      const slot = width / n;
      const barWidth = Math.max(1, slot - Math.min(2, slot * 0.18));
      const radius = barWidth > 6 ? Math.min(3, barWidth / 3) : 0;
      for (let i = 0; i < n; i++) {
        const value = state.values[i];
        const h = Math.max(2, (value / max) * (height - 4));
        const x = i * slot + (slot - barWidth) / 2;
        const y = height - h;
        ctx.fillStyle =
          view === "rainbow" ? hueFor(state, i, value, max, palette) : colorFor(state, i, palette);
        if (radius > 0) {
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, h, [radius, radius, 0, 0]);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barWidth, h);
        }
      }
      break;
    }

    case "dots": {
      const slot = width / n;
      const r = Math.max(1.2, Math.min(5, slot * 0.42));
      for (let i = 0; i < n; i++) {
        const value = state.values[i];
        const x = i * slot + slot / 2;
        const y = height - (value / max) * (height - r * 2) - r;
        ctx.fillStyle = colorFor(state, i, palette);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case "radial": {
      const cx = width / 2;
      const cy = height / 2;
      const inner = Math.min(width, height) * 0.16;
      const outer = Math.min(width, height) * 0.47;
      const step = (Math.PI * 2) / n;
      for (let i = 0; i < n; i++) {
        const value = state.values[i];
        const len = inner + (value / max) * (outer - inner);
        const start = i * step - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, (inner + len) / 2, start, start + step * 0.92);
        ctx.strokeStyle = colorFor(state, i, palette);
        ctx.lineWidth = Math.max(1, len - inner);
        ctx.stroke();
      }
      break;
    }

    case "spiral": {
      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.min(width, height) * 0.46;
      const turns = 3;
      ctx.lineWidth = Math.max(1.2, maxR / n * 2.2);
      ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const f = i / n;
        const angle = f * Math.PI * 2 * turns - Math.PI / 2;
        // Distance from the centre carries the value; the spiral carries order.
        const base = maxR * (0.22 + f * 0.5);
        const r = base + (state.values[i] / max) * maxR * 0.26;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * base * 0.98, cy + Math.sin(angle) * base * 0.98);
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        ctx.strokeStyle = colorFor(state, i, palette);
        ctx.stroke();
      }
      break;
    }
  }
}

/**
 * Maps a value to a pitch for the optional audio. A pentatonic scale keeps a
 * few thousand comparisons from sounding like an alarm.
 */
const PENTATONIC = [0, 2, 4, 7, 9];

export function frequencyFor(value: number, max: number): number {
  const position = Math.min(0.999, Math.max(0, value / Math.max(1, max)));
  const index = Math.floor(position * 25);
  const octave = Math.floor(index / PENTATONIC.length);
  const semitone = PENTATONIC[index % PENTATONIC.length] + octave * 12;
  return 196 * Math.pow(2, semitone / 12);
}
