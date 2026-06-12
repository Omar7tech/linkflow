import type { Metadata } from "next";
import { JsonLd, webAppJsonLd } from "@/components/shared/json-ld";
import { ImageSplitterTool } from "@/features/image-splitter/image-splitter-tool";
import { TOOL_BY_ID } from "@/constants/tools";
import { SITE } from "@/constants/site";

const tool = TOOL_BY_ID.imagesplitter;

export const metadata: Metadata = {
  title: `${tool.name} — ${SITE.name}`,
  description: tool.description,
  keywords: tool.keywords,
};

export default function ImageSplitterPage() {
  return (
    <>
      <JsonLd
        data={webAppJsonLd({
          name: tool.name,
          description: tool.description,
          url: `${SITE.url}${tool.slug}`,
        })}
      />
      <ImageSplitterTool />
    </>
  );
}
