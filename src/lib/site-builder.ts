/**
 * Website Builder — the data model.
 *
 * A site is plain JSON: it survives a round trip through localStorage, a
 * downloaded backup and back without losing anything. Sections are described
 * by a catalogue (`BLOCKS`) that pairs each section with the fields a person
 * edits, so the inspector panel is generated rather than hand-written twenty
 * times. Rendering lives in site-builder-render.ts; nothing here touches the DOM.
 */
import { rgbToHex, type RGB } from "./colorExtract";
import { contrastRatio, parseHex } from "./contrast";
import { hexToHsl, hslToRgb } from "./palette";

/* ------------------------------------------------------------------ model */

export type Row = Record<string, string>;
export type PropValue = string | boolean | Row[];

export type BlockType =
  | "banner" | "nav" | "hero" | "logos" | "features" | "split" | "stats"
  | "steps" | "gallery" | "pricing" | "testimonials" | "faq" | "team"
  | "text" | "cta" | "contact" | "newsletter" | "embed" | "divider" | "footer";

export interface Block {
  id: string;
  type: BlockType;
  variant: string;
  /** Kept in the document but skipped when the page is built. */
  hidden: boolean;
  props: Record<string, PropValue>;
}

export type FieldKind =
  | "text" | "textarea" | "url" | "image" | "select" | "toggle" | "emoji" | "list" | "anchor";

export interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  help?: string;
  options?: readonly { value: string; label: string }[];
  /** list only — the fields of one row, plus the blank row a "+ Add" creates. */
  fields?: readonly Field[];
  item?: Row;
  itemName?: string;
  /** list: how many rows are allowed. text: the length that reads well. */
  max?: number;
}

export type BlockGroup = "Header" | "Opening" | "Content" | "Proof" | "Offer" | "Contact" | "Closing";

export interface BlockDef {
  type: BlockType;
  name: string;
  group: BlockGroup;
  blurb: string;
  /** Lucide icon name; the picker resolves it. */
  icon: string;
  variants: readonly { value: string; label: string }[];
  fields: readonly Field[];
  defaults: Record<string, PropValue>;
  /** Sections a page only wants one of. */
  once?: boolean;
}

export type Scheme = "light" | "dark";

export interface Theme {
  brand: string;
  accent: string;
  scheme: Scheme;
  font: FontId;
  density: "tight" | "regular" | "airy";
  radius: "square" | "soft" | "round" | "pill";
  buttons: "solid" | "soft" | "outline";
  shadow: "none" | "soft" | "lifted";
  pattern: "none" | "dots" | "grid" | "glow" | "rays";
  width: "narrow" | "regular" | "wide";
  headings: "regular" | "tight" | "display";
  animate: boolean;
}

export interface Identity {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  kind: string;
}

export interface Meta {
  title: string;
  description: string;
  favicon: string;
  lang: string;
  url: string;
  ogImage: string;
  indexable: boolean;
}

export interface Snapshot {
  id: string;
  name: string;
  date: number;
  blocks: Block[];
  theme: Theme;
}

export interface Site {
  id: string;
  name: string;
  meta: Meta;
  identity: Identity;
  theme: Theme;
  blocks: Block[];
  snapshots: Snapshot[];
  updated: number;
}

export const STORAGE_KEY = "tm-website-builder-v1";
export const MAX_SITES = 40;
export const MAX_BLOCKS = 60;
export const MAX_SNAPSHOTS = 20;
/** Data-URL images above this size make an export painful to host. */
export const IMAGE_WARN_BYTES = 300_000;

/* ------------------------------------------------------------ prop access */

export function str(block: Block, key: string, fallback = ""): string {
  const value = block.props[key];
  return typeof value === "string" ? value : fallback;
}
export function bool(block: Block, key: string, fallback = false): boolean {
  const value = block.props[key];
  return typeof value === "boolean" ? value : fallback;
}
export function rows(block: Block, key: string): Row[] {
  const value = block.props[key];
  return Array.isArray(value) ? value : [];
}

/* ------------------------------------------------------------ typography */

export type FontId =
  | "modern" | "editorial" | "classic" | "statement" | "tech" | "friendly" | "elegant" | "native";

export interface FontPair {
  id: FontId;
  name: string;
  note: string;
  heading: string;
  body: string;
  /** Google Fonts family declarations, empty when the pair uses system fonts. */
  google: readonly string[];
  headingWeight: number;
}

const SYSTEM_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const FONTS: readonly FontPair[] = [
  { id: "modern", name: "Modern", note: "Clean and neutral. Works for anything", heading: `Inter, ${SYSTEM_STACK}`, body: `Inter, ${SYSTEM_STACK}`, google: ["Inter:wght@400;500;600;700;800"], headingWeight: 700 },
  { id: "editorial", name: "Editorial", note: "Warm serif headlines, quiet body text", heading: `Fraunces, Georgia, serif`, body: `Inter, ${SYSTEM_STACK}`, google: ["Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700", "Inter:wght@400;500;600"], headingWeight: 600 },
  { id: "classic", name: "Classic", note: "Timeless and formal", heading: `"Playfair Display", Georgia, serif`, body: `"Source Sans 3", ${SYSTEM_STACK}`, google: ["Playfair+Display:wght@500;600;700", "Source+Sans+3:wght@400;500;600"], headingWeight: 600 },
  { id: "statement", name: "Statement", note: "Loud headlines that fill the screen", heading: `Archivo, ${SYSTEM_STACK}`, body: `Archivo, ${SYSTEM_STACK}`, google: ["Archivo:wght@400;500;600;800;900"], headingWeight: 800 },
  { id: "tech", name: "Tech", note: "Precise, product-shaped", heading: `"Space Grotesk", ${SYSTEM_STACK}`, body: `"IBM Plex Sans", ${SYSTEM_STACK}`, google: ["Space+Grotesk:wght@500;600;700", "IBM+Plex+Sans:wght@400;500;600"], headingWeight: 700 },
  { id: "friendly", name: "Friendly", note: "Rounded and approachable", heading: `Poppins, ${SYSTEM_STACK}`, body: `"Nunito Sans", ${SYSTEM_STACK}`, google: ["Poppins:wght@500;600;700", "Nunito+Sans:wght@400;600"], headingWeight: 600 },
  { id: "elegant", name: "Elegant", note: "Light, spacious, high-end", heading: `"Cormorant Garamond", Georgia, serif`, body: `Jost, ${SYSTEM_STACK}`, google: ["Cormorant+Garamond:wght@500;600;700", "Jost:wght@300;400;500"], headingWeight: 600 },
  { id: "native", name: "System", note: "Loads instantly, no web fonts", heading: SYSTEM_STACK, body: SYSTEM_STACK, google: [], headingWeight: 700 },
];

