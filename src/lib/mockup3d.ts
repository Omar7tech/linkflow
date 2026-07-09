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
    const k = (0.38 + 0.62 * diffuse) * (plate.dim ?? 1);
    faces.push({
      kind: "fill",
      pts: [front[i], front[j], back[j], back[i]],
      z: (a.z + b.z + c.z + d.z) / 4,
      color: shade(diffuse > 0.55 ? plate.edgeLight : plate.edgeDark, k),
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
  /** 0..1 floor-shadow strength. */
  shadow: number;
  /** World-space y of the floor (device-dependent). */
  floorY: number;
  background: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
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

  const scale = fit * opts.zoom * Math.min(w, h) / Math.min(w, h); // fit already canvas-relative
  const cx = w / 2;
  const cy = h / 2 - h * 0.015;

  // Floor shadow — a soft ellipse under the device, elongated by the fit width.
  if (opts.shadow > 0) {
    const floor = project(rotXY({ x: 0, y: opts.floorY, z: 0 }, opts.rotX, opts.rotY));
    const sx = cx + floor.x * scale;
    const sy = cy + floor.y * scale;
    const rxE = w * 0.23 * opts.zoom;
    const ryE = rxE * 0.16;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, rxE);
    grad.addColorStop(0, `rgba(8, 12, 10, ${0.42 * opts.shadow})`);
    grad.addColorStop(0.65, `rgba(8, 12, 10, ${0.16 * opts.shadow})`);
    grad.addColorStop(1, "rgba(8, 12, 10, 0)");
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, ryE / rxE);
    ctx.translate(-sx, -sy);
    ctx.fillStyle = grad;
    ctx.fillRect(sx - rxE, sy - rxE, rxE * 2, rxE * 2);
    ctx.restore();
  }

  const faces = plates.flatMap((plate) => collectPlateFaces(plate, opts.rotX, opts.rotY));
  const fillFaces = faces.filter((face) => face.kind === "fill");
  const texFaces = faces.filter((face) => face.kind === "tex");
  fillFaces.sort((a, b) => a.z - b.z);
  texFaces.sort((a, b) => a.z - b.z);

  const toCanvas = (p: { x: number; y: number }) => ({ x: cx + p.x * scale, y: cy + p.y * scale });

  for (const face of fillFaces) {
    const pts = face.pts.map(toCanvas);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = face.color;
    ctx.strokeStyle = face.color;
    ctx.lineWidth = 0.8;
    ctx.fill();
    ctx.stroke();
  }

  for (const face of texFaces) {
    const q = face.quad.map(toCanvas);
    const [u0, v0, u1, v1] = face.uv;
    drawTexturedTriangle(ctx, face.texture, [q[0], q[1], q[2]], [
      { x: u0, y: v0 },
      { x: u1, y: v0 },
      { x: u1, y: v1 },
    ]);
    drawTexturedTriangle(ctx, face.texture, [q[0], q[2], q[3]], [
      { x: u0, y: v0 },
      { x: u1, y: v1 },
      { x: u0, y: v1 },
    ]);
  }
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
  { id: "black", label: "Black", light: "#3c3c3f", dark: "#151517" },
  { id: "silver", label: "Silver", light: "#e2e3e6", dark: "#a2a4a9" },
  { id: "gold", label: "Gold", light: "#eddcbd", dark: "#b39469" },
  { id: "navy", label: "Navy", light: "#46536f", dark: "#1f2740" },
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

