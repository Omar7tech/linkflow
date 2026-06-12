import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { UniversalTool } from "@/features/universal/universal-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("universal");

export default function UniversalPage() {
  return (
    <>
      <ToolJsonLd toolId="universal" />
      <UniversalTool />
    </>
  );
}
