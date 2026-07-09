/**
 * Real-3D device mockups on a 2D canvas.
 *
 * Each device is one or two "plates" (rounded slabs with thickness). The
 * renderer rotates them in true 3D, perspective-projects every vertex,
 * extrudes the rounded outline into lit side walls, and texture-maps the
 * front face (frame + screen + your image/video) with a subdivided
 * affine-triangle grid. Everything is canvas, so PNG and video export are
 * pixel-perfect — no DOM screenshot hacks.
 */

/* ------------------------------------------------------------------ math */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function rotXY(p: Vec3, rx: number, ry: number): Vec3 {
  // Rx then Ry (radians)
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const y1 = p.y * cx - p.z * sx;
  const z1 = p.y * sx + p.z * cx;
  return { x: p.x * cy + z1 * sy, y: y1, z: -p.x * sy + z1 * cy };
}

const CAMERA_DIST = 640;

/** Perspective divide; world y is up, canvas y is down. */
function project(p: Vec3): { x: number; y: number; z: number } {
  const k = CAMERA_DIST / (CAMERA_DIST - p.z);
  return { x: p.x * k, y: -p.y * k, z: p.z };
}

/** Rounded-rect outline in the XY plane, sampled clockwise. */
function roundedOutline(w: number, h: number, r: number, arcSteps = 7): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const hw = w / 2;
  const hh = h / 2;
  const corners: [number, number, number][] = [
    [hw - r, hh - r, 0], // top-right, angles 0..90
    [-hw + r, hh - r, 90],
    [-hw + r, -hh + r, 180],
    [hw - r, -hh + r, 270],
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= arcSteps; i++) {
      const a = ((start + (i / arcSteps) * 90) * Math.PI) / 180;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  }
  return pts;
}

/* ---------------------------------------------------------------- plates */

export interface Plate {
  w: number;
  h: number;
  thickness: number;
  radius: number;
  texture: HTMLCanvasElement;
  /** Local model transform applied before the global rotation. */
  transform?: (p: Vec3) => Vec3;
  /** Body color pair for the extruded edges. */
  edgeLight: string;
  edgeDark: string;
  /** Grid density for the textured front face. */
  gridX: number;
  gridY: number;
  /** Multiplier on wall lighting — below 1 mutes specular pop (small parts like buttons). */
  dim?: number;
  /** Flat inlays on the side walls (ports, speaker holes, mics) — drawn only when their face is toward the camera. */
  details?: { pts: Vec3[]; normal: Vec3; color: string }[];
}

type Face =
  | { kind: "fill"; pts: { x: number; y: number }[]; z: number; color: string }
  | {
      kind: "tex";
      quad: { x: number; y: number }[];
      uv: [number, number, number, number]; // u0 v0 u1 v1 (texture-space rect)
      z: number;
      texture: HTMLCanvasElement;
    };

function hexRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function shade(hex: string, k: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
}

const LIGHT: Vec3 = normalize({ x: -0.35, y: 0.55, z: 0.76 });

