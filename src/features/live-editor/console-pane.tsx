"use client";

import * as React from "react";
import { ChevronRightIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConsoleLevel = "log" | "info" | "warn" | "error" | "input" | "result";

export interface ConsoleEntry {
  id: number;
  level: ConsoleLevel;
  parts: string[];
  /** Identical consecutive messages collapse into one row with a count. */
  count: number;
}

const LEVEL_STYLES: Record<ConsoleLevel, string> = {
  log: "text-foreground/85",
  info: "text-sky-600 dark:text-sky-400",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
  input: "text-muted-foreground",
  result: "text-emerald-600 dark:text-emerald-400",
};

const LEVEL_ROW: Partial<Record<ConsoleLevel, string>> = {
  warn: "bg-amber-500/5",
  error: "bg-red-500/5",
};

interface ConsolePaneProps {
  entries: ConsoleEntry[];
  onClear: () => void;
  onEvaluate: (code: string) => void;
}

export function ConsolePane({ entries, onClear, onEvaluate }: ConsolePaneProps) {
  const [draft, setDraft] = React.useState("");
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const pinnedRef = React.useRef(true);

  // Follow new output, unless the reader has scrolled up to look at something.
  React.useEffect(() => {
    const node = scrollRef.current;
    if (node && pinnedRef.current) node.scrollTop = node.scrollHeight;
  }, [entries]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const code = draft.trim();
    if (!code) return;
    onEvaluate(code);
    setHistory((prev) => [...prev, code]);
    setHistoryIndex(-1);
    setDraft("");
  };

  const recallHistory = (direction: -1 | 1) => {
    if (history.length === 0) return;
    const next =
      historyIndex === -1
        ? direction === -1
          ? history.length - 1
          : -1
        : Math.min(history.length - 1, Math.max(-1, historyIndex + direction));
    setHistoryIndex(next);
    setDraft(next === -1 ? "" : history[next]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        className="min-h-0 flex-1 overflow-y-auto font-mono text-xs"
      >
        {entries.length === 0 ? (
          <p className="text-muted-foreground px-3 py-3">
            Console output, errors and evaluated expressions appear here.
          </p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "border-border/40 flex gap-2 border-b px-3 py-1.5 leading-relaxed",
                LEVEL_ROW[entry.level]
              )}
            >
              <span aria-hidden className="text-muted-foreground/60 select-none">
                {entry.level === "input" ? "›" : entry.level === "result" ? "‹" : "·"}
              </span>
              <span className={cn("min-w-0 flex-1 break-words whitespace-pre-wrap", LEVEL_STYLES[entry.level])}>
                {entry.parts.join("  ")}
              </span>
              {entry.count > 1 && (
                <span className="bg-muted text-muted-foreground h-fit rounded-full px-1.5 text-[10px] font-semibold">
                  {entry.count}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="border-border/60 flex items-center gap-2 border-t px-2 py-1.5">
        <ChevronRightIcon className="text-primary size-3.5 shrink-0" aria-hidden />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              recallHistory(-1);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              recallHistory(1);
            }
          }}
          placeholder="Run an expression in the preview…"
          spellCheck={false}
          autoComplete="off"
          aria-label="Console input"
          className="placeholder:text-muted-foreground/70 min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
        />
        <Button type="button" variant="ghost" size="icon-xs" onClick={onClear} aria-label="Clear console">
          <TrashIcon />
        </Button>
      </form>
    </div>
  );
}
