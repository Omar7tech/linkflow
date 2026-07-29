import type { ToolCategory } from "@/types";

/**
 * One signature colour per category, used editorially — a thin rule, a mono
 * eyebrow, a tinted section head. Never a gradient fill: the pages read as a
 * typographic specimen sheet, not a wall of glowing tiles. Full class strings
 * so Tailwind keeps them.
 */
export type Accent = {
  text: string; // eyebrow, heading + arrow colour
  border: string; // card border tint on hover
  shadow: string; // coloured lift shadow on hover
  rule: string; // solid fill for hairline rules
  pill: string; // selected filter pill
};

/**
 * Written out rather than generated from the colour name, so every class string
 * appears literally in the source for Tailwind's scanner.
 */
export const CATEGORY_ACCENT: Record<ToolCategory, Accent> = {
  studio: {
    text: "text-violet-500 dark:text-violet-400",
    border: "hover:border-violet-500/40",
    shadow: "hover:shadow-violet-500/10",
    rule: "bg-violet-500",
    pill: "border-violet-500/60 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  links: {
    text: "text-emerald-600 dark:text-emerald-400",
    border: "hover:border-emerald-500/40",
    shadow: "hover:shadow-emerald-500/10",
    rule: "bg-emerald-500",
    pill: "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  image: {
    text: "text-rose-500 dark:text-rose-400",
    border: "hover:border-rose-500/40",
    shadow: "hover:shadow-rose-500/10",
    rule: "bg-rose-500",
    pill: "border-rose-500/60 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  color: {
    text: "text-amber-500 dark:text-amber-400",
    border: "hover:border-amber-500/40",
    shadow: "hover:shadow-amber-500/10",
    rule: "bg-amber-500",
    pill: "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  backgrounds: {
    text: "text-sky-500 dark:text-sky-400",
    border: "hover:border-sky-500/40",
    shadow: "hover:shadow-sky-500/10",
    rule: "bg-sky-500",
    pill: "border-sky-500/60 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  css: {
    text: "text-blue-500 dark:text-blue-400",
    border: "hover:border-blue-500/40",
    shadow: "hover:shadow-blue-500/10",
    rule: "bg-blue-500",
    pill: "border-blue-500/60 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  type: {
    text: "text-fuchsia-500 dark:text-fuchsia-400",
    border: "hover:border-fuchsia-500/40",
    shadow: "hover:shadow-fuchsia-500/10",
    rule: "bg-fuchsia-500",
    pill: "border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  },
  brandlab: {
    text: "text-teal-500 dark:text-teal-400",
    border: "hover:border-teal-500/40",
    shadow: "hover:shadow-teal-500/10",
    rule: "bg-teal-500",
    pill: "border-teal-500/60 bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  utilities: {
    text: "text-orange-500 dark:text-orange-400",
    border: "hover:border-orange-500/40",
    shadow: "hover:shadow-orange-500/10",
    rule: "bg-orange-500",
    pill: "border-orange-500/60 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  playground: {
    text: "text-purple-500 dark:text-purple-400",
    border: "hover:border-purple-500/40",
    shadow: "hover:shadow-purple-500/10",
    rule: "bg-purple-500",
    pill: "border-purple-500/60 bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
};

export const accentFor = (category: ToolCategory): Accent =>
  CATEGORY_ACCENT[category] ?? CATEGORY_ACCENT.links;
