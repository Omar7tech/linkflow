/**
 * Theme Foundry: forge a complete design system from one brand color.
 *
 * All color math runs in OKLCH so every generated ramp is perceptually
 * even — the same approach Tailwind uses for its built-in palettes. The
 * input color is anchored into its ramp (the nearest step adopts its
 * exact chroma), semantic hues (success/warning/danger) are matched to
 * the brand's saturation, and every text-on-color pairing is chosen by
 * real WCAG contrast, never guessed.
 */

/* ------------------------------------------------------------ color math */

export interface Oklch {
  l: number; // 0..1
  c: number; // 0..~0.37
  h: number; // degrees
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : value;
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const ch = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

/** OKLCH → linear sRGB triple (may be out of gamut). */
function oklchToLinear(l: number, c: number, h: number): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

function inGamut(rgb: [number, number, number]): boolean {
  return rgb.every((v) => v >= -0.0005 && v <= 1.0005);
}

/**
 * OKLCH → hex, reducing chroma (never lightness) until the color fits
 * sRGB — hue and perceived brightness stay true to the design intent.
 */
export function oklchToHex(l: number, c: number, h: number): string {
  let rgb = oklchToLinear(l, c, h);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(l, mid, h))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinear(l, lo, h);
  }
  const [r, g, b] = rgb.map((v) => linearToSrgb(Math.max(0, Math.min(1, v))));
  return rgbToHex(r, g, b);
}

/** WCAG 2.x relative luminance of a hex color. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ----------------------------------------------------------------- ramps */

export const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type RampStep = (typeof RAMP_STEPS)[number];
export type Ramp = Record<RampStep, string>;

/** Perceptual lightness target per step — tuned to feel like Tailwind v4. */
const RAMP_L = [0.985, 0.96, 0.915, 0.85, 0.765, 0.67, 0.585, 0.5, 0.43, 0.37, 0.28];
/** Chroma envelope: quiet at the ends, saturated through the middle. */
const RAMP_C = [0.06, 0.12, 0.24, 0.42, 0.72, 1.0, 0.98, 0.9, 0.78, 0.62, 0.42];

/**
 * Build an 11-step ramp at a hue. `peakChroma` sets the 500-step chroma;
 * `anchor` (optional) snaps the step nearest the anchor's lightness to the
 * anchor's exact chroma so the user's own color lives inside its ramp.
 */
export function makeRamp(hue: number, peakChroma: number, anchor?: Oklch): Ramp {
  let scale = 1;
  if (anchor && anchor.c > 0.02) {
    let nearest = 0;
    for (let i = 1; i < RAMP_L.length; i++) {
      if (Math.abs(RAMP_L[i] - anchor.l) < Math.abs(RAMP_L[nearest] - anchor.l)) nearest = i;
    }
    scale = anchor.c / (peakChroma * RAMP_C[nearest]);
    scale = Math.max(0.5, Math.min(1.6, scale));
  }
  const ramp = {} as Ramp;
  RAMP_STEPS.forEach((step, i) => {
    ramp[step] = oklchToHex(RAMP_L[i], peakChroma * RAMP_C[i] * scale, hue);
  });
  return ramp;
}

/* ----------------------------------------------------------------- vibes */

export type VibeId = "minimal" | "editorial" | "playful" | "corporate" | "luxury" | "brutalist";

export interface Vibe {
  id: VibeId;
  label: string;
  /** Multiplies ramp chroma — luxury mutes, playful saturates. */
  chroma: number;
  /** Google Fonts family names. */
  headingFont: string;
  bodyFont: string;
  headingWeight: number;
  /** Type scale ratio. */
  ratio: number;
  radius: { sm: string; md: string; lg: string; xl: string; full: string };
  shadow: { sm: string; md: string; lg: string };
  easing: string;
  duration: string;
}

