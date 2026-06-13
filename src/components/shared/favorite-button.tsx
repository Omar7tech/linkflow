"use client";

import { StarIcon } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

/**
 * Star toggle for a tool. Safe inside a <Link> — it swallows the click
 * instead of navigating.
 */
export function FavoriteButton({
  toolId,
  className,
  variant = "plain",
}: {
  toolId: string;
  className?: string;
  /** "chip" renders a rounded, bordered button; "plain" is a bare star. */
  variant?: "plain" | "chip";
}) {
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
        "inline-flex items-center justify-center transition-all",
        variant === "plain" && "text-muted-foreground/50 hover:text-amber-500",
        variant === "chip" &&
          "border-border/60 bg-background/50 text-muted-foreground/60 size-8 rounded-full border backdrop-blur-sm hover:scale-105 hover:border-amber-400/50 hover:text-amber-500 active:scale-95",
        variant === "chip" && active && "border-amber-400/50 bg-amber-500/10",
        active && "text-amber-500 dark:text-amber-400",
        className
      )}
    >
      <StarIcon className={cn("size-[15px]", active && "fill-current")} />
    </button>
  );
}
