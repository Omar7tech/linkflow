/**
 * Client for the public DevDocs JSON API (https://devdocs.io) — the same data
 * that powers devdocs.io itself, covering 800+ documentation sets.
 *
 *   GET https://devdocs.io/docs/docs.json          → the manifest of every docset
 *   GET https://documents.devdocs.io/<slug>/index.json → every entry in a docset
 *   GET https://documents.devdocs.io/<slug>/<path>.html → one normalised page
 *
 * The content host sends `access-control-allow-origin: *`, so indexes and pages
 * are fetched straight from the browser and cached in IndexedDB — our server
 * only proxies the manifest (to trim it down and cache it at the edge).
 *
 * Everything in this module is browser-safe; the manifest fetch is the only
 * part that runs on the server, and it uses plain `fetch`.
 */

export interface DocsetMeta {
  /** Unique id, e.g. `python~3.12`. Also the content-host path segment. */
  readonly slug: string;
  readonly name: string;
  /** Version label shown next to the name, e.g. `3.12`. Empty for unversioned. */
  readonly version: string;
  /** Precise upstream release, e.g. `3.12.7`. */
  readonly release: string;
  /** Last scrape, unix seconds — doubles as the cache key for the index. */
  readonly mtime: number;
  /** Uncompressed size of the full docset in bytes. */
  readonly size: number;
  /** Upstream project homepage. */
  readonly home: string;
  /** Licence / credit line (HTML). Required by DevDocs — always render it. */
  readonly attribution: string;
  /** Short alias, e.g. `ng` for Angular. */
  readonly alias?: string;
}

export interface DocEntry {
  /** Display name, e.g. `Array.prototype.map()`. */
  readonly name: string;
  /** Page path within the docset, e.g. `library/functions#print`. */
  readonly path: string;
  /** Section this entry belongs to, e.g. `Standard Library`. */
  readonly type: string | null;
}

/** A search hit, carrying its docset so results can mix sources. */
export interface DocHit extends DocEntry {
  readonly slug: string;
  readonly score: number;
}

export const MANIFEST_URL = "https://devdocs.io/docs/docs.json";
export const CONTENT_BASE = "https://documents.devdocs.io";

/** Mirrors the default set devdocs.io ships with, plus Git. */
export const DEFAULT_SLUGS = ["javascript", "css", "html", "dom", "http", "git"] as const;

/** Families surfaced before the manifest loads, so the shell is never empty. */
export const POPULAR_FAMILIES = [
  "javascript",
  "typescript",
  "python",
  "react",
  "node",
  "css",
  "html",
  "dom",
  "go",
  "rust",
  "git",
  "tailwindcss",
  "vue",
  "postgresql",
  "php",
  "bash",
] as const;

/**
 * The family a docset belongs to — `python~3.12` and `python~3.11` are both
 * `python`. Not the same as the manifest's `type` field, which is the *scraper*
 * used (every MDN docset shares `type: "mdn"`), so it can't group by product.
 */
export function familyOf(slug: string): string {
  return slug.split("~")[0];
}

export function indexUrl(slug: string): string {
  return `${CONTENT_BASE}/${encodeURIComponent(slug)}/index.json`;
}

export function pageUrl(slug: string, path: string): string {
  const clean = path.split("#")[0];
  return `${CONTENT_BASE}/${encodeURIComponent(slug)}/${clean}.html`;
}

/** The equivalent page on devdocs.io, for "open the original". */
export function devdocsUrl(slug: string, path?: string): string {
  return `https://devdocs.io/${slug}${path ? `/${path}` : ""}`;
}

