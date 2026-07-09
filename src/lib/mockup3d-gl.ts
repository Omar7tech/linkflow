/**
 * WebGL device renderer (three.js) — physically-based alternative to the 2D
 * plate engine in mockup3d.ts. It renders ONLY the device on a transparent
 * canvas; backdrop, glow, floor reflection and grain are composited by
 * composeScene() exactly like the classic engine, so exports stay identical.
 *
 * The device is built procedurally in portrait and rotated for landscape:
 *  - body: extruded rounded-rect with bevelled (curved) rails, PBR metal
 *    lit by a PMREM room environment → real reflections that move with it
 *  - front: rounded glass plane with the screen as a CanvasTexture
 *  - back: tinted panel + camera plateau with lenses (visible at full turn)
 *  - buttons, USB-C port, speaker/mic holes as real geometry
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  drawCover,
  paintGlare,
  paintPlaceholder,
  paintVignette,
  roundRectPath,
  type DeviceId,
  type FrameFinish,
  type Orientation,
  type ScreenSource,
} from "./mockup3d";

const TEX = 12; // texture pixels per world unit

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
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

/** Flat rounded-rect geometry with UVs normalized to 0..1. */
function roundedPlane(w: number, h: number, r: number): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 24);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5);
  return g;
}

interface ScreenLayers {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  base: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  /** Upright (visual) dims — swapped from texture dims in landscape. */
  upW: number;
  upH: number;
  bz: number; // bezel inset in texture px
  sr: number; // screen corner radius in texture px
  landscape: boolean;
}

