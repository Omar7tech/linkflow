import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractCss, type DesignDna } from "@/lib/design-dna";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (compatible; FormaDesignDNA/1.0; +https://forma.tools) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 9000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_CSS_BYTES = 600 * 1024;
const MAX_SHEETS = 10;
const MAX_REDIRECTS = 4;

class InspectError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateAddress(addr: string): boolean {
  if (isIP(addr) === 4) return isPrivateIPv4(addr);
  const v6 = addr.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9")) return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIPv4(mapped[1]) : false;
}

/** Reject URLs that could reach internal infrastructure (basic SSRF guard). */
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InspectError("Only http(s) URLs are supported.", 400);
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    throw new InspectError("That host isn't reachable from here.", 400);
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new InspectError("That host isn't reachable from here.", 400);
    return;
  }
  let addresses;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new InspectError("Couldn't resolve that domain — check the spelling.", 422);
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new InspectError("That host isn't reachable from here.", 400);
  }
}

/** Read a body with a hard byte cap so a huge response can't pin the server. */
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    chunks.push(value);
  }
  void reader.cancel().catch(() => undefined);
  const merged = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, merged.length - offset);
    merged.set(slice, offset);
    offset += slice.length;
    if (offset >= merged.length) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

interface Fetched {
  text: string;
  finalUrl: URL;
  contentType: string;
}

async function fetchGuarded(rawUrl: string, accept: string, maxBytes: number): Promise<Fetched> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new InspectError("That doesn't look like a valid URL.", 400);
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "user-agent": UA, accept, "accept-language": "en" },
      });
    } catch {
      throw new InspectError("The site didn't respond in time.", 422);
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      void res.body?.cancel();
      if (!location || hop === MAX_REDIRECTS) {
        throw new InspectError("Too many redirects.", 422);
      }
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) {
      void res.body?.cancel();
      throw new InspectError(`The site answered with HTTP ${res.status}.`, 422);
    }
    return {
      text: await readCapped(res, maxBytes),
      finalUrl: url,
      contentType: res.headers.get("content-type") ?? "",
    };
  }
  throw new InspectError("Too many redirects.", 422);
}

/* ------------------------------------------------------------- html bits */

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function metaContent(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${key}["'][^>]*>|<meta[^>]+content=["'][^"']*["'][^>]+(?:name|property)=["']${key}["'][^>]*>`,
    "i"
  );
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content) : null;
}

function attrOf(tag: string, name: string): string | null {
  return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] ?? null;
}

function collectStylesheetUrls(html: string, base: URL): string[] {
  const urls: string[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = attrOf(tag, "rel")?.toLowerCase() ?? "";
    if (!rel.split(/\s+/).includes("stylesheet")) continue;
    const href = attrOf(tag, "href");
    if (!href) continue;
    try {
      urls.push(new URL(decodeEntities(href), base).href);
    } catch {
      // skip malformed hrefs
    }
  }
  return [...new Set(urls)];
}

function collectImports(css: string, base: URL): string[] {
  const urls: string[] = [];
  for (const m of css.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?/gi)) {
    try {
      urls.push(new URL(m[1], base).href);
    } catch {
      // skip malformed imports
    }
  }
  return urls;
}

function findFavicon(html: string, base: URL): string {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = attrOf(tag, "rel")?.toLowerCase() ?? "";
    if (!/(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/.test(rel)) continue;
    const href = attrOf(tag, "href");
    if (href) {
      try {
        return new URL(decodeEntities(href), base).href;
      } catch {
        // try the next candidate
      }
    }
  }
  return new URL("/favicon.ico", base).href;
}

/* ----------------------------------------------------------------- route */

export async function POST(request: Request): Promise<Response> {
  let target: string;
  try {
    const body = (await request.json()) as { url?: string };
    target = (body.url ?? "").trim();
  } catch {
    return Response.json({ error: "Send JSON like { \"url\": \"https://example.com\" }." }, { status: 400 });
  }
  if (!target) return Response.json({ error: "Enter a URL to inspect." }, { status: 400 });
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

  try {
    const page = await fetchGuarded(target, "text/html,application/xhtml+xml", MAX_HTML_BYTES);
    const html = page.text;
    const base = page.finalUrl;

    // Inline <style> blocks count as the first "stylesheet".
    const inlineCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
      .map((m) => m[1])
      .join("\n");

    const sheetUrls = collectStylesheetUrls(html, base).slice(0, MAX_SHEETS);
    const sheets = await Promise.allSettled(
      sheetUrls.map((href) => fetchGuarded(href, "text/css,*/*;q=0.5", MAX_CSS_BYTES))
    );
    let css = inlineCss;
    let fetchedSheets = 0;
    const importQueue: string[] = [];
    for (const result of sheets) {
      if (result.status !== "fulfilled") continue;
      fetchedSheets++;
      css += "\n" + result.value.text;
      importQueue.push(...collectImports(result.value.text, result.value.finalUrl));
    }
    // One level of @import, within the same overall sheet budget.
    for (const href of [...new Set(importQueue)].slice(0, Math.max(0, MAX_SHEETS - fetchedSheets))) {
      try {
        const imported = await fetchGuarded(href, "text/css,*/*;q=0.5", MAX_CSS_BYTES);
        css += "\n" + imported.text;
        fetchedSheets++;
      } catch {
        // imported sheet unavailable — extraction still works from the rest
      }
    }

    if (css.trim().length < 40) {
      return Response.json(
        { error: "No readable CSS found — the site may render its styles with JavaScript only." },
        { status: 422 }
      );
    }

    const extraction = extractCss(css);
    const dna: DesignDna = {
      site: {
        url: base.href,
        title: decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || null,
        description: metaContent(html, "description") ?? metaContent(html, "og:description"),
        faviconUrl: findFavicon(html, base),
        themeColor: metaContent(html, "theme-color"),
      },
      ...extraction,
      stats: {
        stylesheets: fetchedSheets + (inlineCss ? 1 : 0),
        cssKb: Math.round(css.length / 1024),
        declarations: extraction.declarations,
      },
    };
    return Response.json(dna);
  } catch (error) {
    if (error instanceof InspectError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Something went wrong inspecting that site." }, { status: 500 });
  }
}
