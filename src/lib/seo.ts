import type { Metadata } from "next";
import { SITE } from "@/constants/site";
import { TOOL_BY_ID } from "@/constants/tools";
import type { ToolId } from "@/types";

export function toolMetadata(toolId: ToolId): Metadata {
  const tool = TOOL_BY_ID[toolId];
  const title = tool.name;
  const description = tool.description;
  const url = `${SITE.url}${tool.slug}`;

  return {
    title,
    description,
    keywords: [...tool.keywords],
    alternates: { canonical: url },
    openGraph: {
      title: `${title} · ${SITE.name}`,
      description,
      url,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE.name}`, description },
  };
}
