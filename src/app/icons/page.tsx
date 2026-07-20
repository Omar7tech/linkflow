import type { Metadata } from "next";
import { IconsExplorer } from "@/components/icons/icons-explorer";
import { getCategories, getLatest } from "@/lib/svgl";
import { SITE } from "@/constants/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Brand Icons",
  description:
    "Browse and copy 1,000+ brand SVG logos by category — frameworks, libraries, design tools, social, crypto and more. Theme-aware, one-click copy, powered by SVGL.",
  alternates: { canonical: `${SITE.url}/icons` },
};

export default async function IconsPage() {
  const [categories, initial] = await Promise.all([getCategories(), getLatest()]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">Brand icons</h1>
        <p className="text-muted-foreground mt-2">
          A searchable library of brand SVG logos, sorted by category. Click any icon to copy its
          source — theme-aware, always crisp.
        </p>
      </header>
      <IconsExplorer categories={categories} initial={initial} />
    </div>
  );
}