function paintGlare(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.9, y + h);
  g.addColorStop(0, "rgba(255,255,255,0.10)");
  g.addColorStop(0.28, "rgba(255,255,255,0.035)");
  g.addColorStop(0.45, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

export interface DeviceSpec {
  plates: Plate[];
  floorY: number;
  /** Repaint the screen area(s) with the current source (video frames). */
  updateScreen: (src: ScreenSource | null) => void;
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

  const paint = (src: ScreenSource | null) => {
    const tw = tex.width;
    const th = tex.height;
    tctx.clearRect(0, 0, tw, th);
    // Frame
    const frame = tctx.createLinearGradient(0, 0, tw, th);
    frame.addColorStop(0, finish.light);
    frame.addColorStop(1, finish.dark);
    tctx.fillStyle = frame;
    roundRectPath(tctx, 0, 0, tw, th, radius * TEX);
    tctx.fill();
    // Polished rim catch-light where the frame meets the glass
    tctx.strokeStyle = "rgba(255,255,255,0.32)";
    tctx.lineWidth = TEX * 0.22;
    roundRectPath(tctx, TEX * 0.34, TEX * 0.34, tw - TEX * 0.68, th - TEX * 0.68, radius * TEX - TEX * 0.3);
    tctx.stroke();
    // Bezel
    tctx.fillStyle = "#050506";
    roundRectPath(tctx, TEX * 0.9, TEX * 0.9, tw - TEX * 1.8, th - TEX * 1.8, radius * TEX - TEX * 0.7);
    tctx.fill();
    // Screen
    tctx.save();
    roundRectPath(tctx, bezel, bezel, tw - bezel * 2, th - bezel * 2, Math.max(screenR, 8));
    tctx.clip();
    if (src) drawCover(tctx, src, bezel, bezel, tw - bezel * 2, th - bezel * 2);
    else paintPlaceholder(tctx, bezel, bezel, tw - bezel * 2, th - bezel * 2);
    paintGlare(tctx, bezel, bezel, tw - bezel * 2, th - bezel * 2);
    tctx.restore();
    // Dynamic island / camera
    if (phone) {
      const len = (orientation === "portrait" ? tw : th) * 0.29;
      const thin = TEX * 5.6;
      const ix = orientation === "portrait" ? (tw - len) / 2 : bezel + TEX * 1.5;
      const iy = orientation === "portrait" ? bezel + TEX * 1.5 : (th - len) / 2;
      const iw = orientation === "portrait" ? len : thin;
      const ih = orientation === "portrait" ? thin : len;
      tctx.fillStyle = "#000";
      roundRectPath(tctx, ix, iy, iw, ih, thin / 2);
      tctx.fill();
      // Front camera lens at the trailing end of the island
      const lr = thin * 0.3;
      const lx = orientation === "portrait" ? ix + iw - thin / 2 : ix + iw / 2;
      const ly = orientation === "portrait" ? iy + ih / 2 : iy + ih - thin / 2;
      const lens = tctx.createRadialGradient(lx - lr * 0.35, ly - lr * 0.35, lr * 0.1, lx, ly, lr);
      lens.addColorStop(0, "#3d4a63");
      lens.addColorStop(0.55, "#141b2c");
      lens.addColorStop(1, "#03050a");
      tctx.fillStyle = lens;
      tctx.beginPath();
      tctx.arc(lx, ly, lr, 0, Math.PI * 2);
      tctx.fill();
      tctx.fillStyle = "rgba(160,190,255,0.5)";
      tctx.beginPath();
      tctx.arc(lx - lr * 0.35, ly - lr * 0.42, lr * 0.2, 0, Math.PI * 2);
      tctx.fill();
    } else {
      const cx0 = orientation === "portrait" ? tw / 2 : bezel / 2 + TEX * 0.45;
      const cy0 = orientation === "portrait" ? bezel / 2 + TEX * 0.45 : th / 2;
      const lr = TEX * 0.9;
      const lens = tctx.createRadialGradient(cx0 - lr * 0.3, cy0 - lr * 0.3, lr * 0.1, cx0, cy0, lr);
      lens.addColorStop(0, "#2c3850");
      lens.addColorStop(0.6, "#10151f");
      lens.addColorStop(1, "#030407");
      tctx.fillStyle = lens;
      tctx.beginPath();
      tctx.arc(cx0, cy0, lr, 0, Math.PI * 2);
      tctx.fill();
    }
  };
  paint(null);

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
    updateScreen: paint,
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
    id: "transparent",
    label: "None",
    css: "repeating-conic-gradient(#d4d4d8 0% 25%, #fafafa 0% 50%) 0 0 / 14px 14px",
    paint: () => {
      /* transparent PNG */
    },
  },
];
