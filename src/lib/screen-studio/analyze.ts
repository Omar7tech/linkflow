/**
 * Watches a recording the way an editor would on a first pass: what moved,
 * where, and whether someone was talking.
 *
 * Every tenth of a second it classifies the screen as idle, cursor motion,
 * a local change (typing, a click's response, a menu), a scroll or a whole
 * new page. Scrolls are told apart from page changes by testing whether the
 * frame matches the previous one shifted up or down. The cursor is found as
 * the pixels that differ from both of the two previous frames: only its new
 * position does. Sound is decoded once and measured for speech.
 */
import { loadVideo, seek } from "./media";

export type Kind = "idle" | "cursor" | "local" | "scroll" | "page";

export interface Sample {
  t: number;
  kind: Kind;
  /** Share of the frame that changed. */
  changed: number;
  /** Centre and size of the changed area, 0–1. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where the cursor is, when it could be seen moving. */
  cx: number;
  cy: number;
}

export interface Analysis {
  duration: number;
  /** Recording width ÷ height. */
  aspect: number;
  samples: Sample[];
  /** Talking, per tenth of a second. */
  voice: Uint8Array;
  hasAudio: boolean;
}

const SW = 320;
/** Grey-level change that counts; low enough to catch a typed character. */
const T = 12;
const STEP = 0.1;

