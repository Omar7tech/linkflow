"use client";

import * as React from "react";
import { ShuffleIcon, SlidersHorizontalIcon, TypeIcon, WandSparklesIcon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import {
  DEFAULT_TEXT,
  FONT_FAMILIES,
  TEXT_EFFECTS,
  effectDefaults,
  randomColors,
  toCss,
  toTailwind,
  type TextConfig,
  type TextEffect,
} from "@/lib/text-effects";
import { cn } from "@/lib/utils";

const SURFACE_SWATCHES = ["#0b0f0e", "#070707", "#111827", "#0a0a0a", "#ffffff"];
const PREVIEW_CLASS = "text-effect-live";

export function TypographyTool() {
  const history = useHistory("typography");
  const [config, setConfig] = React.useState<TextConfig>(DEFAULT_TEXT);

  const set = <K extends keyof TextConfig>(key: K, value: TextConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const pickEffect = (effect: TextEffect) =>
    setConfig((prev) => ({ ...prev, effect, ...effectDefaults(effect) }));

  const shuffle = () => setConfig((prev) => ({ ...prev, ...randomColors() }));

  const css = toCss(config);
  const previewCss = toCss(config, PREVIEW_CLASS);
  const tailwind = toTailwind(config);
  const commit = () => history.add(`${config.effect} · ${config.text.slice(0, 24)}`, css);

  const exportTabs = [
    { id: "css", name: "CSS", code: css },
    { id: "tailwind", name: "Tailwind", code: tailwind },
  ];

  // Which controls are relevant to the current effect.
  const f = {
    color2: ["gradient", "animated-gradient", "aurora", "split", "metallic"].includes(config.effect),
    color3: ["animated-gradient", "aurora"].includes(config.effect),
    angle: ["gradient", "animated-gradient", "split"].includes(config.effect),
    speed: ["animated-gradient", "aurora"].includes(config.effect),
    stroke: ["outline", "glass"].includes(config.effect),
    glow: ["neon", "glow"].includes(config.effect),
    depth: config.effect === "3d",
    color1: !["glass"].includes(config.effect),
    shuffle: ["gradient", "animated-gradient", "aurora", "split", "neon", "glow"].includes(config.effect),
  };

  const stageDark =
    config.surface.toLowerCase() !== "#ffffff" && config.surface.toLowerCase() !== "#fff";

  return (
    <GeneratorLayout tool={TOOL_BY_ID.typography} output={null} footer={<HistoryPanel history={history} />}>
      <style dangerouslySetInnerHTML={{ __html: previewCss }} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        {/* Preview — leads on mobile, sticky on desktop. */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <div className="lg:sticky lg:top-20 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <WandSparklesIcon className="text-primary size-4" />
                  Preview
                </CardTitle>
                <CardDescription>Click the text to edit it. Drag the sliders to taste.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className="flex min-h-56 w-full items-center justify-center overflow-hidden rounded-xl p-8 text-center"
                  style={{ background: config.surface }}
                >
                  <span
                    className={PREVIEW_CLASS}
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {config.text || "Type something"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
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
                      aria-label={`Stage ${color}`}
                    />
                  ))}
                  <Input
                    type="color"
                    value={config.surface}
                    onChange={(e) => set("surface", e.target.value)}
                    className="h-7 w-10 cursor-pointer p-1"
                    aria-label="Custom stage color"
                  />
                  {!stageDark && (
                    <span className="text-muted-foreground text-xs">Neon &amp; glow pop on dark</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          {/* Effect picker */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <WandSparklesIcon className="text-primary size-4" />
                Effect
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TEXT_EFFECTS.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => pickEffect(e.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-semibold tracking-tight transition-colors",
                      config.effect === e.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/60 hover:border-border"
                    )}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Text + typography */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TypeIcon className="text-primary size-4" />
                Text
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Input
                value={config.text}
                onChange={(e) => set("text", e.target.value)}
                placeholder="Your headline"
                className="text-base"
                aria-label="Preview text"
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="te-font">Font</Label>
                  <Select value={config.fontFamily} onValueChange={(v) => set("fontFamily", v)}>
                    <SelectTrigger id="te-font" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_FAMILIES.map((font) => (
                        <SelectItem key={font.label} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <TextSlider label="Weight" value={config.fontWeight} min={100} max={900} step={100} onChange={(v) => set("fontWeight", v)} />
                <TextSlider label="Size" value={config.fontSize} unit="px" min={24} max={160} step={2} onChange={(v) => set("fontSize", v)} />
                <TextSlider label="Letter spacing" value={config.letterSpacing} unit="px" min={-8} max={24} onChange={(v) => set("letterSpacing", v)} />
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <Switch checked={config.italic} onCheckedChange={(v) => set("italic", v)} aria-label="Italic" />
                  <span className="text-sm">Italic</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2.5">
                  <Switch checked={config.uppercase} onCheckedChange={(v) => set("uppercase", v)} aria-label="Uppercase" />
                  <span className="text-sm">Uppercase</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Effect controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontalIcon className="text-primary size-4" />
                Style
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-end gap-5">
                {f.color1 && (
                  <ColorPick label={f.color2 ? "Color 1" : "Color"} id="te-c1" value={config.color1} onChange={(v) => set("color1", v)} />
                )}
                {f.color2 && (
                  <ColorPick label="Color 2" id="te-c2" value={config.color2} onChange={(v) => set("color2", v)} />
                )}
                {f.color3 && (
                  <ColorPick label="Color 3" id="te-c3" value={config.color3} onChange={(v) => set("color3", v)} />
                )}
                {f.shuffle && (
                  <Button type="button" variant="outline" size="sm" onClick={shuffle} className="mb-0.5">
                    <ShuffleIcon className="size-3.5" /> Shuffle
                  </Button>
                )}
              </div>

              {config.effect === "metallic" && (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfig((p) => ({ ...p, color1: "#f5d061", color2: "#8a6d1f" }))}>
                    Gold
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfig((p) => ({ ...p, color1: "#e8e8e8", color2: "#7c7c7c" }))}>
                    Silver
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfig((p) => ({ ...p, color1: "#f0a868", color2: "#8a4b1f" }))}>
                    Bronze
                  </Button>
                </div>
              )}

              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {f.angle && (
                  <TextSlider label="Angle" value={config.angle} unit="°" min={0} max={360} step={5} onChange={(v) => set("angle", v)} />
                )}
                {f.speed && (
                  <TextSlider label="Speed" value={config.speed} unit="s" min={1} max={12} step={0.5} onChange={(v) => set("speed", v)} />
                )}
                {f.stroke && (
                  <TextSlider label="Stroke width" value={config.strokeWidth} unit="px" min={1} max={6} step={0.5} onChange={(v) => set("strokeWidth", v)} />
                )}
                {f.glow && (
                  <>
                    <TextSlider label="Glow size" value={config.glowSize} unit="px" min={4} max={60} onChange={(v) => set("glowSize", v)} />
                    <TextSlider label="Intensity" value={config.intensity} unit="%" min={0} max={100} onChange={(v) => set("intensity", v)} />
                  </>
                )}
                {f.depth && (
                  <TextSlider label="Depth" value={config.depth} unit="px" min={1} max={16} onChange={(v) => set("depth", v)} />
                )}
              </div>

              {!f.color1 && !f.angle && !f.speed && !f.stroke && !f.glow && !f.depth && (
                <p className="text-muted-foreground text-xs">
                  This effect is driven by the text and surface — try a colorful or dark background behind it.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Export */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export</CardTitle>
              <CardDescription>
                Add the class to your element. Animations honor <code className="text-xs">prefers-reduced-motion</code>.
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

function TextSlider({
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
  unit?: string;
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
