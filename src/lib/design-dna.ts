/**
 * Design DNA: distill raw CSS into a site's design system.
 *
 * The extractor is deliberately tolerant — it never builds a full CSS AST.
 * It scans declarations with regexes, normalizes every color notation
 * (hex, rgb, hsl, oklch, named) to hex, and ranks everything by how often
 * the site actually uses it. Shared by the API route (extraction) and the
 * client (export generators).
 */

export interface ColorEntry {
  hex: string;
  count: number;
}

export interface FontEntry {
  family: string;
  stack: string;
  count: number;
}

export interface NumericEntry {
  value: number;
  count: number;
}

export interface ValueEntry {
  value: string;
  count: number;
}

export interface TokenEntry {
  name: string;
  value: string;
}

export interface DesignDna {
  site: {
    url: string;
    title: string | null;
    description: string | null;
    faviconUrl: string | null;
    themeColor: string | null;
  };
  colors: ColorEntry[];
  gradients: ValueEntry[];
  fonts: FontEntry[];
  fontSizes: NumericEntry[];
  fontWeights: NumericEntry[];
  spacing: NumericEntry[];
  radii: ValueEntry[];
  shadows: ValueEntry[];
  tokens: TokenEntry[];
  stats: { stylesheets: number; cssKb: number; declarations: number };
}

/* ---------------------------------------------------------------- colors */

const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  red: "#ff0000",
  blue: "#0000ff",
  green: "#008000",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  orange: "#ffa500",
  yellow: "#ffff00",
  purple: "#800080",
  pink: "#ffc0cb",
  gold: "#ffd700",
  navy: "#000080",
  teal: "#008080",
  crimson: "#dc143c",
  indigo: "#4b0082",
  violet: "#ee82ee",
  coral: "#ff7f50",
  salmon: "#fa8072",
  khaki: "#f0e68c",
  beige: "#f5f5dc",
  ivory: "#fffff0",
  tomato: "#ff6347",
};

