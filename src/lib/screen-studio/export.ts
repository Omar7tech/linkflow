/**
 * Exports.
 *
 * Video, fast path: the recording plays at double speed (and faster still
 * through sped-up stretches) while every new frame is drawn and handed to
 * the hardware H.264 encoder with its exact output time. Sound is decoded
 * once, cut to match the edit, evened out and encoded separately, then both
 * go into an MP4. Most edits export in well under their running time.
 *
 * Browsers without WebCodecs fall back to recording the canvas in real time.
 */
import type { CameraPath } from "./camera";
import { loadVideo, seek } from "./media";
import { Mp4Writer } from "./mp4";
import { drawFrame } from "./render";
import type { TimeMap } from "./timemap";
import { ASPECTS, type Edit } from "./types";

export function outputSize(aspect: Edit["style"]["aspect"], short: number) {
  const a = ASPECTS[aspect];
  const even = (n: number) => Math.round(n / 2) * 2;
  return a >= 1 ? { width: even(short * a), height: short } : { width: short, height: even(short / a) };
}

export interface ExportJob {
  screen: Blob;
  screenUrl: string;
  cameraUrl: string | null;
  wallpaper: HTMLImageElement | null;
  edit: Edit;
  path: CameraPath;
  map: TimeMap;
  short: number;
  onProgress: (p: number) => void;
  signal: AbortSignal;
}

const aborted = () => new DOMException("Export cancelled", "AbortError");

/* ----------------------------------------------------------------- audio */

const SR = 48000;

/** The edit's soundtrack: cut and compressed in time like the picture, levelled and faded. */
async function buildSoundtrack(job: ExportJob): Promise<Float32Array[] | null> {
  let buf: AudioBuffer;
  try {
    buf = await new OfflineAudioContext(2, 1, SR).decodeAudioData(await job.screen.arrayBuffer());
  } catch {
    return null;
  }
  const chans = buf.numberOfChannels > 1 ? [buf.getChannelData(0), buf.getChannelData(1)] : [buf.getChannelData(0), buf.getChannelData(0)];
  const total = Math.ceil(job.map.duration * SR);
  const out = [new Float32Array(total), new Float32Array(total)];
  const fade = Math.round(0.012 * SR);
  for (const p of job.map.pieces) {
    const o0 = Math.round(p.o0 * SR);
    if (p.rate !== 1) continue; // Sped-up dead time stays silent.
    const s0 = Math.round(p.s0 * SR);
    const n = Math.min(Math.round((p.s1 - p.s0) * SR), total - o0, buf.length - s0);
    for (let c = 0; c < 2; c++) {
      const src = chans[c];
      const dst = out[c];
      for (let i = 0; i < n; i++) {
        // Short fades at every cut, so joins never click.
        const g = Math.min(1, i / fade, (n - i) / fade);
        dst[o0 + i] = src[s0 + i] * g;
      }
    }
  }
  if (job.edit.style.cleanAudio) {
    // Level the voice: bring the loud half of the sound to a steady level.
    const block = 2048;
    const levels: number[] = [];
    for (let i = 0; i + block < total; i += block) {
      let s = 0;
      for (let k = 0; k < block; k += 2) s += out[0][i + k] ** 2 + out[1][i + k] ** 2;
      levels.push(Math.sqrt(s / block));
    }
    levels.sort((a, b) => a - b);
    const loud = levels[Math.floor(levels.length * 0.75)] ?? 0;
    if (loud > 0.002) {
      const gain = Math.min(6, Math.max(0.5, 0.12 / loud));
      const fadeIn = Math.round(0.15 * SR);
      const fadeOut = Math.round(0.5 * SR);
      for (let c = 0; c < 2; c++) {
        const d = out[c];
        for (let i = 0; i < total; i++) {
          let x = d[i] * gain;
          // Soft limiter: transparent below 0.8, rounds off peaks above.
          const ax = Math.abs(x);
          if (ax > 0.8) x = Math.sign(x) * (0.8 + 0.2 * Math.tanh((ax - 0.8) / 0.2));
          d[i] = x * Math.min(1, i / fadeIn, (total - i) / fadeOut);
        }
      }
    }
  }
  return out;
}

