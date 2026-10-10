/**
 * WebGL device renderer (three.js) for the mockup tool. It renders ONLY the
 * devices on a transparent canvas; backdrop, glow, shadow, floor reflection
 * and grain are composited by composeScene().
 *
 * Devices are artist-made models from the catalog in mockup-models.ts. This
 * file adds what a model file can't carry:
 *  - the screen: an unlit panel showing the uploaded content, under a cover
 *    glass layer that contributes nothing but reflections
 *  - the studio: softboxes baked into a PMREM environment, tinted by the
 *    backdrop so the device picks up the color of the scene it sits in
 *  - the room: a second, soft-edged environment that only the glass reflects
 *  - finishes: recoloring the model's own materials, re-surfacing them (mirror,
 *    lacquer, thin film), or swapping the whole body for a shell (clay, crystal)
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneRigged } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  drawContent,
  isShellFinish,
  paintPlaceholder,
  roundRectPath,
  type FrameFinish,
  type Orientation,
  type ScreenSource,
} from "./mockup3d";
import type { DeviceModel } from "./mockup-models";

export type LayoutId = "single" | "duo" | "trio";
export type LightingId = "studio" | "soft" | "daylight" | "golden" | "dramatic" | "spot" | "neon" | "cyber" | "aurora";

export interface GLSceneConfig {
  model: DeviceModel;
  orientation: Orientation;
  finish: FrameFinish;
  layout: LayoutId;
  lighting: LightingId;
  /** Average backdrop color (0..255) that bleeds into the reflections. */
  tint: [number, number, number] | null;
  /** 0..1 along the model's pose animation (ignored by models without one). */
  pose: number;
}

/* ------------------------------------------------------------------ models */

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LoadedScreen {
  mesh: string;
  /** Size in millimetres. */
  w: number;
  h: number;
  back: boolean;
  /** Island hardware on the panel, as fractions of the screen from its top-left. */
  island: Rect | null;
}

interface LoadedModel {
  def: DeviceModel;
  scene: THREE.Group;
  /** Bounding-box center, in model units. */
  center: THREE.Vector3;
  /** Overall size, in millimetres. */
  w: number;
  h: number;
  screens: LoadedScreen[];
  clip: THREE.AnimationClip | null;
  /** Luminance of the reference materials finishes are scaled against. */
  frameLum: number;
  bodyLum: number;
}

/** What the UI needs to know about a device once its model has loaded. */
export interface DeviceInfo {
  /** Main screen height ÷ width, upright. */
  screenRatio: number;
  /** One label per screen, in slot order. */
  screens: string[];
}

const luminance = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

const loaded = new Map<string, LoadedModel>();
const loading = new Map<string, Promise<DeviceInfo | null>>();