export class GLMockupRenderer {
  readonly domElement: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 10, 5000);
  /** Outer group takes tilt/turn; inner holds the portrait-built device (z-rotated for landscape). */
  private rig = new THREE.Group();
  private deviceGroup: THREE.Group | null = null;
  private deviceKey = "";
  private visualH = 148; // on-screen device height in world units (for floor line)
  private spanMax = 152; // max dimension incl. buttons (for framing)
  private screen: ScreenLayers | null = null;
  private lastSrc: ScreenSource | null = null;
  private vRx = 0;
  private vRy = 0;
  private vGlare = 0.6;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.domElement = this.renderer.domElement;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(-140, 220, 300);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    this.rig.rotation.order = "YXZ"; // turn (Y) wraps tilt (X), matching the 2D engine
    this.scene.add(this.rig);
  }

  setSize(w: number, h: number) {
    const c = this.domElement;
    if (c.width === w && c.height === h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Rebuild the device if its identity changed. */
  prepare(device: DeviceId, orientation: Orientation, finish: FrameFinish) {
    const key = `${device}|${orientation}|${finish.id}`;
    if (key === this.deviceKey) return;
    this.deviceKey = key;

    if (this.deviceGroup) {
      this.rig.remove(this.deviceGroup);
      this.deviceGroup.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      this.screen?.texture.dispose();
    }

    const phone = device === "iphone";
    const pw = phone ? 72 : 136;
    const ph = phone ? 148 : 190;
    const t = phone ? 7.6 : 6.4;
    const r = phone ? 11.4 : 9;
    const landscape = orientation === "landscape";
    this.visualH = landscape ? pw : ph;
    this.spanMax = ph + 6;

    const g = new THREE.Group();

    const metal = new THREE.MeshPhysicalMaterial({
      color: finish.light,
      metalness: 0.85,
      roughness: 0.34,
      envMapIntensity: 1.15,
    });
    const darkMetal = new THREE.MeshPhysicalMaterial({
      color: finish.dark,
      metalness: 0.7,
      roughness: 0.42,
      envMapIntensity: 1,
    });
    const hole = new THREE.MeshStandardMaterial({ color: "#0a0a0c", roughness: 0.9 });

    // Body — bevelled extrusion gives genuinely curved rails.
    const bev = 1.4;
    const body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundedRectShape(pw - bev * 2, ph - bev * 2, r - bev), {
        depth: t - bev * 2,
        bevelEnabled: true,
        bevelThickness: bev,
        bevelSize: bev - 0.02,
        bevelSegments: 5,
        curveSegments: 24,
      }),
      metal
    );
    body.geometry.center();
    g.add(body);

    // Front glass + screen texture — sized to the body's flat front face
    // (extrusion shape minus bevel) so it never overhangs the curved rails.
    const gw = pw - bev * 2 - 0.4;
    const gh = ph - bev * 2 - 0.4;
    const gr = r - bev - 0.2;
    this.screen = this.buildScreen(gw, gh, gr, phone, landscape);
    const glass = new THREE.Mesh(
      roundedPlane(gw, gh, gr),
      new THREE.MeshBasicMaterial({ map: this.screen.texture, toneMapped: false })
    );
    glass.position.z = t / 2 + 0.06;
    g.add(glass);

    // Back panel
    const back = new THREE.Mesh(
      roundedPlane(gw, gh, gr),
      new THREE.MeshPhysicalMaterial({
        color: finish.dark,
        metalness: 0.55,
        roughness: 0.45,
        envMapIntensity: 0.9,
      })
    );
    back.position.z = -t / 2 - 0.06;
    back.rotation.y = Math.PI;
    g.add(back);

    // Camera module on the back (visible at full turn)
    if (phone) {
      const plateau = new THREE.Mesh(
        new THREE.ExtrudeGeometry(roundedRectShape(24, 24, 7), {
          depth: 1.4,
          bevelEnabled: true,
          bevelThickness: 0.7,
          bevelSize: 0.7,
          bevelSegments: 3,
          curveSegments: 16,
        }),
        metal
      );
      plateau.geometry.center();
      plateau.position.set(-pw / 2 + 15.4, ph / 2 - 15.4, -t / 2 - 1.1);
      g.add(plateau);
      const lensAt = (lx: number, ly: number) => {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 1.9, 28), darkMetal);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(-pw / 2 + 15.4 + lx, ph / 2 - 15.4 + ly, -t / 2 - 2.2);
        g.add(ring);
        const lensGlass = new THREE.Mesh(
          new THREE.CylinderGeometry(2.6, 2.6, 0.4, 24),
          new THREE.MeshPhysicalMaterial({ color: "#060a14", metalness: 0, roughness: 0.05 })
        );
        lensGlass.rotation.x = Math.PI / 2;
        lensGlass.position.set(-pw / 2 + 15.4 + lx, ph / 2 - 15.4 + ly, -t / 2 - 3.15);
        g.add(lensGlass);
      };
      lensAt(-4.6, 5.2);
      lensAt(-4.6, -5.2);
      lensAt(5.2, 0);
    } else {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 1.2, 24), darkMetal);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-pw / 2 + 10, ph / 2 - 10, -t / 2 - 0.5);
      g.add(ring);
    }

    // Side buttons — capsules half-sunk into the rails (portrait layout).
    const btn = (x: number, y: number, len: number, topEdge = false) => {
      const cap = new THREE.Mesh(new THREE.CapsuleGeometry(1.45, len - 2.9, 3, 12), metal);
      if (topEdge) cap.rotation.z = Math.PI / 2;
      cap.position.set(x, y, 0);
      cap.scale.set(1, 1, Math.min(1, (t * 0.42) / 2.9)); // slimmer than round across thickness
      g.add(cap);
    };
    if (phone) {
      btn(-pw / 2, 42, 6.5);
      btn(-pw / 2, 25, 11);
      btn(-pw / 2, 12, 11);
      btn(pw / 2, 25, 14);
    } else {
      btn(pw / 2 - 13, ph / 2, 10, true);
      btn(pw / 2, ph / 2 - 14, 8.5);
      btn(pw / 2, ph / 2 - 25, 8.5);
    }

    // Bottom-rail hardware: USB-C slot, screws, speaker/mic holes.
    // Sunk into the rail so only a thin dark sliver breaks the surface —
    // they read as drilled openings, not bumps hanging under the device.
    const slot = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 6, 3, 10), hole);
    slot.rotation.z = Math.PI / 2;
    slot.position.set(0, -ph / 2 + 1.25, 0);
    g.add(slot);
    const holeAt = (x: number, rad: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 10, 8), hole);
      m.position.set(x, -ph / 2 + rad - 0.2, 0);
      g.add(m);
    };
    if (phone) {
      holeAt(-7.8, 0.5);
      holeAt(7.8, 0.5);
      for (let i = 0; i < 6; i++) holeAt(12 + i * 2.7, 0.62);
      for (let i = 0; i < 3; i++) holeAt(-12 - i * 2.7, 0.62);
    } else {
      for (let i = 0; i < 5; i++) holeAt(13 + i * 2.6, 0.6);
      for (let i = 0; i < 5; i++) holeAt(-13 - i * 2.6, 0.6);
    }

    g.rotation.z = landscape ? Math.PI / 2 : 0;
    this.deviceGroup = g;
    this.rig.add(g);
    this.lastSrc = null;
    this.paintScreen();
  }

  /** Screen texture: cached bezel/placeholder base + island/vignette overlay, content + glare per frame. */
  private buildScreen(gw: number, gh: number, gr: number, phone: boolean, landscape: boolean): ScreenLayers {
    const tw = Math.round(gw * TEX);
    const th = Math.round(gh * TEX);
    const bz = (phone ? 1.9 : 3.8) * TEX;
    // Concentric with the glass corner (outer radius minus bezel inset) —
    // the content's rounded corner stays inside the bezel, never past it.
    const sr = Math.max(gr * TEX - bz, 8);
    // Upright/visual dims: in landscape the mesh is z-rotated, so we paint rotated.
    const upW = landscape ? th : tw;
    const upH = landscape ? tw : th;

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d")!;

    const uprightOn = (c: CanvasRenderingContext2D, draw: () => void) => {
      c.save();
      if (landscape) {
        c.translate(tw / 2, th / 2);
        c.rotate(Math.PI / 2);
        c.translate(-upW / 2, -upH / 2);
      }
      draw();
      c.restore();
    };

    const base = document.createElement("canvas");
    base.width = tw;
    base.height = th;
    {
      const c = base.getContext("2d")!;
      c.fillStyle = "#050506";
      roundRectPath(c, 0, 0, tw, th, gr * TEX);
      c.fill();
      // Same rounded clip as the content — otherwise the placeholder's square
      // corners peek out past the image's rounded corners.
      c.save();
      roundRectPath(c, bz, bz, tw - bz * 2, th - bz * 2, sr);
      c.clip();
      uprightOn(c, () => paintPlaceholder(c, bz, bz, upW - bz * 2, upH - bz * 2));
      c.restore();
    }

    const overlay = document.createElement("canvas");
    overlay.width = tw;
    overlay.height = th;
    {
      const c = overlay.getContext("2d")!;
      uprightOn(c, () => {
        paintVignette(c, bz, bz, upW - bz * 2, upH - bz * 2);
        c.strokeStyle = "rgba(255,255,255,0.09)";
        c.lineWidth = TEX * 0.22;
        roundRectPath(c, bz + TEX * 0.12, bz + TEX * 0.12, upW - bz * 2 - TEX * 0.24, upH - bz * 2 - TEX * 0.24, sr);
        c.stroke();
        if (phone) {
          const len = upW * 0.29;
          const thin = TEX * 5.6;
          const ix = (upW - len) / 2;
          const iy = bz + TEX * 1.4;
          c.fillStyle = "#000";
          roundRectPath(c, ix, iy, len, thin, thin / 2);
          c.fill();
          const lr = thin * 0.3;
          const lx = ix + len - thin / 2;
          const ly = iy + thin / 2;
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
          const lr = TEX * 0.9;
          const lens = c.createRadialGradient(upW / 2 - lr * 0.3, bz / 2 - lr * 0.3, lr * 0.1, upW / 2, bz / 2, lr);
          lens.addColorStop(0, "#2c3850");
          lens.addColorStop(0.6, "#10151f");
          lens.addColorStop(1, "#030407");
          c.fillStyle = lens;
          c.beginPath();
          c.arc(upW / 2, bz / 2 + TEX * 0.3, lr, 0, Math.PI * 2);
          c.fill();
        }
      });
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    return { canvas, ctx, base, overlay, texture, upW, upH, bz, sr, landscape };
  }

  private paintScreen() {
    const s = this.screen;
    if (!s) return;
    const { ctx, canvas, base, overlay, upW, upH, bz, sr, landscape } = s;
    const tw = canvas.width;
    const th = canvas.height;
    ctx.clearRect(0, 0, tw, th);
    ctx.drawImage(base, 0, 0);
    ctx.save();
    roundRectPath(ctx, bz, bz, tw - bz * 2, th - bz * 2, sr);
    ctx.clip();
    if (landscape) {
      ctx.translate(tw / 2, th / 2);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-upW / 2, -upH / 2);
    }
    if (this.lastSrc) drawCover(ctx, this.lastSrc, bz, bz, upW - bz * 2, upH - bz * 2);
    paintGlare(ctx, bz, bz, upW - bz * 2, upH - bz * 2, this.vRx, this.vRy, this.vGlare);
    ctx.restore();
    ctx.drawImage(overlay, 0, 0);
    // Off-axis dimming, like a real panel viewed at an angle.
    const nz = Math.cos(this.vRx) * Math.abs(Math.cos(this.vRy));
    const dim = (1 - Math.max(0, nz)) * 0.14;
    if (dim > 0.01) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = `rgba(6,9,14,${dim.toFixed(3)})`;
      ctx.fillRect(0, 0, tw, th);
      ctx.globalCompositeOperation = "source-over";
    }
    s.texture.needsUpdate = true;
  }

  /** Update screen content. Videos repaint every call; images only on change. */
  setScreen(src: ScreenSource | null) {
    const changed = src !== this.lastSrc;
    this.lastSrc = src;
    if (changed || src instanceof HTMLVideoElement) this.paintScreen();
  }

  setView(rotX: number, rotY: number, camDist: number, zoom: number, glare: number) {
    if (glare !== this.vGlare || rotX !== this.vRx || rotY !== this.vRy) {
      this.vRx = rotX;
      this.vRy = rotY;
      this.vGlare = glare;
      if (!(this.lastSrc instanceof HTMLVideoElement)) this.paintScreen(); // video repaints anyway
    }
    this.rig.rotation.x = rotX;
    this.rig.rotation.y = rotY;
    this.camera.position.set(0, 0, camDist);
    const visH = this.spanMax / 0.62 / zoom;
    this.camera.fov = (2 * Math.atan(visH / 2 / camDist) * 180) / Math.PI;
    this.camera.near = camDist / 10;
    this.camera.far = camDist * 5;
    this.camera.updateProjectionMatrix();
  }

  /** Floor line (a few units under the device) in output pixels — for the reflection. */
  floorScreenY(): number {
    const v = new THREE.Vector3(0, -this.visualH / 2 - 6, 0)
      .applyQuaternion(this.rig.quaternion)
      .project(this.camera);
    return ((1 - v.y) / 2) * this.domElement.height;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.deviceKey = "";
    this.screen?.texture.dispose();
    this.renderer.dispose();
  }
}
