/**
 * GIF89a encoder — median-cut palette, LZW compression, animation with a
 * NETSCAPE looping extension and 1-bit transparency.
 *
 * Hand-rolled for the same reason `zip.ts` is: the job is small, well-specified
 * and completely deterministic, and a library would be an order of magnitude
 * more bytes than the ~300 lines it actually takes. Nothing here touches the
 * network or the DOM, so the same input always produces the same file.
 *
 * Frames arrive as raw RGBA. One palette is computed across every frame so
 * colours don't shift between them — per-frame palettes are the usual cause of
 * that cheap flickering look in generated GIFs.
 */

/** Alpha at or below this becomes the transparent index. GIF has no blending. */
const ALPHA_CUTOFF = 128;

interface Box {
  pixels: number[]; // indices into the sample array, ×3
  rMin: number;
  rMax: number;
  gMin: number;
  gMax: number;
  bMin: number;
  bMax: number;
}

/* ------------------------------ quantisation ------------------------------ */

function boxOf(samples: Uint8Array, pixels: number[]): Box {
  let rMin = 255,
    rMax = 0,
    gMin = 255,
    gMax = 0,
    bMin = 255,
    bMax = 0;
  for (const p of pixels) {
    const r = samples[p];
    const g = samples[p + 1];
    const b = samples[p + 2];
    if (r < rMin) rMin = r;
    if (r > rMax) rMax = r;
    if (g < gMin) gMin = g;
    if (g > gMax) gMax = g;
    if (b < bMin) bMin = b;
    if (b > bMax) bMax = b;
  }
  return { pixels, rMin, rMax, gMin, gMax, bMin, bMax };
}

/**
 * Median cut: repeatedly split the box with the widest colour spread at the
 * median of its longest axis. Cheap, stable, and good enough that logos and
 * gradients survive the trip down to 255 colours.
 */
function medianCut(samples: Uint8Array, maxColors: number): Uint8Array {
  const all: number[] = [];
  for (let i = 0; i < samples.length; i += 3) all.push(i);
  if (!all.length) return new Uint8Array([0, 0, 0]);

  const boxes: Box[] = [boxOf(samples, all)];
  while (boxes.length < maxColors) {
    // Pick the box worth splitting: widest single-channel range, >1 pixel.
    let target = -1;
    let best = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.pixels.length < 2) continue;
      const range = Math.max(b.rMax - b.rMin, b.gMax - b.gMin, b.bMax - b.bMin);
      if (range > best) {
        best = range;
        target = i;
      }
    }
    if (target < 0 || best === 0) break;

    const box = boxes[target];
    const rRange = box.rMax - box.rMin;
    const gRange = box.gMax - box.gMin;
    const bRange = box.bMax - box.bMin;
    const axis = rRange >= gRange && rRange >= bRange ? 0 : gRange >= bRange ? 1 : 2;
    const sorted = [...box.pixels].sort((a, b) => samples[a + axis] - samples[b + axis]);
    const mid = sorted.length >> 1;
    boxes.splice(target, 1, boxOf(samples, sorted.slice(0, mid)), boxOf(samples, sorted.slice(mid)));
  }

  const palette = new Uint8Array(boxes.length * 3);
  boxes.forEach((box, i) => {
    let r = 0,
      g = 0,
      b = 0;
    for (const p of box.pixels) {
      r += samples[p];
      g += samples[p + 1];
      b += samples[p + 2];
    }
    const n = box.pixels.length || 1;
    palette[i * 3] = Math.round(r / n);
    palette[i * 3 + 1] = Math.round(g / n);
    palette[i * 3 + 2] = Math.round(b / n);
  });
  return palette;
}

/** Nearest palette entry, memoised on the colour rounded to 5 bits per channel. */
function makeMatcher(palette: Uint8Array): (r: number, g: number, b: number) => number {
  const cache = new Map<number, number>();
  const count = palette.length / 3;
  return (r, g, b) => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < count; i++) {
      const dr = r - palette[i * 3];
      const dg = g - palette[i * 3 + 1];
      const db = b - palette[i * 3 + 2];
      // Weighted to rough human sensitivity — greens matter most.
      const d = dr * dr * 3 + dg * dg * 6 + db * db;
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
        if (d === 0) break;
      }
    }
    cache.set(key, bestIndex);
    return bestIndex;
  };
}

/* --------------------------------- LZW ----------------------------------- */

/** Packs codes LSB-first into GIF's 255-byte sub-blocks. */
class BitWriter {
  private bytes: number[] = [];
  private current = 0;
  private bits = 0;

  write(code: number, size: number) {
    this.current |= code << this.bits;
    this.bits += size;
    while (this.bits >= 8) {
      this.bytes.push(this.current & 0xff);
      this.current >>= 8;
      this.bits -= 8;
    }
  }

  finish(): number[] {
    if (this.bits > 0) this.bytes.push(this.current & 0xff);
    this.current = 0;
    this.bits = 0;
    return this.bytes;
  }
}

