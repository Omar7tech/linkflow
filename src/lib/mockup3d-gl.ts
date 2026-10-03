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
 *  - finishes: recoloring the model's own materials, or a matte clay pass
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneRigged } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  drawContent,
  paintPlaceholder,
  roundRectPath,
  type FrameFinish,
  type Orientation,
  type ScreenSource,
} from "./mockup3d";
import type { DeviceModel } from "./mockup-models";

export type LayoutId = "single" | "duo" | "trio";
export type LightingId = "studio" | "soft" | "dramatic" | "neon";

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
            h: span.y * k,
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
  private sceneKey = "";
  private pose = -1;
  private trash: { dispose(): void }[] = [];
  private built: Built[] = [];
  private glassMats: { mat: THREE.MeshPhysicalMaterial; gain: number }[] = [];
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
    const clay = !!finish.clay;
    const g = new THREE.Group();
    const body = cloneRigged(model.scene); // keeps skinned parts bound to their own bones
    body.scale.setScalar(def.scale);
    body.position.copy(model.center).multiplyScalar(-def.scale);
    g.add(body);

    const surfaces = model.screens.map((sc) => this.makeSurface(sc, landscape, !clay));

    // Finishes recolor the model: frame parts follow the frame color, the rest
    // follow the back glass, each keeping its original tone relative to its reference.
    const frame = new THREE.Color(finish.light);
    const backGlass = new THREE.Color(finish.light).lerp(new THREE.Color(finish.dark), 0.6);
    const original = finish.id === def.originalFinish;
    const tuned = new Map<THREE.Material, THREE.Material>();
    const tune = (src: THREE.MeshStandardMaterial) => {
      const mat = this.track(src.clone());
      if (mat.opacity < 1) {
        if (rules.forceOpaque.includes(mat.name)) mat.opacity = 1;
        else {
          mat.transparent = true;
          mat.depthWrite = false;
        }
      }
      if (!original && mat.name.startsWith(rules.colored) && !rules.keep.includes(mat.name)) {
        const isFrame = rules.frame.test(mat.name);
        const ratio = luminance(mat.color) / (isFrame ? model.frameLum : model.bodyLum);
        mat.color.copy(isFrame ? frame : backGlass).multiplyScalar(Math.min(1.5, Math.max(0.45, ratio)));
      }
      return mat;
    };
    const clayLight = clay ? this.track(new THREE.MeshStandardMaterial({ color: finish.light, roughness: 0.82 })) : null;
    const clayDark = clay ? this.track(new THREE.MeshStandardMaterial({ color: finish.dark, roughness: 0.82 })) : null;

    const faces: THREE.Mesh[] = [];
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
      if (def.face.includes(o.name)) faces.push(o);
      if (rules.clearGlass.includes(src.name)) {
        o.material = this.glassMaterial(clay ? 0.1 : 0.3);
        o.renderOrder = 2;
      } else if (clayLight && clayDark) {
        o.material = def.clayBody.test(o.name) ? clayLight : clayDark;
      } else {
        let mat = tuned.get(src);
        if (!mat) tuned.set(src, (mat = tune(src)));
        o.material = mat;
      }
    });
    // Cover glass: the face drawn a second time, carrying only reflections.
    const cover = this.glassMaterial(clay ? 0.35 : 1);
    for (const face of faces) {
      let layer: THREE.Mesh;
      if (face instanceof THREE.SkinnedMesh) {
        const skinned = new THREE.SkinnedMesh(face.geometry, cover);
        skinned.bind(face.skeleton, face.bindMatrix);
        skinned.frustumCulled = false;
        rigged.push(skinned); // its bounds must follow the pose too
        layer = skinned;
      } else {
        layer = new THREE.Mesh(face.geometry, cover);
      }
      layer.position.copy(face.position);
      layer.quaternion.copy(face.quaternion);
      layer.scale.copy(face.scale);
      layer.renderOrder = 2;
      face.parent?.add(layer);
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

  setView(rotX: number, rotY: number, camDist: number, zoom: number, glare: number) {
    this.rig.rotation.x = rotX;
    this.rig.rotation.y = rotY;
    for (const { mat, gain } of this.glassMats) mat.envMapIntensity = glare * 0.9 * gain;
    // Panels lose apparent brightness as they turn away from the viewer.
    const facing = Math.max(0, Math.cos(rotX) * Math.cos(rotY));
    const dim = 1 - (1 - facing) * 0.16;
    for (const b of this.built) for (const s of b.surfaces) s.material.color.setScalar(dim);

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
    this.sceneKey = "";
    this.clear();
    this.envTarget?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}
