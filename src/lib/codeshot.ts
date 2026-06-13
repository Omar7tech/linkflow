/**
 * Code-image engine. Turns a snippet into a polished, shareable PNG —
 * syntax-highlighted, in a window frame, on a gradient backdrop. Highlighting
 * is done by Shiki (VS Code's engine — hundreds of languages, real themes),
 * and we render the resulting tokens by hand onto a <canvas> so the PNG export
 * is crisp and deterministic. Shiki is dynamically imported (its own chunk,
 * SSR-safe). All on-device.
 */

export type Lang = string;

export const LANGUAGES: { id: Lang; label: string }[] = [
  { id: "typescript", label: "TypeScript" },
  { id: "javascript", label: "JavaScript" },
  { id: "tsx", label: "TSX" },
  { id: "jsx", label: "JSX" },
  { id: "json", label: "JSON" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "python", label: "Python" },
  { id: "bash", label: "Bash / Shell" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
  { id: "sql", label: "SQL" },
  { id: "yaml", label: "YAML" },
  { id: "markdown", label: "Markdown" },
  { id: "swift", label: "Swift" },
  { id: "kotlin", label: "Kotlin" },
  { id: "graphql", label: "GraphQL" },
  { id: "dockerfile", label: "Dockerfile" },
  { id: "text", label: "Plain text" },
];

/** Shiki bundled themes. The real bg/fg come from Shiki at highlight time. */
export const CODE_THEMES: { id: string; name: string; dark: boolean }[] = [
  // Dark
  { id: "one-dark-pro", name: "One Dark Pro", dark: true },
  { id: "github-dark-default", name: "GitHub Dark", dark: true },
  { id: "github-dark-dimmed", name: "GitHub Dark Dimmed", dark: true },
  { id: "dracula", name: "Dracula", dark: true },
  { id: "dracula-soft", name: "Dracula Soft", dark: true },
  { id: "tokyo-night", name: "Tokyo Night", dark: true },
  { id: "night-owl", name: "Night Owl", dark: true },
  { id: "nord", name: "Nord", dark: true },
  { id: "vitesse-dark", name: "Vitesse Dark", dark: true },
  { id: "vitesse-black", name: "Vitesse Black", dark: true },
  { id: "vesper", name: "Vesper", dark: true },
  { id: "poimandres", name: "Poimandres", dark: true },
  { id: "material-theme", name: "Material", dark: true },
  { id: "material-theme-ocean", name: "Material Ocean", dark: true },
  { id: "material-theme-palenight", name: "Material Palenight", dark: true },
  { id: "catppuccin-mocha", name: "Catppuccin Mocha", dark: true },
  { id: "catppuccin-macchiato", name: "Catppuccin Macchiato", dark: true },
  { id: "monokai", name: "Monokai", dark: true },
  { id: "synthwave-84", name: "Synthwave '84", dark: true },
  { id: "andromeeda", name: "Andromeeda", dark: true },
  { id: "aurora-x", name: "Aurora X", dark: true },
  { id: "laserwave", name: "LaserWave", dark: true },
  { id: "ayu-dark", name: "Ayu Dark", dark: true },
  { id: "kanagawa-wave", name: "Kanagawa Wave", dark: true },
  { id: "kanagawa-dragon", name: "Kanagawa Dragon", dark: true },
  { id: "everforest-dark", name: "Everforest Dark", dark: true },
  { id: "gruvbox-dark-medium", name: "Gruvbox Dark", dark: true },
  { id: "rose-pine", name: "Rosé Pine", dark: true },
  { id: "rose-pine-moon", name: "Rosé Pine Moon", dark: true },
  { id: "slack-dark", name: "Slack Dark", dark: true },
  { id: "solarized-dark", name: "Solarized Dark", dark: true },
  // Light
  { id: "github-light-default", name: "GitHub Light", dark: false },
  { id: "one-light", name: "One Light", dark: false },
  { id: "vitesse-light", name: "Vitesse Light", dark: false },
  { id: "catppuccin-latte", name: "Catppuccin Latte", dark: false },
  { id: "ayu-light", name: "Ayu Light", dark: false },
  { id: "night-owl-light", name: "Night Owl Light", dark: false },
  { id: "rose-pine-dawn", name: "Rosé Pine Dawn", dark: false },
  { id: "snazzy-light", name: "Snazzy Light", dark: false },
  { id: "everforest-light", name: "Everforest Light", dark: false },
  { id: "solarized-light", name: "Solarized Light", dark: false },
  { id: "min-light", name: "Min Light", dark: false },
];

export interface Backdrop {
  id: string;
  name: string;
  /** Two-stop gradient, or null for transparent. */
  stops: [string, string] | null;
}

export const BACKDROPS: Backdrop[] = [
  // "theme" derives its gradient from the editor background at render time.
  { id: "theme", name: "Match theme", stops: null },
  { id: "emerald", name: "Emerald", stops: ["#34d399", "#0ea5e9"] },
  { id: "aurora", name: "Aurora", stops: ["#22d3ee", "#818cf8"] },
  { id: "candy", name: "Candy", stops: ["#f472b6", "#a78bfa"] },
  { id: "sunset", name: "Sunset", stops: ["#fb7185", "#f59e0b"] },
  { id: "ocean", name: "Ocean", stops: ["#0ea5e9", "#2dd4bf"] },
  { id: "forest", name: "Forest", stops: ["#065f46", "#0b0f0e"] },
  { id: "mono", name: "Mono", stops: ["#3f3f46", "#18181b"] },
  { id: "none", name: "Transparent", stops: null },
];

export const CODE_FONTS: { label: string; value: string }[] = [
  { label: "JetBrains Mono", value: "--font-jetbrains" },
  { label: "Fira Code", value: "--font-fira" },
  { label: "Geist Mono", value: "--font-geist-mono" },
  { label: "System Mono", value: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
];

/**
 * Resolve a font value to a real family string for canvas. CSS variables
 * (next/font) can't be used directly in canvas font shorthand, so we read the
 * computed value off the document root.
 */
export function resolveFontFamily(value: string): string {
  if (value.startsWith("--")) {
    if (typeof window === "undefined") return "ui-monospace, monospace";
    const resolved = getComputedStyle(document.documentElement).getPropertyValue(value).trim();
    return resolved || "ui-monospace, monospace";
  }
  return value;
}

export interface CodeshotConfig {
  code: string;
  language: Lang;
  themeId: string;
  backdropId: string;
  customBg1: string;
  customBg2: string;
  padding: number;
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  lineNumbers: boolean;
  windowChrome: "mac" | "minimal" | "none";
  title: string;
  radius: number;
  shadow: boolean;
  /** Export resolution multiplier. */
  scale: number;
}

export const DEFAULT_CODE = `// forma — code image generator
export function greet(name: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : "evening";
  return \`Good \${part}, \${name}!\`;
}

greet("designer");`;

export const DEFAULT_CODESHOT: CodeshotConfig = {
  code: DEFAULT_CODE,
  language: "typescript",
  themeId: "one-dark-pro",
  backdropId: "theme",
  customBg1: "#34d399",
  customBg2: "#0ea5e9",
  padding: 48,
  fontSize: 15,
  fontFamily: "--font-jetbrains",
  tabSize: 2,
  lineNumbers: true,
  windowChrome: "mac",
  title: "app.ts",
  radius: 12,
  shadow: true,
  scale: 2,
};

export interface HighlightedToken {
  text: string;
  color: string;
}

export interface Highlighted {
  lines: HighlightedToken[][];
  bg: string;
  fg: string;
}

let shikiP: Promise<typeof import("shiki")> | null = null;
function loadShiki() {
  shikiP ??= import("shiki");
  return shikiP;
}

/**
 * Syntax-highlight `code` with Shiki, returning lines of colored tokens plus
 * the theme's background/foreground. Tabs are expanded so the monospace grid
 * stays aligned. Unknown languages fall back to plain text.
 */
export async function highlightCode(
  code: string,
  lang: Lang,
  themeId: string,
  tabSize = 2
): Promise<Highlighted> {
  const { codeToTokens } = await loadShiki();
  const src = (code || " ").replace(/\t/g, " ".repeat(tabSize));
  const opts = (language: string) => ({ lang: language as never, theme: themeId as never });

  let result;
  try {
    result = await codeToTokens(src, opts(lang));
  } catch {
    result = await codeToTokens(src, opts("text"));
  }

  return {
    lines: result.tokens.map((line) =>
      line.map((t) => ({ text: t.content, color: t.color || result.fg || "#e6e6e6" }))
    ),
    bg: result.bg || "#0b0f0e",
    fg: result.fg || "#e6e6e6",
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Lighten (amt>0) or darken (amt<0) a hex color toward white/black. */
function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const mix = (c: number) => Math.round(c + (t - c) * p);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Render highlighted code onto the canvas. Returns the logical (CSS-px) size;
 * the bitmap is `scale`× larger for crisp exports.
 */
export function renderCodeshot(
  canvas: HTMLCanvasElement,
  config: CodeshotConfig,
  hl: Highlighted
): { width: number; height: number } {
  const backdrop = BACKDROPS.find((b) => b.id === config.backdropId);
  const stops: [string, string] | null =
    config.backdropId === "custom"
      ? [config.customBg1, config.customBg2]
      : config.backdropId === "theme"
        ? [shade(hl.bg, 0.18), shade(hl.bg, -0.12)]
        : (backdrop?.stops ?? null);

  const lines = hl.lines.length ? hl.lines : [[]];
  const lineCount = lines.length;

  const fontSize = config.fontSize;
  const lineHeight = Math.round(fontSize * 1.65);
  const family = resolveFontFamily(config.fontFamily);
  const fontStr = `${fontSize}px ${family}`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return { width: 0, height: 0 };
  ctx.font = fontStr;
  const charW = ctx.measureText("M").width || fontSize * 0.6;

  const maxCols = lines.reduce((max, line) => {
    const len = line.reduce((s, t) => s + t.text.length, 0);
    return Math.max(max, len);
  }, 1);

  const chromeH = config.windowChrome === "mac" ? 46 : config.windowChrome === "minimal" ? 36 : 22;
  const editorPadX = 24;
  const editorPadBottom = 24;
  const gutterW = config.lineNumbers ? String(lineCount).length * charW + 28 : 0;

  const codeW = maxCols * charW;
  const editorW = Math.ceil(Math.max(editorPadX * 2 + gutterW + codeW, 240));
  const editorH = Math.ceil(chromeH + lineCount * lineHeight + editorPadBottom);

  const pad = config.padding;
  const W = editorW + pad * 2;
  const H = editorH + pad * 2;

  const dpr = config.scale;
  canvas.width = Math.ceil(W * dpr);
  canvas.height = Math.ceil(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (stops) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, stops[0]);
    g.addColorStop(1, stops[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const ex = pad;
  const ey = pad;

  if (config.shadow) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.38)";
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 24;
    roundRectPath(ctx, ex, ey, editorW, editorH, config.radius);
    ctx.fillStyle = hl.bg;
    ctx.fill();
    ctx.restore();
  }
  roundRectPath(ctx, ex, ey, editorW, editorH, config.radius);
  ctx.fillStyle = hl.bg;
  ctx.fill();

  if (config.windowChrome === "mac") {
    const cy = ey + 23;
    ["#ff5f56", "#ffbd2e", "#27c93f"].forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(ex + 22 + i * 20, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    });
  }
  if (config.title && config.windowChrome !== "none") {
    ctx.font = `${Math.max(11, fontSize - 2)}px ${family}`;
    ctx.fillStyle = hl.fg;
    ctx.globalAlpha = 0.6;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(config.title, ex + editorW / 2, ey + chromeH / 2);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  ctx.save();
  roundRectPath(ctx, ex, ey, editorW, editorH, config.radius);
  ctx.clip();
  ctx.font = fontStr;
  ctx.textBaseline = "top";

  let y = ey + chromeH;
  const codeX = ex + editorPadX + gutterW;
  lines.forEach((line, idx) => {
    if (config.lineNumbers) {
      ctx.fillStyle = hl.fg;
      ctx.globalAlpha = 0.4;
      ctx.textAlign = "right";
      ctx.fillText(String(idx + 1), ex + editorPadX + gutterW - 14, y);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }
    let x = codeX;
    for (const tok of line) {
      ctx.fillStyle = tok.color;
      ctx.fillText(tok.text, x, y);
      x += tok.text.length * charW;
    }
    y += lineHeight;
  });
  ctx.restore();

  return { width: W, height: H };
}
