"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  LayersIcon,
  LinkIcon,
  Loader2Icon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STORAGE_KEYS } from "@/constants/site";
import {
  DEFAULT_SLUGS,
  POPULAR_FAMILIES,
  devdocsUrl,
  familyOf,
  loadIndex,
  loadPage,
  permalink,
  searchDocsets,
  type DocEntry,
  type DocHit,
  type DocsetMeta,
  type LoadedDocset,
} from "@/lib/devdocs";
import { cn } from "@/lib/utils";
import { DocPane } from "./doc-pane";
import { DocToc, type Heading } from "./doc-toc";
import { DocsetIcon } from "./docset-icon";
import { DocsetPicker } from "./docset-picker";

/* ------------------------------------------------ enabled sets (persisted) */

/**
 * The enabled slugs live in localStorage rather than React state so the choice
 * survives reloads and stays in step across tabs. `useSyncExternalStore` reads
 * them without an effect, which also keeps hydration honest — the server always
 * renders the defaults.
 */
const listeners = new Set<() => void>();
const SERVER_ENABLED: readonly string[] = DEFAULT_SLUGS;
let cachedRaw: string | null = null;
let cachedEnabled: readonly string[] = SERVER_ENABLED;

function subscribeEnabled(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getEnabledSnapshot(): readonly string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.docsets);
  } catch {
    /* storage blocked — fall through to the defaults */
  }
  // The snapshot must be reference-stable between changes.
  if (raw === cachedRaw) return cachedEnabled;
  cachedRaw = raw;
  try {
    const parsed: unknown = JSON.parse(raw ?? "null");
    const slugs = Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
    cachedEnabled = slugs.length ? (slugs as string[]) : SERVER_ENABLED;
  } catch {
    cachedEnabled = SERVER_ENABLED;
  }
  return cachedEnabled;
}

function getEnabledServerSnapshot(): readonly string[] {
  return SERVER_ENABLED;
}

function writeEnabled(slugs: readonly string[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.docsets, JSON.stringify(slugs));
  } catch {
    // Nothing persisted, but keep the session usable by publishing anyway.
    cachedRaw = JSON.stringify(slugs);
    cachedEnabled = slugs;
  }
  for (const notify of listeners) notify();
}

/* ------------------------------------------------------------------ shapes */

/** Where the sidebar sits in the docset → section → entry drill-down. */
interface BrowseState {
  slug?: string;
  section?: string;
}

interface Location {
  slug: string;
  /** Page path, without the anchor. */
  path: string;
  hash: string;
}

/** Back/forward within the reading pane, independent of browser history. */
interface NavState {
  stack: Location[];
  at: number;
}

/** The last page fetch to finish, tagged with what it was for. */
interface PageState {
  key: string;
  html?: string;
  error?: string;
}

const NAV_LIMIT = 50;

/** Split `library/functions#print` into its page and anchor halves. */
function parseTarget(target: string): { path: string; hash: string } {
  const at = target.indexOf("#");
  if (at === -1) return { path: target, hash: "" };
  return { path: target.slice(0, at), hash: target.slice(at + 1) };
}

const locationKey = (loc: Location) => `${loc.slug}/${loc.path}`;

/* -------------------------------------------------------------------- view */

