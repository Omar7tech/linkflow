import { NextResponse } from "next/server";
import {
  archiveSearchUrl,
  archiveToBook,
  dedupeBooks,
  openLibraryToBook,
  openLibraryUrl,
  type Book,
} from "@/lib/books";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 48;
const MAX_PAGE = 40;
/** Search results age slowly — an hour at the edge, a day while revalidating. */
const CACHE_HEADER = "public, s-maxage=3600, stale-while-revalidate=86400";

interface Upstream {
  /** Books that survived normalisation and the topical filters. */
  docs: Book[];
  /** How many the upstream says exist in total. */
  total: number;
  /** How many rows it actually returned — a full page means there are more. */
  returned: number;
}

/** One guarded JSON fetch. Failures resolve empty so a dead source can't 502 us. */
async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function searchArchive(query: string, page: number, rows: number): Promise<Upstream> {
  const data = await getJson<{
    response?: { numFound?: number; docs?: Record<string, unknown>[] };
  }>(archiveSearchUrl(query, page, rows));

  const docs = data?.response?.docs ?? [];
  return {
    docs: docs.map((doc) => archiveToBook(doc)).filter((b): b is Book => b !== null),
    total: data?.response?.numFound ?? 0,
    returned: docs.length,
  };
}

async function searchOpenLibrary(query: string, page: number, rows: number): Promise<Upstream> {
  // Ask for extra rows: `openLibraryToBook` drops anything whose subjects say
  // it isn't a computing book, and a page that filtered down to three entries
  // would look broken next to the Archive column.
  const asked = Math.min(MAX_ROWS, rows * 2);
  const data = await getJson<{ numFound?: number; docs?: Record<string, unknown>[] }>(
    openLibraryUrl(query, page, asked)
  );

  const docs = data?.docs ?? [];
  return {
    docs: docs.map((doc) => openLibraryToBook(doc, query)).filter((b): b is Book => b !== null),
    total: data?.numFound ?? 0,
    returned: docs.length >= asked ? rows : docs.length,
  };
}

/**
 * Search the two remote catalogues at once and hand back one deduped list.
 * The curated list isn't here — it ships to the browser whole from
 * `/api/books/catalog`, so typing filters it without a round trip.
 *
 *   GET /api/books?q=rust&page=1&rows=24&sources=archive,openlibrary
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").slice(0, 120);
  const page = Math.min(MAX_PAGE, Math.max(1, Number(params.get("page")) || 1));
  const rows = Math.min(MAX_ROWS, Math.max(1, Number(params.get("rows")) || 24));

  const requested = new Set((params.get("sources") ?? "archive,openlibrary").split(","));
  const wantArchive = requested.has("archive");
  const wantOpenLibrary = requested.has("openlibrary");

  const empty: Upstream = { docs: [], total: 0, returned: 0 };
  const [archive, openlibrary] = await Promise.all([
    wantArchive ? searchArchive(query, page, rows) : Promise.resolve(empty),
    wantOpenLibrary ? searchOpenLibrary(query, page, rows) : Promise.resolve(empty),
  ]);

  // Open Library first: where the two indexes overlap it carries the better
  // title, author and cover, and `dedupeBooks` keeps the richer record.
  const books = dedupeBooks([...openlibrary.docs, ...archive.docs]);

  return NextResponse.json(
    {
      books,
      totals: { archive: archive.total, openlibrary: openlibrary.total },
      // Either source returning a full page means there is more to fetch —
      // counted before the topical filter, which can empty a page it kept rows in.
      hasMore: archive.returned >= rows || openlibrary.returned >= rows,
    },
    { headers: { "Cache-Control": CACHE_HEADER } }
  );
}
