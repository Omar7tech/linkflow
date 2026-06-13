/**
 * 1D barcode engine. Encoding correctness is delegated to JsBarcode (the
 * de-facto standard, same spirit as using `qrcode` for QR), while everything
 * around it — smart format detection, validation messaging, crisp SVG/PNG
 * export and batch ZIP packaging — lives here. All on-device.
 *
 * JsBarcode is dynamically imported so it never touches `document` during SSR
 * and ships in its own chunk.
 */

export type BarcodeFormat =
  | "CODE128"
  | "CODE39"
  | "EAN13"
  | "EAN8"
  | "UPC"
  | "ITF14"
  | "codabar"
  | "pharmacode";

export interface BarcodeFormatMeta {
  id: BarcodeFormat;
  name: string;
  /** What it's for + what input it expects. */
  hint: string;
  sample: string;
}

export const BARCODE_FORMATS: BarcodeFormatMeta[] = [
  {
    id: "CODE128",
    name: "Code 128",
    hint: "Any letters or numbers — the universal default for labels and logistics.",
    sample: "FORMA-2026",
  },
  {
    id: "EAN13",
    name: "EAN-13",
    hint: "12–13 digits. Global retail products. The check digit is added for you.",
    sample: "5901234123457",
  },
  {
    id: "UPC",
    name: "UPC-A",
    hint: "11–12 digits. North American retail.",
    sample: "036000291452",
  },
  {
    id: "EAN8",
    name: "EAN-8",
    hint: "7–8 digits. Small packages where EAN-13 won't fit.",
    sample: "96385074",
  },
  {
    id: "ITF14",
    name: "ITF-14",
    hint: "14 digits. Shipping cartons and outer cases.",
    sample: "15400141288763",
  },
  {
    id: "CODE39",
    name: "Code 39",
    hint: "Uppercase, digits and - . $ / + % space. Common in industry and ID.",
    sample: "CODE-39",
  },
  {
    id: "codabar",
    name: "Codabar",
    hint: "Digits and - $ : / . + — libraries, blood banks, logistics.",
    sample: "A40156B",
  },
  {
    id: "pharmacode",
    name: "Pharmacode",
    hint: "A whole number from 3 to 131070. Pharmaceutical packing control.",
    sample: "1234",
  },
];

export const FORMAT_BY_ID = Object.fromEntries(
  BARCODE_FORMATS.map((f) => [f.id, f])
) as Record<BarcodeFormat, BarcodeFormatMeta>;

export interface BarcodeOptions {
  format: BarcodeFormat;
  lineColor: string;
  background: string;
  /** Transparent overrides `background` at render time. */
  transparent: boolean;
  /** Module (narrowest bar) width in px — controls density. */
  width: number;
  /** Bar height in px. */
  height: number;
  displayValue: boolean;
  fontSize: number;
  /** Quiet zone around the symbol, in px. */
  margin: number;
}

export const DEFAULT_BARCODE_OPTIONS: BarcodeOptions = {
  format: "CODE128",
  lineColor: "#0a0a0a",
  background: "#ffffff",
  transparent: false,
  width: 2,
  height: 100,
  displayValue: true,
  fontSize: 18,
  margin: 10,
};

/**
 * Pick the most likely format for a raw value. Pure digits map to the retail
 * symbology that fits their length; anything else falls back to Code 128,
 * which encodes the full ASCII range.
 */
export function detectFormat(value: string): BarcodeFormat {
  const v = value.trim();
  if (!v) return "CODE128";
  if (/^\d+$/.test(v)) {
    switch (v.length) {
      case 14:
        return "ITF14";
      case 13:
      case 12:
        return v.length === 12 ? "UPC" : "EAN13";
      case 7:
      case 8:
        return "EAN8";
      default:
        return "CODE128";
    }
  }
  return "CODE128";
}

type LibOptions = {
  format: string;
  lineColor: string;
  background: string;
  width: number;
  height: number;
  displayValue: boolean;
  fontSize: number;
  margin: number;
  valid: (v: boolean) => void;
};

