import Link from "next/link";
import { Reveal } from "@/components/home/reveal";
import { TOOLS } from "@/constants/tools";
import { cn } from "@/lib/utils";
import type { ToolMeta } from "@/types";
import { FavoriteButton } from "./favorite-button";
import { ToolCardIndicator } from "./link-indicator";

/** Per-card accent palette. Meticulously expanded to 40 ultra-rich shades, completely randomized in sequential order. */
const ACCENTS = [
  { icon: "text-purple-600", border: "hover:border-purple-600/50", grad: "from-purple-600/15" },
  { icon: "text-cyan-400", border: "hover:border-cyan-400/50", grad: "from-cyan-400/15" },
  { icon: "text-rose-500", border: "hover:border-rose-500/50", grad: "from-rose-500/15" },
  { icon: "text-lime-500", border: "hover:border-lime-500/50", grad: "from-lime-500/15" },
  { icon: "text-amber-500", border: "hover:border-amber-500/50", grad: "from-amber-500/15" },
  { icon: "text-blue-600", border: "hover:border-blue-600/50", grad: "from-blue-600/15" },
  { icon: "text-orange-600", border: "hover:border-orange-600/50", grad: "from-orange-600/15" },
  { icon: "text-emerald-500", border: "hover:border-emerald-500/50", grad: "from-emerald-500/15" },
  { icon: "text-pink-500", border: "hover:border-pink-500/50", grad: "from-pink-500/15" },
  { icon: "text-sky-500", border: "hover:border-sky-500/50", grad: "from-sky-500/15" },
  { icon: "text-stone-400", border: "hover:border-stone-400/50", grad: "from-stone-400/15" },
  { icon: "text-red-500", border: "hover:border-red-500/50", grad: "from-red-500/15" },
  { icon: "text-fuchsia-500", border: "hover:border-fuchsia-500/50", grad: "from-fuchsia-500/15" },
  { icon: "text-indigo-500", border: "hover:border-indigo-500/50", grad: "from-indigo-500/15" },
  { icon: "text-yellow-400", border: "hover:border-yellow-400/50", grad: "from-yellow-400/15" },
  { icon: "text-teal-500", border: "hover:border-teal-500/50", grad: "from-teal-500/15" },
  { icon: "text-violet-500", border: "hover:border-violet-500/50", grad: "from-violet-500/15" },
  { icon: "text-orange-500", border: "hover:border-orange-500/50", grad: "from-orange-500/15" },
  { icon: "text-zinc-400", border: "hover:border-zinc-400/50", grad: "from-zinc-400/15" },
  { icon: "text-green-500", border: "hover:border-green-500/50", grad: "from-green-500/15" },
  { icon: "text-blue-400", border: "hover:border-blue-400/50", grad: "from-blue-400/15" },
  { icon: "text-lime-300", border: "hover:border-lime-300/50", grad: "from-lime-300/15" },
  { icon: "text-cyan-600", border: "hover:border-cyan-600/50", grad: "from-cyan-600/15" },
  { icon: "text-pink-600", border: "hover:border-pink-600/50", grad: "from-pink-600/15" },
  { icon: "text-amber-600", border: "hover:border-amber-600/50", grad: "from-amber-600/15" },
  { icon: "text-violet-400", border: "hover:border-violet-400/50", grad: "from-violet-400/15" },
  { icon: "text-emerald-400", border: "hover:border-emerald-400/50", grad: "from-emerald-400/15" },
  { icon: "text-red-400", border: "hover:border-red-400/50", grad: "from-red-400/15" },
  { icon: "text-indigo-400", border: "hover:border-indigo-400/50", grad: "from-indigo-400/15" },
  { icon: "text-teal-400", border: "hover:border-teal-400/50", grad: "from-teal-400/15" },
  { icon: "text-orange-400", border: "hover:border-orange-400/50", grad: "from-orange-400/15" },
  { icon: "text-fuchsia-600", border: "hover:border-fuchsia-600/50", grad: "from-fuchsia-600/15" },
  { icon: "text-sky-400", border: "hover:border-sky-400/50", grad: "from-sky-400/15" },
  { icon: "text-purple-400", border: "hover:border-purple-400/50", grad: "from-purple-400/15" },
  { icon: "text-rose-400", border: "hover:border-rose-400/50", grad: "from-rose-400/15" },
  { icon: "text-emerald-600", border: "hover:border-emerald-600/50", grad: "from-emerald-600/15" },
  { icon: "text-cyan-500", border: "hover:border-cyan-500/50", grad: "from-cyan-500/15" },
  { icon: "text-yellow-500", border: "hover:border-yellow-500/50", grad: "from-yellow-500/15" },
  { icon: "text-neutral-400", border: "hover:border-neutral-400/50", grad: "from-neutral-400/15" },
  { icon: "text-blue-500", border: "hover:border-blue-500/50", grad: "from-blue-500/15" },
] as const;

function accentFor(id: string) {
  const i = TOOLS.findIndex((t) => t.id === id);
  return ACCENTS[(i < 0 ? 0 : i) % ACCENTS.length];
}

export function ToolCard({ tool }: { tool: ToolMeta }) {
  const accent = accentFor(tool.id);
  
  // Extracting the Tailwind base color name for the background grid (e.g., "purple-600" from "text-purple-600")
  const colorName = accent.icon.replace("text-", "");

  return (
    <Link
      href={tool.slug}
      className={cn(
        "group border-border/60 bg-card relative flex flex-col justify-between gap-10 overflow-hidden rounded-2xl border p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5",
        accent.border
      )}
    >
      {/* Dynamic Geometric Grid Pattern Layer */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.015] mix-blend-overlay transition-opacity duration-300 group-hover:opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '12px 12px',
          color: `var(--${colorName}, currentColor)`
        }}
      />

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

      <div className="relative z-10 flex items-start justify-start">
        <FavoriteButton toolId={tool.id} variant="chip" />
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