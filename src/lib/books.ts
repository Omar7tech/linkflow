/**
 * Free programming books, assembled from three public, key-less sources:
 *
 *   1. free-programming-books (EbookFoundation, CC BY-4.0) — a hand-curated
 *      list of ~4,300 legally free books, most of them a direct PDF.
 *      https://raw.githubusercontent.com/EbookFoundation/free-programming-books-search/main/fpb.json
 *   2. Internet Archive — scanned and uploaded texts with real PDF/EPUB files.
 *      https://archive.org/advancedsearch.php and https://archive.org/metadata/<id>
 *   3. Open Library — the richest metadata and covers; its public-access records
 *      point back at an Archive item, so those download too.
 *
 * All three are free to use without an account or an API key. Only the fetches
 * in `src/app/api/books/*` talk to them; everything exported here besides the
 * URL builders is pure, so the browser can score and filter without a round trip.
 */

/* ---------------------------------------------------------------------- types */

export type BookSource = "curated" | "archive" | "openlibrary";

/** Delivery formats we bother to badge. Anything else is dropped. */
export type BookFormat = "pdf" | "epub" | "html" | "kindle" | "mobi" | "video";

/** One book, normalised across the three sources. */
export interface Book {
  /** Stable, source-prefixed key — safe as a React key and a dedupe key. */
  readonly id: string;
  readonly source: BookSource;
  readonly title: string;
  /** Empty when the source doesn't record one. */
  readonly author: string;
  readonly year: number | null;
  /** Curated section ("Python", "Rust / Web"), or an Archive subject line. */
  readonly topic: string;
  /** Where the book lives: a publisher page, an Archive details page, a PDF. */
  readonly url: string;
  readonly formats: readonly BookFormat[];
  readonly coverUrl: string | null;
  /** Archive identifier, when the book has downloadable files behind it. */
  readonly archiveId: string | null;
  /** Caveats worth showing: "email address requested", "3.x", "in process". */
  readonly note: string;
  /** Archive download count — the only popularity signal any source gives us. */
  readonly downloads: number | null;
  readonly lang: string;
}

/** A file attached to an Archive item, as shown in the details sheet. */
export interface BookFile {
  readonly name: string;
  readonly format: string;
  readonly bytes: number;
  readonly url: string;
}

export interface BookDetail {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly subjects: readonly string[];
  readonly files: readonly BookFile[];
}

/** Compact curated record — short keys because 4,300 of them ship to the client. */
export interface CuratedEntry {
  /** title */ readonly t: string;
  /** url */ readonly u: string;
  /** section */ readonly s: string;
  /** author */ readonly a?: string;
  /** notes */ readonly n?: string;
}

export interface CuratedCatalog {
  readonly lang: string;
  readonly languages: readonly { code: string; name: string; count: number }[];
  readonly sections: readonly { name: string; count: number }[];
  readonly books: readonly CuratedEntry[];
}

/* --------------------------------------------------------------------- upstream */

export const FPB_URL =
  "https://raw.githubusercontent.com/EbookFoundation/free-programming-books-search/main/fpb.json";
export const ARCHIVE_SEARCH = "https://archive.org/advancedsearch.php";
export const ARCHIVE_METADATA = "https://archive.org/metadata";
export const OPENLIBRARY_SEARCH = "https://openlibrary.org/search.json";

export const SOURCE_LABELS: Record<BookSource, string> = {
  curated: "Curated",
  archive: "Archive",
  openlibrary: "Open Library",
};

export const SOURCE_CREDITS: Record<BookSource, { label: string; href: string }> = {
  curated: {
    label: "free-programming-books",
    href: "https://github.com/EbookFoundation/free-programming-books",
  },
  archive: { label: "Internet Archive", href: "https://archive.org" },
  openlibrary: { label: "Open Library", href: "https://openlibrary.org" },
};

