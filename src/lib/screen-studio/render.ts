/**
 * Draws one finished frame: wallpaper, the recording inside a window with
 * the camera's zoom applied, the camera bubble and the caption. The preview
 * and every export call the same function, so they always match.
 */
import { drawBackground } from "./backgrounds";
import type { Cam } from "./camera";
import type { Caption, Style } from "./types";

export interface Sources {
  video: HTMLVideoElement;
  cam?: HTMLVideoElement | null;
  wallpaper?: HTMLImageElement | null;
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/** Where the window sits on the canvas, for hit-testing clicks on the preview. */
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
  // Long captions show their last two lines, like live subtitles.
  return lines.slice(-2);
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  src: Sources,
  t: number,
  cam: Cam,
  style: Style,
  captions: Caption[]
) {
  const v = src.video;
  const vw = v.videoWidth || 1920;
  const vh = v.videoHeight || 1080;
  const L = layout(style, W, H, vw, vh);
  const { k, content: c, window: win } = L;
  const r = style.radius * k;

  // Wallpaper.
  ctx.save();
  if (!drawBackground(ctx, style.background, W, H, src.wallpaper)) {
    // "blur": the recording itself, huge and soft.
    ctx.filter = `blur(${Math.round(60 * k)}px) saturate(1.3) brightness(0.8)`;
    const s = Math.max(W / vw, H / vh) * 1.2;
    ctx.drawImage(v, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s);
    ctx.filter = "none";
  }
  ctx.restore();

  // Shadow and glass ring.
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

  // The window.
  ctx.save();
  rounded(ctx, win.x, win.y, win.w, win.h, r);
  ctx.clip();
  if (L.bar) {
    ctx.fillStyle = style.frame === "browser" ? "#1f1f23" : "#2a2a2e";
    ctx.fillRect(win.x, win.y, win.w, L.bar);
    const dot = 6.5 * k;
    ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => {
      ctx.beginPath();
      ctx.arc(win.x + 22 * k + i * 21 * k, win.y + L.bar / 2, dot, 0, Math.PI * 2);
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
  // The zoomed recording.
  const sw = vw / cam.scale;
  const sh = vh / cam.scale;
  const sx = cam.x * vw - sw / 2;
  const sy = cam.y * vh - sh / 2;
  const blur = style.motionBlur ? Math.min(2.2, Math.max(0, cam.speed - 0.35) * 1.4) * k : 0;
  if (blur > 0.25) ctx.filter = `blur(${blur.toFixed(2)}px)`;
  ctx.drawImage(v, sx, sy, sw, sh, c.x, c.y, c.w, c.h);
  ctx.filter = "none";
  ctx.restore();

  // Camera bubble.
  const camEl = src.cam;
  if (style.bubble.show && camEl && camEl.videoWidth) {
    const size = style.bubble.size * Math.min(W, H);
    const m = Math.max(24 * k, L.pad * 0.45);
    const bx = style.bubble.corner.endsWith("l") ? m : W - m - size;
    const by = style.bubble.corner.startsWith("t") ? m : H - m - size;
    const rr = style.bubble.shape === "circle" ? size / 2 : size * 0.22;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 40 * k;
    ctx.shadowOffsetY = 12 * k;
    rounded(ctx, bx, by, size, size, rr);
    ctx.fillStyle = "#111";
    ctx.fill();
    ctx.restore();
    ctx.save();
    rounded(ctx, bx, by, size, size, rr);
    ctx.clip();
    const cs = Math.max(size / camEl.videoWidth, size / camEl.videoHeight);
    const dw = camEl.videoWidth * cs;
    const dh = camEl.videoHeight * cs;
    // Mirrored, like looking in a mirror.
    ctx.translate(bx + size, by);
    ctx.scale(-1, 1);
    ctx.drawImage(camEl, (size - dw) / 2, (size - dh) / 2, dw, dh);
    ctx.restore();
    ctx.save();
    rounded(ctx, bx, by, size, size, rr);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3 * k;
    ctx.stroke();
    ctx.restore();
  }
  // Caption.
  if (style.captions.show) {
    const cap = captions.find((x) => t >= x.start && t <= x.end);
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