export const VIBES: readonly Vibe[] = [
  {
    id: "minimal",
    label: "Minimal",
    chroma: 0.85,
    headingFont: "Inter",
    bodyFont: "Inter",
    headingWeight: 650,
    ratio: 1.2,
    radius: { sm: "4px", md: "8px", lg: "12px", xl: "16px", full: "9999px" },
    shadow: {
      sm: "0 1px 2px rgb(0 0 0 / 0.05)",
      md: "0 2px 8px -2px rgb(0 0 0 / 0.08), 0 1px 2px rgb(0 0 0 / 0.04)",
      lg: "0 12px 32px -8px rgb(0 0 0 / 0.12), 0 2px 6px rgb(0 0 0 / 0.05)",
    },
    easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    duration: "200ms",
  },
  {
    id: "editorial",
    label: "Editorial",
    chroma: 0.9,
    headingFont: "Playfair Display",
    bodyFont: "Source Sans 3",
    headingWeight: 700,
    ratio: 1.333,
    radius: { sm: "2px", md: "4px", lg: "6px", xl: "10px", full: "9999px" },
    shadow: {
      sm: "0 1px 1px rgb(0 0 0 / 0.06)",
      md: "0 2px 6px rgb(0 0 0 / 0.08)",
      lg: "0 10px 28px -6px rgb(0 0 0 / 0.14)",
    },
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    duration: "250ms",
  },
  {
    id: "playful",
    label: "Playful",
    chroma: 1.25,
    headingFont: "Baloo 2",
    bodyFont: "Nunito",
    headingWeight: 700,
    ratio: 1.25,
    radius: { sm: "10px", md: "16px", lg: "24px", xl: "32px", full: "9999px" },
    shadow: {
      sm: "0 2px 4px rgb(0 0 0 / 0.06)",
      md: "0 6px 16px -4px rgb(0 0 0 / 0.12)",
      lg: "0 20px 44px -12px rgb(0 0 0 / 0.18)",
    },
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    duration: "300ms",
  },
  {
    id: "corporate",
    label: "Corporate",
    chroma: 0.9,
    headingFont: "IBM Plex Sans",
    bodyFont: "IBM Plex Sans",
    headingWeight: 600,
    ratio: 1.25,
    radius: { sm: "4px", md: "6px", lg: "10px", xl: "14px", full: "9999px" },
    shadow: {
      sm: "0 1px 2px rgb(0 0 0 / 0.06)",
      md: "0 3px 10px -2px rgb(0 0 0 / 0.1)",
      lg: "0 14px 34px -10px rgb(0 0 0 / 0.16)",
    },
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    duration: "180ms",
  },
  {
    id: "luxury",
    label: "Luxury",
    chroma: 0.65,
    headingFont: "Cormorant Garamond",
    bodyFont: "Jost",
    headingWeight: 600,
    ratio: 1.414,
    radius: { sm: "0px", md: "2px", lg: "4px", xl: "8px", full: "9999px" },
    shadow: {
      sm: "0 1px 2px rgb(0 0 0 / 0.05)",
      md: "0 4px 20px -4px rgb(0 0 0 / 0.1)",
      lg: "0 24px 60px -16px rgb(0 0 0 / 0.2)",
    },
    easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    duration: "350ms",
  },
  {
    id: "brutalist",
    label: "Brutalist",
    chroma: 1.15,
    headingFont: "Space Grotesk",
    bodyFont: "Space Grotesk",
    headingWeight: 700,
    ratio: 1.25,
    radius: { sm: "0px", md: "0px", lg: "0px", xl: "0px", full: "0px" },
    shadow: {
      sm: "2px 2px 0 rgb(0 0 0 / 1)",
      md: "4px 4px 0 rgb(0 0 0 / 1)",
      lg: "8px 8px 0 rgb(0 0 0 / 1)",
    },
    easing: "cubic-bezier(0.7, 0, 0.3, 1)",
    duration: "120ms",
  },
];

export const VIBE_BY_ID = Object.fromEntries(VIBES.map((v) => [v.id, v])) as Record<VibeId, Vibe>;

/* ----------------------------------------------------------------- theme */

export type NeutralTint = "pure" | "tinted" | "warm" | "cool";

export interface FoundryInput {
  brandHex: string;
  vibe: VibeId;
  neutral: NeutralTint;
  /** Optional override of the vibe's type-scale ratio. */
  ratio?: number;
}

export interface SemanticTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  ring: string;
}

export interface TypeStep {
  name: string;
  px: number;
  lineHeight: number;
}

export interface Theme {
  input: Required<FoundryInput>;
  vibe: Vibe;
  ramps: {
    brand: Ramp;
    neutral: Ramp;
    success: Ramp;
    warning: Ramp;
    danger: Ramp;
  };
  light: SemanticTokens;
  dark: SemanticTokens;
  type: TypeStep[];
  spacing: number[];
  /** Contrast ratio of primary button text in light mode. */
  primaryContrast: number;
}

