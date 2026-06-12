"use client";

import * as React from "react";
import {
  DownloadIcon,
  EyeIcon,
  ImageIcon,
  Loader2Icon,
  Maximize2Icon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  AUTO_ENHANCE,
  DEFAULT_SETTINGS,
  MAX_OUTPUT_PIXELS,
  MAX_OUTPUT_SIDE,
  formatBytes,
  hasAdjustments,
  renderEnhanced,
  type EnhanceSettings,
} from "@/lib/enhance";
import { cn } from "@/lib/utils";

const MAX_INPUT_PIXELS = 24_000_000;

type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

const FORMATS: { id: OutputFormat; name: string; ext: string; lossy: boolean }[] = [
  { id: "image/png", name: "PNG", ext: "png", lossy: false },
  { id: "image/jpeg", name: "JPEG", ext: "jpg", lossy: true },
  { id: "image/webp", name: "WebP", ext: "webp", lossy: true },
];

const SCALE_PRESETS = [0.5, 1, 2, 4];

function clampDims(w: number, h: number): [number, number] {
  let cw = Math.max(1, Math.round(w));
  let ch = Math.max(1, Math.round(h));
  const sideScale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(cw, ch));
  const pixelScale = Math.min(1, Math.sqrt(MAX_OUTPUT_PIXELS / (cw * ch)));
  const scale = Math.min(sideScale, pixelScale);
  if (scale < 1) {
    cw = Math.max(1, Math.round(cw * scale));
    ch = Math.max(1, Math.round(ch * scale));
  }
  return [cw, ch];
}

