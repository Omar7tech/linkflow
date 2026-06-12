import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { ShareTool } from "@/features/share/share-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("share");

export default function SharePage() {
  return (
    <>
      <ToolJsonLd toolId="share" />
      <ShareTool />
    </>
  );
}