export const fontPair = (id: FontId): FontPair => FONTS.find((f) => f.id === id) ?? FONTS[0];

/* ---------------------------------------------------------------- colour */

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const hsl = (h: number, s: number, l: number) => rgbToHex(hslToRgb(h, clamp(s, 0, 100), clamp(l, 0, 100)));

/** Hex → RGB with a safe fallback, so a half-typed colour never breaks a render. */
export function safeRgb(hex: string, fallback: RGB = [16, 132, 96]): RGB {
  return parseHex(hex) ?? fallback;
}

/** Black or white — whichever is readable on the given colour. */
export function readableOn(hex: string): string {
  const rgb = safeRgb(hex);
  return contrastRatio(rgb, [255, 255, 255]) >= contrastRatio(rgb, [17, 17, 17]) ? "#ffffff" : "#111111";
}

export function ratioOn(foreground: string, background: string): number {
  return contrastRatio(safeRgb(foreground), safeRgb(background, [255, 255, 255]));
}

const RADIUS: Record<Theme["radius"], [string, string, string]> = {
  square: ["0px", "0px", "0px"],
  soft: ["6px", "10px", "14px"],
  round: ["10px", "18px", "26px"],
  pill: ["999px", "24px", "32px"],
};
const DENSITY: Record<Theme["density"], [string, string]> = {
  tight: ["clamp(40px, 6vw, 64px)", "20px"],
  regular: ["clamp(56px, 8vw, 104px)", "24px"],
  airy: ["clamp(64px, 9vw, 132px)", "28px"],
};
const WIDTH: Record<Theme["width"], string> = { narrow: "960px", regular: "1140px", wide: "1320px" };
const HEADING_SCALE: Record<Theme["headings"], [string, string]> = {
  regular: ["clamp(2.1rem, 1.3rem + 3.2vw, 3.6rem)", "1.12"],
  tight: ["clamp(2rem, 1.2rem + 2.6vw, 3.1rem)", "1.06"],
  display: ["clamp(2.4rem, 1.2rem + 4.8vw, 5rem)", "1.02"],
};
const SHADOW: Record<Theme["shadow"], [string, string]> = {
  none: ["none", "none"],
  soft: ["0 1px 2px rgba(15,23,42,.06), 0 8px 24px -12px rgba(15,23,42,.18)", "0 2px 6px rgba(15,23,42,.08)"],
  lifted: ["0 2px 6px rgba(15,23,42,.08), 0 24px 48px -20px rgba(15,23,42,.35)", "0 6px 16px rgba(15,23,42,.14)"],
};

/**
 * The whole design system as CSS custom properties. Everything downstream —
 * every section, button and card — reads these, so one colour change restyles
 * the entire page consistently.
 */
export function themeTokens(theme: Theme): Record<string, string> {
  const brand = parseHex(theme.brand) ? theme.brand : "#108460";
  const accent = parseHex(theme.accent) ? theme.accent : brand;
  const b = hexToHsl(brand);
  const dark = theme.scheme === "dark";
  const [pad, gap] = DENSITY[theme.density];
  const [radiusSm, radiusMd, radiusLg] = RADIUS[theme.radius];
  const [h1, h1Line] = HEADING_SCALE[theme.headings];
  const [shadowLg, shadowSm] = SHADOW[theme.shadow];
  const font = fontPair(theme.font);
  const tint = clamp(b.s, 6, 26);

  return {
    "--brand": brand,
    "--brand-strong": hsl(b.h, b.s, clamp(b.l - 9, 8, 92)),
    "--brand-soft": dark ? hsl(b.h, clamp(b.s, 10, 46), 17) : hsl(b.h, clamp(b.s, 12, 64), 95),
    "--brand-line": dark ? hsl(b.h, clamp(b.s, 10, 40), 28) : hsl(b.h, clamp(b.s, 10, 50), 86),
    "--on-brand": readableOn(brand),
    "--accent": accent,
    "--on-accent": readableOn(accent),
    "--ink": dark ? hsl(b.h, tint * 0.4, 97) : hsl(b.h, tint * 0.5, 11),
    "--body": dark ? hsl(b.h, tint * 0.3, 80) : hsl(b.h, tint * 0.35, 33),
    "--muted": dark ? hsl(b.h, tint * 0.25, 64) : hsl(b.h, tint * 0.3, 47),
    "--line": dark ? hsl(b.h, tint * 0.3, 22) : hsl(b.h, tint * 0.4, 89),
    "--canvas": dark ? hsl(b.h, tint * 0.35, 8) : "#ffffff",
    "--surface": dark ? hsl(b.h, tint * 0.35, 12) : hsl(b.h, tint * 0.45, 97),
    "--card": dark ? hsl(b.h, tint * 0.3, 13) : "#ffffff",
    "--font-heading": font.heading,
    "--font-body": font.body,
    "--weight-heading": String(font.headingWeight),
    "--h1": h1,
    "--h1-line": h1Line,
    "--h2": "clamp(1.55rem, 1.1rem + 1.7vw, 2.4rem)",
    "--h3": "clamp(1.15rem, 1rem + 0.5vw, 1.4rem)",
    "--lead": "clamp(1.05rem, 1rem + 0.35vw, 1.22rem)",
    "--radius-sm": radiusSm,
    "--radius-md": radiusMd,
    "--radius-lg": radiusLg,
    "--section-pad": pad,
    "--gap": gap,
    "--container": WIDTH[theme.width],
    "--shadow": shadowLg,
    "--shadow-sm": shadowSm,
  };
}

export const THEME_PRESETS: readonly { id: string; name: string; theme: Partial<Theme> }[] = [
  { id: "forest", name: "Forest", theme: { brand: "#0f766e", accent: "#f59e0b", scheme: "light", font: "modern", radius: "round", pattern: "none" } },
  { id: "ink", name: "Ink", theme: { brand: "#111827", accent: "#2563eb", scheme: "light", font: "editorial", radius: "soft", pattern: "none" } },
  { id: "midnight", name: "Midnight", theme: { brand: "#6366f1", accent: "#22d3ee", scheme: "dark", font: "tech", radius: "round", pattern: "glow" } },
  { id: "sunset", name: "Sunset", theme: { brand: "#ea580c", accent: "#be123c", scheme: "light", font: "statement", radius: "soft", pattern: "rays" } },
  { id: "bloom", name: "Bloom", theme: { brand: "#be185d", accent: "#7c3aed", scheme: "light", font: "friendly", radius: "pill", pattern: "dots" } },
  { id: "sand", name: "Sand", theme: { brand: "#a16207", accent: "#0f766e", scheme: "light", font: "elegant", radius: "soft", pattern: "none" } },
  { id: "ocean", name: "Ocean", theme: { brand: "#0284c7", accent: "#0f766e", scheme: "light", font: "modern", radius: "round", pattern: "grid" } },
  { id: "noir", name: "Noir", theme: { brand: "#e5e7eb", accent: "#f59e0b", scheme: "dark", font: "statement", radius: "square", pattern: "none" } },
];

