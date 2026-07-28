import type { Metadata } from "next";
import { BooksBrowser } from "@/components/books/books-browser";
import { SITE } from "@/constants/site";

export const metadata: Metadata = {
  title: "Free Programming Books",
  description:
    "Search thousands of free programming book PDFs — Python, JavaScript, PHP, Java, Rust, Go, C, algorithms and more — across free-programming-books, the Internet Archive and Open Library. Every result is a downloadable PDF.",
  keywords: [
    "free programming books",
    "programming books pdf",
    "free ebooks for developers",
    "computer science books pdf",
    "download programming books",
  ],
  alternates: { canonical: `${SITE.url}/books` },
};

/** Deep links carry a search and/or a topic — anything longer is ignored. */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length <= 80 ? trimmed : undefined;
}

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; topic?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto w-full max-w-[100rem] px-4 pt-7 pb-16 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="text-primary mb-2 flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.25em] uppercase">
            <span className="bg-primary inline-block size-1.5 rounded-full" aria-hidden />
            Library
          </p>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Programming books<span className="text-primary">.</span>
          </h1>
        </div>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          Thousands of legally free programming PDFs, searched across three open catalogues at once
          — a curated list, the Internet Archive and Open Library. Every result downloads as a PDF.
        </p>
      </header>

      <BooksBrowser initialQuery={clean(params.q)} initialTopic={clean(params.topic)} />
    </div>
  );
}
