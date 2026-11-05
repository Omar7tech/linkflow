/**
 * Poster → SVG markup, at any moment of its motion loop. One renderer serves
 * the live preview, thumbnails, every export and each video frame, so what
 * you see is exactly what you get.
 */
import { FONT_BY_ID } from "./fonts";
import { LOOP, animTransform, fontsOf, type El, type Poster } from "./generate";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => Math.round(v * 100) / 100;

export interface RenderOptions {
  /** Seconds into the loop; 0 = still. */
  t?: number;
  showGrid?: boolean;
  /** Inline @font-face rules (exports). */
  fontCss?: string;
  /** Explicit width/height attributes, e.g. "297mm" or "1080". */
  width?: string;
  height?: string;
  /** Prefix for ids, so several posters can share a page. */
  uid?: string;
  className?: string;
}

function wavePath(el: Extract<El, { k: "wave" }>, t: number) {
  const phase = (t / LOOP) * Math.PI * 2;
  const steps = 90;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = el.x0 + ((el.x1 - el.x0) * i) / steps;
    const d2 = ((x - el.bulge.x) ** 2 + (el.y - el.bulge.y) ** 2) / el.bulge.r ** 2;
    const fall = Math.exp(-d2);
    const off = el.amp * (0.12 + fall) * Math.sin((x / el.len) * Math.PI * 2 + phase);
    const y = el.y + off;
    top.push(`${n(x)} ${n(y)}`);
    bottom.push(`${n(x)} ${n(y + el.h * (1 + fall * 0.9))}`);
  }
  return `M${top.join(" L")} L${bottom.reverse().join(" L")} Z`;
}

export function posterToSvg(poster: Poster, opts: RenderOptions = {}): string {
  const t = opts.t ?? 0;
  const uid = opts.uid ?? "p";
  const { head, body } = fontsOf(poster);
  const mono = FONT_BY_ID.mono;
  const out: string[] = [];
  const defs: string[] = [];
  let ring = 0;

  const transform = (el: { t?: string; anim?: El["anim"] }) => {
    const parts = [el.t, animTransform(el.anim, t)].filter(Boolean).join(" ");
    return parts ? ` transform="${parts}"` : "";
  };

  const textAttrs = (el: Extract<El, { k: "text" }>) => {
    const family = el.role === "mono" ? mono.family : el.role === "body" ? body.family : head.family;
    const attrs = [
      `x="${n(el.x)}"`,
      `y="${n(el.y)}"`,
      `font-size="${n(el.size)}"`,
      `font-weight="${el.weight}"`,
      `font-family='${family}'`,
      `fill="${el.fill}"`,
    ];
    if (el.stroke) attrs.push(`stroke="${el.stroke}"`, `stroke-width="${n(el.sw ?? 0.3)}"`);
    if (el.anchor && el.anchor !== "start") attrs.push(`text-anchor="${el.anchor}"`);
    if (el.tracking) attrs.push(`letter-spacing="${n(el.tracking * el.size)}"`);
    if (el.fit) attrs.push(`textLength="${n(el.fit)}"`, `lengthAdjust="spacingAndGlyphs"`);
    return attrs.join(" ");
  };

  const draw = (el: El): string => {
    const tr =
      transform(el) +
      (el.o !== undefined && el.o < 1 ? ` opacity="${el.o}"` : "") +
      (el.blend ? ` style="mix-blend-mode:${el.blend}"` : "");
    switch (el.k) {
      case "rect":
        return `<rect x="${n(el.x)}" y="${n(el.y)}" width="${n(el.w)}" height="${n(el.h)}" fill="${el.fill}"${el.stroke ? ` stroke="${el.stroke}" stroke-width="${n(el.sw ?? 0.3)}"` : ""}${tr}/>`;
      case "circle":
        return `<circle cx="${n(el.cx)}" cy="${n(el.cy)}" r="${n(el.r)}" fill="${el.fill ?? "none"}"${el.stroke ? ` stroke="${el.stroke}" stroke-width="${n(el.sw ?? 0.3)}"` : ""}${tr}/>`;
      case "path":
        return `<path d="${el.d}" fill="${el.fill ?? "none"}"${el.stroke ? ` stroke="${el.stroke}" stroke-width="${n(el.sw ?? 0.3)}"` : ""}${tr}/>`;
      case "line":
        return `<line x1="${n(el.x1)}" y1="${n(el.y1)}" x2="${n(el.x2)}" y2="${n(el.y2)}" stroke="${el.stroke}" stroke-width="${n(el.sw)}"${tr}/>`;
      case "text":
        return `<text ${textAttrs(el)}${tr}>${esc(el.text)}</text>`;
      case "ring": {
        const id = `${uid}-ring${ring++}`;
        const { cx, cy, r } = el;
        defs.push(`<path id="${id}" d="M${n(cx - r)} ${n(cy)} a${n(r)} ${n(r)} 0 1 1 ${n(2 * r)} 0 a${n(r)} ${n(r)} 0 1 1 ${n(-2 * r)} 0"/>`);
        return `<text font-size="${n(el.size)}" font-weight="${el.weight}" font-family='${head.family}' fill="${el.fill}"${el.tracking ? ` letter-spacing="${n(el.tracking * el.size)}"` : ""}${tr}><textPath href="#${id}">${esc(el.text)}</textPath></text>`;
      }
      case "wave":
        return `<path d="${wavePath(el, t)}" fill="${el.fill}"/>`;
      case "image":
        return `<image href="${el.href}" x="${n(el.x)}" y="${n(el.y)}" width="${n(el.w)}" height="${n(el.h)}" preserveAspectRatio="none"${el.clip ? ` clip-path="url(#${uid}-${el.clip})"` : ""}${tr}/>`;
      case "group":
        return `<g${el.clip ? ` clip-path="url(#${uid}-${el.clip})"` : ""}${tr}>${el.children.map(draw).join("")}</g>`;
    }
  };

  const body2 = poster.els.map(draw).join("");
  for (const clip of poster.clips) {
    const shape = clip.shape;
    // Clip shapes are drawn without motion; text clips keep their font.
    const still = { ...shape, anim: undefined } as El;
    defs.push(`<clipPath id="${uid}-${clip.id}">${draw(still)}</clipPath>`);
  }

  if (opts.showGrid) {
    const g = poster.grid;
    for (let i = 0; i < g.cols; i++)
      out.push(
        `<rect x="${n(g.m + i * (g.colW + g.gutter))}" y="${n(g.m)}" width="${n(g.colW)}" height="${n(poster.h - 2 * g.m)}" fill="rgb(0 200 255 / 0.12)" stroke="rgb(0 170 255 / 0.55)" stroke-width="${n(poster.w * 0.0008)}"/>`
      );
  }

  const size = `${opts.width ? ` width="${opts.width}"` : ""}${opts.height ? ` height="${opts.height}"` : ""}`;
  const style = opts.fontCss ? `<style>${opts.fontCss}</style>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(poster.w)} ${n(poster.h)}"${size}${opts.className ? ` class="${opts.className}"` : ""}>` +
    `<defs>${style}${defs.join("")}</defs>` +
    `<rect width="${n(poster.w)}" height="${n(poster.h)}" fill="${poster.bg}"/>` +
    body2 +
    out.join("") +
    `</svg>`
  );
}
