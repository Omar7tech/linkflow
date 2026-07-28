"use client";

import * as React from "react";
import { familyOf } from "@/lib/devdocs";
import { docsetIconId, docsetIconUrl, isFlatIcon, monogramHue } from "@/lib/devdocs-icons";
import { cn } from "@/lib/utils";

/**
 * The brand mark for a documentation set. Colour logos load as images; flat
 * glyphs are painted through a CSS mask so they follow the theme; anything
 * without a mark gets a stable, tinted monogram rather than a blank square.
 */
export function DocsetIcon({
  slug,
  name,
  className,
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  const [broken, setBroken] = React.useState(false);
  const family = familyOf(slug);
  const id = docsetIconId(family);
  const url = docsetIconUrl(family);
  const box = cn("size-4 shrink-0", className);

  if (!id || !url || broken) {
    const hue = monogramHue(family);
    const initials =
      name
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 2)
        .toUpperCase() || "?";
    return (
      <span
        aria-hidden
        className={cn(box, "flex items-center justify-center rounded-[5px] font-semibold")}
        style={{
          fontSize: "0.6em",
          background: `oklch(0.62 0.13 ${hue} / 0.16)`,
          color: `oklch(0.55 0.14 ${hue})`,
        }}
      >
        {initials}
      </span>
    );
  }

  if (isFlatIcon(id)) {
    return (
      <span
        aria-hidden
        className={cn(box, "text-foreground/75 bg-current")}
        style={{
          maskImage: `url("${url}")`,
          WebkitMaskImage: `url("${url}")`,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          maskSize: "contain",
          WebkitMaskSize: "contain",
        }}
      />
    );
  }

  return (
    // Remote SVGs from the Iconify CDN — not something next/image can optimise.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={cn(box, "object-contain")}
    />
  );
}
