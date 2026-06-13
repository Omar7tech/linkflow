"use client";

import * as React from "react";
import { SlidersHorizontalIcon, SquircleIcon, SunIcon, TriangleAlertIcon } from "lucide-react";
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
  DEFAULT_NEU,
  NEU_SWATCHES,
  neuBackground,
  neuBoxShadow,
  neuText,
  surfaceWarning,
  toCss,
  toTailwind,
  type LightCorner,
  type NeuConfig,
  type NeuShape,
} from "@/lib/neumorphism";
import { cn } from "@/lib/utils";

const LIGHT_CORNERS: { id: LightCorner; className: string }[] = [
  { id: "tl", className: "top-2 left-2" },
  { id: "tr", className: "top-2 right-2" },
  { id: "br", className: "bottom-2 right-2" },
  { id: "bl", className: "bottom-2 left-2" },
];

const SHAPES: { id: NeuShape; name: string }[] = [
  { id: "flat", name: "Flat" },
  { id: "concave", name: "Concave" },
  { id: "convex", name: "Convex" },
  { id: "pressed", name: "Pressed" },
];

export function NeumorphismTool() {
  const history = useHistory("neumorphism");
  const [config, setConfig] = React.useState<NeuConfig>(DEFAULT_NEU);
  const [autoBlur, setAutoBlur] = React.useState(true);

  const set = <K extends keyof NeuConfig>(key: K, value: NeuConfig[K]) =>
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "distance" && autoBlur) next.blur = (value as number) * 2;
      if (key === "size") next.radius = Math.min(prev.radius, Math.floor((value as number) / 2));
      return next;
    });

  const css = toCss(config);
  const warning = surfaceWarning(config.color);
  const text = neuText(config.color);
  const commit = () =>
    history.add(`${config.shape} neumorphism · ${config.color}`, css);

  const exportTabs = [
    { id: "css", name: "CSS", code: css },
    { id: "tailwind", name: "Tailwind", code: toTailwind(config) },
  ];

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.neumorphism}
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
                  <SquircleIcon className="text-primary size-4" />
                  Preview
                </CardTitle>
                <CardDescription>
                  Click a sun to move the light source. The stage shares the element&apos;s color —
                  that&apos;s what makes the effect work.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className="relative flex h-80 w-full items-center justify-center overflow-hidden rounded-xl border transition-colors"
                  style={{ backgroundColor: config.color }}
                >
                  {LIGHT_CORNERS.map((corner) => (
                    <button
                      key={corner.id}
                      type="button"
                      onClick={() => set("light", corner.id)}
                      className={cn(
                        "absolute flex size-8 items-center justify-center rounded-full shadow-md ring-1 ring-black/10 backdrop-blur-sm transition-all",
                        corner.className,
                        config.light === corner.id
                          ? "bg-amber-400 text-amber-950"
                          : "bg-white/80 text-black/60 hover:bg-white"
                      )}
                      aria-label={`Light from ${corner.id}`}
                      title="Light source"
                    >
                      <SunIcon className="size-4" />
                    </button>
                  ))}
                  <div
                    className="flex items-center justify-center transition-all duration-150"
                    style={{
                      width: config.size,
                      height: config.size,
                      borderRadius: config.radius,
                      background: neuBackground(config),
                      boxShadow: neuBoxShadow(config),
                      color: text,
                    }}
                  >
                    <span className="font-heading text-2xl font-bold">Aa</span>
                  </div>
                </div>
                {warning && (
                  <p className="text-destructive flex items-start gap-1.5 text-xs">
                    <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {warning}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontalIcon className="text-primary size-4" />
                Surface
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="neu-color">Base color</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {NEU_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => set("color", color)}
                      className={cn(
                        "size-8 rounded-full border-2 transition-transform",
                        config.color === color
                          ? "border-primary scale-110"
                          : "border-border/60 hover:scale-105"
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Base color ${color}`}
                    />
                  ))}
                  <Input
                    id="neu-color"
                    type="color"
                    value={config.color}
                    onChange={(e) => set("color", e.target.value)}
                    className="h-9 w-14 cursor-pointer p-1"
                    aria-label="Custom base color"
                  />
                </div>
              </div>

              <Tabs value={config.shape} onValueChange={(v) => set("shape", v as NeuShape)}>
                <TabsList className="w-full">
                  {SHAPES.map((s) => (
                    <TabsTrigger key={s.id} value={s.id} className="flex-1">
                      {s.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <NeuSlider
                  label="Size"
                  value={config.size}
                  unit="px"
                  min={80}
                  max={280}
                  step={10}
                  onChange={(v) => set("size", v)}
                />
                <NeuSlider
                  label="Radius"
                  value={config.radius}
                  unit="px"
                  min={0}
                  max={Math.floor(config.size / 2)}
                  onChange={(v) => set("radius", v)}
                />
                <NeuSlider
                  label="Distance"
                  value={config.distance}
                  unit="px"
                  min={4}
                  max={40}
                  onChange={(v) => set("distance", v)}
                />
                <NeuSlider
                  label="Intensity"
                  value={config.intensity}
                  unit="%"
                  min={10}
                  max={90}
                  onChange={(v) => set("intensity", v)}
                />
                <NeuSlider
                  label="Blur"
                  value={config.blur}
                  unit="px"
                  min={0}
                  max={80}
                  disabled={autoBlur}
                  onChange={(v) => set("blur", v)}
                />
                <label className="flex items-center gap-3 self-end pb-1">
                  <Switch
                    checked={autoBlur}
                    onCheckedChange={(v) => {
                      setAutoBlur(v);
                      if (v) setConfig((prev) => ({ ...prev, blur: prev.distance * 2 }));
                    }}
                    aria-label="Auto blur"
                  />
                  <span className="text-sm">
                    Auto blur
                    <span className="text-muted-foreground block text-xs">
                      Keeps blur at 2× distance — the classic soft-UI ratio.
                    </span>
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export</CardTitle>
              <CardDescription>
                Remember: the parent surface must share the base color.
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
                      <pre className="bg-muted/50 border-border max-h-72 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
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

function NeuSlider({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className={cn("space-y-2", disabled && "opacity-50")}>
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
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}
