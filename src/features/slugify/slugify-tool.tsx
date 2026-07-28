"use client";

import * as React from "react";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/shared/copy-button";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  DEFAULT_SLUG_OPTIONS,
  checkSlug,
  encodedSlug,
  slugify,
  slugifyList,
  type SlugCase,
  type SlugOptions,
  type SlugSeparator,
} from "@/lib/slugify";

const SEPARATORS: { id: SlugSeparator; label: string }[] = [
  { id: "-", label: "Hyphen" },
  { id: "_", label: "Under" },
  { id: ".", label: "Dot" },
  { id: "", label: "None" },
];

const CASES: { id: SlugCase; label: string }[] = [
  { id: "lower", label: "lower" },
  { id: "title", label: "Title" },
  { id: "upper", label: "UPPER" },
  { id: "preserve", label: "As typed" },
];

const PRESETS: { label: string; hint: string; values: SlugOptions }[] = [
  {
    label: "URL slug",
    hint: "Lowercase words joined by hyphens — the web standard.",
    values: { ...DEFAULT_SLUG_OPTIONS },
  },
  {
    label: "SEO short",
    hint: "Filler words dropped and capped at 50 characters.",
    values: { ...DEFAULT_SLUG_OPTIONS, stripStopWords: true, maxLength: 50 },
  },
  {
    label: "Filename",
    hint: "Underscores, safe on every filesystem.",
    values: { ...DEFAULT_SLUG_OPTIONS, separator: "_" },
  },
  {
    label: "CONSTANT",
    hint: "Uppercase with underscores — env vars and enum keys.",
    values: { ...DEFAULT_SLUG_OPTIONS, separator: "_", casing: "upper" },
  },
];

const SAMPLE = "Crème Brûlée & Café — 10 Recipes You'll Love (2026 Edition)";

