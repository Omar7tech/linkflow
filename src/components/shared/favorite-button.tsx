"use client";

import { StarIcon } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

/**
 * Star toggle for a tool. Safe inside a <Link> — it swallows the click
 * instead of navigating.
 */
export function FavoriteButton({ toolId, className }: { toolId: string; className?: string }) {
  const { favorites, toggle } = useFavorites();
  const active = favorites.includes(toolId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(toolId);
      }}
      aria-pressed={active}
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
      title={active ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "text-muted-foreground/50 inline-flex items-center justify-center transition-colors hover:text-amber-500",
        active && "text-amber-500 dark:text-amber-400",
        className
      )}
    >
      <StarIcon className={cn("size-4", active && "fill-current")} />
    </button>
  );
}
