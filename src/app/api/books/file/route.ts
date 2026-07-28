import { NextResponse } from "next/server";
import { fetchArchiveItem, pickFile } from "@/lib/archive-item";
import { ARCHIVE_ID_PATTERN } from "@/lib/books";

export const runtime = "nodejs";

const CACHE_HEADER = "public, s-maxage=86400, stale-while-revalidate=604800";

/**
 * Redirect to the real PDF (or EPUB) inside an Archive item.
 *
 *   GET /api/books/file?id=<identifier>&kind=pdf
 *
 * The filename varies per item, so it has to be resolved from the metadata.
 * Doing that here — rather than in the browser — keeps the download button a
 * plain `<a href>`: no fetch-then-`window.open` for a popup blocker to eat, and
 * the lookup is cached at the edge for a day.
 *
 * Only the redirect is ours; the bytes come straight from archive.org.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id")?.trim() ?? "";
  const kind = params.get("kind") === "epub" ? "epub" : "pdf";

  if (!ARCHIVE_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });
  }

  const item = await fetchArchiveItem(id);
  const file = item ? pickFile(item, kind) : null;

  // No such file — send them to the item page, which always has *something*.
  const target = file?.url ?? `https://archive.org/details/${encodeURIComponent(id)}`;

  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Cache-Control": file ? CACHE_HEADER : "no-store" },
  });
}
