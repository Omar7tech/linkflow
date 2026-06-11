import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { ReadtimeTool } from "@/features/readtime/readtime-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("readtime");

export default function ReadingTimePage() {
  return (
    <>
      <ToolJsonLd toolId="readtime" />
      <ReadtimeTool />
    </>
  );
}