/** Fetch and measure a device model. Resolves null if it can't be used. */
export function loadDeviceModel(def: DeviceModel): Promise<DeviceInfo | null> {
  let task = loading.get(def.id);
  if (!task) {
    task = new GLTFLoader()
      .loadAsync(def.url)
      .then((gltf) => {
        const scene = gltf.scene;
        scene.updateMatrixWorld(true);
        const k = def.scale;
        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());

        const screens: LoadedScreen[] = [];
        for (const sd of def.screens) {
          const mesh = scene.getObjectByName(sd.mesh);
          if (!(mesh instanceof THREE.Mesh)) return null;
          const panel = new THREE.Box3().setFromObject(mesh);
          const span = panel.getSize(new THREE.Vector3());
          // A back-facing panel is seen mirrored, so its U runs the other way.
          const u = (x: number) => (sd.back ? panel.max.x - x : x - panel.min.x) / span.x;
          const vOf = (y: number) => (y - panel.min.y) / span.y;

          // Remap the panel's UVs to its own bounds, so any canvas fills it edge to edge.
          const geo = mesh.geometry as THREE.BufferGeometry;
          const pos = geo.attributes.position;
          const uv = new Float32Array(pos.count * 2);
          const p = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) {
            p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
            uv[i * 2] = u(p.x);
            uv[i * 2 + 1] = vOf(p.y);
          }
          geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

          const hardware = new THREE.Box3();
          for (const name of sd.island) {
            const part = scene.getObjectByName(name);
            if (part) hardware.expandByObject(part);
          }
          const padU = 0.2 / (span.x * k); // 0.2 mm of black around the hardware
          const padV = 0.2 / (span.y * k);
          const u0 = Math.min(u(hardware.min.x), u(hardware.max.x));
          const u1 = Math.max(u(hardware.min.x), u(hardware.max.x));
          screens.push({
            mesh: sd.mesh,
            w: span.x * k,
            // A leaning panel (a laptop lid) is taller than its upright extent.
            h: Math.hypot(span.y, span.z) * k,
            back: !!sd.back,
            island: hardware.isEmpty()
              ? null
              : {
                  x: u0 - padU,
                  y: 1 - vOf(hardware.max.y) - padV,
                  w: u1 - u0 + padU * 2,
                  h: vOf(hardware.max.y) - vOf(hardware.min.y) + padV * 2,
                },
          });
        }

        let frameLum = 0.1;
        let bodyLum = 0.1;
        scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const mat = o.material as THREE.MeshStandardMaterial;
          if (mat.name === def.materials.frameRef) frameLum = luminance(mat.color);
          if (mat.name === def.materials.bodyRef) bodyLum = luminance(mat.color);
        });

        loaded.set(def.id, {
          def,
          scene,
          center: box.getCenter(new THREE.Vector3()),
          w: size.x * k,
          h: size.y * k,
          screens,
          clip: (def.pose && gltf.animations.find((c) => c.name === def.pose?.clip)) || null,
          frameLum,
          bodyLum,
        });
        return { screenRatio: screens[0].h / screens[0].w, screens: def.screens.map((sd) => sd.label) };
      })
      .catch(() => null);
    loading.set(def.id, task);
  }
  return task;
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
  // A bright room: one big window, sky above, light bouncing everywhere.
  daylight: {
    top: 1.1,
    bottom: 0.5,
    boxes: [
      { w: 11, h: 13, pos: [-10, 4, 7], color: "#f1f7ff", power: 2.6 },
      { w: 7, h: 11, pos: [11, 2, 3], color: "#fff8ef", power: 1 },
      { w: 16, h: 9, pos: [0, 12, 0], color: "#eaf3ff", power: 1.2 },
      { w: 2, h: 12, pos: [8, 3, -8], color: "#ffffff", power: 1.8 },
    ],
  },
  // Low sun from one side, cool sky filling the other.
  golden: {
    top: 0.3,
    bottom: 0.12,
    boxes: [
      { w: 8, h: 7, pos: [-11, 1.5, 6], color: "#ffab4d", power: 4.2 },
      { w: 2, h: 12, pos: [-9, 2, -6], color: "#ff8a3d", power: 3.4 },
      { w: 9, h: 10, pos: [10, 4, 4], color: "#9dbcff", power: 1.1 },
      { w: 14, h: 7, pos: [0, 12, 1], color: "#ffe6c7", power: 0.9 },
    ],
  },
  // One lamp straight overhead, and a sliver from behind to cut the edge out of the dark.
  spot: {
    top: 0.03,
    bottom: 0.01,
    boxes: [
      { w: 6, h: 6, pos: [0, 12, 3], color: "#ffffff", power: 8 },
      { w: 1.4, h: 12, pos: [7, 3, -9], color: "#ffffff", power: 3.2 },
      { w: 1.4, h: 12, pos: [-7, 3, -9], color: "#dfe9ff", power: 2.2 },
    ],
  },
  cyber: {
    top: 0.1,
    bottom: 0.04,
    boxes: [
      { w: 2.4, h: 15, pos: [-10, 1, 2], color: "#00ffd0", power: 5.5 },
      { w: 2.4, h: 15, pos: [10, 1, -1], color: "#ff3df2", power: 5.5 },
      { w: 10, h: 2, pos: [0, 11, -1], color: "#ffb300", power: 2.2 },
      { w: 2, h: 13, pos: [7, 2, -8], color: "#2d6bff", power: 4 },
    ],
  },
  aurora: {
    top: 0.14,
    bottom: 0.05,
    boxes: [
      { w: 7, h: 12, pos: [-10, 3, 5], color: "#34d399", power: 3.4 },
      { w: 7, h: 12, pos: [10, 2, -3], color: "#8b5cf6", power: 3.8 },
      { w: 14, h: 5, pos: [0, 12, 0], color: "#a7f3d0", power: 1.2 },
      { w: 2, h: 13, pos: [-7, 2, -8], color: "#22d3ee", power: 3.2 },
    ],
  },
};

/**
 * What the cover glass reflects: a lived-in room rather than the studio —
 * paned windows, a ceiling wash, bounce off the floor, all soft-edged. A
 * screen only mirrors a sliver of its surroundings (about as much as the
 * device fills the lens), so the lights are placed by angle and kept small
 * enough to read as shapes. The room also turns part-way with the device (see
 * setView), which keeps a window in the glass through the usual hero angles.
 */
interface RoomLight {
  /** Direction from the device, in degrees: azimuth (+ right) and elevation. */
  az: number;
  el: number;
  /** Angular size, in degrees. */
  w: number;
  h: number;
  color: string;
  power: number;
  /** Edge falloff, as a fraction of the light's half-size. */
  feather: number;
  /** Window panes across and down (1×1 = a plain glow). */
  panes?: [number, number];
}