function lzwCompress(indices: Uint8Array, minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const writer = new BitWriter();

  let dict = new Map<number, number>();
  let next = endCode + 1;
  let codeSize = minCodeSize + 1;

  const reset = () => {
    dict = new Map();
    next = endCode + 1;
    codeSize = minCodeSize + 1;
  };

  writer.write(clearCode, codeSize);
  reset();

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const char = indices[i];
    // Key packs prefix and char into one number — Map<number> beats string keys.
    const key = prefix * 4096 + char;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    writer.write(prefix, codeSize);
    if (next < 4096) {
      dict.set(key, next++);
      if (next - 1 === (1 << codeSize) && codeSize < 12) codeSize++;
    } else {
      writer.write(clearCode, codeSize);
      reset();
    }
    prefix = char;
  }
  writer.write(prefix, codeSize);
  writer.write(endCode, codeSize);
  return writer.finish();
}

/* -------------------------------- assembly -------------------------------- */

class ByteBuffer {
  private parts: number[] = [];
  byte(v: number) {
    this.parts.push(v & 0xff);
  }
  short(v: number) {
    this.parts.push(v & 0xff, (v >> 8) & 0xff);
  }
  string(v: string) {
    for (let i = 0; i < v.length; i++) this.parts.push(v.charCodeAt(i) & 0xff);
  }
  bytes(v: ArrayLike<number>) {
    for (let i = 0; i < v.length; i++) this.parts.push(v[i] & 0xff);
  }
  /** GIF payloads ship as length-prefixed chunks of at most 255 bytes. */
  subBlocks(data: number[]) {
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255);
      this.parts.push(chunk.length);
      this.bytes(chunk);
    }
    this.parts.push(0);
  }
  toUint8(): Uint8Array {
    return new Uint8Array(this.parts);
  }
}

export interface GifOptions {
  width: number;
  height: number;
  /** Per-frame delay in milliseconds. GIF stores hundredths, so it rounds. */
  delayMs: number;
  /** Keep pixels below the alpha cutoff see-through. */
  transparent?: boolean;
  /** 0 = forever. */
  loops?: number;
}

/**
 * Encodes RGBA frames into an animated GIF. Every frame must be
 * `width * height * 4` bytes.
 */
export function encodeGif(frames: Uint8ClampedArray[], options: GifOptions): Uint8Array {
  const { width, height, delayMs, transparent = true, loops = 0 } = options;
  if (!frames.length) throw new Error("encodeGif needs at least one frame");

  // Sample opaque pixels across every frame for one shared palette. A stride
  // keeps this fast on large canvases without changing the colours chosen.
  const pixelCount = width * height;
  const stride = Math.max(1, Math.floor((pixelCount * frames.length) / 24_000));
  const sample: number[] = [];
  for (const frame of frames) {
    for (let p = 0; p < pixelCount; p += stride) {
      const i = p * 4;
      if (transparent && frame[i + 3] < ALPHA_CUTOFF) continue;
      sample.push(frame[i], frame[i + 1], frame[i + 2]);
    }
  }
  // A fully transparent animation still needs one entry to point at.
  if (!sample.length) sample.push(0, 0, 0);

  const reserved = transparent ? 1 : 0;
  const palette = medianCut(new Uint8Array(sample), 256 - reserved);
  const colorCount = palette.length / 3;
  const transparentIndex = transparent ? colorCount : -1;
  const totalColors = colorCount + reserved;

  // GIF colour tables are a power of two, minimum 2 entries.
  let tableBits = 1;
  while (1 << tableBits < totalColors) tableBits++;
  const tableSize = 1 << tableBits;

  const match = makeMatcher(palette);
  const out = new ByteBuffer();

  out.string("GIF89a");
  out.short(width);
  out.short(height);
  out.byte(0x80 | (tableBits - 1)); // global table present, depth
  out.byte(0); // background index
  out.byte(0); // pixel aspect ratio
  for (let i = 0; i < tableSize; i++) {
    out.byte(palette[i * 3] ?? 0);
    out.byte(palette[i * 3 + 1] ?? 0);
    out.byte(palette[i * 3 + 2] ?? 0);
  }

  if (frames.length > 1) {
    out.byte(0x21);
    out.byte(0xff);
    out.byte(11);
    out.string("NETSCAPE2.0");
    out.byte(3);
    out.byte(1);
    out.short(loops);
    out.byte(0);
  }

  const delayCs = Math.max(1, Math.round(delayMs / 10));
  // Disposal 2 (restore to background) so transparent frames don't smear.
  const disposal = transparent ? 2 : 1;
  const minCodeSize = Math.max(2, tableBits);

  for (const frame of frames) {
    const indices = new Uint8Array(pixelCount);
    for (let p = 0; p < pixelCount; p++) {
      const i = p * 4;
      indices[p] =
        transparent && frame[i + 3] < ALPHA_CUTOFF
          ? transparentIndex
          : match(frame[i], frame[i + 1], frame[i + 2]);
    }

    out.byte(0x21); // graphic control extension
    out.byte(0xf9);
    out.byte(4);
    out.byte((disposal << 2) | (transparent ? 1 : 0));
    out.short(delayCs);
    out.byte(transparent ? transparentIndex : 0);
    out.byte(0);

    out.byte(0x2c); // image descriptor
    out.short(0);
    out.short(0);
    out.short(width);
    out.short(height);
    out.byte(0); // no local table, not interlaced

    out.byte(minCodeSize);
    out.subBlocks(lzwCompress(indices, minCodeSize));
  }

  out.byte(0x3b); // trailer
  return out.toUint8();
}
