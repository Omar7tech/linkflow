/**
 * 2D side of the 3D tools: the compositor that lays a rendered device or logo
 * onto a backdrop (glow, shadow, floor reflection, grain), the backdrops
 * themselves, finishes, and the painters for screen content.
 */

import { drawBlurred, HAS_CANVAS_FILTER } from "@/lib/canvas-blur";

function hexRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function shade(hex: string, k: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
}

/* ----------------------------------------------------------------- scene */

export interface SceneOptions {
  rotX: number; // radians
  rotY: number;
  zoom: number;
  /** Camera distance — small = dramatic wide-angle, large = flat telephoto. */
  camera: number;
  /** 0..1 mirror-floor reflection strength. */
  reflection: number;
  /** 0..1 screen-glow (bloom) strength behind the device. */
  glow: number;
  /** Glow color, sampled from the screen content. */
  glowRgb: [number, number, number];
  /** 0..1 photographic grain over the final image. */
  grain: number;
  /** 0..1 soft drop shadow cast by the device onto the backdrop. */
  shadow?: number;
  background: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

// Tileable monochrome noise for the grain pass, generated once.
let noiseTile: HTMLCanvasElement | null = null;
function getNoiseTile(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

// Reusable offscreen canvases (device render, reflection band, shadow silhouette).
const scratchCanvases: HTMLCanvasElement[] = [];
function getScratch(i: number, w: number, h: number): HTMLCanvasElement {
  let c = scratchCanvases[i];
  if (!c) {
    c = document.createElement("canvas");
    scratchCanvases[i] = c;
  }
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}


/**
 * Composite a WebGL render (device or logo) onto the scene:
 * backdrop, screen glow, floor-line reflection, the device itself, grain.
 * `sy` is the floor line in canvas pixels.
 */
export function composeScene(
  ctx: CanvasRenderingContext2D,
  device: HTMLCanvasElement,
  opts: SceneOptions,
  sy: number
) {
  const { width: w, height: h } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  opts.background(ctx, w, h);

  const cx = w / 2;
  const cy = h / 2 - h * 0.015;

  // Screen glow — soft bloom behind the device, tinted by the screen content.
  if (opts.glow > 0) {
    const [gr, gg, gb] = opts.glowRgb;
    const rad = Math.min(w, h) * (0.42 + 0.22 * opts.zoom);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    glow.addColorStop(0, `rgba(${gr},${gg},${gb},${0.5 * opts.glow})`);
    glow.addColorStop(0.65, `rgba(${gr},${gg},${gb},${0.14 * opts.glow})`);
    glow.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  // Soft shadow — the device silhouette at quarter size (cheap to blur),
  // laid down twice: a wide ambient falloff and a tight contact core.
  const shadow = opts.shadow ?? 0;
  if (shadow > 0) {
    const sw = Math.ceil(w / 4);
    const sh = Math.ceil(h / 4);
    const sil = getScratch(2, sw, sh);
    const sx = sil.getContext("2d")!;
    sx.globalCompositeOperation = "source-over";
    sx.clearRect(0, 0, sw, sh);
    sx.drawImage(device, 0, 0, sw, sh);
    sx.globalCompositeOperation = "source-in";
    sx.fillStyle = "#000";
    sx.fillRect(0, 0, sw, sh);
    ctx.save();
    ctx.globalAlpha = 0.5 * shadow;
    drawBlurred(ctx, sil, w * 0.012, h * 0.036, w, h, w * 0.03);
    ctx.globalAlpha = 0.38 * shadow;
    drawBlurred(ctx, sil, w * 0.003, h * 0.009, w, h, w * 0.007);
    ctx.restore();
  }

  // Mirror-floor reflection — flip the device render about the floor line,
  // fade it out, and blur only that fixed-height band.
  if (opts.reflection > 0 && sy < h) {
    const band = getScratch(1, w, Math.ceil(h * 0.34));
    const bctx = band.getContext("2d")!;
    bctx.globalCompositeOperation = "source-over";
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, band.width, band.height);
    bctx.setTransform(1, 0, 0, -1, 0, sy); // band row 0 = floor line, flipped
    bctx.drawImage(device, 0, 0);
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = "destination-in";
    const fade = bctx.createLinearGradient(0, 0, 0, band.height * 0.94);
    fade.addColorStop(0, `rgba(0,0,0,${0.42 * opts.reflection})`);
    fade.addColorStop(0.6, `rgba(0,0,0,${0.1 * opts.reflection})`);
    fade.addColorStop(1, "rgba(0,0,0,0)");
    bctx.fillStyle = fade;
    bctx.fillRect(0, 0, w, band.height);

    ctx.save();
    ctx.filter = `blur(${Math.max(1, w * 0.0012)}px)`;
    ctx.drawImage(band, 0, sy);
    ctx.restore();
  }

  ctx.drawImage(device, 0, 0);

  // Photographic grain — over existing pixels only, so transparent exports stay clean.
  if (opts.grain > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = 0.1 * opts.grain;
    ctx.fillStyle = ctx.createPattern(getNoiseTile(), "repeat")!;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

/* -------------------------------------------------------------- finishes */

export type Orientation = "portrait" | "landscape";

/**
 * How a finish treats the device's surfaces. Without one, the model keeps its
 * own metal and glass and is only recolored.
 */
export type FinishSurface =
  /** Matte single-color body, like a clay render. */
  | { type: "clay" }
  /** Stylized: soft sculpted shading under a color sweep laid across the whole device. */
  | { type: "matcap"; stops: [number, string][]; angle: number }
  /** A clear shell: nothing but reflections and a faint veil. */
  | { type: "crystal" }
  /** Polished to a mirror. */
  | { type: "mirror" }
  /** Deep color under a glossy lacquer. */
  | { type: "paint" }
  /** Thin-film color that shifts with the viewing angle. */
  | { type: "holo" };

export type FinishGroup = "Metal" | "Special" | "Clay" | "Art";

export interface FrameFinish {
  id: string;
  label: string;
  group: FinishGroup;
  light: string;
  dark: string;
  surface?: FinishSurface;
  /** CSS for the picker chip, when a light→dark sweep doesn't describe it. */
  swatch?: string;
}

/** Shell finishes replace every part of the body and drop the camera hardware. */
export const isShellFinish = (f: FrameFinish) =>
  f.surface?.type === "clay" || f.surface?.type === "matcap" || f.surface?.type === "crystal";

const HOLO_SWATCH = "conic-gradient(from 210deg,#a5f3fc,#c4b5fd,#f9a8d4,#fde68a,#86efac,#a5f3fc)";

function art(id: string, label: string, angle: number, stops: [number, string][]): FrameFinish {
  return {
    id,
    label,
    group: "Art",
    light: stops[0][1],
    dark: stops[stops.length - 1][1],
    surface: { type: "matcap", stops, angle },
    swatch: `linear-gradient(${angle + 90}deg, ${stops.map(([p, c]) => `${c} ${p * 100}%`).join(", ")})`,
  };
}

export const FINISHES: readonly FrameFinish[] = [
  { id: "titanium", label: "Natural Titanium", group: "Metal", light: "#b3ada3", dark: "#5f5a53" },
  { id: "starwhite", label: "Star White", group: "Metal", light: "#b3b0a8", dark: "#e9e6e0" },
  { id: "burgundy", label: "Burgundy", group: "Metal", light: "#62464b", dark: "#46202a" },
  { id: "black", label: "Space Black", group: "Metal", light: "#3c3c3f", dark: "#151517" },
  { id: "silver", label: "Silver", group: "Metal", light: "#e2e3e6", dark: "#a2a4a9" },
  { id: "gold", label: "Light Gold", group: "Metal", light: "#eddcbd", dark: "#b39469" },
  { id: "navy", label: "Navy", group: "Metal", light: "#46536f", dark: "#1f2740" },
  { id: "orange", label: "Cosmic Orange", group: "Metal", light: "#e8873e", dark: "#9a4a18" },
  { id: "deepblue", label: "Deep Blue", group: "Metal", light: "#41567e", dark: "#141f3a" },
  { id: "sage", label: "Sage", group: "Metal", light: "#a7b89d", dark: "#5a6a52" },
  { id: "lavender", label: "Lavender", group: "Metal", light: "#cfc4e6", dark: "#8b7fae" },
  { id: "skyblue", label: "Sky Blue", group: "Metal", light: "#b9d4e7", dark: "#6d92ac" },

  { id: "chrome", label: "Liquid Chrome", group: "Special", light: "#f4f6f9", dark: "#dfe3ea", surface: { type: "mirror" }, swatch: "linear-gradient(135deg,#ffffff,#8d96a3 45%,#f1f4f8 60%,#5d6570)" },
  { id: "gold-mirror", label: "24K Gold", group: "Special", light: "#ffcf6b", dark: "#f2b544", surface: { type: "mirror" }, swatch: "linear-gradient(135deg,#fff3c4,#d99a1f 45%,#ffe08a 60%,#8a5a06)" },
  { id: "rose-mirror", label: "Rose Chrome", group: "Special", light: "#f7b9ad", dark: "#e79a8f", surface: { type: "mirror" }, swatch: "linear-gradient(135deg,#ffe4de,#d77f73 45%,#ffc9bf 60%,#8a4238)" },
  { id: "black-mirror", label: "Black Chrome", group: "Special", light: "#4a4d55", dark: "#2c2e34", surface: { type: "mirror" }, swatch: "linear-gradient(135deg,#8b909b,#17181c 45%,#5c606a 60%,#050506)" },
  { id: "holo", label: "Holographic", group: "Special", light: "#e6ebff", dark: "#cfd6f5", surface: { type: "holo" }, swatch: HOLO_SWATCH },
  { id: "oil", label: "Oil Slick", group: "Special", light: "#2b2d3a", dark: "#16171f", surface: { type: "holo" }, swatch: "conic-gradient(from 210deg,#0e7490,#6d28d9,#be185d,#b45309,#047857,#0e7490)" },
  { id: "candy-red", label: "Candy Red", group: "Special", light: "#c40f20", dark: "#8d0715", surface: { type: "paint" }, swatch: "radial-gradient(circle at 32% 28%,#ff8d96,#c40f20 45%,#5b040d)" },
  { id: "electric", label: "Electric Blue", group: "Special", light: "#1746ff", dark: "#0b2bb8", surface: { type: "paint" }, swatch: "radial-gradient(circle at 32% 28%,#9db2ff,#1746ff 45%,#06145c)" },
  { id: "racing", label: "Racing Green", group: "Special", light: "#0b5a40", dark: "#063b2a", surface: { type: "paint" }, swatch: "radial-gradient(circle at 32% 28%,#7fd8b4,#0b5a40 45%,#02231a)" },
  { id: "papaya", label: "Papaya", group: "Special", light: "#ff6a1a", dark: "#cf4a05", surface: { type: "paint" }, swatch: "radial-gradient(circle at 32% 28%,#ffc7a1,#ff6a1a 45%,#7a2a02)" },
  { id: "crystal", label: "Crystal", group: "Special", light: "#ffffff", dark: "#dfe9f5", surface: { type: "crystal" }, swatch: "linear-gradient(135deg,rgba(255,255,255,0.9),rgba(160,190,220,0.25) 45%,rgba(255,255,255,0.7) 62%,rgba(120,150,190,0.3))" },

  { id: "clay-white", label: "Clay White", group: "Clay", light: "#f4f4f2", dark: "#e3e3e0", surface: { type: "clay" }, swatch: "#f4f4f2" },
  { id: "clay-ink", label: "Clay Ink", group: "Clay", light: "#34363c", dark: "#232429", surface: { type: "clay" }, swatch: "#34363c" },
  { id: "clay-emerald", label: "Clay Emerald", group: "Clay", light: "#3fbf93", dark: "#2f9f79", surface: { type: "clay" }, swatch: "#3fbf93" },
  { id: "clay-blush", label: "Clay Blush", group: "Clay", light: "#f6b8b8", dark: "#e99a9d", surface: { type: "clay" }, swatch: "#f6b8b8" },
  { id: "clay-sky", label: "Clay Sky", group: "Clay", light: "#a9cff5", dark: "#86b4e6", surface: { type: "clay" }, swatch: "#a9cff5" },
  { id: "clay-butter", label: "Clay Butter", group: "Clay", light: "#f8df8e", dark: "#ebc968", surface: { type: "clay" }, swatch: "#f8df8e" },
  { id: "clay-lilac", label: "Clay Lilac", group: "Clay", light: "#c9b8f4", dark: "#ab97e6", surface: { type: "clay" }, swatch: "#c9b8f4" },

  art("aurora-art", "Aurora", 35, [[0, "#7ef0c8"], [0.45, "#3b82f6"], [0.8, "#8b5cf6"], [1, "#ec4899"]]),
  art("sunset-art", "Sunset", 60, [[0, "#fde68a"], [0.4, "#fb923c"], [0.75, "#e11d48"], [1, "#6d28d9"]]),
  art("jade", "Jade", 50, [[0, "#d1fae5"], [0.4, "#34d399"], [0.8, "#047857"], [1, "#022c22"]]),
  art("porcelain", "Porcelain", 45, [[0, "#ffffff"], [0.5, "#eef2f7"], [0.85, "#c3cedd"], [1, "#8ea0b8"]]),
  art("bubblegum", "Bubblegum", 40, [[0, "#ffe4f1"], [0.4, "#f9a8d4"], [0.8, "#ec4899"], [1, "#9d174d"]]),
  art("obsidian", "Obsidian", 45, [[0, "#6b7280"], [0.3, "#1f2937"], [0.75, "#0b0d12"], [1, "#000000"]]),
];

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | number[]
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** What a device screen can display. */
export type ScreenSource = ImageBitmap | HTMLVideoElement;

/**
 * Fit a source to the screen width-first. Content taller than the screen is
 * anchored to the top and travels with `scroll` (0..1), like a real page.
 */
export function drawContent(
  ctx: CanvasRenderingContext2D,
  src: ScreenSource,
  x: number,
  y: number,
  w: number,
  h: number,
  scroll: number
) {
  const sw = src instanceof HTMLVideoElement ? src.videoWidth || 1 : src.width;
  const sh = src instanceof HTMLVideoElement ? src.videoHeight || 1 : src.height;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const oy = dh > h + 1 ? -scroll * (dh - h) : (h - dh) / 2;
  ctx.drawImage(src, x + (w - dw) / 2, y + oy, dw, dh);
}

/**
 * Empty-screen content: a lock screen over an abstract emerald wallpaper, so
 * the device reads as a real, switched-on phone before anything is dropped in.
 * Tall rects get the full phone layout; wide ones a centered clock.
 */
export function paintPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const tall = h > w * 1.5;
  const u = tall ? w : Math.min(w, h) * 0.62; // layout unit
  const cx = x + w / 2;
  const font = (weight: number, px: number) =>
    `${weight} ${px}px -apple-system, "SF Pro Display", "Segoe UI", system-ui, sans-serif`;
  const pill = (px: number, py: number, pw: number, ph: number, r: number, fill: string | CanvasGradient) => {
    ctx.fillStyle = fill;
    roundRectPath(ctx, px, py, pw, ph, r);
    ctx.fill();
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Wallpaper — soft ribbons of light sweeping across a deep green field.
  const base = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  base.addColorStop(0, "#010d0a");
  base.addColorStop(0.5, "#04372b");
  base.addColorStop(1, "#021410");
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const ribbonBlur = short * 0.04;
  const ribbons: [number, number, number, number, number, string][] = [
    [0.12, 0.64, 0.9, 0.17, -0.9, "rgba(16,185,129,0.7)"],
    [0.78, 0.47, 0.85, 0.12, -0.96, "rgba(45,212,191,0.5)"],
    [0.55, 0.88, 0.9, 0.2, -0.8, "rgba(5,150,105,0.8)"],
    [0.98, 0.2, 0.6, 0.09, -1.02, "rgba(167,243,208,0.4)"],
  ];
  if (HAS_CANVAS_FILTER) {
    ctx.filter = `blur(${ribbonBlur.toFixed(1)}px)`;
    for (const [rx, ry, len, thick, rot, color] of ribbons) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x + rx * w, y + ry * h, len * long, thick * short, rot, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // No canvas filter (Safari): draw each ribbon small on a layer that
    // overhangs the screen by the blur's reach, then blur that layer in.
    const q = 1 / 8;
    const m = ribbonBlur * 3;
    const layer = getScratch(3, Math.ceil((w + m * 2) * q), Math.ceil((h + m * 2) * q));
    const lctx = layer.getContext("2d")!;
    for (const [rx, ry, len, thick, rot, color] of ribbons) {
      lctx.clearRect(0, 0, layer.width, layer.height);
      lctx.fillStyle = color;
      lctx.beginPath();
      lctx.ellipse((m + rx * w) * q, (m + ry * h) * q, len * long * q, thick * short * q, rot, 0, Math.PI * 2);
      lctx.fill();
      drawBlurred(ctx, layer, x - m, y - m, layer.width / q, layer.height / q, ribbonBlur);
    }
  }
  ctx.restore();
  // Darken the top so the clock stays legible on any wallpaper.
  const scrim = ctx.createLinearGradient(x, y, x, y + h * 0.45);
  scrim.addColorStop(0, "rgba(0,0,0,0.38)");
  scrim.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = scrim;
  ctx.fillRect(x, y, w, h);

  // Clock and date
  const top = y + (tall ? h * 0.118 : h * 0.17);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = font(600, u * 0.054);
  ctx.fillText("Monday, June 9", cx, top);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = font(700, u * 0.27);
  ctx.fillText("9:41", cx, top + u * 0.25);

  if (tall) {
    // Status icons to the right of the island: signal, Wi-Fi, battery.
    const sy = y + u * 0.086;
    let sx = x + w * 0.715;
    for (let i = 0; i < 4; i++) {
      const bh = u * (0.012 + i * 0.007);
      pill(sx, sy - bh, u * 0.011, bh, u * 0.003, "rgba(255,255,255,0.95)");
      sx += u * 0.017;
    }
    sx += u * 0.03;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineCap = "round";
    ctx.lineWidth = u * 0.0085;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(sx, sy, u * 0.011 * i, -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.stroke();
    }
    sx += u * 0.05;
    ctx.lineWidth = u * 0.004;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    roundRectPath(ctx, sx, sy - u * 0.03, u * 0.066, u * 0.031, u * 0.009);
    ctx.stroke();
    pill(sx + u * 0.006, sy - u * 0.024, u * 0.054, u * 0.019, u * 0.005, "rgba(255,255,255,0.95)");
  }

  // Notifications — they double as the instructions.
  const cardW = tall ? w * 0.91 : u * 1.25;
  const cardH = u * 0.185;
  const cards: [string, string][] = [
    ["Your app", "Drop a screenshot or video to show it here"],
    ["Studio", "Drag the device to orbit it"],
  ];
  const first = tall ? y + h * 0.62 : y + h - u * 0.16 - cardH * (cards.length + 0.2);
  cards.forEach(([title, body], i) => {
    const kx = cx - cardW / 2;
    const ky = first + i * (cardH + u * 0.022);
    pill(kx, ky, cardW, cardH, u * 0.058, "rgba(236,253,245,0.17)");
    const icon = ctx.createLinearGradient(kx, ky, kx + cardH, ky + cardH);
    icon.addColorStop(0, "#34d399");
    icon.addColorStop(1, "#047857");
    pill(kx + u * 0.036, ky + cardH * 0.22, cardH * 0.56, cardH * 0.56, cardH * 0.13, icon);
    ctx.textAlign = "left";
    const tx = kx + u * 0.036 + cardH * 0.56 + u * 0.034;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = font(600, u * 0.043);
    ctx.fillText(title, tx, ky + cardH * 0.43);
    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = font(400, u * 0.037);
    ctx.fillText(body, tx, ky + cardH * 0.72);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = font(400, u * 0.033);
    ctx.fillText("now", kx + cardW - u * 0.04, ky + cardH * 0.43);
  });

  if (tall) {
    // Flashlight and camera shortcuts, then the home indicator.
    for (const side of [0.17, 0.83]) {
      ctx.fillStyle = "rgba(10,20,17,0.42)";
      ctx.beginPath();
      ctx.arc(x + w * side, y + h - u * 0.2, u * 0.064, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(x + w * side, y + h - u * 0.2, u * 0.019, 0, Math.PI * 2);
      ctx.fill();
    }
    pill(cx - w * 0.18, y + h - u * 0.036, w * 0.36, u * 0.014, u * 0.007, "rgba(255,255,255,0.92)");
  }
  ctx.restore();
}

/* ----------------------------------------------------------- backgrounds */

export interface BackgroundPreset {
  id: string;
  label: string;
  /** CSS preview (thumbnail chip). */
  css: string;
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

function linear(stops: [number, string][], angleDeg = 135) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const a = (angleDeg * Math.PI) / 180;
    const r = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
    const cx = w / 2;
    const cy = h / 2;
    const g = ctx.createLinearGradient(
      cx - (Math.cos(a) * r) / 2,
      cy - (Math.sin(a) * r) / 2,
      cx + (Math.cos(a) * r) / 2,
      cy + (Math.sin(a) * r) / 2
    );
    for (const [pos, color] of stops) g.addColorStop(pos, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
}

function withGlow(base: ReturnType<typeof linear>, glows: [number, number, string][]) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    base(ctx, w, h);
    for (const [gx, gy, color] of glows) {
      const g = ctx.createRadialGradient(w * gx, h * gy, 0, w * gx, h * gy, Math.max(w, h) * 0.6);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  };
}

/**
 * The same color at zero alpha. Canvas gradients blend unpremultiplied, so
 * fading to plain transparent black drags a dark fringe through the middle.
 */
function clear(color: string): string {
  if (color.startsWith("#")) return `rgba(${hexRgb(color).join(",")},0)`;
  const m = color.match(/rgba?\(([^,]+),([^,]+),([^,)]+)/);
  return m ? `rgba(${m[1]},${m[2]},${m[3]},0)` : "rgba(0,0,0,0)";
}

/** Soft blobs of color melting into each other over a base — a mesh gradient. */
function mesh(base: string, blobs: [number, number, number, string][]) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const d = Math.max(w, h);
    for (const [bx, by, br, color] of blobs) {
      const g = ctx.createRadialGradient(w * bx, h * by, 0, w * bx, h * by, d * br);
      g.addColorStop(0, color);
      g.addColorStop(1, clear(color));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  };
}
const meshCss = (base: string, blobs: [number, number, number, string][]) =>
  [...blobs].reverse().map(([x, y, r, c]) => `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${c}, transparent ${r * 100}%)`).join(", ") + `, ${base}`;

/** A photo studio's seamless sweep: a wall falling into a floor, lit from above. */
function cyclorama(wallTop: string, wallLow: string, floorFar: string, floorNear: string, pool: string) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const horizon = 0.64;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, wallTop);
    g.addColorStop(horizon - 0.07, wallLow);
    g.addColorStop(horizon + 0.05, floorFar);
    g.addColorStop(1, floorNear);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // The pool of light the key throws on the wall behind the subject.
    const d = Math.max(w, h);
    const p = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, d * 0.62);
    p.addColorStop(0, pool);
    p.addColorStop(1, clear(pool));
    ctx.fillStyle = p;
    ctx.fillRect(0, 0, w, h);
  };
}

