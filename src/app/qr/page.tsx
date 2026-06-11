import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { QrTool } from "@/features/qr/qr-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("qr");

export default function QrPage() {
  return (
    <>
      <ToolJsonLd toolId="qr" />
      <QrTool />
    </>
  );
}
