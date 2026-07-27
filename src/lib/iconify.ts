/**
 * Thin client for the public Iconify API (https://iconify.design).
 *
 * The API is key-less and CORS-open, so — like svgl — every request runs from
 * the user's own browser. 200k+ icons across 150+ open-source sets.
 */

export const ICONIFY = "https://api.iconify.design";

/** Popular sets surfaced as quick filters. `all` means "search everything". */
export const POPULAR_SETS: { prefix: string; name: string }[] = [
  { prefix: "all", name: "All sets" },
  { prefix: "lucide", name: "Lucide" },
  { prefix: "ph", name: "Phosphor" },
  { prefix: "material-symbols", name: "Material Symbols" },
  { prefix: "tabler", name: "Tabler" },
  { prefix: "heroicons", name: "Heroicons" },
  { prefix: "mdi", name: "Material Design" },
  { prefix: "solar", name: "Solar" },
  { prefix: "carbon", name: "Carbon" },
  { prefix: "bi", name: "Bootstrap" },
  { prefix: "ri", name: "Remix" },
  { prefix: "fluent", name: "Fluent" },
  { prefix: "iconoir", name: "Iconoir" },
  { prefix: "line-md", name: "Line (animated)" },
  { prefix: "logos", name: "Logos (color)" },
];

/** Set browsed by default when no query is active. */
export const DEFAULT_BROWSE_SET = "lucide";

type SvgOpts = { color?: string; width?: number; flip?: string; rotate?: number };

/** Build the render URL for an icon id like "mdi:home". */
export function iconSvgUrl(id: string, opts: SvgOpts = {}): string {
  const [prefix, ...rest] = id.split(":");
  const name = rest.join(":");
  const p = new URLSearchParams();
  if (opts.color) p.set("color", opts.color);
  if (opts.width) {
    p.set("width", String(opts.width));
    p.set("height", String(opts.width));
  }
  if (opts.flip) p.set("flip", opts.flip);
  if (opts.rotate) p.set("rotate", String(opts.rotate));
  const qs = p.toString();
  return `${ICONIFY}/${prefix}/${name}.svg${qs ? `?${qs}` : ""}`;
}

/** Full-text search across sets (optionally scoped to one prefix). */
export async function searchIcons(
  query: string,
  opts: { prefix?: string; limit?: number } = {}
): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];
  const p = new URLSearchParams({ query: q, limit: String(opts.limit ?? 300) });
  if (opts.prefix && opts.prefix !== "all") p.set("prefixes", opts.prefix);
  try {
    const res = await fetch(`${ICONIFY}/search?${p.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { icons?: string[] };
    return Array.isArray(data.icons) ? data.icons : [];
  } catch {
    return [];
  }
}

/** Browse a whole set (flattened, capped). */
export async function collectionIcons(prefix: string, limit = 600): Promise<string[]> {
  try {
    const res = await fetch(`${ICONIFY}/collection?prefix=${encodeURIComponent(prefix)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      categories?: Record<string, string[]>;
      uncategorized?: string[];
    };
    const names: string[] = [];
    if (data.categories) for (const arr of Object.values(data.categories)) names.push(...arr);
    if (Array.isArray(data.uncategorized)) names.push(...data.uncategorized);
    return names.slice(0, limit).map((n) => `${prefix}:${n}`);
  } catch {
    return [];
  }
}