/** A dark stage with one beam coming down from above. */
function spotlight(base: string, beam: string, floor: string) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // The cone, widening on its way down.
    const cone = ctx.createLinearGradient(0, 0, 0, h * 0.9);
    cone.addColorStop(0, beam);
    cone.addColorStop(1, clear(beam));
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(w * 0.42, 0);
    ctx.lineTo(w * 0.58, 0);
    ctx.lineTo(w * 0.98, h);
    ctx.lineTo(w * 0.02, h);
    ctx.fill();
    // Where it lands.
    ctx.save();
    ctx.translate(w / 2, h * 0.86);
    ctx.scale(1, 0.28);
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.5);
    pool.addColorStop(0, floor);
    pool.addColorStop(1, clear(floor));
    ctx.fillStyle = pool;
    ctx.fillRect(-w, -w * 2, w * 2, w * 4);
    ctx.restore();
  };
}

/** A glowing ring floating behind the device. */
function halo(base: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, ring: string, haze: string) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    base(ctx, w, h);
    const cx = w / 2;
    const cy = h * 0.47;
    const r = Math.min(w, h) * 0.36;
    const soft = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 1.7);
    soft.addColorStop(0, clear(haze));
    soft.addColorStop(0.32, haze);
    soft.addColorStop(1, clear(haze));
    ctx.fillStyle = soft;
    ctx.fillRect(0, 0, w, h);
    const line = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.1);
    line.addColorStop(0, clear(ring));
    line.addColorStop(0.5, ring);
    line.addColorStop(1, clear(ring));
    ctx.fillStyle = line;
    ctx.fillRect(0, 0, w, h);
  };
}

