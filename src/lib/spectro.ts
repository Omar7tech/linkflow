/**
 * Spectrogram-art engine: paint an image with sound.
 *
 * Encoding treats a grayscale grid as a score — each row is a sine
 * oscillator at a fixed frequency, each column a moment in time, and pixel
 * brightness drives that oscillator's amplitude. Render the result through
 * any spectrogram and the picture reappears. Decoding is a plain STFT
 * (Hann window + radix-2 FFT) drawn with a dB colormap.
 */

export const SAMPLE_RATE = 44100;

export interface SynthOptions {
  /** Seconds of audio to render. */
  duration: number;
  /** Frequency of the bottom image row (Hz). */
  fMin: number;
  /** Frequency of the top image row (Hz). */
  fMax: number;
}

/**
 * Additive synthesis of a brightness grid (row 0 = top = highest pitch).
 * Uses per-row phase rotators (complex recurrence) instead of Math.sin —
 * ~10x faster, which keeps regeneration real-time as the user types.
 */
export function synthesize(
  grid: Float32Array,
  rows: number,
  cols: number,
  { duration, fMin, fMax }: SynthOptions
): Float32Array<ArrayBuffer> {
  const n = Math.max(1, Math.round(duration * SAMPLE_RATE));
  const out = new Float32Array(n);
  const samplesPerCol = n / cols;

  for (let r = 0; r < rows; r++) {
    const rowOffset = r * cols;
    let active = false;
    for (let c = 0; c < cols; c++) {
      if (grid[rowOffset + c] > 0.004) {
        active = true;
        break;
      }
    }
    if (!active) continue;

    const freq = rows === 1 ? fMax : fMax - ((fMax - fMin) * r) / (rows - 1);
    const step = (2 * Math.PI * freq) / SAMPLE_RATE;
    const stepCos = Math.cos(step);
    const stepSin = Math.sin(step);
    // Random start phase per row so peaks don't stack into one huge transient.
    const phase = Math.random() * 2 * Math.PI;
    let oscCos = Math.cos(phase);
    let oscSin = Math.sin(phase);

    for (let i = 0; i < n; i++) {
      // Linear interpolation between column centers avoids clicky amplitude steps.
      const pos = i / samplesPerCol - 0.5;
      const c0 = Math.floor(pos);
      const frac = pos - c0;
      const a0 = c0 < 0 ? 0 : grid[rowOffset + Math.min(c0, cols - 1)];
      const a1 = grid[rowOffset + Math.min(Math.max(c0 + 1, 0), cols - 1)];
      const amp = a0 + (a1 - a0) * frac;

      if (amp > 0.002) out[i] += amp * oscSin;

      const nextCos = oscCos * stepCos - oscSin * stepSin;
      oscSin = oscSin * stepCos + oscCos * stepSin;
      oscCos = nextCos;
    }
  }

  // Normalize to a safe peak, with a short fade at both ends.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const gain = peak > 0 ? 0.89 / peak : 0;
  const fade = Math.min(Math.floor(SAMPLE_RATE * 0.012), n >> 1);
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (i < fade) env = i / fade;
    else if (i >= n - fade) env = (n - 1 - i) / fade;
    out[i] *= gain * env;
  }
  return out;
}

/** Encode mono float samples as a 16-bit PCM WAV blob. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** In-place iterative radix-2 FFT. Lengths must be a power of two. */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const aRe = re[i + j];
        const aIm = im[i + j];
        const bRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const bIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
        re[i + j] = aRe + bRe;
        im[i + j] = aIm + bIm;
        re[i + j + len / 2] = aRe - bRe;
        im[i + j + len / 2] = aIm - bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

export interface Spectrogram {
  /** Row-major intensities in [0, 1]; row 0 = highest displayed frequency. */
  intensity: Float32Array;
  width: number;
  height: number;
  /** Highest frequency shown (Hz). */
  maxFreq: number;
}

/**
 * Short-time Fourier transform → normalized dB intensities, ready to paint.
 * Only bins up to `maxFreq` are kept so hidden art fills the canvas.
 */
export function computeSpectrogram(
  samples: Float32Array,
  sampleRate: number,
  maxFreq: number,
  fftSize = 2048
): Spectrogram {
  const hop = fftSize / 4;
  const frames = Math.max(1, Math.floor((samples.length - fftSize) / hop) + 1);
  const nyquist = sampleRate / 2;
  const cappedFreq = Math.min(maxFreq, nyquist);
  const bins = Math.max(8, Math.min(fftSize / 2, Math.round((fftSize / 2) * (cappedFreq / nyquist))));

  const window = new Float64Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  const intensity = new Float32Array(frames * bins);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  let maxDb = -Infinity;
  const db = new Float32Array(frames * bins);

  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    for (let i = 0; i < fftSize; i++) {
      re[i] = (samples[start + i] ?? 0) * window[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < bins; b++) {
      const mag = Math.hypot(re[b], im[b]);
      const v = 20 * Math.log10(mag + 1e-7);
      db[f * bins + b] = v;
      if (v > maxDb) maxDb = v;
    }
  }

  const floor = 68; // dB of dynamic range to display
  for (let f = 0; f < frames; f++) {
    for (let b = 0; b < bins; b++) {
      const t = (db[f * bins + b] - maxDb + floor) / floor;
      // Row 0 = top of image = highest frequency bin.
      intensity[(bins - 1 - b) * frames + f] = Math.max(0, Math.min(1, t));
    }
  }

  return { intensity, width: frames, height: bins, maxFreq: (bins / (fftSize / 2)) * nyquist };
}

/** Emerald-on-ink colormap: silent = near-black, loud = white-hot green. */
function colormap(t: number): [number, number, number] {
  if (t < 0.55) {
    const k = t / 0.55;
    // #071410 → #10b981
    return [7 + k * 9, 20 + k * 165, 16 + k * 113];
  }
  const k = (t - 0.55) / 0.45;
  // #10b981 → #eafff6
  return [16 + k * 218, 185 + k * 70, 129 + k * 117];
}

/** Paint a spectrogram into ImageData (1 px per STFT cell). */
export function spectrogramToImageData(spec: Spectrogram): ImageData {
  const { intensity, width, height } = spec;
  const img = new ImageData(width, height);
  const data = img.data;
  for (let i = 0; i < intensity.length; i++) {
    // Mild gamma lift so faint tones stay visible.
    const [r, g, b] = colormap(Math.pow(intensity[i], 1.35));
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  }
  return img;
}
