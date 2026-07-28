"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface Heading {
  id: string;
  text: string;
  /** 2 for `<h2>`, 3 for `<h3>` — deeper levels are folded into 3. */
  level: number;
}

/**
 * "On this page" rail. Reference pages run long, so the headings double as the
 * map: the active one is tracked against the reading pane's own scrolling.
 */
export function DocToc({
  headings,
  scrollRef,
  onJump,
}: {
  headings: readonly Heading[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onJump: (id: string) => void;
}) {
  const [active, setActive] = React.useState<string | null>(null);

  React.useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport || !headings.length || typeof IntersectionObserver === "undefined") return;

    // Track which headings are on screen and treat the topmost as current, so
    // the rail keeps up with fast scrolling instead of flipping between entries.
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const { id } = entry.target;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const first = headings.find((heading) => visible.has(heading.id));
        if (first) setActive(first.id);
      },
      { root: viewport, rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );

    for (const heading of headings) {
      const element = viewport.querySelector(`#${CSS.escape(heading.id)}`);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [headings, scrollRef]);

  if (headings.length < 2) return null;

  return (
    <nav
      aria-label="On this page"
      // Sticks to the top of the reading pane, which is the scroll container.
      className="sticky top-0 hidden max-h-[calc(100svh-12rem)] w-52 shrink-0 self-start overflow-y-auto py-7 pr-6 pl-2 xl:block"
    >
      <p className="text-muted-foreground mb-2.5 font-mono text-[10px] font-medium tracking-[0.18em] uppercase">
        On this page
      </p>
      <ul className="border-border/60 space-y-px border-l">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={(event) => {
                event.preventDefault();
                onJump(heading.id);
              }}
              className={cn(
                "-ml-px block truncate border-l py-1 text-xs transition-colors",
                heading.level > 2 ? "pl-5" : "pl-3",
                active === heading.id
                  ? "border-primary text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              )}
              title={heading.text}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
