/**
 * Motion posters to video. Frames are drawn first (each from the same SVG
 * renderer as the preview, fonts embedded), then played back at an exact
 * frame rate into the browser's recorder, so timing never stutters even when
 * a frame was slow to draw.
 */
import { LOOP } from "./generate";

export async function svgToImage(markup: string) {
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // The decoded image keeps its pixels; the URL can go.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function pickMime() {
  const options = ["video/mp4;codecs=avc1.640028", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

export async function recordLoop(
  frameAt: (t: number) => string,
  width: number,
  height: number,
  onProgress: (p: number) => void
): Promise<{ blob: Blob; ext: string }> {
  const fps = 30;
  const total = LOOP * fps;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // 1. Draw every frame and keep it as a compact JPEG.
  const frames: Blob[] = [];
  for (let i = 0; i < total; i++) {
    const img = await svgToImage(frameAt(i / fps));
    ctx.drawImage(img, 0, 0, width, height);
    frames.push(await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("frame"))), "image/jpeg", 0.92)));
    onProgress((i / total) * 0.6);
  }

  // 2. Play them back on the beat while the recorder runs.
  const mimeType = pickMime();
  if (!mimeType) throw new Error("This browser cannot record video.");
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 14_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (recorder.onstop = () => res()));

  const first = await createImageBitmap(frames[0]);
  ctx.drawImage(first, 0, 0);
  recorder.start();
  const start = performance.now();
  for (let i = 0; i < total; i++) {
    const bmp = await createImageBitmap(frames[i]);
    const due = start + (i * 1000) / fps;
    const wait = due - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    onProgress(0.6 + (i / total) * 0.4);
  }
  await new Promise((r) => setTimeout(r, 1000 / fps));
  recorder.stop();
  await done;
  stream.getTracks().forEach((track) => track.stop());
  const type = mimeType.split(";")[0];
  return { blob: new Blob(chunks, { type }), ext: type === "video/mp4" ? "mp4" : "webm" };
}
