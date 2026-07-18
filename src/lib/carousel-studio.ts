/**
 * Carousel Studio engine. Designs multi-slide swipeable carousels for
 * Instagram and LinkedIn — one shared theme across every slide, per-slide
 * layouts (cover, text, bullets, quote, CTA, image) — rendered onto a <canvas>
 * so each slide exports as a pixel-perfect PNG. Fully deterministic, no exotic
 * browser APIs: the same renderer drives the preview and the export.
 */

/* --------------------------------- presets -------------------------------- */

export type SizeId = "square" | "portrait";

export interface SizePreset {
  id: SizeId;
  name: string;
  note: string;
  w: number;
  h: number;
}

export const SIZES: SizePreset[] = [
  { id: "portrait", name: "Portrait", note: "4:5 · best reach", w: 1080, h: 1350 },
  { id: "square", name: "Square", note: "1:1", w: 1080, h: 1080 },
];

export type SlideType = "cover" | "text" | "bullets" | "quote" | "cta" | "image";

export const SLIDE_TYPES: { id: SlideType; label: string }[] = [
  { id: "cover", label: "Cover" },
  { id: "text", label: "Text" },
  { id: "bullets", label: "Bullets" },
  { id: "quote", label: "Quote" },
  { id: "cta", label: "Call to action" },
  { id: "image", label: "Image" },
];

export type BgType = "mesh" | "gradient" | "solid";
export type Align = "left" | "center";
export type PageIndicator = "dots" | "count" | "none";

