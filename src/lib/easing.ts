/**
 * Easing math for the Motion Studio: cubic-bezier helpers plus a spring
 * physics solver that turns mass/stiffness/damping into a CSS `linear()`
 * easing function — the modern way to ship springy motion to plain CSS.
 */

export type Bezier = [number, number, number, number];

export interface BezierPreset {
  id: string;
  name: string;
  value: Bezier;
}

/** Curated cubic-bezier presets — the everyday ones plus a few with character. */
export const BEZIER_PRESETS: BezierPreset[] = [
  { id: "ease", name: "Ease", value: [0.25, 0.1, 0.25, 1] },
  { id: "ease-in", name: "Ease in", value: [0.42, 0, 1, 1] },
  { id: "ease-out", name: "Ease out", value: [0, 0, 0.58, 1] },
  { id: "ease-in-out", name: "Ease in-out", value: [0.42, 0, 0.58, 1] },
  { id: "standard", name: "Material standard", value: [0.4, 0, 0.2, 1] },
  { id: "decelerate", name: "Material decelerate", value: [0, 0, 0.2, 1] },
  { id: "emphasized", name: "Emphasized", value: [0.2, 0, 0, 1] },
  { id: "snappy", name: "Snappy", value: [0.5, 0, 0, 1] },
  { id: "back-out", name: "Back out (overshoot)", value: [0.34, 1.56, 0.64, 1] },
  { id: "anticipate", name: "Anticipate", value: [0.36, 0, 0.66, -0.56] },
];

/** Format a bezier as a `cubic-bezier(...)` string, trimming trailing zeros. */
export function bezierToCss(b: Bezier): string {
  return `cubic-bezier(${b.map((n) => trim(n)).join(", ")})`;
}

/** SVG path `d` for the curve, mapped into a [pad, size-pad] box (y flipped). */
export function bezierPath([x1, y1, x2, y2]: Bezier, size: number, pad: number): string {
  const inner = size - pad * 2;
  const mx = (u: number) => pad + u * inner;
  const my = (u: number) => pad + (1 - u) * inner;
  return `M ${mx(0)} ${my(0)} C ${mx(x1)} ${my(y1)}, ${mx(x2)} ${my(y2)}, ${mx(1)} ${my(1)}`;
}

/* ------------------------------- Springs -------------------------------- */

export interface Spring {
  /** Mass of the object. Heavier = slower to start and stop. */
  mass: number;
  /** Spring stiffness (tension). Higher = faster, snappier. */
  stiffness: number;
  /** Damping (friction). Lower = more bounce; high enough = no overshoot. */
  damping: number;
}

export interface SpringPreset {
  id: string;
  name: string;
  value: Spring;
}

/** react-spring / Framer-style presets, with mass normalised to 1. */
export const SPRING_PRESETS: SpringPreset[] = [
  { id: "default", name: "Default", value: { mass: 1, stiffness: 170, damping: 26 } },
  { id: "gentle", name: "Gentle", value: { mass: 1, stiffness: 120, damping: 14 } },
  { id: "wobbly", name: "Wobbly", value: { mass: 1, stiffness: 180, damping: 12 } },
  { id: "stiff", name: "Stiff", value: { mass: 1, stiffness: 210, damping: 20 } },
  { id: "slow", name: "Slow", value: { mass: 1, stiffness: 280, damping: 60 } },
  { id: "molasses", name: "Molasses", value: { mass: 1, stiffness: 280, damping: 120 } },
  { id: "bouncy", name: "Bouncy", value: { mass: 1, stiffness: 600, damping: 15 } },
];

export interface SpringResult {
  /** Suggested duration in ms — how long until the spring settles. */
  duration: number;
  /** How far past the target it overshoots (0 = none), as a fraction. */
  overshoot: number;
  /** Whether the spring oscillates past the target at all. */
  bouncy: boolean;
  /** Evenly time-spaced position samples in [0,1+] for plotting. */
  samples: number[];
  /** A ready-to-use CSS `linear()` easing function. */
  linear: string;
}