function normalize(v: Vec3): Vec3 {
  const m = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

function collectPlateFaces(plate: Plate, rx: number, ry: number): Face[] {
  const faces: Face[] = [];
  const t2 = plate.thickness / 2;
  const model = plate.transform ?? ((p: Vec3) => p);
  const world = (x: number, y: number, z: number) => rotXY(model({ x, y, z }), rx, ry);

  const outline = roundedOutline(plate.w, plate.h, plate.radius);
  const frontW = outline.map((p) => world(p.x, p.y, t2));
  const backW = outline.map((p) => world(p.x, p.y, -t2));
  const front = frontW.map(project);
  const back = backW.map(project);

  // Side walls — one quad per outline segment, lit by its world normal.
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const a = frontW[i];
    const b = frontW[j];
    const c = backW[j];
    const d = backW[i];
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const v = { x: d.x - a.x, y: d.y - a.y, z: d.z - a.z };
    const n = normalize({
      x: u.y * v.z - u.z * v.y,
      y: u.z * v.x - u.x * v.z,
      z: u.x * v.y - u.y * v.x,
    });
    const diffuse = Math.max(0, n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z);
    // Continuous dark→light metal blend instead of a hard two-tone split,
    // with a specular kick when the wall faces the key light head-on.
    const k =
      (0.38 + 0.62 * diffuse) *
      (plate.dim ?? 1) *
      (diffuse > 0.88 ? 1 + (diffuse - 0.88) * 1.8 : 1);
    const t = Math.min(1, Math.max(0, (diffuse - 0.22) / 0.55));
    const [dr, dg, db] = hexRgb(plate.edgeDark);
    const [lr, lg, lb] = hexRgb(plate.edgeLight);
    const ch = (d: number, l: number) => Math.min(255, Math.round((d + (l - d) * t) * k));
    faces.push({
      kind: "fill",
      pts: [front[i], front[j], back[j], back[i]],
      z: (a.z + b.z + c.z + d.z) / 4,
      color: `rgb(${ch(dr, lr)}, ${ch(dg, lg)}, ${ch(db, lb)})`,
    });
  }

  // Back face — plain body color (visible at steep angles).
  const backZ = backW.reduce((s, p) => s + p.z, 0) / backW.length;
  faces.push({ kind: "fill", pts: back, z: backZ - 0.01, color: shade(plate.edgeDark, 0.72) });

  // Side-wall inlays (ports, speaker holes) — only when their wall faces the camera.
  if (plate.details) {
    for (const det of plate.details) {
      const n = rotXY(det.normal, rx, ry);
      if (n.z <= 0.05) continue;
      const pts = det.pts.map((p) => project(rotXY(model(p), rx, ry)));
      // Way past any wall's z so the sort never buries a visible inlay — they only
      // draw when their wall faces the camera, i.e. when nothing else covers them.
      faces.push({ kind: "fill", pts, z: 1e4, color: det.color });
    }
  }

  // Front face — textured grid.
  const { gridX, gridY } = plate;
  const grid: { x: number; y: number; z: number }[][] = [];
  for (let gy = 0; gy <= gridY; gy++) {
    const row: { x: number; y: number; z: number }[] = [];
    for (let gx = 0; gx <= gridX; gx++) {
      const x = -plate.w / 2 + (gx / gridX) * plate.w;
      const y = plate.h / 2 - (gy / gridY) * plate.h;
      row.push(project(world(x, y, t2)));
    }
    grid.push(row);
  }
  const tw = plate.texture.width;
  const th = plate.texture.height;
  for (let gy = 0; gy < gridY; gy++) {
    for (let gx = 0; gx < gridX; gx++) {
      const quad = [grid[gy][gx], grid[gy][gx + 1], grid[gy + 1][gx + 1], grid[gy + 1][gx]];
      faces.push({
        kind: "tex",
        quad,
        uv: [(gx / gridX) * tw, (gy / gridY) * th, ((gx + 1) / gridX) * tw, ((gy + 1) / gridY) * th],
        z: quad.reduce((s, p) => s + p.z, 0) / 4 + 0.01,
        texture: plate.texture,
      });
    }
  }
  return faces;
}

/** Affine-map a texture triangle onto a screen triangle (clip + transform). */
function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  tex: HTMLCanvasElement,
  dest: { x: number; y: number }[],
  src: { x: number; y: number }[]
) {
  const [d0, d1, d2] = dest;
  const [s0, s1, s2] = src;
  const den = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(den) < 1e-8) return;
  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / den;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / den;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / den;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / den;
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    den;
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    den;

  // Inflate the clip a hair from the centroid to hide grid seams.
  const cx = (d0.x + d1.x + d2.x) / 3;
  const cy = (d0.y + d1.y + d2.y) / 3;
  const grow = (p: { x: number; y: number }) => ({
    x: cx + (p.x - cx) * 1.03,
    y: cy + (p.y - cy) * 1.03,
  });
  const g0 = grow(d0);
  const g1 = grow(d1);
  const g2 = grow(d2);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g0.x, g0.y);
  ctx.lineTo(g1.x, g1.y);
  ctx.lineTo(g2.x, g2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tex, 0, 0);
  ctx.restore();
}

/* ----------------------------------------------------------------- scene */

