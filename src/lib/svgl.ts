/**
 * Thin, cached client for the public SVGL API (https://svgl.app).
 *
 * All fetches opt into Next's data cache with a long revalidate window so we
 * never hammer the upstream API — svgl explicitly asks consumers to cache.
 */

export type ThemeRoute = { dark: string; light: string };

export interface Svg {
  id: number;
  title: string;
  category: string | string[];
  route: string | ThemeRoute;
  url: string;
  wordmark?: string | ThemeRoute;
  brandUrl?: string;
}

export interface SvglCategory {
  category: string;
  total: number;
}

const BASE = "https://api.svgl.app";
const REVALIDATE = 60 * 60 * 24; // 24h — icon set changes slowly.

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE },
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getCategories(): Promise<SvglCategory[]> {
  const data = await getJson<SvglCategory[]>(`${BASE}/categories`);
  return (data ?? []).sort((a, b) => a.category.localeCompare(b.category));
}

/**
 * Newest icons first — the default landing view. svgl appends new entries, so
 * the tail of the full (cached) list is the most recent. Only a bounded slice
 * is ever shipped to the client.
 */
export async function getLatest(limit = 48): Promise<Svg[]> {
  const all = await getJson<Svg[]>(BASE);
  if (!all) return [];
  return all.slice(-limit).reverse();
}

export async function getByCategory(name: string): Promise<Svg[]> {
  // The /category endpoint matches the *exact* category name (case-sensitive,
  // spaces URL-encoded) — e.g. "AI" works but "ai" returns nothing. Do NOT
  // slugify or lowercase here.
  return (await getJson<Svg[]>(`${BASE}/category/${encodeURIComponent(name.trim())}`)) ?? [];
}

export async function searchSvgs(query: string): Promise<Svg[]> {
  const q = query.trim();
  if (!q) return [];
  return (await getJson<Svg[]>(`${BASE}?search=${encodeURIComponent(q)}`)) ?? [];
}

/** Resolve a route (string or themed pair) to a single URL for a given theme. */
export function routeForTheme(route: string | ThemeRoute, dark: boolean): string {
  return typeof route === "string" ? route : dark ? route.dark : route.light;
}
