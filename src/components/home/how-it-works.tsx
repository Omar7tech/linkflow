"use client";

import * as React from "react";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  PaletteIcon,
  QrCodeIcon,
  TypeIcon,
} from "lucide-react";
import { Reveal } from "@/components/home/reveal";
import styles from "./how-it-works.module.css";

const STEPS = [
  {
    title: "Open a tool",
    text: "Pick one from the list. Nothing to install, no account to make, no setup.",
  },
  {
    title: "Start typing",
    text: "The answer appears as you type. There is no button to press and nothing to wait for.",
  },
  {
    title: "Take it with you",
    text: "Copy it or download it. No watermark, no expiry, no asking for your email first.",
  },
];

/** How long each step holds before the demo moves on. */
const DWELL = 5200;
const TYPE_MS = 62;

const SAMPLE = "Everyday tools for developers and designers";

/**
 * Counted for real on every keystroke rather than faked, and deliberately not
 * tied to any one tool: numbers moving per character is the clearest proof of
 * the claim the step is making.
 */
function statsFor(value: string) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return [
    { label: "Words", value: String(words) },
    { label: "Characters", value: String(value.length) },
    { label: "Read time", value: `${Math.max(words ? 1 : 0, Math.round((words / 200) * 60))} sec` },
  ];
}

/** Friendly names, not tool ids: the point is that anyone can read the list. */
const PICKER = [
  { icon: QrCodeIcon, label: "QR code" },
  { icon: PaletteIcon, label: "Color palette" },
  { icon: ImageIcon, label: "Remove a background" },
  { icon: TypeIcon, label: "Count some text" },
];

/** The one the next two steps go on to use, so the demo tells one story. */
const PICKED = 3;

/** A plain sentence under the panel, so nobody has to infer what they are
    looking at. Sentence case, no jargon, no mono. */
const CAPTIONS = [
  "Ten kinds of tool. Pick one.",
  "Type anything. The answer keeps up, letter by letter.",
  "Yours to keep, in one click.",
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground/70 font-mono text-[10px] tracking-[0.2em] uppercase">
        {label}
      </p>
      <div className="border-border/70 bg-background mt-2 flex h-11 items-center rounded-lg border px-3.5 font-mono text-sm">
        {children}
      </div>
    </div>
  );
}

function Stats({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <div>
      <p className="text-muted-foreground/70 font-mono text-[10px] tracking-[0.2em] uppercase">
        You get
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border-border/70 bg-background rounded-lg border px-3 py-2.5"
          >
            <p className="text-primary font-heading text-xl font-semibold tabular-nums">
              {stat.value}
            </p>
            <p className="text-muted-foreground/70 mt-0.5 text-[11px]">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The demo itself. Remounted on every step change (via `key`), so each step
 * starts its own animation from zero without a reset effect.
 */
function Stage({ step }: { step: number }) {
  const [typed, setTyped] = React.useState(0);
  const [copied, setCopied] = React.useState(false);

  // Type the sample in one character at a time. Reduced motion fills it in a
  // single tick rather than skipping the state entirely.
  React.useEffect(() => {
    if (step !== 1) return;
    const reduced = prefersReducedMotion();
    const id = window.setInterval(
      () => setTyped((n) => Math.min(reduced ? SAMPLE.length : n + 1, SAMPLE.length)),
      reduced ? 0 : TYPE_MS
    );
    return () => window.clearInterval(id);
  }, [step]);

  React.useEffect(() => {
    if (step !== 2) return;
    const id = window.setTimeout(() => setCopied(true), 1100);
    return () => window.clearTimeout(id);
  }, [step]);

  const input = step === 1 ? SAMPLE.slice(0, typed) : SAMPLE;
  const stats = statsFor(input);

  return (
    <div className={`${styles.stage} flex h-full flex-col`}>
      {step === 0 && (
        <div className="flex flex-1 flex-col justify-center gap-1">
          {PICKER.map(({ icon: Icon, label }, i) => (
            <div
              key={label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                i === PICKED
                  ? "bg-primary/10 text-foreground font-medium"
                  : "text-muted-foreground/60"
              }`}
            >
              <Icon
                className={`size-4 shrink-0 ${i === PICKED ? "text-primary" : ""}`}
                aria-hidden
                strokeWidth={1.75}
              />
              {label}
              {i === PICKED && (
                <span className="bg-primary ml-auto size-1.5 rounded-full" aria-hidden />
              )}
            </div>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-1 flex-col justify-center gap-5">
          <Field label="You type">
            <span className="truncate">{input}</span>
            <span className={`${styles.caret} bg-primary ml-0.5 inline-block h-4 w-px`} aria-hidden />
          </Field>
          <Stats stats={stats} />
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-1 flex-col justify-center gap-5">
          <Stats stats={stats} />
          <div className="flex gap-2">
            <span
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-[13px] font-medium transition-colors ${
                copied
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground"
              }`}
            >
              {copied ? (
                <CheckIcon className="size-3.5" aria-hidden />
              ) : (
                <CopyIcon className="size-3.5" aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </span>
            <span className="border-border/70 text-muted-foreground flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-[13px] font-medium">
              <DownloadIcon className="size-3.5" aria-hidden />
              Download
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Rather than describing the workflow in three paragraphs, the section runs it:
 * a tool gets picked, text types itself and transforms live, the result gets
 * copied. Auto-advances, pauses on hover, and any step can be clicked.
 */
export function HowItWorks() {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused || prefersReducedMotion()) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % STEPS.length), DWELL);
    return () => window.clearInterval(id);
  }, [paused, active]);

  return (
    <section className="border-border/70 border-t" aria-labelledby="how-heading">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <Reveal>
          <p className="text-muted-foreground/70 text-xs font-medium tracking-wide">How it works</p>
          <h2 id="how-heading" className="font-heading mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            It takes about ten seconds
            <span className="text-primary">.</span>
          </h2>
        </Reveal>

        <div
          className="mt-12 grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Steps */}
          <Reveal>
            <ol>
              {STEPS.map((step, i) => {
                const on = i === active;
                return (
                  <li key={step.title}>
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      aria-current={on ? "step" : undefined}
                      className="flex w-full cursor-pointer gap-5 py-4 text-left"
                    >
                      {/* Rail doubles as the dwell timer for the active step */}
                      <span className="bg-border relative w-px shrink-0 self-stretch" aria-hidden>
                        {on && (
                          <span
                            key={active}
                            className={`${styles.rail} bg-primary absolute inset-0 ${
                              paused ? styles.paused : ""
                            }`}
                            style={{ animationDuration: `${DWELL}ms` }}
                          />
                        )}
                      </span>

                      <span className="min-w-0">
                        <span
                          className={`font-heading text-xl font-semibold tracking-tight transition-colors sm:text-2xl ${
                            on ? "text-foreground" : "text-muted-foreground/50"
                          }`}
                        >
                          {step.title}
                        </span>
                        <span
                          className={`mt-1.5 block max-w-sm text-[13px] leading-relaxed transition-colors ${
                            on ? "text-muted-foreground" : "text-muted-foreground/40"
                          }`}
                        >
                          {step.text}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Reveal>

          {/* Live demo */}
          <Reveal delay={0.1}>
            <div className="border-border/60 bg-card rounded-2xl border p-5 sm:p-6">
              <p className="text-muted-foreground/70 mb-5 text-[13px]">{CAPTIONS[active]}</p>
              {/* Fixed height so the three states never shift the layout */}
              <div className="h-56">
                <Stage key={active} step={active} />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
