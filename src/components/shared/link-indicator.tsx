"use client";

import { ArrowUpRightIcon, Loader2Icon } from "lucide-react";
import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

/**
 * Fixed-size pending hint for any <Link> — must be rendered as a descendant
 * of the Link. Fades in after a short delay so prefetched (instant)
 * navigations never flash it, and reserves its space to avoid layout shift.
 */
export function LinkLoadingIndicator({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden className={cn("inline-flex size-3.5 shrink-0 items-center justify-center", className)}>
      <Loader2Icon
        className={cn(
          "size-3.5 animate-spin opacity-0 transition-opacity duration-200",
          pending && "opacity-100 delay-100"
        )}
      />
    </span>
  );
}

/**
 * Tool-card affordance: the hover arrow swaps to a spinner while the
 * navigation is pending. Same footprint either way — no layout shift.
 */
export function ToolCardIndicator() {
  const { pending } = useLinkStatus();
  if (pending) {
    return <Loader2Icon aria-hidden className="size-3.5 animate-spin" />;
  }
  return (
    <ArrowUpRightIcon
      aria-hidden
      className="size-3.5 -translate-x-0.5 translate-y-0.5 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
    />
  );
}
