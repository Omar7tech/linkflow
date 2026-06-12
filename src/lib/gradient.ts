import { hslToRgb, randomHarmonyHues } from "./palette";
import { rgbToHex } from "./colorExtract";

export type GradientType = "linear" | "radial" | "conic";

export interface GradientStop {
  id: string;
  color: string;
  /** Position along the gradient, 0–100 (%). */
  pos: number;
}

export interface GradientConfig {
  type: GradientType;
  /** Angle in degrees — linear direction or conic start angle. */
  angle: number;
  /** Center, 0–100 (%) — radial and conic only. */
  x: number;
  y: number;
  stops: GradientStop[];
}

function stopList(stops: GradientStop[]): string {
  return [...stops]
    .sort((a, b) => a.pos - b.pos)
    .map((s) => `${s.color} ${s.pos}%`)
    .join(", ");
}

/** The bare gradient function — usable anywhere a CSS <image> goes. */
export function gradientValue(config: GradientConfig): string {
  const stops = stopList(config.stops);
  switch (config.type) {
    case "linear":
      return `linear-gradient(${config.angle}deg, ${stops})`;
    case "radial":
      return `radial-gradient(circle at ${config.x}% ${config.y}%, ${stops})`;
    case "conic":
      return `conic-gradient(from ${config.angle}deg at ${config.x}% ${config.y}%, ${stops})`;
  }
}

export function toCss(config: GradientConfig, className = "gradient"): string {
  return [
    `.${className} {`,
    `  background: ${gradientValue(config)};`,
    `}`,
    ``,
    `/* Solid fallback for very old browsers */`,
    `.${className} {`,
    `  background-color: ${config.stops[0]?.color ?? "#000000"};`,
    `  background-image: ${gradientValue(config)};`,
    `}`,
  ].join("\n");
}

export function toTailwind(config: GradientConfig): string {
  return `<div class="bg-[${gradientValue(config).replace(/\s/g, "_")}]">\n  <!-- content -->\n</div>`;
}

/** SVG version — handy for emails, OG images and design tools. */
export function toSvg(config: GradientConfig): string {
  const sorted = [...config.stops].sort((a, b) => a.pos - b.pos);
  const stops = sorted
    .map((s) => `    <stop offset="${s.pos}%" stop-color="${s.color}"/>`)
    .join("\n");
  // SVG only does linear/radial — conic falls back to linear.
  const isRadial = config.type === "radial";
  const def = isRadial
    ? `  <radialGradient id="g" cx="${config.x}%" cy="${config.y}%" r="75%">\n${stops}\n  </radialGradient>`
    : `  <linearGradient id="g" gradientTransform="rotate(${config.angle - 90} 0.5 0.5)">\n${stops}\n  </linearGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">\n${def}\n  <rect width="100%" height="100%" fill="url(#g)"/>\n</svg>`;
}

let stopId = 0;
export function newStop(color: string, pos: number): GradientStop {
  return { id: `stop-${++stopId}-${Date.now()}`, color, pos };
}

/** A harmonious random gradient: related hues, pleasant saturation/lightness. */
export function randomGradient(type: GradientType): GradientConfig {
  const hues = randomHarmonyHues(2 + Math.floor(Math.random() * 2));
  const stops = hues.map((h, i) => {
    const s = 65 + Math.random() * 25;
    const l = 45 + Math.random() * 25;
    return newStop(rgbToHex(hslToRgb(h, s, l)), Math.round((i / (hues.length - 1)) * 100));
  });
  return {
    type,
    angle: Math.round(Math.random() * 8) * 45,
    x: 25 + Math.round(Math.random() * 50),
    y: 25 + Math.round(Math.random() * 50),
    stops,
  };
}

export interface GradientPreset {
  id: string;
  name: string;
  type: GradientType;
  angle: number;
  colors: [string, number][];
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: "sunset", name: "Sunset", type: "linear", angle: 135, colors: [["#fbbf24", 0], ["#f97316", 45], ["#db2777", 100]] },
  { id: "ocean", name: "Ocean", type: "linear", angle: 160, colors: [["#22d3ee", 0], ["#3b82f6", 55], ["#1e3a8a", 100]] },
  { id: "aurora", name: "Aurora", type: "linear", angle: 120, colors: [["#34d399", 0], ["#22d3ee", 50], ["#818cf8", 100]] },
  { id: "candy", name: "Candy", type: "linear", angle: 45, colors: [["#fda4af", 0], ["#f472b6", 50], ["#c4b5fd", 100]] },
  { id: "ember", name: "Ember", type: "radial", angle: 0, colors: [["#fbbf24", 0], ["#ef4444", 60], ["#7f1d1d", 100]] },
  { id: "midnight", name: "Midnight", type: "linear", angle: 180, colors: [["#334155", 0], ["#0f172a", 100]] },
  { id: "lime", name: "Limeade", type: "linear", angle: 90, colors: [["#a3e635", 0], ["#22c55e", 60], ["#0d9488", 100]] },
  { id: "holo", name: "Holographic", type: "conic", angle: 0, colors: [["#f472b6", 0], ["#facc15", 25], ["#4ade80", 50], ["#38bdf8", 75], ["#f472b6", 100]] },
];

export function applyGradientPreset(preset: GradientPreset): GradientConfig {
  return {
    type: preset.type,
    angle: preset.angle,
    x: 50,
    y: 50,
    stops: preset.colors.map(([color, pos]) => newStop(color, pos)),
  };
}
