/**
 * Brand Personality engine — Jennifer Aaker's five dimensions, scored by
 * reading real brand copy. A curated lexicon maps language to dimensions, so
 * pasting a tagline/mission reverse-engineers the personality it projects,
 * with word-level evidence. Pure functions; runs entirely on-device.
 */

export type DimensionId =
  | "sincerity"
  | "excitement"
  | "competence"
  | "sophistication"
  | "ruggedness";

export interface BrandDimension {
  id: DimensionId;
  name: string;
  color: string;
  facets: string[];
  blurb: string;
}

export const BRAND_DIMENSIONS: BrandDimension[] = [
  {
    id: "sincerity",
    name: "Sincerity",
    color: "#f59e0b",
    facets: ["Down-to-earth", "Honest", "Wholesome", "Cheerful"],
    blurb: "Warm, genuine and family-friendly.",
  },
  {
    id: "excitement",
    name: "Excitement",
    color: "#ec4899",
    facets: ["Daring", "Spirited", "Imaginative", "Up-to-date"],
    blurb: "Bold, youthful and full of energy.",
  },
  {
    id: "competence",
    name: "Competence",
    color: "#3b82f6",
    facets: ["Reliable", "Intelligent", "Successful"],
    blurb: "Trustworthy, capable and professional.",
  },
  {
    id: "sophistication",
    name: "Sophistication",
    color: "#a855f7",
    facets: ["Upper-class", "Charming", "Elegant"],
    blurb: "Premium, refined and aspirational.",
  },
  {
    id: "ruggedness",
    name: "Ruggedness",
    color: "#15803d",
    facets: ["Outdoorsy", "Tough", "Authentic"],
    blurb: "Sturdy, raw and built to last.",
  },
];

export const DIMENSION_BY_ID = Object.fromEntries(
  BRAND_DIMENSIONS.map((d) => [d.id, d])
) as Record<DimensionId, BrandDimension>;

export type BrandScores = Record<DimensionId, number>;

export const EMPTY_SCORES: BrandScores = {
  sincerity: 0,
  excitement: 0,
  competence: 0,
  sophistication: 0,
  ruggedness: 0,
};

/* ------------------------------- Lexicon --------------------------------- */

/** Word stems that signal each dimension. Tuned to minimise false positives. */
const LEXICON: Record<DimensionId, string[]> = {
  sincerity: [
    "honest", "genuine", "wholesome", "family", "friendly", "warm", "caring", "compassion",
    "natural", "organic", "pure", "fresh", "simple", "joyful", "cheer", "kindness", "community",
    "heartfelt", "approachable", "everyday", "comfort", "gentle", "loving", "happy", "sincere",
    "honesty", "wellbeing", "homemade", "neighbour", "neighbor",
  ],
  excitement: [
    "excit", "bold", "daring", "playful", "vibrant", "energetic", "energy", "dynamic", "adventur",
    "creativ", "imaginat", "spirit", "thrill", "lively", "youthful", "fearless", "vivid", "trend",
    "modern", "innovat", "electric", "unstoppable", "party", "fun", "fresh-", "wow", "buzz",
  ],
  competence: [
    "reliab", "intellig", "success", "profession", "expert", "trust", "secure", "proven", "quality",
    "efficien", "accura", "leader", "capable", "robust", "perform", "precis", "result", "solution",
    "technolog", "optimiz", "scalab", "enterprise", "guarantee", "smart", "confiden", "proficient",
    "industry", "standard", "data", "engineer",
  ],
  sophistication: [
    "luxur", "premium", "elegan", "refin", "exclusiv", "sophisticat", "prestig", "glamour", "charm",
    "beaut", "sleek", "timeless", "craft", "artisan", "opulent", "indulg", "finest", "elite",
    "bespoke", "curat", "exquisite", "couture", "sumptuous", "heirloom", "handcraft", "luxe",
  ],
  ruggedness: [
    "rugged", "tough", "strong", "durab", "outdoor", "nature", "mountain", "trail", "wilderness",
    "grit", "endur", "resilien", "sturdy", "hardy", "powerful", "explore", "wild", "rough", "trek",
    "backcountry", "weatherproof", "authentic", "built", "heavy-duty", "raw", "fearless-",
  ],
};

/** Flattened stem → dimension index, longest stems first for greedy matching. */
const STEM_INDEX: { stem: string; dim: DimensionId }[] = (
  Object.entries(LEXICON) as [DimensionId, string[]][]
)
  .flatMap(([dim, stems]) => stems.map((stem) => ({ stem, dim })))
  .sort((a, b) => b.stem.length - a.stem.length);

