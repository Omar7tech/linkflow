import { ToolJsonLd } from "@/components/shared/tool-jsonld";
import { JsonCsvTool } from "@/features/json-csv/json-csv-tool";
import { toolMetadata } from "@/lib/seo";

export const metadata = toolMetadata("jsoncsv");

export default function JsonCsvPage() {
  return (
    <>
      <ToolJsonLd toolId="jsoncsv" />
      <JsonCsvTool />
    </>
  );
}
