/**
 * WebGL device renderer (three.js) — the photoreal engine behind the mockups.
 * It renders ONLY the devices on a transparent canvas; backdrop, glow, shadow,
 * floor reflection and grain are composited by composeScene().
 *
 * Everything is procedural, built the way the real hardware is:
 *  - body: a continuous-curvature (squircle) outline swept along a rail
 *    profile, with analytic normals and perimeter UVs → brushed metal with
 *    antenna bands, no faceting at any export size
 *  - screen: an unlit panel under a separate cover-glass layer that carries
 *    only reflections, so glare is real light from the studio, not paint
 *  - studio: softboxes baked into a PMREM environment, tinted by the backdrop
 *    so the metal picks up the color of the scene it sits in
 *  - back: frosted glass, camera plateau, lenses with coated glass, flash
 *  - laptop: unibody base with a painted keyboard deck and a hinged lid
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  drawContent,
  paintPlaceholder,
  roundRectPath,
  shade,
  type DeviceId,
  type FrameFinish,
  type Orientation,
  type ScreenSource,
} from "./mockup3d";

export type LayoutId = "single" | "duo" | "trio";
export type LightingId = "studio" | "soft" | "dramatic" | "neon";

export interface GLSceneConfig {
  device: DeviceId;
  orientation: Orientation;
  finish: FrameFinish;
  layout: LayoutId;
  lighting: LightingId;
  /** Laptop lid opening in degrees (0 = closed, 90 = upright). */
  lid: number;
  /** Average backdrop color (0..255) that bleeds into the reflections. */
  tint: [number, number, number] | null;
}

/* -------------------------------------------------------------- geometry */

interface OutlinePt {
  x: number;
  y: number;
  nx: number;
  ny: number;
  /** Arc-length fraction around the perimeter, 0..1. */
  u: number;
}

interface ProfilePt {
  /** Inset from the outline, along its normal. */
  d: number;
  z: number;
  nd: number;
  nz: number;
}

/**
 * Rounded rectangle with superellipse corners, counter-clockwise. Curvature
 * eases in from the straight edges instead of snapping on like a plain arc.
 */
function squircle(w: number, h: number, r: number, seg = 22): OutlinePt[] {
  const p = 2 / 2.7;
  const R = Math.min(r * 1.2, w / 2, h / 2);
  const cx = w / 2 - R;
  const cy = h / 2 - R;
  const SX = [1, -1, -1, 1];
  const SY = [1, 1, -1, -1];
  const pts: OutlinePt[] = [];
  for (let q = 0; q < 4; q++) {
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * (Math.PI / 2);
      const c = Math.max(0, q % 2 ? Math.sin(t) : Math.cos(t));
      const s = Math.max(0, q % 2 ? Math.cos(t) : Math.sin(t));
      const nx = SX[q] * Math.pow(c, 2 - p);
      const ny = SY[q] * Math.pow(s, 2 - p);
      const m = Math.hypot(nx, ny) || 1;
      pts.push({
        x: SX[q] * (cx + R * Math.pow(c, p)),
        y: SY[q] * (cy + R * Math.pow(s, p)),
        nx: nx / m,
        ny: ny / m,
        u: 0,
      });
    }
  }
  return withArcLength(pts);
}

function circleOutline(r: number, seg = 48): OutlinePt[] {
  const pts: OutlinePt[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a), u: 0 });
  }
  return withArcLength(pts);
}

function withArcLength(pts: OutlinePt[]): OutlinePt[] {
  let total = 0;
  const acc = pts.map((p, i) => {
    const at = total;
    const n = pts[(i + 1) % pts.length];
    total += Math.hypot(n.x - p.x, n.y - p.y);
    return at;
  });
  pts.forEach((p, i) => (p.u = acc[i] / total));
  return pts;
}

/** Perimeter coordinate of the outline point nearest to (x, y). */
function uAt(outline: OutlinePt[], x: number, y: number): number {
  let best = Infinity;
  let u = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const k = len2 ? Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0;
    const dist = Math.hypot(a.x + dx * k - x, a.y + dy * k - y);
    if (dist < best) {
      best = dist;
      const bu = i + 1 === outline.length ? 1 : b.u;
      u = a.u + (bu - a.u) * k;
    }
  }
  return u;
}

/** Slab cross-section: rounded front edge, flat rail, rounded back edge. */
function railProfile(t: number, eFront: number, eBack = eFront, arc = 8): ProfilePt[] {
  const pts: ProfilePt[] = [];
  for (let i = 0; i <= arc; i++) {
    const f = (i / arc) * (Math.PI / 2);
    pts.push({
      d: eFront * (1 - Math.sin(f)),
      z: t / 2 - eFront * (1 - Math.cos(f)),
      nd: Math.sin(f),
      nz: Math.cos(f),
    });
  }
  for (let i = 0; i <= arc; i++) {
    const f = Math.PI / 2 + (i / arc) * (Math.PI / 2);
    pts.push({
      d: eBack * (1 - Math.sin(f)),
      z: -t / 2 + eBack * (1 + Math.cos(f)),
      nd: Math.sin(f),
      nz: Math.cos(f),
    });
  }
  return pts;
}