export const FONTS: { label: string; value: string }[] = [
  { label: "Space Grotesk", value: "--font-space-grotesk" },
  { label: "Geist Sans", value: "--font-geist-sans" },
  { label: "Geist Mono", value: "--font-geist-mono" },
  { label: "System Sans", value: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
];

export interface MeshBlob {
  x: number;
  y: number;
  color: string;
}

export interface Slide {
  id: string;
  type: SlideType;
  eyebrow: string;
  title: string; // supports *highlight*
  body: string;
  bullets: string[];
  cta: string; // pill label for CTA slides
  align: Align;
}

export interface CarouselConfig {
  aspect: SizeId;

  // Theme (shared by every slide)
  bgType: BgType;
  meshBase: string;
  mesh: MeshBlob[];
  gradFrom: string;
  gradTo: string;
  gradAngle: number;
  solid: string;

  titleFont: string;
  bodyFont: string;
  textColor: string;
  mutedColor: string;
  accentFrom: string;
  accentTo: string;
  accentGradient: boolean;

  topGlow: boolean;
  grain: number;
  vignette: number;

  // Branding + navigation
  authorName: string;
  authorHandle: string;
  showFooter: boolean;
  pageIndicator: PageIndicator;
  swipeHint: boolean;

  scale: number;
  slides: Slide[];
}

export interface SlideImage {
  el: CanvasImageSource;
  w: number;
  h: number;
}

export function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `slide-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function makeSlide(type: SlideType = "text"): Slide {
  const base: Slide = {
    id: newId(),
    type,
    eyebrow: "",
    title: "",
    body: "",
    bullets: [],
    cta: "",
    align: "left",
  };
  if (type === "bullets") return { ...base, title: "Three quick wins", bullets: ["First point", "Second point", "Third point"] };
  if (type === "quote") return { ...base, align: "center", title: "A line worth remembering.", body: "Author name" };
  if (type === "cta") return { ...base, align: "center", title: "Enjoyed this?", body: "Follow for more.", cta: "Follow" };
  if (type === "cover") return { ...base, eyebrow: "Guide", title: "The *hook* that stops the scroll" };
  return { ...base, title: "Your point here", body: "A short paragraph explaining the idea in plain language." };
}

export const THEMES: { name: string; patch: Partial<CarouselConfig> }[] = [
  {
    name: "Emerald",
    patch: {
      bgType: "mesh",
      meshBase: "#04140f",
      mesh: [
        { x: 0.15, y: 0.2, color: "#059669" },
        { x: 0.85, y: 0.15, color: "#0ea5e9" },
        { x: 0.75, y: 0.9, color: "#10b981" },
      ],
      textColor: "#f0fdf4",
      mutedColor: "#a7f3d0",
      accentFrom: "#34d399",
      accentTo: "#22d3ee",
      accentGradient: true,
    },
  },
  {
    name: "Midnight",
    patch: {
      bgType: "gradient",
      gradFrom: "#0b1020",
      gradTo: "#020617",
      gradAngle: 160,
      textColor: "#e2e8f0",
      mutedColor: "#94a3b8",
      accentFrom: "#6ee7b7",
      accentTo: "#38bdf8",
      accentGradient: true,
    },
  },
  {
    name: "Clean light",
    patch: {
      bgType: "solid",
      solid: "#f8fafc",
      textColor: "#0b1120",
      mutedColor: "#475569",
      accentFrom: "#059669",
      accentTo: "#0ea5e9",
      accentGradient: true,
      topGlow: false,
      grain: 0,
      vignette: 0,
    },
  },
  {
    name: "Nebula",
    patch: {
      bgType: "mesh",
      meshBase: "#020617",
      mesh: [
        { x: 0.2, y: 0.25, color: "#0ea5e9" },
        { x: 0.8, y: 0.2, color: "#8b5cf6" },
        { x: 0.6, y: 0.85, color: "#10b981" },
      ],
      textColor: "#f5f3ff",
      mutedColor: "#c4b5fd",
      accentFrom: "#a7f3d0",
      accentTo: "#c4b5fd",
      accentGradient: true,
    },
  },
];

export const DEFAULT_CAROUSEL: CarouselConfig = {
  aspect: "portrait",
  bgType: "mesh",
  meshBase: "#04140f",
  mesh: [
    { x: 0.15, y: 0.2, color: "#059669" },
    { x: 0.85, y: 0.15, color: "#0ea5e9" },
    { x: 0.75, y: 0.9, color: "#10b981" },
  ],
  gradFrom: "#0b1020",
  gradTo: "#020617",
  gradAngle: 160,
  solid: "#f8fafc",
  titleFont: "--font-space-grotesk",
  bodyFont: "--font-geist-sans",
  textColor: "#f0fdf4",
  mutedColor: "#a7f3d0",
  accentFrom: "#34d399",
  accentTo: "#22d3ee",
  accentGradient: true,
  topGlow: true,
  grain: 0.08,
  vignette: 0.22,
  authorName: "Your name",
  authorHandle: "@handle",
  showFooter: true,
  pageIndicator: "dots",
  swipeHint: true,
  scale: 2,
  slides: [
    { id: newId(), type: "cover", eyebrow: "Guide", title: "5 ways to *stop the scroll*", body: "A quick playbook for carousels that convert.", bullets: [], cta: "", align: "left" },
    { id: newId(), type: "bullets", eyebrow: "", title: "Hook them in *3 seconds*", body: "", bullets: ["Lead with the payoff", "One idea per slide", "Big type, short lines"], cta: "", align: "left" },
    { id: newId(), type: "quote", eyebrow: "", title: "People don't read carousels — they *skim* them.", body: "Every scroll-stopper", bullets: [], cta: "", align: "center" },
    { id: newId(), type: "cta", eyebrow: "", title: "Want the full playbook?", body: "Follow for a new one every week.", bullets: [], cta: "Follow", align: "center" },
  ],
};

/* -------------------------------- utilities ------------------------------- */

export function resolveFont(value: string): string {
  if (value.startsWith("--")) {
    if (typeof window === "undefined") return "system-ui, sans-serif";
    const v = getComputedStyle(document.documentElement).getPropertyValue(value).trim();
    return v || "system-ui, sans-serif";
  }
  return value;
}

export function sizeOf(cfg: CarouselConfig): SizePreset {
  return SIZES.find((s) => s.id === cfg.aspect) ?? SIZES[0];
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

interface Word {
  text: string;
  hi: boolean;
}

function parseTitle(title: string): Word[] {
  const segs = title
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((p) =>
      p.startsWith("*") && p.endsWith("*") && p.length > 2 ? { text: p.slice(1, -1), hi: true } : { text: p, hi: false }
    );
  return segs.flatMap((s) => s.text.split(/\s+/).filter(Boolean).map((t) => ({ text: t, hi: s.hi })));
}

export function plainTitle(title: string): string {
  return title.replace(/\*([^*]+)\*/g, "$1");
}

function wrapWords(ctx: CanvasRenderingContext2D, words: Word[], maxW: number): Word[][] {
  const space = ctx.measureText(" ").width;
  const lines: Word[][] = [];
  let cur: Word[] = [];
  let cw = 0;
  for (const w of words) {
    const ww = ctx.measureText(w.text).width;
    const add = cur.length ? space + ww : ww;
    if (cw + add > maxW && cur.length) {
      lines.push(cur);
      cur = [w];
      cw = ww;
    } else {
      cur.push(w);
      cw += add;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function wrapPlain(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  return wrapWords(ctx, text.split(/\s+/).filter(Boolean).map((t) => ({ text: t, hi: false })), maxW).map((l) => l.map((w) => w.text).join(" "));
}

function lineWidth(ctx: CanvasRenderingContext2D, line: Word[]): number {
  const space = ctx.measureText(" ").width;
  return line.reduce((s, w, i) => s + (i ? space : 0) + ctx.measureText(w.text).width, 0);
}

/* -------------------------------- overlays -------------------------------- */

let noise: CanvasPattern | null = null;
function grainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (noise) return noise;
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
  noise = ctx.createPattern(tile, "repeat");
  return noise;
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: SlideImage, x: number, y: number, w: number, h: number) {
  const ir = img.w / img.h;
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
  ctx.drawImage(img.el, dx, dy, dw, dh);
}

/* --------------------------------- renderer ------------------------------- */

export function renderSlide(
  canvas: HTMLCanvasElement,
  cfgIn: CarouselConfig,
  slide: Slide,
  index: number,
  total: number,
  image: SlideImage | undefined,
  outW: number,
  outH: number
) {
  const cfg = { ...DEFAULT_CAROUSEL, ...cfgIn };
  const W = outW;
  const H = outH;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const titleFamily = resolveFont(cfg.titleFont);
  const bodyFamily = resolveFont(cfg.bodyFont);
  const isImage = slide.type === "image" && !!image;

  /* ---- background ---- */
  if (isImage && image) {
    drawImageCover(ctx, image, 0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0.15)");
    g.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (cfg.bgType === "solid") {
    ctx.fillStyle = cfg.solid;
    ctx.fillRect(0, 0, W, H);
  } else if (cfg.bgType === "gradient") {
    const a = (cfg.gradAngle * Math.PI) / 180;
    const cx = W / 2;
    const cy = H / 2;
    const len = (Math.abs(Math.cos(a)) * W + Math.abs(Math.sin(a)) * H) / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(a) * len, cy - Math.sin(a) * len, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    g.addColorStop(0, cfg.gradFrom);
    g.addColorStop(1, cfg.gradTo);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = cfg.meshBase;
    ctx.fillRect(0, 0, W, H);
    const radius = Math.max(W, H) * 0.8;
    for (const b of cfg.mesh) {
      const g = ctx.createRadialGradient(b.x * W, b.y * H, 0, b.x * W, b.y * H, radius);
      g.addColorStop(0, rgba(b.color, 0.85));
      g.addColorStop(1, rgba(b.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  if (cfg.topGlow && !isImage) {
    const g = ctx.createRadialGradient(W / 2, -H * 0.12, 0, W / 2, -H * 0.12, H * 0.9);
    g.addColorStop(0, rgba(cfg.accentFrom, 0.42));
    g.addColorStop(1, rgba(cfg.accentFrom, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---- content ---- */
  const padX = W * 0.085;
  const padTop = H * 0.1;
  const footerH = cfg.showFooter ? H * 0.11 : H * 0.06;
  const contentW = W - padX * 2;
  const align = slide.align;
  const alignX = align === "center" ? W / 2 : padX;
  const textAlign: CanvasTextAlign = align === "center" ? "center" : "left";

  const accentFill = (x: number, w: number): string | CanvasGradient => {
    if (!cfg.accentGradient) return cfg.accentFrom;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, cfg.accentFrom);
    g.addColorStop(1, cfg.accentTo);
    return g;
  };

  // Quote glyph sits above the title on quote slides.
  const quoteMark = slide.type === "quote";

  // Font sizes scale to the slide height.
  let titlePx = H * (slide.type === "cover" ? 0.085 : quoteMark ? 0.07 : 0.062);
  const eyebrowPx = Math.max(15, H * 0.026);
  const bodyPx = H * 0.032;
  const bulletPx = H * 0.036;
  const gap = H * 0.028;

  const words = parseTitle(slide.title || "");

  const measure = () => {
    ctx.font = `800 ${titlePx}px ${titleFamily}`;
    const titleLines = words.length ? wrapWords(ctx, words, contentW) : [];
    const titleLH = titlePx * 1.14;
    ctx.font = `400 ${bodyPx}px ${bodyFamily}`;
    const bodyLines = slide.body.trim() && slide.type !== "quote" ? wrapPlain(ctx, slide.body, contentW) : [];
    const bodyLH = bodyPx * 1.42;
    ctx.font = `500 ${bulletPx}px ${bodyFamily}`;
    const bulletBlocks = slide.type === "bullets" ? slide.bullets.filter((b) => b.trim()).map((b) => wrapPlain(ctx, b, contentW - bulletPx * 1.8)) : [];
    const bulletLH = bulletPx * 1.32;
    return { titleLines, titleLH, bodyLines, bodyLH, bulletBlocks, bulletLH };
  };

  let m = measure();

  const eyebrowH = slide.eyebrow.trim() ? eyebrowPx * 2.6 : 0;
  const quoteH = quoteMark ? titlePx * 1.1 : 0;
  const bulletsH = m.bulletBlocks.reduce((s, b) => s + b.length * m.bulletLH + bulletPx * 0.7, 0);

  const blockH = () =>
    eyebrowH +
    quoteH +
    m.titleLines.length * m.titleLH +
    (m.bodyLines.length ? gap + m.bodyLines.length * m.bodyLH : 0) +
    (bulletsH ? gap + bulletsH : 0) +
    (slide.type === "cta" && slide.cta.trim() ? gap * 1.4 + H * 0.075 : 0);

  const availTop = padTop;
  const availBottom = H - footerH;
  const avail = availBottom - availTop;

  // Shrink the title until the block fits.
  let guard = 0;
  while (blockH() > avail && titlePx > H * 0.03 && guard < 22) {
    titlePx *= 0.94;
    m = measure();
    guard++;
  }

  const bh = blockH();
  // Cover/quote/cta center vertically; text/bullets sit toward the top third.
  const centered = slide.type === "cover" || slide.type === "quote" || slide.type === "cta";
  let y = centered ? availTop + (avail - bh) / 2 : availTop + Math.min(avail * 0.08, (avail - bh) / 2);
  if (y < availTop) y = availTop;

  ctx.textBaseline = "top";

  // Eyebrow badge
  if (slide.eyebrow.trim()) {
    ctx.font = `600 ${eyebrowPx}px ${bodyFamily}`;
    const label = slide.eyebrow.toUpperCase();
    const bpH = eyebrowPx * 2;
    let tw = 0;
    for (const ch of label) tw += ctx.measureText(ch).width + eyebrowPx * 0.06;
    const bpW = tw + eyebrowPx * 1.4;
    const bx = align === "center" ? W / 2 - bpW / 2 : padX;
    roundRect(ctx, bx, y, bpW, bpH, bpH / 2);
    ctx.fillStyle = rgba(cfg.accentFrom, 0.18);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(cfg.accentFrom, 0.4);
    ctx.stroke();
    ctx.fillStyle = cfg.accentFrom;
    ctx.textBaseline = "middle";
    let ex = bx + eyebrowPx * 0.7;
    for (const ch of label) {
      ctx.fillText(ch, ex, y + bpH / 2);
      ex += ctx.measureText(ch).width + eyebrowPx * 0.06;
    }
    ctx.textBaseline = "top";
    y += eyebrowH;
  }

  // Quote glyph
  if (quoteMark) {
    ctx.font = `800 ${titlePx * 2}px ${titleFamily}`;
    ctx.fillStyle = rgba(cfg.accentFrom, 0.85);
    ctx.textAlign = textAlign;
    ctx.fillText("“", align === "center" ? W / 2 : padX, y - titlePx * 0.5);
    y += quoteH;
  }

  // Title (with *highlight*)
  ctx.font = `800 ${titlePx}px ${titleFamily}`;
  const space = ctx.measureText(" ").width;
  for (const line of m.titleLines) {
    const lw = lineWidth(ctx, line);
    let x = align === "center" ? W / 2 - lw / 2 : padX;
    for (const word of line) {
      const ww = ctx.measureText(word.text).width;
      ctx.fillStyle = word.hi ? accentFill(x, ww) : cfg.textColor;
      ctx.textAlign = "left";
      ctx.fillText(word.text, x, y);
      x += ww + space;
    }
    y += m.titleLH;
  }
  ctx.textAlign = textAlign;

  // Body
  if (m.bodyLines.length) {
    y += gap;
    ctx.font = `400 ${bodyPx}px ${bodyFamily}`;
    ctx.fillStyle = slide.type === "quote" ? cfg.accentFrom : cfg.mutedColor;
    for (const line of m.bodyLines) {
      ctx.fillText(line, alignX, y);
      y += m.bodyLH;
    }
  }

  // Bullets
  if (m.bulletBlocks.length) {
    y += gap;
    ctx.textAlign = "left";
    for (const block of m.bulletBlocks) {
      const dotY = y + bulletPx * 0.55;
      ctx.beginPath();
      ctx.arc(padX + bulletPx * 0.4, dotY, bulletPx * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = cfg.accentGradient ? accentFill(padX, bulletPx) : cfg.accentFrom;
      ctx.fill();
      ctx.font = `500 ${bulletPx}px ${bodyFamily}`;
      ctx.fillStyle = cfg.textColor;
      let by = y;
      for (const line of block) {
        ctx.fillText(line, padX + bulletPx * 1.4, by);
        by += m.bulletLH;
      }
      y = by + bulletPx * 0.7;
    }
    ctx.textAlign = textAlign;
  }

  // CTA pill
  if (slide.type === "cta" && slide.cta.trim()) {
    y += gap * 1.4;
    ctx.font = `700 ${H * 0.032}px ${bodyFamily}`;
    const tw = ctx.measureText(slide.cta).width;
    const pw = tw + H * 0.06;
    const ph = H * 0.075;
    const px = align === "center" ? W / 2 - pw / 2 : padX;
    roundRect(ctx, px, y, pw, ph, ph / 2);
    ctx.fillStyle = accentFill(px, pw);
    ctx.fill();
    ctx.fillStyle = cfg.bgType === "solid" ? "#ffffff" : "#04140f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(slide.cta, px + pw / 2, y + ph / 2);
    ctx.textBaseline = "top";
    ctx.textAlign = textAlign;
  }

  /* ---- overlays ---- */
  if (cfg.vignette > 0 && !isImage) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${cfg.vignette})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
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

  /* ---- footer + page indicator + swipe ---- */
  const footPx = Math.max(15, H * 0.024);
  const footY = H - footerH + footerH * 0.35;
  const onLight = cfg.bgType === "solid" && !isImage;

  if (cfg.showFooter && (cfg.authorName.trim() || cfg.authorHandle.trim())) {
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    if (cfg.authorName.trim()) {
      ctx.font = `600 ${footPx}px ${bodyFamily}`;
      ctx.fillStyle = cfg.textColor;
      ctx.fillText(cfg.authorName, padX, footY - (cfg.authorHandle.trim() ? footPx * 0.6 : 0));
    }
    if (cfg.authorHandle.trim()) {
      ctx.font = `400 ${footPx * 0.9}px ${bodyFamily}`;
      ctx.fillStyle = cfg.mutedColor;
      ctx.fillText(cfg.authorHandle, padX, footY + footPx * 0.6);
    }
  }

  // Page indicator (bottom-right)
  if (cfg.pageIndicator === "count") {
    ctx.font = `600 ${footPx}px ${bodyFamily}`;
    ctx.fillStyle = cfg.mutedColor;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${index + 1} / ${total}`, W - padX, footY);
  } else if (cfg.pageIndicator === "dots" && total > 1) {
    const dot = Math.max(5, H * 0.007);
    const dgap = dot * 2.2;
    const totalW = total * dgap - (dgap - dot);
    let dx = W - padX - totalW;
    const dy = footY;
    for (let i = 0; i < total; i++) {
      ctx.beginPath();
      ctx.arc(dx + dot / 2, dy, dot / 2, 0, Math.PI * 2);
      ctx.fillStyle = i === index ? cfg.accentFrom : rgba(onLight ? "#0f172a" : "#ffffff", 0.3);
      ctx.fill();
      dx += dgap;
    }
  }

  // Swipe hint on every slide but the last
  if (cfg.swipeHint && index < total - 1) {
    const cx = W - padX - H * 0.02;
    const cyh = H - footerH * 0.42;
    ctx.save();
    ctx.strokeStyle = cfg.accentFrom;
    ctx.lineWidth = Math.max(2, H * 0.004);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const s = H * 0.02;
    ctx.beginPath();
    ctx.moveTo(cx - s, cyh - s);
    ctx.lineTo(cx, cyh);
    ctx.lineTo(cx - s, cyh + s);
    ctx.stroke();
    ctx.restore();
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/* ------------------------------ export helpers ---------------------------- */

export function slideFilename(cfg: CarouselConfig, index: number): string {
  const first = plainTitle(cfg.slides[0]?.title || "carousel").trim().slice(0, 30).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${first || "carousel"}-${String(index + 1).padStart(2, "0")}`;
}

export function clampSlideCount(n: number): number {
  return Math.max(0, Math.min(20, n));
}

export { clamp01 };
