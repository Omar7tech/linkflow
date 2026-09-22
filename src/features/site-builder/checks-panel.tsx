"use client";

import { CircleAlertIcon, LightbulbIcon, PartyPopperIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CheckResult } from "@/lib/site-builder";

interface ChecksPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: CheckResult[];
  onJump: (result: CheckResult) => void;
}

const STYLE = {
  error: { icon: CircleAlertIcon, tone: "text-red-600 dark:text-red-400", label: "Fix before publishing" },
  warn: { icon: TriangleAlertIcon, tone: "text-amber-600 dark:text-amber-400", label: "Worth a look" },
  tip: { icon: LightbulbIcon, tone: "text-sky-600 dark:text-sky-400", label: "Could be better" },
} as const;

/** The pre-flight list: everything that would embarrass you after publishing. */
export function ChecksPanel({ open, onOpenChange, results, onJump }: ChecksPanelProps) {
  const groups = (["error", "warn", "tip"] as const).map((level) => ({
    level,
    items: results.filter((result) => result.level === level),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Before you publish</DialogTitle>
          <DialogDescription>
            Checked on this page as you edit: content, links, reading contrast and the details search engines look for.
          </DialogDescription>
        </DialogHeader>

        {!results.length ? (
          <div className="py-10 text-center">
            <PartyPopperIcon className="text-primary mx-auto mb-3 size-7" aria-hidden />
            <p className="font-heading text-lg font-medium">Nothing left to flag</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm leading-6">
              Read it once out loud, then export. That last read catches the things no checker can.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(({ level, items }) => {
              if (!items.length) return null;
              const { icon: Icon, tone, label } = STYLE[level];
              return (
                <section key={level}>
                  <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider">
                    <Icon className={cn("size-3.5", tone)} aria-hidden />
                    {label} · {items.length}
                  </p>
                  <ul className="space-y-1.5">
                    {items.map((result) => (
                      <li key={result.id} className="border-border/80 bg-muted/25 rounded-xl border p-3">
                        <p className="text-sm font-medium">{result.title}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs leading-5">{result.detail}</p>
                        {(result.blockId || result.target) && (
                          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => onJump(result)}>
                            {result.target === "meta" ? "Open page settings" : result.target === "theme" ? "Open design" : "Go to the section"}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
