import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { FaviconTool } from "@/features/favicon/favicon-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("favicon");

export default function FaviconPage() {
  return (
    <>
      <ToolJsonLd toolId="favicon" />
      <FaviconTool />
    </>
  );
}