/** A low sun burning through a graded sky. */
function sunSky(sky: [number, string][], sun: string, glow: string) {
  const paintSky = linear(sky, 90);
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    paintSky(ctx, w, h);
    const cx = w * 0.5;
    const cy = h * 0.6;
    const r = Math.min(w, h);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.75);
    g.addColorStop(0, glow);
    g.addColorStop(1, clear(glow));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const disc = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 0.2);
    disc.addColorStop(0, sun);
    disc.addColorStop(1, clear(sun));
    ctx.fillStyle = disc;
    ctx.fillRect(0, 0, w, h);
  };
}

// Pattern tiles for the drafting-table backdrops, one per tile size.
const patternTiles = new Map<string, HTMLCanvasElement>();
function patternTile(kind: "dots" | "grid", size: number, color: string): HTMLCanvasElement {
  const key = `${kind}|${size}|${color}`;
  let c = patternTiles.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  if (kind === "dots") {
    g.beginPath();
    g.arc(size / 2, size / 2, Math.max(0.8, size * 0.055), 0, Math.PI * 2);
    g.fill();
  } else {
    const t = Math.max(1, Math.round(size * 0.03));
    g.fillRect(0, 0, size, t);
    g.fillRect(0, 0, t, size);
  }
  patternTiles.set(key, c);
  return c;
}

