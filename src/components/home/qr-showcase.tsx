"use client";

import * as React from "react";
import styles from "./qr-showcase.module.css";

/** Small deterministic PRNG so the decorative matrix is identical on server + client. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIZE = 25;
const CENTER = (SIZE - 1) / 2; // 12
const LOGO_HALF = 3; // clears a 7×7 hole for the centre chip

const FINDERS = [
  [0, 0],
  [SIZE - 7, 0],
  [0, SIZE - 7],
] as const;

function inFinder(x: number, y: number) {
  // 7×7 finder plus a 1-module separator around it
  return FINDERS.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
}

function inLogo(x: number, y: number) {
  return Math.abs(x - CENTER) <= LOGO_HALF && Math.abs(y - CENTER) <= LOGO_HALF;
}

/**
 * Decorative (non-scannable) data modules. `delay` ripples the morph outward
 * from the centre so switching styles reads as one wave, not a hard cut.
 */
const MODULES: { x: number; y: number; delay: number }[] = (() => {
  const rng = mulberry32(20260727);
  const out: { x: number; y: number; delay: number }[] = [];
  const maxDist = Math.hypot(CENTER, CENTER);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (inFinder(x, y) || inLogo(x, y)) continue;
      if (rng() > 0.52) {
        const delay = (Math.hypot(x - CENTER, y - CENTER) / maxDist) * 300;
        out.push({ x, y, delay: Math.round(delay) });
      }
    }
  }
  return out;
})();

type Preset = {
  id: string;
  label: string;
  /** Custom properties handed to the artboard; see qr-showcase.module.css. */
  vars: Record<string, string | number>;
};

const PRESETS: readonly Preset[] = [
  {
    id: "dots",
    label: "Dots",
    vars: {
      "--m-rx": 0.5,
      "--m-scale": 0.74,
      "--e-outer": 3.4,
      "--e-mid": 2.4,
      "--e-dot": 1.4,
      "--qr-a": "#34d399",
      "--qr-b": "#0d9488",
    },
  },
  {
    id: "soft",
    label: "Soft",
    vars: {
      "--m-rx": 0.3,
      "--m-scale": 0.9,
      "--e-outer": 2,
      "--e-mid": 1.4,
      "--e-dot": 0.9,
      "--qr-a": "#6ee7b7",
      "--qr-b": "#059669",
    },
  },
  {
    id: "sharp",
    label: "Sharp",
    vars: {
      "--m-rx": 0,
      "--m-scale": 1,
      "--e-outer": 0,
      "--e-mid": 0,
      "--e-dot": 0,
      "--qr-a": "#10b981",
      "--qr-b": "#047857",
    },
  },
  {
    id: "mono",
    label: "Mono",
    vars: {
      "--m-rx": 0.16,
      "--m-scale": 0.82,
      "--e-outer": 0.9,
      "--e-mid": 0.6,
      "--e-dot": 0.4,
      "--qr-a": "#065f46",
      "--qr-b": "#065f46",
    },
  },
] as const;

const CYCLE_MS = 3800;

function Finder({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect
        className={styles.eyeOuter}
        x={x + 0.12}
        y={y + 0.12}
        width={6.76}
        height={6.76}
        fill="url(#qr-grad)"
      />
      <rect
        className={styles.eyeMid}
        x={x + 1.12}
        y={y + 1.12}
        width={4.76}
        height={4.76}
        fill="var(--background)"
      />
      <rect
        className={styles.eyeDot}
        x={x + 2.12}
        y={y + 2.12}
        width={2.76}
        height={2.76}
        fill="url(#qr-grad)"
      />
    </g>
  );
}

/** Hairline crop mark, print-plate style. */
function CropMark({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`border-foreground/25 pointer-events-none absolute size-3.5 ${className}`}
    />
  );
}

/**
 * Flagship QR visual: a frameless SVG matrix on a hairline artboard that
 * morphs between style presets. Auto-cycles until the visitor takes over.
 */
export function QrShowcase() {
  const [index, setIndex] = React.useState(0);
  const [auto, setAuto] = React.useState(true);

  React.useEffect(() => {
    if (!auto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % PRESETS.length), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [auto]);

  const active = PRESETS[index];

  return (
    <div className="w-full max-w-md">
      {/* Artboard */}
      <div
        className={`${styles.artboard} border-border/70 relative aspect-square rounded-sm border p-[7%]`}
        style={active.vars as React.CSSProperties}
      >
        <CropMark className="-top-px -left-px border-t border-l" />
        <CropMark className="-top-px -right-px border-t border-r" />
        <CropMark className="-bottom-px -left-px border-b border-l" />
        <CropMark className="-right-px -bottom-px border-r border-b" />

        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full" aria-hidden>
          <defs>
            <linearGradient id="qr-grad" x1="0" y1="0" x2="1" y2="1">
              <stop className={styles.stopA} offset="0%" />
              <stop className={styles.stopB} offset="100%" />
            </linearGradient>
          </defs>
          {FINDERS.map(([fx, fy]) => (
            <Finder key={`${fx}-${fy}`} x={fx} y={fy} />
          ))}
          {MODULES.map(({ x, y, delay }) => (
            <rect
              key={`${x}-${y}`}
              className={styles.module}
              x={x}
              y={y}
              width={1}
              height={1}
              fill="url(#qr-grad)"
              style={{ transitionDelay: `${delay}ms` }}
            />
          ))}
        </svg>

        {/* Centre logo chip — the overlay slot, holding the Forma mark */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="ring-background flex size-[17%] items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg ring-4">
            <span className="font-heading text-xl leading-none font-bold text-white sm:text-2xl">
              f<span className="text-emerald-200">.</span>
            </span>
          </div>
        </div>
      </div>

      {/* Style rail */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-x-5 gap-y-2" role="group" aria-label="QR style preset">
          {PRESETS.map((preset, i) => {
            const on = i === index;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setIndex(i);
                  setAuto(false);
                }}
                className={`after:bg-primary relative cursor-pointer pb-1.5 font-mono text-[11px] tracking-[0.18em] uppercase transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:transition-transform after:duration-300 ${
                  on
                    ? "text-foreground after:scale-x-100"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground/70 shrink-0 pb-1.5 font-mono text-[11px] tracking-[0.18em] uppercase">
          SVG · PNG
        </p>
      </div>
    </div>
  );
}
