import { NextResponse } from "next/server";
import { fetchManifest } from "@/lib/devdocs";

export const runtime = "nodejs";

// The manifest changes only when DevDocs re-scrapes something — hours of edge
// caching is plenty, and stale copies stay useful for a week.
const CACHE_HEADER = "public, s-maxage=43200, stale-while-revalidate=604800";

/**
 * The trimmed DevDocs docset manifest: every documentation set we can open,
 * with the version, scrape time and credit line the browser needs.
 */
export async function GET() {
  try {
    const docsets = await fetchManifest();
    return NextResponse.json(docsets, { headers: { "Cache-Control": CACHE_HEADER } });
  } catch {
    // Upstream hiccup — let the client fall back to whatever it has cached.
    return NextResponse.json(
      { error: "The DevDocs manifest is unavailable right now." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
