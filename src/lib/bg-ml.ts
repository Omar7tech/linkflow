/**
 * AI background removal — briaai/RMBG-1.4 running fully in the browser via
 * Transformers.js. WebGPU when available, WASM otherwise. The model (~44MB)
 * downloads once and is cached by the browser for offline reuse.
 *
 * Loaded only via dynamic import so none of this lands in the page bundle.
 */
import {
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
  type PreTrainedModel,
  type Processor,
} from "@huggingface/transformers";

export interface MlProgress {
  message: string;
  /** 0–100 when known, -1 for indeterminate. */
  progress: number;
}

const MODEL_ID = "briaai/RMBG-1.4";

// The RMBG-1.4 repo predates standard configs — these mirror the model card.
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

function loadModel(onProgress?: (p: MlProgress) => void): Promise<Loaded> {
  if (loader) return loader;

  env.allowLocalModels = false;

  const progressCallback = (e: { status: string; file?: string; progress?: number }) => {
    if (e.status === "progress" && e.file?.endsWith(".onnx")) {
      onProgress?.({
        message: "Downloading the AI model — once only, then it's cached…",
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
    } catch (err) {
      if (preferred === "webgpu") return await load("wasm");
      throw err;
    }
  })().catch((err) => {
    loader = null; // allow a retry after a failed load
    throw err;
  });
  return loader;
}

/**
 * Free the loaded model and its GPU/WASM buffers, reclaiming the hundreds of
 * MB it holds. Safe to call when nothing is loaded. The ~44MB weights stay in
 * the browser's HTTP cache, so the next load is fast.
 */
export async function disposeModel(): Promise<void> {
  if (!loader) return;
  const pending = loader;
  loader = null;
  try {
    const { model } = await pending;
    await model.dispose?.();
  } catch {
    // Load never finished or already disposed — nothing to reclaim.
  }
}

/**
 * Run the segmentation model and apply its alpha mask onto the original
 * pixels. Returns a new ImageData with a transparent background.
 */
export async function removeBackgroundAI(
  original: ImageData,
  srcUrl: string,
  onProgress?: (p: MlProgress) => void
): Promise<ImageData> {
  const { model, processor } = await loadModel(onProgress);
  onProgress?.({ message: "Analyzing the image…", progress: -1 });

  const image = await RawImage.fromURL(srcUrl);
  const { pixel_values } = await processor(image);
  const { output } = await model({ input: pixel_values });
  const mask = await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(
    original.width,
    original.height
  );

  const out = new ImageData(
    new Uint8ClampedArray(original.data),
    original.width,
    original.height
  );
  for (let i = 0; i < mask.data.length; i++) {
    out.data[i * 4 + 3] = mask.data[i];
  }
  return out;
}
