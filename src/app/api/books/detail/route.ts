import { NextResponse } from "next/server";
import { fetchArchiveItem } from "@/lib/archive-item";
import { ARCHIVE_ID_PATTERN, type BookDetail } from "@/lib/books";

export const runtime = "nodejs";

const CACHE_HEADER = "public, s-maxage=86400, stale-while-revalidate=604800";

/**
 * Everything the details sheet shows for one Archive item: the blurb, the
 * subject tags, and the downloadable files with their real sizes.
 *
 *   GET /api/books/detail?id=<identifier>
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";

  if (!ARCHIVE_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });
  }

  const item = await fetchArchiveItem(id);
  if (!item) {
    return NextResponse.json(
      { error: "That item isn't available." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const detail: BookDetail = {
    id: item.id,
    title: item.title,
    description: item.description,
    subjects: item.subjects,
    files: item.files,
  };

  return NextResponse.json(detail, { headers: { "Cache-Control": CACHE_HEADER } });
}
