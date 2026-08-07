/**
 * App Store Screenshot Studio engine. Takes raw app screenshots and lays them
 * out as store-ready marketing panels — device frame, headline, background —
 * rendered onto a <canvas> at the exact pixel sizes Apple and Google demand.
 *
 * One design drives every size: pick a set of devices and the same panels
 * re-render at each store's required resolution, so a whole submission is one
 * export. The background can run *continuously* across the panel set, which is
 * what makes a screenshot row read as a single wide banner in the store.
 *
 * Deterministic and dependency-free: the same renderer draws the preview and
 * the exported PNG.
 */

/* ------------------------------ device presets ---------------------------- */

export type DeviceId =
  | "iphone69"
  | "iphone65"
  | "ipad13"
  | "ipad129"
  | "android"
  | "androidtab"
  | "feature"
  | "mac";

/** How the top of the screen is interrupted — purely cosmetic. */
export type FrameKind = "island" | "notch" | "punch" | "plain" | "desktop";

export interface DevicePreset {
  id: DeviceId;
  label: string;
  /** Store this size belongs to — drives the grouping in the picker. */
  store: "App Store" | "Play Store";
  /** Why the size exists, shown under the picker. */
  note: string;
  /** Exact export dimensions required by the store. */
  w: number;
  h: number;
  frame: FrameKind;
  /** Slug used for the per-device folder inside the ZIP. */
  folder: string;
  /** Landscape presets default to the split layout and a smaller device. */
  landscape?: boolean;
}

export const DEVICES: DevicePreset[] = [
  {
    id: "iphone69",
    label: 'iPhone 6.9"',
    store: "App Store",
    note: "Required · iPhone 16/17 Pro Max",
    w: 1290,
    h: 2796,
    frame: "island",
    folder: "iphone-6.9",
  },
  {
    id: "iphone65",
    label: 'iPhone 6.5"',
    store: "App Store",
    note: "Accepted for older iPhone sizes",
    w: 1242,
    h: 2688,
    frame: "notch",
    folder: "iphone-6.5",
  },
  {
    id: "ipad13",
    label: 'iPad 13"',
    store: "App Store",
    note: "Required if the app ships on iPad",
    w: 2064,
    h: 2752,
    frame: "plain",
    folder: "ipad-13",
  },
  {
    id: "ipad129",
    label: 'iPad 12.9"',
    store: "App Store",
    note: "Legacy iPad Pro size",
    w: 2048,
    h: 2732,
    frame: "plain",
    folder: "ipad-12.9",
  },
  {
    id: "mac",
    label: "Mac",
    store: "App Store",
    note: "Mac App Store · landscape",
    w: 2880,
    h: 1800,
    frame: "desktop",
    folder: "mac",
    landscape: true,
  },
  {
    id: "android",
    label: "Android phone",
    store: "Play Store",
    note: "Phone screenshots · 9:16",
    w: 1080,
    h: 1920,
    frame: "punch",
    folder: "android-phone",
  },
  {
    id: "androidtab",
    label: 'Android tablet 10"',
    store: "Play Store",
    note: "Tablet screenshots",
    w: 1600,
    h: 2560,
    frame: "plain",
    folder: "android-tablet",
  },
  {
    id: "feature",
    label: "Feature graphic",
    store: "Play Store",
    note: "Required banner at the top of the listing",
    w: 1024,
    h: 500,
    frame: "island",
    folder: "feature-graphic",
    landscape: true,
  },
];

export function deviceOf(id: DeviceId): DevicePreset {
  return DEVICES.find((d) => d.id === id) ?? DEVICES[0];
}

/* ----------------------------------- model -------------------------------- */

/** Where the copy sits relative to the device. */
export type Layout = "bottom" | "top" | "split" | "full" | "text";