const ROOMS: Record<LightingId, { top: number; bottom: number; lights: RoomLight[] }> = {
  studio: {
    top: 0.2,
    bottom: 0.05,
    lights: [
      { az: -7.6, el: 3.2, w: 5.2, h: 8.6, color: "#f1f6ff", power: 3, feather: 0.14, panes: [2, 3] },
      { az: 7.6, el: 3.2, w: 5.2, h: 8.6, color: "#ffffff", power: 2.8, feather: 0.14, panes: [2, 3] },
      { az: 0, el: -9, w: 16, h: 7, color: "#ffe9d2", power: 0.7, feather: 1 },
      { az: 0, el: 16, w: 40, h: 10, color: "#ffffff", power: 1.1, feather: 1 },
      { az: 0, el: -19, w: 40, h: 10, color: "#fff1df", power: 0.9, feather: 1 },
      { az: -35, el: 3, w: 10, h: 14, color: "#ffffff", power: 2, feather: 0.5, panes: [2, 2] },
      { az: 35, el: 3, w: 10, h: 14, color: "#ffffff", power: 2, feather: 0.5, panes: [2, 2] },
    ],
  },
  soft: {
    top: 0.4,
    bottom: 0.2,
    lights: [
      { az: -7.5, el: 3, w: 9, h: 12, color: "#ffffff", power: 1.9, feather: 0.8 },
      { az: 7.5, el: 3, w: 9, h: 12, color: "#ffffff", power: 1.7, feather: 0.8 },
      { az: 0, el: 16, w: 44, h: 12, color: "#ffffff", power: 1.1, feather: 1 },
      { az: 0, el: -18, w: 44, h: 12, color: "#fffaf2", power: 1, feather: 1 },
      { az: -35, el: 3, w: 16, h: 18, color: "#ffffff", power: 1.4, feather: 0.9 },
      { az: 35, el: 3, w: 16, h: 18, color: "#ffffff", power: 1.4, feather: 0.9 },
    ],
  },
  dramatic: {
    top: 0.04,
    bottom: 0.02,
    lights: [
      { az: -7, el: 2, w: 2.4, h: 15, color: "#ffffff", power: 4, feather: 0.4, panes: [1, 4] },
      { az: 8.5, el: 1, w: 1.5, h: 12, color: "#ffe2c4", power: 3, feather: 0.6 },
      { az: 0, el: -18, w: 30, h: 8, color: "#ffffff", power: 1, feather: 1 },
      { az: -35, el: 3, w: 3, h: 16, color: "#ffffff", power: 5, feather: 0.5 },
      { az: 35, el: 3, w: 3, h: 16, color: "#ffffff", power: 5, feather: 0.5 },
    ],
  },
  neon: {
    top: 0.06,
    bottom: 0.03,
    lights: [
      { az: -7, el: 1, w: 1.8, h: 15, color: "#ff2d95", power: 4, feather: 0.7 },
      { az: 7, el: 1, w: 1.8, h: 15, color: "#19e3ff", power: 4, feather: 0.7 },
      { az: 0, el: -17, w: 34, h: 8, color: "#7c3aed", power: 2.4, feather: 1 },
      { az: 0, el: 16, w: 34, h: 8, color: "#ffffff", power: 0.7, feather: 1 },
      { az: -35, el: 2, w: 2.4, h: 16, color: "#ff2d95", power: 5, feather: 0.7 },
      { az: 35, el: 2, w: 2.4, h: 16, color: "#19e3ff", power: 5, feather: 0.7 },
    ],
  },
  daylight: {
    top: 0.5,
    bottom: 0.18,
    lights: [
      { az: -7.4, el: 2.6, w: 6.4, h: 10.5, color: "#eef5ff", power: 3.3, feather: 0.12, panes: [2, 3] },
      { az: 8, el: 2.6, w: 4.2, h: 10.5, color: "#ffffff", power: 2.6, feather: 0.12, panes: [1, 3] },
      { az: 0, el: 16, w: 44, h: 12, color: "#dbe9ff", power: 1.4, feather: 1 },
      { az: 0, el: -18, w: 44, h: 12, color: "#ffffff", power: 1, feather: 1 },
      { az: -35, el: 3, w: 12, h: 16, color: "#ffffff", power: 2.2, feather: 0.4, panes: [2, 2] },
      { az: 35, el: 3, w: 12, h: 16, color: "#ffffff", power: 2.2, feather: 0.4, panes: [2, 2] },
    ],
  },
  golden: {
    top: 0.14,
    bottom: 0.06,
    lights: [
      { az: -7.6, el: 2.4, w: 5.4, h: 8.6, color: "#ffc27a", power: 3.6, feather: 0.16, panes: [2, 3] },
      { az: -3.2, el: -5.5, w: 7, h: 5, color: "#ff8f3d", power: 1.5, feather: 1 },
      { az: 8, el: 3, w: 6, h: 9, color: "#a9c4ff", power: 1.2, feather: 0.9 },
      { az: 0, el: -18, w: 40, h: 10, color: "#ffb36b", power: 1.1, feather: 1 },
      { az: -35, el: 3, w: 10, h: 14, color: "#ffc27a", power: 2.4, feather: 0.5, panes: [2, 2] },
      { az: 35, el: 3, w: 10, h: 14, color: "#a9c4ff", power: 1.4, feather: 0.9 },
    ],
  },
  spot: {
    top: 0.03,
    bottom: 0.01,
    lights: [
      { az: -5.5, el: 4.5, w: 5.5, h: 5.5, color: "#ffffff", power: 3.4, feather: 1 },
      { az: 5.5, el: 4.5, w: 5.5, h: 5.5, color: "#ffffff", power: 3.4, feather: 1 },
      { az: -35, el: 4, w: 7, h: 7, color: "#ffffff", power: 4, feather: 1 },
      { az: 35, el: 4, w: 7, h: 7, color: "#ffffff", power: 4, feather: 1 },
    ],
  },
  cyber: {
    top: 0.05,
    bottom: 0.02,
    lights: [
      { az: -7.4, el: 1, w: 1.4, h: 15, color: "#00ffd0", power: 4.4, feather: 0.7 },
      { az: -5, el: 1, w: 0.7, h: 11, color: "#00ffd0", power: 3, feather: 0.7 },
      { az: 7.2, el: 1, w: 1.6, h: 15, color: "#ff3df2", power: 4.4, feather: 0.7 },
      { az: 0, el: -15, w: 26, h: 5, color: "#ffb300", power: 1.6, feather: 1 },
      { az: -35, el: 2, w: 2.4, h: 16, color: "#00ffd0", power: 5, feather: 0.7 },
      { az: 35, el: 2, w: 2.4, h: 16, color: "#ff3df2", power: 5, feather: 0.7 },
    ],
  },
  aurora: {
    top: 0.08,
    bottom: 0.03,
    lights: [
      { az: -8, el: 3, w: 8, h: 13, color: "#34d399", power: 2.3, feather: 1 },
      { az: 8, el: 0, w: 8, h: 13, color: "#8b5cf6", power: 2.5, feather: 1 },
      { az: 0, el: 14, w: 30, h: 8, color: "#67e8f9", power: 1.1, feather: 1 },
      { az: -35, el: 3, w: 12, h: 16, color: "#34d399", power: 2.4, feather: 1 },
      { az: 35, el: 3, w: 12, h: 16, color: "#8b5cf6", power: 2.4, feather: 1 },
    ],
  },
};

