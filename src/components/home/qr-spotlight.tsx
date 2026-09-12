"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/home/reveal";
import { QrArtboard } from "@/components/home/qr-showcase";
import { SITE } from "@/constants/site";
import { DEFAULT_QR_OPTIONS, type QrEyeStyle, type QrModuleStyle, type QrOptions } from "@/types";

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
  { id: "ink", label: "Ink", swatch: "bg-neutral-900", fg: "#0a0a0a", gradient: null },
  { id: "emerald", label: "Emerald", swatch: "bg-emerald-600", fg: "#059669", gradient: null },
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
  "focus-visible:ring-ring/50 flex size-11 cursor-pointer items-center justify-center rounded-lg border transition-colors duration-200 focus-visible:ring-3 focus-visible:outline-none";

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
    [shape, ink]
  );

  const href = `/tools/qr?v=${encodeURIComponent(payload)}&m=${shape.id}&e=${shape.eye}&c=${ink.id}`;

  return (
    <section aria-labelledby="qr-spotlight-heading" className="border-border/70 border-t">
      <div className="mx-auto grid w-full max-w-7xl gap-y-8 px-6 py-14 sm:py-20 lg:grid-cols-12 lg:gap-x-14">
        {/* Copy */}
        <Reveal className="lg:col-span-5 lg:row-start-1 lg:self-end">
          <p className="text-muted-foreground flex items-center gap-4 font-mono text-[11px] tracking-[0.22em] uppercase">
            QR Code Generator
            <span className="bg-border h-px flex-1" aria-hidden />
          </p>

          <h2
            id="qr-spotlight-heading"
            className="font-heading mt-5 text-[2rem] leading-[1.05] font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]"
          >
            Type a link.
            <br />
            Style the square<span className="text-primary">.</span>
          </h2>

          <p className="text-muted-foreground mt-4 max-w-[48ch] text-sm leading-relaxed sm:text-base">
            Real and scannable, generated right here. Pick a shape and a fill, then take it into the
            full generator for logos, WiFi and vCards.
          </p>
        </Reveal>

        {/* Live code */}
        <Reveal
          delay={0.05}
          className="flex justify-center lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:justify-end lg:self-center"
        >
          <QrArtboard value={payload} options={options} label={payload} />
        </Reveal>

        {/* Controls */}
        <Reveal delay={0.1} className="lg:col-span-5 lg:row-start-2 lg:self-start">
          <label
            htmlFor="qr-spotlight-input"
            className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase"
          >
            Link or text
          </label>
          <div className="relative mt-2">
            <Input
              id="qr-spotlight-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              enterKeyHint="done"
              spellCheck={false}
              placeholder={SITE.url}
              aria-describedby="qr-spotlight-hint"
              className="h-12 rounded-xl px-4 pr-12 md:text-base"
            />
            {draft.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear the field"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-xl transition-colors focus-visible:ring-3 focus-visible:outline-none"
              >
                <XIcon className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <p id="qr-spotlight-hint" className="text-muted-foreground/80 mt-2 text-xs">
            {usingFallback ? "Encoding this site until you type." : "Encoded exactly as written."}
          </p>

          <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4">
            <fieldset>
              <legend className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
                Shape
              </legend>
              <div className="mt-1.5 flex gap-1.5" role="radiogroup" aria-label="Module shape">
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
                      className={`${SWATCH_BASE} ${
                        on
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      }`}
                    >
                      <ShapeGlyph shape={s.id} />
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
                Fill
              </legend>
              <div className="mt-1.5 flex gap-1.5" role="radiogroup" aria-label="Module fill">
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
                      className={`${SWATCH_BASE} ${
                        on
                          ? "border-primary/60 bg-primary/10"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <span className={`size-4 rounded-full ${i.swatch}`} aria-hidden />
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <Button
            asChild
            size="lg"
            className="group mt-6 h-12 w-full rounded-full px-8 font-semibold sm:w-auto"
          >
            <Link href={href}>
              Open in the generator
              <ArrowRightIcon
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
