/**
 * Mockup compositor — draws media inside vector device frames on a 2D canvas.
 * Pure rendering: no DOM access beyond the provided context, no network.
 */

export type FrameKind = "none" | "window" | "browser" | "phone";

export interface MockupOptions {
  width: number;
  height: number;
  /** Transparent background (PNG export keeps alpha). */
  transparent: boolean;
  /** Background gradient — set both stops to the same color for a solid fill. */
  from: string;
  to: string;
  angle: number;
  frame: FrameKind;
  /** Dark chrome for window/browser frames. */
  dark: boolean;
  /** Address text shown in the browser frame's URL pill. */
  url: string;
  /** Device size as a percentage of the canvas (40–95). */
  scale: number;
  /** Corner radius in design pixels (relative to a 1000px canvas unit). */
  radius: number;
  /** Tilt in degrees (-15 to 15). */
  tilt: number;
  /** Drop shadow strength (0–100). */
  shadow: number;
  caption: string;
  captionTop: boolean;
}

export interface MediaSource {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface GradientPreset {
  id: string;
  name: string;
  from: string;
  to: string;
  angle: number;
}

export const GRADIENTS: GradientPreset[] = [
  { id: "aurora", name: "Aurora", from: "#6366f1", to: "#06b6d4", angle: 135 },
  { id: "sunset", name: "Sunset", from: "#f97316", to: "#ec4899", angle: 120 },
  { id: "candy", name: "Candy", from: "#f472b6", to: "#a78bfa", angle: 135 },
  { id: "ocean", name: "Ocean", from: "#0ea5e9", to: "#1d4ed8", angle: 160 },
  { id: "emerald", name: "Emerald", from: "#059669", to: "#84cc16", angle: 135 },
  { id: "dusk", name: "Dusk", from: "#7c3aed", to: "#db2777", angle: 150 },
  { id: "flame", name: "Flame", from: "#ef4444", to: "#f59e0b", angle: 120 },
  { id: "mint", name: "Mint", from: "#14b8a6", to: "#a3e635", angle: 135 },
  { id: "midnight", name: "Midnight", from: "#1e293b", to: "#7c3aed", angle: 160 },
  { id: "graphite", name: "Graphite", from: "#334155", to: "#0f172a", angle: 135 },
];

export interface CanvasPreset {
  id: string;
  name: string;
  width: number;
  height: number;
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: "x", name: "X / Twitter post · 1600×900", width: 1600, height: 900 },
  { id: "og", name: "OG / link preview · 1200×630", width: 1200, height: 630 },
  { id: "square", name: "Instagram square · 1080×1080", width: 1080, height: 1080 },
  { id: "story", name: "Story / Reel · 1080×1920", width: 1080, height: 1920 },
  { id: "dribbble", name: "Dribbble shot · 1600×1200", width: 1600, height: 1200 },
  { id: "youtube", name: "YouTube thumbnail · 1280×720", width: 1280, height: 720 },
];

