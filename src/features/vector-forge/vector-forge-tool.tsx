"use client";

import * as React from "react";
import {
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  LoaderCircleIcon,
  RepeatIcon,
  XIcon,
} from "lucide-react";
import type { TraceColor, TraceData } from "imagetracerjs";
import { toast } from "sonner";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  DEFAULT_VECTOR_SETTINGS,
  buildPalette,
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

type View = "original" | "split" | "vector";

const PRESET_COPY: Record<VectorPreset, { label: string; description: string }> = {
  logo: { label: "Logo", description: "Clean edges and few colours. Best for marks, icons and lettering." },
  illustration: { label: "Illustration", description: "Balanced curves and detail for flat artwork." },
  detailed: { label: "Detailed", description: "More shades and texture, at the cost of a bigger file." },
};

const VIEWS: { value: View; label: string }[] = [
  { value: "original", label: "Before" },
  { value: "split", label: "Compare" },
  { value: "vector", label: "Vector" },
];

const CHECKER =
  "bg-[length:16px_16px] [background-image:linear-gradient(45deg,var(--muted)_25%,transparent_25%,transparent_75%,var(--muted)_75%),linear-gradient(45deg,var(--muted)_25%,transparent_25%,transparent_75%,var(--muted)_75%)] [background-position:0_0,8px_8px]";

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
  const [view, setView] = React.useState<View>("split");
  const [advanced, setAdvanced] = React.useState(false);
  const runId = React.useRef(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dragging = React.useRef(false);

  const loadFile = React.useCallback(async (file: File) => {
    try {
      const next = await fileToVectorSource(file);
      setSource((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return next;
      });
      setResult(null);
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
        const traceData = tracer.imagedataToTracedata(imageData, {
          ...options,
          pal: buildPalette(imageData, settings.colors),
          // Refine the seeded colours, but never swap a small one for a random pick.
          colorquantcycles: 2,
          mincolorratio: 0,
        });
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
    toast.success("SVG downloaded");
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

  /* In compare view the divider follows the pointer while it is held. */
  const moveDivider = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setCompare(Math.min(97, Math.max(3, ((event.clientX - box.left) / box.width) * 100)));
  };

  const splitting = view === "split" && !!result;

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.vectorforge}
      wideOutput
      output={
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <CardTitle className="text-base">Preview</CardTitle>
              <CardDescription>
                {!source
                  ? "Upload an image to begin."
                  : splitting
                    ? "Drag across the image to compare."
                    : `${source.originalWidth} × ${source.originalHeight} source`}
              </CardDescription>
            </div>
            {source && (
              <div className="w-56">
                <Segmented label="Preview mode" value={view} options={VIEWS} onChange={(value) => setView(value as View)} />
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <div
              className={cn(
                "border-border relative flex min-h-80 items-center justify-center overflow-hidden rounded-xl border select-none sm:min-h-[520px]",
                source && CHECKER,
                splitting && "cursor-ew-resize touch-none"
              )}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) void loadFile(file);
              }}
              onPointerDown={(event) => {
                if (!splitting) return;
                dragging.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                moveDivider(event);
              }}
              onPointerMove={(event) => {
                if (splitting && dragging.current) moveDivider(event);
              }}
              onPointerUp={() => {
                dragging.current = false;
              }}
            >
              {!source ? (
                <EmptyState onPick={() => inputRef.current?.click()} />
              ) : (
                <>
                  {/* Blob URLs stay local and cannot use Next's remote image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={source.previewUrl}
                    alt="Original image"
                    draggable={false}
                    className={cn("absolute inset-0 size-full object-contain p-6 sm:p-10", view === "vector" && "hidden")}
                  />
                  {result && view !== "original" && (
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={view === "split" ? { clipPath: `inset(0 0 0 ${compare}%)` } : undefined}
                    >
                      <div
                        aria-label="Vector preview"
                        role="img"
                        className="size-full p-6 sm:p-10 [&_svg]:size-full"
                        dangerouslySetInnerHTML={{ __html: result.svg }}
                      />
                    </div>
                  )}
                  {splitting && (
                    <div
                      className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-white shadow-[0_0_12px_rgb(0_0_0/0.35)]"
                      style={{ left: `${compare}%` }}
                    >
                      <span className="absolute top-1/2 left-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-neutral-700 shadow-md">
                        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                          <path d="M6 4 2 8l4 4M10 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                  )}
                  {splitting && (
                    <>
                      <span className="bg-background/85 border-border pointer-events-none absolute top-3 left-3 rounded-full border px-2.5 py-1 font-mono text-[10px] backdrop-blur">
                        Pixels
                      </span>
                      <span className="bg-background/85 border-border pointer-events-none absolute top-3 right-3 rounded-full border px-2.5 py-1 font-mono text-[10px] backdrop-blur">
                        Vector
                      </span>
                    </>
                  )}
                  {isTracing && (
                    <span className="bg-background/90 border-border absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur">
                      <LoaderCircleIcon className="text-primary size-3.5 animate-spin" aria-hidden />
                      Tracing
                    </span>
                  )}
                </>
              )}
            </div>

            {source && result && (
              <>
                <dl className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs">
                  <Stat label="paths" value={result.paths.toLocaleString()} />
                  <Stat label="colours" value={String(result.colors)} />
                  <Stat label="size" value={formatBytes(result.bytes)} />
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={exportSvg} className="flex-1">
                    <DownloadIcon /> SVG
                  </Button>
                  <Button variant="outline" onClick={() => void exportPng()} className="flex-1">
                    <DownloadIcon /> PNG
                  </Button>
                  <Button variant="outline" onClick={() => void copySvg()}>
                    <CopyIcon /> Copy code
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
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

        {/* Until there is a file, the preview itself is the drop zone. */}
        {source && (
          <Card>
            <CardContent>
              <div className="flex items-center gap-3">
                <ImageIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{source.name}</span>
                  <span className="text-muted-foreground block text-xs">{formatBytes(source.originalBytes)}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
                  <RepeatIcon /> Replace
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={removeSource} aria-label="Remove image">
                  <XIcon />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Style</CardTitle>
            <CardDescription>{PRESET_COPY[settings.preset].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Segmented
              label="Style"
              value={settings.preset}
              options={(Object.keys(PRESET_COPY) as VectorPreset[]).map((preset) => ({
                value: preset,
                label: PRESET_COPY[preset].label,
              }))}
              onChange={(preset) => applyPreset(preset as VectorPreset)}
            />
            <Control label="Colours" value={settings.colors} suffix="" min={2} max={24} step={1} onChange={(value) => updateSetting("colors", value)} />
            <Control label="Detail" value={settings.detail} suffix="%" min={10} max={100} step={1} onChange={(value) => updateSetting("detail", value)} />

            <button
              type="button"
              onClick={() => setAdvanced((value) => !value)}
              aria-expanded={advanced}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
            >
              <ChevronDownIcon className={cn("size-3.5 transition-transform", advanced && "rotate-180")} aria-hidden />
              {advanced ? "Fewer options" : "More options"}
            </button>
            {advanced && (
              <div className="space-y-5">
                <Control label="Curve smoothing" value={settings.smoothing} suffix="%" min={0} max={100} step={1} onChange={(value) => updateSetting("smoothing", value)} />
                <Control label="Noise cleanup" value={settings.cleanup} suffix="%" min={0} max={100} step={1} onChange={(value) => updateSetting("cleanup", value)} />
                <SwitchRow label="Sharp corners" description="Keeps corners crisp on icons, lettering and geometric marks." checked={settings.sharpCorners} onCheckedChange={(value) => updateSetting("sharpCorners", value)} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Background</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <SwitchRow label="Remove solid background" description="Reads the colour in the corners and drops it from the vector." checked={settings.removeBackground} onCheckedChange={(value) => updateSetting("removeBackground", value)} />
            {settings.removeBackground && (
              <Control label="Tolerance" value={settings.backgroundThreshold} suffix="%" min={2} max={60} step={1} onChange={(value) => updateSetting("backgroundThreshold", value)} />
            )}
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Palette</CardTitle>
              <CardDescription>Click a colour to change it in the vector.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {result.palette.map((color, index) => color.a > 0 && (
                <label key={`${index}-${colorToHex(color)}`} className="group cursor-pointer" title={colorToHex(color)}>
                  <span
                    className="border-border block size-9 rounded-lg border transition-transform group-hover:-translate-y-0.5"
                    style={{ backgroundColor: colorToHex(color), opacity: color.a / 255 }}
                  />
                  <input type="color" className="sr-only" value={colorToHex(color)} onChange={(event) => void updatePalette(index, event.target.value)} />
                </label>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </GeneratorLayout>
  );
}

/** The empty preview: a pixel staircase turning into a smooth curve, which is what the tool does. */
function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="group flex flex-col items-center gap-4 p-8 text-center">
      <svg viewBox="0 0 120 60" className="w-40" aria-hidden>
        {[
          [4, 44], [12, 44], [12, 36], [20, 36], [20, 28], [28, 28], [28, 20], [36, 20], [44, 20], [44, 12],
        ].map(([x, y], index) => (
          <rect key={index} x={x} y={y} width={8} height={8} className="fill-muted-foreground/30" />
        ))}
        <path d="M58 30h10m-4-4 4 4-4 4" fill="none" className="stroke-muted-foreground/60" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <path
          d="M76 52C84 52 88 44 92 34S104 16 116 16"
          fill="none"
          className="stroke-primary"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={76} cy={52} r={2.5} className="fill-background stroke-primary" strokeWidth={1.5} />
        <circle cx={116} cy={16} r={2.5} className="fill-background stroke-primary" strokeWidth={1.5} />
      </svg>
      <span className="space-y-1">
        <span className="block text-sm font-medium">Drop, paste or click to upload</span>
        <span className="text-muted-foreground block text-xs">Pixels in, editable SVG paths out.</span>
      </span>
    </button>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-muted/60 flex w-full gap-0.5 rounded-lg p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs transition-colors",
            value === option.value ? "bg-background text-foreground font-medium shadow-xs" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Control({ label, value, suffix, min, max, step, onChange }: { label: string; value: number; suffix: string; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next)} aria-label={label} />
    </div>
  );
}

function SwitchRow({ label, description, checked, onCheckedChange }: { label: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="text-foreground">{value}</span> {label}
      </dd>
    </div>
  );
}
