/**
 * Blurred drawing for 2D canvases. Safari doesn't implement the canvas
 * `filter` property — assigning it is silently ignored and everything draws
 * sharp — so there the blur is done by hand: downscale, three box-blur passes
 * (≈ gaussian) over the pixels, scale back up.
 */

export const HAS_CANVAS_FILTER =
  typeof CanvasRenderingContext2D !== "undefined" && "filter" in CanvasRenderingContext2D.prototype;

// Fallback working size: the blur radius is brought down to ~3px and the
// buffer capped, so the per-pixel passes stay cheap enough to run every frame.
const TARGET_SIGMA = 3;
const MAX_PIXELS = 600_000;

let scratch: HTMLCanvasElement | null = null;
let bufA = new Float32Array(0);
let bufB = new Float32Array(0);

/** One running-sum box pass over every line of `a` into `b`; outside is transparent. */
function boxPass(
  a: Float32Array,
  b: Float32Array,
  lines: number,
  len: number,
  lineStep: number,
  pxStep: number,
  r: number
) {
  const inv = 1 / (2 * r + 1);
  for (let l = 0; l < lines; l++) {
    const base = l * lineStep;
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let i = 0; i <= r && i < len; i++) sum += a[base + i * pxStep + c];
      for (let i = 0; i < len; i++) {
        b[base + i * pxStep + c] = sum * inv;
        const add = i + r + 1;
        const sub = i - r;
        if (add < len) sum += a[base + add * pxStep + c];
        if (sub >= 0) sum -= a[base + sub * pxStep + c];
      }
    }
  }
}

function blurPixels(data: Uint8ClampedArray, w: number, h: number, r: number) {
  const n = w * h * 4;
  if (bufA.length < n) {
    bufA = new Float32Array(n);
    bufB = new Float32Array(n);
  }
  // Blur premultiplied, so transparent pixels don't drag color into the edges.
  for (let i = 0; i < n; i += 4) {
    const al = data[i + 3] / 255;
    bufA[i] = data[i] * al;
    bufA[i + 1] = data[i + 1] * al;
    bufA[i + 2] = data[i + 2] * al;
    bufA[i + 3] = data[i + 3];
  }
  for (let pass = 0; pass < 3; pass++) {
    boxPass(bufA, bufB, h, w, w * 4, 4, r);
    boxPass(bufB, bufA, w, h, 4, w * 4, r);
  }
  for (let i = 0; i < n; i += 4) {
    const al = bufA[i + 3];
    const k = al > 0 ? 255 / al : 0;
    data[i] = bufA[i] * k;
    data[i + 1] = bufA[i + 1] * k;
    data[i + 2] = bufA[i + 2] * k;
    data[i + 3] = al;
  }
}

/**
 * `ctx.drawImage(src, dx, dy, dw, dh)` with a gaussian blur of `blurPx`
 * (standard deviation, like CSS `blur()`). Honors the context's current
 * alpha, composite mode and clip.
 */
export function drawBlurred(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  blurPx: number
) {
  if (blurPx < 0.5) {
    ctx.drawImage(src, dx, dy, dw, dh);
    return;
  }
  if (HAS_CANVAS_FILTER) {
    const prev = ctx.filter;
    ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
    ctx.drawImage(src, dx, dy, dw, dh);
    ctx.filter = prev;
    return;
  }

  const k = Math.min(1, TARGET_SIGMA / blurPx, Math.sqrt(MAX_PIXELS / (dw * dh)));
  const sigma = blurPx * k;
  // Three box passes of radius r approximate a gaussian of this sigma.
  const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  const pad = r * 3;
  const iw = Math.max(1, Math.ceil(dw * k));
  const ih = Math.max(1, Math.ceil(dh * k));
  const cw = iw + pad * 2;
  const ch = ih + pad * 2;

  scratch ??= document.createElement("canvas");
  if (scratch.width !== cw || scratch.height !== ch) {
    scratch.width = cw;
    scratch.height = ch;
  }
  const g = scratch.getContext("2d", { willReadFrequently: true })!;
  g.clearRect(0, 0, cw, ch);
  g.drawImage(src, pad, pad, iw, ih);
  const img = g.getImageData(0, 0, cw, ch);
  blurPixels(img.data, cw, ch, r);
  g.putImageData(img, 0, 0);

  const ux = dw / iw;
  const uy = dh / ih;
  const enabled = ctx.imageSmoothingEnabled;
  const quality = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(scratch, dx - pad * ux, dy - pad * uy, cw * ux, ch * uy);
  ctx.imageSmoothingEnabled = enabled;
  ctx.imageSmoothingQuality = quality;
}
