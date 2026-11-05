/**
 * Loading recordings and filmstrip thumbnails.
 */

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