/** How much of the device's turn the reflected room follows (2 = pinned to the glass). */
const ROOM_FOLLOW = 1.8;

// Light masks — a soft-edged glow, optionally split into window panes. Shared by every bake.
const BAR_DEG = 0.75; // a glazing bar, as seen from the device
const lightMasks = new Map<string, THREE.DataTexture>();
function lightMask(l: RoomLight): THREE.DataTexture {
  const [cols, rows] = l.panes ?? [1, 1];
  const key = [l.feather, cols, rows, l.w, l.h].join("|");
  let tex = lightMasks.get(key);
  if (tex) return tex;
  const n = 256;
  const data = new Uint8Array(n * n * 4);
  const ease = (t: number) => t * t * (3 - 2 * t);
  const fall = l.feather * 0.5;
  const inner = 1 - fall; // half-size of the fully lit area
  // Darkness of the nearest bar along one axis, for a light `deg` degrees across.
  const bars = (p: number, count: number, deg: number) => {
    const half = BAR_DEG / deg; // half a bar, in mask units (the mask spans 2)
    let lit = 1;
    for (let k = 1; k < count; k++) {
      const d = Math.abs(p - (-inner + (2 * inner * k) / count));
      lit = Math.min(lit, ease(Math.min(1, Math.max(0, (d - half * 0.6) / (half * 0.8)))));
    }
    return lit;
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * 2 - 1;
      const y = ((j + 0.5) / n) * 2 - 1;
      const out = Math.hypot(Math.max(0, Math.abs(x) - inner), Math.max(0, Math.abs(y) - inner));
      const v = ease(Math.max(0, 1 - out / fall)) * bars(x, cols, l.w) * bars(y, rows, l.h);
      const o = (j * n + i) * 4;
      data[o] = data[o + 1] = data[o + 2] = Math.round(v * 255);
      data[o + 3] = 255;
    }
  }
  tex = new THREE.DataTexture(data, n, n);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  lightMasks.set(key, tex);
  return tex;
}

function buildRoom(id: LightingId): THREE.Scene {
  const def = ROOMS[id];
  const scene = new THREE.Scene();
  const dome = new THREE.SphereGeometry(40, 32, 16);
  const pos = dome.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    col.fill(def.bottom + (def.top - def.bottom) * (pos.getY(i) / 80 + 0.5), i * 3, i * 3 + 3);
  }
  dome.setAttribute("color", new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const dist = 20;
  const rad = Math.PI / 180;
  for (const l of def.lights) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2 * dist * Math.tan((l.w / 2) * rad), 2 * dist * Math.tan((l.h / 2) * rad)),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(l.color).multiplyScalar(l.power),
        map: lightMask(l),
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const ce = Math.cos(l.el * rad);
    m.position.set(Math.sin(l.az * rad) * ce, Math.sin(l.el * rad), Math.cos(l.az * rad) * ce).multiplyScalar(dist);
    m.lookAt(0, 0, 0);
    scene.add(m);
  }
  return scene;
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
}

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

/**
 * Holographic finishes: the thin film's thickness rolls in slow waves across
 * the device as the camera sees it, so its color drifts over a panel (and
 * flows as the device turns) instead of sitting flat on it. `scale` is one
 * over the device's height.
 */
