import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { ColorsTool } from "@/features/colors/colors-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("colors");

export default function ColorsPage() {
  return (
    <>
      <ToolJsonLd toolId="colors" />
      <ColorsTool />
    </>
  );
}
