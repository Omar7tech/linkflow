"use client";

import { HistoryIcon, Trash2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { useHistory } from "@/hooks/useHistory";
import { CopyButton } from "./copy-button";

interface HistoryPanelProps {
  history: ReturnType<typeof useHistory>;
}

export function HistoryPanel({ history }: HistoryPanelProps) {
  const { entries, remove, clear, hydrated } = history;

  if (!hydrated || entries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HistoryIcon className="size-4" /> Recent
        </CardTitle>
        <CardDescription>
          Stored only in this browser — the last {entries.length === 1 ? "item" : `${entries.length} items`} you generated.
        </CardDescription>
        <CardAction>
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <Trash2Icon /> Clear all
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="border-border bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.label}</p>
                <p className="text-muted-foreground truncate font-mono text-xs">{entry.value}</p>
              </div>
              <CopyButton
                text={entry.value}
                label=""
                variant="ghost"
                size="icon-sm"
                aria-label={`Copy ${entry.label}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${entry.label} from history`}
                onClick={() => remove(entry.id)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
