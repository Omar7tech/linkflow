import type { Metadata } from "next";
import { IconsExplorer } from "@/components/icons/icons-explorer";
import { SITE } from "@/constants/site";

export const metadata: Metadata = {
  title: "Brand Icons",
  description:
    "Browse and copy 1,000+ brand SVG logos by category — frameworks, libraries, design tools, social, crypto and more. Theme-aware, one-click copy, powered by SVGL.",
  alternates: { canonical: `${SITE.url}/icons` },
};

export default async function IconsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const category = (sp.category ?? "").trim() || null;

  // The icon data is fetched client-side (directly from the svgl API, which
  // allows CORS) so it always loads from the user's own network — a server-side
  // fetch gets blocked by svgl's Cloudflare from datacenter IPs in production.
  // We only pass through what the URL asks for, to seed the initial view.
  return (
    <div className="w-full px-4 py-12 sm:px-6 lg:px-8">
      <header className="border-border relative mb-8 overflow-hidden border-b pb-6">
        {/* Faded dot grid, fading in from the right */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-1/2 bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-[size:18px_18px] mask-[linear-gradient(to_left,black,transparent)]"
        />
        <p className="text-primary mb-2.5 flex items-center gap-2 font-mono text-xs font-medium tracking-[0.25em] uppercase">
          <span className="bg-primary inline-block size-1.5 rounded-full" aria-hidden />
          SVG Library
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Brand icons<span className="text-primary">.</span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-lg text-sm leading-relaxed">
          A searchable library of brand SVG logos, sorted by category. Click any icon to copy its
          source — theme-aware, always crisp.
        </p>
      </header>
      <IconsExplorer initialQuery={q} initialCategory={category} />
    </div>
  );
}
