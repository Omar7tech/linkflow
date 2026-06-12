/**
 * AI Saliency Mapping — uses a neural network to identify semantically 
 * important subjects. Uses the same RMBG-1.4 model as the background 
 * remover but extracts the raw probability map instead of a binary mask.
 */
import {
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
  type PreTrainedModel,
  type Processor,
} from "@huggingface/transformers";

// Internal helper for smoothing
function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius < 1) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const size = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += src[y * w + Math.min(Math.max(x, 0), w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / size;
      const add = Math.min(x + radius + 1, w - 1);
      const sub = Math.max(x - radius, 0);
      sum += src[y * w + add] - src[y * w + sub];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(Math.max(y, 0), h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / size;
      const add = Math.min(y + radius + 1, h - 1);
      const sub = Math.max(y - radius, 0);
      sum += tmp[add * w + x] - tmp[sub * w + x];
    }
  }
  return out;
}

export interface MlProgress {
  message: string;
  progress: number;
}

const MODEL_ID = "briaai/RMBG-1.4";

const MODEL_CONFIG = { model_type: "custom" };
const PROCESSOR_CONFIG = {
  do_normalize: true,
  do_pad: false,
  do_rescale: true,
  do_resize: true,
  image_mean: [0.5, 0.5, 0.5],
  image_std: [1, 1, 1],
  feature_extractor_type: "ImageFeatureExtractor",
  resample: 2,
  rescale_factor: 0.00392156862745098,
  size: { width: 1024, height: 1024 },
};

type Loaded = { model: PreTrainedModel; processor: Processor };
let loader: Promise<Loaded> | null = null;

async function loadModel(onProgress?: (p: MlProgress) => void): Promise<Loaded> {
  if (loader) return loader;
  env.allowLocalModels = false;

  const progressCallback = (e: { status: string; file?: string; progress?: number }) => {
    if (e.status === "progress" && e.file?.endsWith(".onnx")) {
      onProgress?.({
        message: "Downloading AI model (cached after first run)…",
        progress: Math.round(e.progress ?? 0),
      });
    }
  };

  const load = (device: "webgpu" | "wasm") =>
    Promise.all([
      AutoModel.from_pretrained(MODEL_ID, {
        config: MODEL_CONFIG as never,
        device,
        dtype: device === "webgpu" ? "fp32" : "q8",
        progress_callback: progressCallback as never,
      }),
      AutoProcessor.from_pretrained(MODEL_ID, {
        config: PROCESSOR_CONFIG as never,
        progress_callback: progressCallback as never,
      } as never),
    ]).then(([model, processor]) => ({ model, processor }) as Loaded);

  loader = (async () => {
    const preferred: "webgpu" | "wasm" =
      typeof navigator !== "undefined" && "gpu" in navigator ? "webgpu" : "wasm";
    try {
      return await load(preferred);
    } catch {
      if (preferred === "webgpu") return await load("wasm");
      throw new Error("Failed to load AI model");
    }
  })();
  return loader;
}

/**
 * Predicts saliency using a neural network.
 * Returns a Float32Array of 0-1 values at the requested resolution.
 */
export async function computeSaliencyAI(
  srcUrl: string,
  width: number,
  height: number,
  onProgress?: (p: MlProgress) => void
): Promise<Float32Array> {
  const { model, processor } = await loadModel(onProgress);
  onProgress?.({ message: "AI is analyzing visual hierarchy…", progress: -1 });

  const image = await RawImage.fromURL(srcUrl);
  const { pixel_values } = await processor(image);
  const { output } = await model({ input: pixel_values });
  
  // Resize the model output back to our working dimensions
  const mask = await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(
    width,
    height
  );

  const saliency = new Float32Array(width * height);
  for (let i = 0; i < mask.data.length; i++) {
    saliency[i] = mask.data[i] / 255;
  }
  
  return saliency;
}
