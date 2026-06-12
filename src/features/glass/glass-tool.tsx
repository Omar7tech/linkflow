"use client";

import * as React from "react";
import { BlendIcon, ImageUpIcon, RotateCcwIcon, SlidersHorizontalIcon, SunMoonIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  GLASS_PRESETS,
  GLASS_SCENES,
  toCss,
  toStyle,
  toTailwind,
  type GlassConfig,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

const TINT_SWATCHES = ["#ffffff", "#0f172a", "#38bdf8", "#f472b6", "#facc15", "#4ade80"];

export function GlassTool() {
  const history = useHistory("glass");
  const [config, setConfig] = React.useState<GlassConfig>(GLASS_PRESETS[0].config);
  const [presetId, setPresetId] = React.useState(GLASS_PRESETS[0].id);
  const [sceneId, setSceneId] = React.useState(GLASS_SCENES[0].id);
  const [customBg, setCustomBg] = React.useState<string | null>(null);
  const [customFg, setCustomFg] = React.useState<"light" | "dark">("light");

  const scene =
    sceneId === "custom" && customBg
      ? { id: "custom", name: "Custom", background: `url(${customBg}) center / cover`, fg: customFg }
      : (GLASS_SCENES.find((s) => s.id === sceneId) ?? GLASS_SCENES[0]);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomBg(ev.target?.result as string);
      setSceneId("custom");
    };
    reader.readAsDataURL(file);
  };

  // Card position on the stage, in % of the stage size.
  const [pos, setPos] = React.useState({ x: 50, y: 50 });
  const stageRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ dx: number; dy: number } | null>(null);

  const set = <K extends keyof GlassConfig>(key: K, value: GlassConfig[K]) => {
    setPresetId("custom");
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const loadPreset = (id: string) => {
    const preset = GLASS_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setConfig(preset.config);
  };

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    dragRef.current = {
      dx: ((e.clientX - rect.left) / rect.width) * 100 - pos.x,
      dy: ((e.clientY - rect.top) / rect.height) * 100 - pos.y,
    };
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const x = ((ev.clientX - rect.left) / rect.width) * 100 - d.dx;
      const y = ((ev.clientY - rect.top) / rect.height) * 100 - d.dy;
      setPos({
        x: Math.min(Math.max(x, 15), 85),
        y: Math.min(Math.max(y, 18), 82),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const css = toCss(config);
  const tailwind = toTailwind(config);
  const commit = () =>
    history.add(`Glass · blur ${config.blur}px · ${config.opacity}% ${config.tint}`, css);

  const exportTabs = [
    { id: "css", name: "CSS", code: css },
    { id: "tailwind", name: "Tailwind", code: tailwind },
  ];

  const light = scene.fg === "light";

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.glass}
      output={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export</CardTitle>
            <CardDescription>
              Includes a solid-color fallback for browsers without backdrop-filter.
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
      }
      footer={<HistoryPanel history={history} />}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BlendIcon className="text-primary size-4" />
              Preview
            </CardTitle>
            <CardDescription>
              Drag the card around to see how the glass reacts to what is behind it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              ref={stageRef}
              className="relative h-72 w-full touch-none overflow-hidden rounded-xl select-none sm:h-80"
              style={{ background: scene.background }}
            >
              <div
                onPointerDown={startDrag}
                className="absolute w-60 -translate-x-1/2 -translate-y-1/2 cursor-grab p-5 active:cursor-grabbing"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, ...toStyle(config) }}
              >
                <div className="pointer-events-none space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "size-10 rounded-full",
                        light ? "bg-white/40" : "bg-slate-900/30"
                      )}
                    />
                    <div className="space-y-1.5">
                      <div
                        className={cn(
                          "h-2.5 w-24 rounded-full",
                          light ? "bg-white/50" : "bg-slate-900/40"
                        )}
                      />
                      <div
                        className={cn(
                          "h-2 w-16 rounded-full",
                          light ? "bg-white/30" : "bg-slate-900/25"
                        )}
                      />
                    </div>
                  </div>
                  <p
                    className={cn(
                      "text-sm leading-snug font-medium",
                      light ? "text-white/90" : "text-slate-900/80"
                    )}
                  >
                    Glassmorphism keeps content readable while the background shines through.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {GLASS_SCENES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSceneId(s.id)}
                  className={cn(
                    "h-9 w-14 overflow-hidden rounded-lg border-2 transition-all",
                    sceneId === s.id
                      ? "border-primary scale-105"
                      : "border-border/40 hover:border-border"
                  )}
                  style={{ background: s.background }}
                  aria-label={`${s.name} background`}
                  title={s.name}
                />
              ))}
              {customBg && (
                <span className="relative inline-flex">
                  <button
                    type="button"
                    onClick={() => setSceneId("custom")}
                    className={cn(
                      "h-9 w-14 overflow-hidden rounded-lg border-2 bg-cover bg-center transition-all",
                      sceneId === "custom"
                        ? "border-primary scale-105"
                        : "border-border/40 hover:border-border"
                    )}
                    style={{ backgroundImage: `url(${customBg})` }}
                    aria-label="Custom background"
                    title="Your image"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCustomBg(null);
                      if (sceneId === "custom") setSceneId(GLASS_SCENES[0].id);
                    }}
                    className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full"
                    aria-label="Remove custom background"
                  >
                    <XIcon className="size-2.5" />
                  </button>
                </span>
              )}
              <label
                className="border-border/60 hover:border-border text-muted-foreground flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border-2 border-dashed px-2.5 text-xs font-bold"
                title="Upload your own background"
              >
                <ImageUpIcon className="size-3.5" />
                Your image
                <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
              </label>
              {sceneId === "custom" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCustomFg((f) => (f === "light" ? "dark" : "light"))}
                  className="text-muted-foreground h-8 text-xs"
                  title="Flip card text between light and dark"
                >
                  <SunMoonIcon className="size-3.5" /> Text: {customFg}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPos({ x: 50, y: 50 })}
                className="text-muted-foreground ml-auto h-8 text-xs"
              >
                <RotateCcwIcon className="size-3.5" /> Center card
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontalIcon className="text-primary size-4" />
              Glass
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {GLASS_PRESETS.map((p) => (
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

            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <GlassSlider
                label="Blur"
                value={config.blur}
                unit="px"
                min={0}
                max={40}
                onChange={(v) => set("blur", v)}
              />
              <GlassSlider
                label="Transparency"
                value={config.opacity}
                unit="%"
                min={0}
                max={60}
                onChange={(v) => set("opacity", v)}
              />
              <GlassSlider
                label="Saturation"
                value={config.saturation}
                unit="%"
                min={100}
                max={200}
                step={5}
                onChange={(v) => set("saturation", v)}
              />
              <GlassSlider
                label="Border"
                value={config.borderOpacity}
                unit="%"
                min={0}
                max={80}
                onChange={(v) => set("borderOpacity", v)}
              />
              <GlassSlider
                label="Brightness"
                value={config.brightness}
                unit="%"
                min={50}
                max={150}
                step={5}
                onChange={(v) => set("brightness", v)}
              />
              <GlassSlider
                label="Border width"
                value={config.borderWidth}
                unit="px"
                min={0}
                max={6}
                onChange={(v) => set("borderWidth", v)}
              />
              <GlassSlider
                label="Radius"
                value={config.radius}
                unit="px"
                min={0}
                max={40}
                onChange={(v) => set("radius", v)}
              />
              <GlassSlider
                label="Shadow"
                value={config.shadow}
                unit="%"
                min={0}
                max={60}
                onChange={(v) => set("shadow", v)}
              />
            </div>

            <div className="flex flex-wrap items-end gap-6">
              <div className="space-y-2">
                <Label htmlFor="glass-tint">Tint</Label>
                <div className="flex items-center gap-2">
                  {TINT_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => set("tint", color)}
                      className={cn(
                        "size-7 rounded-full border-2 transition-transform",
                        config.tint === color
                          ? "border-primary scale-110"
                          : "border-border/60 hover:scale-105"
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Tint ${color}`}
                    />
                  ))}
                  <Input
                    id="glass-tint"
                    type="color"
                    value={config.tint}
                    onChange={(e) => set("tint", e.target.value)}
                    className="h-8 w-12 cursor-pointer p-1"
                    aria-label="Custom tint color"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <GlassToggle
                label="Edge highlight"
                hint="A bright inner top edge, like light catching the glass."
                checked={config.highlight}
                onChange={(v) => set("highlight", v)}
              />
              <GlassToggle
                label="Gradient surface"
                hint="A diagonal fade across the tint for extra depth."
                checked={config.gradient}
                onChange={(v) => set("gradient", v)}
              />
              <GlassToggle
                label="Frost grain"
                hint="A whisper of SVG noise baked into the surface."
                checked={config.noise}
                onChange={(v) => set("noise", v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

function GlassToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3">
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} className="mt-0.5" />
      <span className="text-sm">
        {label}
        <span className="text-muted-foreground block text-xs">{hint}</span>
      </span>
    </label>
  );
}

function GlassSlider({
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
