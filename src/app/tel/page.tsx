import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { TelTool } from "@/features/tel/tel-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("tel");

export default function TelPage() {
  return (
    <>
      <ToolJsonLd toolId="tel" />
      <TelTool />
    </>
  );
}