export function SlugifyTool() {
  const [text, setText] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [options, setOptions] = React.useState<SlugOptions>(DEFAULT_SLUG_OPTIONS);

  const set = <K extends keyof SlugOptions>(key: K, value: SlugOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const lines = React.useMemo(
    () => text.split("\n").map((l) => l.trim()).filter(Boolean),
    [text]
  );
  const isBatch = lines.length > 1;

  const slug = React.useMemo(() => slugify(lines[0] ?? "", options), [lines, options]);
  const batch = React.useMemo(
    () => (isBatch ? slugifyList(lines, options) : []),
    [isBatch, lines, options]
  );
  const checks = React.useMemo(() => checkSlug(slug), [slug]);
  const encoded = encodedSlug(slug);

  const base = baseUrl.trim().replace(/\/+$/, "");
  const fullUrl = slug && base ? `${base}/${slug}` : "";

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.slugify}
      output={
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle className="text-base">Your slug</CardTitle>
            <CardDescription>
              {slug
                ? `${slug.length} character${slug.length === 1 ? "" : "s"}${
                    isBatch ? ` · ${batch.length} slugs below` : ""
                  }`
                : "Type a title and the slug appears as you go."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 border-border min-h-12 rounded-lg border p-3">
              {slug ? (
                <code className="block font-mono text-sm break-all">{slug}</code>
              ) : (
                <span className="text-muted-foreground text-xs">
                  {lines.length > 0
                    ? "No ASCII letters left — turn on “Keep Unicode letters” to keep this script."
                    : "Waiting for input…"}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <CopyButton text={slug} disabled={!slug} successMessage="Slug copied" />
              {fullUrl && (
                <CopyButton
                  text={fullUrl}
                  label="Copy URL"
                  variant="outline"
                  successMessage="Full URL copied"
                />
              )}
              {isBatch && (
                <CopyButton
                  text={batch.map((row) => row.slug).join("\n")}
                  label={`Copy ${batch.length} slugs`}
                  variant="outline"
                  successMessage="All slugs copied"
                />
              )}
            </div>

            {fullUrl && (
              <p className="text-muted-foreground font-mono text-xs break-all">{fullUrl}</p>
            )}

            {encoded && (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">Percent-encoded</p>
                <code className="text-muted-foreground block font-mono text-xs break-all">
                  {encoded}
                </code>
              </div>
            )}

            {checks.length > 0 && (
              <>
                <Separator />
                <ul className="space-y-2">
                  {checks.map((check) => (
                    <li key={check.id} className="flex gap-2 text-xs">
                      {check.ok ? (
                        <CircleCheckIcon
                          className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden
                        />
                      ) : (
                        <CircleAlertIcon
                          className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                          aria-hidden
                        />
                      )}
                      <span>
                        <span className="font-medium">{check.label}</span>{" "}
                        <span className="text-muted-foreground">— {check.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      }
      footer={
        isBatch ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Batch results</CardTitle>
              <CardDescription>
                One slug per line, with repeats numbered the way a CMS does.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-border divide-y">
                {batch.map((row, i) => (
                  <li
                    key={`${row.slug}-${i}`}
                    className="flex flex-col gap-1 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  >
                    <span className="text-muted-foreground min-w-0 truncate text-xs">
                      {row.source}
                    </span>
                    <code className="font-mono text-xs break-all sm:text-right">
                      {row.slug || "—"}
                    </code>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : undefined
      }
    >
      <Card>
        <CardContent className="space-y-6">
          <Field
            label="Title or text"
            htmlFor="slug-text"
            hint="Paste one title, or one per line to slugify a whole list at once."
          >
            <Textarea
              id="slug-text"
              rows={4}
              placeholder={SAMPLE}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => {
              const active =
                JSON.stringify(preset.values) === JSON.stringify(options);
              return (
                <Badge
                  key={preset.label}
                  asChild
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer"
                >
                  <button
                    type="button"
                    title={preset.hint}
                    onClick={() => setOptions(preset.values)}
                  >
                    {preset.label}
                  </button>
                </Badge>
              );
            })}
            {!text && (
              <Badge asChild variant="secondary" className="cursor-pointer">
                <button type="button" onClick={() => setText(SAMPLE)}>
                  Try an example
                </button>
              </Badge>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Word separator</Label>
            <Tabs
              value={options.separator === "" ? "none" : options.separator}
              onValueChange={(v) => set("separator", (v === "none" ? "" : v) as SlugSeparator)}
            >
              <TabsList className="w-full">
                {SEPARATORS.map((s) => (
                  <TabsTrigger key={s.label} value={s.id === "" ? "none" : s.id}>
                    {s.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label>Letter case</Label>
            <Tabs value={options.casing} onValueChange={(v) => set("casing", v as SlugCase)}>
              <TabsList className="w-full">
                {CASES.map((c) => (
                  <TabsTrigger key={c.id} value={c.id}>
                    {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <Separator />

          <div className="space-y-3">
            {(
              [
                [
                  "expandSymbols",
                  "Spell out symbols",
                  "& becomes and, @ becomes at, $ becomes usd.",
                ],
                [
                  "stripStopWords",
                  "Drop filler words",
                  "Removes the, and, of… unless that would empty the slug.",
                ],
                [
                  "unicode",
                  "Keep Unicode letters",
                  "Leaves é, ß and 日本語 intact instead of folding them to ASCII.",
                ],
              ] as const
            ).map(([key, label, hint]) => (
              <div key={key} className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor={`slug-${key}`}>{label}</Label>
                  <p className="text-muted-foreground text-xs">{hint}</p>
                </div>
                <Switch
                  id={`slug-${key}`}
                  checked={options[key]}
                  onCheckedChange={(v) => set(key, v)}
                />
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Maximum length</Label>
              <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">
                {options.maxLength === 0 ? "no limit" : `${options.maxLength} chars`}
              </span>
            </div>
            <Slider
              value={[options.maxLength]}
              min={0}
              max={100}
              step={5}
              onValueChange={([v]) => set("maxLength", v)}
              aria-label="Maximum slug length in characters"
            />
            <p className="text-muted-foreground text-xs">
              Cuts on a word boundary, never mid-word. Slide to 0 to turn the cap off.
            </p>
          </div>

          <Field
            label="Base URL"
            htmlFor="slug-base"
            optional
            hint="Preview the finished address, e.g. https://example.com/blog."
          >
            <Input
              id="slug-base"
              type="url"
              inputMode="url"
              placeholder="https://example.com/blog"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}
