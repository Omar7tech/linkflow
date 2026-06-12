"use client";

import * as React from "react";
import {
  CpuIcon,
  DownloadIcon,
  EyeIcon,
  FlameIcon,
  Loader2Icon,
  Settings2Icon,
  SparklesIcon,
  TargetIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  computeSaliency,
  renderHeatmap,
  COLORMAPS,
  findHotspots,
  focusScore,
  mergeSaliencyMaps,
  type AttentionWeights,
  type BiasMode,
  type ColormapId,
  type Hotspot,
  type SaliencyResult,
} from "@/lib/attention";
import { cn } from "@/lib/utils";

const MAX_PIXELS = 4_000_000;
const WORKING_WIDTH = 400; // Downscale for fast processing

type AttentionMode = "precision" | "ai" | "hybrid";

interface AiState {
  phase: "idle" | "working" | "done" | "error";
  message?: string;
  progress?: number;
}

/** Hotspot marker diameter as a fraction of image width — one formula for screen and export. */
function hotspotDiameter(strength: number) {
  return 0.035 + 0.04 * strength;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function AttentionTool() {
  const [original, setOriginal] = React.useState<ImageData | null>(null);
  const [originalUrl, setOriginalUrl] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [mode, setMode] = React.useState<AttentionMode>("hybrid");
  const [ai, setAi] = React.useState<AiState>({ phase: "idle" });
  const [dragOver, setDragOver] = React.useState(false);
  const [comparing, setComparing] = React.useState(false);

  // Settings
  const [weights, setWeights] = React.useState<AttentionWeights>({
    contrast: 60,
    edges: 80,
    colorPop: 40,
  });
  const [bias, setBias] = React.useState<BiasMode>("center");
  const [hotspotCount, setHotspotCount] = React.useState(5);
  const [colormap, setColormap] = React.useState<ColormapId>("heat");
  const [opacity, setOpacity] = React.useState(0.75);
  const [showHotspots, setShowHotspots] = React.useState(true);
  const [showScanpath, setShowScanpath] = React.useState(true);

  // Cache for the AI map to avoid re-running the model unnecessarily
  const aiMapRef = React.useRef<{ url: string; map: Float32Array } | null>(null);

  // Saliency map at working resolution — hotspots/score/heatmap all derive from it.
  const [mapData, setMapData] = React.useState<{
    map: Float32Array;
    w: number;
    h: number;
  } | null>(null);
  const [heatmapUrl, setHeatmapUrl] = React.useState<string | null>(null);

  const loadFile = React.useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("That file isn't an image");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image too large (max 15MB)");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width * height > MAX_PIXELS) {
        const scale = Math.sqrt(MAX_PIXELS / (width * height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        toast.info("Large image scaled down to keep things fast");
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      setOriginal(ctx.getImageData(0, 0, width, height));
      setOriginalUrl(canvas.toDataURL("image/png"));
      setMapData(null);
      setHeatmapUrl(null);
      aiMapRef.current = null;
      setAi({ phase: "idle" });
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

  // Compute the saliency map (algorithmic, AI or merged).
  React.useEffect(() => {
    if (!original || !originalUrl) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      setProcessing(true);
      try {
        const scale = WORKING_WIDTH / original.width;
        const w = WORKING_WIDTH;
        const h = Math.round(original.height * scale);

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = original.width;
        tempCanvas.height = original.height;
        tempCanvas.getContext("2d")!.putImageData(original, 0, 0);

        const smallCanvas = document.createElement("canvas");
        smallCanvas.width = w;
        smallCanvas.height = h;
        smallCanvas.getContext("2d")!.drawImage(tempCanvas, 0, 0, w, h);
        const smallData = smallCanvas.getContext("2d")!.getImageData(0, 0, w, h);

        // Hotspots are derived later from the final map — skip them here.
        const algoRes = computeSaliency(smallData, weights, bias, 0);
        let finalMap = algoRes.map;

        if (mode === "ai" || mode === "hybrid") {
          if (!aiMapRef.current || aiMapRef.current.url !== originalUrl) {
            setAi({ phase: "working", message: "Loading AI model…", progress: -1 });
            const { computeSaliencyAI } = await import("@/lib/attention-ml");
            const aiMap = await computeSaliencyAI(originalUrl, w, h, (p) => {
              if (!cancelled) setAi({ phase: "working", ...p });
            });
            aiMapRef.current = { url: originalUrl, map: aiMap };
          }
          if (cancelled) return;
          finalMap =
            mode === "ai"
              ? aiMapRef.current.map
              : mergeSaliencyMaps(algoRes.map, aiMapRef.current.map, 0.5);
          setAi({ phase: "done" });
        }

        if (cancelled) return;
        setMapData({ map: finalMap, w, h });
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setAi({ phase: "error" });
        toast.error("AI analysis failed — Precision mode still works");
        setMode("precision");
      } finally {
        if (!cancelled) setProcessing(false);
      }
    }, mode === "precision" ? 150 : 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [original, originalUrl, weights, bias, mode]);

  // Hotspots and focus score derive from the map without re-running the pipeline.
  const result = React.useMemo<SaliencyResult | null>(() => {
    if (!mapData) return null;
    return {
      map: mapData.map,
      width: mapData.w,
      height: mapData.h,
      hotspots: findHotspots(mapData.map, mapData.w, mapData.h, hotspotCount),
      focus: focusScore(mapData.map),
    };
  }, [mapData, hotspotCount]);

  // Re-paint the heatmap when the map or colormap changes — nothing else recomputes.
  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!mapData) {
        setHeatmapUrl(null);
        return;
      }
      const res: SaliencyResult = {
        map: mapData.map,
        width: mapData.w,
        height: mapData.h,
        hotspots: [],
        focus: 0,
      };
      const heatmapData = renderHeatmap(res, colormap);
      const canvas = document.createElement("canvas");
      canvas.width = mapData.w;
      canvas.height = mapData.h;
      canvas.getContext("2d")!.putImageData(heatmapData, 0, 0);
      setHeatmapUrl(canvas.toDataURL("image/png"));
    });
    return () => {
      cancelled = true;
    };
  }, [mapData, colormap]);

  const clear = () => {
    setOriginal(null);
    setOriginalUrl(null);
    setMapData(null);
    setHeatmapUrl(null);
    aiMapRef.current = null;
    setAi({ phase: "idle" });
  };

  const download = async () => {
    if (!original || !originalUrl || !heatmapUrl || !result) return;
    try {
      const [img, hImg] = await Promise.all([loadImage(originalUrl), loadImage(heatmapUrl)]);
      const canvas = document.createElement("canvas");
      canvas.width = original.width;
      canvas.height = original.height;
      const ctx = canvas.getContext("2d")!;

      ctx.drawImage(img, 0, 0);
      ctx.globalAlpha = opacity;
      ctx.drawImage(hImg, 0, 0, original.width, original.height);
      ctx.globalAlpha = 1;

      const px = (p: Hotspot) => [p.x * original.width, p.y * original.height] as const;

      if (showScanpath && showHotspots && result.hotspots.length > 1) {
        ctx.beginPath();
        result.hotspots.forEach((p, i) => {
          const [x, y] = px(p);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.setLineDash([original.width / 90, original.width / 130]);
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = Math.max(2, original.width / 400);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (showHotspots) {
        result.hotspots.forEach((p, i) => {
          const [x, y] = px(p);
          // Same normalized diameter as the on-screen markers.
          const r = (hotspotDiameter(p.strength) * original.width) / 2;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fill();
          ctx.strokeStyle = "white";
          ctx.lineWidth = Math.max(2, original.width / 500);
          ctx.stroke();
          ctx.fillStyle = "white";
          ctx.font = `bold ${Math.max(12, r * 0.9)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(i + 1), x, y);
        });
      }

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "forma-attention.png";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Attention map downloaded");
      }, "image/png");
    } catch {
      toast.error("Export failed — try again");
    }
  };

  const overlaysVisible = !comparing;
  const manualDisabled = mode === "ai";

  return (
    <GeneratorLayout tool={TOOL_BY_ID.attention} output={null}>
      {!original ? (
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
              <EyeIcon className="text-muted-foreground/20 mb-6 size-16" />
              <Button asChild size="lg" className="cursor-pointer font-semibold">
                <label>
                  Select design screenshot
                  <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
                </label>
              </Button>
              <p className="text-muted-foreground mt-4 max-w-sm text-center text-xs font-medium">
                …or drag & drop, or paste from the clipboard. Predictive saliency mapping shows
                where users are likely to look first. Everything runs locally in your browser.
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
                  <FlameIcon className="text-primary size-4" />
                  Attention Map
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
                  <div className="relative inline-block overflow-hidden rounded-md shadow-2xl">
                    {originalUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element -- on-device data URL */
                      <img src={originalUrl} alt="Original" className="max-h-[600px] max-w-full" />
                    )}
                    {heatmapUrl && overlaysVisible && (
                      /* eslint-disable-next-line @next/next/no-img-element -- on-device data URL */
                      <img
                        src={heatmapUrl}
                        alt="Heatmap"
                        className="absolute inset-0 h-full w-full object-contain transition-opacity"
                        style={{ opacity }}
                      />
                    )}
                    {/* Scanpath — predicted gaze order, hotspot 1 → 2 → 3… */}
                    {overlaysVisible && showHotspots && showScanpath && result && result.hotspots.length > 1 && (
                      <svg
                        aria-hidden
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        <polyline
                          points={result.hotspots.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeDasharray="2.5 1.8"
                          opacity="0.85"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    )}
                    {overlaysVisible && showHotspots && result && (
                      <div aria-hidden className="pointer-events-none absolute inset-0">
                        {result.hotspots.map((p, i) => (
                          <div
                            key={i}
                            className="border-background absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-black/60 text-[10px] font-bold text-white shadow-xl backdrop-blur-sm"
                            style={{
                              left: `${p.x * 100}%`,
                              top: `${p.y * 100}%`,
                              width: `${hotspotDiameter(p.strength) * 100}%`,
                              minWidth: 18,
                            }}
                          >
                            {i + 1}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={download} disabled={!result || processing} className="font-semibold">
                    <DownloadIcon className="size-4" /> Download result
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!result}
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
                  {result && (
                    <div className="ml-auto text-right">
                      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        Focus Score
                      </p>
                      <p className="text-primary text-lg font-bold tabular-nums">{result.focus}%</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">How the modes work</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 text-xs leading-relaxed md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="font-bold">Precision</p>
                    <p className="text-muted-foreground">
                      Contrast, edge density and color rarity. Best for UI screens and landing
                      pages, where layout hierarchy drives attention.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold">Smart AI</p>
                    <p className="text-muted-foreground">
                      A neural network highlights foreground subjects — the people and products
                      eyes gravitate to. Best for photos and ads.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold">Hybrid</p>
                    <p className="text-muted-foreground">
                      Blends design structure with subject detection for the most balanced
                      prediction on mixed content.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0">
            <div className="space-y-6 lg:sticky lg:top-20">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Tabs value={mode} onValueChange={(v) => setMode(v as AttentionMode)}>
                    <TabsList className="w-full">
                      <TabsTrigger value="precision" className="flex-1">
                        <CpuIcon className="mr-2 size-3.5" /> Precision
                      </TabsTrigger>
                      <TabsTrigger value="ai" className="flex-1">
                        <SparklesIcon className="mr-2 size-3.5" /> Smart AI
                      </TabsTrigger>
                      <TabsTrigger value="hybrid" className="flex-1">
                        Hybrid
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {mode === "precision" ? (
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Instant and mathematical — re-runs live as you tune the weights below.
                    </p>
                  ) : mode === "ai" ? (
                    <div className="space-y-3">
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        Runs RMBG-1.4 entirely on your device (GPU when available). The model is
                        downloaded once and cached.
                      </p>
                      {ai.phase === "working" && (
                        <div className="bg-muted/50 space-y-2 rounded-lg p-3">
                          <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase">
                            <span>{ai.message}</span>
                            {ai.progress !== undefined && ai.progress > 0 && <span>{ai.progress}%</span>}
                          </div>
                          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                            <div
                              className={cn(
                                "bg-primary h-full transition-all duration-300",
                                ai.progress === -1 && "w-full animate-pulse"
                              )}
                              style={{ width: ai.progress === -1 ? "100%" : `${ai.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Structure and subjects, merged 50/50. Weights below shape the structural
                      half.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Settings2Icon className="size-4" />
                    Weights
                    {manualDisabled && (
                      <span className="text-muted-foreground text-[10px] font-normal">
                        (not used by Smart AI)
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className={cn("space-y-5", manualDisabled && "opacity-50")}>
                  <WeightSlider
                    label="Local Contrast"
                    value={weights.contrast}
                    disabled={manualDisabled}
                    onChange={(v) => setWeights((p) => ({ ...p, contrast: v }))}
                  />
                  <WeightSlider
                    label="Edge Density"
                    value={weights.edges}
                    disabled={manualDisabled}
                    onChange={(v) => setWeights((p) => ({ ...p, edges: v }))}
                  />
                  <WeightSlider
                    label="Color Pop"
                    value={weights.colorPop}
                    disabled={manualDisabled}
                    onChange={(v) => setWeights((p) => ({ ...p, colorPop: v }))}
                  />

                  <div className="space-y-2 pt-2">
                    <Label className="text-muted-foreground text-[11px] tracking-wider uppercase">
                      Viewing Bias
                    </Label>
                    <Tabs value={bias} onValueChange={(v) => setBias(v as BiasMode)}>
                      <TabsList className="w-full">
                        <TabsTrigger value="none" disabled={manualDisabled} className="text-xs">
                          None
                        </TabsTrigger>
                        <TabsTrigger value="center" disabled={manualDisabled} className="text-xs">
                          Center
                        </TabsTrigger>
                        <TabsTrigger value="f" disabled={manualDisabled} className="text-xs">
                          F-Pattern
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TargetIcon className="size-4" />
                    Visualization
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-[11px] tracking-wider uppercase">
                      Colormap
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {COLORMAPS.map((cm) => (
                        <button
                          key={cm.id}
                          onClick={() => setColormap(cm.id)}
                          className={cn(
                            "group relative h-10 overflow-hidden rounded-lg border-2 transition-all",
                            colormap === cm.id
                              ? "border-primary"
                              : "border-border hover:border-muted-foreground/50"
                          )}
                          title={cm.name}
                        >
                          <div
                            className="absolute inset-0 flex"
                            style={{
                              background: `linear-gradient(to right, ${cm.stops.map((s) => `rgb(${s.join(",")})`).join(",")})`,
                            }}
                          />
                          <span
                            className={cn(
                              "absolute inset-0 flex items-center justify-center text-[10px] font-bold tracking-tighter uppercase drop-shadow-md",
                              colormap === cm.id ? "text-white" : "text-white/80"
                            )}
                          >
                            {cm.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground text-[11px] tracking-wider uppercase">
                        Overlay Opacity
                      </Label>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {Math.round(opacity * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[opacity]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={([v]) => setOpacity(v)}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Label htmlFor="show-hotspots" className="cursor-pointer text-sm font-medium">
                      Hotspots
                    </Label>
                    <Switch
                      id="show-hotspots"
                      checked={showHotspots}
                      onCheckedChange={setShowHotspots}
                    />
                  </div>

                  {showHotspots && (
                    <>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-scanpath" className="cursor-pointer text-sm font-medium">
                          Scanpath (gaze order)
                        </Label>
                        <Switch
                          id="show-scanpath"
                          checked={showScanpath}
                          onCheckedChange={setShowScanpath}
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-muted-foreground text-[11px] tracking-wider uppercase">
                            Hotspot Count
                          </Label>
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {hotspotCount}
                          </span>
                        </div>
                        <Slider
                          value={[hotspotCount]}
                          min={1}
                          max={12}
                          step={1}
                          onValueChange={([v]) => setHotspotCount(v)}
                        />
                      </div>
                    </>
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

function WeightSlider({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-muted-foreground font-mono text-[10px]">{value}</span>
      </div>
      <Slider value={[value]} min={0} max={100} disabled={disabled} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}
