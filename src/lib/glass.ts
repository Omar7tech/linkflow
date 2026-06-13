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
  /** Backdrop brightness, 50–150 (%). */
  brightness: number;
  /** Corner radius in px, 0–40. */
  radius: number;
  /** Border alpha, 0–80 (%). */
  borderOpacity: number;
  /** Border width in px, 0–6. */
  borderWidth: number;
  /** Drop shadow strength, 0–60 (%). */
  shadow: number;
  /** Inner top edge highlight — fakes light hitting the glass. */
  highlight: boolean;
  /** Diagonal gradient surface instead of a flat tint. */
  gradient: boolean;
  /** Subtle SVG grain baked into the surface — classic frosted look. */
  noise: boolean;
  /** Refractive lens edge — chromatic dispersion rim, the "liquid glass" look. */
  lens: boolean;
  /** Soft inner glow, as if the glass were lit from within. */
  glow: boolean;
  /** Animated specular sheen sweeping across the surface. */
  sheen: boolean;
}

/** Tiling fractal-noise SVG, alpha baked in — the standard frost-grain trick. */
const NOISE_LAYER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='linear' slope='0.07'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

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
  return `rgba(${r}, ${g}, ${b}, ${(Math.max(alphaPct, 0) / 100).toFixed(2)})`;
}

/** The glass surface: flat tint or diagonal gradient, with optional grain on top. */
function surface(config: GlassConfig): string {
  const fill = config.gradient
    ? `linear-gradient(135deg, ${rgba(config.tint, Math.min(config.opacity + 12, 95))}, ${rgba(config.tint, Math.max(config.opacity - 8, 2))})`
    : rgba(config.tint, config.opacity);
  return config.noise ? `${NOISE_LAYER} repeat, ${fill}` : fill;
}

function backdropFilter({ blur, saturation, brightness }: GlassConfig): string {
  const parts = [`blur(${blur}px)`];
  if (saturation !== 100) parts.push(`saturate(${saturation}%)`);
  if (brightness !== 100) parts.push(`brightness(${brightness}%)`);
  return parts.join(" ");
}

function boxShadow({ shadow, highlight, lens, glow }: GlassConfig): string | null {
  const layers: string[] = [];
  if (shadow > 0) layers.push(`0 8px 32px rgba(0, 0, 0, ${(shadow / 100).toFixed(2)})`);
  if (highlight) layers.push(`inset 0 1px 0 rgba(255, 255, 255, 0.4)`);
  if (lens) {
    // Bright specular rim on the light side, plus two chromatic refraction
    // edges (cool + warm) that read as glass bending the light behind it.
    layers.push(
      `inset 1px 1px 1px rgba(255, 255, 255, 0.55)`,
      `inset -1px -1px 1px rgba(255, 255, 255, 0.2)`,
      `inset 3px 3px 7px rgba(130, 170, 255, 0.3)`,
      `inset -3px -3px 7px rgba(255, 140, 190, 0.24)`,
    );
  }
  if (glow) layers.push(`inset 0 0 22px rgba(255, 255, 255, 0.18)`);
  return layers.length ? layers.join(", ") : null;
}

/** The animated specular sweep, emitted as a ::before layer in the CSS export. */
const SHEEN_CSS = (className: string) =>
  [
    ``,
    `.${className} { position: relative; overflow: hidden; isolation: isolate; }`,
    `.${className}::before {`,
    `  content: "";`,
    `  position: absolute;`,
    `  inset: 0;`,
    `  background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.35) 50%, transparent 70%);`,
    `  transform: translateX(-100%);`,
    `  animation: glass-sheen 5s ease-in-out infinite;`,
    `  pointer-events: none;`,
    `}`,
    `@keyframes glass-sheen {`,
    `  0%, 55% { transform: translateX(-100%); }`,
    `  100% { transform: translateX(100%); }`,
    `}`,
  ].join("\n");

/** Inline style object for the live preview — same values the CSS export uses. */
export function toStyle(config: GlassConfig): CSSProperties {
  const shadowValue = boxShadow(config);
  return {
    background: surface(config),
    backdropFilter: backdropFilter(config),
    WebkitBackdropFilter: backdropFilter(config),
    ...(config.borderWidth > 0
      ? { border: `${config.borderWidth}px solid ${rgba(config.tint, config.borderOpacity)}` }
      : {}),
    borderRadius: `${config.radius}px`,
    ...(shadowValue ? { boxShadow: shadowValue } : {}),
  };
}

export function toCss(config: GlassConfig, className = "glass"): string {
  const shadowValue = boxShadow(config);
  const lines = [
    `.${className} {`,
    `  background: ${surface(config)};`,
    `  backdrop-filter: ${backdropFilter(config)};`,
    `  -webkit-backdrop-filter: ${backdropFilter(config)};`,
  ];
  if (config.borderWidth > 0) {
    lines.push(`  border: ${config.borderWidth}px solid ${rgba(config.tint, config.borderOpacity)};`);
  }
  lines.push(`  border-radius: ${config.radius}px;`);
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
  if (config.sheen) lines.push(SHEEN_CSS(className));
  return lines.join("\n");
}

