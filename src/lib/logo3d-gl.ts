/**
 * SVG → 3D logo renderer (three.js). Parses SVG fills, extrudes them with a
 * bevelled profile, and lights them with a PMREM room environment so metal,
 * glass and neon finishes read physically. Renders ONLY the logo on a
 * transparent canvas — backdrop, glow, floor reflection and grain are
 * composited by composeScene() from mockup3d, same pipeline as the mockups.
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

export interface LogoFinish {
  id: string;
  label: string;
  /** Swatch background for the picker chip. */
  css: string;
  kind: "metal" | "glass" | "neon" | "custom";
  color: string;
  metalness: number;
  roughness: number;
  clearcoat?: number;
  iridescence?: number;
}

export const LOGO_FINISHES: readonly LogoFinish[] = [
  { id: "chrome", label: "Chrome", css: "linear-gradient(135deg,#f4f4f6,#8e8e96)", kind: "metal", color: "#e9e9ee", metalness: 1, roughness: 0.12 },
  { id: "gold", label: "Gold", css: "linear-gradient(135deg,#f9d976,#b8860b)", kind: "metal", color: "#f3c14b", metalness: 1, roughness: 0.22 },
  { id: "copper", label: "Copper", css: "linear-gradient(135deg,#e8a878,#8c4a25)", kind: "metal", color: "#cf7f4e", metalness: 1, roughness: 0.28 },
  { id: "onyx", label: "Onyx", css: "linear-gradient(135deg,#3a3a40,#101014)", kind: "metal", color: "#232327", metalness: 0.9, roughness: 0.32, clearcoat: 0.6 },
  { id: "emerald", label: "Emerald", css: "linear-gradient(135deg,#34d399,#065f46)", kind: "metal", color: "#10b981", metalness: 0.7, roughness: 0.24, clearcoat: 0.5 },
  { id: "pearl", label: "Pearl", css: "linear-gradient(135deg,#ffffff,#cfc8d8)", kind: "metal", color: "#f2efec", metalness: 0.15, roughness: 0.22, clearcoat: 1, iridescence: 0.85 },
  { id: "glass", label: "Glass", css: "linear-gradient(135deg,#e0f2fe88,#7dd3fc44)", kind: "glass", color: "#dff3f6", metalness: 0, roughness: 0.06 },
  { id: "neon", label: "Neon", css: "linear-gradient(135deg,#34d399,#0ea5e9)", kind: "neon", color: "#34d399", metalness: 0.2, roughness: 0.4 },
  { id: "custom", label: "Custom", css: "conic-gradient(#f87171,#fbbf24,#34d399,#38bdf8,#a78bfa,#f87171)", kind: "custom", color: "#10b981", metalness: 0.8, roughness: 0.3 },
];

export interface LogoBuildOptions {
  /** Extrusion depth as a fraction of logo height (0.02..0.4). */
  depth: number;
  /** Bevel size as a fraction of logo height (0..0.03). */
  bevel: number;
  /** Soft = rounded bevel profile, cut = a single hard chamfer. */
  bevelStyle: "soft" | "cut";
  finish: LogoFinish;
  /** Different material on the extruded sides + bevel; null = match the face. */
  edgeFinish: LogoFinish | null;
  /** Color for neon/custom finishes. */
  tint: string;
  /** Keep each SVG path's own fill color (finish supplies the surface feel). */
  originalColors: boolean;
  /** Surface overrides for the face material — start from the finish, stay tweakable. */
  metalness: number;
  roughness: number;
  /** Environment reflection strength for metals; drives emissive strength for neon. */
  shine: number;
}

