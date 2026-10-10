import { SITE } from "@/constants/site";
import { CATALOG } from "@/constants/tools";
import { OG_SIZE, renderOgImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return CATALOG.map((tool) => ({ slug: tool.slug.split("/").pop()! }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = CATALOG.find((t) => t.slug === `/tools/${slug}`);
  return renderOgImage(tool?.name ?? SITE.name, tool?.description ?? "");
}
