"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
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

/** 3x3 miniature of the module shape — shows the option instead of naming it. */
function ShapeGlyph({ shape }: { shape: QrModuleStyle }) {
  const rx = shape === "dots" ? 1 : shape === "rounded" ? 0.6 : 0;
  const cells = [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ];
  return (
    <svg viewBox="0 0 5 5" className="size-4.5" aria-hidden>
      {cells.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x * 2}
          y={y * 2}
          width={2}
          height={2}
          rx={rx}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

/**
 * Flagship section: a working QR generator rather than a picture of one.
 * Whatever is typed here renders as a real scannable code and carries over to
 * the full tool through the query string.
 */
export function QrSpotlight() {
  const [draft, setDraft] = React.useState("");
  const [value, setValue] = React.useState("");
  const [shapeId, setShapeId] = React.useState<QrModuleStyle>("rounded");
  const [inkId, setInkId] = React.useState("emerald");

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
      <div className="mx-auto grid w-full max-w-7xl gap-14 px-6 py-20 sm:py-28 lg:grid-cols-12 lg:gap-x-16">
        {/* Copy + controls */}
        <Reveal className="order-2 lg:order-1 lg:col-span-5">
          <p className="text-muted-foreground flex items-center gap-4 font-mono text-[11px] tracking-[0.22em] uppercase">
            QR Code Generator
            <span className="bg-border h-px flex-1" aria-hidden />
          </p>

          <h2
            id="qr-spotlight-heading"
            className="font-heading mt-6 text-4xl leading-[1.03] font-bold tracking-tight sm:text-5xl"
          >
            Type a link.
            <br />
            Style the square<span className="text-primary">.</span>
          </h2>

          <p className="text-muted-foreground mt-5 max-w-[54ch] leading-relaxed">
            The code beside this is real and scannable, not a mockup. Pick a shape and a fill, then
            carry it into the full generator for logos, WiFi and vCard payloads.
          </p>

          {/* Live input */}
          <div className="mt-9">
            <label
              htmlFor="qr-spotlight-input"
              className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase"
            >
              Link or text
            </label>
            <Input
              id="qr-spotlight-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder={SITE.url}
              aria-describedby="qr-spotlight-hint"
              className="mt-2 h-12 rounded-xl px-4 md:text-base"
            />
            <p id="qr-spotlight-hint" className="text-muted-foreground/80 mt-2 text-xs">
              {usingFallback
                ? "Empty, so it encodes this site — start typing to replace it."
                : "Encoded exactly as written, character for character."}
            </p>
          </div>

          {/* Real style controls */}
          <div className="mt-7 flex flex-wrap items-end gap-x-10 gap-y-5">
            <fieldset>
              <legend className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
                Shape
              </legend>
              <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Module shape">
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
                      className={`focus-visible:ring-ring/50 flex size-11 cursor-pointer items-center justify-center rounded-lg border transition-colors duration-200 focus-visible:ring-3 focus-visible:outline-none ${
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
              <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Module fill">
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
                      className={`focus-visible:ring-ring/50 flex size-11 cursor-pointer items-center justify-center rounded-lg border transition-colors duration-200 focus-visible:ring-3 focus-visible:outline-none ${
                        on
                          ? "border-primary/60 bg-primary/10"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <span className={`size-4.5 rounded-full ${i.swatch}`} aria-hidden />
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <Button
            asChild
            size="lg"
            className="group mt-9 h-12 rounded-full px-8 text-base font-semibold"
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

        {/* Live code */}
        <Reveal
          delay={0.1}
          className="order-1 flex justify-center lg:order-2 lg:col-span-6 lg:col-start-7 lg:justify-end lg:self-center"
        >
          <QrArtboard value={payload} options={options} label={payload} />
        </Reveal>
      </div>
    </section>
  );
}
