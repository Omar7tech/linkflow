"use client";

import * as React from "react";
import { CheckIcon, CopyIcon, ImageIcon, PipetteIcon, ShieldCheckIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  contrastText,
  exportPalette,
  extractPalette,
  formatColor,
  hue,
  type ColorFormat,
  type ExportFormat,
  type RGB,
  type Swatch,
} from "@/lib/colorExtract";

type SortMode = "population" | "hue";
const EXPORTS: { id: ExportFormat; label: string }[] = [
  { id: "css", label: "CSS" },
  { id: "scss", label: "SCSS" },
  { id: "json", label: "JSON" },
  { id: "tailwind", label: "Tailwind" },
];

const MAX_SAMPLE = 200; // longest edge sampled, in pixels

interface EyeDropperCtor {
  new (): { open: () => Promise<{ sRGBHex: string }> };
}

function hexToRgb(hex: string): RGB {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export function ColorsTool() {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [imageName, setImageName] = React.useState("");
  const [swatches, setSwatches] = React.useState<Swatch[]>([]);
  const [count, setCount] = React.useState(8);
  const [format, setFormat] = React.useState<ColorFormat>("hex");
  const [sort, setSort] = React.useState<SortMode>("population");
  const [picked, setPicked] = React.useState<RGB[]>([]);
  const [copied, setCopied] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Hold the decoded image so re-extraction on count change skips re-decoding.
  const imageRef = React.useRef<HTMLImageElement | null>(null);

  const runExtract = React.useCallback((img: HTMLImageElement, colorCount: number) => {
    const scale = Math.min(1, MAX_SAMPLE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    setSwatches(extractPalette(data, colorCount));
  }, []);

  const loadFile = React.useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Pick an image file");
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setImageName(file.name);
        runExtract(img, count);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error("Couldn't read that image");
      };
      img.src = url;
    },
    [count, runExtract]
  );

  React.useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // Re-quantize when the requested color count changes. Deferred a microtask so
  // the heavy work (and its setState) runs off the effect body.
  React.useEffect(() => {
    if (!imageRef.current) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && imageRef.current) runExtract(imageRef.current, count);
    });
    return () => {
      cancelled = true;
    };
  }, [count, runExtract]);

  // Paste an image from the clipboard.
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.items ?? [])
        .find((i) => i.type.startsWith("image/"))
        ?.getAsFile();
      if (file) {
        loadFile(file);
        toast.success("Pasted from clipboard");
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied((c) => (c === text ? null : c)), 1200);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const pickFromScreen = async () => {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Ctor) {
      toast.error("Your browser doesn't support the eyedropper");
      return;
    }
    try {
      const result = await new Ctor().open();
      setPicked((prev) => [hexToRgb(result.sRGBHex), ...prev].slice(0, 8));
    } catch {
      // Cancelled — nothing to do.
    }
  };

  const sorted = React.useMemo(() => {
    if (sort === "hue") return [...swatches].sort((a, b) => hue(a.rgb) - hue(b.rgb));
    return swatches;
  }, [swatches, sort]);

  const hasImage = imageUrl !== null;

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.colors}
      output={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Palette</CardTitle>
            <CardDescription>
              {hasImage ? "Click any color to copy it." : "Upload an image to pull its colors."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasImage && (
              <div className="flex flex-wrap items-center gap-2">
                <Tabs value={format} onValueChange={(v) => setFormat(v as ColorFormat)}>
                  <TabsList>
                    <TabsTrigger value="hex">HEX</TabsTrigger>
                    <TabsTrigger value="rgb">RGB</TabsTrigger>
                    <TabsTrigger value="hsl">HSL</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="ml-auto flex gap-1.5">
                  {(["population", "hue"] as const).map((mode) => (
                    <Badge
                      key={mode}
                      asChild
                      variant={sort === mode ? "default" : "outline"}
                      className="cursor-pointer"
                    >
                      <button type="button" onClick={() => setSort(mode)}>
                        {mode === "population" ? "By amount" : "By hue"}
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {sorted.length > 0 ? (
              <div className="space-y-2">
                {sorted.map((swatch, i) => {
                  const value = formatColor(swatch.rgb, format);
                  const text = contrastText(swatch.rgb);
                  return (
                    <button
                      key={`${swatch.hex}-${i}`}
                      type="button"
                      onClick={() => copy(value)}
                      className="group flex h-12 w-full items-center justify-between rounded-lg px-3 text-sm transition-transform hover:scale-[1.01]"
                      style={{ backgroundColor: swatch.hex, color: text }}
                    >
                      <span className="font-mono font-medium">{value}</span>
                      <span className="flex items-center gap-2 opacity-80">
                        <span className="text-xs tabular-nums">{Math.round(swatch.population * 100)}%</span>
                        {copied === value ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted-foreground border-border flex min-h-32 items-center justify-center rounded-lg border border-dashed text-sm">
                No palette yet
              </div>
            )}

            {picked.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <span className="text-xs font-medium">Picked from screen</span>
                  <div className="flex flex-wrap gap-1.5">
                    {picked.map((rgb, i) => {
                      const value = formatColor(rgb, format);
                      return (
                        <button
                          key={`${value}-${i}`}
                          type="button"
                          onClick={() => copy(value)}
                          title={value}
                          className="border-border size-8 rounded-md border"
                          style={{ backgroundColor: formatColor(rgb, "hex") }}
                          aria-label={`Copy ${value}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {swatches.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Export</h4>
                  <Tabs defaultValue="css">
                    <TabsList className="flex-wrap">
                      {EXPORTS.map((e) => (
                        <TabsTrigger key={e.id} value={e.id}>
                          {e.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {EXPORTS.map((e) => {
                      const code = exportPalette(swatches, e.id);
                      return (
                        <TabsContent key={e.id} value={e.id} className="pt-3">
                          <div className="relative">
                            <pre className="bg-muted/50 border-border max-h-48 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                              {code}
                            </pre>
                            <CopyButton
                              text={code}
                              label=""
                              variant="ghost"
                              size="icon-sm"
                              className="absolute top-1.5 right-1.5"
                              successMessage={`${e.label} palette copied`}
                              aria-label={`Copy ${e.label} palette`}
                            />
                          </div>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </div>
              </>
            )}

            <Separator />
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Colors are extracted from your image on-device — it is never uploaded or stored.
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFile(file);
                e.target.value = "";
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) loadFile(file);
              }}
              className="border-border hover:bg-muted/40 relative flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed p-4 text-center transition-colors"
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={imageName} className="max-h-56 w-auto rounded-md object-contain" />
              ) : (
                <>
                  <UploadIcon className="text-muted-foreground size-6" aria-hidden />
                  <span className="text-sm font-medium">Upload, drop or paste an image</span>
                  <span className="text-muted-foreground text-xs">PNG, JPG, SVG, WebP or GIF</span>
                </>
              )}
            </div>
            {imageUrl && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <ImageIcon className="size-3.5" aria-hidden />
                {imageName} · click to replace
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Colors in palette</Label>
                <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{count}</span>
              </div>
              <Slider
                value={[count]}
                min={2}
                max={16}
                step={1}
                onValueChange={([v]) => setCount(v)}
                aria-label="Number of colors"
              />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Button type="button" variant="outline" onClick={pickFromScreen} className="w-full">
                <PipetteIcon /> Pick a color from screen
              </Button>
              <p className="text-muted-foreground text-xs">
                Uses your browser&apos;s eyedropper to sample any pixel on screen (Chrome &amp; Edge).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}