/** A sheet of dots or grid lines, fading out toward the edges. */
function drafting(kind: "dots" | "grid", base: string, mark: string, glow: string) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const d = Math.max(w, h);
    const lift = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, d * 0.6);
    lift.addColorStop(0, glow);
    lift.addColorStop(1, clear(glow));
    ctx.fillStyle = lift;
    ctx.fillRect(0, 0, w, h);
    const size = Math.max(8, Math.round(Math.min(w, h) / (kind === "dots" ? 34 : 14)));
    ctx.save();
    // Centered, so the sheet lines up the same in every ratio.
    ctx.translate((w / 2) % size, (h / 2) % size);
    ctx.fillStyle = ctx.createPattern(patternTile(kind, size, mark), "repeat")!;
    ctx.fillRect(-size, -size, w + size * 2, h + size * 2);
    ctx.restore();
    const fade = ctx.createRadialGradient(w / 2, h * 0.45, d * 0.22, w / 2, h * 0.45, d * 0.72);
    fade.addColorStop(0, clear(base));
    fade.addColorStop(1, base);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);
  };
}

const CANDY: [number, number, number, string][] = [
  [0.1, 0.12, 0.62, "#ff5fa2"],
  [0.92, 0.2, 0.6, "#ffb347"],
  [0.85, 0.95, 0.66, "#7c4dff"],
  [0.1, 0.95, 0.55, "#ff7ad9"],
];
const LAGOON: [number, number, number, string][] = [
  [0.12, 0.1, 0.62, "#22d3ee"],
  [0.92, 0.16, 0.6, "#34d399"],
  [0.82, 0.95, 0.66, "#1d4ed8"],
  [0.08, 0.92, 0.55, "#0d9488"],
];
const IRIS: [number, number, number, string][] = [
  [0.14, 0.1, 0.62, "#6366f1"],
  [0.9, 0.14, 0.58, "#a855f7"],
  [0.86, 0.94, 0.66, "#06b6d4"],
  [0.08, 0.9, 0.55, "#312e81"],
];
const PEACH: [number, number, number, string][] = [
  [0.1, 0.1, 0.62, "#ffd6c2"],
  [0.92, 0.18, 0.6, "#fff1b8"],
  [0.85, 0.95, 0.66, "#ffc2d9"],
  [0.08, 0.92, 0.55, "#ffe2b8"],
];
const MOSS: [number, number, number, string][] = [
  [0.12, 0.1, 0.62, "#a7f3d0"],
  [0.92, 0.16, 0.6, "#fef9c3"],
  [0.85, 0.95, 0.66, "#6ee7b7"],
  [0.08, 0.92, 0.55, "#d1fae5"],
];