async function pickAudioCodec(): Promise<{ codec: "aac" | "opus"; config: AudioEncoderConfig } | null> {
  if (typeof AudioEncoder === "undefined") return null;
  const aac = { codec: "mp4a.40.2", sampleRate: SR, numberOfChannels: 2, bitrate: 160_000 };
  if ((await AudioEncoder.isConfigSupported(aac).catch(() => null))?.supported) return { codec: "aac", config: aac };
  const opus = { codec: "opus", sampleRate: SR, numberOfChannels: 2, bitrate: 128_000 };
  if ((await AudioEncoder.isConfigSupported(opus).catch(() => null))?.supported) return { codec: "opus", config: opus };
  return null;
}

async function encodeAudio(pcm: Float32Array[], codec: { codec: "aac" | "opus"; config: AudioEncoderConfig }, mux: Mp4Writer) {
  const encoder = new AudioEncoder({ output: (c, m) => mux.addAudio(c, m), error: (e) => console.error(e) });
  encoder.configure(codec.config);
  const frame = 1024;
  const total = pcm[0].length;
  for (let i = 0; i < total; i += frame) {
    const n = Math.min(frame, total - i);
    const data = new Float32Array(n * 2);
    data.set(pcm[0].subarray(i, i + n), 0);
    data.set(pcm[1].subarray(i, i + n), n);
    const ad = new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / SR) * 1e6), data });
    encoder.encode(ad);
    ad.close();
    if (encoder.encodeQueueSize > 32) await new Promise((r) => setTimeout(r, 0));
  }
  await encoder.flush();
  encoder.close();
}

/* ----------------------------------------------------------------- video */

async function pickVideoCodec(width: number, height: number, fps: number) {
  if (typeof VideoEncoder === "undefined") return null;
  const bitrate = Math.round(width * height * fps * 0.14);
  for (const codec of ["avc1.640033", "avc1.640032", "avc1.64002A", "avc1.640028", "avc1.4D0033", "avc1.42003E"]) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps, latencyMode: "realtime", avc: { format: "avc" } };
    const res = await VideoEncoder.isConfigSupported(config).catch(() => null);
    if (res?.supported) return config;
  }
  return null;
}

export const canExportFast = () => typeof VideoEncoder !== "undefined" && typeof HTMLVideoElement !== "undefined" && "requestVideoFrameCallback" in HTMLVideoElement.prototype;

async function exportFast(job: ExportJob, config: VideoEncoderConfig): Promise<{ blob: Blob; ext: string }> {
  const { edit, path, map } = job;
  const { width, height } = config;
  const audioCodec = await pickAudioCodec();
  const pcm = audioCodec ? await buildSoundtrack(job) : null;
  const mux = new Mp4Writer({ width, height, audio: pcm && audioCodec ? { codec: audioCodec.codec, sampleRate: SR, channels: 2 } : undefined });

  let failure: Error | null = null;
  const encoder = new VideoEncoder({ output: (c, m) => mux.addVideo(c, m), error: (e) => (failure = e as Error) });
  encoder.configure(config);

  const video = await loadVideo(job.screenUrl);
  const cam = job.cameraUrl && edit.style.bubble.show ? await loadVideo(job.cameraUrl) : null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  await seek(video, edit.trimStart);
  if (cam) await seek(cam, Math.min(edit.trimStart, cam.duration - 0.05));

  const SPEED = 2;
  const minGap = 1 / 60 - 0.002;
  let lastOut = -1;
  let lastKey = -10;
  const sources = { video, cam, wallpaper: job.wallpaper };

  const emit = (t: number) => {
    const out = map.toOut(t);
    if (out - lastOut < minGap && lastOut >= 0) return;
    lastOut = out;
    drawFrame(ctx, width, height, sources, { t, out, outDuration: map.duration }, path.at(t), edit.style, edit.captions, edit.clicks);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(out * 1e6) });
    const key = out - lastKey >= 2;
    if (key) lastKey = out;
    encoder.encode(frame, { keyFrame: key });
    frame.close();
  };

  // Draw the opening frame exactly, then let playback deliver the rest.
  emit(edit.trimStart);
  await new Promise<void>((resolve, reject) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.pause();
      cam?.pause();
      resolve();
    };
    const step = (_now: number, meta: VideoFrameCallbackMetadata) => {
      if (done) return;
      if (job.signal.aborted) {
        done = true;
        video.pause();
        reject(aborted());
        return;
      }
      if (failure) {
        done = true;
        reject(failure);
        return;
      }
      const t = meta.mediaTime;
      if (t >= edit.trimEnd - 0.001) return finish();
      const rate = Math.min(16, SPEED * map.rateAt(t));
      if (video.playbackRate !== rate) {
        video.playbackRate = rate;
        if (cam) cam.playbackRate = rate;
      }
      if (cam && Math.abs(cam.currentTime - t) > 0.2 && t < cam.duration) cam.currentTime = t;
      emit(t);
      job.onProgress(((t - edit.trimStart) / (edit.trimEnd - edit.trimStart)) * (pcm ? 0.9 : 0.98));
      // Let the encoder catch up if it falls behind.
      if (encoder.encodeQueueSize > 8) {
        video.pause();
        cam?.pause();
        const wait = () => (encoder.encodeQueueSize > 2 ? setTimeout(wait, 5) : Promise.all([video.play(), cam?.play()]));
        wait();
      }
      video.requestVideoFrameCallback(step);
    };
    video.addEventListener("ended", finish, { once: true });
    video.requestVideoFrameCallback(step);
    video.playbackRate = SPEED;
    if (cam) cam.playbackRate = SPEED;
    Promise.all([video.play(), cam?.play()]).catch(reject);
  });
  // The closing frame, so the video runs to the very end of the edit.
  await seek(video, Math.max(edit.trimStart, edit.trimEnd - 0.02));
  emit(edit.trimEnd - 0.02);
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;

  if (pcm && audioCodec) {
    job.onProgress(0.93);
    await encodeAudio(pcm, audioCodec, mux);
  }
  job.onProgress(1);
  video.removeAttribute("src");
  video.load();
  return { blob: mux.finish(), ext: "mp4" };
}