/** Our own deep link to a page — keeps middle-click and "open in new tab" working. */
export function permalink(slug: string, path: string): string {
  return `/docs?doc=${encodeURIComponent(slug)}&path=${encodeURIComponent(path)}`;
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/* ------------------------------------------------------------------ manifest */

/** Raw manifest entry, before we trim it. */
interface RawDocset {
  slug?: string;
  name?: string;
  version?: string;
  release?: string;
  mtime?: number;
  db_size?: number;
  links?: { home?: string };
  attribution?: string;
  alias?: string;
}

/** Guards for the server-side manifest fetch: bounded wait, bounded payload. */
const MANIFEST_TIMEOUT_MS = 10_000;
const MANIFEST_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Fetch and trim the docset manifest. Runs on the server so the 360 KB upstream
 * payload is cached at the edge and reaches the browser roughly a third the size.
 */
export async function fetchManifest(): Promise<DocsetMeta[]> {
  const res = await fetch(MANIFEST_URL, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(MANIFEST_TIMEOUT_MS),
    next: { revalidate: 60 * 60 * 12 },
  });
  if (!res.ok) throw new Error(`DevDocs manifest returned ${res.status}`);

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MANIFEST_MAX_BYTES) throw new Error("DevDocs manifest too large");

  const raw = (await res.json()) as RawDocset[];
  if (!Array.isArray(raw)) throw new Error("DevDocs manifest malformed");

  return raw
    .filter((d): d is RawDocset & { slug: string } => typeof d.slug === "string" && !!d.slug)
    .map((d) => ({
      slug: d.slug,
      name: d.name ?? d.slug,
      version: d.version ?? "",
      release: d.release ?? "",
      mtime: d.mtime ?? 0,
      size: d.db_size ?? 0,
      home: d.links?.home ?? "",
      attribution: d.attribution ?? "",
      ...(d.alias ? { alias: d.alias } : {}),
    }));
}

/**
 * Group docsets into families, newest version first. The manifest already lists
 * versions newest-first within a family, so original order is preserved.
 */
export function groupFamilies(docsets: readonly DocsetMeta[]): Map<string, DocsetMeta[]> {
  const families = new Map<string, DocsetMeta[]>();
  for (const doc of docsets) {
    const key = familyOf(doc.slug);
    const bucket = families.get(key);
    if (bucket) bucket.push(doc);
    else families.set(key, [doc]);
  }
  return families;
}

/* -------------------------------------------------------------------- search */

/** Characters that start a new "word" inside an entry name. */
const BOUNDARY = /[^a-z0-9]/;

/** The part after the last separator — `map` in `Array.prototype.map()`. */
function tailOf(name: string): string {
  const cut = Math.max(name.lastIndexOf("."), name.lastIndexOf("#"), name.lastIndexOf("::"));
  return cut === -1 ? name : name.slice(cut + 1);
}

/**
 * Rank one entry name against a lower-cased query. Returns -1 for no match.
 *
 * Ordering mirrors what DevDocs does and what feels right when typing: an exact
 * hit on the member name beats a prefix, which beats a match at a word
 * boundary, which beats a match buried mid-token. Shorter names win ties, so
 * `map` outranks `Array.prototype.flatMap()` when you type "map".
 */
export function scoreName(name: string, query: string): number {
  const lower = name.toLowerCase();
  const at = lower.indexOf(query);
  if (at === -1) return -1;

  const tail = tailOf(lower);
  const penalty = Math.min(lower.length, 120) * 0.6;

  if (lower === query) return 1000 - penalty;
  if (tail === query || tail.replace(/\(\)$/, "") === query) return 940 - penalty;
  if (tail.startsWith(query)) return 860 - penalty;
  if (at === 0) return 800 - penalty;
  if (BOUNDARY.test(lower[at - 1])) return 650 - penalty;
  return 450 - penalty;
}

/** Loose subsequence match — every query character in order, gaps allowed. */
function subsequenceScore(name: string, query: string): number {
  const lower = name.toLowerCase();
  let cursor = 0;
  let gaps = 0;
  for (const char of query) {
    const found = lower.indexOf(char, cursor);
    if (found === -1) return -1;
    if (cursor > 0) gaps += found - cursor;
    cursor = found + 1;
  }
  return 240 - Math.min(gaps, 120) - Math.min(lower.length, 100) * 0.4;
}

/** Entries plus the docset they came from, ready to search. */
export interface LoadedDocset {
  readonly slug: string;
  readonly entries: readonly DocEntry[];
}

export const MAX_RESULTS = 60;

/**
 * Search across every loaded docset. Substring matching runs first; the fuzzy
 * pass only kicks in when that turns up too little, which keeps typing fast
 * even with a couple of hundred thousand entries loaded.
 */
