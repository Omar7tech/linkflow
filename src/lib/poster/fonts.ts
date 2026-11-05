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
  | "mono"
  /** Any family from Google Fonts, chosen by name (see loadGoogleFont). */
  | "custom";

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
// Until someone picks a font by name, "custom" stands in as the system grotesk.
FONT_BY_ID.custom = { ...FONT_BY_ID.system, id: "custom" };

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

/* ---------------------------------------------------------- custom fonts */

const titleCase = (text: string) => text.replace(/\b([a-z])/g, (c) => c.toUpperCase());

/**
 * Loads any Google Fonts family by name and makes it the "custom" face.
 * Tries the heavy weights a poster wants first, then whatever the family has.
 */
export async function loadGoogleFont(input: string): Promise<FontDef> {
  const name = input.trim().replace(/\s+/g, " ");
  if (!/^[A-Za-z0-9 ]{2,60}$/.test(name)) throw new Error("Type the font's name as it appears on Google Fonts.");
  // Google matches names exactly, so also try the usual capitalisations,
  // including short all-caps words (DM Sans, IBM Plex, PT Serif, EB Garamond).
  const title = titleCase(name.toLowerCase());
  const shortCaps = title.replace(/\b([A-Za-z]{2,3})\b/g, (w) => w.toUpperCase());
  const firstCaps = title.replace(/^([A-Za-z]{2,3})\b/, (w) => w.toUpperCase());
  const names = [...new Set([name, firstCaps, title, shortCaps, titleCase(name)])];
  const axes = ["wght@400;700;900", "wght@400;700;800", "wght@400;700", "wght@400;600", "wght@400", ""];
  for (const candidate of names)
    for (const axis of axes) {
      const url = `https://fonts.googleapis.com/css2?family=${candidate.replace(/ /g, "+")}${axis ? ":" + axis : ""}&display=swap`;
      // Google answers an unknown family or weight with an error page the
      // browser blocks outright, so a failed request just means "not this one".
      let res: Response;
      try {
        res = await fetch(url);
      } catch {
        continue;
      }
      if (!res.ok) continue;
      const css = await res.text();
      const family = css.match(/font-family:\s*['"]([^'"]+)['"]/)?.[1] ?? candidate;
      const weights = [...new Set([...css.matchAll(/font-weight:\s*(\d+)/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
      const usable = weights.length ? weights : [400];
      const def: FontDef = {
        id: "custom",
        label: family,
        family: `"${family}", sans-serif`,
        google: family,
        weights: usable,
        heavy: Math.max(...usable),
        // A face with one weight is a display face: small print goes in Inter Tight.
        body: usable.length > 1 && usable.includes(400) ? undefined : "inter",
        note: "From Google Fonts",
      };
      FONT_BY_ID.custom = def;
      embedded.delete("custom");
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = googleUrl([def]);
      document.head.appendChild(link);
      await document.fonts.load(`${def.heavy} 100px ${def.family}`);
      return def;
    }
  // Nothing matched: tell a typo apart from being offline.
  const online = await fetch("https://fonts.googleapis.com/css2?family=Inter&display=swap").then(
    (r) => r.ok,
    () => false
  );
  throw new Error(online ? `"${name}" isn't on Google Fonts. Check the spelling.` : "Couldn't reach Google Fonts. Check your connection.");
}
