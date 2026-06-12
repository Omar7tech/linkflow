import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { MockupTool } from "@/features/mockup/mockup-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("mockup");

export default function MockupPage() {
  return (
    <>
      <ToolJsonLd toolId="mockup" />
      <MockupTool />
    </>
  );
}