export interface SceneOptions {
  rotX: number; // radians
  rotY: number;
  zoom: number;
  /** 0..1 mirror-floor reflection strength. */
  reflection: number;
  /** World-space y of the floor (device-dependent). */
  floorY: number;
  background: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
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


/** Fit scale computed from the front view so zoom stays steady while spinning. */
export function computeFit(plates: Plate[], canvasW: number, canvasH: number): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const plate of plates) {
    const model = plate.transform ?? ((p: Vec3) => p);
    for (const o of roundedOutline(plate.w, plate.h, plate.radius, 3)) {
      const p = project(model({ x: o.x, y: o.y, z: plate.thickness / 2 }));
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  return Math.min((canvasW * 0.62) / spanX, (canvasH * 0.62) / spanY);
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  plates: Plate[],
  opts: SceneOptions,
  fit: number
) {
  const { width: w, height: h } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  opts.background(ctx, w, h);

  const scale = fit * opts.zoom;
  const cx = w / 2;
  const cy = h / 2 - h * 0.015;

  const faces = plates.flatMap((plate) => collectPlateFaces(plate, opts.rotX, opts.rotY));
  const fillFaces = faces.filter((face) => face.kind === "fill");
  const texFaces = faces.filter((face) => face.kind === "tex");
  fillFaces.sort((a, b) => a.z - b.z);
  texFaces.sort((a, b) => a.z - b.z);

  const toCanvas = (p: { x: number; y: number }) => ({ x: cx + p.x * scale, y: cy + p.y * scale });

  const drawDeviceFaces = (g: CanvasRenderingContext2D) => {
    for (const face of fillFaces) {
      const pts = face.pts.map(toCanvas);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.closePath();
      g.fillStyle = face.color;
      g.strokeStyle = face.color;
      g.lineWidth = 0.8;
      g.fill();
      g.stroke();
    }
    for (const face of texFaces) {
      const q = face.quad.map(toCanvas);
      const [u0, v0, u1, v1] = face.uv;
      drawTexturedTriangle(g, face.texture, [q[0], q[1], q[2]], [
        { x: u0, y: v0 },
        { x: u1, y: v0 },
        { x: u1, y: v1 },
      ]);
      drawTexturedTriangle(g, face.texture, [q[0], q[2], q[3]], [
        { x: u0, y: v0 },
        { x: u1, y: v1 },
        { x: u0, y: v1 },
      ]);
    }
  };

  const floor = project(rotXY({ x: 0, y: opts.floorY, z: 0 }, opts.rotX, opts.rotY));
  const sy = cy + floor.y * scale;

  // Mirror-floor reflection — geometry is rendered ONCE into an offscreen,
  // which serves both the reflection and the final device blit. The flip,
  // fade and blur touch only a fixed-height band below the floor line.
  let off: HTMLCanvasElement | null = null;
  if (opts.reflection > 0 && sy < h) {
    off = getScratch(0, w, h);
    const octx = off.getContext("2d")!;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, w, h);
    drawDeviceFaces(octx);

    const band = getScratch(1, w, Math.ceil(h * 0.34));
    const bctx = band.getContext("2d")!;
    bctx.globalCompositeOperation = "source-over";
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, band.width, band.height);
    bctx.setTransform(1, 0, 0, -1, 0, sy); // band row 0 = floor line, flipped
    bctx.drawImage(off, 0, 0);
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

  if (off) ctx.drawImage(off, 0, 0);
  else drawDeviceFaces(ctx);
}

/* --------------------------------------------------------------- devices */

export type DeviceId = "iphone" | "ipad";
export type Orientation = "portrait" | "landscape";

export interface FrameFinish {
  id: string;
  label: string;
  light: string;
  dark: string;
}

export const FINISHES: readonly FrameFinish[] = [
  { id: "titanium", label: "Titanium", light: "#98989f", dark: "#4e4e54" },
  { id: "black", label: "Space Black", light: "#3c3c3f", dark: "#151517" },
  { id: "silver", label: "Silver", light: "#e2e3e6", dark: "#a2a4a9" },
  { id: "gold", label: "Light Gold", light: "#eddcbd", dark: "#b39469" },
  { id: "navy", label: "Navy", light: "#46536f", dark: "#1f2740" },
  { id: "orange", label: "Cosmic Orange", light: "#e8873e", dark: "#9a4a18" },
  { id: "deepblue", label: "Deep Blue", light: "#41567e", dark: "#141f3a" },
  { id: "sage", label: "Sage", light: "#a7b89d", dark: "#5a6a52" },
  { id: "lavender", label: "Lavender", light: "#cfc4e6", dark: "#8b7fae" },
  { id: "skyblue", label: "Sky Blue", light: "#b9d4e7", dark: "#6d92ac" },
];

