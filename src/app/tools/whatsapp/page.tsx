import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { WhatsAppTool } from "@/features/whatsapp/whatsapp-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("whatsapp");

export default function WhatsAppPage() {
  return (
    <>
      <ToolJsonLd toolId="whatsapp" />
      <WhatsAppTool />
    </>
  );
}
