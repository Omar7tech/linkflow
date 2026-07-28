/** Slug generation — pure functions, deterministic, no dependencies. */

export type SlugCase = "lower" | "upper" | "title" | "preserve";
/** "" joins words with nothing at all (thisisaslug). */
export type SlugSeparator = "-" | "_" | "." | "";

export interface SlugOptions {
  separator: SlugSeparator;
  /** Casing applied after the words are split. */
  casing: SlugCase;
  /** Keep letters outside ASCII (é, 日本語) instead of folding or dropping them. */
  unicode: boolean;
  /** Turn &, @, %, $ … into words before the non-word characters are stripped. */
  expandSymbols: boolean;
  /** Drop common English filler words — never all of them. */
  stripStopWords: boolean;
  /** Hard cap in characters, cut on a word boundary. 0 = no limit. */
  maxLength: number;
}

export const DEFAULT_SLUG_OPTIONS: SlugOptions = {
  separator: "-",
  casing: "lower",
  unicode: false,
  expandSymbols: true,
  stripStopWords: false,
  maxLength: 0,
};

/**
 * Letters that survive Unicode NFD decomposition — their diacritic is baked
 * into the codepoint, so stripping combining marks leaves them untouched.
 */
const LATIN_EXTRAS: Record<string, string> = {
  ß: "ss", ẞ: "SS", æ: "ae", Æ: "AE", œ: "oe", Œ: "OE",
  ø: "o", Ø: "O", đ: "d", Đ: "D", ð: "d", Ð: "D",
  þ: "th", Þ: "TH", ł: "l", Ł: "L", ħ: "h", Ħ: "H",
  ı: "i", İ: "I", ŋ: "ng", Ŋ: "NG", ŧ: "t", Ŧ: "T",
  ĸ: "k", ſ: "s", ƒ: "f",
};

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ґ: "g", д: "d", е: "e", ё: "yo", є: "ye",
  ж: "zh", з: "z", и: "i", і: "i", ї: "yi", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h",
  ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e",
  ю: "yu", я: "ya",
};

const GREEK: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
  ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

/** Symbols people expect to read as words in a slug. */
const SYMBOL_WORDS: Record<string, string> = {
  "&": "and", "@": "at", "%": "percent", "+": "plus", "=": "equals",
  "€": "eur", "£": "gbp", "¥": "jpy", "$": "usd", "₹": "inr",
  "©": "copyright", "®": "registered", "™": "tm", "°": "deg", "№": "no",
  "½": "half", "¼": "quarter", "¾": "three quarters",
};

/** Short, safe list — words search engines ignore anyway. */
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "how",
  "if", "in", "into", "is", "it", "its", "of", "on", "or", "our", "so", "than",
  "that", "the", "their", "then", "there", "these", "they", "this", "to", "was",
  "were", "what", "when", "which", "who", "will", "with", "you", "your",
]);