/** Real-time fallback for browsers without WebCodecs. */
async function exportRealtime(job: ExportJob): Promise<{ blob: Blob; ext: string }> {
  const { edit, path, map } = job;
  const { width, height } = outputSize(edit.style.aspect, job.short);
  const video = await loadVideo(job.screenUrl, false);
  const cam = job.cameraUrl && edit.style.bubble.show ? await loadVideo(job.cameraUrl) : null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const audio = new AudioContext();
  const dest = audio.createMediaStreamDestination();
  const gain = audio.createGain();
  audio.createMediaElementSource(video).connect(gain).connect(dest);
  const mime = ["video/mp4;codecs=avc1.640033,mp4a.40.2", "video/mp4;codecs=avc1.640028", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error("This browser can't export MP4. Try Chrome, Edge or Safari.");
  const stream = new MediaStream([...canvas.captureStream(60).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 16_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  await seek(video, edit.trimStart);
  const draw = () => {
    const t = video.currentTime;
    drawFrame(ctx, width, height, { video, cam, wallpaper: job.wallpaper }, { t, out: map.toOut(t), outDuration: map.duration }, path.at(t), edit.style, edit.captions, edit.clicks);
  };
  draw();
  rec.start(500);
  await Promise.all([video.play(), cam?.play()]);
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (job.signal.aborted || video.currentTime >= edit.trimEnd || video.ended) return resolve();
      const rate = map.rateAt(video.currentTime);
      if (video.playbackRate !== rate) {
        video.playbackRate = rate;
        if (cam) cam.playbackRate = rate;
        gain.gain.value = rate > 1 ? 0 : 1;
      }
      if (cam && Math.abs(cam.currentTime - video.currentTime) > 0.15 && video.currentTime < cam.duration) cam.currentTime = video.currentTime;
      draw();
      job.onProgress(map.toOut(video.currentTime) / map.duration);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  video.pause();
  cam?.pause();
  rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  audio.close();
  if (job.signal.aborted) throw aborted();
  return { blob: new Blob(chunks, { type: "video/mp4" }), ext: "mp4" };
}

export async function exportVideo(job: ExportJob): Promise<{ blob: Blob; ext: string; fast: boolean }> {
  const { width, height } = outputSize(job.edit.style.aspect, job.short);
  const config = canExportFast() ? await pickVideoCodec(width, height, 60) : null;
  if (config) return { ...(await exportFast(job, config)), fast: true };
  return { ...(await exportRealtime(job)), fast: false };
}
