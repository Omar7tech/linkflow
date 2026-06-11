import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { SmsTool } from "@/features/sms/sms-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("sms");

export default function SmsPage() {
  return (
    <>
      <ToolJsonLd toolId="sms" />
      <SmsTool />
    </>
  );
}
