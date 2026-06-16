"use client";

import * as React from "react";
import { PipetteIcon, SearchIcon, ShieldCheckIcon, ShuffleIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  cmykString,
  contrastText,
  hslString,
  rgbString,
  rgbToHex,
  type RGB,
} from "@/lib/colorExtract";
import {
  matchQuality,
  nearestPantone,
  parseHex,
  searchPantone,
  type PantoneMatch,
} from "@/lib/pantone";
import { cn } from "@/lib/utils";

interface EyeDropperCtor {
  new (): { open: () => Promise<{ sRGBHex: string }> };
}

const QUALITY_STYLES: Record<ReturnType<typeof matchQuality>["tone"], string> = {
  exact: "bg-primary/15 text-primary",
  close: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  near: "bg-amber-500/15 text-amber-600 dark:text-amber-500",
  far: "bg-muted text-muted-foreground",
};

/** Cap on chips rendered at once — the full library is 1300+ inks. */
const BROWSE_LIMIT = 120;

/** "PANTONE 185 C" — the canonical Solid Coated display form. */
function fullName(code: string) {
  return `PANTONE ${code} C`;
}

export function PantoneTool() {
  const [hex, setHex] = React.useState("#10b981");
  // Separate from `hex` so a half-typed/invalid draft doesn't reset the color.
  const [draft, setDraft] = React.useState("#10b981");
  const [query, setQuery] = React.useState("");

  const rgb = React.useMemo<RGB>(() => parseHex(hex) ?? [16, 185, 129], [hex]);
  const matches = React.useMemo(() => nearestPantone(rgb, 7), [rgb]);
  const results = React.useMemo(() => searchPantone(query), [query]);

  const applyColor = React.useCallback((value: string) => {
    const parsed = parseHex(value);
    if (!parsed) return;
    const normalized = rgbToHex(parsed);
    setHex(normalized);
    setDraft(normalized);
  }, []);

  const onHexInput = (value: string) => {
    setDraft(value);
    if (parseHex(value)) applyColor(value);
  };

  const pickFromScreen = async () => {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Ctor) {
      toast.error("Your browser doesn't support the eyedropper (try Chrome or Edge)");
      return;
    }
    try {
      const { sRGBHex } = await new Ctor().open();
      applyColor(sRGBHex);
    } catch {
      // Cancelled.
    }
  };

  const randomColor = () => {
    const v = Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0");
    applyColor(`#${v}`);
  };

  const best = matches[0];

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.pantone}
      output={
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Closest Pantone colors</h2>
              <span className="text-muted-foreground text-[11px]">ranked by ΔE 2000</span>
            </div>

            {best && <PantoneCard match={best} featured />}

            <div className="space-y-1.5">
              {matches.slice(1).map((m) => (
                <PantoneCard key={m.code} match={m} />
              ))}
            </div>

            <p className="text-muted-foreground flex items-start gap-1.5 pt-1 text-[11px] leading-snug">
              <ShieldCheckIcon className="mt-px size-3 shrink-0" aria-hidden />
              All on-device. Screen colors only approximate physical Pantone standards — confirm
              against a printed swatch book.
            </p>
          </CardContent>
        </Card>
      }
    >
      <Card>
        <CardContent>
          <Tabs defaultValue="pick" className="gap-4">
            <TabsList className="w-full">
              <TabsTrigger value="pick" className="flex-1">
                Pick a color
              </TabsTrigger>
              <TabsTrigger value="browse" className="flex-1">
                Browse library
              </TabsTrigger>
            </TabsList>

            {/* ------------------------------- Pick ------------------------------- */}
            <TabsContent value="pick" className="flex min-h-[24rem] flex-col gap-4">
              {/* Full-width preview doubles as the native color picker. */}
              <input
                type="color"
                value={hex}
                onChange={(e) => applyColor(e.target.value)}
                aria-label="Pick a color"
                className="sr-only"
                id="pantone-color-input"
              />
              <label
                htmlFor="pantone-color-input"
                className="border-border flex flex-1 cursor-pointer flex-col items-start justify-between rounded-xl border p-4"
                style={{ backgroundColor: hex, color: contrastText(rgb) }}
              >
                <span className="text-[10px] font-medium tracking-wide uppercase opacity-80">
                  Click to pick
                </span>
                <span className="font-mono text-2xl font-semibold uppercase">{hex}</span>
              </label>

              <div className="flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => onHexInput(e.target.value)}
                  onBlur={() => setDraft(hex)}
                  placeholder="#10b981"
                  spellCheck={false}
                  aria-label="Color value"
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={pickFromScreen}
                  aria-label="Pick a color from screen"
                  title="Eyedropper — sample any pixel on screen"
                >
                  <PipetteIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={randomColor}
                  aria-label="Random color"
                  title="Random color"
                >
                  <ShuffleIcon />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  ["RGB", rgbString(rgb)],
                  ["HSL", hslString(rgb)],
                  ["CMYK", cmykString(rgb)],
                ].map(([label, value]) => (
                  <div key={label} className="bg-muted/50 rounded-lg px-2 py-1.5">
                    <div className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                      {label}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] leading-tight break-all">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ------------------------------ Browse ------------------------------ */}
            <TabsContent value="browse" className="min-h-[24rem] space-y-3">
              <div className="relative">
                <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search — e.g. 185, Reflex Blue, Cool Gray"
                  className="pl-9"
                  aria-label="Search Pantone colors"
                />
              </div>

              {results.length === 0 ? (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  No Pantone color matches “{query}”.
                </p>
              ) : (
                <div className="grid max-h-[19rem] grid-cols-3 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6">
                  {results.slice(0, BROWSE_LIMIT).map((c) => {
                    const isActive = c.hex.toLowerCase() === hex.toLowerCase();
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => applyColor(c.hex)}
                        title={`${fullName(c.code)} · ${c.hex}`}
                        className={cn(
                          "group overflow-hidden rounded-lg border text-left transition-colors",
                          isActive
                            ? "border-foreground ring-foreground/20 ring-2"
                            : "border-border hover:border-foreground/40"
                        )}
                      >
                        <span className="block h-10 w-full" style={{ backgroundColor: c.hex }} />
                        <span className="block truncate px-2 py-1 text-[11px] font-medium leading-tight">
                          {c.code}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-muted-foreground text-xs">
                {results.length > BROWSE_LIMIT
                  ? `Showing ${BROWSE_LIMIT} of ${results.length} inks — search to narrow down.`
                  : `${results.length} inks. Click any chip to load it into the finder.`}
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </GeneratorLayout>
  );
}

function PantoneCard({ match, featured = false }: { match: PantoneMatch; featured?: boolean }) {
  const quality = matchQuality(match.deltaE);
  const ink = contrastText(match.rgb);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg",
        featured ? "border-border border p-1.5" : "px-1"
      )}
    >
      <div
        className={cn(
          "flex shrink-0 flex-col justify-between rounded-md",
          featured ? "h-16 w-20 p-2.5" : "size-10"
        )}
        style={{ backgroundColor: match.hex, color: ink }}
      >
        {featured && (
          <>
            <span className="text-[9px] font-semibold tracking-widest uppercase opacity-90">
              Pantone
            </span>
            <span className="font-mono text-sm font-bold">{match.code}</span>
          </>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("truncate font-medium", featured ? "text-sm" : "text-[13px]")}>
            {fullName(match.code)}
          </span>
          <Badge
            variant="secondary"
            className={cn("shrink-0 border-0 px-1.5 py-0 text-[10px]", QUALITY_STYLES[quality.tone])}
          >
            {quality.label}
          </Badge>
        </div>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[11px]">
          <span className="font-mono uppercase">{match.hex}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">ΔE {match.deltaE.toFixed(1)}</span>
        </div>
      </div>

      <CopyButton
        text={fullName(match.code)}
        label=""
        variant="ghost"
        size="icon-sm"
        successMessage={`${fullName(match.code)} copied`}
        aria-label={`Copy ${fullName(match.code)}`}
        className="shrink-0"
      />
    </div>
  );
}
