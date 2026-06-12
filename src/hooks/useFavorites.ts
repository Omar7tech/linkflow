"use client";

import { useCallback } from "react";
import { STORAGE_KEYS } from "@/constants/site";
import { useLocalStorage } from "./useLocalStorage";

/** Favorited tool ids, shared across every component and tab. */
export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<string[]>(STORAGE_KEYS.favorites, []);

  const toggle = useCallback(
    (id: string) =>
      setFavorites((prev) =>
        prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
      ),
    [setFavorites]
  );

  return { favorites, toggle };
}
