import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Only these hosts may be proxied — a tight allowlist, so no DNS/SSRF checks needed. */
const ALLOWED_HOSTS = new Set(["svgl.app", "api.svgl.app"]);
const FETCH_TIMEOUT_MS = 8000;
const MAX_SVG_BYTES = 512 * 1024;
const CACHE_HEADER = "public, s-maxage=604800, stale-while-revalidate=2592000";

/**
 * Proxy a single SVG file from svgl so the client can copy its source without
 * cross-origin fetch issues, with caching to spare the upstream.
 *   /api/icons/svg?url=https://svgl.app/discord.svg
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(target, {
      signal: controller.signal,
      next: { revalidate: 604800 },
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }
    const text = await upstream.text();
    if (text.length > MAX_SVG_BYTES) {
      return NextResponse.json({ error: "Too large" }, { status: 413 });
    }
    return new NextResponse(text, {
      headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": CACHE_HEADER },
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
