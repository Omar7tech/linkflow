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
          className="group border-border bg-card/60 hover:border-primary/40 relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_-12px_var(--glow)]"
        >
          <div
            aria-hidden
            className="bg-primary/10 absolute -top-12 -right-12 size-32 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
          />
          <div className="flex items-center justify-between">
            <span className="border-border bg-muted/40 group-hover:border-primary/30 flex size-11 items-center justify-center rounded-xl border transition-colors">
              <ToolIcon name={tool.icon} className={cn("size-5", tool.accent)} />
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
