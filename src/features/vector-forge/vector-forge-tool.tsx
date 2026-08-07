"use client";

import * as React from "react";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  Layers3Icon,
  LoaderCircleIcon,
  Maximize2Icon,
  PaletteIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UploadCloudIcon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";
import type { TraceColor, TraceData } from "imagetracerjs";
import { toast } from "sonner";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  DEFAULT_VECTOR_SETTINGS,
  VECTOR_PRESETS,
  colorToHex,
  downloadBlob,
  fileToVectorSource,
  hexToColor,
  removeCornerBackground,
  sanitizeSvg,
  settingsToTraceOptions,
  svgToPng,
  traceStats,
  type VectorPreset,
  type VectorSettings,
  type VectorSource,
} from "@/lib/vector-forge";
import { cn } from "@/lib/utils";

interface VectorResult {
  traceData: TraceData;
  palette: TraceColor[];
  svg: string;
  paths: number;
  colors: number;
  bytes: number;
}

const PRESET_COPY: Record<VectorPreset, { label: string; description: string }> = {
  logo: { label: "Logo", description: "Clean edges, fewer colors" },
  illustration: { label: "Illustration", description: "Balanced curves and detail" },
  detailed: { label: "Detailed", description: "More shades and texture" },
};

const CHECKER_STYLE = {
  backgroundColor: "var(--background)",
  backgroundImage:
    "linear-gradient(45deg,var(--muted) 25%,transparent 25%),linear-gradient(-45deg,var(--muted) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,var(--muted) 75%),linear-gradient(-45deg,transparent 75%,var(--muted) 75%)",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
  backgroundSize: "16px 16px",
};

