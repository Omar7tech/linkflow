"use client";

import * as React from "react";
import { CheckIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_SLUGS,
  familyOf,
  formatSize,
  groupFamilies,
  type DocsetMeta,
} from "@/lib/devdocs";
import { cn } from "@/lib/utils";
import { DocsetIcon } from "./docset-icon";

/**
 * Browse every documentation set DevDocs publishes and choose which ones to
 * search. One version per project stays enabled at a time — switching versions
 * swaps it rather than piling both into your results.
 */
export function DocsetPicker({
  open,
  onOpenChange,
  docsets,
  enabled,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docsets: readonly DocsetMeta[];
  enabled: readonly string[];
  onChange: (slugs: string[]) => void;
}) {
  const [query, setQuery] = React.useState("");

  const families = React.useMemo(() => groupFamilies(docsets), [docsets]);
  const enabledSet = React.useMemo(() => new Set(enabled), [enabled]);

  const visible = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = [...families.values()];
    if (!term) return rows;
    return rows.filter(([first]) =>
      [first.name, first.slug, first.alias ?? ""].some((field) =>
        field.toLowerCase().includes(term)
      )
    );
  }, [families, query]);

  /** Enable a specific version, replacing any other version of the same project. */
  const select = (slug: string) => {
    const family = familyOf(slug);
    const kept = enabled.filter((s) => familyOf(s) !== family);
    onChange([...kept, slug]);
  };

  const disable = (family: string) => {
    onChange(enabled.filter((s) => familyOf(s) !== family));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-border/60 border-b px-5 pt-5 pb-4">
          <DialogTitle className="font-heading text-lg">Documentation sets</DialogTitle>
          <DialogDescription>
            {docsets.length.toLocaleString()} sets from DevDocs. Enable the ones you want to search
            — each is downloaded once, then kept locally.
          </DialogDescription>
          <div className="relative mt-3">
            <SearchIcon
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name…"
              className="h-9 pl-9"
              aria-label="Filter documentation sets"
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {visible.length === 0 && (
            <p className="text-muted-foreground px-3 py-10 text-center text-sm">
              Nothing matches “{query}”.
            </p>
          )}
          <ul className="space-y-0.5">
            {visible.map((versions) => {
              const primary = versions[0];
              const family = familyOf(primary.slug);
              const active = versions.find((v) => enabledSet.has(v.slug));
              return (
                <li key={family}>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                      active ? "bg-emerald-500/8" : "hover:bg-muted/60"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => (active ? disable(family) : select(primary.slug))}
                      aria-pressed={!!active}
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        active
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-border hover:border-emerald-500/60"
                      )}
                    >
                      {active && <CheckIcon className="size-3.5" aria-hidden />}
                      <span className="sr-only">
                        {active ? `Disable ${primary.name}` : `Enable ${primary.name}`}
                      </span>
                    </button>

                    <DocsetIcon slug={primary.slug} name={primary.name} className="size-5" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{primary.name}</p>
                      <p className="text-muted-foreground truncate font-mono text-[11px]">
                        {(active ?? primary).release || (active ?? primary).version || "latest"} ·{" "}
                        {formatSize((active ?? primary).size)}
                      </p>
                    </div>

                    {versions.length > 1 && (
                      <select
                        value={active?.slug ?? primary.slug}
                        onChange={(e) => select(e.target.value)}
                        aria-label={`${primary.name} version`}
                        className="border-border bg-background text-muted-foreground focus-visible:ring-ring/40 h-7 max-w-[8.5rem] rounded-lg border px-2 font-mono text-xs focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {versions.map((version) => (
                          <option key={version.slug} value={version.slug}>
                            {version.version || version.release || "latest"}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-border/60 flex items-center justify-between gap-3 border-t px-5 py-3">
          <p className="text-muted-foreground text-xs">
            <span className="text-foreground font-medium">{enabled.length}</span> enabled
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onChange([...DEFAULT_SLUGS])}>
              <RotateCcwIcon aria-hidden />
              Reset
            </Button>
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