function channelHex(v: number): string {
  return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${channelHex(r)}${channelHex(g)}${channelHex(b)}`;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** OKLCH → sRGB (needed for Tailwind v4-era sites, which are full of oklch()). */
function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const toSrgb = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    return (clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055) * 255;
  };
  return [
    toSrgb(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    toSrgb(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    toSrgb(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

function parseNumberList(body: string): number[] {
  return (body.match(/-?\d*\.?\d+%?/g) ?? []).map((token) =>
    token.endsWith("%") ? parseFloat(token) / 100 : parseFloat(token)
  );
}

/**
 * Any single CSS color token → { hex, alpha }, or null if unparseable.
 * Percentages are pre-normalized to fractions by parseNumberList.
 */
export function cssColorToHex(raw: string): { hex: string; alpha: number } | null {
  const value = raw.trim().toLowerCase();

  const named = NAMED_COLORS[value];
  if (named) return { hex: named, alpha: 1 };

  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (!/^[0-9a-f]{3,8}$/.test(hex)) return null;
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a] = hex.split("").map((ch) => parseInt(ch + ch, 16));
      return { hex: rgbToHex(r, g, b), alpha: hex.length === 4 ? a / 255 : 1 };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { hex: rgbToHex(r, g, b), alpha: a };
    }
    return null;
  }

  const fn = value.match(/^(rgba?|hsla?|oklch)\(([^)]*)\)$/);
  if (!fn) return null;
  const body = fn[2].replace(/\//g, " ");

  if (fn[1].startsWith("rgb")) {
    const [rTok, gTok, bTok, alphaTok] = fn[2].match(/-?\d*\.?\d+%?/g) ?? [];
    if (rTok === undefined || gTok === undefined || bTok === undefined) return null;
    const chan = (t: string) => (t.endsWith("%") ? (parseFloat(t) / 100) * 255 : parseFloat(t));
    const alpha = alphaTok === undefined ? 1 : alphaTok.endsWith("%") ? parseFloat(alphaTok) / 100 : parseFloat(alphaTok);
    return { hex: rgbToHex(chan(rTok), chan(gTok), chan(bTok)), alpha };
  }

  const nums = parseNumberList(body);
  if (nums.length < 3) return null;
  if (fn[1].startsWith("hsl")) {
    const [r, g, b] = hslToRgb(nums[0], nums[1], nums[2]);
    return { hex: rgbToHex(r, g, b), alpha: nums[3] ?? 1 };
  }
  // oklch
  const [r, g, b] = oklchToRgb(nums[0] > 1 ? nums[0] / 100 : nums[0], nums[1], nums[2]);
  return { hex: rgbToHex(r, g, b), alpha: nums[3] ?? 1 };
}

/* ------------------------------------------------------------ extraction */

const GENERIC_FAMILIES = new Set([
  "sans-serif",
  "serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "ui-rounded",
  "inherit",
  "initial",
  "unset",
  "math",
  "emoji",
]);

const COLOR_TOKEN_RE =
  /#[0-9a-f]{3,8}\b|(?:rgba?|hsla?|oklch)\([^)]*\)/gi;

function lengthToPx(token: string): number | null {
  const m = token.match(/^(-?\d*\.?\d+)(px|rem|em)$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return m[2] === "px" ? v : v * 16;
}

function bump<K>(map: Map<K, number>, key: K, cap = 4000) {
  if (!map.has(key) && map.size >= cap) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topEntries<K>(map: Map<K, number>, limit: number): [K, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export interface CssExtraction {
  colors: ColorEntry[];
  gradients: ValueEntry[];
  fonts: FontEntry[];
  fontSizes: NumericEntry[];
  fontWeights: NumericEntry[];
  spacing: NumericEntry[];
  radii: ValueEntry[];
  shadows: ValueEntry[];
  tokens: TokenEntry[];
  declarations: number;
}

/** Run the whole battery of extractors over concatenated CSS text. */
export function extractCss(cssRaw: string): CssExtraction {
  const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, " ");

  const colorCounts = new Map<string, number>();
  for (const token of css.match(COLOR_TOKEN_RE) ?? []) {
    const parsed = cssColorToHex(token);
    if (parsed && parsed.alpha >= 0.12) bump(colorCounts, parsed.hex);
  }
  // Named colors only where they're unambiguous: inside color-ish declarations.
  const namedRe = new RegExp(
    `(?:^|[;{])\\s*(?:color|background(?:-color)?|border(?:-[a-z]+)?-color|fill|stroke|accent-color|caret-color)\\s*:\\s*(${Object.keys(NAMED_COLORS).join("|")})\\s*[;}!]`,
    "gi"
  );
  for (const m of css.matchAll(namedRe)) bump(colorCounts, NAMED_COLORS[m[1].toLowerCase()]);

  const gradientCounts = new Map<string, number>();
  for (const m of css.matchAll(/(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\))*\)/gi)) {
    const value = m[0].replace(/\s+/g, " ");
    if (value.length <= 240) bump(gradientCounts, value);
  }

  const fontCounts = new Map<string, number>();
  const fontStacks = new Map<string, string>();
  for (const m of css.matchAll(/font-family\s*:\s*([^;{}]+)/gi)) {
    const stack = m[1].replace(/\s+/g, " ").replace(/!important/gi, "").trim();
    const first = stack.split(",")[0].trim().replace(/^["']|["']$/g, "");
    if (!first || first.startsWith("var(") || GENERIC_FAMILIES.has(first.toLowerCase())) continue;
    if (first.length > 48) continue;
    bump(fontCounts, first);
    if (!fontStacks.has(first)) fontStacks.set(first, stack.slice(0, 160));
  }

  const sizeCounts = new Map<number, number>();
  for (const m of css.matchAll(/font-size\s*:\s*([^;{}]+)/gi)) {
    const px = lengthToPx(m[1].trim().split(/\s/)[0]);
    if (px !== null && px >= 6 && px <= 160) bump(sizeCounts, Math.round(px * 2) / 2);
  }

  const weightCounts = new Map<number, number>();
  for (const m of css.matchAll(/font-weight\s*:\s*([^;{}]+)/gi)) {
    const token = m[1].trim().toLowerCase();
    const weight = token === "bold" ? 700 : token === "normal" ? 400 : parseInt(token, 10);
    if (weight >= 100 && weight <= 900) bump(weightCounts, weight);
  }

  const spacingCounts = new Map<number, number>();
  for (const m of css.matchAll(
    /(?:^|[;{])\s*(?:margin|padding|gap|row-gap|column-gap|margin-(?:top|right|bottom|left|block|inline)|padding-(?:top|right|bottom|left|block|inline))\s*:\s*([^;{}]+)/gi
  )) {
    for (const token of m[1].trim().split(/\s+/)) {
      const px = lengthToPx(token);
      if (px !== null && px >= 1 && px <= 200) bump(spacingCounts, Math.round(px));
    }
  }

  const radiusCounts = new Map<string, number>();
  for (const m of css.matchAll(/border-radius\s*:\s*([^;{}]+)/gi)) {
    const value = m[1].replace(/\s+/g, " ").replace(/!important/gi, "").trim();
    if (!value || value === "0" || value === "0px" || value.startsWith("var(")) continue;
    if (value.length <= 40) bump(radiusCounts, value);
  }

  const shadowCounts = new Map<string, number>();
  for (const m of css.matchAll(/box-shadow\s*:\s*([^;{}]+)/gi)) {
    const value = m[1].replace(/\s+/g, " ").replace(/!important/gi, "").trim();
    if (!value || /^(none|unset|initial|inherit)$/.test(value) || value.startsWith("var(")) continue;
    if (value.length <= 160) bump(shadowCounts, value);
  }

  const tokens: TokenEntry[] = [];
  const seenTokens = new Set<string>();
  for (const m of css.matchAll(/--([a-zA-Z][\w-]*)\s*:\s*([^;{}]+)/g)) {
    const name = m[1];
    const value = m[2].replace(/\s+/g, " ").trim();
    if (seenTokens.has(name) || name.startsWith("tw-") || value.startsWith("url(")) continue;
    if (value.length > 120) continue;
    seenTokens.add(name);
    tokens.push({ name, value });
    if (tokens.length >= 300) break;
  }

  return {
    colors: topEntries(colorCounts, 24).map(([hex, count]) => ({ hex, count })),
    gradients: topEntries(gradientCounts, 6).map(([value, count]) => ({ value, count })),
    fonts: topEntries(fontCounts, 8).map(([family, count]) => ({
      family,
      stack: fontStacks.get(family) ?? family,
      count,
    })),
    fontSizes: topEntries(sizeCounts, 14)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value - b.value),
    fontWeights: topEntries(weightCounts, 9)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value - b.value),
    spacing: topEntries(spacingCounts, 12)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value - b.value),
    radii: topEntries(radiusCounts, 8).map(([value, count]) => ({ value, count })),
    shadows: topEntries(shadowCounts, 6).map(([value, count]) => ({ value, count })),
    tokens: tokens.slice(0, 80),
    declarations: (css.match(/[a-z-]+\s*:/gi) ?? []).length,
  };
}

/* --------------------------------------------------------------- exports */

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function dnaToCssVariables(dna: DesignDna): string {
  const lines: string[] = [":root {"];
  dna.colors.slice(0, 12).forEach((c, i) => lines.push(`  --color-${i + 1}: ${c.hex};`));
  dna.fonts.slice(0, 3).forEach((f, i) =>
    lines.push(`  --font-${i === 0 ? "primary" : i === 1 ? "secondary" : "tertiary"}: ${f.stack};`)
  );
  dna.fontSizes.forEach((s) =>
    lines.push(`  --text-${String(s.value).replace(".", "_")}: ${s.value / 16}rem;`)
  );
  dna.spacing.forEach((s) => lines.push(`  --space-${s.value}: ${s.value}px;`));
  dna.radii.slice(0, 4).forEach((r, i) => lines.push(`  --radius-${i + 1}: ${r.value};`));
  dna.shadows.slice(0, 3).forEach((s, i) => lines.push(`  --shadow-${i + 1}: ${s.value};`));
  lines.push("}");
  return lines.join("\n");
}

export function dnaToTailwind(dna: DesignDna): string {
  const lines: string[] = ["@theme {"];
  dna.colors.slice(0, 12).forEach((c, i) => lines.push(`  --color-brand-${i + 1}: ${c.hex};`));
  dna.fonts.slice(0, 2).forEach((f, i) =>
    lines.push(`  --font-${i === 0 ? "sans" : "display"}: ${f.stack};`)
  );
  dna.radii.slice(0, 3).forEach((r, i) => lines.push(`  --radius-${["sm", "md", "lg"][i]}: ${r.value.split(" ")[0]};`));
  dna.shadows.slice(0, 3).forEach((s, i) => lines.push(`  --shadow-${["sm", "md", "lg"][i]}: ${s.value};`));
  lines.push("}");
  return lines.join("\n");
}

export function dnaToJson(dna: DesignDna): string {
  return JSON.stringify(
    {
      source: dna.site.url,
      colors: dna.colors.map((c) => c.hex),
      fonts: dna.fonts.map((f) => ({ family: f.family, stack: f.stack })),
      typeScale: dna.fontSizes.map((s) => s.value),
      fontWeights: dna.fontWeights.map((w) => w.value),
      spacing: dna.spacing.map((s) => s.value),
      radii: dna.radii.map((r) => r.value),
      shadows: dna.shadows.map((s) => s.value),
      tokens: Object.fromEntries(dna.tokens.map((t) => [`--${slug(t.name)}`, t.value])),
    },
    null,
    2
  );
}