function roundRectPath(
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

/** Cover-fit a source image/video into a rect. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  src: ScreenSource,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const sw = src instanceof HTMLVideoElement ? src.videoWidth || 1 : src.width;
  const sh = src instanceof HTMLVideoElement ? src.videoHeight || 1 : src.height;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function paintPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#022c22");
  g.addColorStop(0.5, "#065f46");
  g.addColorStop(1, "#0d9488");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const glow = ctx.createRadialGradient(
    x + w * 0.75,
    y + h * 0.2,
    0,
    x + w * 0.75,
    y + h * 0.2,
    w * 0.9
  );
  glow.addColorStop(0, "rgba(52, 211, 153, 0.5)");
  glow.addColorStop(1, "rgba(52, 211, 153, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  const base = Math.min(w, h);
  ctx.font = `700 ${base * 0.085}px ui-sans-serif, system-ui`;
  ctx.textAlign = "left";
  ctx.fillText("Your app", x + w * 0.09, y + h * 0.5);
  ctx.font = `400 ${base * 0.045}px ui-sans-serif, system-ui`;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText("here", x + w * 0.09, y + h * 0.5 + base * 0.075);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  for (let i = 0; i < 3; i++) {
    roundRectPath(ctx, x + w * 0.09, y + h * (0.62 + i * 0.11), w * 0.82, h * 0.075, base * 0.02);
    ctx.fill();
  }
}

/** View-dependent glass reflections: an ambient sheen plus a light band that sweeps as the device turns. */
function paintGlare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number, // radians
  ry: number,
  k: number // 0..1 intensity
) {
  if (k <= 0) return;
  // Ambient sheen from the key light (upper left)
  const amb = ctx.createLinearGradient(x, y, x + w * 0.9, y + h);
  amb.addColorStop(0, `rgba(255,255,255,${0.09 * k})`);
  amb.addColorStop(0.3, `rgba(255,255,255,${0.03 * k})`);
  amb.addColorStop(0.55, "rgba(255,255,255,0)");
  ctx.fillStyle = amb;
  ctx.fillRect(x, y, w, h);
  // Main reflection band — slides across the glass with the turn, drifts with tilt.
  const t = Math.min(1, Math.max(0, (ry / 1.4 + 1) / 2)); // ±80° → 0..1
  const bx = x + w * (1.15 - 1.3 * t) + rx * w * 0.12;
  const bw = w * 0.5;
  const band = ctx.createLinearGradient(bx - bw / 2, y + h * 0.08, bx + bw / 2, y + h * 0.4);
  band.addColorStop(0, "rgba(255,255,255,0)");
  band.addColorStop(0.45, `rgba(255,255,255,${0.1 * k})`);
  band.addColorStop(0.55, `rgba(255,255,255,${0.1 * k})`);
  band.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = band;
  ctx.fillRect(x, y, w, h);
  // Thin trailing streak
  const streak = ctx.createLinearGradient(bx + bw * 0.5, y, bx + bw * 0.82, y + h * 0.3);
  streak.addColorStop(0, "rgba(255,255,255,0)");
  streak.addColorStop(0.5, `rgba(255,255,255,${0.055 * k})`);
  streak.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = streak;
  ctx.fillRect(x, y, w, h);
}

/** Slight darkening toward the corners — makes the panel read as glass, not a sticker. */
function paintVignette(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(x + w / 2, y + h / 2, r * 0.55, x + w / 2, y + h / 2, r * 1.05);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.15)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

export interface DeviceSpec {
  plates: Plate[];
  floorY: number;
  /** Repaint the screen area(s) with the current source (video frames). */
  updateScreen: (src: ScreenSource | null) => void;
  /** Update view-dependent screen effects (moving glare). Angles in radians. */
  setView: (rotX: number, rotY: number, glare: number) => void;
}