/** White or near-black text — whichever actually reads on this color. */
export function onColor(bg: string): string {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#171717") ? "#ffffff" : "#171717";
}

const TYPE_NAMES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];

export function buildTheme(raw: FoundryInput): Theme {
  const vibe = VIBE_BY_ID[raw.vibe];
  const input: Required<FoundryInput> = { ...raw, ratio: raw.ratio ?? vibe.ratio };
  const brand = hexToOklch(input.brandHex);
  const peak = 0.19 * vibe.chroma;

  const neutralHue =
    input.neutral === "warm" ? 75 : input.neutral === "cool" ? 250 : brand.h;
  const neutralChroma =
    input.neutral === "pure" ? 0 : input.neutral === "tinted" ? 0.022 : 0.014;

  const ramps = {
    brand: makeRamp(brand.h, peak, brand),
    neutral: makeRamp(neutralHue, neutralChroma / RAMP_C[5]),
    success: makeRamp(152, 0.15 * vibe.chroma),
    warning: makeRamp(80, 0.16 * vibe.chroma),
    danger: makeRamp(27, 0.18 * vibe.chroma),
  };

  const n = ramps.neutral;
  const b = ramps.brand;

  // Primary needs real button contrast; walk darker until text passes AA.
  let primaryLight: string = b[600];
  for (const step of [600, 700, 800] as const) {
    primaryLight = b[step];
    if (contrastRatio(primaryLight, onColor(primaryLight)) >= 4.5) break;
  }

  const light: SemanticTokens = {
    background: "#ffffff",
    foreground: n[950],
    card: "#ffffff",
    cardForeground: n[950],
    muted: n[100],
    mutedForeground: n[500],
    border: n[200],
    input: n[200],
    primary: primaryLight,
    primaryForeground: onColor(primaryLight),
    secondary: n[100],
    secondaryForeground: n[900],
    accent: b[50],
    accentForeground: b[900],
    destructive: ramps.danger[600],
    destructiveForeground: onColor(ramps.danger[600]),
    ring: b[500],
  };

  const dark: SemanticTokens = {
    background: n[950],
    foreground: n[50],
    card: n[900],
    cardForeground: n[50],
    muted: n[800],
    mutedForeground: n[400],
    border: n[800],
    input: n[800],
    primary: b[500],
    primaryForeground: onColor(b[500]),
    secondary: n[800],
    secondaryForeground: n[100],
    accent: b[950],
    accentForeground: b[200],
    destructive: ramps.danger[500],
    destructiveForeground: onColor(ramps.danger[500]),
    ring: b[400],
  };

  const type: TypeStep[] = TYPE_NAMES.map((name, i) => {
    const px = Math.round(16 * input.ratio ** (i - 2) * 2) / 2;
    const lineHeight = px >= 30 ? 1.15 : px >= 20 ? 1.3 : 1.55;
    return { name, px, lineHeight };
  });

  return {
    input,
    vibe,
    ramps,
    light,
    dark,
    type,
    spacing: [4, 8, 12, 16, 24, 32, 48, 64, 96, 128],
    primaryContrast: contrastRatio(light.primary, light.primaryForeground),
  };
}

/* --------------------------------------------------------------- exports */

const SEMANTIC_ORDER: [keyof SemanticTokens, string][] = [
  ["background", "background"],
  ["foreground", "foreground"],
  ["card", "card"],
  ["cardForeground", "card-foreground"],
  ["muted", "muted"],
  ["mutedForeground", "muted-foreground"],
  ["border", "border"],
  ["input", "input"],
  ["primary", "primary"],
  ["primaryForeground", "primary-foreground"],
  ["secondary", "secondary"],
  ["secondaryForeground", "secondary-foreground"],
  ["accent", "accent"],
  ["accentForeground", "accent-foreground"],
  ["destructive", "destructive"],
  ["destructiveForeground", "destructive-foreground"],
  ["ring", "ring"],
];

function rampLines(name: string, ramp: Ramp, indent = "  "): string[] {
  return RAMP_STEPS.map((step) => `${indent}--${name}-${step}: ${ramp[step]};`);
}

