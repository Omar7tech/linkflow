"use client";

import * as React from "react";
import { PipetteIcon, SearchIcon, ShieldCheckIcon, ShuffleIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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

/** "PANTONE 185 C" — the canonical Solid Coated display form. */
function fullName(code: string) {
  return `PANTONE ${code} C`;
}

export function PantoneTool() {
  const [hex, setHex] = React.useState("#10b981");
  // What's currently typed in the hex box — kept separate so invalid drafts
  // don't blow away the last valid color while the user is mid-edit.
  const [draft, setDraft] = React.useState("#10b981");
  const [query, setQuery] = React.useState("");

  const rgb = React.useMemo<RGB>(() => parseHex(hex) ?? [16, 185, 129], [hex]);
  const matches = React.useMemo(() => nearestPantone(rgb, 8), [rgb]);
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
      // Cancelled — nothing to do.
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
          <CardHeader>
            <CardTitle className="text-base">Closest Pantone colors</CardTitle>
            <CardDescription>
              Ranked by how different each ink looks to the human eye (ΔE 2000).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {best && <PantoneCard match={best} featured />}

            <div className="space-y-2">
              {matches.slice(1).map((m) => (
                <PantoneCard key={m.code} match={m} />
              ))}
            </div>

            <Separator />
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Matching runs entirely on-device. Screen colors only approximate physical Pantone
              standards — always confirm against a printed swatch book.
            </p>
          </CardContent>
        </Card>
      }
      footer={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Browse the Pantone library</CardTitle>
            <CardDescription>
              Click any chip to load it into the finder and discover its neighbours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-sm">
              <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by number or name — e.g. 185, Reflex Blue"
                className="pl-9"
                aria-label="Search Pantone colors"
              />
            </div>

            {results.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No Pantone color matches “{query}”.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {results.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => applyColor(c.hex)}
                    title={`${fullName(c.code)} · ${c.hex}`}
                    className="group border-border hover:border-foreground/30 overflow-hidden rounded-lg border text-left transition-colors"
                  >
                    <span className="block h-14 w-full" style={{ backgroundColor: c.hex }} />
                    <span className="block px-2.5 py-1.5">
                      <span className="block text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                        Pantone
                      </span>
                      <span className="block truncate text-sm font-medium">{c.code}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-5">
            {/* Large live preview doubling as the native color picker. */}
            <div className="relative">
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
                className="border-border flex h-40 cursor-pointer items-end justify-between rounded-xl border p-4"
                style={{ backgroundColor: hex, color: contrastText(rgb) }}
              >
                <span className="font-mono text-lg font-semibold uppercase">{hex}</span>
                <span className="text-xs opacity-80">Click to pick</span>
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pantone-hex">Color value</Label>
              <div className="flex gap-2">
                <Input
                  id="pantone-hex"
                  value={draft}
                  onChange={(e) => onHexInput(e.target.value)}
                  onBlur={() => setDraft(hex)}
                  placeholder="#10b981"
                  spellCheck={false}
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
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                ["RGB", rgbString(rgb)],
                ["HSL", hslString(rgb)],
                ["CMYK", cmykString(rgb)],
              ].map(([label, value]) => (
                <div key={label} className="bg-muted/50 rounded-lg px-2.5 py-2">
                  <div className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                    {label}
                  </div>
                  <div className="mt-0.5 font-mono leading-tight break-all">{value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
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
        featured ? "p-0.5" : "border-border border p-2"
      )}
    >
      <div
        className={cn(
          "flex shrink-0 flex-col justify-between rounded-md",
          featured ? "h-20 w-24 p-3" : "size-12"
        )}
        style={{ backgroundColor: match.hex, color: ink }}
      >
        {featured && (
          <>
            <span className="text-[10px] font-semibold tracking-widest uppercase opacity-90">
              Pantone
            </span>
            <span className="font-mono text-sm font-bold">{match.code}</span>
          </>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("truncate font-medium", featured ? "text-base" : "text-sm")}>
            {fullName(match.code)}
          </span>
          <Badge variant="secondary" className={cn("shrink-0 border-0", QUALITY_STYLES[quality.tone])}>
            {quality.label}
          </Badge>
        </div>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
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