export const DEFAULT_THEME: Theme = {
  brand: "#0f766e",
  accent: "#f59e0b",
  scheme: "light",
  font: "modern",
  density: "regular",
  radius: "round",
  buttons: "solid",
  shadow: "soft",
  pattern: "none",
  width: "regular",
  headings: "regular",
  animate: true,
};

/* ------------------------------------------------------------------ links */

/**
 * Only let through schemes that make sense in a static page. Anything odd —
 * `javascript:` above all — becomes a harmless anchor.
 */
export function safeHref(input: string): string {
  const value = input.trim();
  if (!value) return "#";
  if (/^(https?:\/\/|mailto:|tel:|sms:|#|\/|\.\/|\.\.\/)/i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value)) return `https://${value}`;
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value)) return `mailto:${value}`;
  return "#";
}

export const slugify = (input: string): string =>
  input.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** Stable `id` for every section, so nav links can point at them. */
export function sectionAnchors(blocks: Block[]): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();
  blocks.forEach((block, index) => {
    const label = str(block, "anchor") || str(block, "heading") || str(block, "headline") || defOf(block.type).name;
    let slug = slugify(label) || `section-${index + 1}`;
    if (/^\d/.test(slug)) slug = `s-${slug}`;
    let candidate = slug;
    let n = 2;
    while (used.has(candidate)) candidate = `${slug}-${n++}`;
    used.add(candidate);
    map.set(block.id, candidate);
  });
  return map;
}

/* -------------------------------------------------------------- catalogue */

const listField = (
  key: string,
  label: string,
  itemName: string,
  fields: Field[],
  item: Row,
  max = 12,
): Field => ({ key, label, kind: "list", itemName, fields, item, max });

const HEADING: Field = { key: "heading", label: "Section heading", kind: "text", placeholder: "What this section is about", max: 60 };
const INTRO: Field = { key: "intro", label: "Short intro", kind: "textarea", placeholder: "One or two sentences of context", max: 180 };
const COLUMNS: Field = {
  key: "columns", label: "Columns", kind: "select",
  options: [{ value: "2", label: "Two" }, { value: "3", label: "Three" }, { value: "4", label: "Four" }],
};

