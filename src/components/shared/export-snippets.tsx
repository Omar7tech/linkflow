"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { htmlSnippet, markdownSnippet, reactSnippet } from "@/lib/snippets";
import { CopyButton } from "./copy-button";

interface ExportSnippetsProps {
  href: string;
  label: string;
}

export function ExportSnippets({ href, label }: ExportSnippetsProps) {
  const snippets = [
    { id: "html", name: "HTML", code: htmlSnippet({ href, label }) },
    { id: "react", name: "React", code: reactSnippet({ href, label }) },
    { id: "markdown", name: "Markdown", code: markdownSnippet({ href, label }) },
  ];

  return (
    <Tabs defaultValue="html" className="w-full">
      <TabsList className="w-full">
        {snippets.map((s) => (
          <TabsTrigger key={s.id} value={s.id} className="flex-1">
            {s.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {snippets.map((s) => (
        <TabsContent key={s.id} value={s.id}>
          <div className="relative">
            <pre className="bg-muted/50 border-border max-h-48 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
              {s.code}
            </pre>
            <CopyButton
              text={s.code}
              label=""
              variant="ghost"
              size="icon-sm"
              className="absolute top-1.5 right-1.5"
              successMessage={`${s.name} snippet copied`}
              aria-label={`Copy ${s.name} snippet`}
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
