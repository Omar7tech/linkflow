"use client";

import * as React from "react";
import {
  DownloadIcon,
  ImageIcon,
  RepeatIcon,
  ShieldCheckIcon,
  ShuffleIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageDropzone } from "@/components/shared/image-dropzone";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import { rgbToHex, type RGB } from "@/lib/colorExtract";
import {
  drawHalftone,
  halftoneSvg,
  HALFTONE_PRESETS,
  type DotShape,
} from "@/lib/halftone";
import { parseHex } from "@/lib/pantone";
import { cn } from "@/lib/utils";

const MAX_EDGE = 1400;
const SHAPES: DotShape[] = ["circle", "square", "diamond"];

interface Source {
  data: ImageData;
  name: string;
}

function fileToSource(file: File): Promise<Source> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please pick an image file"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve({ data: ctx.getImageData(0, 0, w, h), name: file.name });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image"));
    };
    img.src = url;
  });
}

export function HalftoneTool() {
  const [source, setSource] = React.useState<Source | null>(null);
  const [cell, setCell] = React.useState(8);
  const [scale, setScale] = React.useState(1.1);
  const [angle, setAngle] = React.useState(45);
  const [shape, setShape] = React.useState<DotShape>("circle");
  const [contrast, setContrast] = React.useState(1.1);
  const [invert, setInvert] = React.useState(false);
  const [ink, setInk] = React.useState("#111111");
  const [bg, setBg] = React.useState("#f4f1ea");

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rafRef = React.useRef<number | undefined>(undefined);

  const inkRgb = parseHex(ink);
  const bgRgb = parseHex(bg);

  const options = React.useMemo(
    () =>
      inkRgb && bgRgb
        ? { cell, scale, angle, shape, contrast, invert, ink: inkRgb as RGB, bg: bgRgb as RGB }
        : null,
    [cell, scale, angle, shape, contrast, invert, inkRgb, bgRgb]
  );

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!source || !canvas || !options) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      canvas.width = source.data.width;
      canvas.height = source.data.height;
      drawHalftone(canvas.getContext("2d")!, source.data, options);
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [source, options]);

  const load = async (file: File) => {
    try {
      setSource(await fileToSource(file));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.items ?? [])
        .find((i) => i.type.startsWith("image/"))
        ?.getAsFile();
      if (file) {
        load(file);
        toast.success("Pasted from clipboard");
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const baseName = source?.name.replace(/\.[^.]+$/, "") ?? "image";

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      triggerDownload(URL.createObjectURL(blob), `halftone-${baseName}.png`);
    }, "image/png");
  };

  const downloadSvg = () => {
    if (!source || !options) return;
    const svg = halftoneSvg(source.data, options);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    triggerDownload(url, `halftone-${baseName}.svg`);
  };

  const shuffle = () => {
    const p = HALFTONE_PRESETS[Math.floor(Math.random() * HALFTONE_PRESETS.length)];
    setInk(p.ink);
    setBg(p.bg);
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.halftone}
      output={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>
              {source ? "Dots are sized by brightness." : "Upload an image to begin."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-border flex min-h-48 items-center justify-center overflow-hidden rounded-xl border"
              style={{ backgroundColor: source ? bg : undefined }}
            >
              {source ? (
                <canvas ref={canvasRef} className="max-h-[60vh] w-full object-contain" />
              ) : (
                <span className="text-muted-foreground text-sm">No image yet</span>
              )}
            </div>
            {source && (
              <div className="flex gap-2">
                <Button onClick={downloadPng} className="flex-1">
                  <DownloadIcon /> PNG
                </Button>
                <Button onClick={downloadSvg} variant="outline" className="flex-1">
                  <DownloadIcon /> SVG (vector)
                </Button>
              </div>
            )}
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Your photo stays private — it&apos;s never stored. SVG export stays crisp at any print size.
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent>
            {source ? (
              <div className="flex items-center gap-3">
                <ImageIcon className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm">{source.name}</span>
                <Button variant="ghost" size="sm" asChild>
                  <label className="cursor-pointer">
                    <RepeatIcon /> Replace
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) load(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setSource(null)} aria-label="Remove">
                  <XIcon />
                </Button>
              </div>
            ) : (
              <ImageDropzone onFile={load} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5">
            {/* Colors */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ink &amp; paper</Label>
                <button
                  type="button"
                  onClick={shuffle}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                >
                  <ShuffleIcon className="size-3" /> Surprise me
                </button>
              </div>
              <div className="flex gap-2">
                <ColorField label="Ink" value={ink} onChange={setInk} />
                <ColorField label="Paper" value={bg} onChange={setBg} />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {HALFTONE_PRESETS.map((p) => {
                  const active = p.ink === ink && p.bg === bg;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        setInk(p.ink);
                        setBg(p.bg);
                      }}
                      title={p.name}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-xs transition-colors",
                        active ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"
                      )}
                    >
                      <span className="flex size-4 overflow-hidden rounded-full border border-black/10">
                        <span className="w-1/2" style={{ background: p.bg }} />
                        <span className="w-1/2" style={{ background: p.ink }} />
                      </span>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Shape */}
            <div className="space-y-2">
              <Label>Dot shape</Label>
              <Tabs value={shape} onValueChange={(v) => setShape(v as DotShape)}>
                <TabsList className="w-full">
                  {SHAPES.map((s) => (
                    <TabsTrigger key={s} value={s} className="flex-1 capitalize">
                      {s}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <SliderRow label="Dot spacing" value={cell} min={3} max={28} step={1} display={`${cell}px`} onChange={setCell} />
            <SliderRow label="Dot size" value={scale} min={0.4} max={1.4} step={0.05} display={`${Math.round(scale * 100)}%`} onChange={setScale} />
            <SliderRow label="Screen angle" value={angle} min={0} max={90} step={1} display={`${angle}°`} onChange={setAngle} />
            <SliderRow label="Contrast" value={contrast} min={0.4} max={2.2} step={0.05} display={`${contrast.toFixed(2)}×`} onChange={setContrast} />

            <div className="flex items-center justify-between">
              <Label htmlFor="ht-invert">Invert tones</Label>
              <Switch id="ht-invert" checked={invert} onCheckedChange={setInvert} />
            </div>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

/* ------------------------------- bits ------------------------------------- */

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const valid = !!parseHex(value);
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <span className="text-muted-foreground text-[11px] font-medium">{label}</span>
      <div className="flex gap-1.5">
        <input
          type="color"
          value={valid ? rgbToHex(parseHex(value)!) : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="border-border size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
          aria-label={`${label} color`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="font-mono text-xs"
          aria-label={`${label} hex`}
        />
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{display}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} aria-label={label} />
    </div>
  );
}
