/**
 * OG Image Studio engine. Designs social share cards (Open Graph / Twitter /
 * LinkedIn / stories / YouTube thumbnails …) and renders them onto a <canvas>
 * so the PNG export is pixel-for-pixel what you see, at any resolution.
 *
 * Everything is config-driven: one design re-lays out across every size preset.
 * The renderer also powers the code exporters (meta tags + a drop-in Next.js
 * `opengraph-image` route) further down.
 */

/* ------------------------------- size presets ----------------------------- */

export type SizeId =
  | "og"
  | "x"
  | "linkedin"
  | "square"
  | "story"
  | "youtube"
  | "devto"
  | "producthunt";

export interface SizePreset {
  id: SizeId;
  name: string;
  group: string;
  w: number;
  h: number;
}

export const SIZES: SizePreset[] = [
  { id: "og", name: "Open Graph", group: "Universal · 1.91:1", w: 1200, h: 630 },
  { id: "x", name: "X / Twitter", group: "Post image · 16:9", w: 1600, h: 900 },
  { id: "linkedin", name: "LinkedIn", group: "Link post", w: 1200, h: 627 },
  { id: "devto", name: "Dev.to cover", group: "Article cover", w: 1000, h: 420 },
  { id: "youtube", name: "YouTube", group: "Thumbnail · 16:9", w: 1280, h: 720 },
  { id: "producthunt", name: "Product Hunt", group: "Gallery", w: 1270, h: 760 },
  { id: "square", name: "Square", group: "Instagram · 1:1", w: 1080, h: 1080 },
  { id: "story", name: "Story", group: "Vertical · 9:16", w: 1080, h: 1920 },
];

/* ----------------------------------- fonts -------------------------------- */

