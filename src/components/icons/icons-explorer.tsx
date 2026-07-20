"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  LayersIcon,
  MoonIcon,
  SearchIcon,
  SparklesIcon,
  SunIcon,
  TypeIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Svg, SvglCategory, ThemeRoute } from "@/lib/svgl";

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
      <div className="mx-auto w-full min-w-0 max-w-7xl">
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

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function proxyUrl(url: string): string {
  return `/api/icons/svg?url=${encodeURIComponent(url)}`;
}

function IconCard({ svg }: { svg: Svg }) {
  const { resolvedTheme } = useTheme();
  // next-themes only resolves on the client. Stay in the server-rendered
  // (light) state until mounted so the first client render matches SSR.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";

  const hasWordmark = svg.wordmark != null;
  const [wordmark, setWordmark] = React.useState(false);
  // Which asset (logo vs wordmark) and, for themed assets, which variant.
  const asset = (wordmark && svg.wordmark ? svg.wordmark : svg.route) as string | ThemeRoute;
  const themed = typeof asset !== "string";
  const [pref, setPref] = React.useState<"light" | "dark" | null>(null); // null = follow app theme
  const variant: "light" | "dark" = pref ?? (dark ? "dark" : "light");
  const targetUrl = typeof asset === "string" ? asset : asset[variant];

  const label = `${svg.title}${wordmark ? " wordmark" : ""}`;

  const copy = async () => {
    try {
      const res = await fetch(proxyUrl(targetUrl));
      if (!res.ok) throw new Error();
      await navigator.clipboard.writeText(await res.text());
      toast.success(`Copied ${label} SVG`);
    } catch {
      toast.error("Couldn't copy — try again");
    }
  };

  const download = () => {
    const suffix = `${wordmark ? "-wordmark" : ""}${themed ? `-${variant}` : ""}`;
    const a = document.createElement("a");
    a.href = proxyUrl(targetUrl);
    a.download = `${slugify(svg.title)}${suffix}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <li className="group border-border/60 bg-card hover:border-emerald-500/40 relative flex flex-col items-center gap-3 rounded-xl border p-4 transition-colors">
      {/* Action toolbar — appears on hover / focus-within */}
      <div className="absolute top-1.5 right-1.5 left-1.5 flex items-center justify-between opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <div className="flex gap-0.5">
          {hasWordmark && (
            <ChipButton
              active={wordmark}
              onClick={() => setWordmark((w) => !w)}
              title={wordmark ? "Show logo" : "Show wordmark"}
            >
              <TypeIcon className="size-3.5" aria-hidden />
            </ChipButton>
          )}
          {themed && (
            <ChipButton
              active={pref != null}
              onClick={() => setPref(variant === "dark" ? "light" : "dark")}
              title={`Previewing ${variant} — switch variant`}
            >
              {variant === "dark" ? (
                <MoonIcon className="size-3.5" aria-hidden />
              ) : (
                <SunIcon className="size-3.5" aria-hidden />
              )}
            </ChipButton>
          )}
        </div>
        <div className="flex gap-0.5">
          <ChipButton onClick={copy} title={`Copy ${label} SVG`}>
            <CopyIcon className="size-3.5" aria-hidden />
          </ChipButton>
          <ChipButton onClick={download} title={`Download ${label} SVG`}>
            <DownloadIcon className="size-3.5" aria-hidden />
          </ChipButton>
          {svg.url && (
            <a
              href={svg.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Visit ${svg.title}`}
              aria-label={`Visit ${svg.title} website`}
              className="border-border/60 bg-background/90 text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded-md border transition-colors"
            >
              <ExternalLinkIcon className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>

      {/* Click the icon to copy */}
      <button
        type="button"
        onClick={copy}
        title={`Copy ${label} SVG`}
        className="flex h-12 w-full items-center justify-center pt-2"
      >
        <AssetImage asset={asset} pref={pref} alt={label} wide={wordmark} />
      </button>
      <span className="text-muted-foreground group-hover:text-foreground max-w-full truncate text-xs font-medium transition-colors">
        {svg.title}
      </span>
    </li>
  );
}

function ChipButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex size-6 items-center justify-center rounded-md border transition-colors",
        active
          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "border-border/60 bg-background/90 text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function AssetImage({
  asset,
  pref,
  alt,
  wide,
}: {
  asset: string | ThemeRoute;
  pref: "light" | "dark" | null;
  alt: string;
  wide?: boolean;
}) {
  const cls = cn("max-w-full object-contain", wide ? "h-8" : "h-10 w-10");
  if (typeof asset === "string") {
    // eslint-disable-next-line @next/next/no-img-element -- remote SVG from svgl; next/image can't optimize SVGs and would need per-host config
    return <img src={asset} alt={alt} loading="lazy" decoding="async" className={cls} />;
  }
  // Explicit variant chosen — render just that one.
  if (pref) {
    // eslint-disable-next-line @next/next/no-img-element -- see above
    return <img src={asset[pref]} alt={alt} loading="lazy" decoding="async" className={cls} />;
  }
  // Follow the app theme with a flash-free CSS swap.
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- theme-swapped via CSS */}
      <img src={asset.light} alt={alt} loading="lazy" decoding="async" className={cn(cls, "dark:hidden")} />
      {/* eslint-disable-next-line @next/next/no-img-element -- theme-swapped via CSS */}
      <img src={asset.dark} alt="" loading="lazy" decoding="async" className={cn(cls, "hidden dark:block")} />
    </>
  );
}
