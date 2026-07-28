import Link from "next/link";
import { Reveal } from "@/components/home/reveal";
import { TOOLS, TOOL_CATEGORIES } from "@/constants/tools";
import { cn } from "@/lib/utils";
import type { ToolCategory, ToolMeta } from "@/types";
import { FavoriteButton } from "./favorite-button";
import { ToolCardIndicator } from "./link-indicator";
import { ToolCardImage } from "./tool-card-image";

/**
 * One signature colour per category, used editorially — as a thin sweeping
 * rule, a mono eyebrow and the arrow, never as a gradient fill. Cards read as
 * a typographic specimen sheet, not a wall of glowing tiles. Full class
 * strings so Tailwind keeps them.
 */
type Accent = {
  text: string; // eyebrow + arrow colour
  border: string; // card border tint on hover
  shadow: string; // coloured lift shadow on hover
};

const CATEGORY_ACCENT: Record<ToolCategory, Accent> = {
  studio: {
    text: "text-violet-500 dark:text-violet-400",
    border: "hover:border-violet-500/40",
    shadow: "hover:shadow-violet-500/10",
  },
  links: {
    text: "text-emerald-600 dark:text-emerald-400",
    border: "hover:border-emerald-500/40",
    shadow: "hover:shadow-emerald-500/10",
  },
  image: {
    text: "text-rose-500 dark:text-rose-400",
    border: "hover:border-rose-500/40",
    shadow: "hover:shadow-rose-500/10",
  },
  color: {
    text: "text-amber-500 dark:text-amber-400",
    border: "hover:border-amber-500/40",
    shadow: "hover:shadow-amber-500/10",
  },
  backgrounds: {
    text: "text-sky-500 dark:text-sky-400",
    border: "hover:border-sky-500/40",
    shadow: "hover:shadow-sky-500/10",
  },
  css: {
    text: "text-blue-500 dark:text-blue-400",
    border: "hover:border-blue-500/40",
    shadow: "hover:shadow-blue-500/10",
  },
  type: {
    text: "text-fuchsia-500 dark:text-fuchsia-400",
    border: "hover:border-fuchsia-500/40",
    shadow: "hover:shadow-fuchsia-500/10",
  },
  brandlab: {
    text: "text-teal-500 dark:text-teal-400",
    border: "hover:border-teal-500/40",
    shadow: "hover:shadow-teal-500/10",
  },
  utilities: {
    text: "text-orange-500 dark:text-orange-400",
    border: "hover:border-orange-500/40",
    shadow: "hover:shadow-orange-500/10",
  },
  playground: {
    text: "text-purple-500 dark:text-purple-400",
    border: "hover:border-purple-500/40",
    shadow: "hover:shadow-purple-500/10",
  },
};

const CATEGORY_LABEL: Record<ToolCategory, string> = Object.fromEntries(
  TOOL_CATEGORIES.map((c) => [c.id, c.label])
) as Record<ToolCategory, string>;

/** Banner art lives at /tools/{last slug segment}.png. */
const cardImage = (slug: string) => `/tools/${slug.split("/").pop()}.png`;

export function ToolCard({ tool }: { tool: ToolMeta }) {
  const category = tool.category as ToolCategory;
  const accent = CATEGORY_ACCENT[category] ?? CATEGORY_ACCENT.links;

  return (
    <Link
      href={tool.slug}
      className={cn(
        "group bg-card border-border/60 relative flex flex-col overflow-hidden rounded-xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
        accent.border,
        accent.shadow
      )}
    >
      <ToolCardImage src={cardImage(tool.slug)} alt={`${tool.name} illustration`} />

      {/* Star floats over the banner so the copy below stays a clean text block */}
      <div className="absolute top-3 right-3 z-10">
        <FavoriteButton toolId={tool.id} variant="chip" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <span
          className={cn(
            "font-mono text-[10px] font-semibold tracking-[0.18em] uppercase",
            accent.text
          )}
        >
          {CATEGORY_LABEL[category]}
        </span>

        <h3 className="font-heading mt-2 flex items-center gap-1.5 text-xl font-bold tracking-tight">
          {tool.shortName}
          <span className={accent.text}>
            <ToolCardIndicator />
          </span>
        </h3>
        <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm leading-snug">
          {tool.description}
        </p>
      </div>
    </Link>
  );
}

interface ToolGridProps {
  className?: string;
  /** Wraps the grid in a staggered scroll reveal. */
  animated?: boolean;
  /** Show only the first N tools (e.g. on the home page). */
  limit?: number;
}

export function ToolGrid({ className, animated = false, limit }: ToolGridProps) {
  const tools = limit ? TOOLS.slice(0, limit) : TOOLS;
  const grid = (
    <>
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </>
  );

  const gridClass = cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className);

  if (animated) {
    return (
      <Reveal stagger className={gridClass}>
        {grid}
      </Reveal>
    );
  }
  return <div className={gridClass}>{grid}</div>;
}