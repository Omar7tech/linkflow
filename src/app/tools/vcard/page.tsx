import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { VCardTool } from "@/features/vcard/vcard-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("vcard");

export default function VCardPage() {
  return (
    <>
      <ToolJsonLd toolId="vcard" />
      <VCardTool />
    </>
  );
}
