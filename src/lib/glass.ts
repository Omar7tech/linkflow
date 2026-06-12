import type { CSSProperties } from "react";

export interface GlassConfig {
  /** Tint color of the glass surface (hex). */
  tint: string;
  /** Background alpha, 0–60 (%). */
  opacity: number;
  /** Backdrop blur in px, 0–40. */
  blur: number;
  /** Backdrop saturation, 100–200 (%). */
  saturation: number;
  /** Corner radius in px, 0–40. */
  radius: number;
  /** Border alpha, 0–80 (%). */
  borderOpacity: number;
  /** Drop shadow strength, 0–60 (%). */
  shadow: number;
  /** Inner top edge highlight — fakes light hitting the glass. */
  highlight: boolean;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : value;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgba(hex: string, alphaPct: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${(alphaPct / 100).toFixed(2)})`;
}

function backdropFilter({ blur, saturation }: GlassConfig): string {
  const parts = [`blur(${blur}px)`];
  if (saturation !== 100) parts.push(`saturate(${saturation}%)`);
  return parts.join(" ");
}

function boxShadow({ shadow, highlight }: GlassConfig): string | null {
  const layers: string[] = [];
  if (shadow > 0) layers.push(`0 8px 32px rgba(0, 0, 0, ${(shadow / 100).toFixed(2)})`);
  if (highlight) layers.push(`inset 0 1px 0 rgba(255, 255, 255, 0.4)`);
  return layers.length ? layers.join(", ") : null;
}

/** Inline style object for the live preview — same values the CSS export uses. */
export function toStyle(config: GlassConfig): CSSProperties {
  const shadowValue = boxShadow(config);
  return {
    background: rgba(config.tint, config.opacity),
    backdropFilter: backdropFilter(config),
    WebkitBackdropFilter: backdropFilter(config),
    border: `1px solid ${rgba(config.tint, config.borderOpacity)}`,
    borderRadius: `${config.radius}px`,
    ...(shadowValue ? { boxShadow: shadowValue } : {}),
  };
}

export function toCss(config: GlassConfig, className = "glass"): string {
  const shadowValue = boxShadow(config);
  const lines = [
    `.${className} {`,
    `  background: ${rgba(config.tint, config.opacity)};`,
    `  backdrop-filter: ${backdropFilter(config)};`,
    `  -webkit-backdrop-filter: ${backdropFilter(config)};`,
    `  border: 1px solid ${rgba(config.tint, config.borderOpacity)};`,
    `  border-radius: ${config.radius}px;`,
  ];
  if (shadowValue) lines.push(`  box-shadow: ${shadowValue};`);
  lines.push(
    `}`,
    ``,
    `/* Fallback for browsers without backdrop-filter support */`,
    `@supports not (backdrop-filter: blur(1px)) {`,
    `  .${className} {`,
    `    background: ${rgba(config.tint, Math.min(config.opacity + 30, 95))};`,
    `  }`,
    `}`
  );
  return lines.join("\n");
}

export function toTailwind(config: GlassConfig): string {
  const classes = [
    `bg-[${rgba(config.tint, config.opacity).replace(/\s/g, "")}]`,
    `backdrop-blur-[${config.blur}px]`,
  ];
  if (config.saturation !== 100) classes.push(`backdrop-saturate-[${config.saturation / 100}]`);
  classes.push(
    `border`,
    `border-[${rgba(config.tint, config.borderOpacity).replace(/\s/g, "")}]`,
    `rounded-[${config.radius}px]`
  );
  const shadowValue = boxShadow(config);
  if (shadowValue) classes.push(`shadow-[${shadowValue.replace(/\s/g, "_")}]`);
  return `<div class="${classes.join(" ")}">\n  <!-- content -->\n</div>`;
}

export interface GlassPreset {
  id: string;
  name: string;
  config: GlassConfig;
}

export const GLASS_PRESETS: GlassPreset[] = [
  {
    id: "frosted",
    name: "Frosted",
    config: {
      tint: "#ffffff",
      opacity: 15,
      blur: 16,
      saturation: 160,
      radius: 16,
      borderOpacity: 30,
      shadow: 20,
      highlight: true,
    },
  },
  {
    id: "subtle",
    name: "Subtle",
    config: {
      tint: "#ffffff",
      opacity: 8,
      blur: 8,
      saturation: 120,
      radius: 12,
      borderOpacity: 15,
      shadow: 10,
      highlight: false,
    },
  },
  {
    id: "vivid",
    name: "Vivid",
    config: {
      tint: "#ffffff",
      opacity: 25,
      blur: 24,
      saturation: 200,
      radius: 24,
      borderOpacity: 45,
      shadow: 30,
      highlight: true,
    },
  },
  {
    id: "smoke",
    name: "Dark Smoke",
    config: {
      tint: "#0f172a",
      opacity: 35,
      blur: 14,
      saturation: 110,
      radius: 16,
      borderOpacity: 25,
      shadow: 40,
      highlight: false,
    },
  },
  {
    id: "crystal",
    name: "Crystal",
    config: {
      tint: "#ffffff",
      opacity: 10,
      blur: 4,
      saturation: 140,
      radius: 20,
      borderOpacity: 60,
      shadow: 15,
      highlight: true,
    },
  },
];

export interface GlassScene {
  id: string;
  name: string;
  /** CSS background shorthand for the preview stage. */
  background: string;
  /** Whether card content should be light or dark for readability. */
  fg: "light" | "dark";
}

export const GLASS_SCENES: GlassScene[] = [
  {
    id: "aurora",
    name: "Aurora",
    background:
      "radial-gradient(at 20% 30%, #7c3aed 0px, transparent 50%), radial-gradient(at 80% 15%, #06b6d4 0px, transparent 50%), radial-gradient(at 65% 85%, #ec4899 0px, transparent 55%), #0f172a",
    fg: "light",
  },
  {
    id: "sunset",
    name: "Sunset",
    background:
      "radial-gradient(at 15% 80%, #f97316 0px, transparent 55%), radial-gradient(at 85% 25%, #e11d48 0px, transparent 55%), linear-gradient(160deg, #fbbf24, #db2777)",
    fg: "light",
  },
  {
    id: "ocean",
    name: "Ocean",
    background:
      "radial-gradient(at 75% 20%, #22d3ee 0px, transparent 50%), radial-gradient(at 25% 75%, #3b82f6 0px, transparent 55%), linear-gradient(200deg, #0ea5e9, #1e3a8a)",
    fg: "light",
  },
  {
    id: "stripes",
    name: "Stripes",
    background:
      "repeating-linear-gradient(45deg, #f43f5e 0 40px, #fb923c 40px 80px, #facc15 80px 120px, #4ade80 120px 160px, #38bdf8 160px 200px, #a78bfa 200px 240px)",
    fg: "dark",
  },
  {
    id: "studio",
    name: "Studio",
    background:
      "radial-gradient(at 50% 0%, #e2e8f0 0px, transparent 70%), radial-gradient(at 80% 90%, #cbd5e1 0px, transparent 60%), #f8fafc",
    fg: "dark",
  },
];
