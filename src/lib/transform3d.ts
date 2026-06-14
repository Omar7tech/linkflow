import type { CSSProperties } from "react";

export interface Transform3DConfig {
  /** Perspective depth in px — smaller = stronger, more dramatic 3D. */
  perspective: number;
  /** Tilt around the X axis (top/bottom), degrees. */
  rotateX: number;
  /** Tilt around the Y axis (left/right), degrees. */
  rotateY: number;
  /** Spin in the plane, degrees. */
  rotateZ: number;
  /** Push the element toward (+) or away (-) from the viewer, px. */
  translateZ: number;
  /** Uniform scale, percent. */
  scale: number;
  /** Paint a moving specular glare across the face. */
  glare: boolean;
  /** Cast a soft floor shadow that reacts to the tilt. */
  shadow: boolean;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The transform applied to the element (perspective lives on the parent). */
export function toTransform(config: Transform3DConfig): string {
  const parts = [
    `rotateX(${round(config.rotateX)}deg)`,
    `rotateY(${round(config.rotateY)}deg)`,
    `rotateZ(${round(config.rotateZ)}deg)`,
  ];
  if (config.translateZ !== 0) parts.push(`translateZ(${round(config.translateZ)}px)`);
  if (config.scale !== 100) parts.push(`scale(${round(config.scale / 100)})`);
  return parts.join(" ");
}

/** Inline style for the live card — perspective applied here for a self-contained preview. */
export function toStyle(config: Transform3DConfig): CSSProperties {
  return {
    transform: `perspective(${config.perspective}px) ${toTransform(config)}`,
    transformStyle: "preserve-3d",
  };
}

/** Where the light glare sits, nudged by the current tilt. */
export function glarePosition(config: Transform3DConfig): { x: number; y: number } {
  return {
    x: clamp(50 - config.rotateY * 1.4, 0, 100),
    y: clamp(50 + config.rotateX * 1.4, 0, 100),
  };
}

/** Floor-shadow style that drifts and softens with depth and tilt. */
export function shadowStyle(config: Transform3DConfig): CSSProperties {
  const lift = config.translateZ / 100; // -1 … 3-ish
  const blur = clamp(24 + lift * 18 + Math.abs(config.rotateX) * 0.3, 12, 90);
  const offsetX = round(-config.rotateY * 0.6);
  const offsetY = round(28 + Math.abs(config.rotateX) * 0.4 + lift * 10);
  const spread = clamp(0.62 - lift * 0.06, 0.18, 0.7);
  return {
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${round(clamp(0.82 + lift * 0.08, 0.5, 1.1))})`,
    filter: `blur(${round(blur)}px)`,
    opacity: round(spread),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function toCss(config: Transform3DConfig): string {
  return [
    `.scene {`,
    `  perspective: ${config.perspective}px;`,
    `}`,
    ``,
    `.card {`,
    `  transform: ${toTransform(config)};`,
    `  transform-style: preserve-3d;`,
    `  transition: transform 0.2s ease-out;`,
    `}`,
  ].join("\n");
}

export function toTailwind(config: Transform3DConfig): string {
  const transform = toTransform(config).replace(/\s+/g, "_");
  return [
    `<!-- parent -->`,
    `<div class="[perspective:${config.perspective}px]">`,
    `  <div class="[transform-style:preserve-3d] [transform:${transform}] transition-transform duration-200">`,
    `    <!-- content -->`,
    `  </div>`,
    `</div>`,
  ].join("\n");
}

/** A drop-in vanilla-JS tilt: the card follows the pointer, springs back on leave. */
export function toTiltJs(config: Transform3DConfig): string {
  const maxX = Math.max(6, Math.round(Math.abs(config.rotateX)) || 10);
  const maxY = Math.max(6, Math.round(Math.abs(config.rotateY)) || 14);
  return [
    `// Pointer-driven 3D tilt — wrap your card in .scene { perspective: ${config.perspective}px }`,
    `function attachTilt(card, { maxX = ${maxX}, maxY = ${maxY} } = {}) {`,
    `  const onMove = (e) => {`,
    `    const r = card.getBoundingClientRect();`,
    `    const px = (e.clientX - r.left) / r.width - 0.5;`,
    `    const py = (e.clientY - r.top) / r.height - 0.5;`,
    `    card.style.transform =`,
    `      \`rotateX(\${(-py * maxX * 2).toFixed(2)}deg) rotateY(\${(px * maxY * 2).toFixed(2)}deg)\`;`,
    `  };`,
    `  const reset = () => { card.style.transform = "rotateX(0deg) rotateY(0deg)"; };`,
    `  card.addEventListener("pointermove", onMove);`,
    `  card.addEventListener("pointerleave", reset);`,
    `  return () => {`,
    `    card.removeEventListener("pointermove", onMove);`,
    `    card.removeEventListener("pointerleave", reset);`,
    `  };`,
    `}`,
    ``,
    `// attachTilt(document.querySelector(".card"));`,
  ].join("\n");
}

export interface Transform3DPreset {
  id: string;
  name: string;
  config: Transform3DConfig;
}

const base = { glare: true, shadow: true };

export const TRANSFORM3D_PRESETS: Transform3DPreset[] = [
  { id: "hero", name: "Hero", config: { ...base, perspective: 800, rotateX: 14, rotateY: -22, rotateZ: 0, translateZ: 0, scale: 100 } },
  { id: "card", name: "App Card", config: { ...base, perspective: 1200, rotateX: 8, rotateY: -14, rotateZ: 0, translateZ: 20, scale: 100 } },
  { id: "float", name: "Float", config: { ...base, perspective: 1000, rotateX: 22, rotateY: 0, rotateZ: 0, translateZ: 60, scale: 104 } },
  { id: "iso", name: "Isometric", config: { ...base, perspective: 1600, rotateX: 35, rotateY: -35, rotateZ: 0, translateZ: 0, scale: 96 } },
  { id: "coin", name: "Coin", config: { ...base, perspective: 700, rotateX: 0, rotateY: 62, rotateZ: 0, translateZ: 0, scale: 100 } },
  { id: "tilt-left", name: "Tilt Left", config: { ...base, perspective: 900, rotateX: 6, rotateY: 28, rotateZ: -4, translateZ: 0, scale: 100 } },
  { id: "lean", name: "Lean Back", config: { ...base, perspective: 600, rotateX: 38, rotateY: 0, rotateZ: 0, translateZ: -20, scale: 100 } },
  { id: "flat", name: "Flat", config: { ...base, perspective: 1000, rotateX: 0, rotateY: 0, rotateZ: 0, translateZ: 0, scale: 100, glare: false } },
];

export interface CardFace {
  id: string;
  name: string;
  /** CSS background for the card face. */
  background: string;
  /** Text/UI color on the face. */
  fg: "light" | "dark";
}

export const CARD_FACES: CardFace[] = [
  { id: "emerald", name: "Emerald", background: "linear-gradient(135deg, #34d399, #0f766e)", fg: "light" },
  { id: "violet", name: "Violet", background: "linear-gradient(135deg, #a78bfa, #6d28d9)", fg: "light" },
  { id: "sunset", name: "Sunset", background: "linear-gradient(135deg, #fb923c, #db2777)", fg: "light" },
  { id: "ocean", name: "Ocean", background: "linear-gradient(135deg, #38bdf8, #1e3a8a)", fg: "light" },
  { id: "ink", name: "Ink", background: "linear-gradient(135deg, #334155, #0f172a)", fg: "light" },
  { id: "paper", name: "Paper", background: "linear-gradient(135deg, #ffffff, #e2e8f0)", fg: "dark" },
];
