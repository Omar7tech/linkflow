"use client";

import * as React from "react";
import {
  DownloadIcon,
  PlusIcon,
  ShuffleIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import {
  MESH_PRESETS,
  makePoint,
  presetToConfig,
  shuffleColors,
  toCss,
  toStyle,
  toSvg,
  type MeshConfig,
} from "@/lib/mesh";
import { cn } from "@/lib/utils";

const MAX_POINTS = 7;

export function MeshTool() {
  const history = useHistory("mesh");
  const [config, setConfig] = React.useState<MeshConfig>(() =>
    presetToConfig(MESH_PRESETS[0]),
  );
  const [presetId, setPresetId] = React.useState(MESH_PRESETS[0].id);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const stageRef = React.useRef<HTMLDivElement>(null);
  const dragId = React.useRef<string | null>(null);

  const patch = (next: Partial<MeshConfig>) => {
    setPresetId("custom");
    setConfig((prev) => ({ ...prev, ...next }));
  };

  const loadPreset = (id: string) => {
    const preset = MESH_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setConfig((prev) => presetToConfig(preset, prev.spread, prev.grain));
    setActiveId(null);
  };

  const setPointColor = (id: string, color: string) => {
    patch({
      points: config.points.map((p) => (p.id === id ? { ...p, color } : p)),
    });
  };

  const addPoint = () => {
    if (config.points.length >= MAX_POINTS) return;
    const colors = config.points.map((p) => p.color);
    const point = makePoint(50, 50, colors[colors.length - 1] ?? "#10b981");
    patch({ points: [...config.points, point] });
    setActiveId(point.id);
  };

  const removePoint = (id: string) => {
    if (config.points.length <= 2) return;
    patch({ points: config.points.filter((p) => p.id !== id) });
    if (activeId === id) setActiveId(null);
  };

  const startDrag = (id: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setActiveId(id);
    dragId.current = id;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      if (dragId.current !== id) return;
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      const y = ((ev.clientY - rect.top) / rect.height) * 100;
      setPresetId("custom");
      setConfig((prev) => ({
        ...prev,
        points: prev.points.map((p) =>
          p.id === id
            ? {
                ...p,
                x: Math.min(Math.max(x, 0), 100),
                y: Math.min(Math.max(y, 0), 100),
              }
            : p,
        ),
      }));
    };
    const onUp = () => {
      dragId.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const css = toCss(config);
  const svg = toSvg(config);
  const commit = () =>
    history.add(`Mesh · ${config.points.length} colors · ${config.base}`, css);

  const downloadPng = async () => {
    try {
      const blob = new Blob([toSvg(config, 1600, 1000)], {
        type: "image/svg+xml",
      });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 1000;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (!png) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(png);
        a.download = "mesh-gradient.png";
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");
      commit();
      toast.success("PNG downloaded");
    } catch {
      toast.error("Could not render PNG");
    }
  };

  const exportTabs = [
    { id: "css", name: "CSS", code: css },
    { id: "svg", name: "SVG", code: svg },
  ];

  const active = config.points.find((p) => p.id === activeId) ?? null;

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.mesh}
      output={null}
      footer={<HistoryPanel history={history} />}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        {/* The gradient is the point — give it the wide column. Controls sit in
            the narrow right column; both lead correctly on mobile. */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="lg:sticky lg:top-20">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <SparklesIcon className="text-primary size-4" />
                  Preview
                </CardTitle>
                <CardDescription>
                  Drag the dots to move each color. Click a dot to recolor or
                  remove it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  ref={stageRef}
                  className="relative h-80 w-full touch-none overflow-hidden rounded-xl select-none sm:h-96 lg:h-[34rem]"
                  style={toStyle(config)}
                >
                  {config.points.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onPointerDown={startDrag(p.id)}
                      className={cn(
                        "absolute size-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 shadow-md ring-2 transition-transform active:cursor-grabbing active:scale-110",
                        activeId === p.id
                          ? "border-white ring-black/40 scale-110"
                          : "border-white/80 ring-black/20",
                      )}
                      style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        backgroundColor: p.color,
                      }}
                      aria-label={`Color point ${p.color}`}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addPoint}
                    disabled={config.points.length >= MAX_POINTS}
                    className="h-8 text-xs"
                  >
                    <PlusIcon className="size-3.5" /> Add color
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => patch({ points: shuffleColors(config.points) })}
                    className="h-8 text-xs"
                  >
                    <ShuffleIcon className="size-3.5" /> Shuffle
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={downloadPng}
                    className="text-muted-foreground ml-auto h-8 text-xs"
                  >
                    <DownloadIcon className="size-3.5" /> PNG
                  </Button>
                </div>

                {active && (
                  <div className="border-border/60 flex items-center gap-3 rounded-lg border p-2.5">
                    <Input
                      type="color"
                      value={active.color}
                      onChange={(e) => setPointColor(active.id, e.target.value)}
                      className="h-8 w-12 cursor-pointer p-1"
                      aria-label="Active color"
                    />
                    <span className="font-mono text-xs">{active.color}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePoint(active.id)}
                      disabled={config.points.length <= 2}
                      className="text-muted-foreground ml-auto h-8 text-xs"
                    >
                      <Trash2Icon className="size-3.5" /> Remove
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontalIcon className="text-primary size-4" />
                Mesh
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {MESH_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => loadPreset(p.id)}
                    className={cn(
                      "h-9 rounded-lg border px-3 text-xs font-bold tracking-tight transition-colors",
                      presetId === p.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/60 hover:border-border",
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Blend reach</Label>
                    <span className="text-muted-foreground font-mono text-xs">
                      {config.spread}%
                    </span>
                  </div>
                  <Slider
                    min={20}
                    max={90}
                    value={[config.spread]}
                    onValueChange={([v]) => patch({ spread: v })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mesh-base">Base color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="mesh-base"
                      type="color"
                      value={config.base}
                      onChange={(e) => patch({ base: e.target.value })}
                      className="h-8 w-12 cursor-pointer p-1"
                      aria-label="Base color"
                    />
                    <span className="text-muted-foreground font-mono text-xs">
                      {config.base}
                    </span>
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-3">
                <Switch
                  checked={config.grain}
                  onCheckedChange={(v) => patch({ grain: v })}
                  aria-label="Grain"
                />
                <span className="text-sm">
                  Film grain
                  <span className="text-muted-foreground block text-xs">
                    A whisper of SVG noise over the blend — kills color banding.
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export</CardTitle>
              <CardDescription>
                Pure CSS radial gradients, or a standalone SVG for Figma.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="css" className="w-full">
                <TabsList className="w-full">
                  {exportTabs.map((t) => (
                    <TabsTrigger key={t.id} value={t.id} className="flex-1">
                      {t.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {exportTabs.map((t) => (
                  <TabsContent key={t.id} value={t.id}>
                    <div className="relative">
                      <pre className="bg-muted/50 border-border max-h-96 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                        {t.code}
                      </pre>
                      <CopyButton
                        text={t.code}
                        label=""
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1.5 right-1.5"
                        successMessage={`${t.name} copied`}
                        onCopied={commit}
                        aria-label={`Copy ${t.name}`}
                      />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </GeneratorLayout>
  );
}
