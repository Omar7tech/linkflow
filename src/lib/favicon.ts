/**
 * Favicon package generation.
 *
 * An icon is a small design — artwork (an image, a few letters or an emoji) on
 * an optional backdrop inside a shape — rendered at every size a site needs.
 * Each size is drawn large and halved down, which keeps 16px icons crisp, and
 * every output comes from the same function so the preview is the download.
 */

export type ArtKind = "image" | "text" | "emoji";
export type Backdrop = "none" | "solid" | "gradient";
export type DarkMode = "same" | "invert" | "custom";
export type FontId = "sans" | "display" | "mono" | "serif";

export interface FaviconDesign {
  kind: ArtKind;
  /** Letters mode: one to three characters. */
  text: string;
  font: FontId;
  weight: 500 | 700 | 900;
  textColor: string;
  emoji: string;
  /** Image mode: fit inside the shape, or fill it edge to edge. */
  fit: "contain" | "cover";
  backdrop: Backdrop;
  bgColor: string;
  bgColor2: string;
  bgAngle: number;
  /** Corner rounding as a percentage of the icon. 50 is a circle. */
  radius: number;
  /** Space around the artwork as a percentage of the icon (0–40). */
  padding: number;
  /** Vertical nudge for the artwork, percentage of the icon (−20–20). */
  offsetY: number;
  /** What tabs in a dark browser theme get. */
  dark: DarkMode;
  darkBg: string;
  darkText: string;
  appName: string;
  shortName: string;
  themeColor: string;
  /** Splash and home-screen backdrop; also fills icons that must be opaque. */
  pageColor: string;
  /** Folder the files are served from. */
  path: string;
}

export const DEFAULT_FAVICON: FaviconDesign = {
  kind: "text",
  text: "M",
  font: "display",
  weight: 700,
  textColor: "#ffffff",
  emoji: "🚀",
  fit: "contain",
  backdrop: "gradient",
  bgColor: "#10b981",
  bgColor2: "#0f766e",
  bgAngle: 135,
  radius: 24,
  padding: 14,
  offsetY: 0,
  dark: "same",
  darkBg: "#0b1220",
  darkText: "#34d399",
  appName: "My App",
  shortName: "",
  themeColor: "#10b981",
  pageColor: "#ffffff",
  path: "/",
};

export interface FaviconSource {
  image: CanvasImageSource;
  width: number;
  height: number;
  name: string;
  /** Original markup when the upload was an SVG. */
  svgText: string | null;
}

export interface Variant {
  /** The version shown on dark browser themes. */
  dark?: boolean;
  /** Full-bleed, opaque, artwork inside the safe zone: what Android crops into its own shapes. */
  maskable?: boolean;
  /** Fill anything still transparent with this colour (Apple shows black otherwise). */
  opaque?: string;
}

export const FONTS: { id: FontId; name: string; family: string }[] = [
  { id: "display", name: "Display", family: "--font-space-grotesk" },
  { id: "sans", name: "Sans", family: "--font-geist-sans" },
  { id: "mono", name: "Mono", family: "--font-geist-mono" },
  { id: "serif", name: "Serif", family: "Georgia, 'Times New Roman', serif" },
];

const EMOJI_FAMILY = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
const SYSTEM_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Sizes bundled into favicon.ico. */
export const ICO_SIZES = [16, 32, 48];
/** Sizes offered for a single PNG download. */
export const PNG_SIZES = [16, 32, 48, 64, 96, 128, 180, 192, 256, 512, 1024];
/** Artwork stays inside this share of a maskable icon so no launcher shape crops it. */
const MASK_INSET = 0.17;
/** Small icons are drawn at least this large, then halved down. */
const WORK_SIZE = 256;

/* ------------------------------------------------------------------ drawing */

