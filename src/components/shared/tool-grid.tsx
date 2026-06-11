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
      {TOOLS.map((tool) => (
        <Link
          key={tool.id}
          href={tool.slug}
          className="group border-border bg-card/60 hover:border-foreground/20 relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="border-border bg-muted/40 flex size-10 items-center justify-center rounded-xl border transition-colors group-hover:border-foreground/20">
              <ToolIcon
                name={tool.icon}
                className="text-muted-foreground group-hover:text-foreground size-[18px] transition-colors"
              />
            </span>
            <ArrowUpRightIcon className="text-muted-foreground size-4 -translate-x-1 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
          </div>
          <div>
            <h3 className="font-heading font-semibold">{tool.shortName}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{tool.tagline}</p>
          </div>
        </Link>
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
