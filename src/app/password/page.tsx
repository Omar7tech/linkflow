import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { PasswordTool } from "@/features/password/password-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("password");

export default function PasswordPage() {
  return (
    <>
      <ToolJsonLd toolId="password" />
      <PasswordTool />
    </>
  );
}