/** Resolves a CSS variable holding a font family (how next/font exposes them) to a canvas-ready family. */
function resolveFamily(value: string): string {
  if (!value.startsWith("--") || typeof document === "undefined") return value;
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(value).trim() ||
    getComputedStyle(document.body).getPropertyValue(value).trim();
  return resolved ? `${resolved}, ${SYSTEM_FAMILY}` : SYSTEM_FAMILY;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return [canvas, ctx];
}

function shapePath(ctx: CanvasRenderingContext2D, size: number, radiusPercent: number) {
  const radius = Math.min(size / 2, (radiusPercent / 100) * size);
  ctx.beginPath();
  if (radius <= 0) ctx.rect(0, 0, size, size);
  else ctx.roundRect(0, 0, size, size, radius);
}

function paintBackdrop(ctx: CanvasRenderingContext2D, size: number, design: FaviconDesign, variant: Variant) {
  const customDark = variant.dark && design.dark === "custom";
  let mode: Backdrop = customDark ? "solid" : design.backdrop;
  let color = customDark ? design.darkBg : design.bgColor;
  if (mode === "none" && variant.maskable) {
    mode = "solid";
    color = design.pageColor;
  }
  if (mode === "none") return;
  if (mode === "gradient") {
    const angle = ((design.bgAngle - 90) * Math.PI) / 180;
    const half = size / 2;
    const reach = (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle))) * half;
    const gradient = ctx.createLinearGradient(
      half - Math.cos(angle) * reach, half - Math.sin(angle) * reach,
      half + Math.cos(angle) * reach, half + Math.sin(angle) * reach,
    );
    gradient.addColorStop(0, design.bgColor);
    gradient.addColorStop(1, design.bgColor2);
    ctx.fillStyle = gradient;
  } else ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
}

/** Draws a glyph so its inked area, not its line box, is what gets centred and sized. */
function paintGlyph(ctx: CanvasRenderingContext2D, text: string, font: string, color: string, box: number, cx: number, cy: number) {
  ctx.font = font.replace("{size}", "200");
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const metrics = ctx.measureText(text);
  const left = metrics.actualBoundingBoxLeft;
  const width = left + metrics.actualBoundingBoxRight;
  const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  if (width <= 0 || height <= 0) return;
  const scale = Math.min(box / width, box / height);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fillText(text, left - width / 2, metrics.actualBoundingBoxAscent - height / 2);
  ctx.restore();
}

function paintArt(size: number, design: FaviconDesign, source: FaviconSource | null, variant: Variant): HTMLCanvasElement {
  const [layer, ctx] = makeCanvas(size);
  const padding = Math.max(design.padding / 100, variant.maskable ? MASK_INSET : 0);
  const box = size * (1 - padding * 2);
  const cx = size / 2;
  const cy = size / 2 + (design.offsetY / 100) * size;

  if (design.kind === "image") {
    if (source) {
      const cover = design.fit === "cover" && !variant.maskable;
      const scale = (cover ? Math.max : Math.min)(box / source.width, box / source.height);
      const w = source.width * scale;
      const h = source.height * scale;
      if (cover) {
        ctx.beginPath();
        ctx.rect(cx - box / 2, cy - box / 2, box, box);
        ctx.clip();
      }
      ctx.drawImage(source.image, cx - w / 2, cy - h / 2, w, h);
    }
  } else if (design.kind === "emoji") {
    paintGlyph(ctx, design.emoji || "🙂", `{size}px ${EMOJI_FAMILY}`, "#000000", box, cx, cy);
  } else {
    const family = resolveFamily(FONTS.find((font) => font.id === design.font)?.family ?? SYSTEM_FAMILY);
    const color = variant.dark && design.dark === "custom" ? design.darkText : design.textColor;
    paintGlyph(ctx, design.text.trim() || "?", `${design.weight} {size}px ${family}`, color, box, cx, cy);
  }

  if (variant.dark && design.dark === "invert") {
    const pixels = ctx.getImageData(0, 0, size, size);
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    ctx.putImageData(pixels, 0, 0);
  }
  return layer;
}

