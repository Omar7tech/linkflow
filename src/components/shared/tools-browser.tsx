"use client";

import { LayoutGridIcon, type LucideIcon } from "lucide-react";
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

  const sections = useMemo(() => {
    const visible = active === "all" ? TOOL_CATEGORIES : TOOL_CATEGORIES.filter((c) => c.id === active);
    return visible
      .map((category) => ({
        ...category,
        tools: TOOLS.filter((t) => t.category === category.id),
      }))
      .filter((s) => s.tools.length > 0);
  }, [active]);

  return (
    <div>
      {/* Category pills */}
      <div
        role="tablist"
        aria-label="Filter tools by category"
        className="mb-10 flex flex-wrap gap-2"
      >
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

      {/* One section per category — headed, breathable, never one giant wall */}
      <div className="space-y-14">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.id} aria-labelledby={`cat-${section.id}`}>
              <div className="mb-5 flex items-start gap-3">
                <span className="border-border bg-card mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border">
                  <Icon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
