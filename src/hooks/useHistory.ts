"use client";

import { useCallback } from "react";
import { HISTORY_LIMIT, STORAGE_KEYS } from "@/constants/site";
import type { HistoryEntry, ToolId } from "@/types";
import { useLocalStorage } from "./useLocalStorage";

export function useHistory(toolId: ToolId) {
  const [entries, setEntries, hydrated] = useLocalStorage<HistoryEntry[]>(
    STORAGE_KEYS.history(toolId),
    []
  );

  const add = useCallback(
    (label: string, value: string) => {
      setEntries((prev) => {
        // Skip exact duplicates of the most recent entry.
        if (prev[0]?.value === value) return prev;
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          toolId,
          label,
          value,
          createdAt: Date.now(),
        };
        return [entry, ...prev.filter((e) => e.value !== value)].slice(0, HISTORY_LIMIT);
      });
    },
    [setEntries, toolId]
  );

  const remove = useCallback(
    (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id)),
    [setEntries]
  );

  const clear = useCallback(() => setEntries([]), [setEntries]);

  return { entries, add, remove, clear, hydrated };
}