function halveTo(canvas: HTMLCanvasElement, size: number): HTMLCanvasElement {
  let current = canvas;
  while (current.width / 2 >= size) {
    const [next, ctx] = makeCanvas(current.width / 2);
    ctx.drawImage(current, 0, 0, next.width, next.height);
    current = next;
  }
  if (current.width === size) return current;
  const [out, ctx] = makeCanvas(size);
  ctx.drawImage(current, 0, 0, size, size);
  return out;
}

/** The icon at `size` pixels. */
export function renderIcon(design: FaviconDesign, source: FaviconSource | null, size: number, variant: Variant = {}): HTMLCanvasElement {
  // A power-of-two multiple of the target, so halving lands exactly on it.
  let work = size;
  while (work < WORK_SIZE) work *= 2;
  const [canvas, ctx] = makeCanvas(work);

  if (variant.opaque) {
    ctx.fillStyle = variant.opaque;
    ctx.fillRect(0, 0, work, work);
  }
  ctx.save();
  shapePath(ctx, work, variant.maskable ? 0 : design.radius);
  ctx.clip();
  paintBackdrop(ctx, work, design, variant);
  ctx.drawImage(paintArt(work, design, source, variant), 0, 0);
  ctx.restore();

  return halveTo(canvas, size);
}

/* ---------------------------------------------------------------- encoding */

export function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("PNG encode failed"));
      blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
    }, "image/png");
  });
}

/**
 * A multi-resolution .ico holding PNG images, which every current browser and
 * Windows since Vista reads. Each directory entry points at a whole PNG.
 */
export function buildIco(images: { size: number; png: Uint8Array<ArrayBuffer> }[]): Uint8Array<ArrayBuffer> {
  const headerSize = 6 + 16 * images.length;
  const total = headerSize + images.reduce((sum, image) => sum + image.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, images.length, true);
  let offset = headerSize;
  images.forEach((image, index) => {
    const at = 6 + index * 16;
    out[at] = image.size >= 256 ? 0 : image.size;
    out[at + 1] = image.size >= 256 ? 0 : image.size;
    view.setUint16(at + 4, 1, true); // colour planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, image.png.length, true);
    view.setUint32(at + 12, offset, true);
    out.set(image.png, offset);
    offset += image.png.length;
  });
  return out;
}

/** True when the upload can be shipped as favicon.svg untouched: nothing in the design changes how it looks. */
const isPlainSvg = (design: FaviconDesign, source: FaviconSource | null) =>
  design.kind === "image" && !!source?.svgText && design.backdrop === "none" && design.radius === 0 &&
  design.padding === 0 && design.offsetY === 0 && design.dark === "same";

/**
 * favicon.svg, when there is a reason to ship one: either the original vector
 * artwork, or a wrapper that swaps to the dark version when the browser theme
 * is dark. Null when a PNG says everything there is to say.
 */
export function buildSvg(design: FaviconDesign, source: FaviconSource | null): string | null {
  if (isPlainSvg(design, source)) return source!.svgText;
  if (design.dark === "same") return null;
  const size = 128;
  const light = renderIcon(design, source, size).toDataURL("image/png");
  const dark = renderIcon(design, source, size, { dark: true }).toDataURL("image/png");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    `<style>.d{display:none}@media (prefers-color-scheme:dark){.l{display:none}.d{display:inline}}</style>`,
    `<image class="l" width="${size}" height="${size}" href="${light}"/>`,
    `<image class="d" width="${size}" height="${size}" href="${dark}"/>`,
    `</svg>`,
  ].join("");
}

/** The one-tag emoji favicon: no files at all. Only meaningful for a bare emoji. */
export function emojiTag(design: FaviconDesign): string | null {
  if (design.kind !== "emoji" || design.backdrop !== "none" || !design.emoji.trim()) return null;
  const svg = `<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${design.emoji.trim()}</text></svg>`;
  return `<link rel="icon" href="data:image/svg+xml,${svg}" />`;
}

