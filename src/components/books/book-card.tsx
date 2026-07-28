"use client";

import * as React from "react";
import { DownloadIcon, ExternalLinkIcon, InfoIcon } from "lucide-react";
import {
  archiveFileUrl,
  formatDownloads,
  hostOf,
  SOURCE_LABELS,
  type Book,
  type BookFormat,
} from "@/lib/books";
import { cn } from "@/lib/utils";

/** Stable per-title number, so a book keeps the same generated cover forever. */
function hashOf(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (Math.imul(hash, 31) + input.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/**
 * A generated cover for books that don't have one — the curated list is links,
 * not scans, so most of the grid would otherwise be empty boxes. The hue stays
 * inside the emerald/teal band and only the angle, lightness and chroma move,
 * which keeps 4,000 distinct covers looking like one set.
 */
function GeneratedCover({ book }: { book: Book }) {
  const seed = hashOf(book.title + book.topic);
  const hue = 146 + (seed % 42);
  const angle = 110 + (seed % 9) * 20;
  const light = 0.33 + ((seed >> 3) % 9) * 0.035;
  const chroma = 0.07 + ((seed >> 7) % 5) * 0.022;

  return (
    <div
      className="relative flex h-full w-full flex-col justify-between p-3"
      style={{
        backgroundImage: `linear-gradient(${angle}deg, oklch(${light} ${chroma} ${hue}), oklch(${light - 0.13} ${chroma * 0.6} ${hue + 14}))`,
      }}
    >
      {/* A spine, so the tile reads as a book rather than a swatch. */}
      <span
        className="absolute inset-y-0 left-0 w-2 bg-black/20 mix-blend-multiply"
        aria-hidden
      />
      <span className="pl-2 font-mono text-[9px] tracking-[0.2em] text-white/60 uppercase">
        {book.topic.split(" / ")[0].slice(0, 22) || SOURCE_LABELS[book.source]}
      </span>
      <span className="font-heading line-clamp-4 pl-2 text-[13px] leading-snug font-semibold text-balance text-white/95">
        {book.title}
      </span>
      <span className="truncate pl-2 text-[10px] text-white/55">
        {book.author || hostOf(book.url)}
      </span>
    </div>
  );
}

/** Remote cover with a graceful fall back to the generated one. */
function BookCover({ book }: { book: Book }) {
  const [failed, setFailed] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  if (!book.coverUrl || failed) return <GeneratedCover book={book} />;

  return (
    <>
      {!loaded && <div className="bg-muted absolute inset-0 animate-pulse" aria-hidden />}
      {/* eslint-disable-next-line @next/next/no-img-element -- remote covers from archive.org / openlibrary.org; next/image would need per-host config for no gain on a thumbnail */}
      <img
        src={book.coverUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          !loaded && "opacity-0"
        )}
      />
    </>
  );
}

const FORMAT_LABELS: Record<BookFormat, string> = {
  pdf: "PDF",
  epub: "EPUB",
  html: "Web",
  kindle: "Kindle",
  mobi: "MOBI",
  video: "Video",
};

function FormatBadge({ format }: { format: BookFormat }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider uppercase",
        format === "pdf"
          ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      {FORMAT_LABELS[format]}
    </span>
  );
}

export function BookCard({ book, onDetails }: { book: Book; onDetails: (book: Book) => void }) {
  const meta = [
    book.year ? String(book.year) : "",
    book.downloads ? `${formatDownloads(book.downloads)} downloads` : "",
    book.source === "curated" ? hostOf(book.url) : SOURCE_LABELS[book.source],
  ].filter(Boolean);

  // Archive items go through our resolver, which knows the filename inside the
  // item; a curated link that already ends in `.pdf` is the file itself, so the
  // one button covers both and there's nothing to add beside it.
  const directPdf = !book.archiveId && /\.pdf(\?|#|$)/i.test(book.url);
  const pdfHref = book.archiveId ? archiveFileUrl(book.archiveId) : null;

  return (
    <article className="group border-border/60 bg-card hover:border-primary/40 flex flex-col overflow-hidden rounded-xl border transition-colors">
      <a
        href={book.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-3/4 overflow-hidden"
      >
        <BookCover book={book} />
      </a>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-[13px] leading-snug font-medium">
          <a
            href={book.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            {book.title}
          </a>
        </h3>

        {book.author && (
          <p className="text-muted-foreground truncate text-[11px]">{book.author}</p>
        )}

        <p className="text-muted-foreground/70 mt-auto truncate pt-1 font-mono text-[10px]">
          {meta.join(" · ")}
        </p>

        <div className="flex flex-wrap items-center gap-1">
          {book.formats.map((format) => (
            <FormatBadge key={format} format={format} />
          ))}
          {book.note && (
            <span className="text-muted-foreground/70 truncate text-[10px] italic">
              {book.note}
            </span>
          )}
        </div>
      </div>

      <div className="border-border/60 flex items-stretch border-t text-[11px]">
        <a
          href={book.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "hover:bg-muted/60 flex flex-1 items-center justify-center gap-1.5 py-2 transition-colors",
            directPdf
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {directPdf ? (
            <DownloadIcon className="size-3.5" aria-hidden />
          ) : (
            <ExternalLinkIcon className="size-3.5" aria-hidden />
          )}
          {directPdf ? "PDF" : "Open"}
        </a>

        {pdfHref && (
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border/60 hover:bg-muted/60 flex flex-1 items-center justify-center gap-1.5 border-l py-2 text-emerald-600 transition-colors dark:text-emerald-400"
          >
            <DownloadIcon className="size-3.5" aria-hidden />
            PDF
          </a>
        )}

        {book.archiveId && (
          <button
            type="button"
            onClick={() => onDetails(book)}
            aria-label={`Details for ${book.title}`}
            className="border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center border-l px-3 transition-colors"
          >
            <InfoIcon className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </article>
  );
}
