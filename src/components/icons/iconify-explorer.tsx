"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { CodeIcon, CopyIcon, DownloadIcon, LinkIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  POPULAR_SETS,
  DEFAULT_BROWSE_SET,
  collectionIcons,
  iconSvgUrl,
  searchIcons,
} from "@/lib/iconify";
import { cn } from "@/lib/utils";

const PAGE = 120;

const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg,var(--muted) 25%,transparent 25%),linear-gradient(-45deg,var(--muted) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,var(--muted) 75%),linear-gradient(-45deg,transparent 75%,var(--muted) 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
} as const;

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  } catch {
    toast.error("Download failed.");
  }
}

async function copyText(text: string, msg: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(msg);
  } catch {
    toast.error("Couldn't copy.");
  }
}

/** Remote icon with skeleton, silent auto-retry and a graceful fallback. */
function IconImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [status, setStatus] = React.useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = React.useState(0);
  const [prev, setPrev] = React.useState(src);

  if (src !== prev) {
    setPrev(src);
    setStatus("loading");
    setAttempt(0);
  }

  const url = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

  return (
    <div className={cn("relative grid place-items-center", className)}>
      {status === "loading" && (
        <div className="bg-muted absolute inset-1.5 animate-pulse rounded" aria-hidden />
      )}
      {status === "error" ? (
        <span className="text-muted-foreground/50 text-xs">—</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- remote SVG from Iconify; next/image can't optimize SVGs and would need per-host config
        <img
          key={url}
          src={url}
          alt={alt}
          loading="lazy"
          onLoad={() => setStatus("loaded")}
          onError={() => (attempt < 2 ? setAttempt((a) => a + 1) : setStatus("error"))}
          className={cn("relative size-7 transition-opacity duration-200", status !== "loaded" && "opacity-0")}
        />
      )}
    </div>
  );
}

export function IconifyExplorer() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const neutral = dark ? "#e5e7eb" : "#1f2937";

  const [set, setSet] = React.useState("all");
  const [rawQuery, setRawQuery] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [ids, setIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [visible, setVisible] = React.useState(PAGE);
  const [selected, setSelected] = React.useState<string | null>(null);

  // Debounce the search box.
  React.useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // Load icons whenever the query or set changes.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setVisible(PAGE);
      const result = query
        ? await searchIcons(query, { prefix: set })
        : await collectionIcons(set === "all" ? DEFAULT_BROWSE_SET : set);
      if (!cancelled) {
        setIds(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, set]);

  const shown = ids.slice(0, visible);

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <SearchIcon
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder="Search 200,000+ icons…"
          aria-label="Search icons"
          className="rounded-full pl-10"
        />
      </div>

      {/* Set filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {POPULAR_SETS.map((s) => {
          const active = set === s.prefix;
          return (
            <button
              key={s.prefix}
              type="button"
              onClick={() => setSet(s.prefix)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border/60 bg-card text-muted-foreground hover:border-emerald-500/40 hover:text-foreground"
              )}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-20 text-sm">
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          Loading icons…
        </div>
      ) : shown.length === 0 ? (
        <div className="border-border/60 text-muted-foreground rounded-2xl border border-dashed py-20 text-center text-sm">
          No icons found{query ? ` for “${query}”` : ""}. Try another search or set.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
            {shown.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(id)}
                title={id}
                className="group border-border/60 grid aspect-square place-items-center rounded-lg border transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5"
              >
                <IconImg src={iconSvgUrl(id, { color: neutral })} alt={id} className="size-full" />
              </button>
            ))}
          </div>

          {visible < ids.length && (
            <div className="mt-8 flex justify-center">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setVisible((v) => v + PAGE)}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      {/* Detail dialog */}
      <IconDialog id={selected} onClose={() => setSelected(null)} neutral={neutral} />
    </div>
  );
}

function IconDialog({
  id,
  onClose,
  neutral,
}: {
  id: string | null;
  onClose: () => void;
  neutral: string;
}) {
  const [color, setColor] = React.useState("");
  const [prevId, setPrevId] = React.useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setColor("");
  }

  if (!id) return null;

  const previewUrl = iconSvgUrl(id, { color: color || neutral, width: 96 });
  // No color param ⇒ the SVG keeps `currentColor`, so it adapts in the user's app.
  const exportUrl = color ? iconSvgUrl(id, { color }) : iconSvgUrl(id);
  const fileName = `${id.replace(/:/g, "-")}.svg`;

  const SWATCHES = ["", "#10b981", "#0ea5e9", "#f43f5e", "#f59e0b", neutral];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm break-all">{id}</DialogTitle>
          <DialogDescription>Copy the SVG, grab the URL, or download it.</DialogDescription>
        </DialogHeader>

        <div className="grid place-items-center rounded-xl border p-8" style={CHECKER}>
          <IconImg src={previewUrl} alt={id} className="size-24 [&>img]:size-20" />
        </div>

        {/* Colour */}
        <div className="flex items-center gap-2">
          {SWATCHES.map((c, i) => {
            const selected = color === c;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "size-7 rounded-full border text-[9px] transition-transform hover:scale-105",
                  selected ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background" : "border-border"
                )}
                style={c ? { backgroundColor: c } : undefined}
                title={c || "Adaptive (currentColor)"}
                aria-label={c || "Adaptive colour"}
              >
                {!c && "A"}
              </button>
            );
          })}
          <label className="border-border ml-1 inline-flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border">
            <input
              type="color"
              value={color && color.startsWith("#") ? color : "#10b981"}
              onChange={(e) => setColor(e.target.value)}
              className="size-9 cursor-pointer border-0 bg-transparent p-0"
              aria-label="Custom colour"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={async () => {
              try {
                const res = await fetch(exportUrl);
                if (!res.ok) throw new Error();
                await copyText(await res.text(), "SVG copied");
              } catch {
                toast.error("Couldn't fetch the SVG.");
              }
            }}
          >
            <CopyIcon /> Copy SVG
          </Button>
          <Button type="button" variant="outline" onClick={() => copyText(`<Icon icon="${id}" />`, "Iconify JSX copied")}>
            <CodeIcon /> Copy JSX
          </Button>
          <Button type="button" variant="outline" onClick={() => copyText(exportUrl, "Image URL copied")}>
            <LinkIcon /> Copy URL
          </Button>
          <Button type="button" variant="outline" onClick={() => downloadFile(exportUrl, fileName)}>
            <DownloadIcon /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
