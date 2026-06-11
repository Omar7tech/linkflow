import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { UtmTool } from "@/features/utm/utm-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("utm");

export default function UtmPage() {
  return (
    <>
      <ToolJsonLd toolId="utm" />
      <UtmTool />
    </>
  );
}