export const BLOCKS: readonly BlockDef[] = [
  {
    type: "banner", name: "Announcement bar", group: "Header", icon: "MegaphoneIcon", once: true,
    blurb: "A thin strip at the very top for news, an offer or opening hours.",
    variants: [{ value: "brand", label: "Brand colour" }, { value: "soft", label: "Soft tint" }, { value: "dark", label: "Dark" }],
    fields: [
      { key: "text", label: "Message", kind: "text", placeholder: "Free delivery this week", max: 90 },
      { key: "linkLabel", label: "Link text", kind: "text", placeholder: "See details" },
      { key: "linkHref", label: "Link goes to", kind: "url", placeholder: "#offers" },
    ],
    defaults: { text: "New: book online and save 10%", linkLabel: "See details", linkHref: "#pricing" },
  },
  {
    type: "nav", name: "Navigation", group: "Header", icon: "MenuIcon", once: true,
    blurb: "Your logo and the menu. Turns into a tap-to-open menu on phones.",
    variants: [{ value: "left", label: "Logo left" }, { value: "center", label: "Logo centred" }, { value: "split", label: "Menu split" }],
    fields: [
      { key: "logoText", label: "Business name", kind: "text", placeholder: "Your name" },
      { key: "logoImage", label: "Logo image", kind: "image", help: "Optional. Replaces the text logo." },
      listField("links", "Menu links", "link",
        [{ key: "label", label: "Label", kind: "text" }, { key: "href", label: "Goes to", kind: "anchor" }],
        { label: "New link", href: "#" }, 7),
      { key: "ctaLabel", label: "Button text", kind: "text", placeholder: "Book now" },
      { key: "ctaHref", label: "Button goes to", kind: "anchor" },
      { key: "sticky", label: "Stay visible while scrolling", kind: "toggle" },
    ],
    defaults: {
      logoText: "Your business", logoImage: "", ctaLabel: "Get in touch", ctaHref: "#contact", sticky: true,
      links: [{ label: "About", href: "#about" }, { label: "Services", href: "#services" }, { label: "Contact", href: "#contact" }],
    },
  },
  {
    type: "hero", name: "Hero", group: "Opening", icon: "SparklesIcon",
    blurb: "The first thing a visitor reads: what you do and what to do next.",
    variants: [
      { value: "split", label: "Text + image" }, { value: "center", label: "Centred" },
      { value: "image", label: "Image background" }, { value: "minimal", label: "Minimal" },
    ],
    fields: [
      { key: "eyebrow", label: "Small line above", kind: "text", placeholder: "Bakery in Lisbon", max: 40 },
      { key: "headline", label: "Headline", kind: "text", placeholder: "Say what you do, plainly", max: 70 },
      { key: "subhead", label: "Supporting text", kind: "textarea", placeholder: "One or two sentences that answer: what is this, who is it for?", max: 220 },
      { key: "primaryLabel", label: "Main button", kind: "text", placeholder: "Book a table" },
      { key: "primaryHref", label: "Main button goes to", kind: "anchor" },
      { key: "secondaryLabel", label: "Second button", kind: "text", placeholder: "See the menu" },
      { key: "secondaryHref", label: "Second button goes to", kind: "anchor" },
      { key: "note", label: "Small note under the buttons", kind: "text", placeholder: "Open Tuesday to Sunday" },
      { key: "image", label: "Image", kind: "image" },
      { key: "imageAlt", label: "Image description", kind: "text", help: "Describe the image for screen readers and search engines." },
    ],
    defaults: {
      eyebrow: "", headline: "A clear promise in one short line", subhead: "Explain what you offer and who it is for. Keep it to two sentences. The details come further down the page.",
      primaryLabel: "Get in touch", primaryHref: "#contact", secondaryLabel: "See our work", secondaryHref: "#work",
      note: "", image: "", imageAlt: "",
    },
  },
  {
    type: "logos", name: "Trust strip", group: "Proof", icon: "BadgeCheckIcon",
    blurb: "A quiet row of partners, clients, press or certifications.",
    variants: [{ value: "row", label: "Single row" }, { value: "boxed", label: "In a panel" }],
    fields: [
      { key: "heading", label: "Small heading", kind: "text", placeholder: "Trusted by" },
      listField("items", "Logos", "logo",
        [{ key: "label", label: "Name", kind: "text" }, { key: "image", label: "Logo image", kind: "image" }],
        { label: "Client name", image: "" }, 10),
    ],
    defaults: { heading: "Trusted by teams who care about detail", items: [{ label: "Northwind", image: "" }, { label: "Studio Mera", image: "" }, { label: "Bluehouse", image: "" }, { label: "Marren & Co", image: "" }] },
  },
  {
    type: "features", name: "Features", group: "Content", icon: "LayoutGridIcon",
    blurb: "Three or four things you offer, each with a line of explanation.",
    variants: [
      { value: "cards", label: "Cards" }, { value: "plain", label: "Plain" },
      { value: "numbered", label: "Numbered" }, { value: "checklist", label: "Checklist" },
    ],
    fields: [
      HEADING, INTRO, COLUMNS,
      listField("items", "Items", "item",
        [
          { key: "icon", label: "Icon", kind: "emoji" },
          { key: "title", label: "Title", kind: "text", max: 40 },
          { key: "text", label: "Description", kind: "textarea", max: 160 },
        ],
        { icon: "✨", title: "New item", text: "Describe it in one sentence." }, 12),
    ],
    defaults: {
      heading: "What we do", intro: "", columns: "3",
      items: [
        { icon: "🎯", title: "Clear thinking", text: "We start with the problem, not the pixels." },
        { icon: "⚡", title: "Fast turnaround", text: "Most projects ship inside four weeks." },
        { icon: "🤝", title: "Straight answers", text: "One contact, no account managers in between." },
      ],
    },
  },
  {
    type: "split", name: "Image + text", group: "Content", icon: "ColumnsIcon",
    blurb: "A picture beside a paragraph: your story, a service or a product.",
    variants: [{ value: "right", label: "Image right" }, { value: "left", label: "Image left" }, { value: "wide", label: "Wide image" }],
    fields: [
      { key: "eyebrow", label: "Small line above", kind: "text", max: 40 },
      { key: "heading", label: "Heading", kind: "text", max: 60 },
      { key: "text", label: "Paragraph", kind: "textarea", placeholder: "Two or three sentences. Blank lines start a new paragraph.", max: 600 },
      listField("bullets", "Bullet points", "point", [{ key: "text", label: "Point", kind: "text" }], { text: "Something worth knowing" }, 8),
      { key: "ctaLabel", label: "Button text", kind: "text" },
      { key: "ctaHref", label: "Button goes to", kind: "anchor" },
      { key: "image", label: "Image", kind: "image" },
      { key: "imageAlt", label: "Image description", kind: "text" },
    ],
    defaults: {
      eyebrow: "About us", heading: "A short story about how you started",
      text: "Say who you are and why this exists. People buy from people, and two honest paragraphs beat a page of adjectives.",
      bullets: [{ text: "Family run since 2014" }, { text: "Everything made in house" }],
      ctaLabel: "", ctaHref: "", image: "", imageAlt: "",
    },
  },
  {
    type: "stats", name: "Numbers", group: "Proof", icon: "TrendingUpIcon",
    blurb: "Three or four numbers that prove you are real: years, clients, ratings.",
    variants: [{ value: "plain", label: "Plain" }, { value: "cards", label: "Cards" }, { value: "band", label: "Brand band" }],
    fields: [
      { key: "heading", label: "Small heading", kind: "text" },
      listField("items", "Numbers", "number",
        [{ key: "value", label: "Number", kind: "text", placeholder: "12" }, { key: "label", label: "Label", kind: "text", placeholder: "years in business" }],
        { value: "100+", label: "what it counts" }, 6),
    ],
    defaults: { heading: "", items: [{ value: "12", label: "years in business" }, { value: "450+", label: "projects delivered" }, { value: "4.9★", label: "average review" }] },
  },
  {
    type: "steps", name: "How it works", group: "Content", icon: "ListOrderedIcon",
    blurb: "Three steps from first contact to finished job. Removes hesitation.",
    variants: [{ value: "numbered", label: "Numbered" }, { value: "timeline", label: "Timeline" }, { value: "cards", label: "Cards" }],
    fields: [
      HEADING, INTRO,
      listField("items", "Steps", "step",
        [{ key: "title", label: "Step title", kind: "text", max: 40 }, { key: "text", label: "What happens", kind: "textarea", max: 160 }],
        { title: "Next step", text: "Explain what happens here." }, 8),
    ],
    defaults: {
      heading: "How it works", intro: "",
      items: [
        { title: "Say hello", text: "Tell us what you need. A short message is enough to start." },
        { title: "Get a plan", text: "We send a fixed quote and a date, usually within two days." },
        { title: "We deliver", text: "You approve the work before anything goes live." },
      ],
    },
  },
  {
    type: "gallery", name: "Gallery", group: "Content", icon: "ImagesIcon",
    blurb: "Your work, your room, your food. Pictures do the selling.",
    variants: [{ value: "grid", label: "Even grid" }, { value: "mixed", label: "Mixed sizes" }, { value: "strip", label: "Scrolling strip" }],
    fields: [
      HEADING, INTRO, COLUMNS,
      listField("items", "Pictures", "picture",
        [{ key: "image", label: "Picture", kind: "image" }, { key: "alt", label: "Description", kind: "text" }, { key: "caption", label: "Caption", kind: "text" }],
        { image: "", alt: "", caption: "" }, 16),
    ],
    defaults: { heading: "Recent work", intro: "", columns: "3", items: [{ image: "", alt: "", caption: "" }, { image: "", alt: "", caption: "" }, { image: "", alt: "", caption: "" }] },
  },
  {
    type: "pricing", name: "Pricing or menu", group: "Offer", icon: "TagIcon",
    blurb: "Packages with prices, or a menu list. Put a badge on the one you want chosen.",
    variants: [{ value: "cards", label: "Package cards" }, { value: "menu", label: "Menu list" }, { value: "simple", label: "Simple rows" }],
    fields: [
      HEADING, INTRO,
      listField("items", "Items", "item",
        [
          { key: "name", label: "Name", kind: "text" },
          { key: "price", label: "Price", kind: "text", placeholder: "€49" },
          { key: "period", label: "Per", kind: "text", placeholder: "month" },
          { key: "description", label: "One line about it", kind: "text" },
          { key: "features", label: "Included (one per line)", kind: "textarea" },
          { key: "badge", label: "Badge", kind: "text", placeholder: "Most popular", help: "Any text here highlights this card." },
          { key: "ctaLabel", label: "Button text", kind: "text" },
          { key: "ctaHref", label: "Button goes to", kind: "anchor" },
        ],
        { name: "New package", price: "€0", period: "", description: "", features: "First thing\nSecond thing", badge: "", ctaLabel: "Choose", ctaHref: "#contact" }, 8),
      { key: "note", label: "Small note below", kind: "text", placeholder: "Prices include VAT" },
    ],
    defaults: {
      heading: "Simple pricing", intro: "", note: "",
      items: [
        { name: "Starter", price: "€250", period: "one-off", description: "For a single page done properly.", features: "One page\nMobile ready\nTwo rounds of changes", badge: "", ctaLabel: "Start here", ctaHref: "#contact" },
        { name: "Complete", price: "€650", period: "one-off", description: "Everything a small business needs.", features: "Up to five pages\nContact form\nSearch basics\nOne year of small fixes", badge: "Most popular", ctaLabel: "Get started", ctaHref: "#contact" },
        { name: "Custom", price: "Let's talk", period: "", description: "Bigger job, shop or booking system.", features: "Scoped together\nFixed quote\nNo surprises", badge: "", ctaLabel: "Ask a question", ctaHref: "#contact" },
      ],
    },
  },
  {
    type: "testimonials", name: "Testimonials", group: "Proof", icon: "QuoteIcon",
    blurb: "What customers said. Real names and roles make it believable.",
    variants: [{ value: "cards", label: "Cards" }, { value: "single", label: "One big quote" }, { value: "wall", label: "Quote wall" }],
    fields: [
      HEADING,
      listField("items", "Quotes", "quote",
        [
          { key: "quote", label: "What they said", kind: "textarea", max: 260 },
          { key: "name", label: "Name", kind: "text" },
          { key: "role", label: "Role or company", kind: "text" },
          { key: "photo", label: "Photo", kind: "image" },
          { key: "rating", label: "Stars", kind: "select", options: [{ value: "", label: "No stars" }, { value: "5", label: "5" }, { value: "4", label: "4" }] },
        ],
        { quote: "They were quick, clear and the result speaks for itself.", name: "New reviewer", role: "", photo: "", rating: "5" }, 9),
    ],
    defaults: {
      heading: "What people say",
      items: [
        { quote: "They understood what we needed in one conversation and delivered a week early.", name: "Marta Silva", role: "Owner, Café Norte", photo: "", rating: "5" },
        { quote: "Clear pricing, no jargon, and the site finally looks like us.", name: "Tomás Reis", role: "Founder, Bluehouse", photo: "", rating: "5" },
      ],
    },
  },
  {
    type: "faq", name: "Questions", group: "Content", icon: "CircleHelpIcon",
    blurb: "Answer the five things people always ask before they buy.",
    variants: [{ value: "list", label: "Single column" }, { value: "columns", label: "Two columns" }],
    fields: [
      HEADING, INTRO,
      listField("items", "Questions", "question",
        [{ key: "question", label: "Question", kind: "text" }, { key: "answer", label: "Answer", kind: "textarea", max: 400 }],
        { question: "A question people ask", answer: "A short, honest answer." }, 14),
    ],
    defaults: {
      heading: "Common questions", intro: "",
      items: [
        { question: "How much does it cost?", answer: "Most projects land between €250 and €650. You get a fixed quote before anything starts." },
        { question: "How long does it take?", answer: "Usually two to four weeks, depending on how quickly the content comes together." },
        { question: "Do you look after it afterwards?", answer: "Yes. Small changes are included for the first year." },
      ],
    },
  },
  {
    type: "team", name: "Team", group: "Proof", icon: "UsersIcon",
    blurb: "Faces and names. Especially useful for local and service businesses.",
    variants: [{ value: "cards", label: "Cards" }, { value: "plain", label: "Plain" }],
    fields: [
      HEADING, INTRO, COLUMNS,
      listField("items", "People", "person",
        [
          { key: "name", label: "Name", kind: "text" }, { key: "role", label: "Role", kind: "text" },
          { key: "photo", label: "Photo", kind: "image" }, { key: "link", label: "Profile link", kind: "url" },
        ],
        { name: "New person", role: "Role", photo: "", link: "" }, 12),
    ],
    defaults: { heading: "The people behind it", intro: "", columns: "3", items: [{ name: "Ana Duarte", role: "Founder", photo: "", link: "" }, { name: "Rui Matos", role: "Head baker", photo: "", link: "" }] },
  },
  {
    type: "text", name: "Text block", group: "Content", icon: "TypeIcon",
    blurb: "A plain block of writing: your story, a policy, an update.",
    variants: [{ value: "narrow", label: "Narrow column" }, { value: "wide", label: "Full width" }, { value: "twocol", label: "Two columns" }],
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "body", label: "Text", kind: "textarea", placeholder: "Blank lines start a new paragraph. *Italic*, **bold** and [links](https://example.com) work.", max: 3000 },
    ],
    defaults: { heading: "Our story", body: "Write freely here.\n\nBlank lines start a new paragraph, **bold** and [links](https://example.com) work as you would expect." },
  },
  {
    type: "cta", name: "Call to action", group: "Closing", icon: "MousePointerClickIcon",
    blurb: "One clear ask before the footer: call, book, buy, subscribe.",
    variants: [{ value: "band", label: "Brand band" }, { value: "card", label: "Card" }, { value: "split", label: "Text + button" }],
    fields: [
      { key: "headline", label: "Headline", kind: "text", max: 60 },
      { key: "text", label: "Supporting line", kind: "textarea", max: 180 },
      { key: "buttonLabel", label: "Button text", kind: "text" },
      { key: "buttonHref", label: "Button goes to", kind: "anchor" },
      { key: "secondaryLabel", label: "Second button", kind: "text" },
      { key: "secondaryHref", label: "Second button goes to", kind: "anchor" },
      { key: "note", label: "Small note", kind: "text" },
    ],
    defaults: { headline: "Ready when you are", text: "Tell us what you need and we will come back within one working day.", buttonLabel: "Get in touch", buttonHref: "#contact", secondaryLabel: "", secondaryHref: "", note: "" },
  },
  {
    type: "contact", name: "Contact", group: "Contact", icon: "MailIcon",
    blurb: "How to reach you, with a working form. No server needed.",
    variants: [{ value: "split", label: "Form + details" }, { value: "details", label: "Details only" }, { value: "form", label: "Form only" }],
    fields: [
      HEADING, INTRO,
      { key: "email", label: "Email", kind: "text" },
      { key: "phone", label: "Phone", kind: "text" },
      { key: "address", label: "Address", kind: "textarea" },
      { key: "hours", label: "Opening hours", kind: "textarea" },
      { key: "mapUrl", label: "Map link", kind: "url", placeholder: "https://maps.google.com/..." },
      {
        key: "formMode", label: "Where the form goes", kind: "select",
        options: [
          { value: "mailto", label: "Open the visitor's email app" },
          { value: "post", label: "Send to a form service (Formspree, Getform…)" },
        ],
        help: "A page with no server cannot email you by itself. Both options work on any host.",
      },
      { key: "formAction", label: "Form service address", kind: "url", placeholder: "https://formspree.io/f/xxxxxx" },
      { key: "buttonLabel", label: "Send button text", kind: "text" },
      { key: "messageLabel", label: "Message field label", kind: "text" },
      { key: "privacyNote", label: "Small note under the form", kind: "text" },
    ],
    defaults: {
      heading: "Get in touch", intro: "Tell us a little about what you need.",
      email: "hello@example.com", phone: "", address: "", hours: "", mapUrl: "",
      formMode: "mailto", formAction: "", buttonLabel: "Send message", messageLabel: "How can we help?",
      privacyNote: "We reply within one working day.",
    },
  },
  {
    type: "newsletter", name: "Email sign-up", group: "Closing", icon: "SendIcon",
    blurb: "Collect emails with your existing provider (Mailchimp, Buttondown…).",
    variants: [{ value: "band", label: "Brand band" }, { value: "inline", label: "Inline" }],
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "text", label: "Supporting line", kind: "textarea" },
      { key: "action", label: "Sign-up form address", kind: "url", placeholder: "https://…/subscribe", help: "Copy this from your email provider's embedded form." },
      { key: "buttonLabel", label: "Button text", kind: "text" },
      { key: "note", label: "Small note", kind: "text" },
    ],
    defaults: { heading: "News worth reading", text: "One short email a month. Unsubscribe any time.", action: "", buttonLabel: "Subscribe", note: "No spam, ever." },
  },
  {
    type: "embed", name: "Video or map", group: "Content", icon: "PlayIcon",
    blurb: "Drop in a YouTube video, a map or any embed address.",
    variants: [{ value: "video", label: "Video" }, { value: "map", label: "Map" }, { value: "raw", label: "Custom embed code" }],
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "url", label: "Address", kind: "url", placeholder: "https://www.youtube.com/watch?v=…", help: "Paste the normal page address and we convert it." },
      { key: "html", label: "Embed code", kind: "textarea", help: "Only used by the custom option. Paste the code your provider gave you." },
      { key: "caption", label: "Caption", kind: "text" },
      { key: "ratio", label: "Shape", kind: "select", options: [{ value: "16x9", label: "Widescreen" }, { value: "4x3", label: "Classic" }, { value: "1x1", label: "Square" }, { value: "21x9", label: "Cinematic" }] },
    ],
    defaults: { heading: "", url: "", html: "", caption: "", ratio: "16x9" },
  },
  {
    type: "divider", name: "Divider", group: "Content", icon: "MinusIcon",
    blurb: "A line or some breathing room between sections.",
    variants: [{ value: "line", label: "Line" }, { value: "space", label: "Empty space" }, { value: "label", label: "Line with text" }],
    fields: [
      { key: "label", label: "Text in the middle", kind: "text" },
      { key: "size", label: "Height", kind: "select", options: [{ value: "s", label: "Small" }, { value: "m", label: "Medium" }, { value: "l", label: "Large" }] },
    ],
    defaults: { label: "", size: "m" },
  },
  {
    type: "footer", name: "Footer", group: "Closing", icon: "PanelBottomIcon", once: true,
    blurb: "The last word: contact details, links and the small print.",
    variants: [{ value: "simple", label: "Simple" }, { value: "columns", label: "Columns" }, { value: "big", label: "Large" }],
    fields: [
      { key: "logoText", label: "Business name", kind: "text" },
      { key: "tagline", label: "One line about you", kind: "textarea", max: 160 },
      listField("links", "Links", "link", [{ key: "label", label: "Label", kind: "text" }, { key: "href", label: "Goes to", kind: "anchor" }], { label: "New link", href: "#" }, 10),
      listField("social", "Social profiles", "profile", [{ key: "label", label: "Network", kind: "text" }, { key: "href", label: "Address", kind: "url" }], { label: "Instagram", href: "" }, 8),
      { key: "email", label: "Email", kind: "text" },
      { key: "phone", label: "Phone", kind: "text" },
      { key: "address", label: "Address", kind: "textarea" },
      { key: "copyright", label: "Small print", kind: "text", placeholder: "© 2026 Your business" },
    ],
    defaults: {
      logoText: "Your business", tagline: "", email: "", phone: "", address: "",
      links: [{ label: "About", href: "#about" }, { label: "Contact", href: "#contact" }],
      social: [], copyright: "",
    },
  },
];

