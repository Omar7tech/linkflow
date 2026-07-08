"use client";

import * as React from "react";
import {
  CheckIcon,
  CopyIcon,
  ImageIcon,
  Loader2Icon,
  PipetteIcon,
  RepeatIcon,
  ShieldCheckIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
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
  colorName,
  contrastText,
  exportPalette,
  extractPalette,
  formatColor,
  hue,
  rgbToHex,
  type ColorFormat,
  type ExportFormat,
  type RGB,
  type Swatch,
} from "@/lib/colorExtract";
import { cn } from "@/lib/utils";

type SortMode = "population" | "hue";
const EXPORTS: { id: ExportFormat; label: string }[] = [
  { id: "css", label: "CSS" },
  { id: "scss", label: "SCSS" },
  { id: "json", label: "JSON" },
  { id: "tailwind", label: "Tailwind" },
];

const MAX_SAMPLE = 200; // longest edge sampled for palette extraction
const SAMPLE_CAP = 1000; // longest edge kept for pixel-accurate hover picking

interface EyeDropperCtor {
  new (): { open: () => Promise<{ sRGBHex: string }> };
}

interface Hover {
  rgb: RGB;
  /** Cursor position within the preview, in px. */
  x: number;
  y: number;
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
  const [extracting, setExtracting] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [hover, setHover] = React.useState<Hover | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageRef = React.useRef<HTMLImageElement | null>(null);
  // High-res offscreen copy used for pixel-accurate eyedropping on the image.
  const sampleCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const sampleCtxRef = React.useRef<CanvasRenderingContext2D | null>(null);

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

  // Show a brief spinner, then extract on the next frame so the UI stays responsive
  // (notably while dragging the color-count slider over a large image).
  const scheduleExtract = React.useCallback(
    (img: HTMLImageElement, colorCount: number) => {
      setExtracting(true);
      requestAnimationFrame(() => {
        runExtract(img, colorCount);
        setExtracting(false);
      });
    },
    [runExtract]
  );

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

        // Prepare the offscreen sampling canvas for hover picking.
        const s = Math.min(1, SAMPLE_CAP / Math.max(img.naturalWidth, img.naturalHeight));
        const cw = Math.max(1, Math.round(img.naturalWidth * s));
        const ch = Math.max(1, Math.round(img.naturalHeight * s));
        const canvas = sampleCanvasRef.current ?? document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const sctx = canvas.getContext("2d", { willReadFrequently: true });
        if (sctx) sctx.drawImage(img, 0, 0, cw, ch);
        sampleCanvasRef.current = canvas;
        sampleCtxRef.current = sctx;

        setImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setImageName(file.name);
        setHover(null);
        scheduleExtract(img, count);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error("Couldn't read that image");
      };
      img.src = url;
    },
    [count, scheduleExtract]
  );

  React.useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // Re-quantize when the color count changes (deferred off the effect body).
  React.useEffect(() => {
    if (!imageRef.current) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && imageRef.current) scheduleExtract(imageRef.current, count);
    });
    return () => {
      cancelled = true;
    };
  }, [count, scheduleExtract]);

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

  const copy = React.useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied((c) => (c === text ? null : c)), 1200);
    } catch {
      toast.error("Clipboard unavailable");
    }
  }, []);

  const addPicked = React.useCallback((rgb: RGB) => {
    setPicked((prev) => {
      const hex = rgbToHex(rgb);
      const deduped = prev.filter((p) => rgbToHex(p) !== hex);
      return [rgb, ...deduped].slice(0, 12);
    });
  }, []);

  const pickFromScreen = async () => {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Ctor) {
      toast.error("Your browser doesn't support the eyedropper");
      return;
    }
    try {
      const result = await new Ctor().open();
      addPicked(hexToRgb(result.sRGBHex));
    } catch {
      // Cancelled — nothing to do.
    }
  };

  const sampleAt = (clientX: number, clientY: number, rect: DOMRect): RGB | null => {
    const canvas = sampleCanvasRef.current;
    const ctx = sampleCtxRef.current;
    if (!canvas || !ctx) return null;
    const px = Math.floor(((clientX - rect.left) / rect.width) * canvas.width);
    const py = Math.floor(((clientY - rect.top) / rect.height) * canvas.height);
    const d = ctx.getImageData(Math.min(px, canvas.width - 1), Math.min(py, canvas.height - 1), 1, 1).data;
    return [d[0], d[1], d[2]];
  };

  const removeImage = () => {
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    imageRef.current = null;
    sampleCtxRef.current = null;
    setSwatches([]);
    setHover(null);
    setImageName("");
  };

  const sorted = React.useMemo(() => {
    if (sort === "hue") return [...swatches].sort((a, b) => hue(a.rgb) - hue(b.rgb));
    return swatches;
  }, [swatches, sort]);

  const copyAll = sorted.map((s) => formatColor(s.rgb, format)).join("\n");
  const hasImage = imageUrl !== null;

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) loadFile(file);
    },
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.colors}
      output={
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Palette
              {extracting && <Loader2Icon className="text-muted-foreground size-3.5 animate-spin" aria-label="Extracting" />}
            </CardTitle>
            <CardDescription>
              {hasImage ? "Click any swatch to copy it." : "Upload an image to pull its colors."}
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
                <div className="ml-auto flex items-center gap-1.5">
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
              <>
                {/* Stacked dominance bar */}
                <div className="border-border flex h-3 overflow-hidden rounded-full border">
                  {swatches.map((s, i) => (
                    <button
                      key={`bar-${s.hex}-${i}`}
                      type="button"
                      title={`${s.hex} · ${Math.round(s.population * 100)}%`}
                      onClick={() => copy(formatColor(s.rgb, format))}
                      style={{ backgroundColor: s.hex, width: `${s.population * 100}%` }}
                      aria-label={`Copy ${s.hex}`}
                    />
                  ))}
                </div>

                <div className="space-y-2">
                  {sorted.map((swatch, i) => {
                    const value = formatColor(swatch.rgb, format);
                    const text = contrastText(swatch.rgb);
                    return (
                      <button
                        key={`${swatch.hex}-${i}`}
                        type="button"
                        onClick={() => copy(value)}
                        className="group flex h-14 w-full items-center justify-between rounded-lg px-3.5 text-sm transition-transform hover:scale-[1.01]"
                        style={{ backgroundColor: swatch.hex, color: text }}
                      >
                        <span className="flex flex-col items-start leading-tight">
                          <span className="font-mono font-medium">{value}</span>
                          <span className="text-[11px] opacity-70">{colorName(swatch.rgb)}</span>
                        </span>
                        <span className="flex items-center gap-2 opacity-80">
                          <span className="text-xs tabular-nums">{Math.round(swatch.population * 100)}%</span>
                          {copied === value ? (
                            <CheckIcon className="size-4" />
                          ) : (
                            <CopyIcon className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <CopyButton text={copyAll} label="Copy all colors" variant="outline" size="sm" successMessage="Palette copied" />
              </>
            ) : (
              <div className="text-muted-foreground border-border flex min-h-32 items-center justify-center rounded-lg border border-dashed text-sm">
                {extracting ? "Extracting colors…" : "No palette yet"}
              </div>
            )}

            {picked.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Picked colors</span>
                    <button
                      type="button"
                      onClick={() => setPicked([])}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {picked.map((rgb, i) => {
                      const value = formatColor(rgb, format);
                      return (
                        <button
                          key={`${value}-${i}`}
                          type="button"
                          onClick={() => copy(value)}
                          title={`${value} — copy`}
                          className="border-border size-8 rounded-md border transition-transform hover:scale-110"
                          style={{ backgroundColor: rgbToHex(rgb) }}
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
              Your image stays private — it&apos;s never stored.
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

            {hasImage ? (
              <>
                {/* Interactive preview — hover to inspect, click to sample */}
                <div className="relative flex justify-center" {...dropHandlers}>
                  <div
                    className="relative inline-block cursor-crosshair leading-none"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const rgb = sampleAt(e.clientX, e.clientY, rect);
                      if (rgb) setHover({ rgb, x: e.clientX - rect.left, y: e.clientY - rect.top });
                    }}
                    onMouseLeave={() => setHover(null)}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const rgb = sampleAt(e.clientX, e.clientY, rect);
                      if (rgb) {
                        addPicked(rgb);
                        copy(formatColor(rgb, format));
                      }
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt={imageName} className="max-h-64 w-auto rounded-md object-contain" draggable={false} />

                    {hover && (
                      <div
                        className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-[130%] items-center gap-1.5 rounded-md border border-white/20 bg-zinc-900/90 px-2 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur"
                        style={{ left: hover.x, top: hover.y }}
                      >
                        <span className="size-3.5 rounded-sm border border-white/30" style={{ backgroundColor: rgbToHex(hover.rgb) }} />
                        <span className="font-mono">{formatColor(hover.rgb, format)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                    <ImageIcon className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{imageName}</span>
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <RepeatIcon /> Replace
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={removeImage} aria-label="Remove image">
                      <XIcon />
                    </Button>
                  </div>
                </div>
                <p className="text-muted-foreground text-center text-xs">
                  Hover the image to inspect, click to grab any pixel.
                </p>
              </>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
                {...dropHandlers}
                className={cn(
                  "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                )}
              >
                <UploadIcon className={cn("size-6", dragging ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span className="text-sm font-medium">
                  {dragging ? "Drop to extract colors" : "Upload, drop or paste an image"}
                </span>
                <span className="text-muted-foreground text-xs">PNG, JPG, SVG, WebP or GIF</span>
              </div>
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
