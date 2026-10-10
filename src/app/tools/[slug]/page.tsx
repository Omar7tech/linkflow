import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { CATALOG } from "@/constants/tools";
import { TOOL_COMPONENTS } from "@/features/registry";
import { toolMetadata } from "@/lib/seo";

// Unknown slugs 404 instead of rendering on demand.
export const dynamicParams = false;

export function generateStaticParams() {
  return CATALOG.map((tool) => ({ slug: tool.slug.split("/").pop()! }));
}

function toolFromSlug(slug: string) {
  return CATALOG.find((tool) => tool.slug === `/tools/${slug}`);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = toolFromSlug(slug);
  return tool ? toolMetadata(tool.id) : {};
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = toolFromSlug(slug);
  if (!tool) notFound();
  const Tool = TOOL_COMPONENTS[tool.id];
  return (
    <>
      <ToolJsonLd toolId={tool.id} />
      <Tool />
    </>
  );
}
