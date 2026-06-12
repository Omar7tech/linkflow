"use client";

import * as React from "react";
import {
  DownloadIcon,
  EyeIcon,
  ImageIcon,
  Loader2Icon,
  Trash2Icon,
  Settings2Icon,
  FlameIcon,
  TargetIcon,
  SparklesIcon,
  CpuIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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

export function AttentionTool() {
  const [original, setOriginal] = React.useState<ImageData | null>(null);
  const [originalUrl, setOriginalUrl] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [mode, setMode] = React.useState<AttentionMode>("hybrid");
  const [ai, setAi] = React.useState<AiState>({ phase: "idle" });

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

  // Cache for the AI map to avoid re-running the model unnecessarily
  const aiMapRef = React.useRef<{ url: string; map: Float32Array } | null>(null);

  // Results
  const [result, setResult] = React.useState<SaliencyResult | null>(null);
  const [heatmapUrl, setHeatmapUrl] = React.useState<string | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
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
        toast.info("Image scaled down for performance");
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      const data = ctx.getImageData(0, 0, width, height);
      setOriginal(data);
      const dataUrl = canvas.toDataURL("image/png");
      setOriginalUrl(dataUrl);
      setResult(null);
      setHeatmapUrl(null);
      aiMapRef.current = null;
      setAi({ phase: "idle" });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      toast.error("Could not read image");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // Processing pipeline
  React.useEffect(() => {
    if (!original || !originalUrl) return;
    let cancelled = false;
    
    async function run() {
      setProcessing(true);

      const scale = WORKING_WIDTH / original!.width;
      const w = WORKING_WIDTH;
      const h = Math.round(original!.height * scale);

      let finalMap: Float32Array;

      // 1. Get Algorithmic Map (Precision)
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = original!.width;
      tempCanvas.height = original!.height;
      tempCanvas.getContext("2d")!.putImageData(original!, 0, 0);
      
      const smallCanvas = document.createElement("canvas");
      smallCanvas.width = w;
      smallCanvas.height = h;
      smallCanvas.getContext("2d")!.drawImage(tempCanvas, 0, 0, w, h);
      const smallData = smallCanvas.getContext("2d")!.getImageData(0, 0, w, h);
      
      const algoRes = computeSaliency(smallData, weights, bias, hotspotCount);
      finalMap = algoRes.map;

      // 2. Get/Merge AI Map
      if (mode === "ai" || mode === "hybrid") {
        try {
          if (!aiMapRef.current || aiMapRef.current.url !== originalUrl) {
            setAi({ phase: "working", message: "Loading AI model...", progress: -1 });
            const { computeSaliencyAI } = await import("@/lib/attention-ml");
            const aiMap = await computeSaliencyAI(originalUrl!, w, h, (p) => {
              setAi({ phase: "working", ...p });
            });
            aiMapRef.current = { url: originalUrl!, map: aiMap };
          }
          
          if (mode === "ai") {
            finalMap = aiMapRef.current.map;
          } else {
            // Hybrid: Merge them 50/50
            finalMap = mergeSaliencyMaps(algoRes.map, aiMapRef.current.map, 0.5);
          }
          setAi({ phase: "done" });
        } catch (err) {
          console.error(err);
          setAi({ phase: "error" });
          toast.error("Smart AI failed — precision mode still works");
          setMode("precision");
          return;
        }
      }

      if (cancelled) return;

      const res: SaliencyResult = {
        map: finalMap,
        width: w,
        height: h,
        hotspots: findHotspots(finalMap, w, h, hotspotCount),
        focus: focusScore(finalMap),
      };

      setResult(res);

      // Render heatmap
      const heatmapData = renderHeatmap(res, colormap);
      const hCanvas = document.createElement("canvas");
      hCanvas.width = w;
      hCanvas.height = h;
      hCanvas.getContext("2d")!.putImageData(heatmapData, 0, 0);
      setHeatmapUrl(hCanvas.toDataURL("image/png"));
      setProcessing(false);
    }

    const timer = setTimeout(run, mode === "precision" ? 150 : 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [original, originalUrl, weights, bias, hotspotCount, colormap, mode]);

  const clear = () => {
    setOriginal(null);
    setOriginalUrl(null);
    setResult(null);
    setHeatmapUrl(null);
    aiMapRef.current = null;
    setAi({ phase: "idle" });
  };

  const imgRef = React.useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = React.useState<{ w: number; h: number } | null>(null);

  const updateImgSize = () => {
    if (imgRef.current) {
      setImgSize({
        w: imgRef.current.clientWidth,
        h: imgRef.current.clientHeight,
      });
    }
  };

  React.useEffect(() => {
    window.addEventListener("resize", updateImgSize);
    return () => window.removeEventListener("resize", updateImgSize);
  }, []);

  const download = () => {
    if (!original || !heatmapUrl) return;
    const canvas = document.createElement("canvas");
    canvas.width = original.width;
    canvas.height = original.height;
    const ctx = canvas.getContext("2d")!;
    
    // Draw original
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      
      // Draw heatmap overlay
      const hImg = new Image();
      hImg.onload = () => {
        ctx.globalAlpha = opacity;
        ctx.drawImage(hImg, 0, 0, original.width, original.height);
        
        // Draw hotspots if enabled
        if (showHotspots && result) {
          ctx.globalAlpha = 1;
          result.hotspots.forEach((p, i) => {
            const x = p.x * original.width;
            const y = p.y * original.height;
            const r = Math.max(12, (original.width / 40) * p.strength);
            
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.strokeStyle = "white";
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.strokeStyle = "black";
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = "white";
            ctx.font = `bold ${Math.max(12, r * 0.8)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText((i + 1).toString(), x, y);
          });
        }

        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "attention-map.png";
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Attention map downloaded");
        }, "image/png");
      };
      hImg.src = heatmapUrl;
    };
    img.src = originalUrl!;
  };

  return (
    <GeneratorLayout tool={TOOL_BY_ID.attention} output={null}>
      {!original ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20">
              <EyeIcon className="text-muted-foreground/20 mb-6 size-16" />
              <label className="cursor-pointer">
                <span className="bg-foreground text-background inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-bold tracking-tight shadow-xl transition-all hover:-translate-y-0.5 active:scale-95">
                  Select Design Screenshot
                </span>
                <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
              </label>
              <p className="text-muted-foreground mt-4 max-w-sm text-center text-xs font-medium">
                Upload a screenshot of your UI, landing page or ad. Predictive saliency mapping
                shows where users are likely to focus first. Everything runs locally in your browser.
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
                <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl border bg-zinc-950 p-4">
                  <div className="relative inline-block overflow-hidden rounded-md shadow-2xl">
                    {originalUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element -- on-device data URL */
                      <img
                        ref={imgRef}
                        src={originalUrl}
                        alt="Original"
                        onLoad={updateImgSize}
                        className="max-h-[600px] max-w-full"
                      />
                    )}
                    {heatmapUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element -- on-device data URL */
                      <img
                        src={heatmapUrl}
                        alt="Heatmap"
                        className="absolute inset-0 h-full w-full object-contain transition-opacity"
                        style={{ opacity }}
                      />
                    )}
                    {showHotspots && result && imgSize && (
                      <div 
                        className="pointer-events-none absolute inset-0"
                        style={{ width: imgSize.w, height: imgSize.h }}
                      >
                        {result.hotspots.map((p, i) => (
                          <div
                            key={i}
                            className="border-background absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-black/60 text-[10px] font-bold text-white shadow-xl backdrop-blur-sm"
                            style={{
                              left: `${p.x * 100}%`,
                              top: `${p.y * 100}%`,
                              width: `${Math.max(18, 36 * p.strength)}px`,
                              height: `${Math.max(18, 36 * p.strength)}px`,
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
                  <Button onClick={download} disabled={!result || processing} className="font-bold">
                    <DownloadIcon className="size-4" /> Download Result
                  </Button>
                  {result && (
                    <div className="ml-auto flex items-center gap-4">
                       <div className="text-right">
                        <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">Focus Score</p>
                        <p className="text-lg font-bold tabular-nums text-primary">{result.focus}%</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Intelligence Modes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 text-xs leading-relaxed md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="font-bold">Precision (Local Cues)</p>
                    <p className="text-muted-foreground">Uses contrast, edge density and color rarity. Perfect for UI hierarchy where mathematical layout drives attention.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold">Smart AI (Semantic)</p>
                    <p className="text-muted-foreground">Uses a neural network (RMBG-1.4) to find people, products and subjects that humans are biologically wired to look at.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold">Hybrid (The Smartest)</p>
                    <p className="text-muted-foreground">Combines both approaches to predict fixations across both the abstract design structure and the actual content.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0">
            <div className="space-y-6 lg:sticky lg:top-20">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Intelligence</CardTitle>
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
                      Instant and mathematical. Best for UI design and landing pages where contrast, 
                      text density and layout hierarchy drive attention.
                    </p>
                  ) : mode === "ai" ? (
                    <div className="space-y-3">
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        Neural network (RMBG-1.4) identifies semantically important subjects. 
                        Best for photos, ads and products. Runs entirely on your GPU/device.
                      </p>
                      {ai.phase === "working" && (
                        <div className="space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                           <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                            <span>{ai.message}</span>
                            {ai.progress !== undefined && ai.progress > 0 && <span>{ai.progress}%</span>}
                          </div>
                          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                            <div 
                              className={cn("bg-primary h-full transition-all duration-300", ai.progress === -1 && "w-full animate-pulse")} 
                              style={{ width: ai.progress === -1 ? "100%" : `${ai.progress}%` }} 
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      The "Smartest" mode. Combines algorithmic hierarchy with neural object 
                      detection to predict fixations across both structure and content.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Settings2Icon className="size-4" />
                    {mode === "ai" ? "Manual Tuning (Disabled)" : "Weights"}
                  </CardTitle>
                </CardHeader>
                <CardContent className={cn("space-y-5", mode === "ai" && "pointer-events-none opacity-50")}>
                  <WeightSlider
                    label="Local Contrast"
                    value={weights.contrast}
                    onChange={(v) => setWeights(p => ({ ...p, contrast: v }))}
                  />
                  <WeightSlider
                    label="Edge Density"
                    value={weights.edges}
                    onChange={(v) => setWeights(p => ({ ...p, edges: v }))}
                  />
                  <WeightSlider
                    label="Color Pop"
                    value={weights.colorPop}
                    onChange={(v) => setWeights(p => ({ ...p, colorPop: v }))}
                  />
                  
                  <div className="space-y-2 pt-2">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Viewing Bias</Label>
                    <Tabs value={bias} onValueChange={(v) => setBias(v as BiasMode)}>
                      <TabsList className="w-full">
                        <TabsTrigger value="none" className="text-xs">None</TabsTrigger>
                        <TabsTrigger value="center" className="text-xs">Center</TabsTrigger>
                        <TabsTrigger value="f" className="text-xs">F-Pattern</TabsTrigger>
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
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Colormap</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {COLORMAPS.map((cm) => (
                        <button
                          key={cm.id}
                          onClick={() => setColormap(cm.id)}
                          className={cn(
                            "group relative h-10 overflow-hidden rounded-lg border-2 transition-all",
                            colormap === cm.id ? "border-primary" : "border-border hover:border-muted-foreground/50"
                          )}
                          title={cm.name}
                        >
                          <div 
                            className="absolute inset-0 flex"
                            style={{ 
                              background: `linear-gradient(to right, ${cm.stops.map(s => `rgb(${s.join(',')})`).join(',')})`
                            }}
                          />
                          <span className={cn(
                            "absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-tighter drop-shadow-md",
                            colormap === cm.id ? "text-white" : "text-white/80"
                          )}>
                            {cm.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Overlay Opacity</Label>
                      <span className="font-mono text-[10px] text-muted-foreground">{Math.round(opacity * 100)}%</span>
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
                    <Label className="cursor-pointer text-sm font-medium" htmlFor="show-hotspots">Show Hotspots</Label>
                    <Button
                      id="show-hotspots"
                      variant={showHotspots ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      onClick={() => setShowHotspots(!showHotspots)}
                    >
                      {showHotspots ? "Enabled" : "Disabled"}
                    </Button>
                  </div>

                  {showHotspots && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Hotspot Count</Label>
                        <span className="font-mono text-[10px] text-muted-foreground">{hotspotCount}</span>
                      </div>
                      <Slider
                        value={[hotspotCount]}
                        min={1}
                        max={12}
                        step={1}
                        onValueChange={([v]) => setHotspotCount(v)}
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

function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="font-mono text-[10px] text-muted-foreground">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={100}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}
