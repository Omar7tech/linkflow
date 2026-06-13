/**
 * Text-effects engine for the Typography studio. Ten effects share one config
 * and one CSS generator; the same CSS string drives the live preview (injected
 * into a <style>) and the export, so the preview is the export.
 *
 * Effects: gradient · animated-gradient · aurora · split · outline · neon ·
 *          glow · glass · 3d · metallic
 */

export type TextEffect =
  | "gradient"
  | "animated-gradient"
  | "aurora"
  | "split"
  | "outline"
  | "neon"
  | "glow"
  | "glass"
  | "3d"
  | "metallic";

export interface TextConfig {
  effect: TextEffect;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  italic: boolean;
  uppercase: boolean;

  color1: string;
  color2: string;
  color3: string;
  angle: number;
  speed: number;

  strokeWidth: number;
  glowSize: number;
  intensity: number;
  depth: number;

  /** Stage / recommended background behind the text. */
  surface: string;
}

export const TEXT_EFFECTS: { id: TextEffect; label: string }[] = [
  { id: "gradient", label: "Gradient" },
  { id: "animated-gradient", label: "Animated" },
  { id: "aurora", label: "Aurora" },
  { id: "split", label: "Split color" },
  { id: "metallic", label: "Metallic" },
  { id: "neon", label: "Neon" },
  { id: "glow", label: "Glow" },
  { id: "outline", label: "Outline" },
  { id: "glass", label: "Glass" },
  { id: "3d", label: "3D" },
];

export const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Display", value: "var(--font-space-grotesk), system-ui, sans-serif" },
  { label: "Sans", value: "var(--font-geist-sans), system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Heavy", value: "Impact, 'Arial Black', system-ui, sans-serif" },
  { label: "Mono", value: "var(--font-geist-mono), 'Courier New', monospace" },
];

export const DEFAULT_TEXT: TextConfig = {
  effect: "aurora",
  text: "Aurora",
  fontFamily: FONT_FAMILIES[0].value,
  fontSize: 88,
  fontWeight: 800,
  letterSpacing: -2,
  italic: false,
  uppercase: false,
  color1: "#34d399",
  color2: "#22d3ee",
  color3: "#818cf8",
  angle: 90,
  speed: 6,
  strokeWidth: 2,
  glowSize: 22,
  intensity: 90,
  depth: 6,
  surface: "#0b0f0e",
};