export const DEFAULT_MOCKUP: Omit<MockupOptions, "width" | "height"> = {
  transparent: false,
  from: GRADIENTS[0].from,
  to: GRADIENTS[0].to,
  angle: GRADIENTS[0].angle,
  frame: "browser",
  dark: false,
  url: "forma.tools",
  scale: 78,
  radius: 14,
  tilt: 0,
  shadow: 55,
  caption: "",
  captionTop: true,
};

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  media: MediaSource,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / media.width, h / media.height);
  const dw = media.width * scale;
  const dh = media.height * scale;
  ctx.drawImage(media.source, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function luminance(hex: string): number {
  const v = hex.replace("#", "");
  if (v.length < 6) return 1;
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** True when light text reads better on the current background. */
export function prefersLightText(opts: MockupOptions): boolean {
  if (opts.transparent) return false;
  return (luminance(opts.from) + luminance(opts.to)) / 2 < 0.55;
}

export function renderMockup(
  ctx: CanvasRenderingContext2D,
  opts: MockupOptions,
  media: MediaSource | null
) {
  const W = opts.width;
  const H = opts.height;
  const unit = Math.min(W, H);
  ctx.clearRect(0, 0, W, H);

  /* ----------------------------- Background ------------------------------ */
  if (!opts.transparent) {
    if (opts.from === opts.to) {
      ctx.fillStyle = opts.from;
    } else {
      const rad = ((opts.angle - 90) * Math.PI) / 180;
      const r = Math.sqrt(W * W + H * H) / 2;
      const cx = W / 2;
      const cy = H / 2;
      const g = ctx.createLinearGradient(
        cx - Math.cos(rad) * r,
        cy - Math.sin(rad) * r,
        cx + Math.cos(rad) * r,
        cy + Math.sin(rad) * r
      );
      g.addColorStop(0, opts.from);
      g.addColorStop(1, opts.to);
      ctx.fillStyle = g;
    }
    ctx.fillRect(0, 0, W, H);
  }

  /* ------------------------------- Caption ------------------------------- */
  const captionSize = unit * 0.052;
  const captionBand = opts.caption ? captionSize * 2.2 : 0;
  if (opts.caption) {
    ctx.fillStyle = prefersLightText(opts) ? "#ffffff" : "#0f172a";
    ctx.font = `700 ${captionSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const y = opts.captionTop ? captionBand * 0.62 : H - captionBand * 0.62;
    ctx.fillText(opts.caption, W / 2, y, W * 0.92);
  }

  /* --------------------------- Device geometry --------------------------- */
  const scale = opts.scale / 100;
  const availW = W * scale;
  const availH = (H - captionBand) * scale;

  const mediaAspect = media ? media.width / media.height : 16 / 10;
  const isPhone = opts.frame === "phone";
  const screenAspect = isPhone ? 9 / 19 : mediaAspect;

  let screenW = availW;
  let screenH = screenW / screenAspect;
  const barRatio = opts.frame === "browser" ? 0.062 : opts.frame === "window" ? 0.048 : 0;
  let barH = screenW * barRatio;
  const bezelRatio = isPhone ? 0.03 : 0;
  let bezel = screenW * bezelRatio;
  let outerW = screenW + bezel * 2;
  let outerH = screenH + barH + bezel * 2;

  if (outerH > availH) {
    const k = availH / outerH;
    screenW *= k;
    screenH *= k;
    barH *= k;
    bezel *= k;
    outerW *= k;
    outerH *= k;
  }

  const cx = W / 2;
  const cy = (opts.captionTop ? captionBand : 0) + (H - captionBand) / 2;
  const ox = cx - outerW / 2;
  const oy = cy - outerH / 2;
  const radius = isPhone ? outerW * 0.135 : (opts.radius / 1000) * unit * 2.2;

  ctx.save();
  if (opts.tilt !== 0) {
    ctx.translate(cx, cy);
    ctx.rotate((opts.tilt * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  /* -------------------------------- Shadow ------------------------------- */
  if (opts.shadow > 0) {
    const s = opts.shadow / 100;
    ctx.save();
    ctx.shadowColor = `rgba(2, 6, 23, ${0.5 * s})`;
    ctx.shadowBlur = unit * 0.07 * s;
    ctx.shadowOffsetY = unit * 0.028 * s;
    roundedRect(ctx, ox, oy, outerW, outerH, radius);
    ctx.fillStyle = isPhone || opts.dark ? "#0f172a" : "#ffffff";
    ctx.fill();
    ctx.restore();
  }

  /* ------------------------------ Frame body ----------------------------- */
  roundedRect(ctx, ox, oy, outerW, outerH, radius);
  ctx.fillStyle = isPhone ? "#0b1220" : opts.dark ? "#0f172a" : "#ffffff";
  ctx.fill();

  const screenX = ox + bezel;
  const screenY = oy + bezel + barH;

  /* ----------------------------- Chrome bars ----------------------------- */
  if (opts.frame === "browser" || opts.frame === "window") {
    ctx.save();
    roundedRect(ctx, ox, oy, outerW, outerH, radius);
    ctx.clip();
    ctx.fillStyle = opts.dark ? "#1e293b" : "#f1f5f9";
    ctx.fillRect(ox, oy, outerW, barH);
    ctx.fillStyle = opts.dark ? "#0f172a" : "#e2e8f0";
    ctx.fillRect(ox, oy + barH - Math.max(1, unit * 0.0012), outerW, Math.max(1, unit * 0.0012));

    const lightR = barH * 0.14;
    const lightY = oy + barH / 2;
    (["#f87171", "#fbbf24", "#34d399"] as const).forEach((color, i) => {
      ctx.beginPath();
      ctx.arc(ox + barH * 0.55 + i * lightR * 3.1, lightY, lightR, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    if (opts.frame === "browser") {
      const pillW = outerW * 0.46;
      const pillH = barH * 0.56;
      roundedRect(ctx, ox + (outerW - pillW) / 2, lightY - pillH / 2, pillW, pillH, pillH / 2);
      ctx.fillStyle = opts.dark ? "#334155" : "#ffffff";
      ctx.fill();
      ctx.fillStyle = opts.dark ? "#94a3b8" : "#64748b";
      ctx.font = `400 ${pillH * 0.52}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opts.url || "example.com", cx, lightY + pillH * 0.03, pillW * 0.9);
    }
    ctx.restore();
  }

  /* ----------------------------- Screen media ---------------------------- */
  const screenR = Math.max(0, radius - bezel);
  ctx.save();
  if (isPhone) {
    roundedRect(ctx, screenX, screenY, screenW, screenH, screenR);
  } else if (barH > 0) {
    // Square top corners under the chrome bar, rounded bottom.
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(screenX + screenW, screenY);
    ctx.lineTo(screenX + screenW, screenY + screenH - radius);
    ctx.arcTo(screenX + screenW, screenY + screenH, screenX, screenY + screenH, radius);
    ctx.arcTo(screenX, screenY + screenH, screenX, screenY, radius);
    ctx.lineTo(screenX, screenY);
    ctx.closePath();
  } else {
    roundedRect(ctx, screenX, screenY, screenW, screenH, radius);
  }
  ctx.clip();

  if (media) {
    drawCover(ctx, media, screenX, screenY, screenW, screenH);
  } else {
    // Placeholder screen
    const g = ctx.createLinearGradient(screenX, screenY, screenX + screenW, screenY + screenH);
    g.addColorStop(0, opts.dark || isPhone ? "#1e293b" : "#e2e8f0");
    g.addColorStop(1, opts.dark || isPhone ? "#0f172a" : "#cbd5e1");
    ctx.fillStyle = g;
    ctx.fillRect(screenX, screenY, screenW, screenH);
    ctx.fillStyle = opts.dark || isPhone ? "#64748b" : "#475569";
    ctx.font = `500 ${screenW * 0.045}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Drop, paste or upload media", screenX + screenW / 2, screenY + screenH / 2);
  }
  ctx.restore();

  /* ------------------------------ Punch hole ----------------------------- */
  if (isPhone) {
    ctx.beginPath();
    ctx.arc(cx, screenY + screenW * 0.055, screenW * 0.022, 0, Math.PI * 2);
    ctx.fillStyle = "#0b1220";
    ctx.fill();
  }

  ctx.restore();
}
