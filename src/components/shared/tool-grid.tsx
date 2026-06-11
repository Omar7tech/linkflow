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
          className="group border-border/70 bg-card/40 hover:border-foreground/15 hover:bg-card relative flex flex-col gap-3 rounded-xl border p-5 transition-colors duration-200"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <ToolIcon
                name={tool.icon}
                className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors duration-200"
              />
              <h3 className="font-heading truncate text-[15px] font-semibold tracking-tight">
                {tool.shortName}
              </h3>
            </div>
            <span className="text-muted-foreground/60 flex shrink-0 items-center gap-1.5 font-mono text-[10px] tracking-widest">
              {String(i + 1).padStart(2, "0")}
              <ToolCardIndicator />
            </span>
          </div>
          <p className="text-muted-foreground text-[13px] leading-relaxed">{tool.description}</p>
          <p className="text-muted-foreground/60 mt-auto font-mono text-[10px] tracking-[0.12em] uppercase">
            {tool.tagline}
          </p>
        </Link>
      ))}
    </>
  );

  const gridClass = cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className);

  if (animated) {
    return (
      <Reveal stagger className={gridClass}>
        {grid}
      </Reveal>
    );
  }
  return <div className={gridClass}>{grid}</div>;
}
