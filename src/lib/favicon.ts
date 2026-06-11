/**
 * Favicon package generation — resizes a source image into the full set of
 * icons a modern site needs, plus a manifest and paste-ready HTML.
 * All rendering is canvas-based and runs on-device.
 */

export interface FaviconOptions {
  /** Background behind the icon — "transparent" keeps PNG alpha. */
  background: string;
  /** Inset around the artwork, as a percentage of the icon (0–40). */
  padding: number;
  /** Corner rounding, as a percentage of the icon (0–50). */
  radius: number;
  /** App name used in the manifest and Apple title meta. */
  appName: string;
  /** Theme + manifest background colors. */
  themeColor: string;
}

export const DEFAULT_FAVICON: FaviconOptions = {
  background: "transparent",
  padding: 0,
  radius: 0,
  appName: "My App",
  themeColor: "#ffffff",
};

/** Sizes bundled into favicon.ico (multi-resolution). */
export const ICO_SIZES = [16, 32, 48];

/** Standalone PNG outputs: filename → pixel size. */
export const PNG_OUTPUTS: { name: string; size: number }[] = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "favicon-48x48.png", size: 48 },
  { name: "favicon-96x96.png", size: 96 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "web-app-manifest-192x192.png", size: 192 },
  { name: "web-app-manifest-512x512.png", size: 512 },
];

/** Sizes shown as live previews in the UI. */
export const PREVIEW_SIZES = [16, 32, 48, 180];

function roundedPath(ctx: CanvasRenderingContext2D, size: number, r: number) {
  const radius = Math.min(r, size / 2);
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arcTo(size, 0, size, size, radius);
  ctx.arcTo(size, size, 0, size, radius);
  ctx.arcTo(0, size, 0, 0, radius);
  ctx.arcTo(0, 0, size, 0, radius);
  ctx.closePath();
}

/**
 * Render the source onto a square canvas at `size`px, applying background,
 * padding and corner radius. Downscales in halving steps for crisp small icons.
 */
export function renderIcon(
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  size: number,
  opts: FaviconOptions
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const radius = (opts.radius / 100) * size;

  if (opts.background !== "transparent") {
    ctx.save();
    roundedPath(ctx, size, radius);
    ctx.clip();
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }

  const inset = (opts.padding / 100) * size;
  const box = size - inset * 2;
  const scale = Math.min(box / sourceW, box / sourceH);
  const drawW = sourceW * scale;
  const drawH = sourceH * scale;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;

  ctx.save();
  if (opts.background === "transparent" && radius > 0) {
    roundedPath(ctx, size, radius);
    ctx.clip();
  }

  // Stepped downscale: halve repeatedly toward the target for crisp small icons.
  const stepped = stepDownscale(source, sourceW, sourceH, drawW, drawH);
  ctx.drawImage(stepped, dx, dy, drawW, drawH);
  ctx.restore();

  return canvas;
}

function stepDownscale(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  targetW: number,
  targetH: number
): HTMLCanvasElement {
  let curW = sw;
  let curH = sh;
  let current = document.createElement("canvas");
  current.width = curW;
  current.height = curH;
  current.getContext("2d")!.drawImage(source, 0, 0, curW, curH);

  while (curW / 2 > targetW && curH / 2 > targetH) {
    const next = document.createElement("canvas");
    next.width = Math.floor(curW / 2);
    next.height = Math.floor(curH / 2);
    const nctx = next.getContext("2d")!;
    nctx.imageSmoothingEnabled = true;
    nctx.imageSmoothingQuality = "high";
    nctx.drawImage(current, 0, 0, next.width, next.height);
    current = next;
    curW = next.width;
    curH = next.height;
  }
  return current;
}

export function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("PNG encode failed"));
      blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
    }, "image/png");
  });
}

/**
 * Build a multi-resolution .ico that embeds PNG images (supported by all
 * modern browsers and Windows Vista+). Each entry points at a full PNG.
 */