export const BACKGROUNDS: readonly BackgroundPreset[] = [
  {
    id: "emerald",
    label: "Emerald",
    css: "linear-gradient(135deg,#022c22,#065f46 55%,#10b981)",
    paint: withGlow(linear([[0, "#022c22"], [0.55, "#065f46"], [1, "#0f9b74"]]), [
      [0.8, 0.15, "rgba(52,211,153,0.35)"],
    ]),
  },
  {
    id: "dusk",
    label: "Dusk",
    css: "linear-gradient(135deg,#1e1b4b,#7c3aed 60%,#fb7185)",
    paint: withGlow(linear([[0, "#1e1b4b"], [0.6, "#7c3aed"], [1, "#fb7185"]]), [
      [0.2, 0.85, "rgba(251,113,133,0.3)"],
    ]),
  },
  {
    id: "ocean",
    label: "Ocean",
    css: "linear-gradient(135deg,#082f49,#0369a1 55%,#22d3ee)",
    paint: withGlow(linear([[0, "#082f49"], [0.55, "#0369a1"], [1, "#22d3ee"]]), [
      [0.85, 0.8, "rgba(34,211,238,0.3)"],
    ]),
  },
  {
    id: "sand",
    label: "Sand",
    css: "linear-gradient(135deg,#fdf6ec,#f5e3c8 60%,#e7c496)",
    paint: linear([[0, "#fdf6ec"], [0.6, "#f5e3c8"], [1, "#e7c496"]]),
  },
  {
    id: "graphite",
    label: "Graphite",
    css: "linear-gradient(135deg,#0b0b0e,#1f2026 60%,#3a3d46)",
    paint: withGlow(linear([[0, "#0b0b0e"], [0.6, "#1f2026"], [1, "#3a3d46"]]), [
      [0.75, 0.1, "rgba(255,255,255,0.08)"],
    ]),
  },
  {
    id: "paper",
    label: "Paper",
    css: "linear-gradient(135deg,#fafafa,#eef0f2)",
    paint: linear([[0, "#fafafa"], [1, "#e8ebee"]]),
  },
  {
    id: "sunset",
    label: "Sunset",
    css: "linear-gradient(135deg,#431407,#c2410c 55%,#fbbf24)",
    paint: withGlow(linear([[0, "#431407"], [0.55, "#c2410c"], [1, "#fbbf24"]]), [
      [0.75, 0.2, "rgba(251,191,36,0.35)"],
    ]),
  },
  {
    id: "rose",
    label: "Rose",
    css: "linear-gradient(135deg,#4c0519,#be123c 55%,#fda4af)",
    paint: withGlow(linear([[0, "#4c0519"], [0.55, "#be123c"], [1, "#fda4af"]]), [
      [0.2, 0.2, "rgba(253,164,175,0.28)"],
    ]),
  },
  {
    id: "midnight",
    label: "Midnight",
    css: "linear-gradient(135deg,#020617,#1e293b 60%,#334155)",
    paint: withGlow(linear([[0, "#020617"], [0.6, "#1e293b"], [1, "#334155"]]), [
      [0.5, 0.0, "rgba(148,163,184,0.14)"],
    ]),
  },
  {
    id: "aurora",
    label: "Aurora",
    css: "linear-gradient(135deg,#042f2e,#0f766e 45%,#a21caf)",
    paint: withGlow(linear([[0, "#042f2e"], [0.45, "#0f766e"], [1, "#a21caf"]]), [
      [0.85, 0.15, "rgba(217,70,239,0.3)"],
      [0.15, 0.85, "rgba(45,212,191,0.25)"],
    ]),
  },
  {
    id: "cream",
    label: "Cream",
    css: "linear-gradient(135deg,#fffbeb,#fef3c7 60%,#fde68a)",
    paint: linear([[0, "#fffbeb"], [0.6, "#fef3c7"], [1, "#fde68a"]]),
  },
  { id: "candy", label: "Candy", css: meshCss("#ff8fb8", CANDY), paint: mesh("#ff8fb8", CANDY) },
  { id: "lagoon", label: "Lagoon", css: meshCss("#0e7490", LAGOON), paint: mesh("#0e7490", LAGOON) },
  { id: "iris", label: "Iris", css: meshCss("#4338ca", IRIS), paint: mesh("#4338ca", IRIS) },
  { id: "peach", label: "Peach", css: meshCss("#ffe4d1", PEACH), paint: mesh("#ffe4d1", PEACH) },
  { id: "moss", label: "Moss", css: meshCss("#d9f7e6", MOSS), paint: mesh("#d9f7e6", MOSS) },
  {
    id: "studio-white",
    label: "Studio White",
    css: "linear-gradient(180deg,#f3f4f6,#ffffff 55%,#d9dce1 66%,#eceef1)",
    paint: cyclorama("#e6e8ec", "#fafbfc", "#d3d7dd", "#eef0f3", "rgba(255,255,255,0.75)"),
  },
  {
    id: "studio-black",
    label: "Studio Black",
    css: "linear-gradient(180deg,#050506,#1b1c20 55%,#08080a 66%,#17181c)",
    paint: cyclorama("#030304", "#1a1b20", "#070709", "#191a1f", "rgba(120,130,150,0.2)"),
  },
  {
    id: "studio-emerald",
    label: "Studio Emerald",
    css: "linear-gradient(180deg,#022c22,#0b6b50 55%,#03231b 66%,#075540)",
    paint: cyclorama("#01211a", "#0a6a4f", "#021f18", "#07553f", "rgba(52,211,153,0.28)"),
  },
  {
    id: "spotlight",
    label: "Spotlight",
    css: "radial-gradient(ellipse 70% 30% at 50% 88%,rgba(255,255,255,0.28),transparent), linear-gradient(180deg,rgba(255,255,255,0.22),transparent 85%), #060607",
    paint: spotlight("#050506", "rgba(255,255,255,0.2)", "rgba(255,255,255,0.3)"),
  },
  {
    id: "halo",
    label: "Halo",
    css: "radial-gradient(circle at 50% 47%,transparent 30%,#34d399 36%,transparent 43%), radial-gradient(circle at 50% 47%,rgba(16,185,129,0.35),transparent 70%), #03120e",
    paint: halo(linear([[0, "#020a08"], [1, "#04221a"]], 90), "rgba(110,231,183,0.95)", "rgba(16,185,129,0.4)"),
  },
  {
    id: "eclipse",
    label: "Eclipse",
    css: "radial-gradient(circle at 50% 47%,transparent 30%,#fdba74 36%,transparent 43%), radial-gradient(circle at 50% 47%,rgba(244,63,94,0.4),transparent 70%), #0d0508",
    paint: halo(linear([[0, "#080305"], [1, "#1c0a12"]], 90), "rgba(253,186,116,0.95)", "rgba(244,63,94,0.42)"),
  },
  {
    id: "sunrise",
    label: "Sunrise",
    css: "radial-gradient(circle at 50% 60%,#fff7d6 0 18%,rgba(255,196,120,0.7) 30%,transparent 62%), linear-gradient(180deg,#27194d,#b4407a 48%,#ff9d5c 72%,#ffd9a0)",
    paint: sunSky([[0, "#27194d"], [0.48, "#b4407a"], [0.72, "#ff9d5c"], [1, "#ffd9a0"]], "rgba(255,247,214,0.95)", "rgba(255,190,110,0.6)"),
  },
  {
    id: "dots",
    label: "Dot Grid",
    css: "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1.5px) 0 0 / 7px 7px, #0c0d10",
    paint: drafting("dots", "#0a0b0d", "rgba(255,255,255,0.3)", "rgba(52,211,153,0.16)"),
  },
  {
    id: "blueprint",
    label: "Blueprint",
    css: "linear-gradient(rgba(147,197,253,0.4) 1px, transparent 1px) 0 0 / 9px 9px, linear-gradient(90deg, rgba(147,197,253,0.4) 1px, transparent 1px) 0 0 / 9px 9px, #0b2a5b",
    paint: drafting("grid", "#082048", "rgba(147,197,253,0.34)", "rgba(59,130,246,0.45)"),
  },
  {
    id: "graph",
    label: "Graph Paper",
    css: "linear-gradient(rgba(15,23,42,0.14) 1px, transparent 1px) 0 0 / 9px 9px, linear-gradient(90deg, rgba(15,23,42,0.14) 1px, transparent 1px) 0 0 / 9px 9px, #f6f4ee",
    paint: drafting("grid", "#f4f1ea", "rgba(15,23,42,0.12)", "rgba(255,255,255,0.9)"),
  },
  {
    id: "transparent",
    label: "None",
    css: "repeating-conic-gradient(#d4d4d8 0% 25%, #fafafa 0% 50%) 0 0 / 14px 14px",
    paint: () => {
      /* transparent PNG */
    },
  },
];

/** Build a backdrop from a single user-picked color — dark→light sweep with a soft glow. */
export function customBackground(hex: string): BackgroundPreset {
  return {
    id: "custom",
    label: "Custom",
    css: `linear-gradient(135deg, ${shade(hex, 0.3)}, ${shade(hex, 0.68)} 55%, ${shade(hex, 1.08)})`,
    paint: withGlow(linear([[0, shade(hex, 0.3)], [0.55, shade(hex, 0.68)], [1, shade(hex, 1.08)]]), [
      [0.8, 0.15, "rgba(255,255,255,0.16)"],
    ]),
  };
}

/** Backdrop built from two colors sampled off the screen content. */
export function duotoneBackground(deep: string, vivid: string): BackgroundPreset {
  return {
    id: "match",
    label: "Match",
    css: `linear-gradient(135deg, ${shade(deep, 0.3)}, ${shade(vivid, 0.62)} 55%, ${vivid})`,
    paint: withGlow(linear([[0, shade(deep, 0.3)], [0.55, shade(vivid, 0.62)], [1, vivid]]), [
      [0.8, 0.15, "rgba(255,255,255,0.14)"],
    ]),
  };
}
