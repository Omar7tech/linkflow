import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  AUDIT_CATEGORY_LABELS,
  type AuditCategory,
  type AuditCheck,
  type AuditStatus,
  type LaunchReadyResult,
} from "@/lib/launch-ready";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4096;
const MAX_URL_LENGTH = 2048;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const FETCH_TIMEOUT_MS = 10_000;
const UA = "Mozilla/5.0 (compatible; FormaLaunchReady/1.0; +https://forma.tools)";

class AuditError extends Error {
  constructor(message: string, readonly status: number) {
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

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return isPrivateIPv4(address);
  const v6 = address.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("fc") || v6.startsWith("fd") || /^fe[89ab]/.test(v6)) return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIPv4(mapped[1]) : false;
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AuditError("Only public http(s) websites can be scanned.", 400);
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    throw new AuditError("That host is not publicly reachable.", 400);
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new AuditError("That host is not publicly reachable.", 400);
    return;
  }
  let addresses;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new AuditError("That domain could not be found. Check the spelling.", 422);
  }
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new AuditError("That host is not publicly reachable.", 400);
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<{ text: string; bytes: number }> {
  const reader = response.body?.getReader();
  if (!reader) return { text: "", bytes: 0 };
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
  return { text: new TextDecoder().decode(merged), bytes: merged.length };
}

interface FetchedPage {
  html: string;
  bytes: number;
  finalUrl: URL;
  headers: Headers;
  status: number;
  responseMs: number;
}

async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AuditError("That does not look like a valid URL.", 400);
  }
  const started = performance.now();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en",
        },
      });
    } catch {
      throw new AuditError("The website did not respond in time.", 422);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      void response.body?.cancel();
      if (!location || hop === MAX_REDIRECTS) throw new AuditError("Too many redirects.", 422);
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      void response.body?.cancel();
      throw new AuditError(`The website returned HTTP ${response.status}.`, 422);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      void response.body?.cancel();
      throw new AuditError("That URL did not return an HTML page.", 422);
    }
    const body = await readCapped(response, MAX_HTML_BYTES);
    return {
      html: body.text,
      bytes: body.bytes,
      finalUrl: url,
      headers: response.headers,
      status: response.status,
      responseMs: Math.round(performance.now() - started),
    };
  }
  throw new AuditError("Too many redirects.", 422);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string): string | null {
  const quoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "is"));
  if (quoted) return decodeEntities(quoted[2]);
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, "i"))?.[1] ?? null;
}

function meta(html: string, name: string): string | null {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if ((attr(tag, "name") ?? attr(tag, "property"))?.toLowerCase() === name.toLowerCase()) {
      return attr(tag, "content");
    }
  }
  return null;
}

function linkHref(html: string, relName: string, base: URL): string | null {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = attr(tag, "rel")?.toLowerCase().split(/\s+/) ?? [];
    if (!rel.includes(relName)) continue;
    const href = attr(tag, "href");
    if (!href) return null;
    try {
      return new URL(href, base).href;
    } catch {
      return null;
    }
  }
  return null;
}

function addCheck(
  checks: AuditCheck[],
  id: string,
  category: AuditCategory,
  passed: boolean,
  title: string,
  summary: string,
  options: { severity?: Exclude<AuditStatus, "passed">; fix?: string; passedSummary?: string } = {}
) {
  checks.push({
    id,
    category,
    status: passed ? "passed" : (options.severity ?? "warning"),
    title,
    summary: passed ? (options.passedSummary ?? summary) : summary,
    fix: passed ? undefined : options.fix,
  });
}

interface PageSpeedData {
  performance: number;
  accessibility: number;
  seo: number;
}

async function getPageSpeed(url: URL): Promise<PageSpeedData | null> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url.href);
  endpoint.searchParams.set("strategy", "mobile");
  for (const category of ["performance", "accessibility", "seo", "best-practices"]) {
    endpoint.searchParams.append("category", category);
  }
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(22_000) });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      lighthouseResult?: { categories?: Record<string, { score?: number }> };
    };
    const categories = data.lighthouseResult?.categories;
    if (!categories) return null;
    return {
      performance: Math.round((categories.performance?.score ?? 0) * 100),
      accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
      seo: Math.round((categories.seo?.score ?? 0) * 100),
    };
  } catch {
    return null;
  }
}