export const OG_FONTS: { label: string; value: string }[] = [
  { label: "Geist Sans", value: "--font-geist-sans" },
  { label: "Space Grotesk", value: "--font-space-grotesk" },
  { label: "Geist Mono", value: "--font-geist-mono" },
  { label: "System Sans", value: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
];

/** CSS-variable fonts (next/font) can't be used in canvas shorthand directly. */
export function resolveFont(value: string): string {
  if (value.startsWith("--")) {
    if (typeof window === "undefined") return "system-ui, sans-serif";
    const v = getComputedStyle(document.documentElement).getPropertyValue(value).trim();
    return v || "system-ui, sans-serif";
  }
  return value;
}

/* --------------------------------- config --------------------------------- */

export type BgType = "gradient" | "mesh" | "solid" | "image";
export type PatternType = "none" | "dots" | "grid" | "lines";
export type Align = "left" | "center";
export type VAnchor = "top" | "center" | "bottom";
export type LogoSlot = "none" | "top" | "footer";

export interface MeshBlob {
  x: number; // 0..1
  y: number; // 0..1
  color: string;
}

export interface OgConfig {
  sizeId: SizeId;

  // Background
  bgType: BgType;
  gradFrom: string;
  gradTo: string;
  gradAngle: number;
  meshBase: string;
  mesh: MeshBlob[];
  solid: string;
  imageOverlay: string;
  imageOverlayOpacity: number; // 0..1
  imageBlur: number; // px in design space

  // Pattern overlay
  pattern: PatternType;
  patternColor: string;
  patternOpacity: number; // 0..1

  // Effects
  grain: number; // 0..1
  vignette: number; // 0..1
  topGlow: boolean;
  glass: boolean;

  // Content
  eyebrow: string;
  showEyebrow: boolean;
  title: string; // supports *highlight* markup
  description: string;
  titleFont: string;
  bodyFont: string;
  titleWeight: number;
  textColor: string;
  mutedColor: string;
  accentFrom: string;
  accentTo: string;
  accentGradient: boolean;
  align: Align;
  vAnchor: VAnchor;
  titleScale: number; // multiplier
  descScale: number;
  autoFit: boolean;

  // Branding
  logoSlot: LogoSlot;
  authorName: string;
  authorHandle: string;
  domain: string;
  showFooter: boolean;

  // Export
  scale: number;
}

export interface OgAssets {
  logo?: HTMLImageElement | null;
  avatar?: HTMLImageElement | null;
  bg?: HTMLImageElement | null;
}

export const DEFAULT_OG: OgConfig = {
  sizeId: "og",

  bgType: "mesh",
  gradFrom: "#0b3d2e",
  gradTo: "#022c22",
  gradAngle: 135,
  meshBase: "#04140f",
  mesh: [
    { x: 0.15, y: 0.2, color: "#059669" },
    { x: 0.85, y: 0.15, color: "#0ea5e9" },
    { x: 0.75, y: 0.9, color: "#10b981" },
  ],
  solid: "#04140f",
  imageOverlay: "#02120c",
  imageOverlayOpacity: 0.5,
  imageBlur: 0,

  pattern: "none",
  patternColor: "#ffffff",
  patternOpacity: 0.06,

  grain: 0.12,
  vignette: 0.28,
  topGlow: true,
  glass: false,

  eyebrow: "Introducing",
  showEyebrow: true,
  title: "Ship *share cards* that actually convert",
  description:
    "Design once, export for Open Graph, X, LinkedIn and stories — all from your browser.",
  titleFont: "--font-space-grotesk",
  bodyFont: "--font-geist-sans",
  titleWeight: 800,
  textColor: "#f0fdf4",
  mutedColor: "#a7f3d0",
  accentFrom: "#34d399",
  accentTo: "#22d3ee",
  accentGradient: true,
  align: "left",
  vAnchor: "center",
  titleScale: 1,
  descScale: 1,
  autoFit: true,

  logoSlot: "top",
  authorName: "Forma",
  authorHandle: "@formatools",
  domain: "forma.tools",
  showFooter: true,

  scale: 2,
};

/* -------------------------------- templates ------------------------------- */

/** Curated starting points. Each patches a slice of the config. */
export const TEMPLATES: { id: string; name: string; patch: Partial<OgConfig> }[] = [
  {
    id: "editorial",
    name: "Editorial",
    patch: {
      bgType: "mesh",
      meshBase: "#04140f",
      mesh: [
        { x: 0.15, y: 0.2, color: "#059669" },
        { x: 0.85, y: 0.15, color: "#0ea5e9" },
        { x: 0.75, y: 0.9, color: "#10b981" },
      ],
      align: "left",
      vAnchor: "center",
      titleFont: "--font-space-grotesk",
      accentGradient: true,
      accentFrom: "#34d399",
      accentTo: "#22d3ee",
      topGlow: true,
      glass: false,
      textColor: "#f0fdf4",
      mutedColor: "#a7f3d0",
      pattern: "none",
    },
  },
  {
    id: "spotlight",
    name: "Spotlight",
    patch: {
      bgType: "gradient",
      gradFrom: "#052e26",
      gradTo: "#020617",
      gradAngle: 160,
      align: "center",
      vAnchor: "center",
      topGlow: true,
      glass: false,
      pattern: "dots",
      patternOpacity: 0.05,
      accentGradient: true,
      accentFrom: "#6ee7b7",
      accentTo: "#38bdf8",
    },
  },
  {
    id: "terminal",
    name: "Terminal",
    patch: {
      bgType: "solid",
      solid: "#05070a",
      titleFont: "--font-geist-mono",
      bodyFont: "--font-geist-mono",
      titleWeight: 700,
      align: "left",
      vAnchor: "center",
      pattern: "grid",
      patternColor: "#34d399",
      patternOpacity: 0.08,
      accentGradient: false,
      accentFrom: "#34d399",
      textColor: "#e2fbf0",
      mutedColor: "#6ee7b7",
      topGlow: false,
      grain: 0.06,
    },
  },
  {
    id: "glass",
    name: "Glass card",
    patch: {
      bgType: "mesh",
      meshBase: "#020617",
      mesh: [
        { x: 0.2, y: 0.25, color: "#0ea5e9" },
        { x: 0.8, y: 0.2, color: "#8b5cf6" },
        { x: 0.6, y: 0.85, color: "#10b981" },
      ],
      glass: true,
      align: "left",
      vAnchor: "center",
      pattern: "none",
      topGlow: false,
      grain: 0.1,
      accentGradient: true,
      accentFrom: "#a7f3d0",
      accentTo: "#7dd3fc",
    },
  },
  {
    id: "quote",
    name: "Quote",
    patch: {
      bgType: "gradient",
      gradFrom: "#064e3b",
      gradTo: "#022c22",
      gradAngle: 120,
      align: "center",
      vAnchor: "center",
      showEyebrow: false,
      titleFont: "Georgia, 'Times New Roman', serif",
      titleWeight: 600,
      accentGradient: false,
      accentFrom: "#5eead4",
      pattern: "none",
      grain: 0.1,
      vignette: 0.35,
    },
  },
  {
    id: "launch",
    name: "Launch",
    patch: {
      bgType: "mesh",
      meshBase: "#0a0a0a",
      mesh: [
        { x: 0.5, y: 0.1, color: "#10b981" },
        { x: 0.9, y: 0.8, color: "#f59e0b" },
        { x: 0.1, y: 0.85, color: "#0ea5e9" },
      ],
      align: "left",
      vAnchor: "bottom",
      topGlow: true,
      glass: false,
      pattern: "none",
      accentGradient: true,
      accentFrom: "#fcd34d",
      accentTo: "#34d399",
      textColor: "#ffffff",
      mutedColor: "#d1fae5",
    },
  },
  {
    id: "clean",
    name: "Clean light",
    patch: {
      bgType: "solid",
      solid: "#f8fafc",
      align: "left",
      vAnchor: "center",
      textColor: "#0b1120",
      mutedColor: "#475569",
      accentGradient: true,
      accentFrom: "#059669",
      accentTo: "#0ea5e9",
      pattern: "dots",
      patternColor: "#0f172a",
      patternOpacity: 0.05,
      topGlow: false,
      grain: 0,
      vignette: 0,
    },
  },
  {
    id: "poster",
    name: "Big type",
    patch: {
      bgType: "gradient",
      gradFrom: "#059669",
      gradTo: "#0369a1",
      gradAngle: 145,
      align: "left",
      vAnchor: "center",
      titleScale: 1.25,
      showEyebrow: false,
      accentGradient: false,
      accentFrom: "#ecfeff",
      textColor: "#ffffff",
      mutedColor: "#e0f2fe",
      pattern: "none",
      topGlow: false,
      grain: 0.14,
    },
  },
];

/** Ready-made background swatches for the gradient picker. */
export const GRADIENT_PRESETS: { name: string; from: string; to: string; angle: number }[] = [
  { name: "Emerald", from: "#0b3d2e", to: "#022c22", angle: 135 },
  { name: "Deep sea", from: "#052e26", to: "#020617", angle: 160 },
  { name: "Teal sky", from: "#0f766e", to: "#0369a1", angle: 145 },
  { name: "Aurora", from: "#065f46", to: "#4c1d95", angle: 140 },
  { name: "Sunrise", from: "#059669", to: "#b45309", angle: 130 },
  { name: "Ink", from: "#111827", to: "#030712", angle: 150 },
  { name: "Mint light", from: "#d1fae5", to: "#e0f2fe", angle: 135 },
  { name: "Slate", from: "#334155", to: "#0f172a", angle: 160 },
];

export const MESH_PRESETS: { name: string; base: string; blobs: MeshBlob[] }[] = [
  {
    name: "Emerald haze",
    base: "#04140f",
    blobs: [
      { x: 0.15, y: 0.2, color: "#059669" },
      { x: 0.85, y: 0.15, color: "#0ea5e9" },
      { x: 0.75, y: 0.9, color: "#10b981" },
    ],
  },
  {
    name: "Nebula",
    base: "#020617",
    blobs: [
      { x: 0.2, y: 0.25, color: "#0ea5e9" },
      { x: 0.8, y: 0.2, color: "#8b5cf6" },
      { x: 0.6, y: 0.85, color: "#10b981" },
    ],
  },
  {
    name: "Citrus",
    base: "#0a0a0a",
    blobs: [
      { x: 0.5, y: 0.12, color: "#10b981" },
      { x: 0.9, y: 0.8, color: "#f59e0b" },
      { x: 0.1, y: 0.85, color: "#0ea5e9" },
    ],
  },
  {
    name: "Coral reef",
    base: "#03121a",
    blobs: [
      { x: 0.2, y: 0.8, color: "#2dd4bf" },
      { x: 0.85, y: 0.3, color: "#f472b6" },
      { x: 0.5, y: 0.1, color: "#38bdf8" },
    ],
  },
];

/* ------------------------------ color helpers ----------------------------- */

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/* ------------------------------ text layout ------------------------------- */

interface Word {
  text: string;
  hi: boolean;
}

/** Split a title into words, honouring *highlighted phrase* markup. */
export function parseTitle(title: string): Word[] {
  const segments = title
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((p) =>
      p.startsWith("*") && p.endsWith("*") && p.length > 2
        ? { text: p.slice(1, -1), hi: true }
        : { text: p, hi: false }
    );
  return segments.flatMap((s) =>
    s.text
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => ({ text: t, hi: s.hi }))
  );
}

