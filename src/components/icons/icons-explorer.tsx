"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  ContrastIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  LayersIcon,
  Loader2Icon,
  SearchIcon,
  SparklesIcon,
  TypeIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Svg, SvglCategory, ThemeRoute } from "@/lib/svgl";

const LATEST = "__latest__";
const PAGE = 60; // icons rendered per window step
const LATEST_COUNT = 48; // newest icons shown in the default view

// The svgl API allows CORS (access-control-allow-origin: *), so the browser can
// hit it directly. That's deliberate: a server-side fetch gets blocked by
// svgl's Cloudflare from datacenter IPs, which broke the grid in production.
const SVGL = "https://api.svgl.app";

/** Build the svgl endpoint for the current view. */
function viewUrl(query: string, active: string): string {
  if (query) return `${SVGL}?search=${encodeURIComponent(query)}`;
  if (active === LATEST) return SVGL;
  return `${SVGL}/category/${encodeURIComponent(active)}`;
}

interface Props {
  /** Search term seeded from the URL (?q=). */
  initialQuery?: string;
  /** Category seeded from the URL (?category=). */
  initialCategory?: string | null;
}

export function IconsExplorer({ initialQuery, initialCategory }: Props) {
  const [active, setActive] = React.useState<string>(initialCategory || LATEST);
  const [rawQuery, setRawQuery] = React.useState(initialQuery ?? "");
  const [categories, setCategories] = React.useState<SvglCategory[]>([]);
  const [items, setItems] = React.useState<Svg[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [visible, setVisible] = React.useState(PAGE);

  // Debounce the search box.
  const [query, setQuery] = React.useState(initialQuery ?? "");
  React.useEffect(() => {
    const id = setTimeout(() => setQuery(rawQuery.trim()), 250);
    return () => clearTimeout(id);
  }, [rawQuery]);

  // Load the category rail once, client-side.
  React.useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${SVGL}/categories`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SvglCategory[]) => {
        if (Array.isArray(data)) {
          setCategories([...data].sort((a, b) => a.category.localeCompare(b.category)));
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // Fetch the grid on filter/search change (and on first mount), and mirror the
  // state into the URL so the view is shareable.
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    // Reflect the current view in the address bar (no navigation / RSC fetch).
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    else if (active !== LATEST) params.set("category", active);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);

    const ctrl = new AbortController();
    // `loading` already starts true for the first fetch; only re-arm it after.
    if (firstRun.current) firstRun.current = false;
    else setLoading(true);
    const isLatest = !query && active === LATEST;

    fetch(viewUrl(query, active), { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Svg[]) => {
        if (!Array.isArray(data)) return setItems([]);
        // The default view fetches the whole set — newest icons are at the tail.
        setItems(isLatest ? data.slice(-LATEST_COUNT).reverse() : data);
        setVisible(PAGE);
      })
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) setItems([]);
      })
      .finally(() => {
        // Don't clear loading for a fetch we've superseded/aborted.
        if (!ctrl.signal.aborted) setLoading(false);
      });

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
    <div className="grid min-w-0 gap-6 lg:grid-cols-[180px_1fr]">
      {/* Sidebar / category rail — a horizontal scroll strip on mobile, a
          vertical rail on desktop. min-w-0 lets it shrink so the non-wrapping
          rail scrolls instead of forcing the whole page to overflow sideways. */}
      <aside className="min-w-0 lg:sticky lg:top-20 lg:h-[calc(100dvh-6rem)] lg:self-start">
        <nav
          aria-label="Icon categories"
          className="-mx-4 flex min-w-0 snap-x gap-1.5 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:px-0 lg:h-full lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:-ml-2.5 lg:pb-6 lg:pr-2 [&::-webkit-scrollbar]:hidden"
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
      <div className="w-full min-w-0">
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

        <p className="text-muted-foreground mb-4 flex items-center gap-2 text-sm" aria-live="polite">
          {loading ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : (
            <LayersIcon className="size-4" aria-hidden />
          )}
          {loading
            ? "Loading icons…"
            : searching
              ? `${items.length} result${items.length === 1 ? "" : "s"} for “${query}”`
              : active === LATEST
                ? "Latest additions"
                : `${items.length} in ${active}`}
        </p>

        {loading ? (
          <ul
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
            aria-hidden
          >
            {Array.from({ length: 15 }).map((_, i) => (
              <IconCardSkeleton key={i} />
            ))}
          </ul>
        ) : items.length === 0 ? (
          <div className="border-border/60 text-muted-foreground rounded-2xl border border-dashed py-20 text-center text-sm">
            No icons found. Try another search or category.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {shown.map((svg) => (
              <IconCard key={svg.id} svg={svg} />
            ))}
          </ul>
        )}

        {/* Grow-on-scroll sentinel + a spinner while more of the current set streams in */}
        <div ref={sentinel} aria-hidden className="h-px" />
        {!loading && visible < items.length && (
          <div className="text-muted-foreground flex justify-center py-8">
            <Loader2Icon className="size-5 animate-spin" aria-hidden />
          </div>
        )}
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
        "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1 text-[13px] font-medium whitespace-nowrap transition-colors lg:justify-between",
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

async function fetchSvgText(url: string): Promise<string> {
  const res = await fetch(proxyUrl(url));
  if (!res.ok) throw new Error("svg fetch failed");
  return res.text();
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Bundle light + dark SVGs into a single .zip, client-side.
async function downloadZip(base: string, entries: { url: string; name: string }[]) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const texts = await Promise.all(entries.map((e) => fetchSvgText(e.url)));
  entries.forEach((e, i) => zip.file(e.name, texts[i]));
  const blob = await zip.generateAsync({ type: "blob" });
  const href = URL.createObjectURL(blob);
  triggerDownload(href, `${base}.zip`);
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

function IconCard({ svg }: { svg: Svg }) {
  const { resolvedTheme } = useTheme();
  const hasWordmark = svg.wordmark != null;
  const [wordmark, setWordmark] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);

  const asset = (wordmark && svg.wordmark ? svg.wordmark : svg.route) as string | ThemeRoute;
  const label = `${svg.title}${wordmark ? " wordmark" : ""}`;
  const themed = typeof asset !== "string";

  // Per-card background flip: preview the *opposite* variant on the opposite
  // background, so a dark-only mark can be checked on white even in dark mode.
  const [flip, setFlip] = React.useState(false);
  const flipped = flip && themed;
  const isDark = resolvedTheme === "dark";
  const forced: "light" | "dark" | null = flipped ? (isDark ? "light" : "dark") : null;

  // Resolve the previewed asset to one concrete URL for copy / quick download.
  // Read at click time only (client), so no hydration concern — the preview
  // itself swaps light/dark purely via CSS unless flipped.
  const target = () =>
    typeof asset === "string" ? asset : asset[forced ?? (isDark ? "dark" : "light")];

  // A dialog is only worth showing when there's a real choice to make:
  // a themed (light + dark) logo, or a separate wordmark.
  const multiple = hasWordmark || typeof svg.route !== "string";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(await fetchSvgText(target()));
      toast.success(`Copied ${label} SVG`);
    } catch {
      toast.error("Couldn't copy — try again");
    }
  };

  const download = () => {
    if (multiple) {
      setModalOpen(true);
      return;
    }
    triggerDownload(proxyUrl(target()), `${slugify(svg.title)}.svg`);
    toast.success(`Downloaded ${svg.title} SVG`);
  };

  return (
    <li className="group border-border/60 bg-card hover:border-emerald-500/40 hover:shadow-primary/5 relative flex flex-col rounded-xl border p-4 transition-all hover:shadow-lg">
      {/* Preview — click to copy the current variant */}
      <button
        type="button"
        onClick={copy}
        title={`Copy ${label} SVG`}
        className={cn(
          "flex h-28 w-full items-center justify-center rounded-lg px-2 transition-colors",
          flipped && (forced === "light" ? "bg-white" : "bg-neutral-950")
        )}
      >
        <AssetImage asset={asset} alt={label} wide={wordmark} variant={forced} />
      </button>

      {/* Identity */}
      <div className="mt-1 flex flex-col items-center text-center">
        <span className="max-w-full truncate text-sm font-semibold">{svg.title}</span>
      </div>

      {/* Actions — always visible, svgl-style */}
      <div className="border-border/60 mt-3 flex items-center justify-center gap-0.5 border-t pt-3">
        <ActionButton onClick={copy} title={`Copy ${label} SVG`}>
          <CopyIcon className="size-4" aria-hidden />
        </ActionButton>
        <ActionButton onClick={download} title={`Download ${svg.title} SVG`}>
          <DownloadIcon className="size-4" aria-hidden />
        </ActionButton>
        {svg.url && (
          <a
            href={svg.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Visit ${svg.title}`}
            aria-label={`Visit ${svg.title} website`}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors"
          >
            <ExternalLinkIcon className="size-4" aria-hidden />
          </a>
        )}
        {hasWordmark && (
          <ActionButton
            active={wordmark}
            onClick={() => setWordmark((w) => !w)}
            title={wordmark ? "Show logo" : "Show wordmark"}
          >
            <TypeIcon className="size-4" aria-hidden />
          </ActionButton>
        )}
        {themed && (
          <ActionButton
            active={flip}
            onClick={() => setFlip((f) => !f)}
            title={flip ? "Preview on theme background" : "Preview on opposite background"}
          >
            <ContrastIcon className="size-4" aria-hidden />
          </ActionButton>
        )}
      </div>

      {multiple && <DownloadDialog svg={svg} open={modalOpen} onOpenChange={setModalOpen} />}
    </li>
  );
}

