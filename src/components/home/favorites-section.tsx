"use client";

import { StarIcon } from "lucide-react";
import { ToolCard } from "@/components/shared/tool-grid";
import { TOOLS } from "@/constants/tools";
import { useFavorites } from "@/hooks/useFavorites";

/** Home-page section of starred tools — renders nothing until something is starred. */
export function FavoritesSection() {
  const { favorites } = useFavorites();
  const favTools = TOOLS.filter((tool) => favorites.includes(tool.id));
  if (favTools.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-24" aria-labelledby="favorites-heading">
      <div className="mb-10">
        <p className="text-muted-foreground flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase">
          <StarIcon className="size-3.5 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" aria-hidden />
          Pinned by you
        </p>
        <h2
          id="favorites-heading"
          className="font-heading mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Your favorites
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {favTools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  );
}
