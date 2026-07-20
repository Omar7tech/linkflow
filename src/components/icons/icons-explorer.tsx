"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { CopyIcon, ExternalLinkIcon, LayersIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { routeForTheme, type Svg, type SvglCategory } from "@/lib/svgl";

const LATEST = "__latest__";
const PAGE = 60; // icons rendered per window step

interface Props {
  categories: SvglCategory[];
  initial: Svg[];
}

export function IconsExplorer({ categories, initial }: Props) {
  const [active, setActive] = React.useState<string>(LATEST);
  const [rawQuery, setRawQuery] = React.useState("");
  const [items, setItems] = React.useState<Svg[]>(initial);
  const [loading, setLoading] = React.useState(false);
  const [visible, setVisible] = React.useState(PAGE);

  // Debounce the search box.
  const [query, setQuery] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setQuery(rawQuery.trim()), 250);
    return () => clearTimeout(id);
  }, [rawQuery]);

  // Fetch on filter/search change. The default view is seeded by the server,
  // so skip the very first run when nothing has changed yet.
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      if (!query && active === LATEST) return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const url = query
      ? `/api/icons?search=${encodeURIComponent(query)}`
      : active === LATEST
        ? "/api/icons"
        : `/api/icons?category=${encodeURIComponent(active)}`;

    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Svg[]) => {
        setItems(Array.isArray(data) ? data : []);
        setVisible(PAGE);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [query, active]);

  // Infinite window — grow the slice as the sentinel scrolls into view.
  const sentinel = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = sentinel.current;
    if (!el || visible >= items.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible((v) => Math.min(v + PAGE, items.length));
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, items.length]);

  const shown = items.slice(0, visible);
  const searching = query.length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      {/* Sidebar / category rail */}
      <aside className="lg:sticky lg:top-20 lg:h-[calc(100dvh-6rem)] lg:self-start">
        <nav
          aria-label="Icon categories"
          className="flex gap-1.5 overflow-x-auto pb-2 lg:h-full lg:flex-col lg:overflow-y-auto lg:pr-2 lg:pb-6"
        >
          <RailButton
            active={active === LATEST && !searching}
            onClick={() => {
              setActive(LATEST);
              setRawQuery("");
            }}
            icon={<SparklesIcon className="size-4" aria-hidden />}
            label="Latest"
          />
          {categories.map((c) => (
            <RailButton
              key={c.category}
              active={active === c.category && !searching}
              onClick={() => {
                setActive(c.category);
                setRawQuery("");
              }}
              label={c.category}
              count={c.total}
            />
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="min-w-0">
        <div className="relative mb-6 max-w-md">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Search 1,000+ brand icons…"
            className="pl-9"
            aria-label="Search icons"
          />
        </div>

        <p className="text-muted-foreground mb-4 flex items-center gap-2 text-sm">
          <LayersIcon className="size-4" aria-hidden />
          {loading
            ? "Loading…"
            : searching
              ? `${items.length} result${items.length === 1 ? "" : "s"} for “${query}”`
              : active === LATEST
                ? "Latest additions"
                : `${items.length} in ${active}`}
        </p>

        {!loading && items.length === 0 ? (
          <div className="border-border/60 text-muted-foreground rounded-2xl border border-dashed py-20 text-center text-sm">
            No icons found. Try another search or category.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {shown.map((svg) => (
              <IconCard key={svg.id} svg={svg} />
            ))}
          </ul>
        )}

        <div ref={sentinel} aria-hidden className="h-px" />
      </div>
    </div>
  );
}

function RailButton({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors lg:justify-between",
        active
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      {count != null && (
        <span
          className={cn(
            "font-mono text-[11px]",
            active ? "text-emerald-600/70 dark:text-emerald-400/70" : "text-muted-foreground/60"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function IconCard({ svg }: { svg: Svg }) {
  const { resolvedTheme } = useTheme();

  const copy = async () => {
    const url = routeForTheme(svg.route, resolvedTheme === "dark");
    try {
      const res = await fetch(`/api/icons/svg?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error();
      await navigator.clipboard.writeText(await res.text());
      toast.success(`Copied ${svg.title} SVG`);
    } catch {
      toast.error("Couldn't copy — try again");
    }
  };

  return (
    <li className="group border-border/60 bg-card hover:border-emerald-500/40 relative flex flex-col items-center gap-3 rounded-xl border p-4 transition-colors">
      <button
        type="button"
        onClick={copy}
        title={`Copy ${svg.title} SVG`}
        className="flex w-full flex-col items-center gap-3"
      >
        <span className="flex h-12 items-center justify-center">
          <IconImage svg={svg} />
        </span>
        <span className="text-muted-foreground group-hover:text-foreground max-w-full truncate text-xs font-medium transition-colors">
          {svg.title}
        </span>
        {/* Copy affordance on hover */}
        <span className="bg-background/90 text-muted-foreground pointer-events-none absolute top-2 right-2 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100">
          <CopyIcon className="size-3.5" aria-hidden />
        </span>
      </button>
      {svg.url && (
        <a
          href={svg.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Visit ${svg.title}`}
          className="bg-background/90 text-muted-foreground hover:text-foreground absolute top-2 left-2 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={`Visit ${svg.title} website`}
        >
          <ExternalLinkIcon className="size-3.5" aria-hidden />
        </a>
      )}
    </li>
  );
}

function IconImage({ svg }: { svg: Svg }) {
  const cls = "h-10 w-10 object-contain";
  if (typeof svg.route === "string") {
    // eslint-disable-next-line @next/next/no-img-element -- remote SVG from svgl; next/image can't optimize SVGs and would need per-host config
    return <img src={svg.route} alt={svg.title} loading="lazy" decoding="async" className={cls} />;
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- theme-swapped via CSS, see above */}
      <img src={svg.route.light} alt={svg.title} loading="lazy" decoding="async" className={cn(cls, "dark:hidden")} />
      {/* eslint-disable-next-line @next/next/no-img-element -- theme-swapped via CSS, see above */}
      <img src={svg.route.dark} alt="" loading="lazy" decoding="async" className={cn(cls, "hidden dark:block")} />
    </>
  );
}
