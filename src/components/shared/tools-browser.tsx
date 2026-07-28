"use client";

import { LayoutGridIcon, SearchIcon, XIcon, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { TOOLS, TOOL_CATEGORIES } from "@/constants/tools";
import { cn } from "@/lib/utils";
import type { ToolCategory } from "@/types";
import { ToolCard } from "./tool-grid";

type Filter = ToolCategory | "all";

const PILLS: readonly { id: Filter; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All", icon: LayoutGridIcon },
  ...TOOL_CATEGORIES,
];

export function ToolsBrowser() {
  const [active, setActive] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  // Flat matches for the search view — name, description and keywords, scoped to the active pill.
  const matches = useMemo(() => {
    if (!searching) return [];
    return TOOLS.filter((t) => {
      if (active !== "all" && t.category !== active) return false;
      return (
        t.name.toLowerCase().includes(q) ||
        t.shortName.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [searching, q, active]);

  // Grouped sections for the browse view (no query).
  const sections = useMemo(() => {
    const visible =
      active === "all" ? TOOL_CATEGORIES : TOOL_CATEGORIES.filter((c) => c.id === active);
    return visible
      .map((category) => ({
        ...category,
        tools: TOOLS.filter((t) => t.category === category.id),
      }))
      .filter((s) => s.tools.length > 0);
  }, [active]);

  return (
    <div>
      {/* Search + category filter */}
      <div className="mb-10 space-y-4">
        <div className="relative max-w-md">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…"
            aria-label="Search tools"
            className="border-border/60 bg-card placeholder:text-muted-foreground focus:border-emerald-500/60 focus:ring-emerald-500/15 w-full rounded-full border py-2.5 pr-10 pl-10 text-sm outline-none transition-colors focus:ring-4"
          />
          {searching && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
          )}
        </div>

        <div role="tablist" aria-label="Filter tools by category" className="flex flex-wrap gap-2">
          {PILLS.map((pill) => {
            const selected = active === pill.id;
            const Icon = pill.icon;
            return (
              <button
                key={pill.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(pill.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95",
                  selected
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border/60 bg-card text-muted-foreground hover:border-emerald-500/40 hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {searching ? (
        // Search view — flat grid of matches, or an empty state.
        matches.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {matches.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        ) : (
          <div className="border-border/60 text-muted-foreground rounded-2xl border border-dashed py-20 text-center text-sm">
            No tools match “{query.trim()}”. Try a different search.
          </div>
        )
      ) : (
        // Browse view — one section per category, headed and breathable.
        <div className="space-y-14">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.id} aria-labelledby={`cat-${section.id}`}>
                <div className="mb-5 flex items-start gap-3">
                  <span className="border-border bg-card mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border">
                    <Icon
                      className="size-4 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                  </span>
                  <div>
                    <h2
                      id={`cat-${section.id}`}
                      className="font-heading text-xl font-bold tracking-tight"
                    >
                      {section.label}
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-sm">{section.description}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {section.tools.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
