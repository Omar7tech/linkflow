"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { Reveal } from "@/components/home/reveal";
import { QrArtboard } from "@/components/home/qr-showcase";
import { SITE } from "@/constants/site";
import {
  DEFAULT_QR_OPTIONS,
  type QrEyeStyle,
  type QrModuleStyle,
  type QrOptions,
} from "@/types";

type Shape = { id: QrModuleStyle; eye: QrEyeStyle; label: string };
type Ink = {
  id: string;
  label: string;
  swatch: string;
  fg: string;
  gradient: QrOptions["gradient"];
};

const SHAPES: readonly Shape[] = [
  { id: "square", eye: "square", label: "Square" },
  { id: "rounded", eye: "rounded", label: "Rounded" },
  { id: "dots", eye: "circle", label: "Dots" },
];

/**
 * Fills stay dark-on-white in both themes — the code sits on a print plate, and
 * a light-on-dark inversion is unreliable on a fair share of scanners.
 */
const INKS: readonly Ink[] = [
  {
    id: "ink",
    label: "Ink",
    swatch: "bg-neutral-900",
    fg: "#0a0a0a",
    gradient: null,
  },
  {
    id: "emerald",
    label: "Emerald",
    swatch: "bg-emerald-600",
    fg: "#059669",
    gradient: null,
  },
  {
    id: "fade",
    label: "Fade",
    swatch: "bg-gradient-to-br from-emerald-500 to-emerald-800",
    fg: "#10b981",
    gradient: { type: "linear", from: "#10b981", to: "#047857", angle: 45 },
  },
];

const DEBOUNCE_MS = 180;

/**
 * 3×3 miniature of the module shape — shows the option instead of naming it.
 * Cells are 2 units on a 2.5 step, so the 7×7 viewBox holds the full grid with
 * a hairline gutter between modules and nothing clipped at the edges.
 */
function ShapeGlyph({ shape }: { shape: QrModuleStyle }) {
  const rx = shape === "dots" ? 1 : shape === "rounded" ? 0.65 : 0;
  const cells = [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ];
  return (
    <svg viewBox="0 0 7 7" className="size-4.5 overflow-visible" aria-hidden>
      {cells.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x * 2.5}
          y={y * 2.5}
          width={2}
          height={2}
          rx={rx}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

const SWATCH_BASE =
  "focus-visible:ring-ring/50 flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 focus-visible:ring-3 focus-visible:outline-none";

/**
 * Flagship section: a working QR generator rather than a picture of one.
 * Whatever is typed here renders as a real scannable code and carries over to
 * the full tool through the query string.
 *
 * Source order is copy → code → controls, which is the right reading order on a
 * phone and keeps the code above the keyboard while typing. On large screens
 * explicit grid placement pulls the code into its own column.
 */
export function QrSpotlight() {
  const [draft, setDraft] = React.useState("");
  const [value, setValue] = React.useState("");
  const [shapeId, setShapeId] = React.useState<QrModuleStyle>("rounded");
  const [inkId, setInkId] = React.useState("emerald");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Keep typing latency off the render path; the code catches up a beat later.
  React.useEffect(() => {
    const id = window.setTimeout(() => setValue(draft), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [draft]);

  const shape = SHAPES.find((s) => s.id === shapeId) ?? SHAPES[1];
  const ink = INKS.find((i) => i.id === inkId) ?? INKS[1];
  const trimmed = value.trim();
  const usingFallback = trimmed.length === 0;
  const payload = trimmed || SITE.url;

  const options: QrOptions = React.useMemo(
    () => ({
      ...DEFAULT_QR_OPTIONS,
      size: 640,
      margin: 0,
      transparent: true,
      moduleStyle: shape.id,
      eyeStyle: shape.eye,
      fgColor: ink.fg,
      gradient: ink.gradient,
    }),
    [shape, ink],
  );

  const href = `/tools/qr?v=${encodeURIComponent(payload)}&m=${shape.id}&e=${shape.eye}&c=${ink.id}`;

  return (
    <section
      aria-labelledby="qr-spotlight-heading"
      className="px-4 py-20 sm:px-6 sm:py-28"
    >
      <Reveal className="border-border/70 bg-card/40 relative isolate mx-auto grid w-full max-w-6xl items-center gap-12 overflow-hidden rounded-[2rem] border px-6 py-12 sm:px-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-16">
        {/* One soft light behind the code, nothing else. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-1/3 right-[-10%] -z-10 aspect-square w-[60%] rounded-full bg-[radial-gradient(circle,var(--glow),transparent_65%)] blur-2xl"
        />

        <div>
          <h2
            id="qr-spotlight-heading"
            className="font-heading text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-5xl"
          >
            A QR code you&rsquo;d actually print
            <span className="text-primary">.</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-[42ch] text-base leading-relaxed">
            Type a link and it becomes a working code. Scan it right off the
            screen.
          </p>

          {/* One field, one action. */}
          <div className="bg-background border-border focus-within:border-primary/60 mt-8 flex h-14 items-center gap-2 rounded-full border pr-1.5 pl-5 transition-colors">
            <label htmlFor="qr-spotlight-input" className="sr-only">
              Link or text
            </label>
            <input
              id="qr-spotlight-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              enterKeyHint="done"
              spellCheck={false}
              placeholder={SITE.url.replace(/^https?:\/\//, "")}
              className="placeholder:text-muted-foreground/60 h-full min-w-0 flex-1 bg-transparent text-base outline-none"
            />
            {draft.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear the field"
                className="text-muted-foreground hover:text-foreground grid size-8 shrink-0 cursor-pointer place-items-center rounded-full transition-colors"
              >
                <XIcon className="size-4" aria-hidden />
              </button>
            )}
            <Link
              href={href}
              aria-label="Open it in the QR generator"
              className="bg-primary text-primary-foreground hover:bg-primary/90 group inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors"
            >
              <span className="hidden sm:inline">Make it</span>
              <ArrowRightIcon
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>

          {/* Style, as two quiet groups of swatches. */}
          <div className="mt-5 flex items-center gap-4 pl-1">
            <div
              className="flex gap-1"
              role="radiogroup"
              aria-label="Module shape"
            >
              {SHAPES.map((s) => {
                const on = s.id === shapeId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={s.label}
                    title={s.label}
                    onClick={() => setShapeId(s.id)}
                    className={`${SWATCH_BASE} ${on ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <ShapeGlyph shape={s.id} />
                  </button>
                );
              })}
            </div>
            <span className="bg-border h-5 w-px" aria-hidden />
            <div
              className="flex gap-1"
              role="radiogroup"
              aria-label="Module fill"
            >
              {INKS.map((i) => {
                const on = i.id === inkId;
                return (
                  <button
                    key={i.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={i.label}
                    title={i.label}
                    onClick={() => setInkId(i.id)}
                    className={`${SWATCH_BASE} ${on ? "bg-muted" : "hover:bg-muted/60"}`}
                  >
                    <span
                      className={`size-4 rounded-full ring-1 ring-white/10 ${i.swatch}`}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-muted-foreground/70 mt-4 pl-1 text-xs">
            {usingFallback
              ? "Showing this site as an example."
              : "Static, so it never expires."}{" "}
            Logos, WiFi and vCards are in the full generator.
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <QrArtboard value={payload} options={options} label={payload} />
        </div>
      </Reveal>
    </section>
  );
}
