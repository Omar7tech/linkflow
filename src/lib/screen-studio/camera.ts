/**
 * The virtual camera. Zoom segments say where it should be; a critically
 * damped spring decides how it gets there, so every move eases in and out
 * like a person operating it, and back-to-back zooms pan instead of jumping.
 *
 * The whole path is simulated once per edit at 60 Hz, so any moment can be
 * looked up instantly while scrubbing and exports match the preview exactly.
 */
import type { Zoom } from "./types";

export interface Cam {
  scale: number;
  /** Centre of the visible part, 0–1 across the recording. */
  x: number;
  y: number;
  /** How fast the camera is moving, for motion blur. */
  speed: number;
}

const HZ = 60;
/** The camera starts moving a little before each zoom, so it lands on time. */
const LEAD = 0.3;

function focusAt(z: Zoom, t: number) {
  const p = z.path;
  if (!p?.length) return { x: z.x, y: z.y };
  if (t <= p[0].t) return p[0];
  for (let i = 1; i < p.length; i++) {
    if (p[i].t >= t) {
      const a = p[i - 1];
      const b = p[i];
      const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
  }
  return p[p.length - 1];
}

function targetAt(zooms: Zoom[], t: number) {
  const z = zooms.find((s) => t + LEAD >= s.start && t + LEAD * 0.4 < s.end);
  if (!z) return { scale: 1, x: 0.5, y: 0.5 };
  const f = focusAt(z, t);
  // A slow push-in while a shot holds keeps it alive, like a dolly.
  const held = Math.min(1, Math.max(0, (t - z.start) / Math.max(1, z.end - z.start)));
  return { scale: z.scale * (1 + 0.04 * held), x: f.x, y: f.y };
}

/** Keeps the visible window inside the recording. */
export function clampCam(c: { scale: number; x: number; y: number }) {
  const s = Math.max(1, c.scale);
  const half = 0.5 / s;
  return { scale: s, x: Math.min(1 - half, Math.max(half, c.x)), y: Math.min(1 - half, Math.max(half, c.y)) };
}

export interface CameraPath {
  /** Camera at a source time. */
  at: (t: number) => Cam;
}

/**
 * Simulates the camera in output time, so moves feel the same next to
 * sped-up stretches. `toOut`/`toSrc` map between source and output time.
 */
export function buildCameraPath(
  zooms: Zoom[],
  map: { duration: number; toOut: (t: number) => number; toSrc: (o: number) => number },
  snap: number
): CameraPath {
  const count = Math.max(2, Math.ceil(map.duration * HZ) + 2);
  const scale = new Float32Array(count);
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const speed = new Float32Array(count);
  // Natural frequency: gentle (≈1 s moves) to snappy (≈0.45 s).
  const w = 4.5 + snap * 7;
  const dt = 1 / HZ;
  const sorted = [...zooms].sort((a, b) => a.start - b.start);
  // Every video opens on the wide shot.
  let s = 1;
  let x = 0.5;
  let y = 0.5;
  let vs = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < count; i++) {
    const g = targetAt(sorted, map.toSrc(i * dt));
    // Critically damped spring: a = w²(target − x) − 2w·v.
    vs += (w * w * (g.scale - s) - 2 * w * vs) * dt;
    vx += (w * w * (g.x - x) - 2 * w * vx) * dt;
    vy += (w * w * (g.y - y) - 2 * w * vy) * dt;
    s += vs * dt;
    x += vx * dt;
    y += vy * dt;
    const c = clampCam({ scale: s, x, y });
    scale[i] = c.scale;
    xs[i] = c.x;
    ys[i] = c.y;
    speed[i] = Math.hypot(vx * s, vy * s, vs * 0.6);
  }
  return {
    at(t: number) {
      const f = Math.min(count - 1.001, Math.max(0, map.toOut(t) * HZ));
      const i = Math.floor(f);
      const k = f - i;
      const l = (a: Float32Array) => a[i] + (a[i + 1] - a[i]) * k;
      return { scale: l(scale), x: l(xs), y: l(ys), speed: l(speed) };
    },
  };
}
