/**
 * Server-side client for a single Internet Archive item's metadata:
 *
 *   GET https://archive.org/metadata/<identifier>
 *     → { metadata: {...}, files: [{ name, format, size }, ...] }
 *
 * Used to turn an identifier into a real download URL — the filename inside an
 * item is never predictable (`<id>.pdf` for library scans, whatever the
 * uploader called it otherwise), so it has to be looked up.
 */

import { ARCHIVE_ID_PATTERN, ARCHIVE_METADATA, type BookFile } from "@/lib/books";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 8 * 1024 * 1024;

export interface ArchiveItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly subjects: readonly string[];
  readonly files: readonly BookFile[];
}

interface RawFile {
  name?: string;
  format?: string;
  size?: string | number;
}

interface RawMetadata {
  metadata?: {
    title?: string | string[];
    description?: string | string[];
    subject?: string | string[];
  };
  files?: RawFile[];
}

/** Formats worth offering — everything else in an item is derivation cruft. */
const KEEP_FORMATS = /^(text pdf|image container pdf|additional text pdf|pdf|epub|djvu|full text|kindle|mobi|comic book rar|plain text)$/i;

export function downloadUrl(id: string, name: string): string {
  const path = name.split("/").map(encodeURIComponent).join("/");
  return `https://archive.org/download/${encodeURIComponent(id)}/${path}`;
}

function textOf(value: unknown): string {
  const raw = Array.isArray(value) ? value.join(" ") : typeof value === "string" ? value : "";
  // Item descriptions are HTML fragments; the sheet renders them as plain text.
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchArchiveItem(id: string): Promise<ArchiveItem | null> {
  if (!ARCHIVE_ID_PATTERN.test(id)) return null;

  let raw: RawMetadata;
  try {
    const res = await fetch(`${ARCHIVE_METADATA}/${encodeURIComponent(id)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
    raw = (await res.json()) as RawMetadata;
  } catch {
    return null;
  }

  // A missing or dark item answers 200 with an empty object.
  if (!raw || !raw.metadata) return null;

  const files: BookFile[] = [];
  for (const file of raw.files ?? []) {
    const name = file.name;
    const format = file.format ?? "";
    if (!name || !KEEP_FORMATS.test(format)) continue;
    files.push({
      name,
      format,
      bytes: Number(file.size) || 0,
      url: downloadUrl(id, name),
    });
  }

  const subjects = raw.metadata.subject;
  return {
    id,
    title: textOf(raw.metadata.title) || id,
    description: textOf(raw.metadata.description).slice(0, 2000),
    subjects: (Array.isArray(subjects) ? subjects : textOf(subjects).split(/\s*;\s*|\s*,\s*/))
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 12),
    files,
  };
}

/**
 * The file to hand someone who asked for a PDF (or an EPUB).
 *
 * `<identifier>.pdf` is the canonical scan when it exists; otherwise the largest
 * matching file wins, which reliably picks the book over a cover or a sample.
 */
export function pickFile(item: ArchiveItem, kind: "pdf" | "epub"): BookFile | null {
  const wanted = item.files.filter((file) =>
    kind === "pdf"
      ? /\.pdf$/i.test(file.name)
      : /\.epub$/i.test(file.name)
  );
  if (wanted.length === 0) return null;

  const canonical = wanted.find((file) => file.name.toLowerCase() === `${item.id.toLowerCase()}.${kind}`);
  if (canonical) return canonical;

  return wanted.reduce((best, file) => (file.bytes > best.bytes ? file : best));
}