function basename(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "vector";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function VectorForgeTool() {
  const [source, setSource] = React.useState<VectorSource | null>(null);
  const [settings, setSettings] = React.useState<VectorSettings>(DEFAULT_VECTOR_SETTINGS);
  const [result, setResult] = React.useState<VectorResult | null>(null);
  const [isTracing, setIsTracing] = React.useState(false);
  const [compare, setCompare] = React.useState(50);
  const [view, setView] = React.useState<"split" | "vector" | "original">("split");
  const [advanced, setAdvanced] = React.useState(false);
  const runId = React.useRef(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const loadFile = React.useCallback(async (file: File) => {
    try {
      const next = await fileToVectorSource(file);
      setSource((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return next;
      });
      setResult(null);
      toast.success("Image ready to vectorize");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }, []);

  React.useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.type.startsWith("image/"))
        ?.getAsFile();
      if (file) void loadFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile]);

  React.useEffect(() => {
    if (!source) return;
    const currentRun = ++runId.current;
    const timer = window.setTimeout(async () => {
      setIsTracing(true);
      try {
        const tracerModule = await import("imagetracerjs");
        const tracer = tracerModule.default;
        const imageData = settings.removeBackground
          ? removeCornerBackground(source.data, settings.backgroundThreshold)
          : new ImageData(new Uint8ClampedArray(source.data.data), source.data.width, source.data.height);
        const options = settingsToTraceOptions(settings);
        const traceData = tracer.imagedataToTracedata(imageData, { ...options });
        const svg = sanitizeSvg(tracer.getsvgstring(traceData, { ...options }));
        if (currentRun !== runId.current) return;
        setResult({ traceData, palette: traceData.palette.map((color) => ({ ...color })), svg, ...traceStats(svg, traceData) });
      } catch {
        if (currentRun === runId.current) toast.error("Vector tracing failed. Try a smaller image.");
      } finally {
        if (currentRun === runId.current) setIsTracing(false);
      }
    }, 320);
    return () => window.clearTimeout(timer);
  }, [source, settings]);

  React.useEffect(() => () => {
    if (source) URL.revokeObjectURL(source.previewUrl);
  }, [source]);

  const applyPreset = (preset: VectorPreset) => {
    setSettings({ preset, ...VECTOR_PRESETS[preset] });
  };

  const updateSetting = <K extends keyof VectorSettings>(key: K, value: VectorSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const updatePalette = async (index: number, hex: string) => {
    if (!result) return;
    const palette = result.palette.map((color, colorIndex) =>
      colorIndex === index ? hexToColor(hex, color.a) : color
    );
    const traceData = { ...result.traceData, palette };
    const tracerModule = await import("imagetracerjs");
    const svg = sanitizeSvg(tracerModule.default.getsvgstring(traceData, settingsToTraceOptions(settings)));
    setResult({ traceData, palette, svg, ...traceStats(svg, traceData) });
  };

  const exportSvg = () => {
    if (!result || !source) return;
    downloadBlob(new Blob([result.svg], { type: "image/svg+xml;charset=utf-8" }), `${basename(source.name)}.svg`);
    toast.success("Editable SVG downloaded");
  };

  const exportPng = async () => {
    if (!result || !source) return;
    try {
      const png = await svgToPng(result.svg, result.traceData.width, result.traceData.height);
      downloadBlob(png, `${basename(source.name)}-vector.png`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const copySvg = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.svg);
    toast.success("SVG code copied");
  };

  const removeSource = () => {
    runId.current += 1;
    if (source) URL.revokeObjectURL(source.previewUrl);
    setSource(null);
    setResult(null);
    setIsTracing(false);
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.vectorforge}
      wideOutput
      fullBleed
      output={
        <Card className="overflow-hidden border-foreground/10 bg-card/80 shadow-xl shadow-foreground/5 backdrop-blur">
          <CardHeader className="flex-row items-start justify-between gap-4 border-b">
            <div className="flex min-w-0 flex-col gap-1.5">
              <CardTitle className="flex items-center gap-2 text-base">
                <SparklesIcon className="size-4 text-primary" aria-hidden />
                Vector canvas
              </CardTitle>
              <CardDescription>
                {source ? `${source.originalWidth} x ${source.originalHeight} source` : "Drop in artwork to begin"}
              </CardDescription>
            </div>
            {source && (
              <Tabs value={view} onValueChange={(value) => setView(value as typeof view)}>
                <TabsList>
                  <TabsTrigger value="original">Before</TabsTrigger>
                  <TabsTrigger value="split">Split</TabsTrigger>
                  <TabsTrigger value="vector">Vector</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-3 sm:p-5">
            <div
              className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border sm:min-h-[560px]"
              style={CHECKER_STYLE}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) void loadFile(file);
              }}
            >
              {!source ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="group m-5 flex max-w-md flex-col items-center gap-5 rounded-3xl border border-dashed border-foreground/20 bg-background/90 px-8 py-12 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
                >
                  <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition group-hover:rotate-3 group-hover:scale-105">
                    <UploadCloudIcon className="size-7" aria-hidden />
                  </span>
                  <span className="flex flex-col gap-2">
                    <span className="font-heading text-xl font-semibold">Drop a raster image here</span>
                    <span className="text-muted-foreground text-sm">PNG, JPG or WebP up to 20 MB. You can also paste.</span>
                  </span>
                  <Badge variant="secondary">Nothing leaves your device</Badge>
                </button>
              ) : (
                <>
                  {/* Blob URLs stay local and cannot use Next's remote image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={source.previewUrl}
                    alt="Original uploaded artwork"
                    className={cn(
                      "absolute inset-0 size-full object-contain p-5 sm:p-10",
                      view === "vector" && "hidden"
                    )}
                  />
                  {result && view !== "original" && (
                    <div
                      className="absolute inset-0 flex items-center justify-center overflow-hidden"
                      style={view === "split" ? { clipPath: `inset(0 0 0 ${compare}%)` } : undefined}
                    >
                      <div
                        aria-label="Generated vector preview"
                        role="img"
                        className="size-full p-5 [&_svg]:size-full sm:p-10"
                        dangerouslySetInnerHTML={{ __html: result.svg }}
                      />
                    </div>
                  )}
                  {view === "split" && result && (
                    <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary shadow-[0_0_0_1px_var(--background)]" style={{ left: `${compare}%` }}>
                      <span className="absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                        <Maximize2Icon className="size-3.5 rotate-45" aria-hidden />
                      </span>
                    </div>
                  )}
                  {isTracing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-sm">
                      <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-lg">
                        <LoaderCircleIcon className="size-4 animate-spin text-primary" aria-hidden />
                        Forging paths...
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {source && view === "split" && result && (
              <div className="flex items-center gap-3 px-1">
                <span className="text-muted-foreground text-xs font-medium">Raster</span>
                <Slider value={[compare]} min={5} max={95} step={1} onValueChange={([value]) => setCompare(value)} aria-label="Before and after split" />
                <span className="text-muted-foreground text-xs font-medium">Vector</span>
              </div>
            )}

            {source && result && (
              <div className="flex flex-wrap items-center gap-2">
                <Metric icon={Layers3Icon} value={result.paths.toLocaleString()} label="paths" />
                <Metric icon={PaletteIcon} value={String(result.colors)} label="colors" />
                <Metric icon={ImageIcon} value={formatBytes(result.bytes)} label="SVG" />
                <span className="flex-1" />
                <Button variant="outline" size="sm" onClick={copySvg}>
                  <CopyIcon data-icon="inline-start" /> Copy SVG
                </Button>
                <Button variant="outline" size="sm" onClick={() => void exportPng()}>
                  <DownloadIcon data-icon="inline-start" /> PNG
                </Button>
                <Button size="sm" onClick={exportSvg}>
                  <DownloadIcon data-icon="inline-start" /> Download SVG
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      }
    >
      <div className="flex flex-col gap-5">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void loadFile(file);
            event.target.value = "";
          }}
        />

        {source && (
          <Card>
            <CardContent className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <ImageIcon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{source.name}</p>
                <p className="text-muted-foreground text-xs">{formatBytes(source.originalBytes)}</p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => inputRef.current?.click()} aria-label="Replace image">
                <RefreshCwIcon />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={removeSource} aria-label="Remove image">
                <XIcon />
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose the result</CardTitle>
            <CardDescription>Start with a smart preset. Fine-tuning is optional.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(Object.keys(PRESET_COPY) as VectorPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition hover:border-primary/40 hover:bg-muted/40",
                  settings.preset === preset && "border-primary bg-primary/5"
                )}
              >
                <span className={cn("flex size-9 items-center justify-center rounded-lg bg-muted", settings.preset === preset && "bg-primary text-primary-foreground")}>
                  {settings.preset === preset ? <CheckIcon className="size-4" /> : <WandSparklesIcon className="size-4" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold">{PRESET_COPY[preset].label}</span>
                  <span className="text-muted-foreground text-xs">{PRESET_COPY[preset].description}</span>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="text-base">Refine</CardTitle>
              <CardDescription>Changes update the vector automatically.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAdvanced((value) => !value)}>
              {advanced ? "Simple" : "Advanced"}
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Control label="Colors" value={settings.colors} suffix="" min={2} max={24} step={1} onChange={(value) => updateSetting("colors", value)} />
            <Control label="Detail" value={settings.detail} suffix="%" min={10} max={100} step={1} onChange={(value) => updateSetting("detail", value)} />
            {advanced && (
              <>
                <Control label="Curve smoothing" value={settings.smoothing} suffix="%" min={0} max={100} step={1} onChange={(value) => updateSetting("smoothing", value)} />
                <Control label="Noise cleanup" value={settings.cleanup} suffix="%" min={0} max={100} step={1} onChange={(value) => updateSetting("cleanup", value)} />
                <SwitchRow label="Preserve sharp corners" description="Best for icons, lettering and geometric marks." checked={settings.sharpCorners} onCheckedChange={(value) => updateSetting("sharpCorners", value)} />
              </>
            )}
            <SwitchRow label="Remove solid background" description="Samples the image corners and makes matching pixels transparent." checked={settings.removeBackground} onCheckedChange={(value) => updateSetting("removeBackground", value)} />
            {settings.removeBackground && (
              <Control label="Background tolerance" value={settings.backgroundThreshold} suffix="%" min={2} max={60} step={1} onChange={(value) => updateSetting("backgroundThreshold", value)} />
            )}
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Editable palette</CardTitle>
              <CardDescription>Recolor the vector instantly, without tracing again.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {result.palette.map((color, index) => color.a > 0 && (
                <label key={`${index}-${colorToHex(color)}`} className="group relative cursor-pointer" title={`Color ${index + 1}: ${colorToHex(color)}`}>
                  <span className="block size-10 rounded-xl border shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md" style={{ backgroundColor: colorToHex(color), opacity: color.a / 255 }} />
                  <input type="color" className="sr-only" value={colorToHex(color)} onChange={(event) => void updatePalette(index, event.target.value)} />
                </label>
              ))}
            </CardContent>
          </Card>
        )}

        <p className="text-muted-foreground flex items-start gap-2 px-1 text-xs">
          <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Private by design. VectorForge runs locally and never uploads your artwork.
        </p>
      </div>
    </GeneratorLayout>
  );
}

function Control({ label, value, suffix, min, max, step, onChange }: { label: string; value: number; suffix: string; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs tabular-nums">{value}{suffix}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next)} aria-label={label} />
    </div>
  );
}

function SwitchRow({ label, description, checked, onCheckedChange }: { label: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <Label>{label}</Label>
        <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

function Metric({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) {
  return (
    <Badge variant="secondary" className="gap-1.5 font-normal">
      <Icon className="size-3" /> <strong>{value}</strong> {label}
    </Badge>
  );
}
