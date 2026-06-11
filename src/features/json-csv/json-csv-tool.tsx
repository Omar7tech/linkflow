"use client";

import * as React from "react";
import { z } from "zod";
import { DownloadIcon, FileJsonIcon, TableIcon, CopyIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useGenerator } from "@/hooks/useGenerator";
import { useHistory } from "@/hooks/useHistory";
import { flattenObject, jsonToCsv } from "@/lib/json-csv";
import { useCopy } from "@/hooks/useCopy";
import { toast } from "sonner";

const jsonSchema = z.object({
  json: z.string().refine((val) => {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) || (typeof parsed === "object" && parsed !== null);
    } catch {
      return false;
    }
  }, "Invalid JSON format. Must be an object or an array of objects."),
});

type JsonValues = z.infer<typeof jsonSchema>;

const DEFAULT_JSON = JSON.stringify(
  [
    {
      id: 1,
      name: "Omar",
      role: "Developer",
      contact: {
        email: "omar@example.com",
        city: "Beirut"
      }
    },
    {
      id: 2,
      name: "Sara",
      role: "Designer",
      contact: {
        email: "sara@example.com",
        city: "Dubai"
      }
    }
  ],
  null,
  2
);

export function JsonCsvTool() {
  const history = useHistory("jsoncsv");
  const { copy } = useCopy();

  const generator = useGenerator<JsonValues>({
    toolId: "jsoncsv",
    schema: jsonSchema,
    defaultValues: { json: DEFAULT_JSON },
    build: (v) => {
      try {
        const parsed = JSON.parse(v.json);
        const data = Array.isArray(parsed) ? parsed : [parsed];
        return jsonToCsv(data);
      } catch {
        return "";
      }
    },
    historyLabel: (v) => {
      try {
        const parsed = JSON.parse(v.json);
        const count = Array.isArray(parsed) ? parsed.length : 1;
        return `Converted ${count} records to CSV`;
      } catch {
        return "JSON to CSV conversion";
      }
    },
    history,
  });

  const previewData = React.useMemo(() => {
    try {
      const parsed = JSON.parse(generator.values.json);
      const data = Array.isArray(parsed) ? parsed : [parsed];
      return data.slice(0, 5).map(item => flattenObject(item));
    } catch {
      return [];
    }
  }, [generator.values.json]);

  const headers = React.useMemo(() => {
    if (previewData.length === 0) return [];
    return Array.from(new Set(previewData.flatMap(item => Object.keys(item))));
  }, [previewData]);

  const handleDownload = () => {
    if (!generator.output) return;
    const blob = new Blob([generator.output], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "converted-data.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    generator.commit();
    toast.success("CSV file downloaded");
  };

  const handleCopy = () => {
    if (generator.output) {
      copy(generator.output);
      generator.commit();
    }
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.jsoncsv}
      output={null} // We are moving everything to the main column
      footer={<HistoryPanel history={history} />}
    >
      <div className="space-y-8">
        {/* Input Card */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <FileJsonIcon className="size-4 text-primary" />
              JSON Input
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => generator.form.setValue("json", "")}
              className="h-8 text-[11px] font-bold tracking-tight text-muted-foreground hover:text-destructive"
            >
              <Trash2Icon className="mr-1.5 size-3.5" />
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <Field
              label=""
              htmlFor="json-input"
              error={generator.form.formState.errors.json?.message}
              hint="Supports objects or arrays of objects. Nested fields will be automatically flattened."
            >
              <Textarea
                id="json-input"
                rows={16}
                className="font-mono text-xs leading-relaxed resize-none border-border/40 focus-visible:ring-primary/20"
                placeholder='[{"id": 1, "name": "Omar"}]'
                {...generator.form.register("json")}
              />
            </Field>
          </CardContent>
        </Card>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleDownload}
              disabled={!generator.output}
              className="h-10 rounded-xl px-6 text-sm font-bold tracking-tight shadow-lg shadow-primary/5 transition-all hover:-translate-y-0.5"
            >
              <DownloadIcon className="mr-2 size-4" />
              Download CSV
            </Button>
            <Button 
              variant="secondary"
              onClick={handleCopy}
              disabled={!generator.output}
              className="h-10 rounded-xl px-6 text-sm font-bold tracking-tight transition-all hover:bg-secondary/80"
            >
              <CopyIcon className="mr-2 size-4" />
              Copy to Clipboard
            </Button>
          </div>
          <p className="text-muted-foreground/40 font-mono text-[10px] font-bold tracking-widest uppercase">
            {headers.length} Columns detected
          </p>
        </div>

        {/* Preview Table */}
        {previewData.length > 0 && (
          <Card className="overflow-hidden border-border/40 shadow-sm">
            <CardHeader className="bg-muted/30 border-b border-border/40 py-3 px-6">
              <CardTitle className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <TableIcon className="size-3.5" />
                Live Preview (First 5 Rows)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/10">
                      {headers.map(h => (
                        <th key={h} className="px-6 py-3 font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/5 transition-colors">
                        {headers.map(h => (
                          <td key={h} className="px-6 py-3 font-mono text-xs truncate max-w-[250px]">{String(row[h] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </GeneratorLayout>
  );
}
