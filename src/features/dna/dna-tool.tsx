"use client";

import * as React from "react";
import { GlobeIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import { useCopy } from "@/hooks/useCopy";
import {
  dnaToCssVariables,
  dnaToJson,
  dnaToTailwind,
  type DesignDna,
} from "@/lib/design-dna";

const EXAMPLES = ["stripe.com", "linear.app", "vercel.com", "airbnb.com"];

const DAILY_LIMIT = 60;
const QUOTA_KEY = "forma:dna:uses";

/**
 * Soft daily quota kept in localStorage — a courtesy brake, not a security
 * boundary. Counts one lookup per call; if storage is unavailable, allow.
 */
function underDailyLimit(): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const stored = JSON.parse(localStorage.getItem(QUOTA_KEY) ?? "null") as {
      date?: string;
      count?: number;
    } | null;
    const count = stored?.date === today ? (stored.count ?? 0) : 0;
    if (count >= DAILY_LIMIT) return false;
    localStorage.setItem(QUOTA_KEY, JSON.stringify({ date: today, count: count + 1 }));
    return true;
  } catch {
    return true;
  }
}

/** Rough client-side check so token values that are colors get a swatch. */
function looksLikeColor(value: string): boolean {
  return /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\()/i.test(value.trim());
}

export function DnaTool() {
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [dna, setDna] = React.useState<DesignDna | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const inspect = async (target: string) => {
    const trimmed = target.trim();
    if (!trimmed) return;
    if (!underDailyLimit()) {
      toast.error(`Daily limit reached (${DAILY_LIMIT} lookups) — come back tomorrow.`);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch("/api/design-dna", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
        signal: controller.signal,
      });
      const data = (await res.json()) as DesignDna & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't inspect that site.");
        return;
      }
      setDna(data);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error("Network hiccup — try again.");
      }
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  return (
    <GeneratorLayout tool={TOOL_BY_ID.dna} output={null}>
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void inspect(url);
              }}
            >
              <div className="relative flex-1">
                <GlobeIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="stripe.com or https://any-site.com"
                  className="pl-9"
                  autoFocus
                  spellCheck={false}
                  aria-label="Website URL"
                />
              </div>
              <Button type="submit" disabled={loading || !url.trim()}>
                {loading ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
                Extract
              </Button>
            </form>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">Try:</span>
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="border-border hover:bg-muted rounded-full border px-3 py-1 font-mono text-xs transition-colors"
                  onClick={() => {
                    setUrl(example);
                    void inspect(example);
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading && <LoadingSkeleton />}
        {!loading && dna && <Results dna={dna} />}
        {!loading && !dna && (
          <p className="text-muted-foreground px-1 text-sm">
            Enter any public website and get its palette, fonts, type scale, spacing, shadows,
            radii and design tokens — ready to copy into your own project.
          </p>
        )}
      </div>
    </GeneratorLayout>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      {[112, 220, 180].map((h, i) => (
        <div key={i} className="border-border bg-muted/40 animate-pulse rounded-xl border" style={{ height: h }} />
      ))}
    </div>
  );
}