/** Topics offered as quick filters before anything has been typed. */
export const QUICK_TOPICS = [
  "Python",
  "JavaScript",
  "Rust",
  "Go",
  "C",
  "C++",
  "Java",
  "TypeScript",
  "Haskell",
  "Algorithms & Data Structures",
  "Machine Learning",
  "Linux",
  "Bash",
  "SQL",
  "Git",
  "Mathematics",
] as const;

/* ------------------------------------------------------------------- archive */

/** Identifiers are ASCII slugs — anything else never reaches archive.org. */
export const ARCHIVE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,120}$/;

/** Lucene metacharacters, stripped so a stray quote can't break the query. */
const LUCENE_UNSAFE = /[+\-&|!(){}[\]^"~*?:\\/]/g;

export function sanitizeQuery(raw: string): string {
  return raw.replace(LUCENE_UNSAFE, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Texts we could actually hand someone: a PDF exists, and the item isn't part
 * of the lending library (those are borrow-only and refuse a direct download).
 */
const ARCHIVE_BASE = 'mediatype:texts AND format:(PDF) AND NOT collection:(inlibrary)';

/**
 * The subject clause that keeps this a programming library. Without it, "rust"
 * returns wheat-rust surveys and a jazz discography by one Brian Rust, both of
 * which out-download every book about the language.
 */
const ARCHIVE_TOPICAL =
  'subject:("computer programming" OR "computer science" OR "software engineering" OR "programming languages" OR computers OR programming OR software)';

/**
 * Build the Archive query. Matching on title and creator rather than the default
 * full-text field is what keeps "clean code" from returning every book that
 * merely mentions clean code — Archive's relevance ranking over the whole index
 * is weak, so we scope the match, keep it on-subject, and rank by downloads.
 */
export function archiveQuery(query: string): string {
  const q = sanitizeQuery(query);
  const scoped = q ? `(title:(${q}) OR creator:(${q})) AND ` : "";
  return `${scoped}${ARCHIVE_BASE} AND ${ARCHIVE_TOPICAL}`;
}

export function archiveSearchUrl(query: string, page: number, rows: number): string {
  const params = new URLSearchParams({
    q: archiveQuery(query),
    rows: String(rows),
    page: String(page),
    output: "json",
  });
  for (const field of ["identifier", "title", "creator", "year", "downloads", "language"]) {
    params.append("fl[]", field);
  }
  params.append("sort[]", "downloads desc");
  return `${ARCHIVE_SEARCH}?${params.toString()}`;
}

/** Archive fields are `string | string[] | undefined` depending on the item. */
function firstOf(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

function joinOf(value: unknown, limit = 3): string {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").slice(0, limit).join(", ");
  return typeof value === "string" ? value : "";
}

interface ArchiveDoc {
  identifier?: string;
  title?: string | string[];
  creator?: string | string[];
  year?: string | number;
  downloads?: number;
  language?: string | string[];
}

export function archiveToBook(doc: ArchiveDoc): Book | null {
  const id = doc.identifier;
  if (!id || !ARCHIVE_ID_PATTERN.test(id)) return null;
  const year = Number(doc.year);
  return {
    id: `archive:${id}`,
    source: "archive",
    title: firstOf(doc.title) || id,
    author: joinOf(doc.creator, 2),
    year: Number.isFinite(year) && year > 0 ? year : null,
    topic: "",
    url: `https://archive.org/details/${encodeURIComponent(id)}`,
    // The `format:(PDF)` filter above guarantees the PDF; EPUB is derived for
    // most scans but not all, so it isn't claimed until the details sheet says so.
    formats: ["pdf"],
    coverUrl: `https://archive.org/services/img/${encodeURIComponent(id)}`,
    archiveId: id,
    note: "",
    downloads: typeof doc.downloads === "number" ? doc.downloads : null,
    lang: firstOf(doc.language).slice(0, 12).toLowerCase() || "",
  };
}

/**
 * Our own redirect to a real file inside an Archive item. The filename varies
 * per item (`<id>.pdf` for scans, the uploader's original name otherwise), so
 * the route resolves it from the metadata and 302s — that keeps the button a
 * plain link instead of a fetch that a popup blocker would eat.
 */
export function archiveFileUrl(id: string, kind: "pdf" | "epub" = "pdf"): string {
  return `/api/books/file?id=${encodeURIComponent(id)}&kind=${kind}`;
}

/* --------------------------------------------------------------- open library */

export function openLibraryUrl(query: string, page: number, rows: number): string {
  const q = sanitizeQuery(query);
  const params = new URLSearchParams({
    // Public access means the full text is readable and downloadable; borrowable
    // and printdisabled records would dead-end on a waiting list.
    q: q ? `title:(${q}) AND ebook_access:public` : "subject:computer_programming AND ebook_access:public",
    limit: String(rows),
    page: String(page),
    fields: "key,title,author_name,ia,first_publish_year,cover_i,language,subject",
  });
  return `${OPENLIBRARY_SEARCH}?${params.toString()}`;
}

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  ia?: string[];
  first_publish_year?: number;
  cover_i?: number;
  language?: string[];
  subject?: string[];
}

/**
 * Open Library has no usable subject filter for this — asking for
 * `subject:(computers)` in the query drops most real matches, because its
 * public-domain records are tagged unevenly. Filtering the returned subjects
 * instead is what separates "Eloquent JavaScript" from "Moth and Rust".
 */
const TOPICAL_SUBJECT =
  /comput|program|software|algorithm|electronic data|engineering|mathemat|internet|web site|artificial intelligence/i;

/**
 * Open Library matches titles loosely — searching "compiler" surfaces The Art
 * of War, whose record mentions a compiler of the edition. Requiring a query
 * word in the title itself costs nothing and drops those.
 */
function titleMatches(title: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length >= 3);
  if (words.length === 0) return true;
  const lower = title.toLowerCase();
  return words.some((word) => lower.includes(word));
}

export function openLibraryToBook(doc: OpenLibraryDoc, query = ""): Book | null {
  const key = doc.key;
  if (!key || !doc.title) return null;
  if (!(doc.subject ?? []).some((subject) => TOPICAL_SUBJECT.test(subject))) return null;
  if (!titleMatches(doc.title, sanitizeQuery(query))) return null;
  const ia = (doc.ia ?? []).find((v) => ARCHIVE_ID_PATTERN.test(v)) ?? null;
  return {
    id: `openlibrary:${key}`,
    source: "openlibrary",
    title: doc.title,
    author: (doc.author_name ?? []).slice(0, 2).join(", "),
    year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
    topic: (doc.subject ?? [])[0]?.replace(/_/g, " ") ?? "",
    url: ia
      ? `https://archive.org/details/${encodeURIComponent(ia)}`
      : `https://openlibrary.org${key}`,
    formats: ia ? ["pdf"] : ["html"],
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    archiveId: ia,
    note: "",
    downloads: null,
    lang: (doc.language ?? [])[0] ?? "",
  };
}

/* -------------------------------------------------------------------- curated */

/** `(PDF)`-style annotations the list uses, mapped to the badges we render. */
const FORMAT_WORDS: readonly [RegExp, BookFormat][] = [
  [/\bpdf\b/i, "pdf"],
  [/\bepub\b/i, "epub"],
  [/\bhtml\b/i, "html"],
  [/\bkindle\b/i, "kindle"],
  [/\bmobi\b/i, "mobi"],
  [/\b(video|screencast)\b/i, "video"],
];

/**
 * Work out what a curated entry actually offers. The list records formats in a
 * free-text note ("HTML, PDF, EPUB"), and a URL ending in `.pdf` is a PDF
 * whatever the note says.
 */
export function curatedFormats(url: string, notes: string): BookFormat[] {
  const found = new Set<BookFormat>();
  if (/\.pdf(\?|#|$)/i.test(url)) found.add("pdf");
  if (/\.epub(\?|#|$)/i.test(url)) found.add("epub");
  for (const [pattern, format] of FORMAT_WORDS) {
    if (pattern.test(notes)) found.add(format);
  }
  if (found.size === 0) found.add("html");
  return [...found];
}

/** Every file-type word the list uses, so a pure format note can be recognised. */
const FORMAT_WORD =
  /^(html5?|pdf|epub3?|kindle|mobi|azw3?|markdown|md|xps|chm|djvu|txt|text|tex|latex|org|rst|ipynb|asciidoc|doc|docx|ps|online|web|video|screencast|audio)$/i;

/** Notes that only describe formats are already badged — keep just the caveats. */
function curatedNote(notes: string): string {
  const caveats = notes
    .split(/\s*·\s*/)
    .map((part) => part.replace(/:construction:/g, "").replace(/\*/g, "").trim())
    .filter((part) => {
      if (!part) return false;
      const words = part.split(/\s*[,/]\s*/).filter(Boolean);
      return !words.every((word) => FORMAT_WORD.test(word));
    });
  return caveats.join(" · ").slice(0, 120);
}

export function curatedToBook(entry: CuratedEntry, lang: string, index: number): Book {
  const notes = entry.n ?? "";
  return {
    id: `curated:${index}`,
    source: "curated",
    title: entry.t,
    author: entry.a ?? "",
    year: null,
    topic: entry.s,
    url: entry.u,
    formats: curatedFormats(entry.u, notes),
    coverUrl: null,
    archiveId: null,
    note: curatedNote(notes),
    downloads: null,
    lang,
  };
}

/* --------------------------------------------------------------------- search */

/**
 * Rank a curated book against a lower-cased query. Returns -1 for no match.
 *
 * Title beats author beats topic, an exact or leading match beats one buried
 * mid-string, and shorter titles win ties — so typing "rust" surfaces "The Rust
 * Programming Language" ahead of "Rust for Rubyists: A Quick Introduction".
 */
export function scoreCurated(book: Book, query: string): number {
  const title = book.title.toLowerCase();
  // "The Rust Programming Language" should rank with the prefix matches, not
  // below them, so a leading article doesn't count against the title.
  const article = /^(the|a|an)\s+/.exec(title)?.[0].length ?? 0;
  const at = title.indexOf(query);
  const start = at === article ? 0 : at;

  if (start === 0) {
    return (title.length - article === query.length ? 1000 : 880) - Math.min(title.length, 90) * 0.5;
  }
  if (start > 0) {
    const boundary = /[^a-z0-9]/.test(title[at - 1]);
    return (boundary ? 760 : 520) - Math.min(title.length, 90) * 0.5;
  }
  if (book.topic.toLowerCase().includes(query)) return 400;
  if (book.author.toLowerCase().includes(query)) return 340;
  return -1;
}

export function searchCurated(books: readonly Book[], rawQuery: string, limit: number): Book[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];
  const hits: { book: Book; score: number }[] = [];
  for (const book of books) {
    const score = scoreCurated(book, query);
    if (score >= 0) hits.push({ book, score });
  }
  hits.sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title));
  return hits.slice(0, limit).map((hit) => hit.book);
}

/**
 * Merge results from several sources. Open Library and the Archive index the
 * same scans, so two entries pointing at one Archive item collapse into the one
 * with the better metadata — Open Library, which has real covers and authors.
 */
export function dedupeBooks(books: readonly Book[]): Book[] {
  const byArchive = new Map<string, Book>();
  const out: Book[] = [];

  for (const book of books) {
    if (!book.archiveId) {
      out.push(book);
      continue;
    }
    const existing = byArchive.get(book.archiveId);
    if (!existing) {
      byArchive.set(book.archiveId, book);
      out.push(book);
      continue;
    }
    // Keep whichever record carries more: an author line, a year, a cover.
    const richer = (b: Book) => (b.author ? 2 : 0) + (b.year ? 1 : 0) + (b.coverUrl ? 1 : 0);
    if (richer(book) > richer(existing)) {
      out[out.indexOf(existing)] = book;
      byArchive.set(book.archiveId, book);
    }
  }
  return out;
}

/* --------------------------------------------------------------------- format */

export function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}k`;
  return String(count);
}

/** The host a curated book is published on, e.g. `python.swaroopch.com`. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
