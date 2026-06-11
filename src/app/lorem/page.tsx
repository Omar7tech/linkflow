import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { LoremTool } from "@/features/lorem/lorem-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("lorem");

export default function LoremPage() {
  return (
    <>
      <ToolJsonLd toolId="lorem" />
      <LoremTool />
    </>
  );
}