function addFilmWaves(mat: THREE.MeshPhysicalMaterial, scale: number) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.filmScale = { value: scale };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float filmScale;")
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
        #ifdef USE_IRIDESCENCE
        {
          vec2 p = -vViewPosition.xy * filmScale;
          float wave = 0.5 + 0.3 * sin(dot(p, vec2(5.2, 3.1))) + 0.2 * sin(dot(p, vec2(-2.3, 6.7)) + 1.7);
          material.iridescenceThickness = mix(iridescenceThicknessMinimum, iridescenceThicknessMaximum, clamp(wave, 0.0, 1.0));
        }
        #endif`
      );
  };
  mat.customProgramCacheKey = () => "film-waves";
}

// "Art" finishes: one neutral shaded sphere gives every part its form, and a
// color sweep is laid across the whole device on top of it.
let formMatcap: THREE.CanvasTexture | null = null;
function formTexture(): THREE.CanvasTexture {
  if (formMatcap) return formMatcap;
  const n = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const g = canvas.getContext("2d")!;
  // Lit from the upper left, turning away toward the far edge.
  const form = g.createRadialGradient(n * 0.38, n * 0.32, n * 0.08, n * 0.5, n * 0.5, n * 0.62);
  form.addColorStop(0, "#ffffff");
  form.addColorStop(0.55, "#e2e2e2");
  form.addColorStop(1, "#8f8f8f");
  g.fillStyle = form;
  g.fillRect(0, 0, n, n);
  // A rim of light around the silhouette.
  const rim = g.createRadialGradient(n / 2, n / 2, n * 0.38, n / 2, n / 2, n * 0.5);
  rim.addColorStop(0, "rgba(255,255,255,0)");
  rim.addColorStop(1, "rgba(255,255,255,0.75)");
  g.fillStyle = rim;
  g.fillRect(0, 0, n, n);
  formMatcap = new THREE.CanvasTexture(canvas);
  formMatcap.colorSpace = THREE.SRGBColorSpace;
  return formMatcap;
}

const sweeps = new Map<string, THREE.CanvasTexture>();
function sweepTexture(finish: FrameFinish, stops: [number, string][]): THREE.CanvasTexture {
  let tex = sweeps.get(finish.id);
  if (tex) return tex;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 1;
  const g = canvas.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 256, 0);
  for (const [p, c] of stops) grad.addColorStop(p, c);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 1);
  tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sweeps.set(finish.id, tex);
  return tex;
}

