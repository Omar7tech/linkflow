import { NextResponse } from "next/server";
import { FPB_URL, hasCuratedPdf, type CuratedCatalog, type CuratedEntry } from "@/lib/books";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 20_000;
/** The list is ~3 MB today; the ceiling is only there to bound a bad response. */
const MAX_BYTES = 12 * 1024 * 1024;
/** The upstream list changes a few times a week — half a day is plenty. */
const TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_HEADER = "public, s-maxage=43200, stale-while-revalidate=604800";

/* The shape of fpb.json — everything optional, because it's community-edited. */
interface FpbEntry {
  url?: string;
  title?: string;
  author?: string;
  notes?: string[];
}
interface FpbSection {
  section?: string;
  entries?: FpbEntry[];
  subsections?: FpbSection[];
}
interface FpbLanguage {
  language?: { code?: string; name?: string };
  sections?: FpbSection[];
}
interface FpbRoot {
  children?: { type?: string; children?: FpbLanguage[] }[];
}

interface ParsedLanguage {
  code: string;
  name: string;
  books: CuratedEntry[];
}

/**
 * Parsed catalogue, memoised per warm instance. Re-parsing 3 MB of JSON on
 * every request would dwarf the cost of serving it.
 */
let memo: { at: number; languages: Map<string, ParsedLanguage> } | null = null;
let inFlight: Promise<Map<string, ParsedLanguage>> | null = null;

/** Walk a section and its nested subsections, prefixing the path as it goes. */
function collectSection(section: FpbSection, path: string, into: CuratedEntry[]): void {
  const name = section.section?.trim() ?? "";
  const label = path ? (name ? `${path} / ${name}` : path) : name || "Misc";

  for (const entry of section.entries ?? []) {
    const url = entry.url?.trim();
    // Entries pointing at a Markdown file are the list's own index pages.
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const title = entry.title?.trim();
    if (!title) continue;

    const notes = (entry.notes ?? []).filter(Boolean).join(" · ").trim();
    // The list is mostly web tutorials; only the ones with a PDF belong here.
    if (!hasCuratedPdf(url, notes)) continue;

    const record: CuratedEntry = { t: title.slice(0, 180), u: url, s: label };
    if (entry.author?.trim()) Object.assign(record, { a: entry.author.trim().slice(0, 140) });
    if (notes) Object.assign(record, { n: notes.slice(0, 140) });
    into.push(record);
  }

  for (const child of section.subsections ?? []) collectSection(child, label, into);
}

/**
 * Flatten fpb.json into one bucket per language.
 *
 * Only the `books` group is kept — the file also carries screencasts, courses
 * and interactive tutorials, which aren't books. English appears three times
 * upstream (by-language, by-subject and an index stub), so buckets merge by code.
 */
function parseCatalog(root: FpbRoot): Map<string, ParsedLanguage> {
  const languages = new Map<string, ParsedLanguage>();

  for (const group of root.children ?? []) {
    if (group.type !== "books") continue;

    for (const lang of group.children ?? []) {
      const code = lang.language?.code?.trim();
      if (!code) continue;

      const bucket = languages.get(code) ?? {
        code,
        name: lang.language?.name?.trim() || code,
        books: [],
      };
      for (const section of lang.sections ?? []) collectSection(section, "", bucket.books);
      languages.set(code, bucket);
    }
  }

  for (const bucket of languages.values()) {
    bucket.books.sort((a, b) => a.t.localeCompare(b.t));
  }
  return languages;
}

async function loadCatalog(): Promise<Map<string, ParsedLanguage>> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.languages;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const res = await fetch(FPB_URL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Deliberately uncached: the payload is far past Next's data-cache entry
      // limit, so it would be fetched fresh anyway. The memo below covers us.
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`free-programming-books returned ${res.status}`);

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) throw new Error("free-programming-books payload too large");

    const raw = (await res.json()) as FpbRoot;
    const languages = parseCatalog(raw);
    if (languages.size === 0) throw new Error("free-programming-books payload malformed");

    memo = { at: Date.now(), languages };
    return languages;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/**
 * The curated catalogue for one language, plus the language and section indexes
 * the browser needs to render its filters.
 *
 *   GET /api/books/catalog?lang=en
 */
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("lang")?.trim().toLowerCase() ?? "en";

  try {
    const languages = await loadCatalog();
    const lang = languages.has(requested) ? requested : "en";
    const bucket = languages.get(lang);
    if (!bucket) throw new Error("no English bucket in the catalogue");

    const catalog: CuratedCatalog = {
      lang,
      languages: [...languages.values()]
        .map((entry) => ({ code: entry.code, name: entry.name, count: entry.books.length }))
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count),
      books: bucket.books,
    };

    return NextResponse.json(catalog, { headers: { "Cache-Control": CACHE_HEADER } });
  } catch {
    return NextResponse.json(
      { error: "The curated book list is unavailable right now." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
