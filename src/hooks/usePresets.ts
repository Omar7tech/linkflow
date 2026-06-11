"use client";

import { useCallback } from "react";
import { STORAGE_KEYS } from "@/constants/site";
import type { Preset, ToolId } from "@/types";
import { useLocalStorage } from "./useLocalStorage";

const PRESET_LIMIT = 20;

export function usePresets<T extends Record<string, unknown>>(toolId: ToolId) {
  const [presets, setPresets, hydrated] = useLocalStorage<Preset<T>[]>(
    STORAGE_KEYS.presets(toolId),
    []
  );

  const save = useCallback(
    (name: string, values: T) => {
      const preset: Preset<T> = {
        id: crypto.randomUUID(),
        name: name.trim(),
        values,
        createdAt: Date.now(),
      };
      setPresets((prev) =>
        [preset, ...prev.filter((p) => p.name !== preset.name)].slice(0, PRESET_LIMIT)
      );
    },
    [setPresets]
  );

  const remove = useCallback(
    (id: string) => setPresets((prev) => prev.filter((p) => p.id !== id)),
    [setPresets]
  );

  return { presets, save, remove, hydrated };
}
