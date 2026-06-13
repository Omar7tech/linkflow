/**
 * Border-glow engine. Three modes share one architecture: a bordered element
 * plus a blurred `::before` bloom behind it (the modern "glowing card" trick).
 *
 *  - neon     — solid border, single-color halo
 *  - gradient — two-color gradient border + matching halo
 *  - aurora   — a conic-gradient border that rotates via an animated
 *               `@property` angle, with the bloom spinning in lock-step
 *
 * The same CSS string drives both the live preview (injected into a <style>)
 * and the export, so what you see is exactly what you copy.
 */

export type GlowMode = "neon" | "gradient" | "aurora";
export type GlowAnimation = "none" | "pulse" | "breathe";

export interface GlowConfig {
  mode: GlowMode;
  /** Primary color — the border and (neon) halo. */
  color1: string;
  /** Second color for gradient / aurora. */
  color2: string;
  /** Border thickness in px. */
  borderWidth: number;
  /** Corner radius in px. */
  radius: number;
  /** Halo blur in px — softness of the glow. */
  blur: number;
  /** How far the halo reaches past the edge, in px. */
  spread: number;
  /** Halo opacity, 0–100. */
  intensity: number;
  /** The element's own background (the card surface). */
  surface: string;
  /** Layered animation on the bloom (aurora always spins on top of this). */
  animation: GlowAnimation;
  /** Animation cycle / rotation time in seconds. */
  speed: number;
}

