"use client";

import * as React from "react";
import { BookOpenIcon, DownloadIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BookCard } from "@/components/books/book-card";
import {
  curatedToBook,
  dedupeBooks,
  formatBytes,
  searchCurated,
  SOURCE_CREDITS,
  type Book,
  type BookDetail,
  type BookSource,
  type CuratedCatalog,
} from "@/lib/books";
import { cn } from "@/lib/utils";

type SourceFilter = "all" | BookSource;

const SOURCE_FILTERS: { value: SourceFilter; label: string; hint: string }[] = [
  { value: "all", label: "Everything", hint: "All three catalogues" },
  { value: "curated", label: "Curated", hint: "free-programming-books" },
  { value: "archive", label: "Archive", hint: "Internet Archive scans" },
  { value: "openlibrary", label: "Open Library", hint: "Public-access records" },
];

/** How many curated hits to reveal per scroll, and how many remote rows per page. */
const CURATED_PAGE = 36;
const REMOTE_ROWS = 24;
/** Ceiling on curated matches held in memory for one query. */
const CURATED_LIMIT = 600;

interface SearchResponse {
  books: Book[];
  totals: { archive: number; openlibrary: number };
  hasMore: boolean;
}

export function BooksBrowser({
  initialQuery = "",
  initialTopic = "",
}: {
  initialQuery?: string;
  initialTopic?: string;
}) {
  const [rawQuery, setRawQuery] = React.useState(initialQuery);
  const [query, setQuery] = React.useState(initialQuery);
  const [topic, setTopic] = React.useState(initialTopic);
  const [source, setSource] = React.useState<SourceFilter>("all");
  const [pdfOnly, setPdfOnly] = React.useState(false);
  const [lang, setLang] = React.useState("en");

  const [catalog, setCatalog] = React.useState<CuratedCatalog | null>(null);
  const [catalogFailed, setCatalogFailed] = React.useState(false);

  const [remote, setRemote] = React.useState<Book[]>([]);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [remoteHasMore, setRemoteHasMore] = React.useState(false);
  const [totals, setTotals] = React.useState({ archive: 0, openlibrary: 0 });
  const [page, setPage] = React.useState(1);
  const [visible, setVisible] = React.useState(CURATED_PAGE);

  const [selected, setSelected] = React.useState<Book | null>(null);
  const [detail, setDetail] = React.useState<BookDetail | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  /* ------------------------------------------------------------------ inputs */

  // "/" focuses the search box, matching the icons and docs browsers.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery.trim()), 280);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  // Mirror the search into the address bar so a result set can be linked to.
  // `replaceState` rather than the router: no history spam, no RSC round trip —
  // the server only ever reads these on first load.
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (topic) params.set("topic", topic);
    const search = params.toString();
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  }, [query, topic]);

  /* ----------------------------------------------------------------- catalog */

  React.useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/books/catalog?lang=${encodeURIComponent(lang)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        setCatalog((await res.json()) as CuratedCatalog);
        setCatalogFailed(false);
      } catch {
        if (!controller.signal.aborted) setCatalogFailed(true);
      }
    })();
    return () => controller.abort();
  }, [lang]);

  const curatedBooks = React.useMemo(
    () => (catalog ? catalog.books.map((entry, i) => curatedToBook(entry, catalog.lang, i)) : []),
    [catalog]
  );

  /* ------------------------------------------------------------------ remote */

  // A topic chip searches the remote catalogues for that topic; free text wins.
  const effectiveQuery = query || topic;
  const requestKey = `${source}|${lang}|${effectiveQuery}`;
  const [activeKey, setActiveKey] = React.useState(requestKey);

  // Reset paging during render rather than in an effect, so the fetch below
  // never fires once for the stale page and again for page 1.
  if (requestKey !== activeKey) {
    setActiveKey(requestKey);
    setPage(1);
    setVisible(CURATED_PAGE);
    setRemote([]);
    setRemoteHasMore(false);
  }

  React.useEffect(() => {
    const controller = new AbortController();

    (async () => {
      if (source === "curated") {
        setRemoteLoading(false);
        return;
      }
      setRemoteLoading(true);

      const params = new URLSearchParams({
        q: effectiveQuery,
        page: String(page),
        rows: String(REMOTE_ROWS),
        sources: source === "all" ? "archive,openlibrary" : source,
      });

      try {
        const res = await fetch(`/api/books?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as SearchResponse;
        setRemote((prev) => (page === 1 ? data.books : dedupeBooks([...prev, ...data.books])));
        setRemoteHasMore(data.hasMore);
        setTotals(data.totals);
        setRemoteLoading(false);
      } catch {
        if (!controller.signal.aborted) {
          setRemoteLoading(false);
          setRemoteHasMore(false);
        }
      }
    })();

    return () => controller.abort();
  }, [effectiveQuery, source, page]);

  /* ----------------------------------------------------------------- results */

  const curatedResults = React.useMemo(() => {
    if (source !== "all" && source !== "curated") return [];

    let list = curatedBooks;
    if (topic) {
      list = list.filter((book) => book.topic === topic || book.topic.startsWith(`${topic} / `));
    }
    if (query) list = searchCurated(list, query, CURATED_LIMIT);
    if (pdfOnly) list = list.filter((book) => book.formats.includes("pdf"));
    return list;
  }, [curatedBooks, topic, query, pdfOnly, source]);

  const remoteResults = React.useMemo(() => {
    if (source === "curated") return [];
    return source === "all" ? remote : remote.filter((book) => book.source === source);
  }, [remote, source]);

  const shownCurated = curatedResults.slice(0, visible);
  const moreCurated = visible < curatedResults.length;
  const archiveTotal = source === "curated" || source === "openlibrary" ? 0 : totals.archive;
  const libraryRows = remoteResults.length;

  // Searching puts the curated hits first — they're ranked, and the remote
  // catalogues only sort by download count. With nothing typed there is no
  // ranking to respect, so the scanned books lead instead: they have real
  // covers, where an alphabetical run of curated links opens on ".NET Book Zero".
  const ordered = React.useMemo(
    () => (query || topic ? [...shownCurated, ...remoteResults] : [...remoteResults, ...shownCurated]),
    [query, topic, shownCurated, remoteResults]
  );

  // One sentinel drives both lists: reveal the rest of the curated matches
  // first, then start pulling further pages from the remote catalogues.
  React.useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (moreCurated) setVisible((count) => count + CURATED_PAGE);
        else if (remoteHasMore && !remoteLoading) setPage((current) => current + 1);
      },
      { rootMargin: "600px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [moreCurated, remoteHasMore, remoteLoading]);

  /* ------------------------------------------------------------------ detail */

  React.useEffect(() => {
    const id = selected?.archiveId;
    if (!id) return;
    const controller = new AbortController();

    (async () => {
      setDetail(null);
      try {
        const res = await fetch(`/api/books/detail?id=${encodeURIComponent(id)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        setDetail((await res.json()) as BookDetail);
      } catch {
        /* the sheet keeps showing its loading line */
      }
    })();

    return () => controller.abort();
  }, [selected]);

  /* --------------------------------------------------------------------- ui */

  const topics = React.useMemo(() => {
    if (!catalog) return [];
    return catalog.sections
      .filter((section) => !section.name.includes(" / ") && !/^\d+\s*-/.test(section.name))
      .slice(0, 22);
  }, [catalog]);

  const hasResults = shownCurated.length + remoteResults.length > 0;
  const busy = remoteLoading || (!catalog && !catalogFailed);

  function reset() {
    setRawQuery("");
    setQuery("");
    setTopic("");
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4 max-w-xl">
        <SearchIcon
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          ref={inputRef}
          value={rawQuery}
          onChange={(event) => setRawQuery(event.target.value)}
          placeholder="Search free programming books…  ( press / )"
          aria-label="Search programming books"
          className="rounded-full pr-9 pl-10"
        />
        {rawQuery && (
          <button
            type="button"
            onClick={reset}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
          >
            <XIcon className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Source, format and language filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {SOURCE_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setSource(filter.value)}
            title={filter.hint}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              source === filter.value
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-border/60 bg-card text-muted-foreground hover:border-emerald-500/40 hover:text-foreground"
            )}
          >
            {filter.label}
          </button>
        ))}

        <span className="bg-border/60 mx-1 hidden h-5 w-px sm:block" aria-hidden />

        <button
          type="button"
          onClick={() => setPdfOnly((on) => !on)}
          aria-pressed={pdfOnly}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            pdfOnly
              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-border/60 bg-card text-muted-foreground hover:border-emerald-500/40 hover:text-foreground"
          )}
        >
          PDF only
        </button>

        {catalog && catalog.languages.length > 1 && (
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger size="sm" className="h-8 w-[9.5rem] rounded-full text-xs">
              <SelectValue aria-label={lang} />
            </SelectTrigger>
            <SelectContent>
              {catalog.languages.map((entry) => (
                <SelectItem key={entry.code} value={entry.code} className="text-xs">
                  {entry.name} ({entry.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Topic rail */}
      {topics.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {topic && (
            <button
              type="button"
              onClick={() => setTopic("")}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-[11px]"
            >
              <XIcon className="size-3" aria-hidden />
              Clear topic
            </button>
          )}
          {topics.map((section) => (
            <button
              key={section.name}
              type="button"
              onClick={() => setTopic(topic === section.name ? "" : section.name)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] transition-colors",
                topic === section.name
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {section.name}
              <span className="ml-1 opacity-50">{section.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Result summary */}
      <div className="text-muted-foreground mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
        {curatedResults.length > 0 && <span>{curatedResults.length.toLocaleString()} curated</span>}
        {/* Only Archive's total survives its filters intact; Open Library's is
            counted before the subject check, so its loaded rows are shown instead. */}
        {archiveTotal > 0 && <span>{archiveTotal.toLocaleString()} on Archive</span>}
        {libraryRows > 0 && <span>{libraryRows.toLocaleString()} loaded from libraries</span>}
        {busy && <Loader2Icon className="size-3 animate-spin" aria-label="Loading" />}
      </div>

      {catalogFailed && source !== "archive" && source !== "openlibrary" && (
        <p className="border-border/60 text-muted-foreground mb-4 rounded-lg border border-dashed p-3 text-xs">
          The curated list is unavailable right now — Archive and Open Library results still work.
        </p>
      )}

      {/* Grid */}
      {hasResults ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {ordered.map((book) => (
            <BookCard key={book.id} book={book} onDetails={setSelected} />
          ))}
        </div>
      ) : (
        !busy && (
          <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
            <BookOpenIcon className="mx-auto mb-3 size-6 opacity-40" aria-hidden />
            No books matched{" "}
            {effectiveQuery ? <span className="text-foreground">“{effectiveQuery}”</span> : "that"}.
            <br />
            Try a language, a framework, or an author.
          </div>
        )
      )}

      <div ref={sentinelRef} className="h-10" aria-hidden />

      {(moreCurated || remoteHasMore) && (
        <p className="text-muted-foreground py-4 text-center text-xs">
          {remoteLoading ? "Loading more…" : "Scroll for more"}
        </p>
      )}

      {/* Credits — every source here asks to be named. */}
      <p className="text-muted-foreground/70 border-border/60 mt-8 border-t pt-5 text-xs leading-relaxed">
        Books come from{" "}
        {Object.values(SOURCE_CREDITS).map((credit, index) => (
          <React.Fragment key={credit.href}>
            {index > 0 && (index === 2 ? " and " : ", ")}
            <a
              href={credit.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline decoration-dotted underline-offset-4"
            >
              {credit.label}
            </a>
          </React.Fragment>
        ))}
        . Everything listed is free to read where it is hosted — nothing is mirrored here.
      </p>

      {/* Details */}
      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="pr-6 text-base leading-snug">{selected?.title}</SheetTitle>
            <SheetDescription>
              {[selected?.author, selected?.year].filter(Boolean).join(" · ") ||
                "Internet Archive item"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 px-4 pb-8">
            {detail === null ? (
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                Loading item details…
              </p>
            ) : (
              <>
                {detail.description && (
                  <p className="text-muted-foreground max-h-64 overflow-y-auto text-xs leading-relaxed whitespace-pre-line">
                    {detail.description}
                  </p>
                )}

                {detail.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.subjects.map((subject) => (
                      <span
                        key={subject}
                        className="bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5 text-[10px]"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                )}

                <div>
                  <h4 className="mb-2 font-mono text-[10px] tracking-[0.2em] uppercase">
                    Downloads
                  </h4>
                  {detail.files.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      No downloadable files on this item.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {detail.files.map((file) => (
                        <li key={file.name}>
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border-border/60 hover:border-primary/50 hover:bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors"
                          >
                            <DownloadIcon className="text-primary size-3.5 shrink-0" aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{file.name}</span>
                            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                              {formatBytes(file.bytes)}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <a
                  href={`https://archive.org/details/${detail.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground text-xs underline decoration-dotted underline-offset-4"
                >
                  View this item on archive.org
                </a>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
