import Link from "next/link";
import { Reveal } from "@/components/home/reveal";
import { TOOLS } from "@/constants/tools";
import { cn } from "@/lib/utils";
import type { ToolMeta } from "@/types";
import { FavoriteButton } from "./favorite-button";
import { ToolCardIndicator } from "./link-indicator";

export function ToolCard({ tool }: { tool: ToolMeta }) {
  const Icon = tool.icon;

  return (
    <Link
      href={tool.slug}
      className={cn(
        "group border-border/60 bg-card hover:border-emerald-500/40 hover:shadow-emerald-500/5 relative flex flex-col gap-4 rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      )}
    >
      {/* Top row: leading icon tile + favourite star */}
      <div className="flex items-start justify-between gap-3">
        <span className="border-border/70 bg-muted/40 group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10 flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors">
          <Icon
            className="size-5 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
        </span>
        <FavoriteButton toolId={tool.id} variant="chip" />
      </div>

      <div className="space-y-1">
        <h3 className="font-heading flex items-center gap-1.5 text-lg font-bold tracking-tight">
          {tool.shortName}
          <span className="text-emerald-600 dark:text-emerald-400">
            <ToolCardIndicator />
          </span>
        </h3>
        <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">
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