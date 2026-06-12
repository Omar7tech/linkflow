import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { Reveal } from "@/components/home/reveal";
import { TOOLS } from "@/constants/tools";
import { cn } from "@/lib/utils";

interface ToolGridProps {
  className?: string;
  /** Wraps the grid in a staggered scroll reveal. */
  animated?: boolean;
}

export function ToolGrid({ className, animated = false }: ToolGridProps) {
  const grid = (
    <>
      {TOOLS.map((tool, i) => {
        const featured = i === 0;
        return (
          <Link
            key={tool.id}
            href={tool.slug}
            className={cn(
              "group border-border/60 bg-card relative flex flex-col justify-between gap-8 rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5",
              featured && "from-primary/10 bg-gradient-to-br to-transparent sm:col-span-2"
            )}
          >
            <div className="flex items-start justify-between">
              <span
                className={cn(
                  "border-border/70 bg-muted/40 text-muted-foreground group-hover:border-primary/30 group-hover:text-primary flex size-10 items-center justify-center rounded-xl border transition-colors",
                  featured && "border-primary/30 text-primary"
                )}
              >
                <tool.icon className="size-[18px]" aria-hidden />
              </span>
              <span className="text-muted-foreground/40 font-mono text-[11px] tracking-[0.18em]">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-heading flex items-center gap-1.5 text-[17px] font-bold tracking-tight">
                {tool.shortName}
                <ArrowUpRightIcon
                  className="text-primary size-4 -translate-x-1 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
                  aria-hidden
                />
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
      })}
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