async function analyzeVideo(url: string, onProgress: (p: number) => void) {
  const v = await loadVideo(url);
  const SH = Math.round((SW * v.videoHeight) / v.videoWidth);
  const N = SW * SH;
  const c = document.createElement("canvas");
  c.width = SW;
  c.height = SH;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  let cur = new Float32Array(N);
  let prev = new Float32Array(N);
  let prev2 = new Float32Array(N);
  let frames = 0;
  const samples: Sample[] = [];
  let last = -1;

  const shiftScore = (dy: number) => {
    // Mean difference between this frame and the last one shifted by dy rows,
    // over the middle of the screen (sidebars and headers rarely scroll).
    let sum = 0;
    let count = 0;
    const x0 = Math.floor(SW * 0.15);
    const x1 = Math.floor(SW * 0.85);
    const y0 = Math.max(0, Math.floor(SH * 0.12), -dy);
    const y1 = Math.min(SH, Math.floor(SH * 0.95), SH - dy);
    for (let y = y0; y < y1; y += 2) {
      const a = y * SW;
      const b = (y + dy) * SW;
      for (let x = x0; x < x1; x += 2) {
        sum += Math.abs(cur[b + x] - prev[a + x]);
        count++;
      }
    }
    return count ? sum / count : 1e9;
  };

  let reported = 0;
  const take = (t: number) => {
    if (t - last < STEP * 0.9) return;
    last = t;
    ctx.drawImage(v, 0, 0, SW, SH);
    const d = ctx.getImageData(0, 0, SW, SH).data;
    [prev2, prev, cur] = [prev, cur, prev2];
    for (let i = 0, p = 0; p < N; i += 4, p++) cur[p] = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    frames++;
    if (t - reported > 0.5) {
      reported = t;
      onProgress(Math.min(0.99, t / v.duration));
    }
    if (frames < 2) return;

    let n = 0;
    let sx = 0;
    let sy = 0;
    let minX = SW;
    let maxX = 0;
    let minY = SH;
    let maxY = 0;
    let cn = 0;
    let csx = 0;
    let csy = 0;
    let reverted = 0;
    for (let p = 0; p < N; p++) {
      const changed = Math.abs(cur[p] - prev[p]) > T;
      if (!changed) continue;
      const x = p % SW;
      const y = (p / SW) | 0;
      n++;
      sx += x;
      sy += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (frames > 2) {
        if (Math.abs(cur[p] - prev2[p]) > T) {
          // Changed against both earlier frames: where the cursor is now.
          cn++;
          csx += x;
          csy += y;
        } else reverted++;
      }
    }
    const changed = n / N;
    const w = n ? (maxX - minX + 1) / SW : 0;
    const h = n ? (maxY - minY + 1) / SH : 0;
    let kind: Kind = "local";
    if (n < 3) kind = "idle";
    else if (changed > 0.04) {
      // Big change: a scroll if a shifted copy of the last frame explains it.
      const still = shiftScore(0);
      let best = still;
      for (let dy = -14; dy <= 14; dy++) {
        if (!dy) continue;
        const s = shiftScore(dy);
        if (s < best) best = s;
      }
      kind = best < still * 0.45 ? "scroll" : changed > 0.3 ? "page" : "local";
    } else if (changed < 0.004 && w * h < 0.05 && cn > 0 && reverted > n * 0.3) kind = "cursor";
    samples.push({
      t,
      kind,
      changed,
      x: n ? sx / n / SW : 0.5,
      y: n ? sy / n / SH : 0.5,
      w,
      h,
      cx: kind === "cursor" ? csx / cn / SW : -1,
      cy: kind === "cursor" ? csy / cn / SH : -1,
    });
  };

  // Fast enough to be quick, slow enough that the decoder shows every tenth
  // of a second. Each frame is labelled with its own timestamp, not the
  // playhead, which runs ahead when decoding falls behind.
  v.playbackRate = 3;
  const ended = new Promise<void>((r) => v.addEventListener("ended", () => r(), { once: true }));
  if (typeof v.requestVideoFrameCallback === "function") {
    const loop = (_: number, meta: VideoFrameCallbackMetadata) => {
      take(meta.mediaTime);
      if (!v.ended) v.requestVideoFrameCallback(loop);
    };
    v.requestVideoFrameCallback(loop);
  } else {
    const loop = () => {
      take(v.currentTime);
      if (!v.ended) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  await v.play();
  await ended;

  // Playback can skip stretches when decoding stalls; fill any gap by seeking.
  samples.sort((a, b) => a.t - b.t);
  const gaps: [number, number][] = [];
  let prevT = 0;
  for (const smp of samples) {
    if (smp.t - prevT > 0.35) gaps.push([prevT, smp.t]);
    prevT = smp.t;
  }
  if (v.duration - prevT > 0.35) gaps.push([prevT, v.duration - 0.05]);
  for (const [g0, g1] of gaps) {
    frames = 0;
    last = -1;
    for (let tt = Math.max(0, g0 - 0.2); tt < g1; tt += STEP) {
      await seek(v, tt);
      take(tt);
    }
  }
  samples.sort((a, b) => a.t - b.t);
  const out = { duration: v.duration, aspect: v.videoWidth / v.videoHeight, samples };
  v.removeAttribute("src");
  v.load();
  return out;
}

/** Speech, per tenth of a second, from the recording's own sound. */
async function analyzeVoice(blob: Blob, duration: number): Promise<{ voice: Uint8Array; hasAudio: boolean }> {
  const bins = Math.ceil(duration / STEP) + 1;
  const voice = new Uint8Array(bins);
  try {
    const ctx = new OfflineAudioContext(1, 1, 16000);
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const rate = buf.sampleRate;
    const per = Math.floor(rate * STEP);
    const chans = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
    const rms = new Float32Array(bins);
    for (let b = 0; b < bins; b++) {
      let sum = 0;
      const s0 = b * per;
      const s1 = Math.min(buf.length, s0 + per);
      for (let s = s0; s < s1; s += 4) {
        let v = 0;
        for (const ch of chans) v += ch[s];
        v /= chans.length;
        sum += v * v;
      }
      rms[b] = Math.sqrt(sum / Math.max(1, (s1 - s0) / 4));
    }
    const sorted = [...rms].sort((a, b) => a - b);
    const floor = sorted[Math.floor(sorted.length * 0.15)] ?? 0;
    const threshold = Math.max(0.01, floor * 3.5);
    for (let b = 0; b < bins; b++) voice[b] = rms[b] > threshold ? 1 : 0;
    // Fill the short gaps between words.
    for (let b = 0; b < bins; b++) {
      if (voice[b]) continue;
      let k = b;
      while (k < bins && !voice[k]) k++;
      if (b > 0 && voice[b - 1] && k < bins && k - b <= 5) voice.fill(1, b, k);
      b = k;
    }
    return { voice, hasAudio: sorted[sorted.length - 1] > 0.001 };
  } catch {
    return { voice, hasAudio: false };
  }
}

export async function analyze(blob: Blob, url: string, onProgress: (p: number) => void): Promise<Analysis> {
  const video = await analyzeVideo(url, (p) => onProgress(p * 0.9));
  const audio = await analyzeVoice(blob, video.duration);
  onProgress(1);
  return { ...video, ...audio };
}

export const voiceAt = (a: Analysis, t: number) => a.voice[Math.min(a.voice.length - 1, Math.max(0, Math.round(t / STEP)))] === 1;