export function searchDocsets(
  loaded: readonly LoadedDocset[],
  rawQuery: string,
  limit = MAX_RESULTS
): DocHit[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const hits: DocHit[] = [];
  // Earlier docsets are the ones the user enabled first — nudge them up.
  for (let i = 0; i < loaded.length; i++) {
    const bonus = Math.max(0, 12 - i);
    const { slug, entries } = loaded[i];
    for (const entry of entries) {
      const score = scoreName(entry.name, query);
      if (score >= 0) hits.push({ ...entry, slug, score: score + bonus });
    }
  }

  if (hits.length < 20 && query.length >= 3) {
    const seen = new Set(hits.map((h) => `${h.slug}/${h.path}`));
    for (let i = 0; i < loaded.length; i++) {
      const { slug, entries } = loaded[i];
      for (const entry of entries) {
        const key = `${slug}/${entry.path}`;
        if (seen.has(key)) continue;
        const score = subsequenceScore(entry.name, query);
        if (score >= 0) hits.push({ ...entry, slug, score });
      }
    }
  }

  hits.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  return hits.slice(0, limit);
}

/* ---------------------------------------------------------------- sanitising */

/** Dropped outright — DevDocs pages never need these, and they carry risk. */
const STRIP_TAGS = "script,style,iframe,object,embed,link,meta,base,form,input,noscript,template";

/**
 * Resolve a link found inside a page against the page's own path.
 * `stdtypes#str` on `library/functions` → `library/stdtypes`, hash `str`.
 */
function resolveRelative(currentPath: string, href: string): { path: string; hash: string } | null {
  const dir = currentPath.includes("/")
    ? currentPath.slice(0, currentPath.lastIndexOf("/") + 1)
    : "";
  try {
    const url = new URL(href, `https://docset.invalid/${dir}`);
    if (url.origin !== "https://docset.invalid") return null;
    const path = url.pathname.replace(/^\/+/, "").replace(/\.html$/, "");
    if (!path) return null;
    return { path, hash: url.hash.slice(1) };
  } catch {
    return null;
  }
}

/**
 * Turn a raw DevDocs partial into HTML that is safe to inject and navigable
 * inside our own shell.
 *
 * Scripts, embeds and event handlers are removed; in-docset links are rewritten
 * to our `/docs` permalink and tagged with `data-doc-path` so the browser
 * component can intercept them; everything pointing off-site opens in a new tab.
 */
export function sanitizePage(rawHtml: string, slug: string, path: string): string {
  const parsed = new DOMParser().parseFromString(rawHtml, "text/html");
  const body = parsed.body;

  body.querySelectorAll(STRIP_TAGS).forEach((node) => node.remove());

  // Upstream pages embed web components (`<mdn-survey>`, `<interactive-example>`)
  // whose scripts we deliberately don't load, so they'd render as dead space.
  for (const el of Array.from(body.querySelectorAll("*"))) {
    if (el.tagName.includes("-")) el.remove();
  }

  for (const el of body.querySelectorAll<HTMLElement>("*")) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc" || name === "formaction") {
        el.removeAttribute(attr.name);
      }
    }
  }

  for (const anchor of body.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href") ?? "";

    if (/^\s*javascript:/i.test(href)) {
      anchor.removeAttribute("href");
      continue;
    }
    if (href.startsWith("#")) {
      anchor.setAttribute("data-doc-hash", href.slice(1));
      continue;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
      anchor.setAttribute("data-doc-external", "");
      continue;
    }

    const resolved = resolveRelative(path, href);
    if (!resolved) {
      anchor.removeAttribute("href");
      continue;
    }
    const full = resolved.hash ? `${resolved.path}#${resolved.hash}` : resolved.path;
    anchor.setAttribute("href", permalink(slug, full));
    anchor.setAttribute("data-doc-path", full);
  }

  // Relative images live alongside the page on the content host.
  for (const img of body.querySelectorAll("img[src]")) {
    const src = img.getAttribute("src") ?? "";
    if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:image/")) continue;
    if (src.startsWith("data:")) {
      img.removeAttribute("src");
      continue;
    }
    const resolved = resolveRelative(path, src);
    img.setAttribute("src", resolved ? `${CONTENT_BASE}/${slug}/${resolved.path}` : "");
    img.setAttribute("loading", "lazy");
  }

  return body.innerHTML;
}