/** Build an iPhone or iPad plate + texture painter. */
function buildSlabDevice(
  device: DeviceId,
  orientation: Orientation,
  finish: FrameFinish
): DeviceSpec {
  const phone = device === "iphone";
  const pw = phone ? 72 : 136; // portrait dims — details are laid out in this frame
  const ph = phone ? 148 : 190;
  const thickness = phone ? 7.6 : 6.4;
  const w = orientation === "portrait" ? pw : ph;
  const h = orientation === "portrait" ? ph : pw;
  let radius = phone ? 11.4 : 9;
  radius = Math.min(radius, Math.min(w, h) / 2 - 1);

  // Landscape = portrait rotated 90° CCW (top edge lands on the left, like the island).
  const map = (u: number, v: number) =>
    orientation === "portrait" ? { x: u, y: v } : { x: -v, y: u };
  const mapP = (u: number, v: number, z: number): Vec3 => ({ ...map(u, v), z });

  const TEX = 12; // texture pixels per world unit
  const tex = document.createElement("canvas");
  tex.width = Math.round(w * TEX);
  tex.height = Math.round(h * TEX);
  const tctx = tex.getContext("2d")!;

  const bezel = (phone ? 2.6 : 4.6) * TEX;
  const screenR = radius * TEX - bezel * 0.55;

  // Last-known screen source and view state — repainted on either change.
  let lastSrc: ScreenSource | null = null;
  let vRx = 8 * (Math.PI / 180);
  let vRy = -26 * (Math.PI / 180);
  let vGlare = 0.6;

  /* The texture is composed from two cached layers so the per-frame cost
   * (video frames, glare tracking the view) is just two blits, the screen
   * draw and a few gradients — not a full device repaint:
   *  - chrome:  frame, rim light, bezel, placeholder screen (static, below content)
   *  - overlay: vignette, fresnel rim, island/camera (static, above content) */
  const tw = tex.width;
  const th = tex.height;
  const sb = bezel; // screen rect: (sb, sb, sw0, sh0)
  const sw0 = tw - bezel * 2;
  const sh0 = th - bezel * 2;
  const sr = Math.max(screenR, 8);

  const chrome = document.createElement("canvas");
  chrome.width = tw;
  chrome.height = th;
  {
    const c = chrome.getContext("2d")!;
    const frame = c.createLinearGradient(0, 0, tw, th);
    frame.addColorStop(0, finish.light);
    frame.addColorStop(1, finish.dark);
    c.fillStyle = frame;
    roundRectPath(c, 0, 0, tw, th, radius * TEX);
    c.fill();
    // Polished rim catch-light where the frame meets the glass
    c.strokeStyle = "rgba(255,255,255,0.32)";
    c.lineWidth = TEX * 0.22;
    roundRectPath(c, TEX * 0.34, TEX * 0.34, tw - TEX * 0.68, th - TEX * 0.68, radius * TEX - TEX * 0.3);
    c.stroke();
    // Bezel
    c.fillStyle = "#050506";
    roundRectPath(c, TEX * 0.9, TEX * 0.9, tw - TEX * 1.8, th - TEX * 1.8, radius * TEX - TEX * 0.7);
    c.fill();
    // Placeholder screen — covered by drawCover once a source is loaded.
    c.save();
    roundRectPath(c, sb, sb, sw0, sh0, sr);
    c.clip();
    paintPlaceholder(c, sb, sb, sw0, sh0);
    c.restore();
  }

  const overlay = document.createElement("canvas");
  overlay.width = tw;
  overlay.height = th;
  {
    const c = overlay.getContext("2d")!;
    c.save();
    roundRectPath(c, sb, sb, sw0, sh0, sr);
    c.clip();
    paintVignette(c, sb, sb, sw0, sh0);
    // Fresnel rim — faint bright line where the glass meets the bezel.
    c.strokeStyle = "rgba(255,255,255,0.09)";
    c.lineWidth = TEX * 0.22;
    roundRectPath(c, sb + TEX * 0.12, sb + TEX * 0.12, sw0 - TEX * 0.24, sh0 - TEX * 0.24, sr);
    c.stroke();
    c.restore();
    // Dynamic island / camera
    if (phone) {
      const len = (orientation === "portrait" ? tw : th) * 0.29;
      const thin = TEX * 5.6;
      const ix = orientation === "portrait" ? (tw - len) / 2 : sb + TEX * 1.5;
      const iy = orientation === "portrait" ? sb + TEX * 1.5 : (th - len) / 2;
      const iw = orientation === "portrait" ? len : thin;
      const ih = orientation === "portrait" ? thin : len;
      c.fillStyle = "#000";
      roundRectPath(c, ix, iy, iw, ih, thin / 2);
      c.fill();
      // Front camera lens at the trailing end of the island
      const lr = thin * 0.3;
      const lx = orientation === "portrait" ? ix + iw - thin / 2 : ix + iw / 2;
      const ly = orientation === "portrait" ? iy + ih / 2 : iy + ih - thin / 2;
      const lens = c.createRadialGradient(lx - lr * 0.35, ly - lr * 0.35, lr * 0.1, lx, ly, lr);
      lens.addColorStop(0, "#3d4a63");
      lens.addColorStop(0.55, "#141b2c");
      lens.addColorStop(1, "#03050a");
      c.fillStyle = lens;
      c.beginPath();
      c.arc(lx, ly, lr, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(160,190,255,0.5)";
      c.beginPath();
      c.arc(lx - lr * 0.35, ly - lr * 0.42, lr * 0.2, 0, Math.PI * 2);
      c.fill();
    } else {
      const cx0 = orientation === "portrait" ? tw / 2 : sb / 2 + TEX * 0.45;
      const cy0 = orientation === "portrait" ? sb / 2 + TEX * 0.45 : th / 2;
      const lr = TEX * 0.9;
      const lens = c.createRadialGradient(cx0 - lr * 0.3, cy0 - lr * 0.3, lr * 0.1, cx0, cy0, lr);
      lens.addColorStop(0, "#2c3850");
      lens.addColorStop(0.6, "#10151f");
      lens.addColorStop(1, "#030407");
      c.fillStyle = lens;
      c.beginPath();
      c.arc(cx0, cy0, lr, 0, Math.PI * 2);
      c.fill();
    }
  }

  const paint = () => {
    tctx.clearRect(0, 0, tw, th);
    tctx.drawImage(chrome, 0, 0);
    tctx.save();
    roundRectPath(tctx, sb, sb, sw0, sh0, sr);
    tctx.clip();
    if (lastSrc) drawCover(tctx, lastSrc, sb, sb, sw0, sh0);
    paintGlare(tctx, sb, sb, sw0, sh0, vRx, vRy, vGlare);
    tctx.restore();
    tctx.drawImage(overlay, 0, 0);
  };
  paint();

  /* --- physical side buttons ---
   * Each button is a small capsule plate rotated so its face points OUT of the
   * frame edge (not toward the screen), then half-sunk into the body. From the
   * front you see its lit outer walls as a slim bump on the silhouette. */
  const BTN_CAP = 3.1; // cap size across the device thickness
  const BTN_OUT = 2.8; // extrusion depth in/out of the frame
  const BTN_SINK = 0.4; // how far the capsule center sits inside the edge
  type EdgeSide = "left" | "right" | "top" | "bottom";
  // Laid out in the portrait frame: `at` is the offset along the edge from center.
  const buttonRects: { side: "left" | "right" | "top"; at: number; len: number }[] = phone
    ? [
        { side: "left", at: 42, len: 6.5 }, // action button
        { side: "left", at: 25, len: 11 }, // volume up
        { side: "left", at: 12, len: 11 }, // volume down
        { side: "right", at: 25, len: 14 }, // power
      ]
    : [
        { side: "top", at: pw / 2 - 13, len: 10 }, // power
        { side: "right", at: ph / 2 - 14, len: 8.5 }, // volume up
        { side: "right", at: ph / 2 - 25, len: 8.5 }, // volume down
      ];

  // Local +Z (the plate face) must map to the edge's outward direction.
  const SIDE_CCW: Record<EdgeSide, EdgeSide> = { left: "bottom", right: "top", top: "left", bottom: "right" };
  const ROT: Record<EdgeSide, (p: Vec3) => Vec3> = {
    left: (p) => ({ x: -p.z, y: p.y, z: p.x }),
    right: (p) => ({ x: p.z, y: p.y, z: -p.x }),
    top: (p) => ({ x: p.x, y: p.z, z: -p.y }),
    bottom: (p) => ({ x: p.x, y: -p.z, z: p.y }),
  };
  const OUTWARD: Record<EdgeSide, { x: number; y: number }> = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    top: { x: 0, y: 1 },
    bottom: { x: 0, y: -1 },
  };

  const buttonPlates: Plate[] = buttonRects.map((b) => {
    const side = orientation === "portrait" ? b.side : SIDE_CCW[b.side];
    const edge =
      b.side === "top" ? map(b.at, ph / 2) : map((b.side === "left" ? -1 : 1) * (pw / 2), b.at);
    const out = OUTWARD[side];
    const cx = edge.x - out.x * BTN_SINK;
    const cy = edge.y - out.y * BTN_SINK;
    const horizontalEdge = side === "top" || side === "bottom";
    const bw = horizontalEdge ? b.len : BTN_CAP;
    const bh = horizontalEdge ? BTN_CAP : b.len;
    const r = Math.min(bw, bh) / 2 - 0.2;

    // Cap texture — metal gradient, light toward the screen side of the edge.
    const btnTex = document.createElement("canvas");
    btnTex.width = Math.max(2, Math.round(bw * TEX));
    btnTex.height = Math.max(2, Math.round(bh * TEX));
    const bctx = btnTex.getContext("2d")!;
    const frontAtMax = side === "left" || side === "top";
    const g = horizontalEdge
      ? bctx.createLinearGradient(0, frontAtMax ? 0 : btnTex.height, 0, frontAtMax ? btnTex.height : 0)
      : bctx.createLinearGradient(frontAtMax ? 0 : btnTex.width, 0, frontAtMax ? btnTex.width : 0, 0);
    g.addColorStop(0, shade(finish.dark, 0.95));
    g.addColorStop(1, shade(finish.light, 0.88));
    bctx.fillStyle = g;
    roundRectPath(bctx, 0, 0, btnTex.width, btnTex.height, r * TEX);
    bctx.fill();

    const rot = ROT[side];
    return {
      w: bw,
      h: bh,
      thickness: BTN_OUT,
      radius: Math.max(0.6, r),
      texture: btnTex,
      transform: (p: Vec3) => {
        const q = rot(p);
        return { x: q.x + cx, y: q.y + cy, z: q.z };
      },
      edgeLight: finish.light,
      edgeDark: finish.dark,
      gridX: 2,
      gridY: 2,
      dim: 0.8,
    };
  });

  /* --- edge inlays: port, speaker/mic holes, screws (portrait frame) --- */
  const details: NonNullable<Plate["details"]> = [];
  const edgeInlay = (edge: 1 | -1, mk: (push: (u: number, z: number) => void) => void, color: string) => {
    const pts: Vec3[] = [];
    mk((u, z) => pts.push(mapP(u, edge * (ph / 2 + 0.08), z)));
    details.push({ pts, color, normal: mapP(0, edge, 0) });
  };
  const slot = (edge: 1 | -1, cu: number, lenU: number, lenZ: number, color = "#0b0b0d") =>
    edgeInlay(
      edge,
      (push) => {
        for (const o of roundedOutline(lenU, lenZ, Math.min(lenU, lenZ) / 2 - 0.05, 3)) push(cu + o.x, o.y);
      },
      color
    );
  const dot = (edge: 1 | -1, cu: number, r: number, color = "#0b0b0d") =>
    edgeInlay(
      edge,
      (push) => {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          push(cu + r * Math.cos(a), r * Math.sin(a));
        }
      },
      color
    );

  if (phone) {
    slot(-1, 0, 9.4, 3.4); // USB-C
    dot(-1, -7.8, 0.5, "rgba(8,8,10,0.7)"); // pentalobe screws
    dot(-1, 7.8, 0.5, "rgba(8,8,10,0.7)");
    for (let i = 0; i < 6; i++) dot(-1, 12 + i * 2.7, 0.62); // speaker grille
    for (let i = 0; i < 3; i++) dot(-1, -12 - i * 2.7, 0.62); // mic
    dot(1, 6, 0.6); // top mic
  } else {
    slot(-1, 0, 8.8, 3); // USB-C
    slot(-1, -17, 11, 1.8, "rgba(8,8,10,0.75)"); // speaker slots
    slot(-1, 17, 11, 1.8, "rgba(8,8,10,0.75)");
    dot(1, -pw / 2 + 13, 0.6); // top mic
  }

  return {
    plates: [
      {
        w,
        h,
        thickness,
        radius,
        texture: tex,
        edgeLight: finish.light,
        edgeDark: finish.dark,
        gridX: orientation === "portrait" ? 10 : 16,
        gridY: orientation === "portrait" ? 16 : 10,
        details,
      },
      ...buttonPlates,
    ],
    floorY: -h / 2 - 6,
    updateScreen: (src) => {
      lastSrc = src;
      paint();
    },
    setView: (rotX, rotY, glare) => {
      if (rotX === vRx && rotY === vRy && glare === vGlare) return;
      vRx = rotX;
      vRy = rotY;
      vGlare = glare;
      paint();
    },
  };
}

export function buildDevice(
  device: DeviceId,
  orientation: Orientation,
  finish: FrameFinish
): DeviceSpec {
  return buildSlabDevice(device, orientation, finish);
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