export const LAYOUTS: { id: Layout; label: string; hint: string }[] = [
  { id: "bottom", label: "Copy on top", hint: "headline above, device below — the store default" },
  { id: "top", label: "Copy below", hint: "device up top, headline underneath" },
  { id: "split", label: "Side by side", hint: "copy left, device right — best on landscape" },
  { id: "full", label: "Device only", hint: "no copy, device fills the panel" },
  { id: "text", label: "Copy only", hint: "a pure marketing panel between screenshots" },
];

export type BgType = "mesh" | "gradient" | "solid";
export type FrameColor = "graphite" | "silver" | "midnight" | "none";

export const FRAME_COLORS: { id: FrameColor; label: string }[] = [
  { id: "graphite", label: "Graphite" },
  { id: "silver", label: "Silver" },
  { id: "midnight", label: "Midnight" },
  { id: "none", label: "Frameless" },
];

export const FRAMES: { id: FrameKind; label: string }[] = [
  { id: "island", label: "Dynamic Island" },
  { id: "notch", label: "Notch" },
  { id: "punch", label: "Punch hole" },
  { id: "plain", label: "Clean bezel" },
  { id: "desktop", label: "Desktop" },
];

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

export interface Panel {
  id: string;
  /** Supports *asterisks* around a phrase to paint it in the accent colour. */
  headline: string;
  subhead: string;
  layout: Layout;
}

export interface ShotConfig {
  /** The size shown in the preview. */
  device: DeviceId;
  /** Every size the ZIP export writes — always includes `device`. */
  exportDevices: DeviceId[];

  bgType: BgType;
  meshBase: string;
  mesh: MeshBlob[];
  gradFrom: string;
  gradTo: string;
  gradAngle: number;
  solid: string;
  /** Run one background across the whole set so the row reads as a banner. */
  continuous: boolean;

  frame: FrameKind | "auto";
  frameColor: FrameColor;
  /** Device width as a fraction of the panel width. */
  deviceScale: number;
  /** Nudges the device down the panel, as a fraction of panel height. */
  deviceOffset: number;
  /** Fake Y-axis rotation, in degrees. */
  tilt: number;
  /** In-plane rotation, in degrees. */
  rotate: number;
  shadow: number;
  /** Let the device run past the bottom edge for a cropped, premium look. */
  bleed: boolean;

  titleFont: string;
  bodyFont: string;
  titleScale: number;
  textColor: string;
  mutedColor: string;
  accentFrom: string;
  accentTo: string;
  accentGradient: boolean;

  topGlow: boolean;
  grain: number;
  vignette: number;

  /** Filename stem — also the ZIP name. */
  appName: string;
  scale: number;
  panels: Panel[];
}

export interface PanelImage {
  el: CanvasImageSource;
  w: number;
  h: number;
}

