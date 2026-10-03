/**
 * 2D side of the 3D tools: the compositor that lays a rendered device or logo
 * onto a backdrop (glow, shadow, floor reflection, grain), the backdrops
 * themselves, finishes, and the painters for screen content.
 */

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
    ctx.filter = `blur(${(w * 0.03).toFixed(1)}px)`;
    ctx.drawImage(sil, w * 0.012, h * 0.036, w, h);
    ctx.globalAlpha = 0.38 * shadow;
    ctx.filter = `blur(${(w * 0.007).toFixed(1)}px)`;
    ctx.drawImage(sil, w * 0.003, h * 0.009, w, h);
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

export interface FrameFinish {
  id: string;
  label: string;
  light: string;
  dark: string;
  /** Matte single-color "clay" body instead of metal and glass. */
  clay?: boolean;
}

export const FINISHES: readonly FrameFinish[] = [
  { id: "titanium", label: "Natural Titanium", light: "#b3ada3", dark: "#5f5a53" },
  { id: "burgundy", label: "Burgundy", light: "#62464b", dark: "#46202a" },
  { id: "black", label: "Space Black", light: "#3c3c3f", dark: "#151517" },
  { id: "silver", label: "Silver", light: "#e2e3e6", dark: "#a2a4a9" },
  { id: "gold", label: "Light Gold", light: "#eddcbd", dark: "#b39469" },
  { id: "navy", label: "Navy", light: "#46536f", dark: "#1f2740" },
  { id: "orange", label: "Cosmic Orange", light: "#e8873e", dark: "#9a4a18" },
  { id: "deepblue", label: "Deep Blue", light: "#41567e", dark: "#141f3a" },
  { id: "sage", label: "Sage", light: "#a7b89d", dark: "#5a6a52" },
  { id: "lavender", label: "Lavender", light: "#cfc4e6", dark: "#8b7fae" },
  { id: "skyblue", label: "Sky Blue", light: "#b9d4e7", dark: "#6d92ac" },
  { id: "clay-white", label: "Clay White", light: "#eeeeec", dark: "#d6d6d3", clay: true },
  { id: "clay-ink", label: "Clay Ink", light: "#2c2d31", dark: "#1b1c1f", clay: true },
  { id: "clay-emerald", label: "Clay Emerald", light: "#4fb892", dark: "#3c9a78", clay: true },
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
  ctx.filter = `blur(${(short * 0.04).toFixed(1)}px)`;
  const ribbons: [number, number, number, number, number, string][] = [
    [0.12, 0.64, 0.9, 0.17, -0.9, "rgba(16,185,129,0.7)"],
    [0.78, 0.47, 0.85, 0.12, -0.96, "rgba(45,212,191,0.5)"],
    [0.55, 0.88, 0.9, 0.2, -0.8, "rgba(5,150,105,0.8)"],
    [0.98, 0.2, 0.6, 0.09, -1.02, "rgba(167,243,208,0.4)"],
  ];
  for (const [rx, ry, len, thick, rot, color] of ribbons) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x + rx * w, y + ry * h, len * long, thick * short, rot, 0, Math.PI * 2);
    ctx.fill();
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