/* --------------------------------------------------------------- persistence */

const DB_NAME = "forma-devdocs";
const DB_VERSION = 1;
const STORE_INDEX = "indexes";
const STORE_PAGE = "pages";
/** Pages are small; keep a generous window before trimming the oldest. */
const PAGE_CACHE_LIMIT = 500;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_INDEX)) db.createObjectStore(STORE_INDEX);
      if (!db.objectStoreNames.contains(STORE_PAGE)) {
        db.createObjectStore(STORE_PAGE).createIndex("at", "at");
      }
    };
    request.onsuccess = () => resolve(request.result);
    // Private-browsing modes and blocked storage land here — fall back to network.
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function idbGet<T>(store: string, key: string): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const request = db.transaction(store, "readonly").objectStore(store).get(key);
          request.onsuccess = () => resolve((request.result as T) ?? null);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

function idbPut(store: string, key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve) => {
        if (!db) return resolve();
        try {
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        } catch {
          resolve();
        }
      })
  );
}

interface CachedIndex {
  mtime: number;
  entries: DocEntry[];
}

/** Cached entries for a docset, or null when absent or built from an older scrape. */
export async function readCachedIndex(slug: string, mtime: number): Promise<DocEntry[] | null> {
  const cached = await idbGet<CachedIndex>(STORE_INDEX, slug);
  return cached && cached.mtime === mtime ? cached.entries : null;
}

export function writeCachedIndex(slug: string, mtime: number, entries: DocEntry[]): Promise<void> {
  return idbPut(STORE_INDEX, slug, { mtime, entries } satisfies CachedIndex);
}

export async function dropCachedIndex(slug: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE_INDEX, "readwrite").objectStore(STORE_INDEX).delete(slug);
  } catch {
    /* nothing to clean up */
  }
}

interface CachedPage {
  mtime: number;
  html: string;
  at: number;
}

export async function readCachedPage(
  slug: string,
  path: string,
  mtime: number
): Promise<string | null> {
  const cached = await idbGet<CachedPage>(STORE_PAGE, `${slug}/${path}`);
  return cached && cached.mtime === mtime ? cached.html : null;
}

export async function writeCachedPage(
  slug: string,
  path: string,
  mtime: number,
  html: string
): Promise<void> {
  await idbPut(STORE_PAGE, `${slug}/${path}`, {
    mtime,
    html,
    at: Date.now(),
  } satisfies CachedPage);
  await prunePages();
}

/** Keep the page store bounded by evicting the least recently written entries. */
async function prunePages(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const store = db.transaction(STORE_PAGE, "readwrite").objectStore(STORE_PAGE);
    const counted = store.count();
    counted.onsuccess = () => {
      let excess = counted.result - PAGE_CACHE_LIMIT;
      if (excess <= 0) return;
      const cursorRequest = store.index("at").openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || excess-- <= 0) return;
        cursor.delete();
        cursor.continue();
      };
    };
  } catch {
    /* eviction is best-effort */
  }
}

/* -------------------------------------------------------------------- network */

/** Download a docset index, preferring the cached copy for the same scrape. */
export async function loadIndex(slug: string, mtime: number, signal?: AbortSignal) {
  const cached = await readCachedIndex(slug, mtime);
  if (cached) return cached;

  const res = await fetch(indexUrl(slug), { signal });
  if (!res.ok) throw new Error(`Couldn't load the ${slug} index (${res.status})`);
  const data = (await res.json()) as { entries?: DocEntry[] };
  const entries = Array.isArray(data.entries) ? data.entries : [];

  void writeCachedIndex(slug, mtime, entries);
  return entries;
}

/** Download one page, sanitised and ready to inject. */
export async function loadPage(
  slug: string,
  path: string,
  mtime: number,
  signal?: AbortSignal
): Promise<string> {
  const key = path.split("#")[0];
  const cached = await readCachedPage(slug, key, mtime);
  if (cached) return cached;

  const res = await fetch(pageUrl(slug, key), { signal });
  if (!res.ok) throw new Error(`That page isn't in the docset (${res.status})`);
  const html = sanitizePage(await res.text(), slug, key);

  void writeCachedPage(slug, key, mtime, html);
  return html;
}