/** Strip markup for the plain-text exporters. */
export function plainTitle(title: string): string {
  return title.replace(/\*([^*]+)\*/g, "$1");
}

function wrap(ctx: CanvasRenderingContext2D, words: Word[], maxW: number): Word[][] {
  const space = ctx.measureText(" ").width;
  const lines: Word[][] = [];
  let cur: Word[] = [];
  let curW = 0;
  for (const w of words) {
    const ww = ctx.measureText(w.text).width;
    const add = cur.length ? space + ww : ww;
    if (curW + add > maxW && cur.length) {
      lines.push(cur);
      cur = [w];
      curW = ww;
    } else {
      cur.push(w);
      curW += add;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function lineWidth(ctx: CanvasRenderingContext2D, line: Word[]): number {
  const space = ctx.measureText(" ").width;
  return line.reduce((s, w, i) => s + (i ? space : 0) + ctx.measureText(w.text).width, 0);
}

/* -------------------------------- primitives ------------------------------ */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

let noisePattern: CanvasPattern | null = null;
function grainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (noisePattern) return noisePattern;
  const tile = document.createElement("canvas");
  tile.width = tile.height = 128;
  const tctx = tile.getContext("2d");
  if (!tctx) return null;
  const img = tctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  noisePattern = ctx.createPattern(tile, "repeat");
  return noisePattern;
}

/** Draw an image cropped to cover a box, honouring an optional blur. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  blur: number
) {
  const ir = img.width / img.height;
  const br = w / h;
  let dw = w;
  let dh = h;
  let dx = x;
  let dy = y;
  if (ir > br) {
    dw = h * ir;
    dx = x - (dw - w) / 2;
  } else {
    dh = w / ir;
    dy = y - (dh - h) / 2;
  }
  ctx.save();
  if (blur > 0) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/* --------------------------------- renderer ------------------------------- */

export function renderOg(
  canvas: HTMLCanvasElement,
  cfg: OgConfig,
  assets: OgAssets = {}
): { w: number; h: number } {
  const size = SIZES.find((s) => s.id === cfg.sizeId) ?? SIZES[0];
  const W = size.w;
  const H = size.h;

  const dpr = cfg.scale;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { w: W, h: H };
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const titleFamily = resolveFont(cfg.titleFont);
  const bodyFamily = resolveFont(cfg.bodyFont);

  /* ---- background ---- */
  if (cfg.bgType === "solid") {
    ctx.fillStyle = cfg.solid;
    ctx.fillRect(0, 0, W, H);
  } else if (cfg.bgType === "gradient") {
    const a = (cfg.gradAngle * Math.PI) / 180;
    const cx = W / 2;
    const cy = H / 2;
    const len = (Math.abs(Math.cos(a)) * W + Math.abs(Math.sin(a)) * H) / 2;
    const g = ctx.createLinearGradient(
      cx - Math.cos(a) * len,
      cy - Math.sin(a) * len,
      cx + Math.cos(a) * len,
      cy + Math.sin(a) * len
    );
    g.addColorStop(0, cfg.gradFrom);
    g.addColorStop(1, cfg.gradTo);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (cfg.bgType === "mesh") {
    ctx.fillStyle = cfg.meshBase;
    ctx.fillRect(0, 0, W, H);
    const radius = Math.max(W, H) * 0.75;
    for (const blob of cfg.mesh) {
      const bx = blob.x * W;
      const by = blob.y * H;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, radius);
      g.addColorStop(0, rgba(blob.color, 0.85));
      g.addColorStop(1, rgba(blob.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  } else if (cfg.bgType === "image") {
    if (assets.bg) {
      drawCover(ctx, assets.bg, 0, 0, W, H, cfg.imageBlur);
    } else {
      ctx.fillStyle = "#0b1120";
      ctx.fillRect(0, 0, W, H);
    }
    if (cfg.imageOverlayOpacity > 0) {
      ctx.fillStyle = rgba(cfg.imageOverlay, cfg.imageOverlayOpacity);
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---- top glow ---- */
  if (cfg.topGlow) {
    const g = ctx.createRadialGradient(W / 2, -H * 0.1, 0, W / 2, -H * 0.1, H * 0.9);
    g.addColorStop(0, rgba(cfg.accentFrom, 0.5));
    g.addColorStop(1, rgba(cfg.accentFrom, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---- pattern overlay ---- */
  if (cfg.pattern !== "none" && cfg.patternOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = cfg.patternOpacity;
    ctx.strokeStyle = cfg.patternColor;
    ctx.fillStyle = cfg.patternColor;
    const step = Math.round(W / 34);
    if (cfg.pattern === "dots") {
      const r = Math.max(1.5, step * 0.06);
      for (let x = step; x < W; x += step)
        for (let y = step; y < H; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
    } else if (cfg.pattern === "grid") {
      ctx.lineWidth = 1;
      for (let x = step; x < W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = step; y < H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    } else if (cfg.pattern === "lines") {
      ctx.lineWidth = 1;
      const gap = step * 1.4;
      for (let d = -H; d < W; d += gap) {
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d + H, H);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ---- content layout ---- */
  const padX = W * 0.075;
  const padY = H * 0.09;
  const contentW = W - padX * 2;

  let titlePx = H * 0.115 * cfg.titleScale;
  let descPx = H * 0.044 * cfg.descScale;
  const eyebrowPx = Math.max(14, H * 0.028);
  const footerPx = Math.max(15, H * 0.03);
  const gap = H * 0.03;

  const words = parseTitle(cfg.title || " ");

  // Measure, then optionally shrink so the whole block fits the safe area.
  const measure = () => {
    ctx.font = `${cfg.titleWeight} ${titlePx}px ${titleFamily}`;
    const titleLines = wrap(ctx, words, contentW);
    const titleLH = titlePx * 1.12;
    ctx.font = `400 ${descPx}px ${bodyFamily}`;
    const descWords = (cfg.description || "").split(/\s+/).filter(Boolean).map((t) => ({ text: t, hi: false }));
    const descLines = cfg.description.trim() ? wrap(ctx, descWords, contentW) : [];
    const descLH = descPx * 1.4;
    return { titleLines, titleLH, descLines, descLH };
  };

  let m = measure();
  if (cfg.autoFit) {
    const eyebrowH = cfg.showEyebrow && cfg.eyebrow.trim() ? eyebrowPx * 2.4 : 0;
    const footerH = cfg.showFooter ? footerPx * 2.6 : 0;
    const avail = H - padY * 2 - footerH;
    let blockH =
      eyebrowH +
      m.titleLines.length * m.titleLH +
      (m.descLines.length ? gap * 0.7 + m.descLines.length * m.descLH : 0);
    let guard = 0;
    while (blockH > avail && guard < 24) {
      titlePx *= 0.94;
      descPx *= 0.94;
      m = measure();
      blockH =
        eyebrowH +
        m.titleLines.length * m.titleLH +
        (m.descLines.length ? gap * 0.7 + m.descLines.length * m.descLH : 0);
      guard++;
    }
  }

  const eyebrowH = cfg.showEyebrow && cfg.eyebrow.trim() ? eyebrowPx * 2.4 : 0;
  const blockH =
    eyebrowH +
    m.titleLines.length * m.titleLH +
    (m.descLines.length ? gap * 0.7 + m.descLines.length * m.descLH : 0);

  const footerH = cfg.showFooter ? footerPx * 2.6 : 0;
  const safeTop = padY + (cfg.logoSlot === "top" ? H * 0.09 : 0);
  const safeBottom = H - padY - footerH;
  const safeH = safeBottom - safeTop;

  let blockTop: number;
  if (cfg.vAnchor === "top") blockTop = safeTop;
  else if (cfg.vAnchor === "bottom") blockTop = safeBottom - blockH;
  else blockTop = safeTop + (safeH - blockH) / 2;

  const alignX = cfg.align === "center" ? W / 2 : padX;
  ctx.textAlign = cfg.align === "center" ? "center" : "left";

  /* ---- glass card ---- */
  if (cfg.glass) {
    const gpad = H * 0.05;
    const cardW = contentW + gpad * 2;
    const cardX = cfg.align === "center" ? (W - cardW) / 2 : padX - gpad;
    const cardY = blockTop - gpad;
    const cardH = blockH + gpad * 2;
    ctx.save();
    roundRect(ctx, cardX, cardY, cardW, cardH, H * 0.03);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.stroke();
    ctx.restore();
  }

  let y = blockTop;

  /* ---- eyebrow badge ---- */
  if (cfg.showEyebrow && cfg.eyebrow.trim()) {
    ctx.font = `600 ${eyebrowPx}px ${bodyFamily}`;
    const label = cfg.eyebrow.toUpperCase();
    const tw = ctx.measureText(label).width;
    const bpH = eyebrowPx * 1.9;
    const bpW = tw + eyebrowPx * 1.6;
    const bx = cfg.align === "center" ? W / 2 - bpW / 2 : padX;
    roundRect(ctx, bx, y, bpW, bpH, bpH / 2);
    ctx.fillStyle = cfg.accentGradient
      ? (() => {
          const g = ctx.createLinearGradient(bx, 0, bx + bpW, 0);
          g.addColorStop(0, rgba(cfg.accentFrom, 0.22));
          g.addColorStop(1, rgba(cfg.accentTo, 0.22));
          return g;
        })()
      : rgba(cfg.accentFrom, 0.2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(cfg.accentFrom, 0.4);
    ctx.stroke();
    ctx.fillStyle = cfg.accentGradient ? cfg.accentFrom : cfg.accentFrom;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    // Letter-spacing effect for the eyebrow.
    let ex = bx + eyebrowPx * 0.8;
    for (const ch of label) {
      ctx.fillText(ch, ex, y + bpH / 2);
      ex += ctx.measureText(ch).width + eyebrowPx * 0.06;
    }
    ctx.textAlign = cfg.align === "center" ? "center" : "left";
    y += eyebrowH;
  }

  /* ---- title (with highlight segments) ---- */
  ctx.font = `${cfg.titleWeight} ${titlePx}px ${titleFamily}`;
  ctx.textBaseline = "top";
  const space = ctx.measureText(" ").width;
  for (const line of m.titleLines) {
    const lw = lineWidth(ctx, line);
    let x = cfg.align === "center" ? W / 2 - lw / 2 : padX;
    for (const word of line) {
      const ww = ctx.measureText(word.text).width;
      if (word.hi) {
        if (cfg.accentGradient) {
          const g = ctx.createLinearGradient(x, 0, x + ww, 0);
          g.addColorStop(0, cfg.accentFrom);
          g.addColorStop(1, cfg.accentTo);
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = cfg.accentFrom;
        }
      } else {
        ctx.fillStyle = cfg.textColor;
      }
      ctx.textAlign = "left";
      ctx.fillText(word.text, x, y);
      x += ww + space;
    }
    y += m.titleLH;
  }
  ctx.textAlign = cfg.align === "center" ? "center" : "left";

  /* ---- description ---- */
  if (m.descLines.length) {
    y += gap * 0.7;
    ctx.font = `400 ${descPx}px ${bodyFamily}`;
    ctx.fillStyle = cfg.mutedColor;
    for (const line of m.descLines) {
      const text = line.map((w) => w.text).join(" ");
      ctx.fillText(text, alignX, y);
      y += m.descLH;
    }
  }

  /* ---- logo (top slot) ---- */
  if (cfg.logoSlot === "top" && assets.logo) {
    const lh = H * 0.07;
    const lw = (assets.logo.width / assets.logo.height) * lh;
    const lx = cfg.align === "center" ? W / 2 - lw / 2 : padX;
    ctx.drawImage(assets.logo, lx, padY, lw, lh);
  }

  /* ---- footer byline ---- */
  if (cfg.showFooter) {
    const fy = H - padY - footerPx * 1.4;
    ctx.textBaseline = "middle";
    let fx = padX;
    const avSize = footerPx * 1.8;
    if (cfg.logoSlot === "footer" && assets.logo) {
      const lw = (assets.logo.width / assets.logo.height) * avSize;
      ctx.drawImage(assets.logo, padX, fy - avSize / 2, lw, avSize);
      fx = padX + lw + footerPx * 0.7;
    } else if (assets.avatar) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(padX + avSize / 2, fy, avSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(assets.avatar, padX, fy - avSize / 2, avSize, avSize);
      ctx.restore();
      fx = padX + avSize + footerPx * 0.7;
    }
    ctx.textAlign = "left";
    if (cfg.authorName.trim()) {
      ctx.font = `600 ${footerPx}px ${bodyFamily}`;
      ctx.fillStyle = cfg.textColor;
      ctx.fillText(cfg.authorName, fx, fy - (cfg.authorHandle.trim() ? footerPx * 0.6 : 0));
      if (cfg.authorHandle.trim()) {
        ctx.font = `400 ${footerPx * 0.85}px ${bodyFamily}`;
        ctx.fillStyle = cfg.mutedColor;
        ctx.fillText(cfg.authorHandle, fx, fy + footerPx * 0.6);
      }
    }
    if (cfg.domain.trim()) {
      ctx.font = `500 ${footerPx * 0.92}px ${bodyFamily}`;
      ctx.fillStyle = cfg.mutedColor;
      ctx.textAlign = "right";
      ctx.fillText(cfg.domain, W - padX, fy);
    }
    ctx.textAlign = "left";
  }

  /* ---- vignette ---- */
  if (cfg.vignette > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${cfg.vignette})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---- grain ---- */
  if (cfg.grain > 0) {
    const pat = grainPattern(ctx);
    if (pat) {
      ctx.save();
      ctx.globalAlpha = cfg.grain * 0.14;
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  return { w: W, h: H };
}

/* ------------------------------ code exporters ---------------------------- */

export function buildMetaTags(cfg: OgConfig, imageUrl = "https://example.com/og.png"): string {
  const title = plainTitle(cfg.title).replace(/"/g, "&quot;");
  const desc = cfg.description.replace(/"/g, "&quot;");
  const size = SIZES.find((s) => s.id === cfg.sizeId) ?? SIZES[0];
  return [
    `<!-- Primary -->`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:image" content="${imageUrl}" />`,
    `<meta property="og:image:width" content="${size.w}" />`,
    `<meta property="og:image:height" content="${size.h}" />`,
    cfg.domain.trim() ? `<meta property="og:site_name" content="${cfg.domain}" />` : "",
    `<meta property="og:type" content="website" />`,
    ``,
    `<!-- Twitter / X -->`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${desc}" />`,
    `<meta name="twitter:image" content="${imageUrl}" />`,
    cfg.authorHandle.trim() ? `<meta name="twitter:creator" content="${cfg.authorHandle}" />` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/**
 * Emit a drop-in Next.js `opengraph-image.tsx` (App Router) that reproduces the
 * core layout with `next/og`'s ImageResponse — so the card is generated on the
 * fly per page instead of shipped as a static PNG. Mesh/grain are approximated
 * with a CSS gradient (Satori doesn't rasterize canvas effects).
 */
export function buildOgRoute(cfg: OgConfig): string {
  const size = SIZES.find((s) => s.id === cfg.sizeId) ?? SIZES[0];
  const bg =
    cfg.bgType === "solid"
      ? `"${cfg.solid}"`
      : cfg.bgType === "mesh"
        ? `"radial-gradient(at 20% 20%, ${cfg.mesh[0]?.color ?? cfg.accentFrom} 0px, transparent 55%), radial-gradient(at 85% 20%, ${cfg.mesh[1]?.color ?? cfg.accentTo} 0px, transparent 50%), ${cfg.meshBase}"`
        : `"linear-gradient(${cfg.gradAngle}deg, ${cfg.gradFrom}, ${cfg.gradTo})"`;
  const title = plainTitle(cfg.title).replace(/`/g, "\\`");
  const accent = cfg.accentGradient
    ? `background: "linear-gradient(90deg, ${cfg.accentFrom}, ${cfg.accentTo})", backgroundClip: "text", color: "transparent"`
    : `color: "${cfg.accentFrom}"`;
  const alignItems = cfg.align === "center" ? "center" : "flex-start";
  const textAlign = cfg.align === "center" ? "center" : "left";

  return `// app/opengraph-image.tsx  — Next.js App Router
import { ImageResponse } from "next/og";

export const size = { width: ${size.w}, height: ${size.h} };
export const contentType = "image/png";
export const alt = ${JSON.stringify(plainTitle(cfg.title))};

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "${cfg.vAnchor === "top" ? "flex-start" : cfg.vAnchor === "bottom" ? "flex-end" : "center"}",
          alignItems: "${alignItems}",
          textAlign: "${textAlign}",
          padding: "${Math.round(size.h * 0.09)}px ${Math.round(size.w * 0.075)}px",
          backgroundImage: ${bg},
          fontFamily: "sans-serif",
        }}
      >
        ${cfg.showEyebrow && cfg.eyebrow.trim() ? `<div style={{ fontSize: 28, letterSpacing: 2, textTransform: "uppercase", color: "${cfg.accentFrom}", marginBottom: 24 }}>${cfg.eyebrow}</div>` : ""}
        <div style={{ display: "flex", fontSize: ${Math.round(size.h * 0.115)}, fontWeight: ${cfg.titleWeight}, lineHeight: 1.1, ${accent}, maxWidth: "85%" }}>
          {\`${title}\`}
        </div>
        ${cfg.description.trim() ? `<div style={{ fontSize: ${Math.round(size.h * 0.044)}, color: "${cfg.mutedColor}", marginTop: 28, maxWidth: "80%" }}>${cfg.description.replace(/`/g, "\\`")}</div>` : ""}
        ${cfg.showFooter && (cfg.authorName.trim() || cfg.domain.trim()) ? `<div style={{ position: "absolute", bottom: ${Math.round(size.h * 0.09)}, left: ${Math.round(size.w * 0.075)}, right: ${Math.round(size.w * 0.075)}, display: "flex", justifyContent: "space-between", fontSize: 30, color: "${cfg.mutedColor}" }}><span style={{ color: "${cfg.textColor}", fontWeight: 600 }}>${cfg.authorName}</span><span>${cfg.domain}</span></div>` : ""}
      </div>
    ),
    { ...size }
  );
}
`;
}

export function ogFilename(cfg: OgConfig): string {
  const base = plainTitle(cfg.title).trim().slice(0, 40).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${base || "og-image"}-${cfg.sizeId}`;
}