export const DEFAULT_GLOW: GlowConfig = {
  mode: "neon",
  color1: "#34d399",
  color2: "#22d3ee",
  borderWidth: 2,
  radius: 16,
  blur: 24,
  spread: 4,
  intensity: 70,
  surface: "#0b0f0e",
  animation: "none",
  speed: 4,
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Relative luminance, for deciding readable text over a surface. */
export function isDark(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

const ANGLE_VAR = "--glow-angle";

function borderFill(c: GlowConfig): string {
  if (c.mode === "neon") return c.color1;
  if (c.mode === "gradient") return `linear-gradient(135deg, ${c.color1}, ${c.color2})`;
  return `conic-gradient(from var(${ANGLE_VAR}), ${c.color1}, ${c.color2}, ${c.color1})`;
}

export function toCss(config: GlowConfig, className = "glow-border"): string {
  const { mode, color1, borderWidth, radius, blur, spread, intensity, surface, animation, speed } =
    config;
  const a = (intensity / 100).toFixed(2);
  const isAurora = mode === "aurora";
  const fill = borderFill(config);

  const elementBg =
    mode === "neon"
      ? surface
      : `linear-gradient(${surface}, ${surface}) padding-box, ${fill} border-box`;

  const beforeAnims: string[] = [];
  if (isAurora) beforeAnims.push(`glow-spin ${speed}s linear infinite`);
  if (animation === "pulse") beforeAnims.push(`glow-pulse ${speed}s ease-in-out infinite`);
  if (animation === "breathe") beforeAnims.push(`glow-breathe ${speed}s ease-in-out infinite`);

  const out: string[] = [];

  if (isAurora) {
    out.push(
      `@property ${ANGLE_VAR} {`,
      `  syntax: "<angle>";`,
      `  inherits: false;`,
      `  initial-value: 0deg;`,
      `}`,
      ``
    );
  }

  out.push(
    `.${className} {`,
    `  position: relative;`,
    `  z-index: 0;`,
    `  border-radius: ${radius}px;`,
    mode === "neon"
      ? `  border: ${borderWidth}px solid ${color1};`
      : `  border: ${borderWidth}px solid transparent;`,
    `  background: ${elementBg};`
  );
  if (isAurora) out.push(`  animation: glow-spin ${speed}s linear infinite;`);
  out.push(`}`, ``);

  out.push(
    `.${className}::before {`,
    `  content: "";`,
    `  position: absolute;`,
    `  inset: -${spread}px;`,
    `  z-index: -1;`,
    `  border-radius: inherit;`,
    `  background: ${fill};`,
    `  filter: blur(${blur}px);`,
    `  opacity: ${a};`
  );
  if (beforeAnims.length) out.push(`  animation: ${beforeAnims.join(", ")};`);
  out.push(`}`);

  if (isAurora) {
    out.push(``, `@keyframes glow-spin {`, `  to { ${ANGLE_VAR}: 360deg; }`, `}`);
  }
  if (animation === "pulse") {
    out.push(
      ``,
      `@keyframes glow-pulse {`,
      `  0%, 100% { opacity: ${a}; }`,
      `  50% { opacity: ${(Number(a) * 0.4).toFixed(2)}; }`,
      `}`
    );
  }
  if (animation === "breathe") {
    out.push(
      ``,
      `@keyframes glow-breathe {`,
      `  0%, 100% { transform: scale(1); }`,
      `  50% { transform: scale(1.08); }`,
      `}`
    );
  }

  if (isAurora || animation !== "none") {
    out.push(
      ``,
      `/* Respect users who prefer less motion */`,
      `@media (prefers-reduced-motion: reduce) {`,
      `  .${className}, .${className}::before { animation: none; }`,
      `}`
    );
  }

  return out.join("\n");
}

export function toTailwind(config: GlowConfig): string {
  const { mode, color1, borderWidth, radius } = config;
  const cls = [
    "relative",
    borderWidth === 1 ? "border" : `border-[${borderWidth}px]`,
    `rounded-[${radius}px]`,
    mode === "neon" ? `border-[${color1}]` : "border-transparent",
  ];
  return (
    `<div class="${cls.join(" ")}">\n  <!-- content -->\n</div>\n` +
    `<!-- The glow halo${mode === "aurora" ? " + rotation" : ""}${
      config.animation !== "none" ? ` + ${config.animation}` : ""
    } use a ::before layer and @keyframes — copy them from the CSS tab. -->`
  );
}

export interface GlowPreset {
  id: string;
  name: string;
  config: GlowConfig;
}

export const GLOW_PRESETS: GlowPreset[] = [
  {
    id: "emerald",
    name: "Emerald neon",
    config: { ...DEFAULT_GLOW },
  },
  {
    id: "aurora",
    name: "Aurora",
    config: {
      mode: "aurora",
      color1: "#34d399",
      color2: "#22d3ee",
      borderWidth: 2,
      radius: 18,
      blur: 28,
      spread: 6,
      intensity: 65,
      surface: "#0b0f0e",
      animation: "none",
      speed: 6,
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    config: {
      mode: "gradient",
      color1: "#fb7185",
      color2: "#f59e0b",
      borderWidth: 2,
      radius: 16,
      blur: 26,
      spread: 5,
      intensity: 72,
      surface: "#100a0a",
      animation: "none",
      speed: 4,
    },
  },
  {
    id: "cyber",
    name: "Cyber",
    config: {
      mode: "neon",
      color1: "#22d3ee",
      color2: "#22d3ee",
      borderWidth: 2,
      radius: 12,
      blur: 32,
      spread: 4,
      intensity: 88,
      surface: "#060a12",
      animation: "pulse",
      speed: 2.5,
    },
  },
  {
    id: "violet",
    name: "Violet pulse",
    config: {
      mode: "gradient",
      color1: "#a78bfa",
      color2: "#22d3ee",
      borderWidth: 2,
      radius: 20,
      blur: 24,
      spread: 5,
      intensity: 70,
      surface: "#0b0a14",
      animation: "pulse",
      speed: 3,
    },
  },
  {
    id: "soft",
    name: "Soft mint",
    config: {
      mode: "neon",
      color1: "#10b981",
      color2: "#34d399",
      borderWidth: 1,
      radius: 22,
      blur: 18,
      spread: 3,
      intensity: 45,
      surface: "#0f1413",
      animation: "breathe",
      speed: 5,
    },
  },
];