export function EnhancerTool() {
  const [srcCanvas, setSrcCanvas] = React.useState<HTMLCanvasElement | null>(null);
  const [originalUrl, setOriginalUrl] = React.useState<string | null>(null);
  const [width, setWidth] = React.useState(0);
  const [height, setHeight] = React.useState(0);
  const [lockAspect, setLockAspect] = React.useState(true);
  const [settings, setSettings] = React.useState<EnhanceSettings>(DEFAULT_SETTINGS);
  const [format, setFormat] = React.useState<OutputFormat>("image/png");
  const [quality, setQuality] = React.useState(0.92);
  const [estSize, setEstSize] = React.useState<number | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [comparing, setComparing] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const resultRef = React.useRef<HTMLCanvasElement | null>(null);

  const aspect = srcCanvas ? srcCanvas.width / srcCanvas.height : 1;

  const loadFile = React.useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("That file isn't an image");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Image too large (max 25MB)");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      if (w * h > MAX_INPUT_PIXELS) {
        const scale = Math.sqrt(MAX_INPUT_PIXELS / (w * h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        toast.info("Very large image scaled down to keep things fast");
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      setSrcCanvas(canvas);
      setOriginalUrl(canvas.toDataURL("image/png"));
      setWidth(w);
      setHeight(h);
      setSettings(DEFAULT_SETTINGS);
      setEstSize(null);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      toast.error("Could not read that image");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) loadFile(file);
  };

  // Paste an image straight from the clipboard, anywhere on the page.
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/")
      );
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        loadFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile]);

  // Debounced pipeline: resize → auto levels → adjustments → sharpen → estimate.
  React.useEffect(() => {
    if (!srcCanvas || width < 1 || height < 1) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setProcessing(true);
    });
    const timer = setTimeout(() => {
      if (cancelled) return;
      const out = renderEnhanced(srcCanvas, width, height, settings);
      resultRef.current = out;
      const view = canvasRef.current;
      if (view) {
        view.width = out.width;
        view.height = out.height;
        view.getContext("2d")!.drawImage(out, 0, 0);
      }
      out.toBlob(
        (blob) => {
          if (!cancelled && blob) setEstSize(blob.size);
        },
        format,
        quality
      );
      setProcessing(false);
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [srcCanvas, width, height, settings, format, quality]);

  const setW = (w: number) => {
    if (!srcCanvas) return;
    const [cw, ch] = lockAspect ? clampDims(w, w / aspect) : clampDims(w, height);
    setWidth(cw);
    if (lockAspect) setHeight(ch);
  };

  const setH = (h: number) => {
    if (!srcCanvas) return;
    const [cw, ch] = lockAspect ? clampDims(h * aspect, h) : clampDims(width, h);
    setHeight(ch);
    if (lockAspect) setWidth(cw);
  };

  const applyScale = (factor: number) => {
    if (!srcCanvas) return;
    const [cw, ch] = clampDims(srcCanvas.width * factor, srcCanvas.height * factor);
    if (factor > 1 && cw < Math.round(srcCanvas.width * factor)) {
      toast.info("Capped at 16MP to keep your browser happy");
    }
    setWidth(cw);
    setHeight(ch);
  };

  const clear = () => {
    setSrcCanvas(null);
    setOriginalUrl(null);
    resultRef.current = null;
    setEstSize(null);
  };

  const download = () => {
    const out = resultRef.current;
    if (!out) return;
    const meta = FORMATS.find((f) => f.id === format)!;
    out.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `forma-converted.${meta.ext}`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${meta.name} downloaded (${formatBytes(blob.size)})`);
      },
      format,
      quality
    );
  };

  const formatMeta = FORMATS.find((f) => f.id === format)!;
  const scaleNow = srcCanvas ? width / srcCanvas.width : 1;

  return (
    <GeneratorLayout tool={TOOL_BY_ID.enhancer} output={null}>
      {!srcCanvas ? (
        <Card>
          <CardContent>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) loadFile(file);
              }}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 transition-colors",
                dragOver && "border-primary bg-primary/5"
              )}
            >
              <ImageIcon className="text-muted-foreground/20 mb-6 size-16" />
              <Button asChild size="lg" className="cursor-pointer font-semibold">
                <label>
                  Select an image
                  <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
                </label>
              </Button>
              <p className="text-muted-foreground mt-4 max-w-sm text-center text-xs font-medium">
                …or drag & drop, or paste from the clipboard. Resize, upscale, sharpen and
                fine-tune — every pixel stays on your device.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <WandSparklesIcon className="text-primary size-4" />
                  Result
                  {processing && (
                    <Loader2Icon className="text-muted-foreground size-3.5 animate-spin" />
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clear}
                  className="text-muted-foreground hover:text-destructive h-8 text-xs"
                >
                  <Trash2Icon className="size-3.5" /> New image
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-muted/30 relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl border p-4">
                  <canvas
                    ref={canvasRef}
                    className={cn("max-h-[600px] max-w-full rounded-md shadow-2xl", comparing && "hidden")}
                  />
                  {comparing && originalUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element -- on-device data URL */
                    <img
                      src={originalUrl}
                      alt="Original"
                      className="max-h-[600px] max-w-full rounded-md shadow-2xl"
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={download} disabled={processing} className="font-semibold">
                    <DownloadIcon className="size-4" /> Download {formatMeta.name}
                  </Button>
                  <Button
                    variant="outline"
                    onPointerDown={() => setComparing(true)}
                    onPointerUp={() => setComparing(false)}
                    onPointerLeave={() => setComparing(false)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") setComparing(true);
                    }}
                    onKeyUp={() => setComparing(false)}
                  >
                    <EyeIcon className="size-4" /> Hold to compare
                  </Button>
                  <div className="ml-auto text-right">
                    <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                      {srcCanvas.width}×{srcCanvas.height} → {width}×{height}
                      {scaleNow !== 1 && ` (${scaleNow < 1 ? scaleNow.toFixed(2) : scaleNow.toFixed(1)}×)`}
                    </p>
                    {estSize !== null && (
                      <p className="text-primary text-sm font-bold tabular-nums">
                        ≈ {formatBytes(estSize)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0">
            <div className="space-y-6 lg:sticky lg:top-20">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Maximize2Icon className="size-4" />
                    Resize
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-4 gap-2">
                    {SCALE_PRESETS.map((factor) => (
                      <Button
                        key={factor}
                        variant={Math.abs(scaleNow - factor) < 0.01 ? "default" : "outline"}
                        size="sm"
                        onClick={() => applyScale(factor)}
                        className="text-xs font-bold"
                      >
                        {factor}×
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="enh-w" className="text-xs">
                        Width
                      </Label>
                      <Input
                        id="enh-w"
                        type="number"
                        min={1}
                        value={width}
                        onChange={(e) => setW(Number(e.target.value))}
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="enh-h" className="text-xs">
                        Height
                      </Label>
                      <Input
                        id="enh-h"
                        type="number"
                        min={1}
                        value={height}
                        onChange={(e) => setH(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enh-lock" className="cursor-pointer text-sm font-medium">
                      Lock aspect ratio
                    </Label>
                    <Switch id="enh-lock" checked={lockAspect} onCheckedChange={setLockAspect} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <SlidersHorizontalIcon className="size-4" />
                    Enhance
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSettings(DEFAULT_SETTINGS)}
                    disabled={!hasAdjustments(settings)}
                    className="text-muted-foreground h-8 text-xs"
                  >
                    <RotateCcwIcon className="size-3.5" /> Reset
                  </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Button
                    variant="secondary"
                    className="w-full font-semibold"
                    onClick={() => setSettings(AUTO_ENHANCE)}
                  >
                    <WandSparklesIcon className="size-4" /> Auto enhance
                  </Button>

                  <EnhanceSlider
                    label="Sharpen"
                    value={settings.sharpen}
                    min={0}
                    max={100}
                    onChange={(v) => setSettings((p) => ({ ...p, sharpen: v }))}
                  />
                  <EnhanceSlider
                    label="Brightness"
                    value={settings.brightness}
                    min={-50}
                    max={50}
                    onChange={(v) => setSettings((p) => ({ ...p, brightness: v }))}
                  />
                  <EnhanceSlider
                    label="Contrast"
                    value={settings.contrast}
                    min={-50}
                    max={50}
                    onChange={(v) => setSettings((p) => ({ ...p, contrast: v }))}
                  />
                  <EnhanceSlider
                    label="Saturation"
                    value={settings.saturation}
                    min={-50}
                    max={50}
                    onChange={(v) => setSettings((p) => ({ ...p, saturation: v }))}
                  />

                  <div className="flex items-center justify-between pt-1">
                    <Label htmlFor="enh-auto" className="cursor-pointer text-sm font-medium">
                      Auto levels
                      <span className="text-muted-foreground block text-[10px] font-normal">
                        Fixes hazy images and color casts
                      </span>
                    </Label>
                    <Switch
                      id="enh-auto"
                      checked={settings.autoLevels}
                      onCheckedChange={(v) => setSettings((p) => ({ ...p, autoLevels: v }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Export</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select value={format} onValueChange={(v) => setFormat(v as OutputFormat)}>
                      <SelectTrigger className="w-full" aria-label="Output format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMATS.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                            {f.lossy ? " (smaller files)" : " (lossless)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formatMeta.lossy && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground text-[11px] tracking-wider uppercase">
                          Quality
                        </Label>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {Math.round(quality * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[quality]}
                        min={0.4}
                        max={1}
                        step={0.01}
                        onValueChange={([v]) => setQuality(v)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </GeneratorLayout>
  );
}

function EnhanceSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-muted-foreground font-mono text-[10px]">{value}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}
