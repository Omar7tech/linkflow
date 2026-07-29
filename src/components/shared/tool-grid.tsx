import Link from "next/link";
import { Reveal } from "@/components/home/reveal";
import { TOOLS, TOOL_CATEGORIES } from "@/constants/tools";
import { accentFor } from "@/lib/tool-accent";
import { cn } from "@/lib/utils";
import type { ToolCategory, ToolMeta } from "@/types";
import { FavoriteButton } from "./favorite-button";
import { ToolCardIndicator } from "./link-indicator";
import { ToolCardImage } from "./tool-card-image";

const CATEGORY_LABEL: Record<ToolCategory, string> = Object.fromEntries(
  TOOL_CATEGORIES.map((c) => [c.id, c.label])
) as Record<ToolCategory, string>;

/** Banner art lives at /tools/{last slug segment}.png. */
const cardImage = (slug: string) => `/tools/${slug.split("/").pop()}.webp`;

export function ToolCard({ tool }: { tool: ToolMeta }) {
  const category = tool.category as ToolCategory;
  const accent = accentFor(category);

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