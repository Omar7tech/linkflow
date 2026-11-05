/**
 * Exports. Video plays the edit through the renderer into the browser's
 * recorder with the original sound, so it takes as long as the edit itself.
 * GIF seeks frame by frame and encodes with the shared GIF encoder.
 */
import { encodeGif } from "@/lib/gif-encode";
import type { CameraPath } from "./camera";
import { loadVideo, seek } from "./media";
import { drawFrame } from "./render";
import { ASPECTS, type Edit } from "./types";

export function outputSize(aspect: Edit["style"]["aspect"], short: number) {
  const a = ASPECTS[aspect];
  const even = (n: number) => Math.round(n / 2) * 2;
  return a >= 1 ? { width: even(short * a), height: short } : { width: short, height: even(short / a) };
}

function pickMime() {
  const options = ["video/mp4;codecs=avc1.640033,mp4a.40.2", "video/mp4;codecs=avc1.640028", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export interface ExportJob {
  screenUrl: string;
  cameraUrl: string | null;
  wallpaper: HTMLImageElement | null;
  edit: Edit;
  path: CameraPath;
  short: number;
  onProgress: (p: number) => void;
  signal: AbortSignal;
}

export async function exportVideo(job: ExportJob): Promise<{ blob: Blob; ext: string }> {
  const { edit, path } = job;
  const { width, height } = outputSize(edit.style.aspect, job.short);
  const video = await loadVideo(job.screenUrl, false);
  const cam = job.cameraUrl && edit.style.bubble.show ? await loadVideo(job.cameraUrl) : null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Sound goes to the file only, not the speakers.
  const audio = new AudioContext();
  const dest = audio.createMediaStreamDestination();
  audio.createMediaElementSource(video).connect(dest);

  const mime = pickMime();
  if (!mime) throw new Error("This browser can't record video.");
  const stream = new MediaStream([...canvas.captureStream(60).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round((width * height) / 1e6) * 6_000_000 + 4_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));

  const { trimStart, trimEnd } = edit;
  await seek(video, trimStart);
  if (cam) await seek(cam, Math.min(trimStart, cam.duration - 0.05));
  const draw = () => drawFrame(ctx, width, height, { video, cam, wallpaper: job.wallpaper }, video.currentTime, path.at(video.currentTime), edit.style, edit.captions);
  draw();
  rec.start(500);
  await Promise.all([video.play(), cam?.play()]);

  await new Promise<void>((resolve) => {
    const tick = () => {
      if (job.signal.aborted || video.currentTime >= trimEnd || video.ended) {
        resolve();
        return;
      }
      // Keep the camera in step with the screen.
      if (cam && Math.abs(cam.currentTime - video.currentTime) > 0.12 && video.currentTime < cam.duration) cam.currentTime = video.currentTime;
      draw();
      job.onProgress((video.currentTime - trimStart) / (trimEnd - trimStart));
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
  if (job.signal.aborted) throw new DOMException("Export cancelled", "AbortError");
  const type = mime.split(";")[0];
  return { blob: new Blob(chunks, { type }), ext: type === "video/mp4" ? "mp4" : "webm" };
}

export const GIF_MAX_SECONDS = 20;

export async function exportGif(job: ExportJob): Promise<Blob> {
  const { edit, path } = job;
  const { width, height } = outputSize(edit.style.aspect, ASPECTS[edit.style.aspect] >= 1 ? 400 : 640 / (16 / 9));
  const fps = 12;
  const video = await loadVideo(job.screenUrl);
  const cam = job.cameraUrl && edit.style.bubble.show ? await loadVideo(job.cameraUrl) : null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const end = Math.min(edit.trimEnd, edit.trimStart + GIF_MAX_SECONDS);
  const count = Math.max(1, Math.floor((end - edit.trimStart) * fps));
  const frames: Uint8ClampedArray[] = [];
  for (let i = 0; i < count; i++) {
    if (job.signal.aborted) throw new DOMException("Export cancelled", "AbortError");
    const t = edit.trimStart + i / fps;
    await seek(video, t);
    if (cam) await seek(cam, Math.min(t, cam.duration - 0.05));
    drawFrame(ctx, width, height, { video, cam, wallpaper: job.wallpaper }, t, path.at(t), edit.style, edit.captions);
    frames.push(ctx.getImageData(0, 0, width, height).data);
    job.onProgress((i / count) * 0.85);
  }
  await new Promise((r) => setTimeout(r, 30));
  const bytes = encodeGif(frames, { width, height, delayMs: 1000 / fps, transparent: false });
  job.onProgress(1);
  return new Blob([bytes as BlobPart], { type: "image/gif" });
}
