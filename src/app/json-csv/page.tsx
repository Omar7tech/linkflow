import type { Metadata } from "next";
import { JsonLd, webAppJsonLd } from "@/components/shared/json-ld";
import { JsonCsvTool } from "@/features/json-csv/json-csv-tool";
import { TOOL_BY_ID } from "@/constants/tools";
import { SITE } from "@/constants/site";

const tool = TOOL_BY_ID.jsoncsv;

export const metadata: Metadata = {
  title: `${tool.name} — ${SITE.name}`,
  description: tool.description,
  keywords: tool.keywords,
};

export default function JsonCsvPage() {
  return (
    <>
      <JsonLd
        data={webAppJsonLd({
          name: tool.name,
          description: tool.description,
          url: `${SITE.url}${tool.slug}`,
        })}
      />
      <JsonCsvTool />
    </>
  );
}