/** Lay a color sweep across the device at `angle`, in the camera's view. `scale` is one over the device's height. */
function addSweep(mat: THREE.MeshMatcapMaterial, sweep: THREE.Texture, angle: number, scale: number) {
  const a = (angle * Math.PI) / 180;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.sweepMap = { value: sweep };
    shader.uniforms.sweepAxis = { value: new THREE.Vector2(Math.cos(a) * scale, -Math.sin(a) * scale) };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D sweepMap;\nuniform vec2 sweepAxis;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        diffuseColor.rgb *= texture2D(sweepMap, vec2(clamp(0.5 + dot(-vViewPosition.xy, sweepAxis), 0.0, 1.0), 0.5)).rgb;`
      );
  };
  mat.customProgramCacheKey = () => `sweep-${angle}`;
}

/* ---------------------------------------------------------------- renderer */

interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  /** Upright (visual) dims — swapped from texture dims when the device is rotated. */
  upW: number;
  upH: number;
  /** Quarter turns the content is painted at to stay upright (0 in portrait). */
  turn: number;
  /** Island hardware to black out, in texture pixels. */
  island: Rect | null;
  src: ScreenSource | null;
  scroll: number;
}

interface Built {
  group: THREE.Group;
  body: THREE.Object3D;
  surfaces: Surface[];
  rigged: THREE.SkinnedMesh[];
  mixer: THREE.AnimationMixer | null;
  poseLength: number;
  /** Visual footprint, for laying several devices out. */
  w: number;
  h: number;
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
  private roomTarget: THREE.WebGLRenderTarget | null = null;
  private roomKey = "";
  private sceneKey = "";
  private pose = -1;
  private trash: { dispose(): void }[] = [];
  private built: Built[] = [];
  private glassMats: { mat: THREE.MeshPhysicalMaterial; gain: number }[] = [];
  /** Materials lit by the studio at their own strength, re-pointed when it is rebaked. */
  private studioMats: THREE.MeshPhysicalMaterial[] = [];
  private spanW = 80;
  private spanH = 160;
  private minY = -80;
  private aspect = 1;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.domElement = this.renderer.domElement;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.rig.rotation.order = "YXZ"; // turn (Y) wraps tilt (X)
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

  private setLighting(id: LightingId, tint: [number, number, number] | null) {
    // Quantized so dragging a backdrop slider doesn't rebake the studio every frame.
    const key = `${id}|${tint ? tint.map((v) => Math.round(v / 12)).join(",") : "-"}`;
    if (key !== this.envKey) {
      this.envKey = key;
      const studio = buildStudio(id, tint);
      const target = this.pmrem.fromScene(studio, 0.025);
      disposeScene(studio);
      this.envTarget?.dispose();
      this.envTarget = target;
      this.scene.environment = target.texture;
      for (const mat of this.studioMats) mat.envMap = target.texture;
    }
    // The cover glass reflects its own room, which doesn't change with the backdrop.
    if (id !== this.roomKey) {
      this.roomKey = id;
      const room = buildRoom(id);
      const target = this.pmrem.fromScene(room);
      disposeScene(room);
      this.roomTarget?.dispose();
      this.roomTarget = target;
      for (const { mat } of this.glassMats) mat.envMap = target.texture;
    }
  }

  /**
   * Rebuild the scene if its identity changed; cheap no-op otherwise.
   * Returns false while the device's model hasn't loaded yet.
   */
  prepare(cfg: GLSceneConfig): boolean {
    this.setLighting(cfg.lighting, cfg.tint);
    const model = loaded.get(cfg.model.id);
    if (!model) {
      this.clear();
      this.sceneKey = "";
      return false;
    }
    const key = `${cfg.model.id}|${cfg.orientation}|${cfg.finish.id}|${cfg.layout}`;
    if (key !== this.sceneKey) {
      this.sceneKey = key;
      this.clear();
      const content = new THREE.Group();
      for (const slot of SLOTS[cfg.layout]) {
        const b = this.build(model, cfg.finish, cfg.orientation === "landscape");
        b.group.position.set(slot.x * b.w, slot.y * b.h, slot.z * b.w);
        content.add(b.group);
        this.built.push(b);
      }
      this.content = content;
      this.rig.add(content);
      for (const b of this.built) for (const s of b.surfaces) this.paint(s);
      this.pose = -1;
    }
    if (cfg.pose !== this.pose) {
      this.pose = cfg.pose;
      for (const b of this.built) {
        if (!b.mixer) continue;
        // Stop a hair short of the end: the clip's last instant wraps to its first.
        b.mixer.setTime(Math.min(cfg.pose, 0.9999) * b.poseLength);
        b.body.updateMatrixWorld(true);
        for (const m of b.rigged) {
          m.skeleton.update();
          m.computeBoundingBox();
        }
      }
      this.measure();
    }
    return true;
  }

  /** Drop the current devices. Model geometry and textures are shared, so only per-scene objects are freed. */
  private clear() {
    if (this.content) this.rig.remove(this.content);
    this.content = null;
    for (const t of this.trash) t.dispose();
    this.trash = [];
    this.built = [];
    this.glassMats = [];
    this.studioMats = [];
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

  /** The two materials of a shell finish: the body, and the smaller parts set against it. */
  private shellMaterials(finish: FrameFinish, height: number): [THREE.Material, THREE.Material] {
    const surface = finish.surface;
    if (surface?.type === "matcap") {
      const sweep = sweepTexture(finish, surface.stops);
      const art = (color: string) => {
        const mat = new THREE.MeshMatcapMaterial({ matcap: formTexture(), color, toneMapped: false });
        addSweep(mat, sweep, surface.angle, 0.8 / height);
        return this.track(mat);
      };
      return [art("#ffffff"), art("#cfcfcf")];
    }
    const studio = (mat: THREE.MeshPhysicalMaterial) => {
      mat.envMap = this.envTarget?.texture ?? null;
      this.studioMats.push(mat);
      return this.track(mat);
    };
    if (surface?.type === "crystal") {
      // Reflections only, added over whatever is behind: the backdrop reads through it.
      const crystal = (gain: number) =>
        studio(
          new THREE.MeshPhysicalMaterial({
            color: "#000000",
            roughness: 0.05,
            metalness: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.02,
            emissive: finish.dark,
            emissiveIntensity: 0.5,
            envMapIntensity: gain,
            transparent: true,
            opacity: 0.16,
            blending: THREE.AdditiveBlending,
          })
        );
      return [crystal(70), crystal(110)];
    }
    // Clay: soft and matte with a faint waxy sheen, lit a little hot so pale colors stay pale.
    const clay = (color: string) =>
      studio(
        new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.7,
          metalness: 0,
          clearcoat: 0.3,
          clearcoatRoughness: 0.5,
          sheen: 0.5,
          sheenRoughness: 0.6,
          sheenColor: "#ffffff",
          envMapIntensity: 1.7,
        })
      );
    return [clay(finish.light), clay(finish.dark)];
  }

  /** Cover glass: black + additive, so it contributes nothing but reflections. */
  private glassMaterial(gain: number): THREE.MeshPhysicalMaterial {
    const mat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: "#000000",
        metalness: 0,
        roughness: 0.05,
        envMap: this.roomTarget?.texture ?? null,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.glassMats.push({ mat, gain });
    return mat;
  }

  private makeSurface(screen: LoadedScreen, rotated: boolean, showIsland: boolean): Surface {
    const px = 2600 / Math.max(screen.w, screen.h);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(screen.w * px);
    canvas.height = Math.round(screen.h * px);
    const texture = this.track(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const material = this.track(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    // Island hardware and the cover glass share the panel's plane — push the panel back so they win.
    material.polygonOffset = true;
    material.polygonOffsetFactor = 2;
    material.polygonOffsetUnits = 2;
    const i = screen.island;
    return {
      canvas,
      ctx: canvas.getContext("2d")!,
      texture,
      material,
      upW: rotated ? canvas.height : canvas.width,
      upH: rotated ? canvas.width : canvas.height,
      // Seen from behind, the device's quarter turn runs the other way.
      turn: rotated ? (screen.back ? -1 : 1) : 0,
      island:
        showIsland && i
          ? { x: i.x * canvas.width, y: i.y * canvas.height, w: i.w * canvas.width, h: i.h * canvas.height }
          : null,
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
    if (s.turn) {
      // The mesh is turned with the device, so content is painted turned back.
      ctx.translate(tw / 2, th / 2);
      ctx.rotate((s.turn * Math.PI) / 2);
      ctx.translate(-s.upW / 2, -s.upH / 2);
    }
    if (s.src) drawContent(ctx, s.src, 0, 0, s.upW, s.upH, s.scroll);
    else paintPlaceholder(ctx, 0, 0, s.upW, s.upH);
    ctx.restore();
    if (s.island) {
      // Hardware stays put in landscape, so it is painted in texture space.
      const { x, y, w, h } = s.island;
      ctx.fillStyle = "#000";
      roundRectPath(ctx, x, y, w, h, Math.min(w, h) / 2);
      ctx.fill();
    }
    s.texture.needsUpdate = true;
  }

  /** One device: the model, re-skinned for the finish, with a live screen. */
  private build(model: LoadedModel, finish: FrameFinish, landscape: boolean): Built {
    const { def } = model;
    const rules = def.materials;
    const surface = finish.surface;
    const shell = isShellFinish(finish);
    const g = new THREE.Group();
    const body = cloneRigged(model.scene); // keeps skinned parts bound to their own bones
    body.scale.setScalar(def.scale);
    body.position.copy(model.center).multiplyScalar(-def.scale);
    g.add(body);

    // A shell flattens the camera hardware itself, so nothing is painted over its screens.
    const surfaces = model.screens.map((sc) => this.makeSurface(sc, landscape, !shell));
    const hardware = new Set(def.screens.flatMap((sc) => sc.island));

    // Finishes recolor the model: frame parts follow the frame color, the rest
    // follow the back glass, each keeping its original tone relative to its reference.
    const frame = new THREE.Color(finish.light);
    const backGlass = new THREE.Color(finish.light).lerp(new THREE.Color(finish.dark), 0.6);
    const original = finish.id === def.originalFinish;
    const tuned = new Map<THREE.Material, THREE.Material>();
    const tune = (src: THREE.MeshStandardMaterial) => {
      const recolor = !original && rules.colored.test(src.name) && !rules.keep.includes(src.name);
      // A re-surfaced part keeps the model's relief but none of its old gloss or metal maps.
      const resurfaced =
        recolor && surface
          ? new THREE.MeshPhysicalMaterial({ name: src.name, normalMap: src.normalMap, side: src.side, opacity: src.opacity })
          : null;
      resurfaced?.normalScale.copy(src.normalScale);
      const mat = this.track(resurfaced ?? src.clone());
      if (mat.opacity < 1) {
        if (rules.forceOpaque.includes(mat.name)) mat.opacity = 1;
        else {
          mat.transparent = true;
          mat.depthWrite = false;
        }
      }
      if (recolor) {
        const isFrame = rules.frame.test(mat.name);
        const ratio = luminance(src.color) / (isFrame ? model.frameLum : model.bodyLum);
        mat.color.copy(isFrame ? frame : backGlass).multiplyScalar(Math.min(1.5, Math.max(0.45, ratio)));
        if (resurfaced && surface?.type === "mirror") {
          resurfaced.metalness = 1;
          resurfaced.roughness = isFrame ? 0.03 : 0.08;
        } else if (resurfaced && surface?.type === "paint") {
          resurfaced.metalness = 0.55;
          resurfaced.roughness = 0.42;
          resurfaced.clearcoat = 1;
          resurfaced.clearcoatRoughness = 0.03;
        } else if (resurfaced && surface?.type === "holo") {
          resurfaced.metalness = 1;
          resurfaced.roughness = isFrame ? 0.12 : 0.2;
          resurfaced.iridescence = 1;
          resurfaced.iridescenceIOR = 2;
          resurfaced.iridescenceThicknessRange = [260, 720];
          addFilmWaves(resurfaced, 1 / model.h);
        }
      }
      return mat;
    };
    const [shellBody, shellDetail] = shell ? this.shellMaterials(finish, model.h) : [null, null];

    const shellBezel = shell ? this.track(new THREE.MeshStandardMaterial({ color: "#08080a", roughness: 0.55 })) : null;

    const faces: THREE.Mesh[] = [];
    const shelled: THREE.Mesh[] = [];
    const rigged: THREE.SkinnedMesh[] = [];
    body.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (o instanceof THREE.SkinnedMesh) {
        rigged.push(o);
        o.frustumCulled = false; // its bounds move with the pose
      }
      const src = o.material as THREE.MeshStandardMaterial;
      const screen = model.screens.findIndex((sc) => sc.mesh === o.name);
      if (screen >= 0) {
        o.material = surfaces[screen].material;
        faces.push(o);
        return;
      }
      if (shellBezel && (hardware.has(o.name) || def.shellDark?.test(o.name))) {
        // Camera hardware fills a hole in the panel: flattened to black, it becomes a plain island.
        o.material = shellBezel;
        return;
      }
      if (def.face.includes(o.name)) {
        faces.push(o);
        // The bezel (and the island cut into it) stays black, so the screen still reads as one.
        if (shellBezel) {
          o.material = shellBezel;
          return;
        }
      }
      if (rules.clearGlass.includes(src.name)) {
        o.material = this.glassMaterial(shell ? 0.1 : 0.3);
        o.renderOrder = 2;
      } else if (shellBody && shellDetail) {
        o.material = def.clayBody.test(o.name) ? shellBody : shellDetail;
        shelled.push(o);
      } else {
        let mat = tuned.get(src);
        if (!mat) tuned.set(src, (mat = tune(src)));
        o.material = mat;
      }
    });
    // A second copy of a mesh in another material, following the same bones.
    const twin = (mesh: THREE.Mesh, material: THREE.Material, order: number) => {
      let layer: THREE.Mesh;
      if (mesh instanceof THREE.SkinnedMesh) {
        const skinned = new THREE.SkinnedMesh(mesh.geometry, material);
        skinned.bind(mesh.skeleton, mesh.bindMatrix);
        skinned.frustumCulled = false;
        rigged.push(skinned); // its bounds must follow the pose too
        layer = skinned;
      } else {
        layer = new THREE.Mesh(mesh.geometry, material);
      }
      layer.position.copy(mesh.position);
      layer.quaternion.copy(mesh.quaternion);
      layer.scale.copy(mesh.scale);
      layer.renderOrder = order;
      mesh.parent?.add(layer);
    };
    // Cover glass: the face drawn a second time, carrying only reflections.
    const cover = this.glassMaterial(surface?.type === "clay" || surface?.type === "matcap" ? 0.35 : 1);
    for (const face of faces) twin(face, cover, 2);
    if (surface?.type === "crystal") {
      // Depth first, so only the nearest wall of the shell catches the light.
      const depth = this.track(new THREE.MeshBasicMaterial({ colorWrite: false }));
      for (const mesh of shelled) {
        twin(mesh, depth, -1);
        mesh.renderOrder = 1;
      }
    }

    let mixer: THREE.AnimationMixer | null = null;
    if (model.clip) {
      mixer = new THREE.AnimationMixer(body);
      mixer.clipAction(model.clip).play();
    }

    g.rotation.z = landscape ? Math.PI / 2 : 0;
    return {
      group: g,
      body,
      surfaces,
      rigged,
      mixer,
      poseLength: model.clip?.duration ?? 0,
      w: landscape ? model.h : model.w,
      h: landscape ? model.w : model.h,
    };
  }

  /* ------------------------------------------------------------- per frame */

  /**
   * Screen content, one source per screen: device by device, each device's
   * screens in catalog order. Missing sources repeat the first one; videos
   * repaint every call, images only when they or the scroll change.
   */
  setScreens(srcs: (ScreenSource | null)[], scroll: number) {
    const first = srcs.find((s) => s) ?? null;
    let slot = 0;
    for (const b of this.built) {
      for (const s of b.surfaces) {
        const src = srcs[slot++] ?? first;
        const changed = src !== s.src || (scroll !== s.scroll && src !== null);
        s.src = src;
        s.scroll = scroll;
        if (changed || src instanceof HTMLVideoElement) this.paint(s);
      }
    }
  }

  /** `panX`/`panY` slide the camera sideways, in frame heights at 100% zoom. */
  setView(rotX: number, rotY: number, camDist: number, zoom: number, glare: number, panX = 0, panY = 0) {
    this.rig.rotation.x = rotX;
    this.rig.rotation.y = rotY;
    for (const { mat, gain } of this.glassMats) {
      mat.envMapIntensity = glare * 1.6 * gain;
      // The room follows the device most of the way round, so its reflections
      // drift across the glass instead of racing off it at twice the turn.
      mat.envMapRotation.set(rotX * ROOM_FOLLOW, rotY * ROOM_FOLLOW, 0, "YXZ");
    }
    // Panels lose apparent brightness as they turn away from the viewer.
    const facing = Math.max(0, Math.cos(rotX) * Math.cos(rotY));
    const dim = 1 - (1 - facing) * 0.16;
    for (const b of this.built) for (const s of b.surfaces) s.material.color.setScalar(dim);

    // Same lens feel for every device: camera distance scales with subject size.
    const dist = camDist * (Math.max(this.spanW, this.spanH) / 156);
    const visH = Math.max(this.spanH / 0.68, this.spanW / 0.76 / this.aspect) / zoom;
    this.camera.position.set(panX * visH * zoom, panY * visH * zoom, dist);
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
    this.sceneKey = "";
    this.clear();
    this.envTarget?.dispose();
    this.roomTarget?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}
