import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { Reveal } from "@/components/home/reveal";
import { TOOLS } from "@/constants/tools";
import { cn } from "@/lib/utils";
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
          className="group border-border/70 bg-card/30 hover:border-foreground/15 hover:bg-card relative flex flex-col rounded-2xl border p-6 transition-colors duration-300 sm:p-7"
        >
          <div className="flex items-start justify-between">
            <ToolIcon
              name={tool.icon}
              className="text-muted-foreground group-hover:text-foreground size-5 transition-colors duration-300"
            />
            <span className="text-muted-foreground/50 flex items-center gap-2 font-mono text-[11px]">
              {String(i + 1).padStart(2, "0")}
              <ArrowUpRightIcon className="size-3.5 -translate-x-0.5 translate-y-0.5 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
            </span>
          </div>
          <div className="mt-12">
            <h3 className="font-heading text-lg font-semibold tracking-tight">{tool.shortName}</h3>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{tool.tagline}</p>
          </div>
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