/* ----------------------------------------------------------------- package */

export interface PackageFile {
  name: string;
  /** Plain-language purpose, shown next to the file. */
  role: string;
}

/** Every file in the download, in the order a person would read about them. */
export function packageFiles(design: FaviconDesign, source: FaviconSource | null): PackageFile[] {
  const svg = isPlainSvg(design, source) ? "Your original vector artwork, sharp at any size" : design.dark !== "same" ? "Switches to the dark version on dark browser themes" : "";
  return [
    { name: "favicon.ico", role: "16, 32 and 48px in one file. The fallback every browser understands" },
    ...(svg ? [{ name: "favicon.svg", role: svg }] : []),
    { name: "favicon-96x96.png", role: "Browser tabs, bookmarks and search results" },
    { name: "apple-touch-icon.png", role: "iPhone and iPad home screen, 180px, no transparency" },
    { name: "web-app-manifest-192x192.png", role: "Android home screen and install prompt" },
    { name: "web-app-manifest-512x512.png", role: "Android splash screen" },
    { name: "maskable-192x192.png", role: "Android adaptive icon, safe to crop into any shape" },
    { name: "maskable-512x512.png", role: "Android adaptive icon, large" },
    { name: "site.webmanifest", role: "Name, colours and icon list for installable sites" },
    { name: "README.txt", role: "Where the files go and the tags to paste" },
  ];
}

/** Normalises the folder the files are served from to "/", "/assets/" and so on. */
export function basePath(design: FaviconDesign): string {
  const trimmed = design.path.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
}

