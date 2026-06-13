/**
 * Fluid typography — generate responsive CSS clamp() font sizes that
 * interpolate linearly between a min and max viewport, plus a full modular
 * type scale. Pure math; the formula matches the well-known utopia.fyi approach.
 */

export interface ClampParts {
  minRem: number;
  maxRem: number;
  /** vw coefficient of the preferred value. */
  slopeVw: number;
  /** rem intercept of the preferred value. */
  interceptRem: number;
  clamp: string;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Build a single clamp() that grows `minPx`→`maxPx` across `minVw`→`maxVw`. */
export function buildClamp(
  minPx: number,
  maxPx: number,
  minVw: number,
  maxVw: number,
  root = 16
): ClampParts {
  const minRem = minPx / root;
  const maxRem = maxPx / root;
  const minVwRem = minVw / root;
  const maxVwRem = maxVw / root;
  const slope = maxVwRem === minVwRem ? 0 : (maxRem - minRem) / (maxVwRem - minVwRem);
  const intercept = minRem - slope * minVwRem;
  const slopeVw = r4(slope * 100);
  const interceptRem = r4(intercept);
  const lo = Math.min(minRem, maxRem);
  const hi = Math.max(minRem, maxRem);
  const preferred =
    interceptRem === 0
      ? `${slopeVw}vw`
      : `${interceptRem}rem + ${slopeVw}vw`;
  return {
    minRem: r3(minRem),
    maxRem: r3(maxRem),
    slopeVw,
    interceptRem,
    clamp: `clamp(${r3(lo)}rem, ${preferred}, ${r3(hi)}rem)`,
  };
}

export interface ScaleOptions {
  minVw: number;
  maxVw: number;
  /** Base font size (px) at the min and max viewport. */
  baseMin: number;
  baseMax: number;
  /** Modular ratio at the min and max viewport. */
  ratioMin: number;
  ratioMax: number;
  stepsUp: number;
  stepsDown: number;
  root?: number;
}

export interface FluidStep {
  /** Signed step index, 0 = base. */
  index: number;
  label: string;
  /** CSS custom-property name, e.g. --fs-2 or --fs--1. */
  varName: string;
  minPx: number;
  maxPx: number;
  clamp: string;
}

const STEP_NAMES: Record<number, string> = {
  [-2]: "XS",
  [-1]: "SM",
  [0]: "Base",
  [1]: "LG",
  [2]: "XL",
  [3]: "2XL",
  [4]: "3XL",
  [5]: "4XL",
  [6]: "5XL",
};

export function buildScale(opts: ScaleOptions): FluidStep[] {
  const { minVw, maxVw, baseMin, baseMax, ratioMin, ratioMax, stepsUp, stepsDown, root = 16 } = opts;
  const steps: FluidStep[] = [];
  for (let i = stepsUp; i >= -stepsDown; i--) {
    const minPx = baseMin * Math.pow(ratioMin, i);
    const maxPx = baseMax * Math.pow(ratioMax, i);
    steps.push({
      index: i,
      label: STEP_NAMES[i] ?? (i > 0 ? `+${i}` : `${i}`),
      varName: `--fs-${i < 0 ? `n${-i}` : i}`,
      minPx: Math.round(minPx * 100) / 100,
      maxPx: Math.round(maxPx * 100) / 100,
      clamp: buildClamp(minPx, maxPx, minVw, maxVw, root).clamp,
    });
  }
  return steps;
}

export const RATIO_PRESETS: { name: string; value: number }[] = [
  { name: "Minor Second", value: 1.067 },
  { name: "Major Second", value: 1.125 },
  { name: "Minor Third", value: 1.2 },
  { name: "Major Third", value: 1.25 },
  { name: "Perfect Fourth", value: 1.333 },
  { name: "Aug. Fourth", value: 1.414 },
  { name: "Perfect Fifth", value: 1.5 },
  { name: "Golden Ratio", value: 1.618 },
];

export function toCss(steps: FluidStep[]): string {
  const lines = [":root {", ...steps.map((s) => `  ${s.varName}: ${s.clamp};`), "}"];
  return lines.join("\n");
}

export function toTailwind(steps: FluidStep[]): string {
  const entries = steps.map((s) => {
    const key = s.label.toLowerCase().replace(/\+/g, "plus");
    return `        "${key}": "${s.clamp}",`;
  });
  return [
    "// tailwind.config.js",
    "theme: {",
    "  extend: {",
    "    fontSize: {",
    ...entries,
    "    },",
    "  },",
    "},",
  ].join("\n");
}
