import { SITE } from "@/constants/site";
import { TOOL_BY_ID } from "@/constants/tools";
import type { ToolId } from "@/types";
import { JsonLd, webAppJsonLd } from "./json-ld";

export function ToolJsonLd({ toolId }: { toolId: ToolId }) {
  const tool = TOOL_BY_ID[toolId];
  return (
    <JsonLd
      data={webAppJsonLd({
        name: tool.name,
        description: tool.description,
        url: `${SITE.url}${tool.slug}`,
      })}
    />
  );
}