export function buildIco(images: { size: number; png: Uint8Array<ArrayBuffer> }[]): Blob {
  const count = images.length;
  const headerSize = 6;
  const dirSize = 16 * count;
  let offset = headerSize + dirSize;

  const header = new Uint8Array(headerSize);
  const hv = new DataView(header.buffer);
  hv.setUint16(0, 0, true); // reserved
  hv.setUint16(2, 1, true); // type: icon
  hv.setUint16(4, count, true);

  const dir = new Uint8Array(dirSize);
  const dv = new DataView(dir.buffer);
  images.forEach((img, i) => {
    const o = i * 16;
    dir[o] = img.size >= 256 ? 0 : img.size; // width
    dir[o + 1] = img.size >= 256 ? 0 : img.size; // height
    dir[o + 2] = 0; // palette
    dir[o + 3] = 0; // reserved
    dv.setUint16(o + 4, 1, true); // color planes
    dv.setUint16(o + 6, 32, true); // bits per pixel
    dv.setUint32(o + 8, img.png.length, true); // size of PNG data
    dv.setUint32(o + 12, offset, true); // offset
    offset += img.png.length;
  });

  return new Blob([header, dir, ...images.map((i) => i.png)], { type: "image/x-icon" });
}

export function buildManifest(opts: FaviconOptions): string {
  return JSON.stringify(
    {
      name: opts.appName,
      short_name: opts.appName,
      icons: [
        { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      theme_color: opts.themeColor,
      background_color: opts.themeColor,
      display: "standalone",
    },
    null,
    2
  );
}

export function buildHtmlSnippet(opts: FaviconOptions, hasSvg: boolean): string {
  const lines = [
    `<link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />`,
    hasSvg ? `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` : null,
    `<link rel="shortcut icon" href="/favicon.ico" />`,
    `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />`,
    `<meta name="apple-mobile-web-app-title" content="${escapeHtml(opts.appName)}" />`,
    `<meta name="theme-color" content="${opts.themeColor}" />`,
    `<link rel="manifest" href="/site.webmanifest" />`,
  ].filter(Boolean);
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface FrameworkGuide {
  id: string;
  name: string;
  /** Plain-language instructions shown as a numbered list. */
  steps: string[];
  /** Code block to copy (HTML tags or framework config). */
  code: string;
  /** Language hint for the copy label. */
  codeLabel: string;
}

export function frameworkGuides(opts: FaviconOptions, hasSvg: boolean): FrameworkGuide[] {
  const html = buildHtmlSnippet(opts, hasSvg);
  const nextMetadata = [
    "export const metadata = {",
    "  manifest: '/site.webmanifest',",
    "  themeColor: '" + opts.themeColor + "',",
    "  appleWebApp: { title: '" + opts.appName.replace(/'/g, "\\'") + "' },",
    "  icons: {",
    "    icon: ['/favicon-96x96.png'" +
      (hasSvg ? ", { url: '/favicon.svg', type: 'image/svg+xml' }" : "") +
      "],",
    "    apple: '/apple-touch-icon.png',",
    "  },",
    "};",
  ].join("\n");

  return [
    {
      id: "html",
      name: "HTML",
      steps: [
        "Unzip the package into your website root, next to index.html, so icons are served from /.",
        "Paste these tags inside the <head> of every page.",
      ],
      code: html,
      codeLabel: "HTML",
    },
    {
      id: "nextjs",
      name: "Next.js",
      steps: [
        "App Router: drop favicon.ico into app/ — Next.js wires it up automatically.",
        "Copy the remaining PNGs, favicon.svg and site.webmanifest into public/.",
        "Add the rest through the Metadata API in app/layout.tsx.",
      ],
      code: nextMetadata,
      codeLabel: "metadata",
    },
    {
      id: "vite",
      name: "Vite / React",
      steps: [
        "Copy the whole package into your public/ folder.",
        "Paste these tags into index.html inside <head>.",
      ],
      code: html,
      codeLabel: "HTML",
    },
    {
      id: "nuxt",
      name: "Nuxt / Vue",
      steps: [
        "Copy the package into the public/ directory.",
        "Register the links under app.head.link in nuxt.config.ts, or paste the raw tags into index.html.",
      ],
      code: html,
      codeLabel: "HTML",
    },
    {
      id: "wordpress",
      name: "WordPress",
      steps: [
        "Upload the package to your site root via FTP or a file manager.",
        "Add the tags to your theme's header.php, or use a head-snippet plugin.",
      ],
      code: html,
      codeLabel: "HTML",
    },
  ];
}