function toLibOptions(o: BarcodeOptions, onValid: (v: boolean) => void, scale = 1): LibOptions {
  return {
    format: o.format,
    lineColor: o.lineColor,
    background: o.transparent ? "transparent" : o.background,
    width: Math.max(1, Math.round(o.width * scale)),
    height: Math.round(o.height * scale),
    displayValue: o.displayValue,
    fontSize: Math.round(o.fontSize * scale),
    margin: Math.round(o.margin * scale),
    valid: onValid,
  };
}

type JsBarcodeFn = typeof import("jsbarcode");
let jsbarcodeP: Promise<JsBarcodeFn> | null = null;

// `jsbarcode` uses `export =`, so the namespace may be the function itself or
// expose it under `.default` depending on the interop — normalise both.
function loadJsBarcode(): Promise<JsBarcodeFn> {
  jsbarcodeP ??= import("jsbarcode").then((mod) => {
    const m = mod as unknown as { default?: JsBarcodeFn };
    return (m.default ?? (mod as unknown as JsBarcodeFn)) as JsBarcodeFn;
  });
  return jsbarcodeP;
}

export interface RenderResult {
  svg: string | null;
  error: string | null;
}

/** Render to a standalone SVG string. Returns an error message if invalid. */
export async function renderToSvg(value: string, options: BarcodeOptions): Promise<RenderResult> {
  const trimmed = value.trim();
  if (!trimmed) return { svg: null, error: null };

  const JsBarcode = await loadJsBarcode();
  let ok = true;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, trimmed, toLibOptions(options, (v) => (ok = v)));
  } catch {
    ok = false;
  }
  if (!ok) return { svg: null, error: invalidMessage(options.format) };
  return { svg: new XMLSerializer().serializeToString(svg), error: null };
}

/** Render to a PNG data URL at the given pixel scale (≥1 = crisper). */
export async function renderToPng(
  value: string,
  options: BarcodeOptions,
  scale = 2
): Promise<RenderResult & { dataUrl: string | null }> {
  const trimmed = value.trim();
  if (!trimmed) return { svg: null, dataUrl: null, error: null };

  const JsBarcode = await loadJsBarcode();
  let ok = true;
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, trimmed, toLibOptions(options, (v) => (ok = v), scale));
  } catch {
    ok = false;
  }
  if (!ok) return { svg: null, dataUrl: null, error: invalidMessage(options.format) };
  return { svg: null, dataUrl: canvas.toDataURL("image/png"), error: null };
}

function invalidMessage(format: BarcodeFormat): string {
  const meta = FORMAT_BY_ID[format];
  return `Not valid for ${meta.name}. ${meta.hint}`;
}

export interface BatchResult {
  /** Object URL of the generated ZIP, or null if nothing was valid. */
  url: string | null;
  generated: number;
  /** Input values that failed validation and were left out. */
  skipped: string[];
}

/**
 * Render every value and pack the valid ones into a ZIP. Invalid values are
 * skipped and reported so the user knows exactly what didn't make it.
 */
export async function zipBarcodes(
  values: string[],
  options: BarcodeOptions,
  kind: "png" | "svg"
): Promise<BatchResult> {
  const mod = await import("jszip");
  const zip = new mod.default();
  const skipped: string[] = [];
  const used = new Map<string, number>();
  let generated = 0;

  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;

    // De-duplicate file names while keeping them readable.
    let base = safeName(value);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    if (seen > 0) base = `${base}-${seen + 1}`;

    if (kind === "svg") {
      const { svg } = await renderToSvg(value, options);
      if (!svg) {
        skipped.push(value);
        continue;
      }
      zip.file(`${base}.svg`, svg);
    } else {
      const { dataUrl } = await renderToPng(value, options);
      if (!dataUrl) {
        skipped.push(value);
        continue;
      }
      zip.file(`${base}.png`, dataUrl.split(",")[1], { base64: true });
    }
    generated++;
  }

  if (generated === 0) return { url: null, generated, skipped };
  const blob = await zip.generateAsync({ type: "blob" });
  return { url: URL.createObjectURL(blob), generated, skipped };
}

/** A filesystem-safe slug for naming exported files. */
export function safeName(value: string, fallback = "barcode"): string {
  const slug = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}
