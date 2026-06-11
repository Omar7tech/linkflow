import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { HashTool } from "@/features/hash/hash-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("hash");

export default function HashPage() {
  return (
    <>
      <ToolJsonLd toolId="hash" />
      <HashTool />
    </>
  );
}
