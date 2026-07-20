import { NextResponse } from "next/server";
import { getByCategory, getLatest, searchSvgs } from "@/lib/svgl";

export const runtime = "nodejs";

const CACHE_HEADER = "public, s-maxage=86400, stale-while-revalidate=604800";

/**
 * On-demand icon data for the client explorer.
 *   ?category=<name>  → icons in a category
 *   ?search=<query>   → search by title
 *   (none)            → latest icons
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category")?.slice(0, 60);
  const search = searchParams.get("search")?.slice(0, 80);

  const svgs = search
    ? await searchSvgs(search)
    : category
      ? await getByCategory(category)
      : await getLatest();

  return NextResponse.json(svgs, { headers: { "Cache-Control": CACHE_HEADER } });
}
