/**
 * Code-image engine. Turns a snippet into a polished, shareable PNG —
 * syntax-highlighted, in a window frame, on a backdrop. Highlighting is done
 * by Shiki (VS Code's grammars and themes) and the tokens are drawn by hand
 * onto a <canvas>, so the export is crisp and deterministic.
 *
 * Shiki is loaded piece by piece: the core, a JavaScript regex engine (no
 * WebAssembly to fetch and compile), and only the one grammar and one theme
 * in use. Until those arrive the code is drawn plain, so there is always a
 * picture on screen.
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

/** File extensions → language, so naming the window `main.py` picks Python. */
const EXTENSIONS: Record<string, Lang> = {
  ts: "typescript", mts: "typescript", cts: "typescript", js: "javascript", mjs: "javascript", cjs: "javascript",
  tsx: "tsx", jsx: "jsx", json: "json", html: "html", htm: "html", css: "css", py: "python", sh: "bash",
  bash: "bash", zsh: "bash", go: "go", rs: "rust", java: "java", c: "c", h: "c", cpp: "cpp", cc: "cpp",
  hpp: "cpp", cs: "csharp", php: "php", rb: "ruby", sql: "sql", yml: "yaml", yaml: "yaml", md: "markdown",
  swift: "swift", kt: "kotlin", graphql: "graphql", gql: "graphql", txt: "text",
};

export function langFromFilename(name: string): Lang | null {
  if (/^dockerfile$/i.test(name.trim())) return "dockerfile";
  const ext = name.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return (ext && EXTENSIONS[ext]) || null;
}

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
  /** Gradient colors (two for a sweep, three or more for a mesh), or null for transparent / theme-derived. */
  stops: string[] | null;
  /** Soft blobs of each color over the first, instead of a straight sweep. */
  mesh?: boolean;
}

export const BACKDROPS: Backdrop[] = [
  // "theme" derives its gradient from the editor background at render time.
  { id: "theme", name: "Match theme", stops: null },
  { id: "emerald", name: "Emerald", stops: ["#34d399", "#0ea5e9"] },
  { id: "aurora", name: "Aurora", stops: ["#22d3ee", "#818cf8"] },
  { id: "candy", name: "Candy", stops: ["#f472b6", "#a78bfa"] },
  { id: "sunset", name: "Sunset", stops: ["#fb7185", "#f59e0b"] },
  { id: "ocean", name: "Ocean", stops: ["#0ea5e9", "#2dd4bf"] },
  { id: "peach", name: "Peach", stops: ["#fed7aa", "#fda4af"] },
  { id: "lime", name: "Lime", stops: ["#bef264", "#34d399"] },
  { id: "royal", name: "Royal", stops: ["#4f46e5", "#9333ea"] },
  { id: "ember", name: "Ember", stops: ["#f97316", "#b91c1c"] },
  { id: "forest", name: "Forest", stops: ["#065f46", "#0b0f0e"] },
  { id: "mono", name: "Mono", stops: ["#3f3f46", "#18181b"] },
  { id: "paper", name: "Paper", stops: ["#f8fafc", "#e2e8f0"] },
  { id: "mesh-lagoon", name: "Lagoon mesh", stops: ["#0e7490", "#22d3ee", "#34d399", "#1d4ed8"], mesh: true },
  { id: "mesh-candy", name: "Candy mesh", stops: ["#ff8fb8", "#ff5fa2", "#ffb347", "#7c4dff"], mesh: true },
  { id: "mesh-iris", name: "Iris mesh", stops: ["#4338ca", "#6366f1", "#a855f7", "#06b6d4"], mesh: true },
  { id: "mesh-dusk", name: "Dusk mesh", stops: ["#1e1b4b", "#fb7185", "#7c3aed", "#f59e0b"], mesh: true },
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

export type FrameRatio = "auto" | "16:9" | "4:3" | "1:1" | "4:5";
export const FRAME_RATIOS: { id: FrameRatio; label: string; ratio: number | null }[] = [
  { id: "auto", label: "Fit", ratio: null },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
];

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
  windowChrome: "mac" | "outline" | "minimal" | "none";
  title: string;
  radius: number;
  shadow: boolean;
  /** Lines to spotlight, as written: "2-4, 7". The rest dim. */
  focus: string;
  /** Pad the picture out to a fixed shape, for feeds that crop. */
  ratio: FrameRatio;
  /** Small credit set in the corner of the backdrop. */
  caption: string;
  /** Export resolution multiplier. */
  scale: number;
}

