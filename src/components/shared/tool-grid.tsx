import Link from "next/link";
import { Reveal } from "@/components/home/reveal";
import { TOOLS } from "@/constants/tools";
import { cn } from "@/lib/utils";
import type { ToolMeta } from "@/types";
import { FavoriteButton } from "./favorite-button";
import { ToolCardIndicator } from "./link-indicator";

export function ToolCard({ tool, featured = false }: { tool: ToolMeta; featured?: boolean }) {
  return (
    <Link
      href={tool.slug}
      className={cn(
        "group border-border/60 bg-card relative flex flex-col justify-between gap-8 rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5",
        featured && "from-primary/10 bg-gradient-to-br to-transparent sm:col-span-2"
      )}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "text-muted-foreground group-hover:text-primary transition-colors",
            featured && "text-primary"
          )}
        >
          <tool.icon className="size-6" aria-hidden />
        </span>
        <FavoriteButton toolId={tool.id} />
      </div>

      <div className="space-y-1.5">
        <h3 className="font-heading flex items-center gap-1.5 text-xl font-bold tracking-tight">
          {tool.shortName}
          <span className="text-primary">
            <ToolCardIndicator />
          </span>
        </h3>
        <p
          className={cn(
            "text-muted-foreground text-[13px] leading-snug",
            !featured && "line-clamp-2"
          )}
        >
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
}

export function ToolGrid({ className, animated = false }: ToolGridProps) {
  const grid = (
    <>
      {TOOLS.map((tool, i) => (
        <ToolCard key={tool.id} tool={tool} featured={i === 0} />
      ))}
    </>
  );

  const gridClass = cn("grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4", className);

  if (animated) {
    return (
      <Reveal stagger className={gridClass}>
        {grid}
      </Reveal>
    );
  }
  return <div className={gridClass}>{grid}</div>;
}
