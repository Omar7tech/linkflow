"use client";

import * as React from "react";
import { MoonIcon, SlidersHorizontalIcon, SparklesIcon, SunIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import {
  DEFAULT_GLOW,
  GLOW_PRESETS,
  isDark,
  toCss,
  toTailwind,
  type GlowAnimation,
  type GlowConfig,
  type GlowMode,
} from "@/lib/glow";
import { cn } from "@/lib/utils";

const MODES: { id: GlowMode; label: string }[] = [
  { id: "neon", label: "Neon" },
  { id: "gradient", label: "Gradient" },
  { id: "aurora", label: "Aurora" },
];

const SURFACE_SWATCHES = ["#0b0f0e", "#060a12", "#111827", "#0a0a0a", "#ffffff"];
const PREVIEW_CLASS = "glow-live-preview";

export function GlowTool() {
  const history = useHistory("glow");
  const [config, setConfig] = React.useState<GlowConfig>(DEFAULT_GLOW);
  const [presetId, setPresetId] = React.useState("emerald");
  const [stageDark, setStageDark] = React.useState(true);

  const set = <K extends keyof GlowConfig>(key: K, value: GlowConfig[K]) => {
    setPresetId("custom");
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const loadPreset = (id: string) => {
    const preset = GLOW_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setConfig(preset.config);
    setStageDark(!isDark(preset.config.surface) ? stageDark : true);
  };

  const css = toCss(config);
  const tailwind = toTailwind(config);
  const previewCss = toCss(config, PREVIEW_CLASS);
  const lightText = isDark(config.surface);

  const commit = () =>
    history.add(`${config.mode} glow · ${config.color1}`, css);

  const exportTabs = [
    { id: "css", name: "CSS", code: css },
    { id: "tailwind", name: "Tailwind", code: tailwind },
  ];

  const hasSecondColor = config.mode !== "neon";
  const animated = config.animation !== "none" || config.mode === "aurora";

  return (
    <GeneratorLayout tool={TOOL_BY_ID.glow} output={null} footer={<HistoryPanel history={history} />}>
      {/* Live preview owns its CSS — exactly what the export produces. */}
      <style dangerouslySetInnerHTML={{ __html: previewCss }} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        {/* Preview leads on mobile, sticks on desktop. */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <div className="lg:sticky lg:top-20">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <SparklesIcon className="text-primary size-4" />
                  Preview
                </CardTitle>
                <CardDescription>Glows read best on a dark surface — flip the stage to compare.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className={cn(
                    "flex min-h-72 w-full items-center justify-center rounded-xl p-14 transition-colors sm:min-h-80",
                    stageDark ? "bg-neutral-950" : "bg-neutral-100"
                  )}
                >
                  <div
                    className={PREVIEW_CLASS}
                    style={{ width: 240 }}
                  >
                    <div className="space-y-3 p-6">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-9 rounded-full"
                          style={{ background: config.mode === "neon" ? config.color1 : `linear-gradient(135deg, ${config.color1}, ${config.color2})` }}
                        />
                        <div className="space-y-1.5">
                          <div className={cn("h-2.5 w-24 rounded-full", lightText ? "bg-white/60" : "bg-black/50")} />
                          <div className={cn("h-2 w-16 rounded-full", lightText ? "bg-white/30" : "bg-black/25")} />
                        </div>
                      </div>
                      <p className={cn("text-sm font-medium", lightText ? "text-white/90" : "text-black/80")}>
                        A glowing border that makes any card feel alive.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">Stage</span>
                  <div className="bg-muted/60 inline-flex rounded-md p-0.5">
                    <button
                      type="button"
                      onClick={() => setStageDark(true)}
                      className={cn("inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium", stageDark ? "bg-card shadow-sm" : "text-muted-foreground")}
                    >
                      <MoonIcon className="size-3.5" /> Dark
                    </button>
                    <button
                      type="button"
                      onClick={() => setStageDark(false)}
                      className={cn("inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium", !stageDark ? "bg-card shadow-sm" : "text-muted-foreground")}
                    >
                      <SunIcon className="size-3.5" /> Light
                    </button>
                  </div>
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
                Glow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                {GLOW_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => loadPreset(p.id)}
                    className={cn(
                      "h-9 rounded-lg border px-3 text-xs font-bold tracking-tight transition-colors",
                      presetId === p.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/60 hover:border-border"
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {/* Mode */}
              <div className="space-y-2">
                <Label>Style</Label>
                <div className="bg-muted/60 inline-flex w-full rounded-lg p-0.5">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => set("mode", m.id)}
                      className={cn(
                        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        config.mode === m.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="flex flex-wrap items-end gap-6">
                <ColorPick
                  label={hasSecondColor ? "Color 1" : "Glow color"}
                  id="glow-c1"
                  value={config.color1}
                  onChange={(v) => set("color1", v)}
                />
                {hasSecondColor && (
                  <ColorPick label="Color 2" id="glow-c2" value={config.color2} onChange={(v) => set("color2", v)} />
                )}
                <div className="space-y-2">
                  <Label htmlFor="glow-surface">Surface</Label>
                  <div className="flex items-center gap-2">
                    {SURFACE_SWATCHES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => set("surface", color)}
                        className={cn(
                          "size-7 rounded-full border-2 transition-transform",
                          config.surface === color ? "border-primary scale-110" : "border-border/60 hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                        aria-label={`Surface ${color}`}
                      />
                    ))}
                    <Input
                      id="glow-surface"
                      type="color"
                      value={config.surface}
                      onChange={(e) => set("surface", e.target.value)}
                      className="h-8 w-12 cursor-pointer p-1"
                      aria-label="Custom surface color"
                    />
                  </div>
                </div>
              </div>

              {/* Sliders */}
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <GlowSlider label="Glow blur" value={config.blur} unit="px" min={0} max={80} onChange={(v) => set("blur", v)} />
                <GlowSlider label="Glow reach" value={config.spread} unit="px" min={0} max={30} onChange={(v) => set("spread", v)} />
                <GlowSlider label="Intensity" value={config.intensity} unit="%" min={0} max={100} onChange={(v) => set("intensity", v)} />
                <GlowSlider label="Border width" value={config.borderWidth} unit="px" min={0} max={8} onChange={(v) => set("borderWidth", v)} />
                <GlowSlider label="Radius" value={config.radius} unit="px" min={0} max={48} onChange={(v) => set("radius", v)} />
                {animated && (
                  <GlowSlider label="Speed" value={config.speed} unit="s" min={1} max={10} step={0.5} onChange={(v) => set("speed", v)} />
                )}
              </div>

              {/* Animation */}
              <div className="space-y-2">
                <Label htmlFor="glow-anim">
                  Animation
                  {config.mode === "aurora" && (
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">(aurora always rotates)</span>
                  )}
                </Label>
                <Select value={config.animation} onValueChange={(v) => set("animation", v as GlowAnimation)}>
                  <SelectTrigger id="glow-anim" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="pulse">Pulse</SelectItem>
                    <SelectItem value="breathe">Breathe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export</CardTitle>
              <CardDescription>
                Drop the class on any element. Animations honor <code className="text-xs">prefers-reduced-motion</code>.
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

function ColorPick({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 cursor-pointer p-1"
          aria-label={label}
        />
        <span className="font-mono text-xs">{value}</span>
      </div>
    </div>
  );
}

function GlowSlider({
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
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}
