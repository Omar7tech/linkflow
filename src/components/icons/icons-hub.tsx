"use client";

import * as React from "react";
import { BadgeCheckIcon, ShapesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconsExplorer } from "./icons-explorer";
import { IconifyExplorer } from "./iconify-explorer";

const TABS = [
  { id: "brands", label: "Brand logos", icon: BadgeCheckIcon },
  { id: "icons", label: "All icons", icon: ShapesIcon },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function IconsHub({
  initialQuery,
  initialCategory,
}: {
  initialQuery?: string;
  initialCategory?: string | null;
}) {
  const [tab, setTab] = React.useState<Tab>("brands");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Icon source"
        className="border-border/60 bg-card mb-8 inline-flex gap-1 rounded-full border p-1"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      {tab === "brands" ? (
        <IconsExplorer initialQuery={initialQuery} initialCategory={initialCategory} />
      ) : (
        <IconifyExplorer />
      )}
    </div>
  );
}
