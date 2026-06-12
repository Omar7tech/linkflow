import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { ImageSplitterTool } from "@/features/image-splitter/image-splitter-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("imagesplitter");

export default function ImageSplitterPage() {
  return (
    <>
      <ToolJsonLd toolId="imagesplitter" />
      <ImageSplitterTool />
    </>
  );
}
