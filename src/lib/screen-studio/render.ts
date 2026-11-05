/**
 * Draws one finished frame: wallpaper, the recording inside a window with
 * the camera's move applied, click ripples, the camera bubble and the
 * caption. The preview and every export call the same function, so they
 * always match.
 *
 * In "scene" mode the camera moves through the whole shot: the window comes
 * towards you, the wallpaper drifts a little less (parallax), and once the
 * window fills the frame the camera stays inside it.
 */
import { drawBackground } from "./backgrounds";
import type { Cam } from "./camera";
import type { Caption, Click, Style } from "./types";

export interface Sources {
  video: HTMLVideoElement;
  cam?: HTMLVideoElement | null;
  wallpaper?: HTMLImageElement | null;
}

export interface Moment {
  /** Source time. */
  t: number;
  /** Output time and length, for the intro and outro. */
  out: number;
  outDuration: number;
  /** A paused editor frame: show the window even at the very start. */
  still?: boolean;
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/** Where the window sits on the canvas, before any camera move. */
export function layout(style: Style, W: number, H: number, vw: number, vh: number) {
  const k = Math.min(W, H) / 1080;
  const pad = style.padding * Math.min(W, H);
  const bar = style.frame === "mac" || style.frame === "browser" ? Math.round(40 * k) : 0;
  const ring = style.frame === "glass" ? Math.round(12 * k) : 0;
  const availW = W - pad * 2 - ring * 2;
  const availH = H - pad * 2 - ring * 2;
  const aspect = vw / vh;
  let cw = availW;
  let ch = cw / aspect;
  if (ch + bar > availH) {
    ch = availH - bar;
    cw = ch * aspect;
  }
  const x = (W - cw) / 2;
  const y = (H - ch - bar) / 2 + bar;
  return { k, pad, bar, ring, content: { x, y, w: cw, h: ch }, window: { x, y: y - bar, w: cw, h: ch + bar } };
}

/** The scene camera's transform: scale and the canvas point at the centre of view. */
export function sceneView(cam: Cam, L: ReturnType<typeof layout>, W: number, H: number) {
  const c = L.content;
  const S = Math.max(1, cam.scale);
  const fx = c.x + cam.x * c.w;
  const fy = c.y + cam.y * c.h;
  // Bounds blend from "stay on the canvas" to "stay on the recording" as the
  // window grows to fill the frame, so the move never reveals an edge.
  const fill = Math.max(W / c.w, H / c.h);
  const u = fill > 1 ? Math.min(1, (S - 1) / Math.max(0.01, fill - 1)) : 1;
  const hw = W / (2 * S);
  const hh = H / (2 * S);
  const lx = hw + (c.x + hw - hw) * u;
  const ux = W - hw - (W - (c.x + c.w)) * u;
  const ly = hh + (c.y + hh - hh) * u;
  const uy = H - hh - (H - (c.y + c.h)) * u;
  const vx = lx > ux ? (lx + ux) / 2 : Math.min(ux, Math.max(lx, fx));
  const vy = ly > uy ? (ly + uy) / 2 : Math.min(uy, Math.max(ly, fy));
  return { S, vx, vy };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(-2);
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  src: Sources,
  m: Moment,
  cam: Cam,
  style: Style,
  captions: Caption[],
  clicks: Click[] = []
) {
  const v = src.video;
  const vw = v.videoWidth || 1920;
  const vh = v.videoHeight || 1080;
  const L = layout(style, W, H, vw, vh);
  const { k, content: c, window: win } = L;
  const r = style.radius * k;
  const scene = style.zoomMode === "scene";
  const view = scene ? sceneView(cam, L, W, H) : { S: 1, vx: W / 2, vy: H / 2 };

  // Intro and outro: the window settles in, and fades away at the end.
  let reveal = 1;
  if (style.intro && m.outDuration > 2 && !m.still) {
    const inP = easeOut(m.out / 0.9);
    const outP = easeOut((m.outDuration - m.out) / 0.6);
    reveal = Math.min(inP, outP);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Wallpaper, with a touch of parallax as the camera moves in.
  ctx.save();
  if (scene && view.S > 1.001) {
    const p = 1 + (view.S - 1) * 0.12;
    ctx.translate(W / 2, H / 2);
    ctx.scale(p, p);
    ctx.translate(-W / 2 - (view.vx - W / 2) * 0.12, -H / 2 - (view.vy - H / 2) * 0.12);
  }
  if (!drawBackground(ctx, style.background, W, H, src.wallpaper)) {
    ctx.filter = `blur(${Math.round(60 * k)}px) saturate(1.3) brightness(0.8)`;
    const s = Math.max(W / vw, H / vh) * 1.2;
    ctx.drawImage(v, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s);
    ctx.filter = "none";
  }
  ctx.restore();

  // Everything on the "set" moves with the camera.
  ctx.save();
  if (scene) {
    ctx.translate(W / 2, H / 2);
    ctx.scale(view.S, view.S);
    ctx.translate(-view.vx, -view.vy);
  }
  if (reveal < 1) {
    const s = 0.92 + 0.08 * reveal;
    ctx.translate(W / 2, H / 2 + (1 - reveal) * 30 * k);
    ctx.scale(s, s);
    ctx.translate(-W / 2, -H / 2);
    ctx.globalAlpha = reveal;
  }

  if (style.shadow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${0.55 * style.shadow})`;
    ctx.shadowBlur = 80 * k * style.shadow;
    ctx.shadowOffsetY = 28 * k * style.shadow;
    rounded(ctx, win.x, win.y, win.w, win.h, r);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
  }
  if (L.ring) {
    ctx.save();
    rounded(ctx, win.x - L.ring, win.y - L.ring, win.w + L.ring * 2, win.h + L.ring * 2, r + L.ring);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = Math.max(1, k);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  rounded(ctx, win.x, win.y, win.w, win.h, r);
  ctx.clip();
  if (L.bar) {
    ctx.fillStyle = style.frame === "browser" ? "#1f1f23" : "#2a2a2e";
    ctx.fillRect(win.x, win.y, win.w, L.bar);
    ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => {
      ctx.beginPath();
      ctx.arc(win.x + 22 * k + i * 21 * k, win.y + L.bar / 2, 6.5 * k, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    });
    if (style.frame === "browser") {
      const pw = Math.min(win.w * 0.46, 520 * k);
      const ph = 24 * k;
      const px = win.x + (win.w - pw) / 2;
      const py = win.y + (L.bar - ph) / 2;
      rounded(ctx, px, py, pw, ph, ph / 2);
      ctx.fillStyle = "#2f2f35";
      ctx.fill();
      ctx.fillStyle = "#a1a1aa";
      ctx.font = `500 ${13 * k}px -apple-system, "Segoe UI", Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(style.url, px + pw / 2, py + ph / 2 + 0.5 * k);
    }
  }
  const blur = style.motionBlur ? Math.min(2.4, Math.max(0, cam.speed - 0.35) * 1.4) * k : 0;
  if (blur > 0.25) ctx.filter = `blur(${(blur / view.S).toFixed(2)}px)`;
  if (scene) ctx.drawImage(v, c.x, c.y, c.w, c.h);
  else {
    const sw = vw / cam.scale;
    const sh = vh / cam.scale;
    ctx.drawImage(v, cam.x * vw - sw / 2, cam.y * vh - sh / 2, sw, sh, c.x, c.y, c.w, c.h);
  }
  ctx.filter = "none";

