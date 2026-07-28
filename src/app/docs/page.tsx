import type { Metadata } from "next";
import { DocsBrowser } from "@/components/docs/docs-browser";
import { SITE } from "@/constants/site";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Search 800+ documentation sets — JavaScript, Python, React, Rust, Go, CSS, PostgreSQL and hundreds more — from one keyboard-driven search box, powered by DevDocs.",
  alternates: { canonical: `${SITE.url}/docs` },
};

/** Docset slugs are lowercase words with `~` version suffixes, e.g. `python~3.12`. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9._~-]{0,60}$/;
/** Page paths are slash-separated segments, optionally ending in an anchor. */
const PATH_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._~%/#()+,:-]{0,200}$/;

export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string; path?: string }>;
}) {
  const params = await searchParams;

  // Only pass through a deep link that looks like one — anything else starts
  // the browser on its landing view rather than chasing a bad URL.
  const doc = params.doc?.trim();
  const path = params.path?.trim();
  const valid = !!doc && !!path && SLUG_PATTERN.test(doc) && PATH_PATTERN.test(path);

  return (
    // An app shell rather than a document: below `lg` it flows with the page,
    // and from `lg` up it fills the viewport under the site header (h-14) so
    // the sidebar and reading pane scroll independently.
    <div className="flex w-full flex-col px-4 pt-7 pb-6 sm:px-6 lg:h-[calc(100svh-3.5rem)] lg:px-8">
      <header className="mb-5 flex shrink-0 flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="text-primary mb-2 flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.25em] uppercase">
            <span className="bg-primary inline-block size-1.5 rounded-full" aria-hidden />
            Reference
          </p>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Docs<span className="text-primary">.</span>
          </h1>
        </div>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          Every language and framework reference in one search box — JavaScript, Python, React,
          Rust, Go, CSS and hundreds more, kept current by{" "}
          <a
            href="https://devdocs.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline decoration-dotted underline-offset-4"
          >
            DevDocs
          </a>
          .
        </p>
      </header>

      <DocsBrowser
        className="min-h-0 lg:flex-1"
        initialSlug={valid ? doc : undefined}
        initialPath={valid ? path : undefined}
      />
    </div>
  );
}