export function buildManifest(design: FaviconDesign): string {
  const base = basePath(design);
  const name = design.appName.trim() || "My App";
  return JSON.stringify(
    {
      name,
      short_name: design.shortName.trim() || name,
      icons: [
        { src: `${base}web-app-manifest-192x192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: `${base}web-app-manifest-512x512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: `${base}maskable-192x192.png`, sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: `${base}maskable-512x512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      theme_color: design.themeColor,
      background_color: design.pageColor,
      display: "standalone",
    },
    null,
    2,
  );
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildHtmlSnippet(design: FaviconDesign, hasSvg: boolean): string {
  const base = basePath(design);
  return [
    `<link rel="icon" type="image/png" href="${base}favicon-96x96.png" sizes="96x96" />`,
    hasSvg ? `<link rel="icon" type="image/svg+xml" href="${base}favicon.svg" />` : null,
    `<link rel="shortcut icon" href="${base}favicon.ico" />`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${base}apple-touch-icon.png" />`,
    `<meta name="apple-mobile-web-app-title" content="${escapeHtml(design.shortName.trim() || design.appName.trim() || "My App")}" />`,
    `<meta name="theme-color" content="${design.themeColor}" />`,
    `<link rel="manifest" href="${base}site.webmanifest" />`,
  ].filter(Boolean).join("\n");
}

/** Renders and encodes the whole package. */
export async function buildPackage(design: FaviconDesign, source: FaviconSource | null): Promise<{ name: string; data: Uint8Array }[]> {
  const png = (size: number, variant?: Variant) => canvasToPngBytes(renderIcon(design, source, size, variant));
  const text = (value: string) => new TextEncoder().encode(value);
  const svg = buildSvg(design, source);
  const ico = buildIco(await Promise.all(ICO_SIZES.map(async (size) => ({ size, png: await png(size) }))));
  const base = basePath(design);

  const files: { name: string; data: Uint8Array }[] = [{ name: "favicon.ico", data: ico }];
  if (svg) files.push({ name: "favicon.svg", data: text(svg) });
  files.push(
    { name: "favicon-96x96.png", data: await png(96) },
    { name: "apple-touch-icon.png", data: await png(180, { opaque: design.pageColor }) },
    { name: "web-app-manifest-192x192.png", data: await png(192) },
    { name: "web-app-manifest-512x512.png", data: await png(512) },
    { name: "maskable-192x192.png", data: await png(192, { maskable: true }) },
    { name: "maskable-512x512.png", data: await png(512, { maskable: true }) },
    { name: "site.webmanifest", data: text(buildManifest(design)) },
    {
      name: "README.txt",
      data: text([
        "Favicon package",
        "",
        `1. Copy every file in this folder to ${base === "/" ? "the root of your site" : `${base} on your site`}.`,
        "2. Paste these tags inside <head> on every page:",
        "",
        buildHtmlSnippet(design, !!svg),
        "",
        "favicon.ico also works with no tag at all when it sits at the root of the site.",
      ].join("\n")),
    },
  );
  return files;
}

/* ------------------------------------------------------------------ checks */

export interface FaviconCheck {
  level: "good" | "warn";
  title: string;
  detail: string;
}

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (r: number, g: number, b: number) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

type Rgb = [number, number, number];

/** A pixel counts as seen when it stands this far from the surface behind it. */
const SEEN = 2;
/** Below this share of the square, the icon reads as a smudge or as nothing. */
const FAINT = 0.07;

/**
 * How much of an icon is inked, and how much of it actually shows against a
 * surface. Counted pixel by pixel, so dark letters on a dark backdrop still
 * pass on a dark tab as long as the letters themselves stand out.
 */
function visibility(icon: HTMLCanvasElement, surface: Rgb) {
  const { data } = icon.getContext("2d")!.getImageData(0, 0, icon.width, icon.height);
  const behind = luminance(...surface);
  let inked = 0;
  let seen = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.1) continue;
    inked += alpha;
    const mix = (channelValue: number, base: number) => channelValue * alpha + base * (1 - alpha);
    const shown = luminance(mix(data[i], surface[0]), mix(data[i + 1], surface[1]), mix(data[i + 2], surface[2]));
    if (ratio(shown, behind) >= SEEN) seen += 1;
  }
  const total = icon.width * icon.height;
  return { coverage: inked / total, seen: seen / total };
}

const hexRgb = (hex: string): Rgb => {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.slice(1), 16) : 0xffffff;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const LIGHT_TAB: Rgb = [255, 255, 255];
const DARK_TAB: Rgb = [53, 54, 58];

/** Things worth knowing before shipping the icon, measured on the 16px render that tabs actually show. */
export function checkFavicon(design: FaviconDesign, source: FaviconSource | null): FaviconCheck[] {
  const found: FaviconCheck[] = [];
  const light = visibility(renderIcon(design, source, 16), LIGHT_TAB);
  const dark = visibility(renderIcon(design, source, 16, { dark: true }), DARK_TAB);

  if (design.kind === "image" && source) {
    const smallest = Math.min(source.width, source.height);
    if (!source.svgText && smallest < 192) {
      found.push({ level: "warn", title: "The source image is small", detail: `${source.width}×${source.height}px will look soft on phone home screens. 512px or larger is ideal.` });
    }
    const shape = source.width / source.height;
    if (design.fit === "contain" && (shape > 1.35 || shape < 0.74)) {
      found.push({ level: "warn", title: "The image is not square", detail: "A wide or tall image leaves empty bands. Try Fill the shape, or upload just the symbol without the wordmark." });
    }
  }
  if (design.kind === "text" && [...design.text.trim()].length > 2) {
    found.push({ level: "warn", title: "Three characters is a squeeze", detail: "At 16px each letter gets about four pixels. One or two letters stay readable." });
  }
  if (light.coverage < 0.12) {
    found.push({ level: "warn", title: "The icon is thin at tab size", detail: "Very little of the 16px square is filled. Reduce the padding or add a backdrop." });
  }
  if (light.seen < FAINT) {
    found.push({ level: "warn", title: "Faint on light tabs", detail: "The icon is close to white. A backdrop colour or darker artwork fixes it." });
  }
  if (dark.seen < FAINT) {
    found.push({
      level: "warn",
      title: "Faint on dark tabs",
      detail: design.dark === "same"
        ? "The icon nearly disappears on a dark browser theme. Add a backdrop, or turn on a dark version below."
        : "The dark version is still close to the tab colour. Pick lighter colours for it.",
    });
  }
  if (design.backdrop === "none") {
    // Phones fill transparency with the background colour, so that is the surface that matters there.
    const phone = visibility(renderIcon(design, source, 32), hexRgb(design.pageColor));
    if (phone.seen < FAINT) {
      found.push({ level: "warn", title: "Disappears on phone home screens", detail: "iOS and Android fill transparency with your background colour, and the artwork is the same colour. Change the background colour under Site details." });
    } else if (design.kind !== "emoji") {
      found.push({ level: "good", title: "Phone icons get a solid backdrop", detail: "iOS and Android do not show transparency, so those files are filled with your background colour." });
    }
  }
  if (!found.some((check) => check.level === "warn")) {
    found.unshift({ level: "good", title: "Readable at tab size", detail: "Clear on both light and dark browser themes at 16px." });
  }
  return found;
}

/* ------------------------------------------------------------------ guides */

export interface FrameworkGuide {
  id: string;
  name: string;
  steps: string[];
  code: string;
}

export function frameworkGuides(design: FaviconDesign, hasSvg: boolean): FrameworkGuide[] {
  const html = buildHtmlSnippet(design, hasSvg);
  const base = basePath(design);
  const where = base === "/" ? "public/" : `public${base}`;
  const quote = (value: string) => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const nextMetadata = [
    "import type { Metadata, Viewport } from 'next';",
    "",
    "export const metadata: Metadata = {",
    `  manifest: '${base}site.webmanifest',`,
    `  appleWebApp: { title: '${quote(design.shortName.trim() || design.appName.trim() || "My App")}' },`,
    "  icons: {",
    "    icon: [",
    `      { url: '${base}favicon-96x96.png', sizes: '96x96', type: 'image/png' },`,
    ...(hasSvg ? [`      { url: '${base}favicon.svg', type: 'image/svg+xml' },`] : []),
    "    ],",
    `    shortcut: '${base}favicon.ico',`,
    `    apple: '${base}apple-touch-icon.png',`,
    "  },",
    "};",
    "",
    "export const viewport: Viewport = {",
    `  themeColor: '${design.themeColor}',`,
    "};",
  ].join("\n");

  return [
    {
      id: "html",
      name: "HTML",
      steps: [
        `Unzip the package into ${base === "/" ? "your website root, next to index.html" : `the ${base} folder of your site`}.`,
        "Paste these tags inside the <head> of every page.",
      ],
      code: html,
    },
    {
      id: "nextjs",
      name: "Next.js",
      steps: [
        `Copy every file into ${where}.`,
        "Remove any favicon.ico or icon file in app/ so the two do not compete.",
        "Add this to app/layout.tsx.",
      ],
      code: nextMetadata,
    },
    {
      id: "vite",
      name: "Vite / React",
      steps: [`Copy the package into ${where}.`, "Paste these tags into index.html inside <head>."],
      code: html,
    },
    {
      id: "nuxt",
      name: "Nuxt / Vue",
      steps: [`Copy the package into ${where}.`, "Register the links under app.head in nuxt.config.ts, or paste the raw tags into app.html."],
      code: html,
    },
    {
      id: "wordpress",
      name: "WordPress",
      steps: [
        `Upload the files to ${base === "/" ? "your site root" : base} with FTP or your host's file manager.`,
        "Add the tags to your theme's header.php, or use a header-snippet plugin.",
      ],
      code: html,
    },
  ];
}
