/**
 * Typefaces for the poster studio: a curated set that suits the Swiss style,
 * from neo-grotesks to wide and condensed display faces, a serif for
 * contrast, and a mono for the small print.
 *
 * Fonts load from Google Fonts for the preview, are measured with the real
 * glyph widths so headlines fill their columns exactly, and are embedded into
 * every export so a PNG, PDF, SVG or video matches the screen.
 */

export type FontId =
  | "system"
  | "inter"
  | "archivo"
  | "hanken"
  | "schibsted"
  | "space"
  | "familjen"
  | "bricolage"
  | "syne"
  | "unbounded"
  | "anton"
  | "bebas"
  | "oswald"
  | "instrument"
  | "mono";

export interface FontDef {
  id: FontId;
  label: string;
  family: string;
  /** Google Fonts family name, or null for the system grotesk. */
  google: string | null;
  weights: number[];
  /** Weight used for headlines. */
  heavy: number;
  /** Display-only faces set the small print in this font instead. */
  body?: FontId;
  /** Caps-only faces. */
  caps?: boolean;
  note: string;
}

export const FONTS: FontDef[] = [
  { id: "system", label: "Helvetica", family: `"Helvetica Neue", Helvetica, Arial, sans-serif`, google: null, weights: [400, 700], heavy: 700, note: "The original" },
  { id: "inter", label: "Inter Tight", family: `"Inter Tight", sans-serif`, google: "Inter Tight", weights: [400, 700, 900], heavy: 800, note: "Neo-grotesk" },
  { id: "archivo", label: "Archivo", family: `"Archivo", sans-serif`, google: "Archivo", weights: [400, 700, 900], heavy: 900, note: "Grotesk, heavy" },
  { id: "hanken", label: "Hanken Grotesk", family: `"Hanken Grotesk", sans-serif`, google: "Hanken Grotesk", weights: [400, 700, 900], heavy: 900, note: "Clean grotesk" },
  { id: "schibsted", label: "Schibsted Grotesk", family: `"Schibsted Grotesk", sans-serif`, google: "Schibsted Grotesk", weights: [400, 700, 900], heavy: 900, note: "Editorial grotesk" },
  { id: "space", label: "Space Grotesk", family: `"Space Grotesk", sans-serif`, google: "Space Grotesk", weights: [400, 700], heavy: 700, note: "Geometric, quirky" },
  { id: "familjen", label: "Familjen Grotesk", family: `"Familjen Grotesk", sans-serif`, google: "Familjen Grotesk", weights: [400, 700], heavy: 700, note: "Scandinavian" },
  { id: "bricolage", label: "Bricolage", family: `"Bricolage Grotesque", sans-serif`, google: "Bricolage Grotesque", weights: [400, 700, 800], heavy: 800, note: "Expressive" },
  { id: "syne", label: "Syne", family: `"Syne", sans-serif`, google: "Syne", weights: [400, 700, 800], heavy: 800, note: "Avant-garde" },
  { id: "unbounded", label: "Unbounded", family: `"Unbounded", sans-serif`, google: "Unbounded", weights: [400, 700, 900], heavy: 900, note: "Extra wide" },
  { id: "anton", label: "Anton", family: `"Anton", sans-serif`, google: "Anton", weights: [400], heavy: 400, body: "inter", note: "Condensed, loud" },
  { id: "bebas", label: "Bebas Neue", family: `"Bebas Neue", sans-serif`, google: "Bebas Neue", weights: [400], heavy: 400, body: "inter", caps: true, note: "Condensed caps" },
  { id: "oswald", label: "Oswald", family: `"Oswald", sans-serif`, google: "Oswald", weights: [400, 700], heavy: 700, note: "Narrow gothic" },
  { id: "instrument", label: "Instrument Serif", family: `"Instrument Serif", serif`, google: "Instrument Serif", weights: [400], heavy: 400, body: "inter", note: "Serif contrast" },
  { id: "mono", label: "Space Mono", family: `"Space Mono", monospace`, google: "Space Mono", weights: [400, 700], heavy: 700, note: "Typewriter" },
];

export const FONT_BY_ID = Object.fromEntries(FONTS.map((f) => [f.id, f])) as Record<FontId, FontDef>;

export const bodyFont = (id: FontId) => FONT_BY_ID[FONT_BY_ID[id].body ?? id];

const googleUrl = (fonts: FontDef[]) =>
  "https://fonts.googleapis.com/css2?" +
  fonts
    .filter((f) => f.google)
    .map((f) => `family=${f.google!.replace(/ /g, "+")}:wght@${f.weights.join(";")}`)
    .join("&") +
  "&display=swap";

/* ------------------------------------------------------------- loading */

let linked = false;

/** Adds every studio font to the page (once), for the preview and the picker. */
export function linkAllFonts() {
  if (linked || typeof document === "undefined") return;
  linked = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = googleUrl(FONTS);
  document.head.appendChild(link);
}

/** Resolves once a font's headline and body weights are ready to measure. */
export async function ensureFont(id: FontId) {
  const f = FONT_BY_ID[id];
  const b = bodyFont(id);
  if (!f.google && !b.google) return;
  linkAllFonts();
  await Promise.all([
    document.fonts.load(`${f.heavy} 100px ${f.family}`),
    document.fonts.load(`400 100px ${b.family}`),
    document.fonts.load(`700 100px ${b.family}`),
  ]);
}

/* ----------------------------------------------------------- measuring */

let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();

/** Width of text in ems, measured with the real font. */
export function measureEm(text: string, family: string, weight: number) {
  const key = `${family}|${weight}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  ctx ??= document.createElement("canvas").getContext("2d");
  ctx!.font = `${weight} 100px ${family}`;
  const w = ctx!.measureText(text).width / 100;
  cache.set(key, w);
  return w;
}

/* ----------------------------------------------------------- embedding */

const embedded = new Map<string, string>();

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * @font-face rules with the font files inlined, Latin subset only, so an SVG
 * drawn to a canvas (where outside files are blocked) keeps its typefaces.
 */
export async function embeddedFontCss(ids: FontId[]): Promise<string> {
  const defs = [...new Set(ids.flatMap((id) => [FONT_BY_ID[id], bodyFont(id)]))].filter((f) => f.google);
  const parts = await Promise.all(
    defs.map(async (f) => {
      const hit = embedded.get(f.id);
      if (hit) return hit;
      const css = await (await fetch(googleUrl([f]))).text();
      const blocks = css.split("@font-face").slice(1);
      const rules = await Promise.all(
        blocks
          .map((block, i) => ({ block, comment: css.split("@font-face")[i] }))
          .filter(({ comment }) => /\/\*\s*latin\s*\*\/\s*$/.test(comment))
          .map(async ({ block }) => {
            const url = block.match(/url\(([^)]+)\)/)?.[1];
            const weight = block.match(/font-weight:\s*(\d+)/)?.[1] ?? "400";
            if (!url) return "";
            const data = toBase64(await (await fetch(url)).arrayBuffer());
            return `@font-face{font-family:"${f.google}";font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${data}) format("woff2");}`;
          })
      );
      const out = rules.join("");
      embedded.set(f.id, out);
      return out;
    })
  );
  return parts.join("");
}