const SUFFIXES = ["", "s", "es", "ed", "ing", "er", "ly", "ness", "ful", "y"];

function stemMatches(stem: string, token: string): boolean {
  if (stem.length >= 5) return token.startsWith(stem);
  // Short stems are stricter to avoid false hits ("data" but not "date").
  return SUFFIXES.some((suf) => token === stem + suf);
}

function classify(token: string): DimensionId | null {
  const t = token.toLowerCase();
  for (const { stem, dim } of STEM_INDEX) {
    if (stemMatches(stem, t)) return dim;
  }
  return null;
}

export interface Segment {
  text: string;
  dim: DimensionId | null;
}

/** Split text into segments, tagging word tokens with the dimension they signal. */
export function segment(text: string): Segment[] {
  const parts = text.match(/[A-Za-z][A-Za-z'-]*|[^A-Za-z]+/g) ?? [];
  return parts.map((p) =>
    /^[A-Za-z]/.test(p) ? { text: p, dim: classify(p) } : { text: p, dim: null }
  );
}

export interface Analysis {
  scores: BrandScores;
  /** Matched words per dimension, with how many times each appeared. */
  evidence: Record<DimensionId, { word: string; count: number }[]>;
  /** Total signalling words found. */
  matches: number;
  /** Total words in the copy. */
  words: number;
}

export function analyze(text: string): Analysis {
  const counts: BrandScores = { ...EMPTY_SCORES };
  const found: Record<DimensionId, Map<string, number>> = {
    sincerity: new Map(),
    excitement: new Map(),
    competence: new Map(),
    sophistication: new Map(),
    ruggedness: new Map(),
  };
  let words = 0;
  let matches = 0;

  for (const seg of segment(text)) {
    if (!/^[A-Za-z]/.test(seg.text)) continue;
    words++;
    if (!seg.dim) continue;
    matches++;
    counts[seg.dim]++;
    const key = seg.text.toLowerCase();
    found[seg.dim].set(key, (found[seg.dim].get(key) ?? 0) + 1);
  }

  const max = Math.max(...BRAND_DIMENSIONS.map((d) => counts[d.id]));
  const scores: BrandScores = { ...EMPTY_SCORES };
  if (max > 0) {
    for (const d of BRAND_DIMENSIONS) {
      scores[d.id] = Math.round((counts[d.id] / max) * 100);
    }
  }

  const evidence = {} as Analysis["evidence"];
  for (const d of BRAND_DIMENSIONS) {
    evidence[d.id] = [...found[d.id].entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);
  }

  return { scores, evidence, matches, words };
}

/* --------------------------- Recommendations ----------------------------- */

export interface BrandRec {
  palette: string[];
  fonts: { heading: string; body: string };
  voice: string[];
  brands: string[];
  tip: string;
}

export const BRAND_RECS: Record<DimensionId, BrandRec> = {
  sincerity: {
    palette: ["#FBBF24", "#F59E0B", "#FCD34D", "#78350F", "#FFFBEB"],
    fonts: { heading: "Quicksand · Nunito (rounded humanist)", body: "Open Sans" },
    voice: ["warm", "honest", "caring", "approachable", "wholesome"],
    brands: ["Coca-Cola", "Dove", "Cadbury", "Hallmark"],
    tip: "Lean on warm tones, rounded shapes and candid photos of real people.",
  },
  excitement: {
    palette: ["#EC4899", "#F43F5E", "#FB923C", "#FACC15", "#8B5CF6"],
    fonts: { heading: "Poppins · Clash Display (expressive)", body: "Montserrat" },
    voice: ["bold", "playful", "energetic", "trendy", "daring"],
    brands: ["Red Bull", "Nike", "MTV", "Fanta"],
    tip: "Use vivid color, dynamic angles and a sense of motion everywhere.",
  },
  competence: {
    palette: ["#1D4ED8", "#3B82F6", "#0EA5E9", "#1E293B", "#F1F5F9"],
    fonts: { heading: "Inter · Helvetica (neutral grotesk)", body: "Inter" },
    voice: ["reliable", "clear", "confident", "precise", "professional"],
    brands: ["IBM", "Microsoft", "Volvo", "Visa"],
    tip: "Clean grids, blue tones and a calm, data-forward, restrained layout.",
  },
  sophistication: {
    palette: ["#0F0F0F", "#A855F7", "#D4AF37", "#1F2937", "#FAF5FF"],
    fonts: { heading: "Playfair Display · Didot (high-contrast serif)", body: "Cormorant" },
    voice: ["elegant", "refined", "exclusive", "understated", "premium"],
    brands: ["Chanel", "Apple", "Rolex", "Mercedes-Benz"],
    tip: "Generous whitespace, serif type and a monochrome base with one metallic accent.",
  },
  ruggedness: {
    palette: ["#15803D", "#166534", "#A16207", "#44403C", "#F5F5F4"],
    fonts: { heading: "Oswald · Roboto Slab (sturdy condensed/slab)", body: "Work Sans" },
    voice: ["tough", "authentic", "outdoorsy", "dependable", "raw"],
    brands: ["Jeep", "Levi's", "Timberland", "Harley-Davidson"],
    tip: "Textured naturals, strong heavy type and real outdoor imagery.",
  },
};

/* ------------------------------- Examples -------------------------------- */

export interface BrandExample {
  id: string;
  label: string;
  text: string;
}

export const BRAND_EXAMPLES: BrandExample[] = [
  {
    id: "watch",
    label: "Luxury watch",
    text: "Crafted by hand in Geneva, each timepiece is an exercise in restraint and refinement. Exquisite materials, a timeless silhouette and an elegant heirloom you pass down for generations — the finest expression of the watchmaker's craft.",
  },
  {
    id: "outdoor",
    label: "Outdoor gear",
    text: "Built for the backcountry. Our rugged, weatherproof gear is tested on the harshest trails so it endures whatever the mountain throws at you. Tough, dependable and authentic — ready to explore the wild and made to last.",
  },
  {
    id: "fintech",
    label: "Fintech",
    text: "Reliable, secure banking trusted by millions. Smart tools, proven performance and the professional, data-driven support you need to reach your goals with confidence. Enterprise-grade security, guaranteed.",
  },
  {
    id: "soda",
    label: "Soda",
    text: "Bold flavors, big fun. The daring, playful, ridiculously refreshing soda that brings the party. Vibrant, energetic and unapologetically joyful — a fresh, electric burst of imagination in every can.",
  },
];

/* ------------------------------- Read-outs ------------------------------- */

export function ranked(scores: BrandScores): BrandDimension[] {
  return [...BRAND_DIMENSIONS].sort((a, b) => scores[b.id] - scores[a.id]);
}

export function spread(scores: BrandScores): number {
  const vals = BRAND_DIMENSIONS.map((d) => scores[d.id]);
  return Math.max(...vals) - Math.min(...vals);
}

export function summarize(scores: BrandScores, matches: number): string {
  if (matches === 0) return "Paste some brand copy to read its personality.";
  const [first, second] = ranked(scores);
  if (spread(scores) < 25) {
    return "A balanced personality with no single dominant trait — versatile, though it may not feel distinctive yet.";
  }
  return `Your copy reads as a primarily ${first.name.toLowerCase()} brand — ${first.blurb.toLowerCase().replace(/\.$/, "")} — with a ${second.name.toLowerCase()} streak.`;
}

/* ------------------------------- Geometry -------------------------------- */

export function polarPoint(
  i: number,
  total: number,
  frac: number,
  cx: number,
  cy: number,
  r: number
): { x: number; y: number } {
  const angle = -Math.PI / 2 + (i / total) * Math.PI * 2;
  return { x: cx + Math.cos(angle) * r * frac, y: cy + Math.sin(angle) * r * frac };
}

export function radarPolygon(scores: BrandScores, cx: number, cy: number, r: number): string {
  return BRAND_DIMENSIONS.map((d, i) => {
    const p = polarPoint(i, BRAND_DIMENSIONS.length, scores[d.id] / 100, cx, cy, r);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");
}

export function toMarkdown(scores: BrandScores, matches: number): string {
  const [first, second] = ranked(scores);
  const rec = BRAND_RECS[first.id];
  return [
    `# Brand Personality Profile`,
    ``,
    `**Dominant:** ${first.name} · **Secondary:** ${second.name}`,
    ``,
    `## Scores`,
    ...BRAND_DIMENSIONS.map((d) => `- ${d.name}: ${scores[d.id]}/100`),
    ``,
    `## Direction`,
    summarize(scores, matches),
    ``,
    `## Recommended kit (${first.name})`,
    `- Palette: ${rec.palette.join(", ")}`,
    `- Type: ${rec.fonts.heading} / ${rec.fonts.body}`,
    `- Voice: ${rec.voice.join(", ")}`,
    `- In good company: ${rec.brands.join(", ")}`,
    `- Tip: ${rec.tip}`,
  ].join("\n");
}