const BLOCK_BY_TYPE = new Map(BLOCKS.map((def) => [def.type, def]));
export const defOf = (type: BlockType): BlockDef => BLOCK_BY_TYPE.get(type) ?? BLOCKS[2];

/** Deep-ish clone; rows are flat objects so this is enough and stays fast. */
const cloneProps = (props: Record<string, PropValue>): Record<string, PropValue> => {
  const out: Record<string, PropValue> = {};
  for (const [key, value] of Object.entries(props)) out[key] = Array.isArray(value) ? value.map((row) => ({ ...row })) : value;
  return out;
};

export function makeBlock(type: BlockType, overrides: Partial<Block> = {}): Block {
  const def = defOf(type);
  return {
    id: newId(),
    type,
    variant: def.variants[0].value,
    hidden: false,
    ...overrides,
    props: { ...cloneProps(def.defaults), ...cloneProps(overrides.props ?? {}) },
  };
}

export function duplicateBlock(block: Block): Block {
  return { ...block, id: newId(), props: cloneProps(block.props) };
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/* --------------------------------------------------------------- new site */

export const DEFAULT_META: Meta = {
  title: "",
  description: "",
  favicon: "✨",
  lang: "en",
  url: "",
  ogImage: "",
  indexable: true,
};

export const DEFAULT_IDENTITY: Identity = { name: "", tagline: "", email: "", phone: "", address: "", city: "", kind: "" };

export function newSite(name = "Untitled site", blocks?: Block[], theme?: Partial<Theme>): Site {
  return {
    id: newId(),
    name,
    meta: { ...DEFAULT_META },
    identity: { ...DEFAULT_IDENTITY },
    theme: { ...DEFAULT_THEME, ...theme },
    blocks: blocks ?? [makeBlock("nav"), makeBlock("hero"), makeBlock("features"), makeBlock("cta"), makeBlock("footer")],
    snapshots: [],
    updated: Date.now(),
  };
}

/* ------------------------------------------------------------- validation */

const isRow = (value: unknown): value is Row =>
  !!value && typeof value === "object" && !Array.isArray(value) &&
  Object.values(value as object).every((v) => typeof v === "string");

function isBlock(value: unknown): value is Block {
  if (!value || typeof value !== "object") return false;
  const block = value as Block;
  if (typeof block.id !== "string" || typeof block.variant !== "string" || typeof block.hidden !== "boolean") return false;
  if (!BLOCK_BY_TYPE.has(block.type)) return false;
  if (!block.props || typeof block.props !== "object" || Array.isArray(block.props)) return false;
  return Object.values(block.props).every(
    (v) => typeof v === "string" || typeof v === "boolean" || (Array.isArray(v) && v.every(isRow)),
  );
}

const isTheme = (value: unknown): value is Theme => {
  if (!value || typeof value !== "object") return false;
  const theme = value as Theme;
  return typeof theme.brand === "string" && typeof theme.accent === "string" &&
    (theme.scheme === "light" || theme.scheme === "dark") &&
    FONTS.some((f) => f.id === theme.font) && typeof theme.animate === "boolean";
};

/** Guards what comes back from localStorage or an imported backup file. */
export function validSites(value: unknown): value is Site[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SITES) return false;
  if (new Set(value.map((site) => (site as Site)?.id)).size !== value.length) return false;
  return value.every((raw) => {
    if (!raw || typeof raw !== "object") return false;
    const site = raw as Site;
    return typeof site.id === "string" && typeof site.name === "string" &&
      !!site.meta && typeof site.meta === "object" && typeof site.meta.title === "string" &&
      !!site.identity && typeof site.identity === "object" &&
      isTheme(site.theme) &&
      Array.isArray(site.blocks) && site.blocks.length <= MAX_BLOCKS && site.blocks.every(isBlock) &&
      new Set(site.blocks.map((b) => b.id)).size === site.blocks.length &&
      Array.isArray(site.snapshots) && site.snapshots.length <= MAX_SNAPSHOTS &&
      site.snapshots.every((snap) => snap && typeof snap.id === "string" && typeof snap.name === "string" &&
        Number.isFinite(snap.date) && isTheme(snap.theme) && Array.isArray(snap.blocks) && snap.blocks.every(isBlock)) &&
      Number.isFinite(site.updated);
  });
}

