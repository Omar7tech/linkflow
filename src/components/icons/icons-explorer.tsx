"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  LayersIcon,
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

  // Resolve the previewed asset to one concrete URL for copy / quick download.
  // Read at click time only (client), so no hydration concern — the preview
  // itself swaps light/dark purely via CSS.
  const target = () =>
    typeof asset === "string" ? asset : resolvedTheme === "dark" ? asset.dark : asset.light;

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
        className="flex h-28 w-full items-center justify-center px-2"
      >
        <AssetImage asset={asset} alt={label} wide={wordmark} />
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

function AssetImage({
  asset,
  alt,
  wide,
}: {
  asset: string | ThemeRoute;
  alt: string;
  wide?: boolean;
}) {
  // Size by height with an auto width so landscape logos scale up to fill the
  // card instead of being pinned to a small square. max-w-full keeps very wide
  // marks from overflowing.
  const cls = cn("w-auto max-w-full object-contain", wide ? "h-10" : "h-14");
  if (typeof asset === "string") {
    // eslint-disable-next-line @next/next/no-img-element -- remote SVG from svgl; next/image can't optimize SVGs and would need per-host config
    return <img src={asset} alt={alt} loading="lazy" decoding="async" className={cls} />;
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