export const DEFAULT_CODE = `// tm tools — code image generator
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
  focus: "",
  ratio: "auto",
  caption: "",
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

const expandTabs = (code: string, tabSize: number) => (code || " ").replace(/\t/g, " ".repeat(tabSize));

/** The code with no coloring — what is drawn until the highlighter is ready. */
export function plainTokens(code: string, tabSize = 2, bg = "#282c34", fg = "#abb2bf"): Highlighted {
  return { lines: expandTabs(code, tabSize).split("\n").map((text) => [{ text, color: fg }]), bg, fg };
}

type Highlighter = Awaited<ReturnType<(typeof import("shiki/core"))["createHighlighterCore"]>>;
interface Engine {
  highlighter: Highlighter;
  langs: (typeof import("shiki/langs"))["bundledLanguages"];
  themes: (typeof import("shiki/themes"))["bundledThemes"];
}
let engine: Promise<Engine> | null = null;

/** Start fetching the highlighter. Safe to call early and often. */
export function warmHighlighter(): Promise<Engine> {
  engine ??= Promise.all([
    import("shiki/core"),
    import("shiki/engine/javascript"),
    import("shiki/langs"),
    import("shiki/themes"),
  ]).then(async ([core, js, langs, themes]) => ({
    highlighter: await core.createHighlighterCore({
      themes: [],
      langs: [],
      engine: js.createJavaScriptRegexEngine({ forgiving: true }),
    }),
    langs: langs.bundledLanguages,
    themes: themes.bundledThemes,
  }));
  return engine;
}

/**
 * Syntax-highlight `code`, returning lines of colored tokens plus the theme's
 * background/foreground. Tabs are expanded so the monospace grid stays
 * aligned. Unknown languages fall back to plain text.
 */
export async function highlightCode(code: string, lang: Lang, themeId: string, tabSize = 2): Promise<Highlighted> {
  const { highlighter, langs, themes } = await warmHighlighter();
  const src = expandTabs(code, tabSize);

  const theme = themeId in themes ? themeId : "one-dark-pro";
  if (!highlighter.getLoadedThemes().includes(theme)) await highlighter.loadTheme(themes[theme as keyof typeof themes]);
  let language = lang in langs ? lang : "text";
  if (language !== "text" && !highlighter.getLoadedLanguages().includes(language)) {
    try {
      await highlighter.loadLanguage(langs[language as keyof typeof langs]);
    } catch {
      language = "text";
    }
  }

  const result = highlighter.codeToTokens(src, { lang: language as never, theme: theme as never });
  return {
    lines: result.tokens.map((line) =>
      line.map((t) => ({ text: t.content, color: t.color || result.fg || "#e6e6e6" }))
    ),
    bg: result.bg || "#0b0f0e",
    fg: result.fg || "#e6e6e6",
  };
}

/** Read "2-4, 7" into the set of 1-based line numbers it names. */
export function parseFocus(spec: string, lineCount: number): Set<number> {
  const out = new Set<number>();
  for (const part of spec.split(/[,\s]+/)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = Math.min(a, b); n <= Math.max(a, b) && n <= lineCount; n++) if (n >= 1) out.add(n);
  }
  return out;
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

const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

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

/** CSS for a backdrop's picker chip. */
export function backdropCss(b: Backdrop): string {
  if (!b.stops) {
    return b.id === "theme"
      ? "linear-gradient(135deg,#475569,#1e293b)"
      : "repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 8px 8px";
  }
  if (!b.mesh) return `linear-gradient(135deg,${b.stops[0]},${b.stops[1]})`;
  const [base, ...blobs] = b.stops;
  const at = ["12% 12%", "90% 20%", "80% 95%"];
  return `${blobs.map((c, i) => `radial-gradient(circle at ${at[i % 3]}, ${c}, transparent 65%)`).join(", ")}, ${base}`;
}

/**
 * Render highlighted code onto the canvas at `scale` device pixels per unit.
 * Returns the logical size of the picture.
 */
export function renderCodeshot(
  canvas: HTMLCanvasElement,
  config: CodeshotConfig,
  hl: Highlighted,
  scale: number
): { width: number; height: number } {
  const backdrop = BACKDROPS.find((b) => b.id === config.backdropId);
  const stops: string[] | null =
    config.backdropId === "custom"
      ? [config.customBg1, config.customBg2]
      : config.backdropId === "theme"
        ? [shade(hl.bg, 0.18), shade(hl.bg, -0.12)]
        : (backdrop?.stops ?? null);

  const lines = hl.lines.length ? hl.lines : [[]];
  const lineCount = lines.length;
  const focus = parseFocus(config.focus, lineCount);

  const fontSize = config.fontSize;
  const lineHeight = Math.round(fontSize * 1.65);
  const family = resolveFontFamily(config.fontFamily);
  const fontStr = `${fontSize}px ${family}`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return { width: 0, height: 0 };
  ctx.font = fontStr;
  const charW = ctx.measureText("M").width || fontSize * 0.6;

  const maxCols = lines.reduce((max, line) => Math.max(max, line.reduce((s, t) => s + t.text.length, 0)), 1);

  const chromeH = config.windowChrome === "mac" || config.windowChrome === "outline" ? 46 : config.windowChrome === "minimal" ? 36 : 22;
  const editorPadX = 24;
  const editorPadBottom = 24;
  const gutterW = config.lineNumbers ? String(lineCount).length * charW + 28 : 0;

  const codeW = maxCols * charW;
  const editorW = Math.ceil(Math.max(editorPadX * 2 + gutterW + codeW, 240));
  const editorH = Math.ceil(chromeH + lineCount * lineHeight + editorPadBottom);

  const pad = config.padding;
  let W = editorW + pad * 2;
  let H = editorH + pad * 2;
  // A fixed shape only ever adds backdrop around the window; the code is never scaled.
  const ratio = FRAME_RATIOS.find((r) => r.id === config.ratio)?.ratio;
  if (ratio) {
    if (W / H < ratio) W = Math.ceil(H * ratio);
    else H = Math.ceil(W / ratio);
  }

  canvas.width = Math.ceil(W * scale);
  canvas.height = Math.ceil(H * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (stops) {
    if (backdrop?.mesh && config.backdropId !== "custom") {
      ctx.fillStyle = stops[0];
      ctx.fillRect(0, 0, W, H);
      const at = [[0.1, 0.1], [0.92, 0.18], [0.82, 0.96], [0.08, 0.92]];
      const reach = Math.max(W, H) * 0.7;
      stops.slice(1).forEach((color, i) => {
        const [bx, by] = at[i % at.length];
        const g = ctx.createRadialGradient(W * bx, H * by, 0, W * bx, H * by, reach);
        const [r, gg, b] = hexToRgb(color);
        g.addColorStop(0, `rgba(${r},${gg},${b},0.95)`);
        g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      });
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, stops[0]);
      g.addColorStop(1, stops[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  const ex = Math.round((W - editorW) / 2);
  const ey = Math.round((H - editorH) / 2);

  if (config.shadow) {
    // A wide soft shadow for lift, and a tight one where the window meets the page.
    for (const [blur, offset, alpha] of [[64, 32, 0.34], [14, 6, 0.22]]) {
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${alpha})`;
      ctx.shadowBlur = blur * scale;
      ctx.shadowOffsetY = offset * scale;
      roundRectPath(ctx, ex, ey, editorW, editorH, config.radius);
      ctx.fillStyle = hl.bg;
      ctx.fill();
      ctx.restore();
    }
  }
  roundRectPath(ctx, ex, ey, editorW, editorH, config.radius);
  ctx.fillStyle = hl.bg;
  ctx.fill();
  // A hairline, so a dark window keeps its edge on a dark backdrop.
  const dark = luminance(hl.bg.startsWith("#") ? hl.bg : "#222222") < 0.5;
  ctx.lineWidth = 1;
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  roundRectPath(ctx, ex + 0.5, ey + 0.5, editorW - 1, editorH - 1, config.radius);
  ctx.stroke();

  if (config.windowChrome === "mac" || config.windowChrome === "outline") {
    const cy = ey + 23;
    ["#ff5f56", "#ffbd2e", "#27c93f"].forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(ex + 22 + i * 20, cy, 6, 0, Math.PI * 2);
      if (config.windowChrome === "mac") {
        ctx.fillStyle = c;
        ctx.fill();
      } else {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = hl.fg;
        ctx.globalAlpha = 0.35;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
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
  const bandLift = (lineHeight - fontSize) / 2 - 1;
  lines.forEach((line, idx) => {
    const lit = focus.size === 0 || focus.has(idx + 1);
    if (focus.size && lit) {
      // The spotlight: a band across the window with a bar down its left edge.
      ctx.fillStyle = hl.fg;
      ctx.globalAlpha = 0.09;
      ctx.fillRect(ex, y - bandLift, editorW, lineHeight);
      ctx.globalAlpha = 0.75;
      ctx.fillRect(ex, y - bandLift, 3, lineHeight);
      ctx.globalAlpha = 1;
    }
    const strength = lit ? 1 : 0.38;
    if (config.lineNumbers) {
      ctx.fillStyle = hl.fg;
      ctx.globalAlpha = 0.4 * strength;
      ctx.textAlign = "right";
      ctx.fillText(String(idx + 1), ex + editorPadX + gutterW - 14, y);
      ctx.textAlign = "left";
    }
    ctx.globalAlpha = strength;
    let x = codeX;
    for (const tok of line) {
      ctx.fillStyle = tok.color;
      ctx.fillText(tok.text, x, y);
      x += tok.text.length * charW;
    }
    ctx.globalAlpha = 1;
    y += lineHeight;
  });
  ctx.restore();

  // Credit, set into the backdrop under the window.
  const room = H - (ey + editorH);
  if (config.caption.trim() && stops && room >= 30) {
    const light = luminance(stops[stops.length > 2 ? 0 : 1].startsWith("#") ? stops[stops.length > 2 ? 0 : 1] : hl.bg) > 0.6;
    ctx.font = `500 ${Math.min(14, Math.max(11, room * 0.3))}px ${family}`;
    ctx.fillStyle = light ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.78)";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(config.caption.trim(), ex + editorW, ey + editorH + room / 2);
    ctx.textAlign = "left";
  }

  return { width: W, height: H };
}