/** Fill in anything a newer version of the model added, so old saves keep working. */
export function migrateSite(site: Site): Site {
  return {
    ...site,
    meta: { ...DEFAULT_META, ...site.meta },
    identity: { ...DEFAULT_IDENTITY, ...site.identity },
    theme: { ...DEFAULT_THEME, ...site.theme },
    blocks: site.blocks.map((block) => ({ ...block, props: { ...cloneProps(defOf(block.type).defaults), ...cloneProps(block.props) } })),
  };
}

/* ----------------------------------------------------------- launch check */

export type CheckLevel = "error" | "warn" | "tip";

export interface CheckResult {
  id: string;
  level: CheckLevel;
  title: string;
  detail: string;
  blockId?: string;
  /** "meta" and "theme" open the matching panel instead of a section. */
  target?: "meta" | "theme";
}

const PLACEHOLDER = /(lorem ipsum|your business|example\.com|new item|new link|new person|new package|a question people ask|write freely here|new reviewer|say what you do, plainly)/i;

function textOf(block: Block): string {
  const parts: string[] = [];
  for (const value of Object.values(block.props)) {
    if (typeof value === "string") parts.push(value);
    else if (Array.isArray(value)) for (const row of value) parts.push(...Object.values(row));
  }
  return parts.join(" ");
}

