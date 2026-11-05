/**
 * Loading recordings, filmstrip thumbnails, and finding where the action is.
 */
import { uid, type FocusPoint, type Zoom } from "./types";

const once = (el: EventTarget, name: string) => new Promise<void>((r) => el.addEventListener(name, () => r(), { once: true }));

/**
 * A video element ready to draw from. Recordings straight from MediaRecorder
 * carry no duration; seeking far past the end makes the browser find it.
 */
export async function loadVideo(url: string, muted = true): Promise<HTMLVideoElement> {
  const v = document.createElement("video");
  v.src = url;
  v.muted = muted;
  v.playsInline = true;
  v.preload = "auto";
  v.crossOrigin = "anonymous";
  await once(v, "loadedmetadata");
  if (!Number.isFinite(v.duration)) {
    v.currentTime = 1e101;
    await once(v, "durationchange");
    v.currentTime = 0;
    await once(v, "seeked");
  }
  if (v.readyState < 2) await once(v, "loadeddata");
  return v;
}

export async function seek(v: HTMLVideoElement, t: number) {
  if (Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2) return;
  v.currentTime = t;
  await once(v, "seeked");
}

/** Small frames along the recording, for the timeline. */
export async function filmstrip(url: string, count: number, height = 56): Promise<string[]> {
  const v = await loadVideo(url);
  const w = Math.round((height * v.videoWidth) / v.videoHeight);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = height;
  const ctx = c.getContext("2d")!;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    await seek(v, ((i + 0.5) / count) * v.duration);
    ctx.drawImage(v, 0, 0, w, height);
    out.push(c.toDataURL("image/jpeg", 0.6));
  }
  v.removeAttribute("src");
  v.load();
  return out;
}

/* ------------------------------------------------------------ auto zoom */

interface Sample {
  t: number;
  /** Share of the frame that changed. */
  changed: number;
  x: number;
  y: number;
  /** Spread of the change, 0–1. */
  w: number;
  h: number;
}

const SW = 192;

/**
 * Watches the recording at high speed and notes, every tenth of a second,
 * how much of the screen changed and where. Small, local changes are a
 * cursor, a click, typing; big ones are scrolling or a new page.
 */
async function sampleActivity(url: string, onProgress: (p: number) => void): Promise<Sample[]> {
  const v = await loadVideo(url);
  const SH = Math.round((SW * v.videoHeight) / v.videoWidth);
  const c = document.createElement("canvas");
  c.width = SW;
  c.height = SH;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const prev = new Float32Array(SW * SH);
  let has = false;
  const samples: Sample[] = [];
  let last = -1;

  const take = () => {
    const t = v.currentTime;
    if (t - last < 0.1) return;
    last = t;
    ctx.drawImage(v, 0, 0, SW, SH);
    const d = ctx.getImageData(0, 0, SW, SH).data;
    let n = 0;
    let sx = 0;
    let sy = 0;
    let minX = SW;
    let maxX = 0;
    let minY = SH;
    let maxY = 0;
    for (let i = 0, p = 0; p < SW * SH; i += 4, p++) {
      const g = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      if (has && Math.abs(g - prev[p]) > 22) {
        const x = p % SW;
        const y = (p / SW) | 0;
        n++;
        sx += x;
        sy += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      prev[p] = g;
    }
    if (has)
      samples.push({
        t,
        changed: n / (SW * SH),
        x: n ? sx / n / SW : 0.5,
        y: n ? sy / n / SH : 0.5,
        w: n ? (maxX - minX) / SW : 0,
        h: n ? (maxY - minY) / SH : 0,
      });
    has = true;
    onProgress(Math.min(0.99, t / v.duration));
  };

  v.playbackRate = 8;
  const done = once(v, "ended");
  const rvfc = "requestVideoFrameCallback" in v;
  const loop = () => {
    take();
    if (v.ended) return;
    if (rvfc) v.requestVideoFrameCallback(loop);
    else requestAnimationFrame(loop);
  };
  await v.play();
  loop();
  await done;
  v.removeAttribute("src");
  v.load();
  return samples;
}

/**
 * Groups the moments where activity stays in one area for a while into
 * zooms that follow it, the way an editor would cut them by hand.
 */
export async function autoZooms(url: string, aspect: number, onProgress: (p: number) => void): Promise<Zoom[]> {
  const samples = await sampleActivity(url, onProgress);
  const duration = samples.length ? samples[samples.length - 1].t + 0.1 : 0;
  const zooms: Zoom[] = [];
  let group: Sample[] = [];
  let idleSince = -1;

  const close = () => {
    if (group.length >= 4) {
      const start = group[0].t;
      const end = group[group.length - 1].t;
      if (end - start >= 1) {
        const xs = group.map((s) => s.x);
        const ys = group.map((s) => s.y);
        const spreadX = Math.max(...xs) - Math.min(...xs) + Math.max(...group.map((s) => s.w)) * 0.5;
        const spreadY = (Math.max(...ys) - Math.min(...ys) + Math.max(...group.map((s) => s.h)) * 0.5) / aspect;
        const scale = Math.min(2.4, Math.max(1.5, 0.55 / Math.max(0.05, spreadX, spreadY)));
        // A lightly smoothed path through the activity.
        const path: FocusPoint[] = [];
        for (let i = 0; i < group.length; i += 2) {
          const win = group.slice(Math.max(0, i - 3), i + 4);
          path.push({ t: group[i].t, x: win.reduce((a, s) => a + s.x, 0) / win.length, y: win.reduce((a, s) => a + s.y, 0) / win.length });
        }
        const mid = path[Math.floor(path.length / 2)];
        zooms.push({ id: uid(), start: Math.max(0, start - 0.2), end: Math.min(duration, end + 0.7), scale: Math.round(scale * 10) / 10, x: mid.x, y: mid.y, path, auto: true });
      }
    }
    group = [];
    idleSince = -1;
  };

  for (const s of samples) {
    if (s.changed > 0.12) {
      // Scrolling or a new page: pull back out.
      close();
      continue;
    }
    if (s.changed < 0.0004) {
      if (group.length) {
        if (idleSince < 0) idleSince = s.t;
        else if (s.t - idleSince > 1.2) close();
      }
      continue;
    }
    idleSince = -1;
    if (group.length) {
      const cx = group.reduce((a, g) => a + g.x, 0) / group.length;
      const cy = group.reduce((a, g) => a + g.y, 0) / group.length;
      if (Math.hypot(s.x - cx, (s.y - cy) / aspect) > 0.22) close();
    }
    group.push(s);
  }
  close();

  // Merge zooms that nearly touch and sit close together.
  const merged: Zoom[] = [];
  for (const z of zooms) {
    const prev = merged[merged.length - 1];
    if (prev && z.start - prev.end < 0.6 && Math.hypot(z.x - prev.x, z.y - prev.y) < 0.3) {
      prev.end = z.end;
      prev.path = [...(prev.path ?? []), ...(z.path ?? [])];
      prev.scale = Math.min(prev.scale, z.scale);
    } else merged.push(z);
  }
  onProgress(1);
  return merged;
}
