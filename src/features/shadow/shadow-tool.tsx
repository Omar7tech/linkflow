"use client";

import * as React from "react";
import { BoxSelectIcon, LayersIcon, SlidersHorizontalIcon } from "lucide-react";
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
  SHADOW_PRESETS,
  SHADOW_SURFACES,
  buildLayers,
  toCss,
  toStyle,
  toTailwind,
  type ShadowConfig,
} from "@/lib/shadow";
import { cn } from "@/lib/utils";

const COLOR_SWATCHES = ["#0f172a", "#020617", "#10b981", "#6366f1", "#f43f5e", "#f59e0b"];

export function ShadowTool() {
  const history = useHistory("shadow");
  const [config, setConfig] = React.useState<ShadowConfig>(SHADOW_PRESETS[0].config);
  const [presetId, setPresetId] = React.useState(SHADOW_PRESETS[0].id);
  const [surfaceId, setSurfaceId] = React.useState(SHADOW_SURFACES[0].id);

  const surface =
    SHADOW_SURFACES.find((s) => s.id === surfaceId) ?? SHADOW_SURFACES[0];

  const set = <K extends keyof ShadowConfig>(key: K, value: ShadowConfig[K]) => {
    setPresetId("custom");
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const loadPreset = (id: string) => {
    const preset = SHADOW_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setConfig(preset.config);
  };

  const layers = buildLayers(config);
  const css = toCss(config);
  const tailwind = toTailwind(config);
  const commit = () =>
    history.add(
      `Shadow · ${config.layers} layer${config.layers > 1 ? "s" : ""} · ${config.distance}px · ${config.color}`,
      css,
    );

  const exportTabs = [
    { id: "css", name: "CSS", code: css },
    { id: "tailwind", name: "Tailwind", code: tailwind },
  ];

  const light = surface.fg === "light";

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.shadow}
      output={null}
      footer={<HistoryPanel history={history} />}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        {/* Preview leads on mobile, sticks on desktop while controls scroll. */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <div className="lg:sticky lg:top-20">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BoxSelectIcon className="text-primary size-4" />
                  Preview
                </CardTitle>
                <CardDescription>
                  {layers.length} stacked layer{layers.length > 1 ? "s" : ""} —
                  smoother and more natural than a single drop shadow.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className="flex h-72 w-full items-center justify-center overflow-hidden rounded-xl sm:h-80"
                  style={{ background: surface.bg }}
                >
                  <div
                    className="flex size-36 items-center justify-center rounded-2xl text-sm font-semibold"
                    style={{
                      background: surface.card,
                      color: light ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.7)",
                      ...toStyle(config),
                    }}
                  >
                    {config.inset ? "Inset" : "Elevation"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {SHADOW_SURFACES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSurfaceId(s.id)}
                      className={cn(
                        "h-9 w-14 overflow-hidden rounded-lg border-2 transition-all",
                        surfaceId === s.id
                          ? "border-primary scale-105"
                          : "border-border/40 hover:border-border",
                      )}
                      style={{ background: s.bg }}
                      aria-label={`${s.name} surface`}
                      title={s.name}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontalIcon className="text-primary size-4" />
                Shadow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {SHADOW_PRESETS.map((p) => (
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
                <ShadowSlider
                  label="Distance"
                  value={config.distance}
                  unit="px"
                  min={0}
                  max={80}
                  onChange={(v) => set("distance", v)}
                />
                <ShadowSlider
                  label="Blur"
                  value={config.blur}
                  unit="px"
                  min={0}
                  max={120}
                  onChange={(v) => set("blur", v)}
                />
                <ShadowSlider
                  label="Direction"
                  value={config.angle}
                  unit="°"
                  min={0}
                  max={360}
                  step={5}
                  onChange={(v) => set("angle", v)}
                />
                <ShadowSlider
                  label="Spread"
                  value={config.spread}
                  unit="px"
                  min={-20}
                  max={20}
                  onChange={(v) => set("spread", v)}
                />
                <ShadowSlider
                  label="Intensity"
                  value={config.opacity}
                  unit="%"
                  min={0}
                  max={100}
                  onChange={(v) => set("opacity", v)}
                />
                <ShadowSlider
                  label="Layers"
                  value={config.layers}
                  unit=""
                  min={1}
                  max={8}
                  onChange={(v) => set("layers", v)}
                />
              </div>

              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="space-y-2">
                  <Label htmlFor="shadow-color">Color</Label>
                  <div className="flex items-center gap-2">
                    {COLOR_SWATCHES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => set("color", color)}
                        className={cn(
                          "size-7 rounded-full border-2 transition-transform",
                          config.color === color
                            ? "border-primary scale-110"
                            : "border-border/60 hover:scale-105",
                        )}
                        style={{ backgroundColor: color }}
                        aria-label={`Color ${color}`}
                      />
                    ))}
                    <Input
                      id="shadow-color"
                      type="color"
                      value={config.color}
                      onChange={(e) => set("color", e.target.value)}
                      className="h-8 w-12 cursor-pointer p-1"
                      aria-label="Custom shadow color"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3">
                  <Switch
                    checked={config.inset}
                    onCheckedChange={(v) => set("inset", v)}
                    aria-label="Inset"
                  />
                  <span className="text-sm">
                    Inset
                    <span className="text-muted-foreground block text-xs">
                      Carve the shadow inward.
                    </span>
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LayersIcon className="text-primary size-4" />
                Export
              </CardTitle>
              <CardDescription>
                A layered box-shadow — drop it on any element.
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

function ShadowSlider({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-muted-foreground font-mono text-xs">
          {value}
          {unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}