const dataUrlBytes = (value: string) =>
  value.startsWith("data:") ? Math.floor((value.length - value.indexOf(",") - 1) * 0.75) : 0;

/**
 * The pre-flight list. Every finding points at the section that causes it, so
 * the panel can jump straight there instead of describing where to look.
 */
export function runChecks(site: Site): CheckResult[] {
  const found: CheckResult[] = [];
  const visible = site.blocks.filter((block) => !block.hidden);
  const push = (result: CheckResult) => found.push(result);

  if (!site.meta.title.trim()) {
    push({ id: "title", level: "error", title: "Add a page title", detail: "The title is what people see in the browser tab and in search results.", target: "meta" });
  } else if (site.meta.title.length > 60) {
    push({ id: "title-long", level: "warn", title: "Page title is long", detail: `${site.meta.title.length} characters. Search results usually cut off around 60.`, target: "meta" });
  }
  const description = site.meta.description.trim();
  if (!description) push({ id: "desc", level: "error", title: "Add a page description", detail: "One or two sentences shown under your title in search results.", target: "meta" });
  else if (description.length < 50) push({ id: "desc-short", level: "tip", title: "Description is short", detail: "Around 120 to 155 characters gives search engines something to work with.", target: "meta" });
  else if (description.length > 165) push({ id: "desc-long", level: "warn", title: "Description is long", detail: `${description.length} characters. The end will be cut off.`, target: "meta" });

  if (!visible.some((block) => block.type === "hero")) {
    push({ id: "no-hero", level: "warn", title: "No opening section", detail: "A hero at the top tells a visitor what this is within a few seconds." });
  }
  if (!visible.some((block) => ["contact", "footer", "cta"].includes(block.type))) {
    push({ id: "no-contact", level: "error", title: "No way to reach you", detail: "Add a contact section or a footer with an email or phone number." });
  }

  const buttonRatio = ratioOn(readableOn(site.theme.brand), site.theme.brand);
  if (buttonRatio < 4.5) {
    push({ id: "brand-contrast", level: "warn", title: "Button text is hard to read", detail: `Text on your brand colour sits at ${buttonRatio.toFixed(1)}:1. Aim for 4.5:1. A slightly darker brand colour fixes it.`, target: "theme" });
  }
  const bodyOnCanvas = ratioOn(themeTokens(site.theme)["--body"], themeTokens(site.theme)["--canvas"]);
  if (bodyOnCanvas < 4.5) {
    push({ id: "body-contrast", level: "warn", title: "Body text is low contrast", detail: `Paragraph text sits at ${bodyOnCanvas.toFixed(1)}:1 against the page background.`, target: "theme" });
  }

  for (const block of visible) {
    const def = defOf(block.type);
    const label = def.name;

    if (PLACEHOLDER.test(textOf(block))) {
      push({ id: `${block.id}-placeholder`, level: "warn", title: `${label}: still has starter text`, detail: "Replace the example wording with your own before you publish.", blockId: block.id });
    }
    for (const field of def.fields) {
      if (field.kind === "image" && str(block, field.key)) {
        const altKey = field.key === "image" ? "imageAlt" : field.key === "photo" ? "" : "alt";
        if (altKey && def.fields.some((f) => f.key === altKey) && !str(block, altKey).trim()) {
          push({ id: `${block.id}-alt`, level: "warn", title: `${label}: image has no description`, detail: "Describe the picture so screen readers and search engines can understand it.", blockId: block.id });
        }
        const size = dataUrlBytes(str(block, field.key));
        if (size > IMAGE_WARN_BYTES) {
          push({ id: `${block.id}-heavy`, level: "warn", title: `${label}: image is heavy`, detail: `About ${Math.round(size / 1024)} KB inside the page. Re-upload it and the builder will shrink it for you.`, blockId: block.id });
        }
      }
    }
    for (const [key, value] of Object.entries(block.props)) {
      const check = (href: string, where: string) => {
        if (href.trim() && safeHref(href) === "#" && href.trim() !== "#") {
          push({ id: `${block.id}-${where}-link`, level: "warn", title: `${label}: a link goes nowhere`, detail: `"${href}" is not a web address, email or section link.`, blockId: block.id });
        }
      };
      if (typeof value === "string" && /href$/i.test(key)) check(value, key);
      if (Array.isArray(value)) for (const row of value) for (const [rowKey, rowValue] of Object.entries(row)) if (/href$/i.test(rowKey)) check(rowValue, rowKey);
    }

    if (block.type === "hero") {
      const headline = str(block, "headline");
      if (headline.length > 70) push({ id: `${block.id}-headline`, level: "tip", title: "Headline is long", detail: "Short headlines get read. Aim for under 70 characters.", blockId: block.id });
      if (str(block, "primaryLabel").trim() && !str(block, "primaryHref").trim()) {
        push({ id: `${block.id}-cta`, level: "error", title: "Hero button has no destination", detail: "Point it at a section, a phone number or an email address.", blockId: block.id });
      }
    }
    if (block.type === "contact") {
      if (str(block, "formMode") === "post" && !str(block, "formAction").trim()) {
        push({ id: `${block.id}-action`, level: "error", title: "Contact form has no destination", detail: "Paste the address from your form service, or switch the form back to email.", blockId: block.id });
      }
      if (str(block, "formMode") === "mailto" && !str(block, "email").trim()) {
        push({ id: `${block.id}-email`, level: "error", title: "Contact form has no email address", detail: "The form opens the visitor's email app, so it needs an address to send to.", blockId: block.id });
      }
    }
    if (block.type === "newsletter" && !str(block, "action").trim()) {
      push({ id: `${block.id}-news`, level: "warn", title: "Sign-up form is not connected", detail: "Paste the form address from your email provider, or remove this section.", blockId: block.id });
    }
    if (block.type === "embed" && !str(block, "url").trim() && !str(block, "html").trim()) {
      push({ id: `${block.id}-embed`, level: "warn", title: "Embed is empty", detail: "Add an address to show a video or map here.", blockId: block.id });
    }
    if (block.type === "gallery") {
      const empty = rows(block, "items").filter((row) => !row.image).length;
      if (empty) push({ id: `${block.id}-gallery`, level: "warn", title: `Gallery has ${empty} empty ${empty === 1 ? "slot" : "slots"}`, detail: "Add pictures or remove the empty ones.", blockId: block.id });
    }
  }

  const anchors = new Set(sectionAnchors(visible).values());
  for (const block of visible) {
    for (const value of Object.values(block.props)) {
      if (!Array.isArray(value)) continue;
      for (const row of value) {
        for (const [key, href] of Object.entries(row)) {
          if (!/href$/i.test(key) || !href.startsWith("#") || href === "#") continue;
          if (!anchors.has(href.slice(1))) {
            push({ id: `${block.id}-anchor-${href}`, level: "warn", title: `${defOf(block.type).name}: link points at a missing section`, detail: `Nothing on the page has the id "${href.slice(1)}". Pick a section from the list instead.`, blockId: block.id });
          }
        }
      }
    }
  }

  if (!site.meta.favicon.trim()) push({ id: "favicon", level: "tip", title: "Pick a tab icon", detail: "A single emoji works and needs no image file.", target: "meta" });
  if (visible.length < 4) push({ id: "thin", level: "tip", title: "The page is thin", detail: "Most small business pages need at least a hero, what you offer, proof and contact." });

  const order = { error: 0, warn: 1, tip: 2 };
  return found.sort((a, b) => order[a.level] - order[b.level]).slice(0, 40);
}

