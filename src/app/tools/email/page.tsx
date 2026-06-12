import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { EmailTool } from "@/features/email/email-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("email");

export default function EmailPage() {
  return (
    <>
      <ToolJsonLd toolId="email" />
      <EmailTool />
    </>
  );
}