export function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `panel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function makePanel(layout: Layout = "bottom"): Panel {
  return { id: newId(), headline: "Your feature in five words", subhead: "", layout };
}

/* ---------------------------------- themes -------------------------------- */

export const THEMES: { name: string; swatch: string; patch: Partial<ShotConfig> }[] = [
  {
    name: "Emerald",
    swatch: "linear-gradient(135deg,#059669,#0ea5e9)",
    patch: {
      bgType: "mesh",
      meshBase: "#04140f",
      mesh: [
        { x: 0.12, y: 0.18, color: "#059669" },
        { x: 0.88, y: 0.12, color: "#0ea5e9" },
        { x: 0.7, y: 0.92, color: "#10b981" },
      ],
      textColor: "#f0fdf4",
      mutedColor: "#a7f3d0",
      accentFrom: "#34d399",
      accentTo: "#22d3ee",
      accentGradient: true,
      topGlow: true,
      grain: 0.07,
      vignette: 0.2,
      frameColor: "graphite",
    },
  },
  {
    name: "Midnight",
    swatch: "linear-gradient(135deg,#111827,#38bdf8)",
    patch: {
      bgType: "gradient",
      gradFrom: "#111827",
      gradTo: "#020617",
      gradAngle: 160,
      textColor: "#e2e8f0",
      mutedColor: "#94a3b8",
      accentFrom: "#6ee7b7",
      accentTo: "#38bdf8",
      accentGradient: true,
      topGlow: true,
      grain: 0.06,
      vignette: 0.18,
      frameColor: "midnight",
    },
  },
  {
    name: "Paper",
    swatch: "linear-gradient(135deg,#f4f4f5,#047857)",
    patch: {
      bgType: "solid",
      solid: "#f4f4f5",
      textColor: "#09090b",
      mutedColor: "#52525b",
      accentFrom: "#047857",
      accentTo: "#0891b2",
      accentGradient: true,
      topGlow: false,
      grain: 0,
      vignette: 0,
      frameColor: "silver",
    },
  },
  {
    name: "Mint wash",
    swatch: "linear-gradient(135deg,#d1fae5,#0284c7)",
    patch: {
      bgType: "gradient",
      gradFrom: "#d1fae5",
      gradTo: "#ecfeff",
      gradAngle: 150,
      textColor: "#052e26",
      mutedColor: "#0f766e",
      accentFrom: "#0d9488",
      accentTo: "#0284c7",
      accentGradient: true,
      topGlow: false,
      grain: 0.05,
      vignette: 0,
      frameColor: "silver",
    },
  },
];

export const DEFAULT_SHOTS: ShotConfig = {
  device: "iphone69",
  exportDevices: ["iphone69"],

  bgType: "mesh",
  meshBase: "#04140f",
  mesh: [
    { x: 0.12, y: 0.18, color: "#059669" },
    { x: 0.88, y: 0.12, color: "#0ea5e9" },
    { x: 0.7, y: 0.92, color: "#10b981" },
  ],
  gradFrom: "#111827",
  gradTo: "#020617",
  gradAngle: 160,
  solid: "#f4f4f5",
  continuous: true,

  frame: "auto",
  frameColor: "graphite",
  deviceScale: 0.74,
  deviceOffset: 0,
  tilt: 0,
  rotate: 0,
  shadow: 0.55,
  bleed: true,

  titleFont: "--font-space-grotesk",
  bodyFont: "--font-geist-sans",
  titleScale: 1,
  textColor: "#f0fdf4",
  mutedColor: "#a7f3d0",
  accentFrom: "#34d399",
  accentTo: "#22d3ee",
  accentGradient: true,

  topGlow: true,
  grain: 0.07,
  vignette: 0.2,

  appName: "My app",
  scale: 1,
  panels: [
    { id: newId(), headline: "Everything in *one place*", subhead: "Notes, tasks and files, finally together.", layout: "bottom" },
    { id: newId(), headline: "Search that *actually* finds it", subhead: "Full-text across every note you've ever written.", layout: "bottom" },
    { id: newId(), headline: "Built for *speed*", subhead: "Opens instantly. Works offline.", layout: "bottom" },
    { id: newId(), headline: "Your data, *your rules*", subhead: "End-to-end encrypted, export anytime.", layout: "bottom" },
    { id: newId(), headline: "Start free today", subhead: "No card required.", layout: "text" },
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

/** Perceived luminance, used to decide whether the placeholder screen is dark. */
function isDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
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

function parseHeadline(text: string): Word[] {
  return text
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((p) =>
      p.startsWith("*") && p.endsWith("*") && p.length > 2
        ? { text: p.slice(1, -1), hi: true }
        : { text: p, hi: false }
    )
    .flatMap((s) => s.text.split(/\s+/).filter(Boolean).map((t) => ({ text: t, hi: s.hi })));
}

export function plainHeadline(text: string): string {
  return text.replace(/\*([^*]+)\*/g, "$1");
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
  const words = text.split(/\s+/).filter(Boolean).map((t) => ({ text: t, hi: false }));
  return wrapWords(ctx, words, maxW).map((l) => l.map((w) => w.text).join(" "));
}

function lineWidth(ctx: CanvasRenderingContext2D, line: Word[]): number {
  const space = ctx.measureText(" ").width;
  return line.reduce((s, w, i) => s + (i ? space : 0) + ctx.measureText(w.text).width, 0);
}

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

function drawCover(ctx: CanvasRenderingContext2D, img: PanelImage, x: number, y: number, w: number, h: number) {
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

/* ------------------------------- device frame ----------------------------- */

const BODY_COLORS: Record<Exclude<FrameColor, "none">, [string, string, string]> = {
  // [outer edge, body, inner rim highlight]
  graphite: ["#4b5563", "#1f2937", "#6b7280"],
  silver: ["#e5e7eb", "#c7cbd1", "#f8fafc"],
  midnight: ["#334155", "#0b1220", "#475569"],
};

/**
 * Renders the device — body, bezel, screen, camera cutout — into its own canvas
 * at `screenW` screen width, so the caller can tilt, rotate and shadow it as a
 * single sprite. Returns null when the screen would be too small to matter.
 */
function buildDevice(
  cfg: ShotConfig,
  device: DevicePreset,
  frame: FrameKind,
  screenW: number,
  screenH: number,
  image: PanelImage | undefined,
  accent: string
): HTMLCanvasElement | null {
  if (screenW < 8 || screenH < 8) return null;

  const frameless = cfg.frameColor === "none";
  const desktop = frame === "desktop";
  // Bezel thickness tracks the screen width so every device size looks alike.
  const bezel = frameless ? 0 : Math.max(2, screenW * (desktop ? 0.022 : 0.032));
  const chin = desktop && !frameless ? bezel * 6 : bezel;
  const radius = desktop ? screenW * 0.02 : screenW * 0.115;

  const w = Math.round(screenW + bezel * 2);
  const h = Math.round(screenH + bezel + chin);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Screenshots are usually far larger than the frame — without this, the
  // browser's cheap downscale filter makes the screen look soft.
  ctx.imageSmoothingQuality = "high";

  const sx = bezel;
  const sy = bezel;
  const screenR = frameless ? radius * 0.86 : Math.max(0, radius - bezel * 0.6);

  if (cfg.frameColor !== "none") {
    const [edge, body, rim] = BODY_COLORS[cfg.frameColor];
    // Body with a soft metal gradient across the width.
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, edge);
    g.addColorStop(0.14, body);
    g.addColorStop(0.86, body);
    g.addColorStop(1, edge);
    roundRectPath(ctx, 0, 0, w, h, radius + bezel * 0.6);
    ctx.fillStyle = g;
    ctx.fill();

    // Hairline rim so the frame reads as machined metal, not a flat rectangle.
    ctx.lineWidth = Math.max(1, bezel * 0.22);
    ctx.strokeStyle = rgba(rim, 0.8);
    ctx.stroke();
  }

  // Screen.
  ctx.save();
  roundRectPath(ctx, sx, sy, screenW, screenH, screenR);
  ctx.clip();
  if (image) {
    drawCover(ctx, image, sx, sy, screenW, screenH);
  } else {
    drawPlaceholderScreen(ctx, sx, sy, screenW, screenH, accent, cfg);
  }
  ctx.restore();

  if (!desktop) {
    drawCutout(ctx, frame, sx, sy, screenW, screenH, frameless);
    // Home indicator — the small bar every modern iOS/Android screenshot has.
    const barW = screenW * 0.34;
    const barH = Math.max(2, screenH * 0.005);
    roundRectPath(ctx, sx + (screenW - barW) / 2, sy + screenH - barH * 3.4, barW, barH, barH);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
  } else if (!frameless) {
    // Laptop chin with a subtle logo dot.
    ctx.beginPath();
    ctx.arc(w / 2, sy + screenH + chin / 2, Math.max(1.5, bezel * 0.35), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fill();
  }

  // Screen glass sheen — a diagonal highlight across the top-left corner.
  ctx.save();
  roundRectPath(ctx, sx, sy, screenW, screenH, screenR);
  ctx.clip();
  const sheen = ctx.createLinearGradient(sx, sy, sx + screenW * 0.75, sy + screenH * 0.5);
  sheen.addColorStop(0, "rgba(255,255,255,0.16)");
  sheen.addColorStop(0.55, "rgba(255,255,255,0.02)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(sx, sy, screenW, screenH);
  ctx.restore();

  return canvas;
}

function drawCutout(
  ctx: CanvasRenderingContext2D,
  frame: FrameKind,
  sx: number,
  sy: number,
  screenW: number,
  screenH: number,
  frameless: boolean
) {
  ctx.fillStyle = "#05070c";
  if (frame === "island") {
    const iw = screenW * 0.28;
    const ih = screenH * 0.0165;
    roundRectPath(ctx, sx + (screenW - iw) / 2, sy + screenH * 0.012, iw, ih, ih / 2);
    ctx.fill();
  } else if (frame === "notch") {
    const nw = screenW * 0.46;
    const nh = screenH * 0.022;
    const nx = sx + (screenW - nw) / 2;
    ctx.beginPath();
    ctx.moveTo(nx, sy - 1);
    ctx.lineTo(nx + nw, sy - 1);
    ctx.lineTo(nx + nw, sy + nh - nh * 0.5);
    ctx.arcTo(nx + nw, sy + nh, nx + nw - nh * 0.5, sy + nh, nh * 0.5);
    ctx.lineTo(nx + nh * 0.5, sy + nh);
    ctx.arcTo(nx, sy + nh, nx, sy + nh - nh * 0.5, nh * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (frame === "punch") {
    const r = screenW * 0.022;
    ctx.beginPath();
    ctx.arc(sx + screenW / 2, sy + screenH * 0.018 + r, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (frame === "plain" && !frameless) {
    // A single camera dot centred in the top bezel.
    const r = Math.max(1, screenW * 0.006);
    ctx.beginPath();
    ctx.arc(sx + screenW / 2, sy / 2, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fill();
  }
}

/**
 * A neutral app mock shown until a real screenshot is uploaded, so the panel
 * never previews as an empty rectangle.
 */
function drawPlaceholderScreen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
  cfg: ShotConfig
) {
  const dark = isDark(cfg.bgType === "solid" ? cfg.solid : cfg.bgType === "gradient" ? cfg.gradTo : cfg.meshBase);
  const bg = dark ? "#0b1220" : "#ffffff";
  const line = dark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
  const strong = dark ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.20)";

  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  const pad = w * 0.08;
  // Status bar.
  ctx.fillStyle = strong;
  roundRectPath(ctx, x + pad, y + h * 0.026, w * 0.14, h * 0.008, h * 0.004);
  ctx.fill();
  roundRectPath(ctx, x + w - pad - w * 0.16, y + h * 0.026, w * 0.16, h * 0.008, h * 0.004);
  ctx.fill();

  // Title + accent pill.
  ctx.fillStyle = strong;
  roundRectPath(ctx, x + pad, y + h * 0.075, w * 0.46, h * 0.022, h * 0.006);
  ctx.fill();
  ctx.fillStyle = accent;
  roundRectPath(ctx, x + w - pad - w * 0.22, y + h * 0.072, w * 0.22, h * 0.028, h * 0.014);
  ctx.fill();

  // Card list.
  let cy = y + h * 0.14;
  const cardH = h * 0.1;
  for (let i = 0; i < 5 && cy + cardH < y + h * 0.9; i++) {
    ctx.fillStyle = line;
    roundRectPath(ctx, x + pad, cy, w - pad * 2, cardH, w * 0.05);
    ctx.fill();
    ctx.fillStyle = i === 0 ? accent : strong;
    ctx.beginPath();
    ctx.arc(x + pad + cardH * 0.5, cy + cardH / 2, cardH * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = strong;
    roundRectPath(ctx, x + pad + cardH, cy + cardH * 0.3, w * 0.4, h * 0.012, h * 0.006);
    ctx.fill();
    ctx.fillStyle = line;
    roundRectPath(ctx, x + pad + cardH, cy + cardH * 0.56, w * 0.28, h * 0.011, h * 0.005);
    ctx.fill();
    cy += cardH * 1.22;
  }

  // Tab bar.
  ctx.fillStyle = line;
  ctx.fillRect(x, y + h - h * 0.075, w, h * 0.075);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i === 0 ? accent : strong;
    ctx.beginPath();
    ctx.arc(x + w * (0.2 + i * 0.2), y + h - h * 0.038, w * 0.022, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draws a sprite with a fake Y-axis rotation. Canvas 2D is affine-only, so the
 * perspective is faked by walking vertical slices and scaling each one — the
 * far edge shrinks, the near edge grows. Convincing to roughly ±30°.
 */
function drawTilted(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  tilt: number
) {
  if (Math.abs(tilt) < 0.4) {
    ctx.drawImage(src, x, y, w, h);
    return;
  }
  const a = (tilt * Math.PI) / 180;
  const dw = w * Math.cos(a);
  const dx = x + (w - dw) / 2;
  const depth = Math.sin(a) * 0.26;
  const slices = Math.max(48, Math.min(400, Math.round(dw)));
  const sliceSrc = src.width / slices;
  const sliceDst = dw / slices;
  for (let i = 0; i < slices; i++) {
    const u = (i + 0.5) / slices;
    const scale = 1 + depth * (2 * u - 1);
    const sh = h * scale;
    // Overdraw by a hair so neighbouring slices never leave seams.
    ctx.drawImage(
      src,
      i * sliceSrc,
      0,
      sliceSrc + 0.7,
      src.height,
      dx + i * sliceDst,
      y + (h - sh) / 2,
      sliceDst + 0.7,
      sh
    );
  }
}

/* --------------------------------- renderer ------------------------------- */

export interface RenderOpts {
  /** Index within the set — drives the continuous background offset. */
  index: number;
  total: number;
  image?: PanelImage;
  /** Output size; defaults to the device's store size. */
  outW: number;
  outH: number;
}

export function renderPanel(
  canvas: HTMLCanvasElement,
  cfgIn: ShotConfig,
  panel: Panel,
  device: DevicePreset,
  opts: RenderOpts
) {
  const cfg: ShotConfig = { ...DEFAULT_SHOTS, ...cfgIn };
  const W = Math.max(1, Math.round(opts.outW));
  const H = Math.max(1, Math.round(opts.outH));
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingQuality = "high";

  const titleFamily = resolveFont(cfg.titleFont);
  const bodyFamily = resolveFont(cfg.bodyFont);
  const frame = cfg.frame === "auto" ? device.frame : cfg.frame;
  const landscape = W > H;

  // A continuous background is drawn as if it spanned the whole set, then
  // shifted so each panel shows its own slice of the same artwork.
  const wide = cfg.continuous && opts.total > 1;
  const bgW = wide ? W * opts.total : W;
  const bgX = wide ? -opts.index * W : 0;

  drawBackground(ctx, cfg, bgX, bgW, W, H);

  if (cfg.topGlow) {
    const g = ctx.createRadialGradient(W / 2, -H * 0.14, 0, W / 2, -H * 0.14, H * 1.05);
    g.addColorStop(0, rgba(cfg.accentFrom, 0.38));
    g.addColorStop(1, rgba(cfg.accentFrom, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---- geometry ---- */
  const padX = W * (landscape ? 0.07 : 0.085);
  const padY = H * (landscape ? 0.1 : 0.07);
  const layout = panel.layout;
  const split = layout === "split";
  const contentW = split ? W * 0.44 - padX : W - padX * 2;

  /* ---- copy block (measured first so the device can take what's left) ---- */
  const basePx = (landscape ? H * 0.092 : H * 0.042) * cfg.titleScale;
  let titlePx = basePx;
  const subPx = basePx * 0.42;
  const gap = basePx * 0.34;
  const words = parseHeadline(panel.headline || "");

  const measure = () => {
    ctx.font = `800 ${titlePx}px ${titleFamily}`;
    const titleLines = words.length ? wrapWords(ctx, words, contentW) : [];
    ctx.font = `400 ${subPx}px ${bodyFamily}`;
    const subLines = panel.subhead.trim() ? wrapPlain(ctx, panel.subhead, contentW) : [];
    return { titleLines, titleLH: titlePx * 1.16, subLines, subLH: subPx * 1.4 };
  };
  let m = measure();

  const hasCopy = layout !== "full" && (m.titleLines.length > 0 || m.subLines.length > 0);
  const copyH = hasCopy
    ? m.titleLines.length * m.titleLH + (m.subLines.length ? gap + m.subLines.length * m.subLH : 0)
    : 0;

  // Copy-only panels centre a much larger headline.
  if (layout === "text") {
    titlePx = basePx * 1.5;
    m = measure();
    let guard = 0;
    while (
      m.titleLines.length * m.titleLH + (m.subLines.length ? gap + m.subLines.length * m.subLH : 0) >
        H - padY * 2 &&
      titlePx > basePx * 0.6 &&
      guard++ < 20
    ) {
      titlePx *= 0.94;
      m = measure();
    }
    const blockH = m.titleLines.length * m.titleLH + (m.subLines.length ? gap + m.subLines.length * m.subLH : 0);
    drawCopy(ctx, cfg, m, titleFamily, bodyFamily, W / 2, (H - blockH) / 2, "center", gap, titlePx, subPx);
    finish(ctx, cfg, W, H);
    return;
  }

  /* ---- device ---- */
  const copyBlock = hasCopy ? copyH + padY * (landscape ? 0.5 : 0.75) : 0;
  const availH = split ? H - padY * 2 : H - padY - copyBlock;

  let screenW = W * cfg.deviceScale * (split ? 0.9 : 1);
  let screenH = (screenW * device.h) / device.w;
  // Bleeding lets the device run past the bottom; otherwise it must fit.
  const maxH = cfg.bleed && !split ? availH * 1.34 : availH;
  if (screenH > maxH) {
    screenH = maxH;
    screenW = (screenH * device.w) / device.h;
  }

  const sprite = buildDevice(cfg, device, frame, screenW, screenH, opts.image, cfg.accentFrom);

  if (sprite) {
    // buildDevice already works in panel pixels, so the sprite needs no scaling.
    const spriteW = sprite.width;
    const spriteH = sprite.height;
    const cx = split ? W * 0.72 : W / 2;
    let cy =
      split || layout === "full"
        ? H / 2
        : layout === "top"
          ? padY + spriteH / 2
          : padY + copyBlock + spriteH / 2;
    cy += H * cfg.deviceOffset;

    ctx.save();
    ctx.translate(cx, cy);
    if (cfg.rotate) ctx.rotate((cfg.rotate * Math.PI) / 180);
    if (cfg.shadow > 0) {
      ctx.shadowColor = `rgba(0,0,0,${0.55 * cfg.shadow})`;
      ctx.shadowBlur = spriteW * 0.16 * cfg.shadow;
      ctx.shadowOffsetY = spriteH * 0.035 * cfg.shadow;
    }
    drawTilted(ctx, sprite, -spriteW / 2, -spriteH / 2, spriteW, spriteH, cfg.tilt);
    ctx.restore();
  }

  /* ---- copy ---- */
  if (hasCopy) {
    const align: CanvasTextAlign = split ? "left" : "center";
    const x = split ? padX : W / 2;
    const y = split
      ? (H - copyH) / 2
      : layout === "top"
        ? H - padY - copyH
        : padY;
    drawCopy(ctx, cfg, m, titleFamily, bodyFamily, x, y, align, gap, titlePx, subPx);
  }

  finish(ctx, cfg, W, H);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  cfg: ShotConfig,
  bgX: number,
  bgW: number,
  W: number,
  H: number
) {
  if (cfg.bgType === "solid") {
    ctx.fillStyle = cfg.solid;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  if (cfg.bgType === "gradient") {
    const a = (cfg.gradAngle * Math.PI) / 180;
    const cx = bgX + bgW / 2;
    const cy = H / 2;
    const len = (Math.abs(Math.cos(a)) * bgW + Math.abs(Math.sin(a)) * H) / 2;
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
    return;
  }
  ctx.fillStyle = cfg.meshBase;
  ctx.fillRect(0, 0, W, H);
  // Panel-relative so blobs stay the same visual size however wide the set is.
  const radius = Math.max(W, H) * 0.85;
  for (const b of cfg.mesh) {
    const px = bgX + b.x * bgW;
    const py = b.y * H;
    const g = ctx.createRadialGradient(px, py, 0, px, py, radius);
    g.addColorStop(0, rgba(b.color, 0.85));
    g.addColorStop(1, rgba(b.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawCopy(
  ctx: CanvasRenderingContext2D,
  cfg: ShotConfig,
  m: { titleLines: Word[][]; titleLH: number; subLines: string[]; subLH: number },
  titleFamily: string,
  bodyFamily: string,
  anchorX: number,
  startY: number,
  align: CanvasTextAlign,
  gap: number,
  titlePx: number,
  subPx: number
) {
  const accentFill = (x: number, w: number): string | CanvasGradient => {
    if (!cfg.accentGradient) return cfg.accentFrom;
    const g = ctx.createLinearGradient(x, 0, x + Math.max(1, w), 0);
    g.addColorStop(0, cfg.accentFrom);
    g.addColorStop(1, cfg.accentTo);
    return g;
  };

  ctx.textBaseline = "top";
  let y = startY;

  ctx.font = `800 ${titlePx}px ${titleFamily}`;
  const space = ctx.measureText(" ").width;
  for (const line of m.titleLines) {
    const lw = lineWidth(ctx, line);
    let x = align === "center" ? anchorX - lw / 2 : anchorX;
    for (const word of line) {
      const ww = ctx.measureText(word.text).width;
      ctx.fillStyle = word.hi ? accentFill(x, ww) : cfg.textColor;
      ctx.textAlign = "left";
      ctx.fillText(word.text, x, y);
      x += ww + space;
    }
    y += m.titleLH;
  }

  if (m.subLines.length) {
    y += gap;
    ctx.font = `400 ${subPx}px ${bodyFamily}`;
    ctx.fillStyle = cfg.mutedColor;
    ctx.textAlign = align;
    for (const line of m.subLines) {
      ctx.fillText(line, anchorX, y);
      y += m.subLH;
    }
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function finish(ctx: CanvasRenderingContext2D, cfg: ShotConfig, W: number, H: number) {
  if (cfg.vignette > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${cfg.vignette})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (cfg.grain > 0) {
    const pat = grainPattern(ctx);
    if (pat) {
      ctx.save();
      ctx.globalAlpha = cfg.grain * 0.16;
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}

/* ------------------------------ export helpers ---------------------------- */

export function slugify(text: string, fallback: string): string {
  const s = plainHeadline(text)
    .trim()
    .toLowerCase()
    .slice(0, 34)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || fallback;
}

/** `iphone-6.9/01-everything-in-one-place.png` — ordered, store-grouped. */
export function panelFilename(cfg: ShotConfig, device: DevicePreset, index: number, withFolder: boolean): string {
  const panel = cfg.panels[index];
  const stem = slugify(panel?.headline ?? "", `screen-${index + 1}`);
  const name = `${String(index + 1).padStart(2, "0")}-${stem}.png`;
  return withFolder ? `${device.folder}/${name}` : name;
}

export function zipName(cfg: ShotConfig): string {
  return `${slugify(cfg.appName, "app")}-store-screenshots.zip`;
}

/** Total files an export will write — shown on the button so nothing surprises. */
export function exportCount(cfg: ShotConfig): number {
  return Math.max(1, cfg.exportDevices.length) * cfg.panels.length;
}

export const MAX_PANELS = 10;