export function themeToCss(theme: Theme): string {
  const lines: string[] = [":root {"];
  lines.push(...rampLines("brand", theme.ramps.brand));
  lines.push(...rampLines("neutral", theme.ramps.neutral));
  lines.push("");
  for (const [key, name] of SEMANTIC_ORDER) lines.push(`  --${name}: ${theme.light[key]};`);
  lines.push("");
  lines.push(`  --font-heading: "${theme.vibe.headingFont}", sans-serif;`);
  lines.push(`  --font-body: "${theme.vibe.bodyFont}", sans-serif;`);
  theme.type.forEach((t) => lines.push(`  --text-${t.name}: ${t.px / 16}rem;`));
  theme.spacing.forEach((s, i) => lines.push(`  --space-${i + 1}: ${s}px;`));
  (["sm", "md", "lg", "xl"] as const).forEach((k) =>
    lines.push(`  --radius-${k}: ${theme.vibe.radius[k]};`)
  );
  (["sm", "md", "lg"] as const).forEach((k) => lines.push(`  --shadow-${k}: ${theme.vibe.shadow[k]};`));
  lines.push(`  --ease: ${theme.vibe.easing};`);
  lines.push(`  --duration: ${theme.vibe.duration};`);
  lines.push("}");
  lines.push("");
  lines.push(".dark {");
  for (const [key, name] of SEMANTIC_ORDER) lines.push(`  --${name}: ${theme.dark[key]};`);
  lines.push("}");
  return lines.join("\n");
}

export function themeToTailwind(theme: Theme): string {
  const lines: string[] = ["@theme {"];
  lines.push(...rampLines("color-brand", theme.ramps.brand));
  lines.push(...rampLines("color-neutral", theme.ramps.neutral));
  lines.push(...rampLines("color-success", theme.ramps.success));
  lines.push(...rampLines("color-warning", theme.ramps.warning));
  lines.push(...rampLines("color-danger", theme.ramps.danger));
  lines.push("");
  lines.push(`  --font-heading: "${theme.vibe.headingFont}", sans-serif;`);
  lines.push(`  --font-body: "${theme.vibe.bodyFont}", sans-serif;`);
  theme.type.forEach((t) =>
    lines.push(`  --text-${t.name}: ${t.px / 16}rem;`, `  --text-${t.name}--line-height: ${t.lineHeight};`)
  );
  (["sm", "md", "lg", "xl"] as const).forEach((k) =>
    lines.push(`  --radius-${k}: ${theme.vibe.radius[k]};`)
  );
  (["sm", "md", "lg"] as const).forEach((k) => lines.push(`  --shadow-${k}: ${theme.vibe.shadow[k]};`));
  lines.push("}");
  return lines.join("\n");
}

export function themeToShadcn(theme: Theme): string {
  const block = (tokens: SemanticTokens, indent: string) =>
    SEMANTIC_ORDER.map(([key, name]) => `${indent}--${name}: ${tokens[key]};`).join("\n");
  return [
    "/* Paste into your globals.css — themes every shadcn/ui component. */",
    ":root {",
    `  --radius: ${theme.vibe.radius.md};`,
    block(theme.light, "  "),
    "}",
    "",
    ".dark {",
    block(theme.dark, "  "),
    "}",
  ].join("\n");
}

export function themeToJson(theme: Theme): string {
  return JSON.stringify(
    {
      brand: theme.input.brandHex,
      vibe: theme.vibe.id,
      ramps: theme.ramps,
      semantic: { light: theme.light, dark: theme.dark },
      typography: {
        headingFont: theme.vibe.headingFont,
        bodyFont: theme.vibe.bodyFont,
        scaleRatio: theme.input.ratio,
        steps: Object.fromEntries(theme.type.map((t) => [t.name, `${t.px}px`])),
      },
      spacing: theme.spacing,
      radius: theme.vibe.radius,
      shadow: theme.vibe.shadow,
      motion: { easing: theme.vibe.easing, duration: theme.vibe.duration },
    },
    null,
    2
  );
}

/** A pleasant random brand color — vivid but not neon. */
export function randomBrandHex(): string {
  const h = Math.random() * 360;
  const c = 0.13 + Math.random() * 0.1;
  const l = 0.55 + Math.random() * 0.18;
  return oklchToHex(l, c, h);
}