export const checkSummary = (results: CheckResult[]) => ({
  errors: results.filter((r) => r.level === "error").length,
  warnings: results.filter((r) => r.level === "warn").length,
  tips: results.filter((r) => r.level === "tip").length,
});

/* --------------------------------------------------------------- emoji set */

export const EMOJI_SETS: readonly { name: string; emoji: readonly string[] }[] = [
  { name: "Signals", emoji: ["✨", "⚡", "🎯", "✅", "⭐", "🔥", "💡", "🚀", "🏆", "🔒", "♻️", "🌱"] },
  { name: "Work", emoji: ["🛠️", "📐", "🧰", "💼", "📊", "🗂️", "🖥️", "📱", "🎨", "🧪", "📦", "🧭"] },
  { name: "People", emoji: ["🤝", "👋", "💬", "❤️", "🙌", "👩‍🍳", "🧑‍🔧", "🧑‍⚕️", "🎓", "👨‍👩‍👧", "🗣️", "🫶"] },
  { name: "Places", emoji: ["🏠", "🏢", "🏪", "📍", "🌍", "🚚", "🕒", "📅", "☎️", "✉️", "🧾", "🔑"] },
  { name: "Food", emoji: ["☕", "🍞", "🍰", "🍕", "🥗", "🍷", "🍜", "🥐", "🍎", "🧁", "🍽️", "👨‍🍳"] },
  { name: "Care", emoji: ["💆", "💇", "💅", "🧘", "🏋️", "🚴", "🩺", "🌿", "🛁", "😊", "💪", "🧴"] },
];
