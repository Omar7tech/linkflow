"use client";

import * as React from "react";
import {
  LockIcon,
  LockOpenIcon,
  MinusIcon,
  PlusIcon,
  ShuffleIcon,
  SwatchBookIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useCopy } from "@/hooks/useCopy";
import { useHistory } from "@/hooks/useHistory";
import {
  colorName,
  contrastText,
  exportPalette,
  formatColor,
  type ColorFormat,
  type ExportFormat,
  type Swatch,
} from "@/lib/colorExtract";
import {
  HARMONY_MODES,
  generatePalette,
  hslToRgb,
  paletteHex,
  withHex,
  type HarmonyMode,
  type PaletteColor,
} from "@/lib/palette";
import { cn } from "@/lib/utils";

const EXPORT_FORMATS: { id: ExportFormat; name: string }[] = [
  { id: "css", name: "CSS" },
  { id: "scss", name: "SCSS" },
  { id: "json", name: "JSON" },
  { id: "tailwind", name: "Tailwind" },
];

export function PaletteTool() {
  const history = useHistory("palette");
  const { copy } = useCopy();
  const [mode, setMode] = React.useState<HarmonyMode>("auto");
  const [count, setCount] = React.useState(5);
  const [format, setFormat] = React.useState<ColorFormat>("hex");
  const [colors, setColors] = React.useState<PaletteColor[]>(() => generatePalette(5, "auto"));

  const shuffle = React.useCallback(() => {
    setColors((prev) => generatePalette(count, mode, prev));
  }, [count, mode]);

  const applyBase = (hex: string) => {
    setColors((prev) => generatePalette(count, mode, prev, hex));
  };

  const setCountAndRegen = (n: number) => {
    const next = Math.min(Math.max(n, 3), 8);
    setCount(next);
    setColors((prev) => generatePalette(next, mode, prev));
  };

  const toggleLock = (id: string) =>
    setColors((prev) => prev.map((c) => (c.id === id ? { ...c, locked: !c.locked } : c)));

  const editColor = (id: string, hex: string) =>
    setColors((prev) => prev.map((c) => (c.id === id ? withHex(c, hex) : c)));

  // Spacebar shuffles, coolors-style — locked swatches stay put.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(el.tagName)) return;
      e.preventDefault();
      shuffle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shuffle]);

  const swatches: Swatch[] = colors.map((c) => {
    const rgb = hslToRgb(c.h, c.s, c.l);
    return { rgb, hex: paletteHex(c), population: 0 };
  });

  const commit = () =>
    history.add(
      `${HARMONY_MODES.find((m) => m.id === mode)?.name ?? mode} · ${colors.length} colors`,
      swatches.map((s) => s.hex).join(" ")
    );

  const modeMeta = HARMONY_MODES.find((m) => m.id === mode);

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.palette}
      output={null}
      footer={<HistoryPanel history={history} />}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SwatchBookIcon className="text-primary size-4" />
              Palette
            </CardTitle>
            <CardDescription>
              Click a color to copy it. Lock the ones you love, then press{" "}
              <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">Space</kbd> to
              shuffle the rest.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-auto flex-col overflow-hidden rounded-xl border sm:h-72 sm:flex-row">
              {colors.map((color, i) => {
                const swatch = swatches[i];
                const text = contrastText(swatch.rgb);
                const label = formatColor(swatch.rgb, format);
                return (
                  <div
                    key={color.id}
                    className="group relative flex h-20 flex-1 cursor-pointer items-end transition-[flex-grow] duration-200 hover:flex-[1.35] sm:h-auto"
                    style={{ backgroundColor: swatch.hex, color: text }}
                    onClick={() => copy(label, `${label} copied`)}
                    role="button"
                    aria-label={`Copy ${label}`}
                  >
                    <div className="w-full p-3">
                      <p className="font-mono text-xs font-bold tracking-tight uppercase">
                        {label}
                      </p>
                      <p className="text-[11px] opacity-70">{colorName(swatch.rgb)}</p>
                    </div>
                    <div
                      className={cn(
                        "absolute top-2 right-2 flex items-center gap-1 transition-opacity",
                        color.locked ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}
                    >
                      <Input
                        type="color"
                        value={swatch.hex}
                        onChange={(e) => editColor(color.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="size-7 cursor-pointer border-0 bg-transparent p-0.5"
                        aria-label="Edit color"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLock(color.id);
                        }}
                        className="flex size-7 items-center justify-center rounded-md bg-black/20 backdrop-blur-sm"
                        style={{ color: text }}
                        aria-label={color.locked ? "Unlock color" : "Lock color"}
                        title={color.locked ? "Unlock" : "Lock"}
                      >
                        {color.locked ? (
                          <LockIcon className="size-3.5" />
                        ) : (
                          <LockOpenIcon className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <Button onClick={shuffle} className="font-bold">
                <ShuffleIcon className="size-4" /> Shuffle
              </Button>

              <div className="space-y-2">
                <Label>Harmony</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as HarmonyMode)}>
                  <SelectTrigger className="w-48" aria-label="Harmony mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HARMONY_MODES.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Colors</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setCountAndRegen(count - 1)}
                    disabled={count <= 3}
                    aria-label="Fewer colors"
                  >
                    <MinusIcon className="size-3.5" />
                  </Button>
                  <span className="w-6 text-center font-mono text-sm font-bold">{count}</span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setCountAndRegen(count + 1)}
                    disabled={count >= 8}
                    aria-label="More colors"
                  >
                    <PlusIcon className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="palette-base">Start from a color</Label>
                <Input
                  id="palette-base"
                  type="color"
                  defaultValue="#6366f1"
                  onChange={(e) => applyBase(e.target.value)}
                  className="h-9 w-14 cursor-pointer p-1"
                />
              </div>

              <div className="space-y-2">
                <Label>Value format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as ColorFormat)}>
                  <SelectTrigger className="w-24" aria-label="Color format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hex">HEX</SelectItem>
                    <SelectItem value="rgb">RGB</SelectItem>
                    <SelectItem value="hsl">HSL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {modeMeta && modeMeta.id !== "auto" && (
              <p className="text-muted-foreground text-xs">{modeMeta.hint}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export</CardTitle>
            <CardDescription>Variables for your stack — copying saves to history.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="css" className="w-full">
              <TabsList className="w-full">
                {EXPORT_FORMATS.map((f) => (
                  <TabsTrigger key={f.id} value={f.id} className="flex-1">
                    {f.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {EXPORT_FORMATS.map((f) => {
                const code = exportPalette(swatches, f.id);
                return (
                  <TabsContent key={f.id} value={f.id}>
                    <div className="relative">
                      <pre className="bg-muted/50 border-border max-h-72 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre">
                        {code}
                      </pre>
                      <CopyButton
                        text={code}
                        label=""
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1.5 right-1.5"
                        successMessage={`${f.name} copied`}
                        onCopied={commit}
                        aria-label={`Copy ${f.name}`}
                      />
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}
