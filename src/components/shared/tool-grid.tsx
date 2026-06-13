import Link from "next/link";
import { Reveal } from "@/components/home/reveal";
import { TOOLS } from "@/constants/tools";
import { cn } from "@/lib/utils";
import type { ToolMeta } from "@/types";
import { FavoriteButton } from "./favorite-button";
import { ToolCardIndicator } from "./link-indicator";

/** Per-card accent palette. Each entry: icon text colour, hover border, and the right-edge tint. */
const ACCENTS = [
  { icon: "text-emerald-500", border: "hover:border-emerald-500/40", grad: "from-emerald-500/10" },
  { icon: "text-sky-500", border: "hover:border-sky-500/40", grad: "from-sky-500/10" },
  { icon: "text-violet-500", border: "hover:border-violet-500/40", grad: "from-violet-500/10" },
  { icon: "text-amber-500", border: "hover:border-amber-500/40", grad: "from-amber-500/10" },
  { icon: "text-rose-500", border: "hover:border-rose-500/40", grad: "from-rose-500/10" },
  { icon: "text-teal-500", border: "hover:border-teal-500/40", grad: "from-teal-500/10" },
  { icon: "text-indigo-500", border: "hover:border-indigo-500/40", grad: "from-indigo-500/10" },
  { icon: "text-fuchsia-500", border: "hover:border-fuchsia-500/40", grad: "from-fuchsia-500/10" },
  { icon: "text-orange-500", border: "hover:border-orange-500/40", grad: "from-orange-500/10" },
  { icon: "text-cyan-500", border: "hover:border-cyan-500/40", grad: "from-cyan-500/10" },
  { icon: "text-lime-500", border: "hover:border-lime-500/40", grad: "from-lime-500/10" },
  { icon: "text-blue-500", border: "hover:border-blue-500/40", grad: "from-blue-500/10" },
] as const;

function accentFor(id: string) {
  const i = TOOLS.findIndex((t) => t.id === id);
  return ACCENTS[(i < 0 ? 0 : i) % ACCENTS.length];
}

export function ToolCard({ tool }: { tool: ToolMeta }) {
  const accent = accentFor(tool.id);
  return (
    <Link
      href={tool.slug}
      className={cn(
        "group border-border/60 bg-card relative flex flex-col justify-between gap-10 overflow-hidden rounded-2xl border p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5",
        accent.border
      )}
    >
      {/* Faded icon watermark bleeding off the right edge */}
      <tool.icon
        className={cn(
          "pointer-events-none absolute -right-5 top-1/2 size-40 -translate-y-1/2 opacity-[0.07] transition-opacity duration-300 group-hover:opacity-[0.13]",
          accent.icon
        )}
        aria-hidden
      />
      {/* Soft colour wash from the right */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-l to-transparent opacity-60",
          accent.grad
        )}
      />

      <div className="relative z-10 flex items-start justify-end">
        <FavoriteButton toolId={tool.id} />
      </div>

      <div className="relative z-10 space-y-1.5">
        <h3 className="font-heading flex items-center gap-2 text-2xl font-bold tracking-tight">
          {tool.shortName}
          <span className={accent.icon}>
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