/** Per-effect defaults merged in when you switch effects, so each looks good instantly. */
export function effectDefaults(effect: TextEffect): Partial<TextConfig> {
  switch (effect) {
    case "gradient":
      return { color1: "#34d399", color2: "#22d3ee", angle: 90, surface: "#0b0f0e" };
    case "animated-gradient":
      return { color1: "#34d399", color2: "#22d3ee", color3: "#a78bfa", angle: 90, speed: 4, surface: "#0b0f0e" };
    case "aurora":
      return { color1: "#34d399", color2: "#22d3ee", color3: "#818cf8", speed: 6, surface: "#0b0f0e" };
    case "split":
      return { color1: "#34d399", color2: "#0f766e", angle: 90, surface: "#0b0f0e" };
    case "metallic":
      return { color1: "#f5d061", color2: "#8a6d1f", surface: "#0a0a0a" };
    case "neon":
      return { color1: "#34d399", glowSize: 22, intensity: 95, surface: "#070707" };
    case "glow":
      return { color1: "#34d399", glowSize: 18, intensity: 80, surface: "#0b0f0e" };
    case "outline":
      return { color1: "#34d399", strokeWidth: 2, surface: "#0b0f0e" };
    case "glass":
      return { strokeWidth: 1, surface: "#0b0f0e" };
    case "3d":
      return { color1: "#34d399", depth: 6, surface: "#0b0f0e" };
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const f = (v: number) => Math.max(0, Math.round(v * (1 - amount)));
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const ANGLE_VAR = "--te-angle";
const CLIP_LINES = [
  "color: transparent;",
  "-webkit-text-fill-color: transparent;",
  "background-clip: text;",
  "-webkit-background-clip: text;",
];

interface Built {
  decls: string[];
  keyframes: string[];
  needsAngleProp: boolean;
  animated: boolean;
}

function buildEffect(c: TextConfig): Built {
  const a = c.intensity / 100;
  switch (c.effect) {
    case "gradient":
      return {
        decls: [`background: linear-gradient(${c.angle}deg, ${c.color1}, ${c.color2});`, ...CLIP_LINES],
        keyframes: [],
        needsAngleProp: false,
        animated: false,
      };
    case "split":
      return {
        decls: [
          `background: linear-gradient(${c.angle}deg, ${c.color1} 0 50%, ${c.color2} 50% 100%);`,
          ...CLIP_LINES,
        ],
        keyframes: [],
        needsAngleProp: false,
        animated: false,
      };
    case "metallic":
      return {
        decls: [
          `background: linear-gradient(180deg, #ffffff 0%, ${c.color1} 38%, ${darken(c.color1, 0.55)} 52%, ${c.color2} 78%, #ffffff 100%);`,
          ...CLIP_LINES,
          `text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);`,
        ],
        keyframes: [],
        needsAngleProp: false,
        animated: false,
      };
    case "animated-gradient":
      return {
        decls: [
          `background: linear-gradient(${c.angle}deg, ${c.color1}, ${c.color2}, ${c.color3}, ${c.color1});`,
          `background-size: 300% 100%;`,
          ...CLIP_LINES,
          `animation: te-flow ${c.speed}s linear infinite;`,
        ],
        keyframes: ["@keyframes te-flow {", "  to { background-position: 300% 50%; }", "}"],
        needsAngleProp: false,
        animated: true,
      };
    case "aurora":
      return {
        decls: [
          `background: conic-gradient(from var(${ANGLE_VAR}), ${c.color1}, ${c.color2}, ${c.color3}, ${c.color1});`,
          ...CLIP_LINES,
          `animation: te-spin ${c.speed}s linear infinite;`,
        ],
        keyframes: ["@keyframes te-spin {", `  to { ${ANGLE_VAR}: 360deg; }`, "}"],
        needsAngleProp: true,
        animated: true,
      };
    case "outline":
      return {
        decls: [
          `color: transparent;`,
          `-webkit-text-fill-color: transparent;`,
          `-webkit-text-stroke: ${c.strokeWidth}px ${c.color1};`,
          `text-stroke: ${c.strokeWidth}px ${c.color1};`,
        ],
        keyframes: [],
        needsAngleProp: false,
        animated: false,
      };
    case "neon": {
      const g = c.glowSize;
      const col = rgba(c.color1, a);
      return {
        decls: [
          `color: #fff;`,
          `text-shadow: 0 0 ${(g * 0.25).toFixed(0)}px #fff, 0 0 ${(g * 0.5).toFixed(0)}px ${col}, ` +
            `0 0 ${g}px ${col}, 0 0 ${g * 2}px ${col}, 0 0 ${g * 4}px ${col};`,
        ],
        keyframes: [],
        needsAngleProp: false,
        animated: false,
      };
    }
    case "glow":
      return {
        decls: [
          `color: ${c.color1};`,
          `text-shadow: 0 0 ${c.glowSize}px ${rgba(c.color1, a)}, 0 0 ${c.glowSize * 2}px ${rgba(c.color1, a * 0.6)};`,
        ],
        keyframes: [],
        needsAngleProp: false,
        animated: false,
      };
    case "glass":
      return {
        decls: [
          `color: rgba(255, 255, 255, 0.1);`,
          `-webkit-text-stroke: ${Math.max(1, c.strokeWidth)}px rgba(255, 255, 255, 0.55);`,
          `text-shadow: 0 1px 1px rgba(255, 255, 255, 0.35), 0 4px 18px rgba(255, 255, 255, 0.22);`,
        ],
        keyframes: [],
        needsAngleProp: false,
        animated: false,
      };
    case "3d": {
      const sh = darken(c.color1, 0.45);
      const layers: string[] = [];
      for (let i = 1; i <= c.depth; i++) layers.push(`${i}px ${i}px 0 ${sh}`);
      layers.push(`${c.depth + 1}px ${c.depth + 1}px ${c.depth * 1.5}px rgba(0, 0, 0, 0.35)`);
      return {
        decls: [`color: ${c.color1};`, `text-shadow: ${layers.join(", ")};`],
        keyframes: [],
        needsAngleProp: false,
        animated: false,
      };
    }
  }
}

export function toCss(config: TextConfig, className = "text-effect"): string {
  const built = buildEffect(config);
  const out: string[] = [];

  if (built.needsAngleProp) {
    out.push(`@property ${ANGLE_VAR} {`, `  syntax: "<angle>";`, `  inherits: false;`, `  initial-value: 0deg;`, `}`, ``);
  }

  out.push(`.${className} {`);
  out.push(`  display: inline-block;`);
  out.push(`  font-family: ${config.fontFamily};`);
  out.push(`  font-size: ${config.fontSize}px;`);
  out.push(`  font-weight: ${config.fontWeight};`);
  out.push(`  line-height: 1.1;`);
  if (config.letterSpacing !== 0) out.push(`  letter-spacing: ${config.letterSpacing}px;`);
  if (config.italic) out.push(`  font-style: italic;`);
  if (config.uppercase) out.push(`  text-transform: uppercase;`);
  for (const d of built.decls) out.push(`  ${d}`);
  out.push(`}`);

  if (built.keyframes.length) out.push("", ...built.keyframes);

  if (built.animated) {
    out.push(
      "",
      "/* Respect users who prefer less motion */",
      "@media (prefers-reduced-motion: reduce) {",
      `  .${className} { animation: none; }`,
      "}"
    );
  }

  return out.join("\n");
}

export function toTailwind(config: TextConfig): string {
  const base = [`text-[${config.fontSize}px]`, `font-[${config.fontWeight}]`];
  if (config.italic) base.push("italic");
  if (config.uppercase) base.push("uppercase");

  const clip = ["bg-clip-text", "text-transparent"];
  let bg = "";
  switch (config.effect) {
    case "gradient":
      bg = `bg-[linear-gradient(${config.angle}deg,${config.color1},${config.color2})]`;
      break;
    case "split":
      bg = `bg-[linear-gradient(${config.angle}deg,${config.color1}_0_50%,${config.color2}_50%_100%)]`;
      break;
    case "metallic":
      bg = `bg-[linear-gradient(180deg,#ffffff,${config.color1},${config.color2})]`;
      break;
    case "outline":
      return (
        `<span class="${base.join(" ")} text-transparent [-webkit-text-stroke:${config.strokeWidth}px_${config.color1}]">\n` +
        `  ${config.text}\n</span>`
      );
    default:
      // Animated / shadow-based effects need the full CSS.
      return (
        `<span class="text-effect ${base.join(" ")}">${config.text}</span>\n` +
        `<!-- This effect uses ${config.effect === "aurora" || config.effect === "animated-gradient" ? "an animation and @keyframes" : "a text-shadow stack"} — copy the rule from the CSS tab. -->`
      );
  }

  return `<span class="${[...base, bg, ...clip].join(" ")}">\n  ${config.text}\n</span>`;
}

/* --------------------------- Creative helpers --------------------------- */

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/** A tasteful, harmonious color trio for the shuffle button. */
export function randomColors(): { color1: string; color2: string; color3: string } {
  const base = Math.floor(Math.random() * 360);
  const sat = 70 + Math.random() * 15;
  return {
    color1: hslToHex(base, sat, 58),
    color2: hslToHex((base + 45) % 360, sat, 55),
    color3: hslToHex((base + 90) % 360, sat, 62),
  };
}
