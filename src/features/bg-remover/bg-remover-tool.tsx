"use client";

import * as React from "react";
import {
  DownloadIcon,
  EraserIcon,
  EyeIcon,
  ImageIcon,
  Loader2Icon,
  PipetteIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  detectBgColor,
  removeBackground,
  rgbToHexStr,
  trimTransparent,
  type RemoveOptions,
} from "@/lib/bg-remove";
import type { RGB } from "@/lib/colorExtract";
import { cn } from "@/lib/utils";

const MAX_PIXELS = 6_000_000;

const CHECKER: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #d4d4d8 25%, transparent 25%), linear-gradient(-45deg, #d4d4d8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d4d4d8 75%), linear-gradient(-45deg, transparent 75%, #d4d4d8 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
  backgroundColor: "#fafafa",
};

type Backdrop = "checker" | "white" | "black" | "custom";
type Method = "ai" | "color";

interface AiState {
  phase: "idle" | "working" | "done" | "error";
  message?: string;
  /** 0–100, or -1 for indeterminate. */
  progress?: number;
}

export function BgRemoverTool() {
  const [original, setOriginal] = React.useState<ImageData | null>(null);
  const [originalUrl, setOriginalUrl] = React.useState<string | null>(null);
  const [method, setMethod] = React.useState<Method>("ai");
  const [ai, setAi] = React.useState<AiState>({ phase: "idle" });
  /** True once the model has produced a result — later uploads auto-run. */
  const [modelWarm, setModelWarm] = React.useState(false);

  const [bg, setBg] = React.useState<RGB>([255, 255, 255]);
  const [tolerance, setTolerance] = React.useState(24);
  const [soft, setSoft] = React.useState(12);
  const [colorMode, setColorMode] = React.useState<RemoveOptions["mode"]>("edges");

  const [trim, setTrim] = React.useState(true);
  const [padding, setPadding] = React.useState(16);
  const [backdrop, setBackdrop] = React.useState<Backdrop>("checker");
  const [customBackdrop, setCustomBackdrop] = React.useState("#1e293b");
  const [picking, setPicking] = React.useState(false);
  const [comparing, setComparing] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);

  /** Untrimmed result of whichever method ran last. */
  const [result, setResult] = React.useState<ImageData | null>(null);
  const [stats, setStats] = React.useState<{ w: number; h: number; removed: number } | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const overlayRef = React.useRef<HTMLImageElement>(null);
  const finalRef = React.useRef<ImageData | null>(null);
  const aiResultRef = React.useRef<ImageData | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Image too large (max 12MB)");
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
      const data = ctx.getImageData(0, 0, width, height);
      setOriginal(data);
      setOriginalUrl(canvas.toDataURL("image/png"));
      setBg(detectBgColor(data));
      setResult(null);
      setStats(null);
      setAi((prev) => (prev.phase === "working" ? prev : { phase: "idle" }));
      aiResultRef.current = null;
      finalRef.current = null;
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      toast.error("Could not read that image");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const runAi = React.useCallback(
    async (src: ImageData, srcUrl: string) => {
      setAi({ phase: "working", message: "Warming up…", progress: -1 });
      try {
        const { removeBackgroundAI } = await import("@/lib/bg-ml");
        const out = await removeBackgroundAI(src, srcUrl, (p) =>
          setAi({ phase: "working", message: p.message, progress: p.progress })
        );
        aiResultRef.current = out;
        setResult(out);
        setAi({ phase: "done" });
        setModelWarm(true);
      } catch (err) {
        console.error(err);
        setAi({ phase: "error" });
        toast.error("AI removal failed — the color-match mode still works offline");
      }
    },
    []
  );

  // Once the model is warm, new uploads in AI mode run automatically.
  React.useEffect(() => {
    if (!original || !originalUrl || method !== "ai" || !modelWarm) return;
    if (aiResultRef.current) return;
    const id = setTimeout(() => runAi(original, originalUrl), 50);
    return () => clearTimeout(id);
  }, [original, originalUrl, method, modelWarm, runAi]);

  // Color-match pipeline — instant, debounced, only while that method is active.
  React.useEffect(() => {
    if (!original || method !== "color") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setProcessing(true);
    });
    const timer = setTimeout(() => {
      if (cancelled) return;
      setResult(removeBackground(original, { bg, tolerance, soft, mode: colorMode }));
      setProcessing(false);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [original, bg, tolerance, soft, colorMode, method]);

  // Draw pipeline — applies trim/padding and renders whichever result is current.
  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!result) {
        finalRef.current = null;
        setStats(null);
        return;
      }
      let removed = 0;
      for (let i = 3; i < result.data.length; i += 4) if (result.data[i] < 8) removed++;
      const removedPct = Math.round((removed / (result.width * result.height)) * 100);
      const final = (trim ? trimTransparent(result, padding) : null) ?? result;
      finalRef.current = final;
      canvas.width = final.width;
      canvas.height = final.height;
      canvas.getContext("2d")!.putImageData(final, 0, 0);
      setStats({ w: final.width, h: final.height, removed: removedPct });
    });
    return () => {
      cancelled = true;
    };
  }, [result, trim, padding]);

  const switchMethod = (m: Method) => {
    setMethod(m);
    setPicking(false);
    if (m === "ai") setResult(aiResultRef.current);
  };

  const pickColor = (e: React.MouseEvent) => {
    const img = overlayRef.current;
    if (!img || !original) return;
    const rect = img.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * original.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * original.height);
    const i =
      (Math.min(Math.max(y, 0), original.height - 1) * original.width +
        Math.min(Math.max(x, 0), original.width - 1)) *
      4;
    setBg([original.data[i], original.data[i + 1], original.data[i + 2]]);
    setPicking(false);
    toast.success("Background color picked");
  };

  const download = () => {
    const final = finalRef.current;
    if (!final) return;
    const canvas = document.createElement("canvas");
    canvas.width = final.width;
    canvas.height = final.height;
    canvas.getContext("2d")!.putImageData(final, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "background-removed.png";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Transparent PNG downloaded");
    }, "image/png");
  };

  const clear = () => {
    setOriginal(null);
    setOriginalUrl(null);
    setResult(null);
    setStats(null);
    setAi({ phase: "idle" });
    aiResultRef.current = null;
    finalRef.current = null;
  };

  const stageStyle: React.CSSProperties =
    backdrop === "checker"
      ? CHECKER
      : { backgroundColor: backdrop === "custom" ? customBackdrop : backdrop };

  const busy = processing || ai.phase === "working";
  const showOriginal = picking || comparing || !result;

  return (
    <GeneratorLayout tool={TOOL_BY_ID.bgremover} output={null}>
      {!original ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20">
              <ImageIcon className="text-muted-foreground/20 mb-6 size-16" />
              <label className="cursor-pointer">
                <span className="bg-foreground text-background inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-bold tracking-tight shadow-xl transition-all hover:-translate-y-0.5 active:scale-95">
                  Select an Image
                </span>
                <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
              </label>
              <p className="text-muted-foreground mt-4 max-w-sm text-center text-xs font-medium">
                PNG or JPG up to 12MB. AI segmentation for photos and complex logos, instant
                color-matching for flat ones — everything runs on your device, nothing is uploaded.
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
                  <EraserIcon className="text-primary size-4" />
                  Result
                  {busy && (
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
                <div
                  className={cn(
                    "relative flex min-h-64 items-center justify-center overflow-hidden rounded-xl border p-4",
                    picking && "cursor-crosshair"
                  )}
                  style={stageStyle}
                >
                  <canvas
                    ref={canvasRef}
                    className={cn("max-h-[440px] max-w-full", showOriginal && "invisible")}
                    style={{ width: "auto", height: "auto" }}
                  />
                  {originalUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element -- on-device data URL */
                    <img
                      ref={overlayRef}
                      src={originalUrl}
                      alt="Original"
                      onClick={picking ? pickColor : undefined}
                      className={cn(
                        "absolute max-h-[440px] max-w-[calc(100%-2rem)]",
                        !showOriginal && "pointer-events-none opacity-0"
                      )}
                    />
                  )}
                  {picking && (
                    <span className="bg-foreground text-background absolute top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold">
                      Click the background color to remove
                    </span>
                  )}
                  {!result && !busy && method === "ai" && (
                    <span className="bg-foreground/80 text-background absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold backdrop-blur">
                      Original — run the AI to remove the background
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={download} disabled={!result || busy} className="font-bold">
                    <DownloadIcon className="size-4" /> Download PNG
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!result}
                    onPointerDown={() => setComparing(true)}
                    onPointerUp={() => setComparing(false)}
                    onPointerLeave={() => setComparing(false)}
                    title="Hold to see the original"
                  >
                    <EyeIcon className="size-4" /> Hold to compare
                  </Button>
                  {stats && (
                    <span className="text-muted-foreground ml-auto font-mono text-[11px]">
                      {stats.w}×{stats.h} · {stats.removed}% removed
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0">
            <div className="space-y-6 lg:sticky lg:top-20">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Method</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Tabs value={method} onValueChange={(v) => switchMethod(v as Method)}>
                    <TabsList className="w-full">
                      <TabsTrigger value="ai" className="flex-1">
                        <SparklesIcon className="size-3.5" /> Smart AI
                      </TabsTrigger>
                      <TabsTrigger value="color" className="flex-1">
                        <PipetteIcon className="size-3.5" /> Color match
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {method === "ai" ? (
                    <div className="space-y-4">
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        A neural network (RMBG-1.4) finds the subject — photos, gradients, busy
                        backgrounds, anything. It runs entirely in your browser
                        {typeof navigator !== "undefined" && "gpu" in navigator
                          ? ", accelerated by your GPU"
                          : ""}
                        . The ~44MB model downloads once and is cached.
                      </p>
                      {ai.phase === "working" ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium">{ai.message}</p>
                          <div className="bg-muted h-2 overflow-hidden rounded-full">
                            <div
                              className={cn(
                                "bg-primary h-full rounded-full transition-all",
                                (ai.progress ?? -1) < 0 && "animate-pulse"
                              )}
                              style={{
                                width: `${(ai.progress ?? -1) < 0 ? 100 : ai.progress}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <Button
                          onClick={() => original && originalUrl && runAi(original, originalUrl)}
                          className="w-full font-bold"
                        >
                          <SparklesIcon className="size-4" />
                          {ai.phase === "done" ? "Run again" : "Remove background with AI"}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Instant and offline — perfect for logos on a flat color. The background was
                        detected automatically; pick from the image if it guessed wrong.
                      </p>
                      <div className="space-y-2">
                        <Label>Background color</Label>
                        <div className="flex items-center gap-2">
                          <span
                            className="border-border size-9 rounded-lg border"
                            style={{ backgroundColor: rgbToHexStr(bg) }}
                            aria-hidden
                          />
                          <code className="text-muted-foreground font-mono text-xs">
                            {rgbToHexStr(bg)}
                          </code>
                          <Button
                            variant={picking ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPicking((p) => !p)}
                            className="ml-auto h-8 text-xs"
                          >
                            <PipetteIcon className="size-3.5" />
                            {picking ? "Picking…" : "Pick from image"}
                          </Button>
                        </div>
                      </div>

                      <Tabs
                        value={colorMode}
                        onValueChange={(v) => setColorMode(v as RemoveOptions["mode"])}
                      >
                        <TabsList className="w-full">
                          <TabsTrigger value="edges" className="flex-1">
                            From edges
                          </TabsTrigger>
                          <TabsTrigger value="global" className="flex-1">
                            Everywhere
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <p className="text-muted-foreground -mt-3 text-xs">
                        {colorMode === "edges"
                          ? "Removes from the outside in — enclosed shapes are kept."
                          : "Removes the color everywhere, including inside letters."}
                      </p>

                      <RemovalSlider
                        label="Tolerance"
                        hint="How different a pixel may be and still count as background."
                        value={tolerance}
                        min={0}
                        max={120}
                        onChange={setTolerance}
                      />
                      <RemovalSlider
                        label="Edge softness"
                        hint="Feathers and defringes the boundary so edges stay clean."
                        value={soft}
                        min={0}
                        max={60}
                        onChange={setSoft}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Output</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex items-center gap-3">
                    <Switch checked={trim} onCheckedChange={setTrim} aria-label="Auto-trim" />
                    <span className="text-sm">
                      Auto-trim
                      <span className="text-muted-foreground block text-xs">
                        Crop the PNG to the content with even padding.
                      </span>
                    </span>
                  </label>
                  {trim && (
                    <RemovalSlider
                      label="Padding"
                      hint=""
                      value={padding}
                      min={0}
                      max={80}
                      onChange={setPadding}
                    />
                  )}

                  <div className="space-y-2">
                    <Label>Preview on</Label>
                    <div className="flex items-center gap-2">
                      {(
                        [
                          ["checker", CHECKER],
                          ["white", { backgroundColor: "#ffffff" }],
                          ["black", { backgroundColor: "#000000" }],
                        ] as [Backdrop, React.CSSProperties][]
                      ).map(([id, style]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setBackdrop(id)}
                          className={cn(
                            "size-8 rounded-lg border-2",
                            backdrop === id ? "border-primary" : "border-border/60"
                          )}
                          style={style}
                          aria-label={`Preview on ${id}`}
                        />
                      ))}
                      <Input
                        type="color"
                        value={customBackdrop}
                        onChange={(e) => {
                          setCustomBackdrop(e.target.value);
                          setBackdrop("custom");
                        }}
                        onClick={() => setBackdrop("custom")}
                        className={cn(
                          "h-8 w-10 cursor-pointer p-1",
                          backdrop === "custom" && "ring-primary ring-2"
                        )}
                        aria-label="Custom preview color"
                      />
                      <span className="text-muted-foreground text-xs">
                        Check edges on light & dark.
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </GeneratorLayout>
  );
}

function RemovalSlider({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-muted-foreground font-mono text-xs">{value}</span>
      </div>
      <Slider min={min} max={max} value={[value]} onValueChange={([v]) => onChange(v)} />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