  // Click ripples, where the cursor was.
  if (style.ripples) {
    for (const ck of clicks) {
      const p = (m.t - ck.t) / 0.55;
      if (p < 0 || p > 1) continue;
      let px: number;
      let py: number;
      if (scene) {
        px = c.x + ck.x * c.w;
        py = c.y + ck.y * c.h;
      } else {
        px = c.x + ((ck.x - cam.x) * cam.scale + 0.5) * c.w;
        py = c.y + ((ck.y - cam.y) * cam.scale + 0.5) * c.h;
      }
      const e = easeOut(p);
      const rad = (8 + 26 * e) * k * (scene ? 1 : cam.scale * 0.6);
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(20,20,24,${0.16 * (1 - p)})`;
      ctx.fill();
      ctx.lineWidth = 2.5 * k;
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * (1 - p)})`;
      ctx.stroke();
      ctx.lineWidth = 1 * k;
      ctx.strokeStyle = `rgba(0,0,0,${0.35 * (1 - p)})`;
      ctx.beginPath();
      ctx.arc(px, py, rad + 1.8 * k, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;

  // Camera bubble.
  const camEl = src.cam;
  if (style.bubble.show && camEl && camEl.videoWidth) {
    const size = style.bubble.size * Math.min(W, H);
    const mg = Math.max(24 * k, L.pad * 0.45);
    const bx = style.bubble.corner.endsWith("l") ? mg : W - mg - size;
    const by = style.bubble.corner.startsWith("t") ? mg : H - mg - size;
    const rr = style.bubble.shape === "circle" ? size / 2 : size * 0.22;
    ctx.save();
    ctx.globalAlpha = reveal;
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 40 * k;
    ctx.shadowOffsetY = 12 * k;
    rounded(ctx, bx, by, size, size, rr);
    ctx.fillStyle = "#111";
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = reveal;
    rounded(ctx, bx, by, size, size, rr);
    ctx.clip();
    const cs = Math.max(size / camEl.videoWidth, size / camEl.videoHeight);
    const dw = camEl.videoWidth * cs;
    const dh = camEl.videoHeight * cs;
    ctx.translate(bx + size, by);
    ctx.scale(-1, 1);
    ctx.drawImage(camEl, (size - dw) / 2, (size - dh) / 2, dw, dh);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = reveal;
    rounded(ctx, bx, by, size, size, rr);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3 * k;
    ctx.stroke();
    ctx.restore();
  }

  // Caption.
  if (style.captions.show) {
    const cap = captions.find((x) => m.t >= x.start && m.t <= x.end);
    if (cap?.text.trim()) {
      const fs = 34 * k * style.captions.size;
      ctx.save();
      ctx.font = `600 ${fs}px -apple-system, "Segoe UI", Inter, sans-serif`;
      const lines = wrap(ctx, cap.text.trim(), W * 0.7);
      const lh = fs * 1.3;
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs * 1.4;
      const bh = lines.length * lh + fs * 0.7;
      const bx = (W - bw) / 2;
      const by = H - Math.max(L.pad * 0.5, 30 * k) - bh;
      rounded(ctx, bx, by, bw, bh, fs * 0.55);
      ctx.fillStyle = "rgba(10,10,12,0.78)";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      lines.forEach((l, i) => ctx.fillText(l, W / 2, by + fs * 0.35 + lh * (i + 0.5)));
      ctx.restore();
    }
  }
}

/** Canvas point → recording point (0–1), undoing the camera. For aiming zooms by clicking. */
export function pickPoint(style: Style, W: number, H: number, vw: number, vh: number, cam: Cam, px: number, py: number) {
  const L = layout(style, W, H, vw, vh);
  const c = L.content;
  let sx = px;
  let sy = py;
  if (style.zoomMode === "scene") {
    const v = sceneView(cam, L, W, H);
    sx = (px - W / 2) / v.S + v.vx;
    sy = (py - H / 2) / v.S + v.vy;
    return { x: (sx - c.x) / c.w, y: (sy - c.y) / c.h };
  }
  return { x: cam.x + ((sx - c.x) / c.w - 0.5) / cam.scale, y: cam.y + ((sy - c.y) / c.h - 0.5) / cam.scale };
}
