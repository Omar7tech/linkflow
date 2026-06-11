import Link from "next/link";
import { Reveal } from "@/components/home/reveal";
import { TOOLS } from "@/constants/tools";
import { cn } from "@/lib/utils";
import { ToolCardIndicator } from "./link-indicator";
import { ToolIcon } from "./tool-icon";

interface ToolGridProps {
  className?: string;
  /** Wraps the grid in a staggered scroll reveal. */
  animated?: boolean;
}

export function ToolGrid({ className, animated = false }: ToolGridProps) {
  const grid = (
    <>
      {TOOLS.map((tool, i) => (
        <Link
          key={tool.id}
          href={tool.slug}
          className="group border-border/60 hover:border-foreground/20 relative flex flex-col gap-4 rounded-xl border bg-card/20 p-5 transition-colors duration-300 hover:bg-card"
        >
          <div className="flex items-center justify-between">
            <ToolIcon
              name={tool.icon}
              className="text-muted-foreground/40 size-4 transition-colors group-hover:text-foreground"
            />
            <div className="text-muted-foreground/10 transition-colors group-hover:text-foreground">
              <ToolCardIndicator />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="font-heading text-[17px] font-bold tracking-tight">
              {tool.shortName}
            </h3>
            <p className="text-muted-foreground text-[13px] leading-snug">
              {tool.description}
            </p>
          </div>
        </Link>
      ))}
    </>
  );

  const gridClass = cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className);

  if (animated) {
    return (
      <Reveal stagger className={gridClass}>
        {grid}
      </Reveal>
    );
  }
  return <div className={gridClass}>{grid}</div>;
}