/** Characters that read as "nothing" rather than as a word break. */
const SILENT = /['’‘`´ʼ"“”]/g;

function mapChars(input: string): string {
  let out = "";
  for (const char of input) {
    const lower = char.toLowerCase();
    const mapped =
      LATIN_EXTRAS[char] ?? CYRILLIC[lower] ?? GREEK[lower];
    if (mapped === undefined) {
      out += char;
      continue;
    }
    // Re-apply the source casing so "Ярослав" doesn't become "yaroslav" mid-word.
    out += char !== lower && mapped ? mapped[0].toUpperCase() + mapped.slice(1) : mapped;
  }
  return out;
}

/** Strip combining marks: "Crème brûlée" → "Creme brulee". */
function foldDiacritics(input: string): string {
  return input.normalize("NFD").replace(/\p{M}+/gu, "");
}

function expand(input: string): string {
  return input.replace(/[&@%+=€£¥$₹©®™°№½¼¾]/g, (char) => ` ${SYMBOL_WORDS[char]} `);
}

function applyCase(words: string[], casing: SlugCase): string[] {
  switch (casing) {
    case "lower":
      return words.map((w) => w.toLowerCase());
    case "upper":
      return words.map((w) => w.toUpperCase());
    case "title":
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    case "preserve":
      return words;
  }
}

/** Cut to `maxLength` characters without leaving a half word behind. */
function truncate(words: string[], separator: string, maxLength: number): string[] {
  if (maxLength <= 0) return words;
  const kept: string[] = [];
  let length = 0;
  for (const word of words) {
    const next = length === 0 ? word.length : length + separator.length + word.length;
    if (next > maxLength) break;
    kept.push(word);
    length = next;
  }
  // Never return nothing: a single over-long word is cut mid-way instead.
  if (kept.length === 0 && words.length > 0) return [words[0].slice(0, maxLength)];
  return kept;
}

/** Split into words on everything that isn't a letter or a digit. */
function toWords(input: string, unicode: boolean): string[] {
  const pattern = unicode ? /[^\p{L}\p{N}]+/gu : /[^a-zA-Z0-9]+/g;
  return input.split(pattern).filter(Boolean);
}

export function slugify(input: string, options: Partial<SlugOptions> = {}): string {
  const opts = { ...DEFAULT_SLUG_OPTIONS, ...options };
  let text = input.trim();
  if (!text) return "";

  text = text.replace(SILENT, "");
  if (opts.expandSymbols) text = expand(text);
  // Map, fold, map again: the first pass catches precomposed letters that carry
  // meaning (й → y, ё → yo), the second catches base letters the fold exposes
  // (ή → η → i).
  if (!opts.unicode) text = mapChars(foldDiacritics(mapChars(text)));

  let words = toWords(text, opts.unicode);

  if (opts.stripStopWords) {
    const kept = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
    // Stripping every word would leave an empty slug — keep the original then.
    if (kept.length > 0) words = kept;
  }

  words = applyCase(words, opts.casing);
  words = truncate(words, opts.separator, opts.maxLength);

  return words.join(opts.separator);
}

/**
 * Slugify a list, appending -2, -3 … to repeats the way a CMS does when two
 * posts share a title.
 */
export function slugifyList(
  lines: string[],
  options: Partial<SlugOptions> = {}
): { source: string; slug: string }[] {
  const opts = { ...DEFAULT_SLUG_OPTIONS, ...options };
  const seen = new Map<string, number>();
  const suffixJoin = opts.separator || "-";

  return lines.map((source) => {
    const base = slugify(source, opts);
    if (!base) return { source, slug: "" };
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { source, slug: count === 0 ? base : `${base}${suffixJoin}${count + 1}` };
  });
}

export interface SlugCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

/** The handful of things that actually bite you once a slug is live. */
export function checkSlug(slug: string): SlugCheck[] {
  if (!slug) return [];
  const words = slug.split(/[-_.]/).filter(Boolean);
  const ascii = /^[a-z0-9-]+$/.test(slug);
  const stopCount = words.filter((w) => STOP_WORDS.has(w.toLowerCase())).length;

  return [
    {
      id: "length",
      label: "Length",
      ok: slug.length <= 60,
      detail:
        slug.length <= 60
          ? `${slug.length} characters — comfortably inside search result width`
          : `${slug.length} characters — Google usually truncates past ~60`,
    },
    {
      id: "words",
      label: "Word count",
      ok: words.length <= 6,
      detail:
        words.length <= 6
          ? `${words.length} word${words.length === 1 ? "" : "s"} — easy to read and share`
          : `${words.length} words — trim to 3–6 for a cleaner URL`,
    },
    {
      id: "charset",
      label: "Safe characters",
      ok: ascii,
      detail: ascii
        ? "Lowercase ASCII and hyphens — no percent-encoding anywhere"
        : "Uppercase, underscores or non-ASCII get encoded or duplicated by some servers",
    },
    {
      id: "stopwords",
      label: "Filler words",
      ok: stopCount === 0,
      detail:
        stopCount === 0
          ? "No filler words carrying dead weight"
          : `${stopCount} filler word${stopCount === 1 ? "" : "s"} (the, and, of…) you can drop`,
    },
  ];
}

/** Percent-encoded form — shows what a non-ASCII slug turns into in a browser. */
export function encodedSlug(slug: string): string | null {
  const encoded = encodeURIComponent(slug);
  return encoded === slug ? null : encoded;
}
