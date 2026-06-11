"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * localStorage-backed state that is SSR-safe: the server (and hydration)
 * render the initial value, then the real stored value syncs in.
 * Multiple hook instances with the same key stay in sync via a shared emitter.
 */

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

// getSnapshot must return a stable reference for unchanged data,
// so parsed values are cached per key against the raw string.
const cache = new Map<string, { raw: string | null; value: unknown }>();

function readSnapshot<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    // Storage blocked — fall through to the fallback value.
  }
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.value as T;

  let value = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      // Corrupt entry — keep the fallback.
    }
  }
  cache.set(key, { raw, value });
  return value;
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const initialRef = useRef(initialValue);

  const value = useSyncExternalStore(
    subscribe,
    () => readSnapshot(key, initialRef.current),
    () => initialRef.current
  );

  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = readSnapshot(key, initialRef.current);
      const resolved = next instanceof Function ? next(prev) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Storage full or blocked — drop the persisted copy silently.
      }
      cache.set(key, { raw: JSON.stringify(resolved), value: resolved });
      emit();
    },
    [key]
  );

  return [value, set, hydrated] as const;
}
