import Link from "next/link";
import { Reveal } from "@/components/home/reveal";
import { TOOLS } from "@/constants/tools";
import { cn } from "@/lib/utils";
import type { ToolMeta } from "@/types";
import { FavoriteButton } from "./favorite-button";
import { ToolCardIndicator } from "./link-indicator";

export function ToolCard({ tool }: { tool: ToolMeta }) {
  return (
    <Link
      href={tool.slug}
      className="group border-border/60 bg-card relative flex flex-col justify-between gap-10 rounded-2xl border p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
    >
      <div className="flex items-start justify-between">
        <span className="text-muted-foreground group-hover:text-primary transition-colors">
          <tool.icon className="size-6" aria-hidden />
        </span>
        <FavoriteButton toolId={tool.id} />
      </div>

      <div className="space-y-1.5">
        <h3 className="font-heading flex items-center gap-2 text-2xl font-bold tracking-tight">
          {tool.shortName}
          <span className="text-primary">
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