function Results({ dna }: { dna: DesignDna }) {
  const { copy } = useCopy();

  const exports = [
    { id: "css", name: "CSS variables", code: dnaToCssVariables(dna) },
    { id: "tailwind", name: "Tailwind", code: dnaToTailwind(dna) },
    { id: "json", name: "JSON", code: dnaToJson(dna) },
  ];

  return (
    <div className="space-y-6">
      {/* Site identity */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          {dna.site.faviconUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- remote favicon, unknown host
            <img
              src={dna.site.faviconUrl}
              alt=""
              className="border-border size-10 rounded-lg border object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{dna.site.title ?? dna.site.url}</p>
            {dna.site.description && (
              <p className="text-muted-foreground line-clamp-2 text-sm">{dna.site.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {dna.site.themeColor && (
              <Badge variant="outline" className="gap-1.5 font-mono text-xs">
                <span
                  className="size-3 rounded-full border"
                  style={{ backgroundColor: dna.site.themeColor }}
                />
                theme {dna.site.themeColor}
              </Badge>
            )}
            <Badge variant="outline" className="font-mono text-xs">
              {dna.stats.cssKb} KB CSS · {dna.stats.stylesheets} sheets
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      {dna.colors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Color palette</CardTitle>
            <CardDescription>Ranked by how often the site uses each color — click to copy.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {dna.colors.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => void copy(c.hex, `${c.hex} copied`)}
                  className="group text-left"
                  title={`${c.hex} — used ${c.count}×`}
                >
                  <span
                    className="border-border block aspect-square w-full rounded-lg border transition-transform group-hover:scale-105"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="text-muted-foreground mt-1 block truncate font-mono text-[10px]">
                    {c.hex}
                  </span>
                </button>
              ))}
            </div>
            {dna.gradients.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-muted-foreground text-xs font-medium">Gradients</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {dna.gradients.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => void copy(g.value, "Gradient copied")}
                      className="border-border h-10 rounded-lg border"
                      style={{ backgroundImage: g.value }}
                      title={g.value}
                      aria-label="Copy gradient CSS"
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Typography */}
      {(dna.fonts.length > 0 || dna.fontSizes.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Typography</CardTitle>
            <CardDescription>
              Font stacks, weights and the type scale as declared in the CSS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {dna.fonts.map((f) => (
              <div key={f.family} className="border-border flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-lg" style={{ fontFamily: f.stack }}>
                    {f.family}
                  </p>
                  <p className="text-muted-foreground truncate font-mono text-xs">{f.stack}</p>
                </div>
                <CopyButton text={f.stack} label="" variant="ghost" size="icon-sm" aria-label={`Copy ${f.family} stack`} />
              </div>
            ))}
            {dna.fontWeights.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dna.fontWeights.map((w) => (
                  <Badge key={w.value} variant="outline" className="font-mono text-xs" style={{ fontWeight: w.value }}>
                    {w.value}
                  </Badge>
                ))}
              </div>
            )}
            {dna.fontSizes.length > 0 && (
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                {dna.fontSizes.map((s) => (
                  <div key={s.value} className="text-center">
                    <span className="block leading-none" style={{ fontSize: Math.min(s.value, 42) }}>
                      Ag
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">{s.value}px</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shape & depth */}
      {(dna.radii.length > 0 || dna.shadows.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Corners &amp; shadows</CardTitle>
            <CardDescription>Click any sample to copy its CSS value.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {dna.radii.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {dna.radii.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => void copy(r.value, "Radius copied")}
                    className="text-center"
                    title={r.value}
                  >
                    <span
                      className="border-border bg-muted block size-14 border-2"
                      style={{ borderRadius: r.value }}
                    />
                    <span className="text-muted-foreground mt-1 block max-w-14 truncate font-mono text-[10px]">
                      {r.value}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {dna.shadows.length > 0 && (
              <div className="grid gap-4 rounded-xl bg-white p-5 sm:grid-cols-3 dark:bg-zinc-100">
                {dna.shadows.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => void copy(s.value, "Shadow copied")}
                    className="flex h-20 items-center justify-center rounded-lg bg-white font-mono text-[10px] text-zinc-500"
                    style={{ boxShadow: s.value }}
                    title={s.value}
                  >
                    box-shadow
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Spacing */}
      {dna.spacing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spacing scale</CardTitle>
            <CardDescription>The most-used margin, padding and gap steps.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              {dna.spacing.map((s) => (
                <div key={s.value} className="text-center">
                  <span
                    className="bg-primary/70 mx-auto block w-4 rounded-sm"
                    style={{ height: Math.min(s.value, 96) }}
                  />
                  <span className="text-muted-foreground mt-1 block font-mono text-[10px]">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tokens */}
      {dna.tokens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Design tokens</CardTitle>
            <CardDescription>
              CSS custom properties the site defines — its design system, verbatim.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-border max-h-80 overflow-auto rounded-lg border">
              <table className="w-full text-left font-mono text-xs">
                <tbody>
                  {dna.tokens.map((t) => (
                    <tr key={t.name} className="border-border border-b last:border-0">
                      <td className="text-muted-foreground px-3 py-1.5 whitespace-nowrap">--{t.name}</td>
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-2">
                          {looksLikeColor(t.value) && (
                            <span
                              className="border-border size-3 shrink-0 rounded-full border"
                              style={{ backgroundColor: t.value }}
                            />
                          )}
                          <span className="break-all">{t.value}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export</CardTitle>
          <CardDescription>Take the extracted system straight into your codebase.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="css">
            <TabsList className="w-full">
              {exports.map((e) => (
                <TabsTrigger key={e.id} value={e.id} className="flex-1">
                  {e.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {exports.map((e) => (
              <TabsContent key={e.id} value={e.id}>
                <div className="relative">
                  <pre className="bg-muted/50 border-border max-h-72 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed">
                    {e.code}
                  </pre>
                  <CopyButton
                    text={e.code}
                    label=""
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1.5 right-1.5"
                    successMessage={`${e.name} copied`}
                    aria-label={`Copy ${e.name}`}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
