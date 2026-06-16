/**
 * Helpers for the social link previewer: turning a handful of page fields into
 * the exact Open Graph / Twitter meta tags crawlers read, plus the little
 * derivations (domain, sensible truncation) each platform's card applies.
 */

export interface SocialMeta {
  title: string;
  description: string;
  url: string;
  image: string;
  favicon: string;
  siteName: string;
  twitterHandle: string;
}

export const EMPTY_META: SocialMeta = {
  title: "",
  description: "",
  url: "",
  image: "",
  favicon: "",
  siteName: "",
  twitterHandle: "",
};

/** True for inline data: URIs, which can't be used as a hosted og:image. */
export function isDataUri(value: string): boolean {
  return value.trim().startsWith("data:");
}

/** Pull the bare host from a URL, dropping protocol and a leading "www.". */
export function domainOf(url: string): string {
  const raw = url.trim();
  if (!raw) return "example.com";
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || "example.com";
  }
}

/** Trim to a length on a word boundary with an ellipsis, the way crawlers do. */
export function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Build the copy-ready <head> meta block from the fields. */
export function buildMetaTags(meta: SocialMeta): string {
  const { title, description, url, image, favicon, siteName, twitterHandle } = meta;
  const lines: string[] = [];
  const push = (tag: string, value: string) => {
    if (value.trim()) lines.push(tag.replace("%s", escapeAttr(value.trim())));
  };

  push(`<title>%s</title>`, title);
  push(`<meta name="description" content="%s" />`, description);
  // A data: URI here would be valid but bloat the head; skip it with a hint.
  if (favicon.trim()) {
    if (isDataUri(favicon)) lines.push(`<!-- Host your favicon, then: <link rel="icon" href="…" /> -->`);
    else push(`<link rel="icon" href="%s" />`, favicon);
  }
  lines.push("");
  lines.push(`<!-- Open Graph -->`);
  push(`<meta property="og:title" content="%s" />`, title);
  push(`<meta property="og:description" content="%s" />`, description);
  push(`<meta property="og:url" content="%s" />`, url);
  push(`<meta property="og:image" content="%s" />`, image);
  push(`<meta property="og:site_name" content="%s" />`, siteName);
  lines.push(`<meta property="og:type" content="website" />`);
  lines.push("");
  lines.push(`<!-- Twitter / X -->`);
  lines.push(`<meta name="twitter:card" content="${image.trim() ? "summary_large_image" : "summary"}" />`);
  push(`<meta name="twitter:title" content="%s" />`, title);
  push(`<meta name="twitter:description" content="%s" />`, description);
  push(`<meta name="twitter:image" content="%s" />`, image);
  push(`<meta name="twitter:site" content="%s" />`, twitterHandle);

  return lines.join("\n");
}

/** Rough completeness score so the UI can nudge toward a strong unfurl. */
export function metaScore(meta: SocialMeta): { score: number; tips: string[] } {
  const tips: string[] = [];
  let score = 0;
  if (meta.title.trim()) score += 30;
  else tips.push("Add a title — it's the headline every platform shows.");
  if (meta.description.trim()) score += 25;
  else tips.push("Add a description to fill the card body.");
  if (meta.image.trim()) score += 30;
  else tips.push("Add a 1200×630 image — cards with one get far more clicks.");
  if (meta.url.trim()) score += 10;
  else tips.push("Add the page URL so the domain shows correctly.");
  if (meta.siteName.trim()) score += 5;

  if (meta.title.length > 60) tips.push("Title over 60 chars may be cut off in Google.");
  if (meta.description.length > 160) tips.push("Description over 160 chars may be truncated.");

  return { score, tips };
}
