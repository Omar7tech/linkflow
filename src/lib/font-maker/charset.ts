/**
 * Font Maker: the characters a font is made of, and the vertical metrics every
 * drawing surface shares.
 *
 * All glyph artwork lives in one square design space, 1000 × 1000 "pad units",
 * with y growing downwards like a canvas. The guides sit at fixed heights in
 * that square, on the drawing pad and in every printed template cell alike, so
 * a letter drawn on screen and one written on paper land on the same baseline.
 */

export const UPM = 1000;

/** Font units, y up, baseline at 0. */
export const METRICS = {
  ascender: 800,
  capHeight: 700,
  xHeight: 500,
  descender: -200,
} as const;

/** Where each guide sits in the pad square (0 = top, 1000 = bottom). */
export const PAD_GUIDES = {
  ascender: 0,
  cap: METRICS.ascender - METRICS.capHeight, // 100
  xHeight: METRICS.ascender - METRICS.xHeight, // 300
  baseline: METRICS.ascender, // 800
  descender: METRICS.ascender - METRICS.descender, // 1000
} as const;

/** Pad y (down) to font y (up). */
export const padToFontY = (y: number) => METRICS.ascender - y;

export type SlotGroup = "upper" | "lower" | "digits" | "punct" | "alt";

export interface Slot {
  /** "A", "a", "a.alt" … */
  key: string;
  char: string;
  group: SlotGroup;
  alt: boolean;
}

export const UPPER = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
export const LOWER = [..."abcdefghijklmnopqrstuvwxyz"];
export const DIGITS = [..."0123456789"];
export const PUNCT = [".", ",", ":", ";", "!", "?", "'", '"', "-", "(", ")", "&", "@", "#", "$", "%", "/", "+", "=", "*"];

export const SLOTS: Slot[] = [
  ...UPPER.map((char) => ({ key: char, char, group: "upper" as const, alt: false })),
  ...LOWER.map((char) => ({ key: char, char, group: "lower" as const, alt: false })),
  ...DIGITS.map((char) => ({ key: char, char, group: "digits" as const, alt: false })),
  ...PUNCT.map((char) => ({ key: char, char, group: "punct" as const, alt: false })),
  ...LOWER.map((char) => ({ key: `${char}.alt`, char, group: "alt" as const, alt: true })),
];

export const SLOT_BY_KEY = new Map(SLOTS.map((slot) => [slot.key, slot]));

export const GROUP_LABELS: Record<SlotGroup, string> = {
  upper: "Capitals",
  lower: "Lowercase",
  digits: "Numbers",
  punct: "Punctuation",
  alt: "Second versions",
};

/* ------------------------------------------------------------ smart cleanup */

/** Characters whose lowest point should rest on the baseline. */
const SITS = new Set([
  ...UPPER.filter((c) => c !== "Q" && c !== "J"),
  ...LOWER.filter((c) => !"gjpqy".includes(c)),
  ...DIGITS,
  ".", "!", "?", ":", "%", "&", "#",
]);

export const sitsOnBaseline = (char: string) => SITS.has(char);

/** The height a character's top should reach, when evening out sizes. */
export function targetTop(char: string): number | null {
  if (UPPER.includes(char) || DIGITS.includes(char)) return METRICS.capHeight;
  if ("acemnorsuvwxz".includes(char)) return METRICS.xHeight;
  if ("bdfhkl".includes(char)) return 760;
  return null;
}