/** Raised plateau cross-section: rounded top edge, straight wall down to z = 0. */
function bumpProfile(height: number, e: number, arc = 6): ProfilePt[] {
  const pts: ProfilePt[] = [];
  for (let i = 0; i <= arc; i++) {
    const f = (i / arc) * (Math.PI / 2);
    pts.push({
      d: e * (1 - Math.sin(f)),
      z: height - e * (1 - Math.cos(f)),
      nd: Math.sin(f),
      nz: Math.cos(f),
    });
  }
  pts.push({ d: 0, z: 0, nd: 1, nz: 0 });
  return pts;
}

/** Sweep a profile around an outline — smooth normals, UV = (perimeter, profile). */
function sweep(outline: OutlinePt[], profile: ProfilePt[]): THREE.BufferGeometry {
  const no = outline.length;
  const np = profile.length;
  const pos = new Float32Array((no + 1) * np * 3);
  const nrm = new Float32Array((no + 1) * np * 3);
  const uv = new Float32Array((no + 1) * np * 2);
  for (let i = 0; i <= no; i++) {
    const o = outline[i % no];
    const u = i === no ? 1 : o.u;
    for (let j = 0; j < np; j++) {
      const pr = profile[j];
      const k = i * np + j;
      pos[k * 3] = o.x - o.nx * pr.d;
      pos[k * 3 + 1] = o.y - o.ny * pr.d;
      pos[k * 3 + 2] = pr.z;
      nrm[k * 3] = o.nx * pr.nd;
      nrm[k * 3 + 1] = o.ny * pr.nd;
      nrm[k * 3 + 2] = pr.nz;
      uv[k * 2] = u;
      uv[k * 2 + 1] = j / (np - 1);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < no; i++) {
    for (let j = 0; j < np - 1; j++) {
      const a = i * np + j;
      const c = (i + 1) * np + j;
      idx.push(a, a + 1, c, c, a + 1, c + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Flat face filling an outline (inset by `d`) at depth `z`, UVs over a w×h box. */
function cap(
  outline: OutlinePt[],
  d: number,
  z: number,
  front: boolean,
  w: number,
  h: number
): THREE.BufferGeometry {
  const contour = outline.map((o) => new THREE.Vector2(o.x - o.nx * d, o.y - o.ny * d));
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  const n = contour.length;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  contour.forEach((p, i) => {
    pos[i * 3] = p.x;
    pos[i * 3 + 1] = p.y;
    pos[i * 3 + 2] = z;
    nrm[i * 3 + 2] = front ? 1 : -1;
    uv[i * 2] = front ? p.x / w + 0.5 : 0.5 - p.x / w;
    uv[i * 2 + 1] = p.y / h + 0.5;
  });
  const idx: number[] = [];
  for (const [a, b, c] of faces) idx.push(a, front ? b : c, front ? c : b);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function capsuleShape(w: number, h: number): THREE.Shape {
  const r = Math.min(w, h) / 2;
  const s = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
  s.lineTo(hw, hh - r);
  s.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
  s.lineTo(-hw + r, hh);
  s.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-hw, -hh + r);
  s.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/* -------------------------------------------------------------- textures */

/** Deterministic noise so two exports of the same scene match pixel for pixel. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Brushed rail: finish color, fine streaks along the perimeter, antenna bands. */
function railTexture(color: string, bands: number[]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  const rnd = seeded(7);
  for (let i = 0; i < 520; i++) {
    const x = rnd() * c.width;
    const len = 60 + rnd() * 520;
    g.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${0.02 + rnd() * 0.05})` : `rgba(0,0,0,${0.02 + rnd() * 0.06})`;
    const y = Math.floor(rnd() * c.height);
    g.fillRect(x, y, len, 1);
    g.fillRect(x - c.width, y, len, 1);
  }
  g.fillStyle = "rgba(126,128,134,0.6)";
  for (const u of bands) g.fillRect(u * c.width - 1.6, 0, 3.2, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** Camera lens seen head-on: barrel rings, coated front element, dark pupil. */
function lensTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const m = 128;
  const disc = (rad: number, fill: string | CanvasGradient) => {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(m, m, rad, 0, Math.PI * 2);
    g.fill();
  };
  const ring = (rad: number, color: string, lw: number) => {
    g.strokeStyle = color;
    g.lineWidth = lw;
    g.beginPath();
    g.arc(m, m, rad, 0, Math.PI * 2);
    g.stroke();
  };
  g.fillStyle = "#040405";
  g.fillRect(0, 0, 256, 256);
  ring(116, "#17181c", 8);
  ring(98, "#0d0e11", 12);
  ring(84, "#2a2c33", 2);
  const lens = g.createRadialGradient(m - 22, m - 26, 4, m, m, 76);
  lens.addColorStop(0, "#5d73ad");
  lens.addColorStop(0.25, "#26315a");
  lens.addColorStop(0.6, "#0b0f20");
  lens.addColorStop(1, "#020308");
  disc(76, lens);
  const coat = g.createRadialGradient(m + 26, m + 30, 2, m + 26, m + 30, 48);
  coat.addColorStop(0, "rgba(160,96,230,0.42)");
  coat.addColorStop(1, "rgba(160,96,230,0)");
  disc(76, coat);
  disc(24, "#000");
  ring(24, "#1c2030", 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Laptop deck: keyboard well, keys and trackpad. `pal` picks color or material pass. */
function paintDeck(
  c: CanvasRenderingContext2D,
  W: number,
  D: number,
  k: number,
  pal: { body: string; well: string; key: string; pad: string; padEdge: string }
) {
  c.fillStyle = pal.body;
  c.fillRect(0, 0, W * k, D * k);
  const rr = (x: number, y: number, w: number, h: number, r: number) =>
    roundRectPath(c, x * k, y * k, w * k, h * k, r * k);
  const kx = 22;
  const ky = 15;
  const kw = W - 44;
  const kh = 100;
  const gap = 1.5;
  c.fillStyle = pal.well;
  rr(kx - 2, ky - 2, kw + 4, kh + 4, 3.4);
  c.fill();
  const ones = (n: number) => Array<number>(n).fill(1);
  const rows: { h: number; keys: number[] }[] = [
    { h: 0.55, keys: [1.5, ...ones(12), 1] },
    { h: 1, keys: [...ones(13), 1.5] },
    { h: 1, keys: [1.5, ...ones(13)] },
    { h: 1, keys: [1.8, ...ones(11), 1.7] },
    { h: 1, keys: [2.3, ...ones(10), 2.2] },
    { h: 1.1, keys: [1, 1, 1, 1.3, 5.2, 1.3, 1, 1, 1, 1] },
  ];
  const unit = (kh - gap * (rows.length - 1)) / rows.reduce((s, r) => s + r.h, 0);
  let y = ky;
  c.fillStyle = pal.key;
  for (const row of rows) {
    const total = row.keys.reduce((s, v) => s + v, 0);
    const per = (kw - gap * (row.keys.length - 1)) / total;
    let x = kx;
    for (const kwUnits of row.keys) {
      rr(x, y, kwUnits * per, row.h * unit, 1.3);
      c.fill();
      x += kwUnits * per + gap;
    }
    y += row.h * unit + gap;
  }
  const pw = 118;
  c.fillStyle = pal.pad;
  rr((W - pw) / 2, ky + kh + 10, pw, 72, 4);
  c.fill();
  c.strokeStyle = pal.padEdge;
  c.lineWidth = 0.35 * k;
  c.stroke();
}

/* ------------------------------------------------------------------ studio */

interface Softbox {
  w: number;
  h: number;
  pos: [number, number, number];
  color: string;
  power: number;
}

const STUDIOS: Record<LightingId, { top: number; bottom: number; boxes: Softbox[] }> = {
  studio: {
    top: 0.5,
    bottom: 0.12,
    boxes: [
      { w: 9, h: 9, pos: [-8, 7, 8], color: "#ffffff", power: 2.4 },
      { w: 2.2, h: 13, pos: [10, 1, 3], color: "#f4f8ff", power: 2 },
      { w: 13, h: 8, pos: [0, 11, 1], color: "#ffffff", power: 1.5 },
      { w: 1.8, h: 13, pos: [-10, 2, -5], color: "#ffffff", power: 3.2 },
      { w: 1.8, h: 13, pos: [9, 3, -7], color: "#fff7ee", power: 2.8 },
    ],
  },
  soft: {
    top: 0.95,
    bottom: 0.45,
    boxes: [
      { w: 16, h: 12, pos: [0, 11, 3], color: "#ffffff", power: 1.3 },
      { w: 6, h: 12, pos: [-11, 2, 2], color: "#ffffff", power: 1.1 },
      { w: 6, h: 12, pos: [11, 2, 2], color: "#ffffff", power: 1.1 },
    ],
  },
  dramatic: {
    top: 0.08,
    bottom: 0.02,
    boxes: [
      { w: 2.2, h: 15, pos: [-9, 3, 4], color: "#ffffff", power: 7 },
      { w: 1.5, h: 15, pos: [10, 2, -6], color: "#ffe9d2", power: 6 },
      { w: 8, h: 3, pos: [0, 11, -3], color: "#ffffff", power: 1.6 },
    ],
  },
  neon: {
    top: 0.16,
    bottom: 0.06,
    boxes: [
      { w: 2.6, h: 15, pos: [-10, 1, -2], color: "#ff2d95", power: 6 },
      { w: 2.6, h: 15, pos: [10, 1, -2], color: "#19e3ff", power: 6 },
      { w: 8, h: 2.4, pos: [0, 11, -2], color: "#ffffff", power: 1.2 },
      { w: 2, h: 13, pos: [-7, 2, -8], color: "#7c3aed", power: 4 },
    ],
  },
};

function buildStudio(id: LightingId, tint: [number, number, number] | null): THREE.Scene {
  const def = STUDIOS[id];
  const scene = new THREE.Scene();
  const ambient = new THREE.Color(1, 1, 1);
  if (tint) {
    const t = new THREE.Color().setRGB(tint[0] / 255, tint[1] / 255, tint[2] / 255, THREE.SRGBColorSpace);
    ambient.lerp(t, 0.7);
  }
  // Dome: brighter overhead, falling off toward the floor.
  const dome = new THREE.SphereGeometry(40, 32, 16);
  const pos = dome.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = def.bottom + (def.top - def.bottom) * (pos.getY(i) / 80 + 0.5);
    col[i * 3] = ambient.r * k;
    col[i * 3 + 1] = ambient.g * k;
    col[i * 3 + 2] = ambient.b * k;
  }
  dome.setAttribute("color", new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  for (const b of def.boxes) {
    const color = new THREE.Color(b.color).multiplyScalar(b.power);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(b.w, b.h),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    );
    m.position.set(...b.pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  }
  return scene;
}

/* ----------------------------------------------------------------- devices */

interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  /** Upright (visual) dims — swapped from texture dims when the device is rotated. */
  upW: number;
  upH: number;
  rotated: boolean;
  /** Hardware in front of the pixels (island, notch), painted in texture space. */
  overlay: ((c: CanvasRenderingContext2D, tw: number, th: number) => void) | null;
  src: ScreenSource | null;
  scroll: number;
}

interface Built {
  group: THREE.Group;
  surface: Surface;
  /** Visual footprint, for laying several devices out. */
  w: number;
  h: number;
  lidPivot?: THREE.Group;
}

const SLOTS: Record<LayoutId, { x: number; y: number; z: number }[]> = {
  single: [{ x: 0, y: 0, z: 0 }],
  duo: [
    { x: -0.57, y: 0.05, z: 0 },
    { x: 0.57, y: -0.05, z: 0 },
  ],
  // First slot is the hero in front; the flanking pair sits back.
  trio: [
    { x: 0, y: 0.035, z: 0.14 },
    { x: -0.94, y: -0.045, z: -0.14 },
    { x: 0.94, y: -0.045, z: -0.14 },
  ],
};

export class GLMockupRenderer {
  readonly domElement: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 10, 5000);
  /** Outer group takes tilt/turn; `content` is recentered on its own bounding box. */
  private rig = new THREE.Group();
  private content: THREE.Group | null = null;
  private pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private envKey = "";
  private deviceKey = "";
  private trash: { dispose(): void }[] = [];
  private built: Built[] = [];
  private glassMats: { mat: THREE.MeshPhysicalMaterial; gain: number }[] = [];
  private lid = -1;
  private lean = 0; // how far the screen leans back from upright (laptop lid)
  private spanW = 80;
  private spanH = 156;
  private minY = -78;
  private aspect = 1;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.domElement = this.renderer.domElement;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.rig.rotation.order = "YXZ"; // turn (Y) wraps tilt (X), matching the 2D engine
    this.scene.add(this.rig);
  }

  setSize(w: number, h: number) {
    this.aspect = w / h;
    const c = this.domElement;
    if (c.width === w && c.height === h) return;
    this.renderer.setSize(w, h, false);
  }

  private track<T extends { dispose(): void }>(x: T): T {
    this.trash.push(x);
    return x;
  }

  private mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(this.track(geo), mat);
    parent.add(m);
    return m;
  }

  private setLighting(id: LightingId, tint: [number, number, number] | null) {
    // Quantized so dragging a backdrop slider doesn't rebake the studio every frame.
    const key = `${id}|${tint ? tint.map((v) => Math.round(v / 12)).join(",") : "-"}`;
    if (key === this.envKey) return;
    this.envKey = key;
    const studio = buildStudio(id, tint);
    const target = this.pmrem.fromScene(studio, 0.025);
    studio.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.envTarget?.dispose();
    this.envTarget = target;
    this.scene.environment = target.texture;
  }

  /** Rebuild the scene if its identity changed; cheap no-op otherwise. */
  prepare(cfg: GLSceneConfig) {
    this.setLighting(cfg.lighting, cfg.tint);
    const laptop = cfg.device === "laptop";
    const layout = laptop ? "single" : cfg.layout;
    const key = `${cfg.device}|${cfg.orientation}|${cfg.finish.id}|${layout}`;
    if (key !== this.deviceKey) {
      this.deviceKey = key;
      this.clear();
      const content = new THREE.Group();
      for (const slot of SLOTS[layout]) {
        const b = laptop
          ? this.buildLaptop(cfg.finish)
          : this.buildSlab(cfg.device === "iphone", cfg.finish, cfg.orientation === "landscape");
        b.group.position.set(slot.x * b.w, slot.y * b.h, slot.z * b.w);
        content.add(b.group);
        this.built.push(b);
      }
      this.content = content;
      this.rig.add(content);
      this.lid = -1;
      for (const b of this.built) this.paint(b.surface);
    }
    if (laptop ? cfg.lid !== this.lid : this.lid === -1) {
      this.lid = laptop ? cfg.lid : 0;
      this.lean = laptop ? ((cfg.lid - 90) * Math.PI) / 180 : 0;
      for (const b of this.built) if (b.lidPivot) b.lidPivot.rotation.x = -this.lean;
      this.measure();
    }
  }

  private clear() {
    if (this.content) this.rig.remove(this.content);
    this.content = null;
    for (const t of this.trash) t.dispose();
    this.trash = [];
    this.built = [];
    this.glassMats = [];
  }

  /** Recenter the content on its bounding box and record its front-view span. */
  private measure() {
    const content = this.content;
    if (!content) return;
    const saved = this.rig.rotation.clone();
    this.rig.rotation.set(0, 0, 0);
    content.position.set(0, 0, 0);
    this.rig.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(content);
    const size = box.getSize(new THREE.Vector3());
    content.position.copy(box.getCenter(new THREE.Vector3())).negate();
    this.rig.rotation.copy(saved);
    // Depth shows up as width and height once the scene turns — leave room for it.
    this.spanW = size.x + size.z * 0.3;
    this.spanH = size.y + size.z * 0.3;
    this.minY = -size.y / 2;
  }

  /* ---------------------------------------------------------- materials */

  private materials(finish: FrameFinish) {
    const clay = !!finish.clay;
    const std = (color: string, roughness: number, metalness: number, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
      this.track(new THREE.MeshPhysicalMaterial({ color, roughness, metalness, ...extra }));
    const backColor = "#" + new THREE.Color(finish.light).lerp(new THREE.Color(finish.dark), 0.45).getHexString();
    return {
      clay,
      metal: clay ? std(finish.light, 0.82, 0) : std(finish.light, 0.3, 1, { envMapIntensity: 1.1 }),
      darkMetal: clay ? std(finish.dark, 0.82, 0) : std(finish.dark, 0.22, 1),
      back: clay ? std(finish.light, 0.82, 0) : std(backColor, 0.46, 0.3, { envMapIntensity: 0.9 }),
      gloss: clay
        ? std(finish.dark, 0.7, 0)
        : std(backColor, 0.12, 0.3, { clearcoat: 1, clearcoatRoughness: 0.06 }),
      bezel: this.track(new THREE.MeshBasicMaterial({ color: clay ? finish.dark : "#030304" })),
      hole: this.track(new THREE.MeshBasicMaterial({ color: clay ? finish.dark : "#060607" })),
      sapphire: clay ? std(finish.dark, 0.7, 0) : std("#0a0a0c", 0.08, 0.2, { clearcoat: 1 }),
    };
  }

  /** Cover glass: black + additive, so it contributes nothing but reflections. */
  private glassMaterial(gain: number): THREE.MeshPhysicalMaterial {
    const mat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: "#000000",
        metalness: 0,
        roughness: 0.03,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.glassMats.push({ mat, gain });
    return mat;
  }

  private makeSurface(
    sw: number,
    sh: number,
    rotated: boolean,
    overlay: Surface["overlay"]
  ): Surface {
    const px = 2600 / Math.max(sw, sh);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * px);
    canvas.height = Math.round(sh * px);
    const texture = this.track(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const material = this.track(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    return {
      canvas,
      ctx: canvas.getContext("2d")!,
      texture,
      material,
      upW: rotated ? canvas.height : canvas.width,
      upH: rotated ? canvas.width : canvas.height,
      rotated,
      overlay,
      src: null,
      scroll: 0,
    };
  }

  private paint(s: Surface) {
    const { ctx, canvas } = s;
    const tw = canvas.width;
    const th = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, tw, th);
    ctx.save();
    if (s.rotated) {
      // The mesh is turned with the device, so content is painted turned back.
      ctx.translate(tw / 2, th / 2);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-s.upW / 2, -s.upH / 2);
    }
    if (s.src) drawContent(ctx, s.src, 0, 0, s.upW, s.upH, s.scroll);
    else paintPlaceholder(ctx, 0, 0, s.upW, s.upH);
    ctx.restore();
    s.overlay?.(ctx, tw, th);
    s.texture.needsUpdate = true;
  }

  /* --------------------------------------------------- phone and tablet */

  private buildSlab(phone: boolean, finish: FrameFinish, landscape: boolean): Built {
    const w = phone ? 71.6 : 177.5;
    const h = phone ? 149.8 : 249.6;
    const t = phone ? 8.3 : 5.9;
    const r = phone ? 11.6 : 12.5;
    const e = phone ? 1.25 : 0.95; // rail edge radius
    const inset = phone ? 2.75 : 8.6; // outer edge → first pixel
    const g = new THREE.Group();
    const m = this.materials(finish);
    const outline = squircle(w, h, r);

    // Rails — brushed, with antenna breaks where the real ones sit.
    let rail: THREE.Material = m.metal;
    if (!m.clay) {
      const bands = phone
        ? [
            uAt(outline, w / 2 - 17, h / 2),
            uAt(outline, -w / 2 + 17, h / 2),
            uAt(outline, w / 2 - 17, -h / 2),
            uAt(outline, -w / 2 + 17, -h / 2),
            uAt(outline, -w / 2, h / 2 - 22),
            uAt(outline, w / 2, -h / 2 + 22),
          ]
        : [uAt(outline, w / 2 - 30, h / 2), uAt(outline, -w / 2 + 30, -h / 2)];
      rail = this.track(
        new THREE.MeshPhysicalMaterial({
          map: this.track(railTexture(finish.light, bands)),
          metalness: 1,
          roughness: phone ? 0.34 : 0.4,
          anisotropy: 0.4,
          envMapIntensity: 1.1,
        })
      );
    }
    this.mesh(g, sweep(outline, railProfile(t, e)), rail);

    // Front: black border glass, the panel, then the reflective cover layer.
    this.mesh(g, cap(outline, e, t / 2, true, w, h), m.bezel);
    const sw = w - inset * 2;
    const sh = h - inset * 2;
    const surface = this.makeSurface(
      sw,
      sh,
      landscape,
      phone && !m.clay
        ? (c, tw) => {
            // Dynamic Island is hardware — it stays on the short edge in landscape.
            const k = tw / sw;
            const len = 20.6 * k;
            const thin = 6.1 * k;
            const ix = (tw - len) / 2;
            const iy = 1.9 * k;
            c.fillStyle = "#000";
            roundRectPath(c, ix, iy, len, thin, thin / 2);
            c.fill();
            const lr = thin * 0.27;
            const lx = ix + len - thin / 2;
            const ly = iy + thin / 2;
            const lens = c.createRadialGradient(lx - lr * 0.35, ly - lr * 0.35, lr * 0.1, lx, ly, lr);
            lens.addColorStop(0, "#35415a");
            lens.addColorStop(0.55, "#121828");
            lens.addColorStop(1, "#03050a");
            c.fillStyle = lens;
            c.beginPath();
            c.arc(lx, ly, lr, 0, Math.PI * 2);
            c.fill();
          }
        : null
    );
    const screenOutline = squircle(sw, sh, Math.max(r - inset, 3.4));
    this.mesh(g, cap(screenOutline, 0, t / 2 + 0.02, true, sw, sh), surface.material);
    const glass = this.mesh(g, cap(outline, e, t / 2 + 0.05, true, w, h), this.glassMaterial(m.clay ? 0.35 : 1));
    glass.renderOrder = 2;

    const lensTex = this.track(lensTexture());
    const lensGlass = m.clay
      ? m.gloss
      : this.track(
          new THREE.MeshPhysicalMaterial({
            map: lensTex,
            roughness: 0.06,
            metalness: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.03,
            envMapIntensity: 0.75,
          })
        );
    if (!phone) {
      // Tablet front camera lives in the bezel.
      const cam = this.mesh(g, new THREE.CircleGeometry(1.15, 24), lensGlass);
      cam.position.set(0, h / 2 - inset / 2 - 0.3, t / 2 + 0.03);
    }

    // Back — local axes match what you see from behind: +x right, +z toward you.
    this.mesh(g, cap(outline, e, -t / 2, false, w, h), m.back);
    const back = new THREE.Group();
    back.rotation.y = Math.PI;
    back.position.z = -t / 2;
    g.add(back);
    const lensAt = (parent: THREE.Object3D, x: number, y: number, z: number, rad: number, height: number) => {
      const ring = circleOutline(rad);
      const barrel = new THREE.Group();
      barrel.position.set(x, y, z);
      parent.add(barrel);
      this.mesh(barrel, sweep(ring, bumpProfile(height, 0.45)), m.darkMetal);
      this.mesh(barrel, cap(ring, 0.45, height, true, rad * 2, rad * 2), m.darkMetal);
      const front = this.mesh(barrel, new THREE.CircleGeometry(rad - 0.95, 48), lensGlass);
      front.position.z = height + 0.02;
    };
    const dotAt = (parent: THREE.Object3D, x: number, y: number, z: number, rad: number, mat: THREE.Material) => {
      const d = this.mesh(parent, new THREE.CircleGeometry(rad, 28), mat);
      d.position.set(x, y, z);
    };
    if (phone) {
      const bw = 38;
      const bh = 1.5;
      const plateau = new THREE.Group();
      plateau.position.set(-w / 2 + bw / 2 + 2.6, h / 2 - bw / 2 - 2.6, 0);
      back.add(plateau);
      const po = squircle(bw, bw, 10.5);
      this.mesh(plateau, sweep(po, bumpProfile(bh, 0.9)), m.gloss);
      this.mesh(plateau, cap(po, 0.9, bh, true, bw, bw), m.gloss);
      lensAt(plateau, -8.7, 8.9, bh, 7.6, 1.5);
      lensAt(plateau, -8.7, -8.9, bh, 7.6, 1.5);
      lensAt(plateau, 9.1, 0, bh, 7.6, 1.5);
      const flash = m.clay
        ? m.gloss
        : this.track(new THREE.MeshStandardMaterial({ color: "#f1e7cd", roughness: 0.35, emissive: "#40382a" }));
      dotAt(plateau, 10.6, 12.6, bh + 0.02, 2.5, flash);
      dotAt(plateau, 10.6, -12.6, bh + 0.02, 2.3, m.sapphire);
      dotAt(plateau, 0.4, 13.6, bh + 0.02, 0.5, m.hole);
    } else {
      const bw = 24;
      const plateau = new THREE.Group();
      plateau.position.set(-w / 2 + bw / 2 + 6, h / 2 - bw / 2 - 6, 0);
      back.add(plateau);
      const po = squircle(bw, bw, 7);
      this.mesh(plateau, sweep(po, bumpProfile(1, 0.6)), m.gloss);
      this.mesh(plateau, cap(po, 0.6, 1, true, bw, bw), m.gloss);
      lensAt(plateau, -4.2, 4.2, 1, 5.4, 1.1);
      dotAt(plateau, 6, -5.6, 1.02, 2.6, m.sapphire);
      dotAt(plateau, 6.4, 6, 1.02, 1.5, m.hole);
    }

    // Buttons — pills barely proud of the rail.
    const btn = (x: number, y: number, len: number, alongTop = false) => {
      const bar = this.mesh(
        g,
        new RoundedBoxGeometry(alongTop ? len : 1.5, alongTop ? 1.5 : len, t * 0.4, 5, 0.7),
        m.metal
      );
      bar.position.set(x, y, 0);
    };
    if (phone) {
      btn(-w / 2 + 0.32, 39, 7); // Action button
      btn(-w / 2 + 0.32, 25, 12); // volume up
      btn(-w / 2 + 0.32, 10, 12); // volume down
      btn(w / 2 - 0.32, 22, 19); // side button
      // Camera Control sits flush: a sapphire inlay rather than a raised key.
      const cc = this.mesh(g, new THREE.ShapeGeometry(capsuleShape(2.7, 14), 10), m.sapphire);
      cc.rotation.y = Math.PI / 2;
      cc.position.set(w / 2 + 0.02, -27, 0);
    } else {
      btn(w / 2 - 24, h / 2 - 0.32, 13, true);
      btn(w / 2 - 0.32, h / 2 - 34, 10);
      btn(w / 2 - 0.32, h / 2 - 47, 10);
    }

    // Bottom rail: USB-C and the speaker / microphone perforations.
    const under = (geo: THREE.BufferGeometry, x: number) => {
      const o = this.mesh(g, geo, m.hole);
      o.rotation.x = Math.PI / 2;
      o.position.set(x, -h / 2 - 0.02, 0);
    };
    under(new THREE.ShapeGeometry(capsuleShape(8.6, 2.6), 10), 0);
    const holes = phone ? [5, 5] : [8, 8];
    for (let i = 0; i < holes[0]; i++) under(new THREE.CircleGeometry(0.55, 14), 10.5 + i * 2.2);
    for (let i = 0; i < holes[1]; i++) under(new THREE.CircleGeometry(0.55, 14), -10.5 - i * 2.2);

    g.rotation.z = landscape ? Math.PI / 2 : 0;
    return { group: g, surface, w: landscape ? h : w, h: landscape ? w : h };
  }

  /* ------------------------------------------------------------- laptop */

  private buildLaptop(finish: FrameFinish): Built {
    const W = 300;
    const D = 206;
    const BT = 8.6; // base thickness
    const LH = 200;
    const LT = 4.4; // lid thickness
    const R = 10.5;
    const g = new THREE.Group();
    const m = this.materials(finish);
    const alu = m.clay
      ? m.metal
      : this.track(new THREE.MeshPhysicalMaterial({ color: finish.light, metalness: 1, roughness: 0.4 }));

    // Base — built upright like every slab, then laid flat with the hinge at z = 0.
    const base = new THREE.Group();
    base.rotation.x = -Math.PI / 2;
    base.position.set(0, -BT / 2, D / 2 - 1.5);
    g.add(base);
    const bo = squircle(W, D, R);
    this.mesh(base, sweep(bo, railProfile(BT, 0.8, 3)), alu);
    this.mesh(base, cap(bo, 3, -BT / 2, false, W, D), alu);

    const k = 2048 / W;
    const deck = (pal: Parameters<typeof paintDeck>[4], srgb: boolean) => {
      const c = document.createElement("canvas");
      c.width = 2048;
      c.height = Math.round(D * k);
      paintDeck(c.getContext("2d")!, W, D, k, pal);
      const tex = this.track(new THREE.CanvasTexture(c));
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      return tex;
    };
    // Material pass: G = roughness, B = metalness — plastic keys on a metal deck.
    const surfacePass = m.clay
      ? deck({ body: "#00d200", well: "#00d200", key: "#00d200", pad: "#00d200", padEdge: "#00d200" }, false)
      : deck({ body: "#0068ff", well: "#0078ff", key: "#00b400", pad: "#0052ff", padEdge: "#0090ff" }, false);
    const deckMat = this.track(
      new THREE.MeshStandardMaterial({
        map: deck(
          m.clay
            ? { body: finish.light, well: shade(finish.light, 0.95), key: finish.dark, pad: finish.light, padEdge: "rgba(0,0,0,0.12)" }
            : { body: finish.light, well: shade(finish.light, 0.8), key: "#131315", pad: shade(finish.light, 1.03), padEdge: "rgba(0,0,0,0.16)" },
          true
        ),
        roughnessMap: surfacePass,
        metalnessMap: surfacePass,
        roughness: 1,
        metalness: 1,
      })
    );
    this.mesh(base, cap(bo, 0.8, BT / 2, true, W, D), deckMat);

    // Lid — pivots on its bottom edge.
    const pivot = new THREE.Group();
    pivot.position.set(0, LT / 2 + 0.5, 0);
    g.add(pivot);
    const lid = new THREE.Group();
    lid.position.y = LH / 2;
    pivot.add(lid);
    const lo = squircle(W, LH, R);
    this.mesh(lid, sweep(lo, railProfile(LT, 0.7, 1.7)), alu);
    this.mesh(lid, cap(lo, 1.7, -LT / 2, false, W, LH), alu);
    this.mesh(lid, cap(lo, 0.7, LT / 2, true, W, LH), m.bezel);
    const side = 4.6;
    const chin = 7.6;
    const sw = W - side * 2;
    const sh = LH - side - chin;
    const surface = this.makeSurface(
      sw,
      sh,
      false,
      m.clay
        ? null
        : (c, tw) => {
            const kk = tw / sw;
            c.fillStyle = "#030304";
            roundRectPath(c, (tw - 19 * kk) / 2, -kk, 19 * kk, 4.8 * kk, [0, 0, 1.6 * kk, 1.6 * kk]);
            c.fill();
            c.fillStyle = "#10182a";
            c.beginPath();
            c.arc(tw / 2, 1.8 * kk, 0.75 * kk, 0, Math.PI * 2);
            c.fill();
          }
    );
    const screen = this.mesh(lid, cap(squircle(sw, sh, 3.4), 0, LT / 2 + 0.02, true, sw, sh), surface.material);
    screen.position.y = (chin - side) / 2;
    const glass = this.mesh(lid, cap(lo, 0.7, LT / 2 + 0.05, true, W, LH), this.glassMaterial(m.clay ? 0.3 : 0.85));
    glass.renderOrder = 2;

    const hinge = this.mesh(
      g,
      new THREE.CylinderGeometry(LT / 2 + 0.45, LT / 2 + 0.45, W * 0.8, 24),
      m.clay ? m.darkMetal : this.track(new THREE.MeshStandardMaterial({ color: "#101012", roughness: 0.55 }))
    );
    hinge.rotation.z = Math.PI / 2;
    hinge.position.copy(pivot.position);

    return { group: g, surface, w: W, h: LH, lidPivot: pivot };
  }

  /* ------------------------------------------------------------- per frame */

  /**
   * Screen content, one source per device. Fewer sources than devices repeat;
   * videos repaint every call, images only when they or the scroll change.
   */
  setScreens(srcs: (ScreenSource | null)[], scroll: number) {
    const first = srcs.find((s) => s) ?? null;
    this.built.forEach((b, i) => {
      const s = b.surface;
      const src = srcs[i] ?? first;
      const changed = src !== s.src || (scroll !== s.scroll && src !== null);
      s.src = src;
      s.scroll = scroll;
      if (changed || src instanceof HTMLVideoElement) this.paint(s);
    });
  }

  setView(rotX: number, rotY: number, camDist: number, zoom: number, glare: number) {
    this.rig.rotation.x = rotX;
    this.rig.rotation.y = rotY;
    for (const { mat, gain } of this.glassMats) mat.envMapIntensity = glare * 0.4 * gain;
    // Panels lose apparent brightness as they turn away from the viewer.
    const facing = Math.max(0, Math.cos(rotX - this.lean) * Math.cos(rotY));
    for (const b of this.built) b.surface.material.color.setScalar(1 - (1 - facing) * 0.16);

    // Same lens feel for every device: camera distance scales with subject size.
    const dist = camDist * (Math.max(this.spanW, this.spanH) / 156);
    const visH = Math.max(this.spanH / 0.68, this.spanW / 0.76 / this.aspect) / zoom;
    this.camera.position.set(0, 0, dist);
    this.camera.aspect = this.aspect;
    this.camera.fov = (2 * Math.atan(visH / 2 / dist) * 180) / Math.PI;
    this.camera.near = dist / 10;
    this.camera.far = dist * 5;
    this.camera.updateProjectionMatrix();
  }

  /** Floor line (just under the devices) in output pixels — for the reflection. */
  floorScreenY(): number {
    const gap = this.spanH * 0.035;
    const v = new THREE.Vector3(0, this.minY - gap, 0)
      .applyQuaternion(this.rig.quaternion)
      .project(this.camera);
    return ((1 - v.y) / 2) * this.domElement.height;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.deviceKey = "";
    this.clear();
    this.envTarget?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}
