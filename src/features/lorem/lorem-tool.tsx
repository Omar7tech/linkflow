"use client";

import * as React from "react";
import { DicesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  formatLorem,
  generateLorem,
  loremStats,
  type LoremFormat,
  type LoremUnit,
} from "@/lib/lorem";

const UNITS: { id: LoremUnit; label: string; min: number; max: number; presets: number[] }[] = [
  { id: "paragraphs", label: "Paragraphs", min: 1, max: 20, presets: [1, 3, 5, 10] },
  { id: "sentences", label: "Sentences", min: 1, max: 50, presets: [3, 5, 10, 25] },
  { id: "words", label: "Words", min: 5, max: 500, presets: [25, 50, 100, 250] },
];

const DEFAULT_COUNTS: Record<LoremUnit, number> = { paragraphs: 3, sentences: 5, words: 50 };

export function LoremTool() {
  const [unit, setUnit] = React.useState<LoremUnit>("paragraphs");
  const [counts, setCounts] = React.useState(DEFAULT_COUNTS);
  const [startWithClassic, setStartWithClassic] = React.useState(true);
  const [decorate, setDecorate] = React.useState(false);
  const [format, setFormat] = React.useState<LoremFormat>("plain");
  const [blocks, setBlocks] = React.useState<string[]>([]);

  const count = counts[unit];
  const unitMeta = UNITS.find((u) => u.id === unit)!;

  const generate = React.useCallback(
    () => generateLorem({ unit, count, startWithClassic }),
    [unit, count, startWithClassic]
  );

  // Deferred a microtask so randomness only runs client-side, after hydration,
  // without a synchronous setState inside the effect body.
  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setBlocks(generate());
    });
    return () => {
      cancelled = true;
    };
  }, [generate]);

  // Markup decoration is applied at format time, so toggling it re-dresses the
  // same text instead of generating new copy.
  const output = React.useMemo(
    () => (blocks.length > 0 ? formatLorem(blocks, format, decorate) : ""),
    [blocks, format, decorate]
  );
  const stats = loremStats(blocks);

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.lorem}
      output={
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle className="text-base">Your text</CardTitle>
            <CardDescription>
              {output
                ? `${stats.words.toLocaleString()} words · ${stats.characters.toLocaleString()} characters`
                : "Pick how much text you need."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={format} onValueChange={(v) => setFormat(v as LoremFormat)}>
              <TabsList className="w-full">
                <TabsTrigger value="plain">Plain</TabsTrigger>
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="markdown">Markdown</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="bg-muted/50 border-border max-h-96 min-h-24 overflow-auto rounded-lg border p-3">
              {output ? (
                <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">{output}</pre>
              ) : (
                <span className="text-muted-foreground text-xs">Generating…</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <CopyButton text={output} disabled={!output} successMessage="Text copied" />
              <Button type="button" variant="outline" disabled={!output} onClick={() => setBlocks(generate())}>
                <DicesIcon /> Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>
      }
    >
      <Card>
        <CardContent className="space-y-6">
          <Tabs value={unit} onValueChange={(v) => setUnit(v as LoremUnit)}>
            <TabsList className="w-full">
              {UNITS.map((u) => (
                <TabsTrigger key={u.id} value={u.id}>
                  {u.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{unitMeta.label}</Label>
              <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{count}</span>
            </div>
            <Slider
              value={[count]}
              min={unitMeta.min}
              max={unitMeta.max}
              step={1}
              onValueChange={([v]) => setCounts((prev) => ({ ...prev, [unit]: v }))}
              aria-label={`Number of ${unit}`}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {unitMeta.presets.map((preset) => (
                <Badge
                  key={preset}
                  asChild
                  variant={count === preset ? "default" : "outline"}
                  className="cursor-pointer"
                >
                  <button
                    type="button"
                    onClick={() => setCounts((prev) => ({ ...prev, [unit]: preset }))}
                  >
                    {preset}
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <label className="border-border hover:bg-muted/40 flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors">
            <span className="min-w-0">
              <span className="block text-sm font-medium">Start with the classic opening</span>
              <span className="text-muted-foreground block truncate text-xs">
                “Lorem ipsum dolor sit amet, consectetur adipiscing elit…”
              </span>
            </span>
            <Switch
              checked={startWithClassic}
              onCheckedChange={setStartWithClassic}
              aria-label="Start with the classic opening"
            />
          </label>

          <label className="border-border hover:bg-muted/40 flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors">
            <span className="min-w-0">
              <span className="block text-sm font-medium">Sprinkle inline markup</span>
              <span className="text-muted-foreground block text-xs">
                Adds bold, italic and links — great for testing rich-text styles.
                {format === "plain" && " Applies to the HTML and Markdown formats."}
              </span>
            </span>
            <Switch checked={decorate} onCheckedChange={setDecorate} aria-label="Sprinkle inline markup" />
          </label>
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}