function ActionButton({
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
      aria-pressed={active}
      className={cn(
        "flex size-8 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function DownloadDialog({
  svg,
  open,
  onOpenChange,
}: {
  svg: Svg;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const single = svg.wordmark == null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-2xl", single && "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle>Download {svg.title} SVGs</DialogTitle>
          <DialogDescription>This logo has multiple options to download:</DialogDescription>
        </DialogHeader>
        <div className={cn("grid gap-3", !single && "sm:grid-cols-2")}>
          <AssetColumn
            title={svg.title}
            asset={svg.route}
            kind="logo"
            onDone={() => onOpenChange(false)}
          />
          {svg.wordmark && (
            <AssetColumn
              title={svg.title}
              asset={svg.wordmark}
              kind="wordmark"
              onDone={() => onOpenChange(false)}
            />
          )}
        </div>
        <p className="text-muted-foreground px-2 pb-1 text-center text-xs leading-relaxed">
          Make sure you have permission from the brand owners before using their logo.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function AssetColumn({
  title,
  asset,
  kind,
  onDone,
}: {
  title: string;
  asset: string | ThemeRoute;
  kind: "logo" | "wordmark";
  onDone: () => void;
}) {
  const themed = typeof asset !== "string";
  const wm = kind === "wordmark";
  const base = `${slugify(title)}${wm ? "-wordmark" : ""}`;

  const one = (url: string, name: string) => {
    triggerDownload(proxyUrl(url), name);
    toast.success(`Downloaded ${name}`);
    onDone();
  };

  const zip = async () => {
    const a = asset as ThemeRoute;
    try {
      await downloadZip(base, [
        { url: a.light, name: `${base}-light.svg` },
        { url: a.dark, name: `${base}-dark.svg` },
      ]);
      toast.success(`Downloaded ${base}.zip`);
      onDone();
    } catch {
      toast.error("Couldn't build the .zip — try again");
    }
  };

  return (
    <div className="border-border/60 flex flex-col gap-2 rounded-xl border p-3">
      <div className="bg-muted/40 flex h-24 items-center justify-center rounded-lg p-4">
        <AssetImage asset={asset} alt={`${title}${wm ? " wordmark" : ""}`} wide={wm} />
      </div>
      {themed ? (
        <>
          <DownloadRow label="Light & dark variants" ext=".zip" onClick={zip} />
          <DownloadRow
            label={wm ? "Wordmark light variant" : "Only light variant"}
            ext=".svg"
            onClick={() => one((asset as ThemeRoute).light, `${base}-light.svg`)}
          />
          <DownloadRow
            label={wm ? "Wordmark dark variant" : "Only dark variant"}
            ext=".svg"
            onClick={() => one((asset as ThemeRoute).dark, `${base}-dark.svg`)}
          />
        </>
      ) : (
        <DownloadRow
          label={wm ? "Wordmark" : "Logo"}
          ext=".svg"
          onClick={() => one(asset as string, `${base}.svg`)}
        />
      )}
    </div>
  );
}

function DownloadRow({
  label,
  ext,
  onClick,
}: {
  label: string;
  ext: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/row border-border/60 bg-background hover:border-emerald-500/50 hover:bg-muted flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors"
    >
      <span className="flex items-center gap-2">
        <DownloadIcon
          className="text-muted-foreground size-4 transition-colors group-hover/row:text-emerald-600 dark:group-hover/row:text-emerald-400"
          aria-hidden
        />
        {label}
      </span>
      <span className="text-muted-foreground/70 font-mono text-xs">{ext}</span>
    </button>
  );
}

// Remote SVG that fades in once decoded, so icons don't pop in as they stream.
function FadeImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = React.useState(false);
  // Cover the cached case, where onLoad may have already fired before mount.
  const ref = React.useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) setLoaded(true);
  }, []);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote SVG from svgl; next/image can't optimize SVGs and would need per-host config
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={cn(className, "transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
    />
  );
}

function AssetImage({
  asset,
  alt,
  wide,
  variant,
}: {
  asset: string | ThemeRoute;
  alt: string;
  wide?: boolean;
  /** Force a specific themed variant (null = follow the app theme via CSS). */
  variant?: "light" | "dark" | null;
}) {
  // Size by height with an auto width so landscape logos scale up to fill the
  // card instead of being pinned to a small square. max-w-full keeps very wide
  // marks from overflowing.
  const cls = cn("w-auto max-w-full object-contain", wide ? "h-10" : "h-14");
  if (typeof asset === "string") {
    return <FadeImg src={asset} alt={alt} className={cls} />;
  }
  // Explicit variant chosen (background-flip preview) — render just that one.
  if (variant) {
    return <FadeImg key={variant} src={asset[variant]} alt={alt} className={cls} />;
  }
  // Follow the app theme with a flash-free CSS swap.
  return (
    <>
      <FadeImg src={asset.light} alt={alt} className={cn(cls, "dark:hidden")} />
      <FadeImg src={asset.dark} alt="" className={cn(cls, "hidden dark:block")} />
    </>
  );
}

// Placeholder card shown while a category / search fetch is in flight.
function IconCardSkeleton() {
  return (
    <li className="border-border/60 bg-card flex flex-col rounded-xl border p-4">
      <div className="flex h-28 w-full items-center justify-center">
        <div className="bg-muted size-14 animate-pulse rounded-xl" />
      </div>
      <div className="mt-1 flex justify-center">
        <div className="bg-muted h-3.5 w-20 animate-pulse rounded-full" />
      </div>
      <div className="border-border/60 mt-3 flex items-center justify-center gap-1.5 border-t pt-3">
        <div className="bg-muted size-6 animate-pulse rounded-md" />
        <div className="bg-muted size-6 animate-pulse rounded-md" />
        <div className="bg-muted size-6 animate-pulse rounded-md" />
      </div>
    </li>
  );
}
