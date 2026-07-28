"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Tool-card banner. Holds a 16:9 slot from first paint so nothing shifts, shows
 * a pulsing skeleton while the file is in flight, then cross-fades the image in.
 */
export function ToolCardImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // A cached image can finish before hydration, so onLoad never fires — check once.
  useEffect(() => {
    if (ref.current?.complete) setLoaded(true);
  }, []);

  return (
    <div className="border-border/60 bg-muted relative aspect-[16/9] w-full overflow-hidden border-b">
      <div
        aria-hidden
        className={cn(
          "from-muted via-muted/60 to-muted absolute inset-0 bg-gradient-to-br transition-opacity duration-500",
          loaded ? "opacity-0" : "animate-pulse opacity-100"
        )}
      />
      <Image
        ref={ref}
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        onLoad={() => setLoaded(true)}
        className={cn(
          "object-cover transition-all duration-500 ease-out group-hover:scale-[1.03]",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
