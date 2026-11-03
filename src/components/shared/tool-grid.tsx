import Link from "next/link";
import { Reveal } from "@/components/home/reveal";
import { CATALOG, TOOL_CATEGORIES } from "@/constants/tools";
import { accentFor } from "@/lib/tool-accent";
import { cn } from "@/lib/utils";
import type { ToolCategory, ToolMeta } from "@/types";
import { FavoriteButton } from "./favorite-button";
import { ToolCardIndicator } from "./link-indicator";
import { SCENES } from "./tool-scenes";

const CATEGORY_LABEL: Record<ToolCategory, string> = Object.fromEntries(
  TOOL_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<ToolCategory, string>;

/** A stable number per tool, so each card's emblem differs but never changes between renders. */
function seedOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * The card's picture, drawn rather than loaded: a small scene of what the tool
 * makes (see tool-scenes.tsx), over a dot grid lit in the category's colour.
 * A tool without a scene yet shows its icon on a tile framed by rings.
 */
function Emblem({ tool }: { tool: ToolMeta }) {
  const Icon = tool.icon;
  const Scene = SCENES[tool.id];
  const seed = seedOf(tool.id);
  const tilt = (seed % 21) - 10;
  const glowX = 20 + (seed % 61);
  const glowY = 15 + ((seed >> 7) % 50);

  return (
    <div aria-hidden className="relative aspect-[16/10] overflow-hidden">
      {/* Light in the category's colour, placed differently on every card. */}
      <div
        className="absolute size-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.18] blur-3xl transition-opacity duration-500 group-hover:opacity-30"
        style={{
          left: `${glowX}%`,
          top: `${glowY}%`,
          background: "var(--card-accent)",
        }}
      />
      {/* Dot grid, fading out from the middle. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,color-mix(in_oklab,var(--foreground)_14%,transparent)_1px,transparent_1px)] bg-[length:14px_14px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,black_20%,transparent_75%)]" />

      {Scene ? (
        <Scene />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          {/* Rings around the tile; they open out on hover. */}
          {[88, 66, 46].map((size, index) => (
            <span
              key={size}
              className="absolute aspect-square rounded-[30%] border transition-transform duration-700 ease-out group-hover:[transform:rotate(var(--ring-tilt))_scale(1.08)]"
              style={
                {
                  height: `${size}%`,
                  transform: `rotate(${tilt}deg)`,
                  "--ring-tilt": `${tilt + (index + 1) * 6}deg`,
                  borderColor: `color-mix(in oklab, var(--card-accent) ${12 + index * 10}%, transparent)`,
                } as React.CSSProperties
              }
            />
          ))}

          {/* The tile. */}
          <span className="bg-card border-border/70 relative grid aspect-square h-[34%] place-items-center rounded-[28%] border shadow-[0_1px_0_rgb(255_255_255/0.06)_inset,0_18px_40px_-18px_rgb(0_0_0/0.6)] transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-105">
            <span
              className="absolute inset-0 rounded-[inherit] opacity-60"
              style={{
                background:
                  "linear-gradient(160deg, color-mix(in oklab, var(--card-accent) 22%, transparent), transparent 60%)",
              }}
            />
            <Icon
              className="relative size-[42%]"
              style={{ color: "var(--card-accent)" }}
              strokeWidth={1.75}
            />
          </span>
        </div>
      )}
    </div>
  );
}

export function ToolCard({ tool }: { tool: ToolMeta }) {
  const category = tool.category as ToolCategory;
  const accent = accentFor(category);

  return (
    <Link
      href={tool.slug}
      style={
        {
          "--card-accent-light": accent.value.light,
          "--card-accent-dark": accent.value.dark,
        } as React.CSSProperties
      }
      className={cn(
        "group bg-card/60 border-border/60 relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl",
        "[--card-accent:var(--card-accent-light)] dark:[--card-accent:var(--card-accent-dark)]",
        accent.border,
        accent.shadow,
      )}
    >
      <Emblem tool={tool} />

      {/* Star floats over the emblem so the copy below stays a clean text block */}
      <div className="absolute top-3 right-3 z-10">
        <FavoriteButton toolId={tool.id} variant="chip" />
      </div>

      <div className="border-border/50 flex flex-1 flex-col border-t p-5">
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            accent.text,
          )}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: "var(--card-accent)" }}
          />
          {CATEGORY_LABEL[category] ?? "Experiment"}
        </span>

        <h3 className="font-heading mt-2.5 flex items-center gap-1.5 text-lg font-semibold tracking-[-0.01em]">
          {tool.shortName}
          <span className={accent.text}>
            <ToolCardIndicator />
          </span>
        </h3>
        <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm leading-relaxed">
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

export function ToolGrid({
  className,
  animated = false,
  limit,
}: ToolGridProps) {
  const tools = limit ? CATALOG.slice(0, limit) : CATALOG;
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