async function getObservatory(host: string): Promise<{ grade: string; score: number } | null> {
  try {
    const endpoint = `https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${encodeURIComponent(host)}`;
    const response = await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(14_000) });
    if (!response.ok) return null;
    const data = (await response.json()) as { grade?: string; score?: number; error?: string | null };
    return data.error || !data.grade ? null : { grade: data.grade, score: data.score ?? 0 };
  } catch {
    return null;
  }
}

async function getValidation(url: URL): Promise<number | null> {
  try {
    const endpoint = `https://validator.w3.org/nu/?out=json&doc=${encodeURIComponent(url.href)}`;
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(14_000),
      headers: { "user-agent": UA },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { messages?: { type?: string }[] };
    return (data.messages ?? []).filter((message) => message.type === "error").length;
  } catch {
    return null;
  }
}

async function resourceExists(base: URL, path: string): Promise<boolean> {
  const url = new URL(path, base);
  try {
    await assertPublicUrl(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
      headers: { "user-agent": UA, accept: "text/plain,application/xml,*/*" },
    });
    void response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

function scoreChecks(checks: AuditCheck[], category: AuditCategory): number {
  const relevant = checks.filter((check) => check.category === category);
  if (!relevant.length) return 100;
  const earned = relevant.reduce((sum, check) => {
    if (check.status === "passed") return sum + 1;
    if (check.status === "warning") return sum + 0.45;
    return sum;
  }, 0);
  return Math.round((earned / relevant.length) * 100);
}

export async function POST(request: Request): Promise<Response> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body too large." }, { status: 413 });
  }
  let target = "";
  try {
    const body = (await request.json()) as { url?: string };
    target = body.url?.trim() ?? "";
  } catch {
    return Response.json({ error: "Send a website URL to scan." }, { status: 400 });
  }
  if (!target) return Response.json({ error: "Enter a website URL." }, { status: 400 });
  if (target.length > MAX_URL_LENGTH) return Response.json({ error: "That URL is too long." }, { status: 400 });
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

  try {
    const page = await fetchPage(target);
    const { html, finalUrl, headers } = page;
    const title = decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || null;
    const description = meta(html, "description");
    const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
    const headings = [...html.matchAll(/<h[1-6]\b[^>]*>/gi)];
    const h1s = [...html.matchAll(/<h1\b[^>]*>/gi)];
    const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
    const links = [...html.matchAll(/<a\b[^>]*>/gi)].map((match) => match[0]);
    const inputs = [...html.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi)].map((match) => match[0]);
    const labelsFor = new Set(
      [...html.matchAll(/<label\b[^>]*\bfor\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((match) => match[1])
    );
    const unlabeledInputs = inputs.filter((tag) => {
      const type = attr(tag, "type")?.toLowerCase();
      if (type === "hidden" || type === "submit" || type === "button") return false;
      const id = attr(tag, "id");
      return !attr(tag, "aria-label") && !attr(tag, "aria-labelledby") && (!id || !labelsFor.has(id));
    });
    const missingAlt = images.filter((tag) => attr(tag, "alt") === null);
    const unsafeBlankLinks = links.filter((tag) => {
      if (attr(tag, "target") !== "_blank") return false;
      const rel = attr(tag, "rel")?.toLowerCase().split(/\s+/) ?? [];
      return !rel.includes("noopener");
    });
    const checks: AuditCheck[] = [];

    addCheck(checks, "https", "security", finalUrl.protocol === "https:", "HTTPS connection", "The final page is not served over HTTPS.", {
      severity: "critical",
      fix: "Redirect every HTTP request to HTTPS and enable TLS at your host.",
      passedSummary: "Visitors reach the page over an encrypted connection.",
    });
    addCheck(checks, "title", "seo", !!title && title.length >= 20 && title.length <= 65, "Search title", title ? `The title is ${title.length} characters; aim for 20-65.` : "The page has no title tag.", {
      severity: "critical",
      fix: `<title>${title || "A clear page title | Brand"}</title>`,
      passedSummary: `The ${title?.length ?? 0}-character title is in a useful search-result range.`,
    });
    addCheck(checks, "description", "seo", !!description && description.length >= 80 && description.length <= 170, "Meta description", description ? `The description is ${description.length} characters; aim for 80-170.` : "Search results have no written summary.", {
      fix: '<meta name="description" content="Explain the page benefit in one clear sentence.">',
      passedSummary: "The page provides a useful search-result summary.",
    });
    addCheck(checks, "viewport", "accessibility", !!meta(html, "viewport"), "Mobile viewport", "Phones may render the page as a zoomed-out desktop site.", {
      severity: "critical",
      fix: '<meta name="viewport" content="width=device-width, initial-scale=1">',
      passedSummary: "The layout declares a mobile-friendly viewport.",
    });
    addCheck(checks, "language", "accessibility", !!attr(htmlTag, "lang"), "Page language", "Screen readers cannot reliably choose the correct pronunciation.", {
      fix: '<html lang="en">',
      passedSummary: `The document language is declared as ${attr(htmlTag, "lang")}.`,
    });
    addCheck(checks, "h1", "content", h1s.length === 1, "One clear page heading", h1s.length === 0 ? "The page has no H1 heading." : `The page has ${h1s.length} H1 headings; one is usually clearest.`, {
      severity: h1s.length === 0 ? "critical" : "warning",
      fix: "Use one descriptive <h1> for the page's main purpose.",
      passedSummary: "The page has one clear primary heading.",
    });
    addCheck(checks, "image-alt", "accessibility", missingAlt.length === 0, "Image descriptions", `${missingAlt.length} of ${images.length} images have no alt attribute.`, {
      severity: missingAlt.length > 2 ? "critical" : "warning",
      fix: 'Add alt="What the image communicates" or alt="" when it is purely decorative.',
      passedSummary: images.length ? `All ${images.length} images declare alt text.` : "The page has no images requiring descriptions.",
    });
    addCheck(checks, "form-labels", "accessibility", unlabeledInputs.length === 0, "Form labels", `${unlabeledInputs.length} form controls do not have an accessible label.`, {
      severity: "critical",
      fix: '<label for="email">Email</label>\n<input id="email" name="email">',
      passedSummary: inputs.length ? `All ${inputs.length} form controls have labels.` : "No unlabeled form controls were found.",
    });
    addCheck(checks, "canonical", "seo", !!linkHref(html, "canonical", finalUrl), "Canonical address", "Search engines are not told which URL is the preferred version.", {
      fix: `<link rel="canonical" href="${finalUrl.origin}${finalUrl.pathname}">`,
      passedSummary: "The page declares its preferred canonical URL.",
    });
    const ogMissing = ["og:title", "og:description", "og:image"].filter((name) => !meta(html, name));
    addCheck(checks, "open-graph", "seo", ogMissing.length === 0, "Social sharing card", `Missing ${ogMissing.join(", ") || "Open Graph metadata"}.`, {
      fix: '<meta property="og:title" content="Page title">\n<meta property="og:description" content="Page summary">\n<meta property="og:image" content="https://example.com/share.jpg">',
      passedSummary: "The page supplies title, description, and image data when shared.",
    });
    addCheck(checks, "favicon", "content", !!linkHref(html, "icon", finalUrl), "Browser icon", "No explicit favicon link was found.", {
      fix: '<link rel="icon" href="/favicon.ico" sizes="any">',
      passedSummary: "A browser-tab icon is explicitly configured.",
    });
    addCheck(checks, "blank-links", "security", unsafeBlankLinks.length === 0, "Safe new-tab links", `${unsafeBlankLinks.length} new-tab links are missing rel="noopener".`, {
      fix: '<a href="https://example.com" target="_blank" rel="noopener noreferrer">',
      passedSummary: "New-tab links cannot control the original page.",
    });

    const securityHeaders = [
      ["content-security-policy", "Content-Security-Policy"],
      ["strict-transport-security", "Strict-Transport-Security"],
      ["x-content-type-options", "X-Content-Type-Options"],
      ["referrer-policy", "Referrer-Policy"],
    ] as const;
    const missingHeaders = securityHeaders.filter(([header]) => !headers.get(header)).map(([, label]) => label);
    addCheck(checks, "headers", "security", missingHeaders.length === 0, "Defensive headers", `Missing ${missingHeaders.join(", ")}.`, {
      severity: missingHeaders.length >= 3 ? "critical" : "warning",
      fix: "Configure these headers at your CDN or web server: " + missingHeaders.join(", "),
      passedSummary: "Core browser security headers are present.",
    });
    addCheck(checks, "page-size", "performance", page.bytes <= 500 * 1024, "HTML payload", `The HTML response is ${Math.round(page.bytes / 1024)} KB; aim below 500 KB.`, {
      severity: page.bytes > 1024 * 1024 ? "critical" : "warning",
      fix: "Remove unused inline data, split large content, and enable server compression.",
      passedSummary: `The HTML response is a lean ${Math.round(page.bytes / 1024)} KB.`,
    });
    addCheck(checks, "response", "performance", page.responseMs < 1000, "Server response", `The initial HTML took ${page.responseMs} ms; aim below 1000 ms.`, {
      severity: page.responseMs > 2500 ? "critical" : "warning",
      fix: "Cache the page, move work out of the request path, and serve it near visitors.",
      passedSummary: `The server returned HTML in ${page.responseMs} ms.`,
    });

    const [robots, sitemap, pagespeed, observatory, validationErrors] = await Promise.all([
      resourceExists(finalUrl, "/robots.txt"),
      resourceExists(finalUrl, "/sitemap.xml"),
      getPageSpeed(finalUrl),
      getObservatory(finalUrl.hostname),
      getValidation(finalUrl),
    ]);
    addCheck(checks, "robots", "seo", robots, "Crawler instructions", "No reachable robots.txt was found.", {
      fix: "Publish /robots.txt and include a Sitemap line.",
      passedSummary: "robots.txt is reachable.",
    });
    addCheck(checks, "sitemap", "seo", sitemap, "XML sitemap", "No reachable sitemap.xml was found.", {
      fix: "Generate /sitemap.xml and submit it in Google Search Console.",
      passedSummary: "sitemap.xml is reachable.",
    });
    if (validationErrors !== null) {
      addCheck(checks, "html-valid", "content", validationErrors === 0, "Valid HTML", `The W3C checker found ${validationErrors} markup errors.`, {
        severity: validationErrors > 5 ? "critical" : "warning",
        fix: "Open the W3C HTML Checker details and fix the first structural error before the rest.",
        passedSummary: "The W3C checker found no HTML errors.",
      });
    }
    if (observatory) {
      addCheck(checks, "observatory", "security", ["A+", "A", "B"].includes(observatory.grade), "Independent security grade", `MDN Observatory graded the site ${observatory.grade}.`, {
        severity: ["D", "F"].includes(observatory.grade) ? "critical" : "warning",
        fix: "Review the MDN Observatory report and add the highest-impact missing header first.",
        passedSummary: `MDN Observatory awarded a ${observatory.grade} grade.`,
      });
    }

    const categoryIds: AuditCategory[] = ["seo", "accessibility", "security", "performance", "content"];
    const categoryScores = Object.fromEntries(categoryIds.map((id) => [id, scoreChecks(checks, id)])) as Record<AuditCategory, number>;
    if (pagespeed) {
      categoryScores.performance = pagespeed.performance;
      categoryScores.accessibility = Math.round((categoryScores.accessibility + pagespeed.accessibility) / 2);
      categoryScores.seo = Math.round((categoryScores.seo + pagespeed.seo) / 2);
    }
    const weights: Record<AuditCategory, number> = { seo: 0.25, accessibility: 0.25, security: 0.2, performance: 0.2, content: 0.1 };
    const score = Math.round(categoryIds.reduce((sum, id) => sum + categoryScores[id] * weights[id], 0));
    const result: LaunchReadyResult = {
      site: {
        url: finalUrl.href,
        host: finalUrl.hostname,
        title,
        description,
        faviconUrl: linkHref(html, "icon", finalUrl) ?? new URL("/favicon.ico", finalUrl).href,
        status: page.status,
        responseMs: page.responseMs,
        pageKb: Math.round(page.bytes / 1024),
      },
      score,
      verdict: score >= 90 ? "Clear for launch" : score >= 75 ? "Almost ready" : score >= 55 ? "Needs a tune-up" : "Hold the launch",
      categories: categoryIds.map((id) => ({ id, label: AUDIT_CATEGORY_LABELS[id], score: categoryScores[id] })),
      checks: checks.sort((a, b) => {
        const order: Record<AuditStatus, number> = { critical: 0, warning: 1, passed: 2 };
        return order[a.status] - order[b.status];
      }),
      facts: {
        headings: headings.length,
        images: images.length,
        links: links.length,
        scripts: [...html.matchAll(/<script\b[^>]*>/gi)].length,
      },
      services: {
        pagespeed: pagespeed ? "available" : "unavailable",
        observatory: observatory ? "available" : "unavailable",
        validator: validationErrors !== null ? "available" : "unavailable",
      },
      scannedAt: new Date().toISOString(),
    };
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof AuditError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Something went wrong while scanning that site." }, { status: 500 });
  }
}
