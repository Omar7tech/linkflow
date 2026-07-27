import type { Metadata } from "next";
import { IconsHub } from "@/components/icons/icons-hub";
import { SITE } from "@/constants/site";

export const metadata: Metadata = {
  title: "Icons",
  description:
    "Search 200,000+ open-source icons across 150+ sets via Iconify, plus 1,000+ brand SVG logos by category. Theme-aware, recolor, one-click copy and download.",
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
          Icons<span className="text-primary">.</span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-lg text-sm leading-relaxed">
          200,000+ open-source icons across 150+ sets, plus brand logos by category. Search,
          recolor, then copy the SVG or download — theme-aware and always crisp.
        </p>
      </header>
      <IconsHub initialQuery={q} initialCategory={category} />
    </div>
  );
}
