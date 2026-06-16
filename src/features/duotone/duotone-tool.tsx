"use client";

import * as React from "react";
import {
  ArrowLeftRightIcon,
  DownloadIcon,
  ImageIcon,
  RepeatIcon,
  ShieldCheckIcon,
  ShuffleIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import { rgbToHex, type RGB } from "@/lib/colorExtract";
import { applyDuotone, DEFAULT_DUOTONE, DUOTONE_PRESETS } from "@/lib/duotone";
import { parseHex } from "@/lib/pantone";
import { cn } from "@/lib/utils";

const MAX_EDGE = 1600; // downscale huge uploads so recolor stays instant

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

export function DuotoneTool() {
  const [source, setSource] = React.useState<Source | null>(null);
  const [shadow, setShadow] = React.useState("#04241a");
  const [highlight, setHighlight] = React.useState("#34d399");
  const [contrast, setContrast] = React.useState(DEFAULT_DUOTONE.contrast);
  const [midpoint, setMidpoint] = React.useState(DEFAULT_DUOTONE.midpoint);
  const [amount, setAmount] = React.useState(DEFAULT_DUOTONE.amount);
  const [grain, setGrain] = React.useState(DEFAULT_DUOTONE.grain);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rafRef = React.useRef<number | undefined>(undefined);

  const shadowRgb = parseHex(shadow);
  const highlightRgb = parseHex(highlight);

  // Re-render the duotone whenever the image or any knob changes (rAF-throttled).
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!source || !canvas || !shadowRgb || !highlightRgb) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const out = applyDuotone(source.data, {
        shadow: shadowRgb as RGB,
        highlight: highlightRgb as RGB,
        contrast,
        midpoint,
        amount,
        grain,
      });
      canvas.width = out.width;
      canvas.height = out.height;
      canvas.getContext("2d")!.putImageData(out, 0, 0);
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [source, shadow, highlight, contrast, midpoint, amount, grain, shadowRgb, highlightRgb]);

  const load = async (file: File) => {
    try {
      setSource(await fileToSource(file));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Paste an image from anywhere on the page.
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

  const swap = () => {
    setShadow(highlight);
    setHighlight(shadow);
  };

  const applyPreset = (s: string, h: string) => {
    setShadow(s);
    setHighlight(h);
  };

  const shuffle = () => {
    const p = DUOTONE_PRESETS[Math.floor(Math.random() * DUOTONE_PRESETS.length)];
    applyPreset(p.shadow, p.highlight);
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `duotone-${source?.name.replace(/\.[^.]+$/, "") ?? "image"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.duotone}
      output={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>
              {source ? "Tweak the colors and tone live." : "Upload an image to begin."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-border bg-muted/30 flex min-h-48 items-center justify-center overflow-hidden rounded-xl border">
              {source ? (
                <canvas ref={canvasRef} className="max-h-[60vh] w-full object-contain" />
              ) : (
                <span className="text-muted-foreground text-sm">No image yet</span>
              )}
            </div>
            {source && (
              <Button onClick={download} className="w-full">
                <DownloadIcon /> Download PNG
              </Button>
            )}
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Recoloring happens entirely on-device — your image is never uploaded.
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
              <Dropzone onFile={load} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5">
            {/* Two-color ramp */}
            <div className="space-y-2">
              <Label>Duotone colors</Label>
              <div className="flex items-end gap-2">
                <ColorField label="Shadows" value={shadow} onChange={setShadow} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={swap}
                  title="Swap colors"
                  aria-label="Swap colors"
                  className="mb-1"
                >
                  <ArrowLeftRightIcon />
                </Button>
                <ColorField label="Highlights" value={highlight} onChange={setHighlight} />
              </div>
            </div>

            {/* Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Presets</Label>
                <button
                  type="button"
                  onClick={shuffle}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                >
                  <ShuffleIcon className="size-3" /> Surprise me
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DUOTONE_PRESETS.map((p) => {
                  const active = p.shadow === shadow && p.highlight === highlight;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => applyPreset(p.shadow, p.highlight)}
                      title={p.name}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-xs transition-colors",
                        active ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"
                      )}
                    >
                      <span
                        className="size-4 rounded-full border border-black/10"
                        style={{ background: `linear-gradient(135deg, ${p.shadow}, ${p.highlight})` }}
                      />
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tone controls */}
            <SliderRow label="Intensity" value={amount} min={0} max={1} step={0.01} display={`${Math.round(amount * 100)}%`} onChange={setAmount} />
            <SliderRow label="Contrast" value={contrast} min={0.4} max={2.2} step={0.05} display={`${contrast.toFixed(2)}×`} onChange={setContrast} />
            <SliderRow label="Midpoint" value={midpoint} min={0.2} max={0.8} step={0.01} display={`${Math.round(midpoint * 100)}%`} onChange={setMidpoint} />
            <SliderRow label="Grain" value={grain} min={0} max={40} step={1} display={String(grain)} onChange={setGrain} />
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

/* ------------------------------- bits ------------------------------------- */

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

function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
      )}
    >
      <UploadIcon className={cn("size-6", dragging ? "text-primary" : "text-muted-foreground")} />
      <span className="text-sm font-medium">Drop, paste or click to upload</span>
      <span className="text-muted-foreground text-xs">PNG, JPG, WebP — stays on your device</span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