/**
 * Numerically integrate a damped spring from 0 → 1 and read back its motion.
 * Runs at a fine fixed step for accuracy, then resamples to even time stops.
 */
export function solveSpring(spring: Spring, stops = 28): SpringResult {
  const { mass, stiffness, damping } = spring;
  const dt = 1 / 600;
  const maxT = 12;
  const restDelta = 0.0005;
  const restSpeed = 0.0005;

  const target = 1;
  let p = 0;
  let v = 0;
  let t = 0;
  let overshoot = 0;
  const trace: number[] = [0];

  // Semi-implicit Euler — stable for stiff springs at this step size.
  while (t < maxT) {
    const springForce = -stiffness * (p - target);
    const dampingForce = -damping * v;
    const a = (springForce + dampingForce) / mass;
    v += a * dt;
    p += v * dt;
    t += dt;
    trace.push(p);
    if (p - target > overshoot) overshoot = p - target;
    if (Math.abs(target - p) < restDelta && Math.abs(v) < restSpeed) break;
  }

  // Resample the fine trace to evenly spaced time stops for linear().
  const samples: number[] = [];
  const last = trace.length - 1;
  for (let i = 0; i <= stops; i++) {
    const idx = Math.round((i / stops) * last);
    samples.push(trace[idx]);
  }
  samples[0] = 0;
  samples[samples.length - 1] = 1;

  // Evenly spaced points let linear() distribute them automatically.
  const linear = `linear(${samples.map((n) => trim(Number(n.toFixed(4)))).join(", ")})`;

  return {
    duration: Math.round(t * 1000),
    overshoot,
    bouncy: overshoot > 0.001,
    samples,
    linear,
  };
}

/** SVG path `d` for an array of evenly time-spaced samples (y flipped). */
export function samplesPath(samples: number[], size: number, pad: number): string {
  const inner = size - pad * 2;
  const n = samples.length - 1;
  return samples
    .map((s, i) => {
      const x = pad + (i / n) * inner;
      const y = pad + (1 - s) * inner;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

/* -------------------------------- Export -------------------------------- */

export interface MotionExport {
  /** The CSS timing-function value: cubic-bezier(...) or linear(...). */
  timing: string;
  duration: number;
  /** Spring config, present only in spring mode (for the JS export). */
  spring?: Spring;
  /** Bezier control points, present only in bezier mode (for the JS export). */
  bezier?: Bezier;
}

export function toCss({ timing, duration }: MotionExport): string {
  return [
    ":root {",
    `  --ease: ${timing};`,
    `  --duration: ${duration}ms;`,
    "}",
    "",
    ".element {",
    "  transition: transform var(--duration) var(--ease);",
    "}",
  ].join("\n");
}

export function toTailwind({ timing, duration }: MotionExport): string {
  // Tailwind arbitrary values turn spaces into underscores.
  const ease = timing.replace(/,\s*/g, ",").replace(/\s/g, "_");
  return `class="transition-transform duration-[${duration}ms] ease-[${ease}]"`;
}

export function toJs(ex: MotionExport): string {
  if (ex.spring) {
    const { mass, stiffness, damping } = ex.spring;
    return [
      "// Framer Motion",
      "const transition = {",
      '  type: "spring",',
      `  stiffness: ${stiffness},`,
      `  damping: ${damping},`,
      `  mass: ${mass},`,
      "};",
    ].join("\n");
  }
  const b = ex.bezier ?? [0.25, 0.1, 0.25, 1];
  return [
    "// Framer Motion",
    "const transition = {",
    `  duration: ${(ex.duration / 1000).toFixed(2)},`,
    `  ease: [${b.map((n) => trim(n)).join(", ")}],`,
    "};",
  ].join("\n");
}

/** Drop a leading zero and trailing zeros: 0.5 → ".5", 1.0 → "1". */
function trim(n: number): string {
  const s = String(n);
  return s.replace(/^(-?)0\./, "$1.");
}
