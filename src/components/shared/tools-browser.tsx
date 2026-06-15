"use client";

import { useMemo, useState } from "react";
import { TOOLS, TOOL_CATEGORIES } from "@/constants/tools";
import { cn } from "@/lib/utils";
import type { ToolCategory } from "@/types";
import { ToolCard } from "./tool-grid";

type Filter = ToolCategory | "all";

const PILLS: readonly { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  ...TOOL_CATEGORIES,
];

export function ToolsBrowser() {
  const [active, setActive] = useState<Filter>("all");

  const tools = useMemo(
    () => (active === "all" ? TOOLS : TOOLS.filter((t) => t.category === active)),
    [active]
  );

  return (
    <div>
      {/* Category pills */}
      <div
        role="tablist"
        aria-label="Filter tools by category"
        className="mb-8 flex flex-wrap gap-2"
      >
        {PILLS.map((pill) => {
          const selected = active === pill.id;
          return (
            <button
              key={pill.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(pill.id)}
              className={cn(
                "inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95",
                selected
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border/60 bg-card text-muted-foreground hover:border-emerald-500/40 hover:text-foreground"
              )}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}