export function toTailwind(config: GlassConfig): string {
  const classes = [
    `bg-[${(config.gradient
      ? `linear-gradient(135deg,${rgba(config.tint, Math.min(config.opacity + 12, 95))},${rgba(config.tint, Math.max(config.opacity - 8, 2))})`
      : rgba(config.tint, config.opacity)
    ).replace(/\s/g, "")}]`,
    `backdrop-blur-[${config.blur}px]`,
  ];
  if (config.saturation !== 100) classes.push(`backdrop-saturate-[${config.saturation / 100}]`);
  if (config.brightness !== 100) classes.push(`backdrop-brightness-[${config.brightness / 100}]`);
  if (config.borderWidth > 0) {
    classes.push(
      config.borderWidth === 1 ? `border` : `border-[${config.borderWidth}px]`,
      `border-[${rgba(config.tint, config.borderOpacity).replace(/\s/g, "")}]`
    );
  }
  classes.push(`rounded-[${config.radius}px]`);
  const shadowValue = boxShadow(config);
  if (shadowValue) classes.push(`shadow-[${shadowValue.replace(/\s/g, "_")}]`);
  const notes = [
    config.noise
      ? `<!-- Frost grain uses an SVG background layer — grab it from the CSS export. -->`
      : "",
    config.sheen
      ? `<!-- Animated sheen needs the ::before layer + @keyframes from the CSS export. -->`
      : "",
  ]
    .filter(Boolean)
    .map((n) => `\n${n}`)
    .join("");
  return `<div class="${classes.join(" ")}">\n  <!-- content -->\n</div>${notes}`;
}

export interface GlassPreset {
  id: string;
  name: string;
  config: GlassConfig;
}

const base = {
  brightness: 100,
  borderWidth: 1,
  gradient: false,
  noise: false,
  lens: false,
  glow: false,
  sheen: false,
};

export const GLASS_PRESETS: GlassPreset[] = [
  {
    id: "liquid",
    name: "Liquid Glass",
    config: { ...base, tint: "#ffffff", opacity: 12, blur: 10, saturation: 180, brightness: 108, radius: 28, borderOpacity: 35, borderWidth: 1, shadow: 28, highlight: true, gradient: true, lens: true, glow: true, sheen: true },
  },
  {
    id: "lens",
    name: "Lens",
    config: { ...base, tint: "#ffffff", opacity: 8, blur: 6, saturation: 200, brightness: 110, radius: 32, borderOpacity: 25, shadow: 22, highlight: false, lens: true, glow: true },
  },
  {
    id: "frosted",
    name: "Frosted",
    config: { ...base, tint: "#ffffff", opacity: 15, blur: 16, saturation: 160, radius: 16, borderOpacity: 30, shadow: 20, highlight: true, noise: true },
  },
  {
    id: "subtle",
    name: "Subtle",
    config: { ...base, tint: "#ffffff", opacity: 8, blur: 8, saturation: 120, radius: 12, borderOpacity: 15, shadow: 10, highlight: false },
  },
  {
    id: "vivid",
    name: "Vivid",
    config: { ...base, tint: "#ffffff", opacity: 25, blur: 24, saturation: 200, radius: 24, borderOpacity: 45, shadow: 30, highlight: true },
  },
  {
    id: "smoke",
    name: "Dark Smoke",
    config: { ...base, tint: "#0f172a", opacity: 35, blur: 14, saturation: 110, radius: 16, borderOpacity: 25, shadow: 40, highlight: false },
  },
  {
    id: "crystal",
    name: "Crystal",
    config: { ...base, tint: "#ffffff", opacity: 10, blur: 4, saturation: 140, radius: 20, borderOpacity: 60, shadow: 15, highlight: true },
  },
  {
    id: "holo",
    name: "Holographic",
    config: { ...base, tint: "#a5f3fc", opacity: 18, blur: 20, saturation: 200, brightness: 115, radius: 24, borderOpacity: 50, shadow: 25, highlight: true, gradient: true },
  },
  {
    id: "gold",
    name: "Gold Leaf",
    config: { ...base, tint: "#f59e0b", opacity: 20, blur: 12, saturation: 150, radius: 16, borderOpacity: 55, shadow: 25, highlight: true, gradient: true },
  },
  {
    id: "obsidian",
    name: "Obsidian",
    config: { ...base, tint: "#000000", opacity: 45, blur: 28, saturation: 120, brightness: 90, radius: 20, borderOpacity: 20, shadow: 50, highlight: false, noise: true },
  },
  {
    id: "bubblegum",
    name: "Bubblegum",
    config: { ...base, tint: "#f472b6", opacity: 22, blur: 18, saturation: 180, radius: 32, borderOpacity: 40, shadow: 20, highlight: true, gradient: true },
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
    id: "neon",
    name: "Neon",
    background:
      "radial-gradient(at 10% 90%, #22d3ee 0px, transparent 45%), radial-gradient(at 90% 10%, #e879f9 0px, transparent 45%), radial-gradient(at 50% 50%, #4f46e5 0px, transparent 60%), #030712",
    fg: "light",
  },
  {
    id: "forest",
    name: "Forest",
    background:
      "radial-gradient(at 80% 80%, #4ade80 0px, transparent 50%), radial-gradient(at 20% 20%, #2dd4bf 0px, transparent 50%), linear-gradient(180deg, #14532d, #052e16)",
    fg: "light",
  },
  {
    id: "bokeh",
    name: "Bokeh",
    background:
      "radial-gradient(circle at 20% 30%, #fbbf24 0 6%, transparent 7%), radial-gradient(circle at 70% 20%, #f472b6 0 9%, transparent 10%), radial-gradient(circle at 85% 70%, #38bdf8 0 7%, transparent 8%), radial-gradient(circle at 40% 80%, #a78bfa 0 10%, transparent 11%), radial-gradient(circle at 55% 45%, #34d399 0 5%, transparent 6%), #1e1b4b",
    fg: "light",
  },
  {
    id: "candy",
    name: "Candy",
    background:
      "radial-gradient(at 30% 20%, #fda4af 0px, transparent 55%), radial-gradient(at 80% 80%, #c4b5fd 0px, transparent 55%), linear-gradient(135deg, #fce7f3, #ede9fe)",
    fg: "dark",
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