export class GLLogoRenderer {
  readonly domElement: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 10, 5000);
  private rig = new THREE.Group();
  private group: THREE.Group | null = null;
  private buildKey = "";
  private visualH = 100;
  private spanMax = 120;

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

    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(-160, 240, 320);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.22));

    this.rig.rotation.order = "YXZ";
    this.scene.add(this.rig);
  }

  setSize(w: number, h: number) {
    const c = this.domElement;
    if (c.width === w && c.height === h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Build a material from a finish. `surface` carries the user's overrides for
   * the face; edge materials pass null and use the finish's stock values.
   */
  private makeMaterial(
    f: LogoFinish,
    tint: string,
    pathColor: string | null,
    surface: { metalness: number; roughness: number; shine: number } | null
  ): THREE.Material {
    const color = pathColor ?? (f.kind === "neon" || f.kind === "custom" ? tint : f.color);
    if (f.kind === "glass") {
      return new THREE.MeshPhysicalMaterial({
        color: pathColor ?? f.color,
        metalness: 0,
        roughness: surface?.roughness ?? f.roughness,
        transmission: 1,
        thickness: 6,
        ior: 1.45,
        side: THREE.DoubleSide,
      });
    }
    if (f.kind === "neon") {
      return new THREE.MeshPhysicalMaterial({
        color: "#0b0b0f",
        emissive: color,
        emissiveIntensity: 1 + (surface?.shine ?? 1.15) * 1.3,
        metalness: surface?.metalness ?? f.metalness,
        roughness: surface?.roughness ?? f.roughness,
        side: THREE.DoubleSide,
      });
    }
    return new THREE.MeshPhysicalMaterial({
      color,
      metalness: surface?.metalness ?? f.metalness,
      roughness: surface?.roughness ?? f.roughness,
      clearcoat: f.clearcoat ?? 0,
      clearcoatRoughness: 0.25,
      iridescence: f.iridescence ?? 0,
      envMapIntensity: surface?.shine ?? 1.15,
      side: THREE.DoubleSide,
    });
  }

  /**
   * Rebuild the logo mesh if inputs changed. Returns false when the SVG has
   * no fillable paths (nothing to extrude).
   */
  setLogo(svg: string, o: LogoBuildOptions): boolean {
    const key = `${o.depth}|${o.bevel}|${o.bevelStyle}|${o.finish.id}|${o.edgeFinish?.id ?? "match"}|${o.tint}|${o.originalColors}|${o.metalness}|${o.roughness}|${o.shine}|${svg}`;
    if (key === this.buildKey) return this.group !== null;
    this.buildKey = key;

    if (this.group) {
      this.rig.remove(this.group);
      this.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
        }
      });
      this.group = null;
    }

    let paths;
    try {
      paths = new SVGLoader().parse(svg).paths;
    } catch {
      return false;
    }

    // Estimate the logo's own scale first so depth/bevel are proportional.
    const probe = new THREE.Box2();
    for (const p of paths)
      for (const sp of p.subPaths)
        for (const pt of sp.getPoints(6)) probe.expandByPoint(new THREE.Vector2(pt.x, pt.y));
    const rawH = Math.max(probe.max.y - probe.min.y, probe.max.x - probe.min.x, 1e-3);
    const depth = Math.max(rawH * o.depth, rawH * 0.01);
    const bevel = rawH * o.bevel;

    const g = new THREE.Group();
    let built = 0;
    for (const path of paths) {
      const style = path.userData?.style as { fill?: string; fillOpacity?: number } | undefined;
      if (style?.fill === "none" || style?.fillOpacity === 0) continue;
      const pathColor =
        o.originalColors && style?.fill && style.fill !== "none"
          ? style.fill
          : o.originalColors
            ? `#${path.color.getHexString()}`
            : null;
      const surface = { metalness: o.metalness, roughness: o.roughness, shine: o.shine };
      const faceMat = this.makeMaterial(o.finish, o.tint, pathColor, surface);
      // ExtrudeGeometry group 0 = front/back caps, group 1 = walls + bevel —
      // a second finish there gives the two-tone edge look.
      const material = o.edgeFinish
        ? [faceMat, this.makeMaterial(o.edgeFinish, o.tint, null, null)]
        : faceMat;
      let shapes;
      try {
        shapes = SVGLoader.createShapes(path);
      } catch {
        continue;
      }
      for (const shape of shapes) {
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: bevel > 0,
          bevelThickness: bevel,
          bevelSize: bevel * 0.85,
          bevelSegments: o.bevelStyle === "soft" ? 4 : 1,
          curveSegments: 16,
        });
        g.add(new THREE.Mesh(geo, material));
        built++;
      }
    }
    if (built === 0) return false;

    // SVG y grows downward — flip, then center and normalize to ~100 units.
    g.scale.y = -1;
    const box = new THREE.Box3().setFromObject(g);
    const size = box.getSize(new THREE.Vector3());
    const s = 118 / Math.max(size.x, size.y, 1e-3);
    g.scale.multiplyScalar(s);
    const center = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
    g.position.set(-center.x, -center.y, -center.z);

    this.visualH = size.y * s;
    this.spanMax = Math.max(size.x, size.y) * s;
    this.group = g;
    this.rig.add(g);
    return true;
  }

  setView(rotX: number, rotY: number, camDist: number, zoom: number) {
    this.rig.rotation.x = rotX;
    this.rig.rotation.y = rotY;
    this.camera.position.set(0, 0, camDist);
    const visH = (this.spanMax + 12) / 0.62 / zoom;
    this.camera.fov = (2 * Math.atan(visH / 2 / camDist) * 180) / Math.PI;
    this.camera.near = camDist / 10;
    this.camera.far = camDist * 5;
    this.camera.updateProjectionMatrix();
  }

  /** Floor line (a few units under the logo) in output pixels — for the reflection. */
  floorScreenY(): number {
    const v = new THREE.Vector3(0, -this.visualH / 2 - 8, 0)
      .applyQuaternion(this.rig.quaternion)
      .project(this.camera);
    return ((1 - v.y) / 2) * this.domElement.height;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.buildKey = "";
    this.renderer.dispose();
  }
}