export function DocsBrowser({
  initialSlug,
  initialPath,
  className,
}: {
  initialSlug?: string;
  initialPath?: string;
  className?: string;
}) {
  const enabled = React.useSyncExternalStore(
    subscribeEnabled,
    getEnabledSnapshot,
    getEnabledServerSnapshot
  );

  const [docsets, setDocsets] = React.useState<DocsetMeta[] | null>(null);
  const [manifestFailed, setManifestFailed] = React.useState(false);
  const [indexes, setIndexes] = React.useState<Record<string, DocEntry[]>>({});
  const [failedSlugs, setFailedSlugs] = React.useState<readonly string[]>([]);

  const [query, setQuery] = React.useState("");
  const [selection, setSelection] = React.useState({ query: "", index: 0 });
  const [browse, setBrowse] = React.useState<BrowseState>({});
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const [nav, setNav] = React.useState<NavState>(() => ({
    stack: initialSlug && initialPath ? [{ slug: initialSlug, ...parseTarget(initialPath) }] : [],
    at: 0,
  }));
  const [page, setPage] = React.useState<PageState | null>(null);
  const [headings, setHeadings] = React.useState<readonly Heading[]>([]);

  const searchRef = React.useRef<HTMLInputElement>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const paneRef = React.useRef<HTMLDivElement>(null);

  const current: Location | null = nav.stack[nav.at] ?? null;
  const deferredQuery = React.useDeferredValue(query);

  /* ------------------------------------------------------------- manifest */

  React.useEffect(() => {
    const controller = new AbortController();
    fetch("/api/docs", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("manifest"))))
      .then((data: DocsetMeta[]) => setDocsets(data))
      .catch(() => {
        if (!controller.signal.aborted) setManifestFailed(true);
      });
    return () => controller.abort();
  }, []);

  const bySlug = React.useMemo(() => {
    const map = new Map<string, DocsetMeta>();
    for (const doc of docsets ?? []) map.set(doc.slug, doc);
    return map;
  }, [docsets]);

  /** Enabled docsets that exist upstream, kept in the user's own order. */
  const activeDocsets = React.useMemo(
    () => enabled.map((slug) => bySlug.get(slug)).filter((d): d is DocsetMeta => !!d),
    [enabled, bySlug]
  );

  /* ----------------------------------------------------------- index loads */

  // In-flight requests are tracked in a ref, not derived from `indexes`, so a
  // finished download can't tear down the fetches still running beside it.
  const requested = React.useRef(new Set<string>());
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchIndex = React.useCallback((doc: DocsetMeta) => {
    if (requested.current.has(doc.slug)) return;
    requested.current.add(doc.slug);
    loadIndex(doc.slug, doc.mtime)
      .then((entries) => {
        if (mounted.current) setIndexes((prev) => ({ ...prev, [doc.slug]: entries }));
      })
      .catch(() => {
        if (!mounted.current) return;
        setFailedSlugs((prev) => (prev.includes(doc.slug) ? prev : [...prev, doc.slug]));
      });
  }, []);

  React.useEffect(() => {
    for (const doc of activeDocsets) fetchIndex(doc);
  }, [activeDocsets, fetchIndex]);

  const retryIndex = (doc: DocsetMeta) => {
    requested.current.delete(doc.slug);
    setFailedSlugs((prev) => prev.filter((s) => s !== doc.slug));
    fetchIndex(doc);
  };

  /** Enabled sets whose index is still on its way. */
  const loadingSlugs = React.useMemo(
    () =>
      activeDocsets
        .filter((doc) => !indexes[doc.slug] && !failedSlugs.includes(doc.slug))
        .map((doc) => doc.slug),
    [activeDocsets, indexes, failedSlugs]
  );

  /* ---------------------------------------------------------------- search */

  const loadedDocsets = React.useMemo<LoadedDocset[]>(
    () =>
      activeDocsets
        .filter((doc) => indexes[doc.slug])
        .map((doc) => ({ slug: doc.slug, entries: indexes[doc.slug] })),
    [activeDocsets, indexes]
  );

  const results = React.useMemo(
    () => searchDocsets(loadedDocsets, deferredQuery),
    [loadedDocsets, deferredQuery]
  );

  // The cursor belongs to the query it was moved in — a new query starts at the
  // top without an effect having to reset it.
  const activeIndex = selection.query === deferredQuery ? selection.index : 0;

  /* ------------------------------------------------------------ navigation */

  const open = React.useCallback((slug: string, target: string) => {
    const { path, hash } = parseTarget(target);
    setNav((prev) => {
      const here = prev.stack[prev.at];
      if (here && here.slug === slug && here.path === path && here.hash === hash) return prev;
      const stack = [...prev.stack.slice(0, prev.at + 1), { slug, path, hash }].slice(-NAV_LIMIT);
      return { stack, at: stack.length - 1 };
    });
  }, []);

  // Only swap the rail when the sections actually differ — re-rendering the
  // same list would restart the scroll-spy on every pass.
  const handleHeadings = React.useCallback((next: Heading[]) => {
    setHeadings((prev) =>
      prev.length === next.length && prev.every((h, i) => h.id === next[i].id) ? prev : next
    );
  }, []);

  /** Links inside a page: `#anchor` stays put, anything else is a new page. */
  const navigateWithin = React.useCallback(
    (target: string) => {
      if (!current) return;
      open(current.slug, target.startsWith("#") ? `${current.path}${target}` : target);
    },
    [current, open]
  );

  const currentMeta = current ? bySlug.get(current.slug) : undefined;
  const pageKey = current ? locationKey(current) : null;

  React.useEffect(() => {
    if (!current || !currentMeta) return;
    const controller = new AbortController();
    const key = locationKey(current);

    loadPage(current.slug, current.path, currentMeta.mtime, controller.signal)
      .then((html) => {
        if (!controller.signal.aborted) setPage({ key, html });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPage({ key, error: error instanceof Error ? error.message : "Couldn't open that page." });
      });

    return () => controller.abort();
  }, [current, currentMeta]);

  // Everything about the pane is derived from which page is showing, so there
  // is never a moment where the header and the body disagree.
  const settled = page && page.key === pageKey ? page : null;
  const html = settled?.html ?? "";
  const pageError = settled?.error ?? null;
  const pageLoading = !!pageKey && !settled;

  // Keep the address bar in step so any page can be copied or bookmarked.
  React.useEffect(() => {
    const url = current
      ? permalink(current.slug, current.hash ? `${current.path}#${current.hash}` : current.path)
      : "/docs";
    window.history.replaceState(null, "", url);
  }, [current]);

  /* -------------------------------------------------------------- keyboard */

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const moveCursor = (delta: number) =>
    setSelection({
      query: deferredQuery,
      index: Math.min(Math.max(activeIndex + delta, 0), results.length - 1),
    });

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setQuery("");
      searchRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveCursor(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveCursor(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = results[activeIndex];
      if (hit) open(hit.slug, hit.path);
    }
  };

  // Keep the highlighted result in view as the arrow keys move it.
  React.useEffect(() => {
    resultsRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  /* ----------------------------------------------------------------- views */

  const browseDocset = browse.slug ? bySlug.get(browse.slug) : undefined;
  const browseEntries = React.useMemo(
    () => (browse.slug ? (indexes[browse.slug] ?? []) : []),
    [browse.slug, indexes]
  );

  const sections = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of browseEntries) {
      const key = entry.type ?? "Other";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [browseEntries]);

  const sectionEntries = React.useMemo(
    () =>
      browse.section
        ? browseEntries.filter((entry) => (entry.type ?? "Other") === browse.section)
        : [],
    [browse.section, browseEntries]
  );

  const searching = deferredQuery.trim().length > 0;
  const currentIsEnabled = !current || enabled.includes(current.slug);

  const setEnabled = (slugs: readonly string[]) => {
    writeEnabled(slugs);
    setBrowse((state) => (state.slug && !slugs.includes(state.slug) ? {} : state));
  };

  return (
    // `minmax(0,1fr)` and `min-w-0` are load-bearing: without them the content
    // column is sized by its widest code block and the header controls spill.
    // The height comes from the page shell, so there's no viewport guesswork.
    <div
      className={cn(
        "border-border/60 bg-card/40 grid min-h-0 overflow-hidden rounded-2xl border lg:grid-cols-[19rem_minmax(0,1fr)]",
        className
      )}
    >
      {/* ------------------------------------------------------------ sidebar */}
      <aside className="border-border/60 flex min-h-0 min-w-0 flex-col border-b lg:border-r lg:border-b-0">
        <div className="border-border/60 flex items-center gap-2 border-b p-3">
          <div className="relative flex-1">
            <SearchIcon
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search the docs…"
              aria-label="Search documentation"
              className="h-9 pr-8 pl-9"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                aria-label="Clear search"
              >
                <XIcon className="size-4" aria-hidden />
              </button>
            ) : (
              <kbd className="border-border bg-muted/60 text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border px-1.5 font-mono text-[10px]">
                /
              </kbd>
            )}
          </div>
          <Button
            variant="outline"
            size="icon-lg"
            onClick={() => setPickerOpen(true)}
            aria-label="Manage documentation sets"
            title="Manage documentation sets"
          >
            <SlidersHorizontalIcon aria-hidden />
          </Button>
        </div>

        <div ref={resultsRef} className="max-h-[50svh] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
          {manifestFailed ? (
            <p className="text-muted-foreground p-4 text-sm leading-relaxed">
              DevDocs isn’t reachable right now.{" "}
              <a
                href="https://devdocs.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
              >
                Open devdocs.io
              </a>{" "}
              instead.
            </p>
          ) : searching ? (
            <SearchResults
              results={results}
              activeIndex={activeIndex}
              bySlug={bySlug}
              loading={loadingSlugs.length > 0}
              onHover={(index) => setSelection({ query: deferredQuery, index })}
              onOpen={open}
            />
          ) : browse.section && browseDocset ? (
            <>
              <Crumb
                onBack={() => setBrowse({ slug: browse.slug })}
                label={browse.section}
                sub={browseDocset.name}
                doc={browseDocset}
              />
              <ul className="p-1.5">
                {sectionEntries.map((entry) => {
                  // Compare the anchor too — a page like `library/functions`
                  // backs hundreds of entries, and matching on the path alone
                  // would light up every one of them at once.
                  const target = parseTarget(entry.path);
                  return (
                    <li key={`${entry.path}-${entry.name}`}>
                      <EntryRow
                        name={entry.name}
                        href={permalink(browseDocset.slug, entry.path)}
                        showing={
                          current?.slug === browseDocset.slug &&
                          current.path === target.path &&
                          current.hash === target.hash
                        }
                        onOpen={() => open(browseDocset.slug, entry.path)}
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          ) : browse.slug && browseDocset ? (
            <>
              <Crumb
                onBack={() => setBrowse({})}
                label={browseDocset.name}
                sub={
                  browseEntries.length
                    ? `${browseEntries.length.toLocaleString()} entries`
                    : browseDocset.release || browseDocset.version || "latest"
                }
                doc={browseDocset}
              />
              {failedSlugs.includes(browseDocset.slug) ? (
                <Failed doc={browseDocset} onRetry={() => retryIndex(browseDocset)} />
              ) : loadingSlugs.includes(browseDocset.slug) ? (
                <Pending label={`Loading ${browseDocset.name}…`} />
              ) : (
                <ul className="p-1.5">
                  {sections.map(([section, count]) => (
                    <li key={section}>
                      <button
                        type="button"
                        onClick={() => setBrowse({ slug: browse.slug, section })}
                        className="hover:bg-muted/70 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors"
                      >
                        <span className="min-w-0 flex-1 truncate">{section}</span>
                        <span className="text-muted-foreground font-mono text-[11px]">{count}</span>
                        <ChevronRightIcon
                          className="text-muted-foreground size-3.5 shrink-0"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <DocsetList
              docsets={activeDocsets}
              loading={loadingSlugs}
              failed={failedSlugs}
              indexes={indexes}
              pending={!docsets}
              onPick={(slug) => setBrowse({ slug })}
              onManage={() => setPickerOpen(true)}
            />
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------ content */}
      <section className="flex min-h-0 min-w-0 flex-col">
        {current && currentMeta && (
          <header className="border-border/60 flex min-w-0 items-center gap-1.5 border-b px-2 py-2 sm:gap-2 sm:px-4 sm:py-2.5">
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={nav.at <= 0}
                onClick={() => setNav((prev) => ({ ...prev, at: Math.max(0, prev.at - 1) }))}
                aria-label="Back"
              >
                <ArrowLeftIcon aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={nav.at >= nav.stack.length - 1}
                onClick={() =>
                  setNav((prev) => ({ ...prev, at: Math.min(prev.stack.length - 1, prev.at + 1) }))
                }
                aria-label="Forward"
              >
                <ArrowRightIcon aria-hidden />
              </Button>
            </div>

            <DocsetIcon slug={currentMeta.slug} name={currentMeta.name} className="size-4" />

            {/* The path is the only part allowed to give up space. */}
            <p className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">
              <span className="text-foreground font-medium">{currentMeta.name}</span>
              {currentMeta.version && <span className="ml-1.5">{currentMeta.version}</span>}
              <span className="mx-1.5 opacity-40">/</span>
              {current.path}
            </p>

            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              {!currentIsEnabled && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEnabled([current.slug, ...enabled])}
                  title={`Add ${currentMeta.name} to your sets`}
                >
                  <PlusIcon aria-hidden />
                  <span className="hidden max-w-28 truncate lg:inline">
                    Add {currentMeta.name}
                  </span>
                  <span className="lg:hidden">Add</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy link to this page"
                title="Copy link to this page"
                onClick={() => {
                  const target = current.hash ? `${current.path}#${current.hash}` : current.path;
                  void navigator.clipboard
                    .writeText(`${window.location.origin}${permalink(current.slug, target)}`)
                    .then(() => toast.success("Link copied."))
                    .catch(() => toast.error("Couldn't copy."));
                }}
              >
                <LinkIcon aria-hidden />
              </Button>

              <Button variant="outline" size="sm" asChild>
                <a
                  href={devdocsUrl(current.slug, current.path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open the original page on devdocs.io"
                >
                  <ExternalLinkIcon aria-hidden />
                  <span className="hidden md:inline">Original</span>
                </a>
              </Button>
            </div>
          </header>
        )}

        <div ref={paneRef} className="min-h-[60svh] flex-1 overflow-y-auto lg:min-h-0">
          {pageError ? (
            <div className="p-8">
              <p className="text-sm font-medium">{pageError}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                The set may have been re-scraped since this link was made.
              </p>
            </div>
          ) : pageLoading ? (
            <PageSkeleton />
          ) : html ? (
            // Two columns once there's room for a rail; one below that. The
            // `minmax(0,1fr)` keeps wide code blocks from stretching the grid.
            // `auto` rather than a fixed track, so the column collapses on
            // pages with too few headings to justify a rail.
            <div className="grid grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_auto]">
              {/* Capped for a comfortable measure; code and tables scroll inside. */}
              <div className="mx-auto w-full max-w-3xl px-5 py-7 sm:px-8 xl:mx-0">
                <DocPane
                  html={html}
                  hash={current?.hash ?? ""}
                  onNavigate={navigateWithin}
                  onHeadings={handleHeadings}
                  scrollRef={paneRef}
                />
              </div>
              <DocToc
                headings={headings}
                scrollRef={paneRef}
                onJump={(id) => navigateWithin(`#${id}`)}
              />
            </div>
          ) : (
            <Welcome
              docsets={docsets}
              onOpenFamily={(slug) => {
                if (!enabled.includes(slug)) writeEnabled([slug, ...enabled]);
                setBrowse({ slug });
              }}
              onManage={() => setPickerOpen(true)}
            />
          )}
        </div>
      </section>

      {docsets && (
        <DocsetPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          docsets={docsets}
          enabled={enabled}
          onChange={setEnabled}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function Crumb({
  onBack,
  label,
  sub,
  doc,
}: {
  onBack: () => void;
  label: string;
  sub: string;
  /** Shown as a logo beside the crumb when the level belongs to one set. */
  doc?: DocsetMeta;
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="border-border/60 hover:bg-muted/50 bg-card/70 sticky top-0 z-10 flex w-full items-center gap-2 border-b px-3 py-2 text-left backdrop-blur transition-colors"
    >
      <ArrowLeftIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      {doc && <DocsetIcon slug={doc.slug} name={doc.name} className="size-4" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="text-muted-foreground block truncate font-mono text-[11px]">{sub}</span>
      </span>
    </button>
  );
}

function Pending({ label }: { label: string }) {
  return (
    <p className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      {label}
    </p>
  );
}

function Failed({ doc, onRetry }: { doc: DocsetMeta; onRetry: () => void }) {
  return (
    <div className="p-4">
      <p className="text-muted-foreground text-sm leading-relaxed">
        The {doc.name} index didn’t download.
      </p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        <RotateCcwIcon aria-hidden />
        Try again
      </Button>
    </div>
  );
}

function EntryRow({
  name,
  href,
  source,
  showing,
  selected,
  onOpen,
  onHover,
}: {
  name: string;
  href: string;
  /** The docset a search hit came from, shown as a logo plus label. */
  source?: DocsetMeta;
  /** This entry is the page currently on screen. */
  showing?: boolean;
  /** This entry is under the keyboard cursor. */
  selected?: boolean;
  onOpen: () => void;
  onHover?: () => void;
}) {
  return (
    <a
      href={href}
      data-active={selected ? "true" : undefined}
      onMouseEnter={onHover}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        onOpen();
      }}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        selected || showing
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "hover:bg-muted/70"
      )}
    >
      {source && <DocsetIcon slug={source.slug} name={source.name} className="size-3.5" />}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {source && (
        <span className="text-muted-foreground shrink-0 font-mono text-[10px] tracking-tight">
          {source.name}
        </span>
      )}
    </a>
  );
}

function SearchResults({
  results,
  activeIndex,
  bySlug,
  loading,
  onHover,
  onOpen,
}: {
  results: readonly DocHit[];
  activeIndex: number;
  bySlug: Map<string, DocsetMeta>;
  loading: boolean;
  onHover: (index: number) => void;
  onOpen: (slug: string, path: string) => void;
}) {
  if (!results.length) {
    return loading ? (
      <Pending label="Loading indexes…" />
    ) : (
      <p className="text-muted-foreground p-4 text-sm leading-relaxed">
        No matches. Try a different spelling, or enable more sets.
      </p>
    );
  }
  return (
    <ul className="p-1.5">
      {results.map((hit, index) => (
        <li key={`${hit.slug}-${hit.path}-${hit.name}`}>
          <EntryRow
            name={hit.name}
            source={bySlug.get(hit.slug)}
            href={permalink(hit.slug, hit.path)}
            selected={index === activeIndex}
            onHover={() => onHover(index)}
            onOpen={() => onOpen(hit.slug, hit.path)}
          />
        </li>
      ))}
    </ul>
  );
}

function DocsetList({
  docsets,
  loading,
  failed,
  indexes,
  pending,
  onPick,
  onManage,
}: {
  docsets: readonly DocsetMeta[];
  loading: readonly string[];
  failed: readonly string[];
  indexes: Record<string, DocEntry[]>;
  pending: boolean;
  onPick: (slug: string) => void;
  onManage: () => void;
}) {
  if (pending) return <Pending label="Loading documentation sets…" />;

  if (!docsets.length) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground text-sm">Nothing enabled yet.</p>
        <Button size="sm" className="mt-3" onClick={onManage}>
          <LayersIcon aria-hidden />
          Choose documentation
        </Button>
      </div>
    );
  }

  return (
    <ul className="p-1.5">
      {docsets.map((doc) => {
        const count = indexes[doc.slug]?.length;
        return (
          <li key={doc.slug}>
            <button
              type="button"
              onClick={() => onPick(doc.slug)}
              className="hover:bg-muted/70 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors"
            >
              <DocsetIcon slug={doc.slug} name={doc.name} className="size-5" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{doc.name}</span>
                <span className="text-muted-foreground block truncate font-mono text-[11px]">
                  {doc.version || doc.release || "latest"}
                  {count !== undefined && ` · ${count.toLocaleString()} entries`}
                  {failed.includes(doc.slug) && " · unavailable"}
                </span>
              </span>
              {loading.includes(doc.slug) ? (
                <Loader2Icon className="text-muted-foreground size-3.5 shrink-0 animate-spin" />
              ) : (
                <ChevronRightIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4 px-5 py-8 sm:px-8">
      <div className="bg-muted h-7 w-2/5 rounded-lg" />
      <div className="bg-muted h-3.5 w-full rounded" />
      <div className="bg-muted h-3.5 w-11/12 rounded" />
      <div className="bg-muted h-3.5 w-3/4 rounded" />
      <div className="bg-muted mt-8 h-28 w-full rounded-xl" />
      <div className="bg-muted h-3.5 w-5/6 rounded" />
      <div className="bg-muted h-3.5 w-2/3 rounded" />
    </div>
  );
}

function Welcome({
  docsets,
  onOpenFamily,
  onManage,
}: {
  docsets: readonly DocsetMeta[] | null;
  onOpenFamily: (slug: string) => void;
  onManage: () => void;
}) {
  // The manifest lists newest first, so the first hit in a family is current.
  const shortcuts = React.useMemo(() => {
    if (!docsets) return [];
    const wanted = new Set<string>(POPULAR_FAMILIES);
    const picked = new Map<string, DocsetMeta>();
    for (const doc of docsets) {
      const family = familyOf(doc.slug);
      if (wanted.has(family) && !picked.has(family)) picked.set(family, doc);
    }
    return POPULAR_FAMILIES.map((family) => picked.get(family)).filter(
      (doc): doc is DocsetMeta => !!doc
    );
  }, [docsets]);

  return (
    <div className="mx-auto max-w-xl px-6 py-14 text-center">
      <span className="border-border/60 bg-muted/40 mb-5 inline-flex size-11 items-center justify-center rounded-xl border">
        <BookOpenIcon className="text-primary size-5" aria-hidden />
      </span>
      <h2 className="font-heading text-xl font-semibold tracking-tight">
        Every reference, one search box
      </h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed">
        Press <Kbd>/</Kbd> to search, <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move and <Kbd>↵</Kbd> to open.
        Jump into a set below, or add your own.
      </p>

      {shortcuts.length > 0 && (
        <div className="mt-7 flex flex-wrap justify-center gap-1.5">
          {shortcuts.map((doc) => (
            <button
              key={doc.slug}
              type="button"
              onClick={() => onOpenFamily(doc.slug)}
              className="border-border/60 bg-card hover:border-primary/40 hover:text-primary inline-flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-2 text-xs font-medium transition-colors"
            >
              <DocsetIcon slug={doc.slug} name={doc.name} className="size-3.5" />
              {doc.name}
            </button>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" className="mt-7" onClick={onManage}>
        <LayersIcon aria-hidden />
        Browse all sets
      </Button>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border-border bg-muted/60 text-foreground mx-0.5 rounded border px-1.5 py-0.5 font-mono text-[10px]">
      {children}
    </kbd>
  );
}
