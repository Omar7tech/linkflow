import { SITE } from "@/constants/site";
import { EXPERIMENTS } from "@/constants/tools";
import { OG_SIZE, renderOgImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return EXPERIMENTS.map((tool) => ({ slug: tool.slug.split("/").pop()! }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = EXPERIMENTS.find((t) => t.slug === `/experiments/${slug}`);
  return renderOgImage(tool?.name ?? SITE.name, tool?.description ?? "");
}
