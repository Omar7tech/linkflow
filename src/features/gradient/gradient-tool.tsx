"use client";

import * as React from "react";
import {
  ArrowLeftRightIcon,
  PlusIcon,
  RainbowIcon,
  ShuffleIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import {
  GRADIENT_PRESETS,
  applyGradientPreset,
  gradientValue,
  newStop,
  randomGradient,
  toCss,
  toSvg,
  toTailwind,
  type GradientConfig,
  type GradientType,
} from "@/lib/gradient";
import { cn } from "@/lib/utils";

const MAX_STOPS = 6;

export function GradientTool() {
  const history = useHistory("gradient");
  const [config, setConfig] = React.useState<GradientConfig>(() =>
    applyGradientPreset(GRADIENT_PRESETS[0])
  );

  const value = gradientValue(config);
  const css = toCss(config);
  const commit = () => history.add(`${config.type} gradient · ${config.stops.length} stops`, value);

  const set = <K extends keyof GradientConfig>(key: K, v: GradientConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: v }));

  const setStop = (id: string, patch: Partial<{ color: string; pos: number }>) =>
    setConfig((prev) => ({
      ...prev,
      stops: prev.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));

  const addStop = () =>
    setConfig((prev) => {
      if (prev.stops.length >= MAX_STOPS) return prev;
      const sorted = [...prev.stops].sort((a, b) => a.pos - b.pos);
      const last = sorted[sorted.length - 1];
      const prevStop = sorted[sorted.length - 2] ?? last;
      const pos = Math.round((prevStop.pos + last.pos) / 2);
      return { ...prev, stops: [...prev.stops, newStop(last.color, pos)] };
    });

  const removeStop = (id: string) =>
    setConfig((prev) =>
      prev.stops.length <= 2 ? prev : { ...prev, stops: prev.stops.filter((s) => s.id !== id) }
    );

  const reverse = () =>
    setConfig((prev) => ({
      ...prev,
      stops: prev.stops.map((s) => ({ ...s, pos: 100 - s.pos })),
    }));

  const shuffle = React.useCallback(() => {
    setConfig((prev) => randomGradient(prev.type));
  }, []);

  // Spacebar shuffles — unless the user is typing or pressing a button.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(el.tagName)) return;
      e.preventDefault();
      shuffle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shuffle]);

  const exportTabs = [
    { id: "css", name: "CSS", code: css },
    { id: "tailwind", name: "Tailwind", code: toTailwind(config) },
    { id: "svg", name: "SVG", code: toSvg(config) },
  ];

  const showAngle = config.type !== "radial";
  const showCenter = config.type !== "linear";

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.gradient}
      output={null}
      footer={<HistoryPanel history={history} />}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        {/* Preview leads on mobile, sticks on desktop while controls scroll. */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <div className="space-y-6 lg:sticky lg:top-20">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <RainbowIcon className="text-primary size-4" />
                  Preview
                </CardTitle>
                <CardDescription>
                  Press <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">Space</kbd>{" "}
                  anywhere to shuffle a new gradient.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className="h-64 w-full rounded-xl border shadow-inner sm:h-72"
                  style={{ background: value }}
                />
                <p className="text-muted-foreground font-mono text-[11px] break-all">{value}</p>
                <div className="flex gap-2">
                  <Button onClick={shuffle} className="flex-1 font-bold">
                    <ShuffleIcon className="size-4" /> Randomize
                  </Button>
                  <Button variant="secondary" onClick={reverse} title="Flip stop positions">
                    <ArrowLeftRightIcon className="size-4" /> Reverse
                  </Button>
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
                Gradient
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {GRADIENT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setConfig(applyGradientPreset(p))}
                    className="border-border/40 hover:border-primary h-9 w-14 rounded-lg border-2 transition-all hover:scale-105"
                    style={{ background: gradientValue(applyGradientPreset(p)) }}
                    aria-label={`${p.name} preset`}
                    title={p.name}
                  />
                ))}
              </div>

              <Tabs value={config.type} onValueChange={(v) => set("type", v as GradientType)}>
                <TabsList className="w-full">
                  <TabsTrigger value="linear" className="flex-1">
                    Linear
                  </TabsTrigger>
                  <TabsTrigger value="radial" className="flex-1">
                    Radial
                  </TabsTrigger>
                  <TabsTrigger value="conic" className="flex-1">
                    Conic
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {showAngle && (
                  <RangeControl
                    label="Angle"
                    value={config.angle}
                    unit="°"
                    min={0}
                    max={360}
                    step={5}
                    onChange={(v) => set("angle", v)}
                  />
                )}
                {showCenter && (
                  <>
                    <RangeControl
                      label="Center X"
                      value={config.x}
                      unit="%"
                      min={0}
                      max={100}
                      onChange={(v) => set("x", v)}
                    />
                    <RangeControl
                      label="Center Y"
                      value={config.y}
                      unit="%"
                      min={0}
                      max={100}
                      onChange={(v) => set("y", v)}
                    />
                  </>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Color stops</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addStop}
                    disabled={config.stops.length >= MAX_STOPS}
                    className="h-8 text-xs"
                  >
                    <PlusIcon className="size-3.5" /> Add stop
                  </Button>
                </div>
                {[...config.stops]
                  .sort((a, b) => a.pos - b.pos)
                  .map((stop) => (
                    <div key={stop.id} className="flex items-center gap-3">
                      <Input
                        type="color"
                        value={stop.color}
                        onChange={(e) => setStop(stop.id, { color: e.target.value })}
                        className="h-9 w-12 shrink-0 cursor-pointer p-1"
                        aria-label="Stop color"
                      />
                      <Slider
                        min={0}
                        max={100}
                        value={[stop.pos]}
                        onValueChange={([pos]) => setStop(stop.id, { pos })}
                        aria-label="Stop position"
                      />
                      <span className="text-muted-foreground w-12 shrink-0 text-right font-mono text-xs">
                        {stop.pos}%
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeStop(stop.id)}
                        disabled={config.stops.length <= 2}
                        className={cn(
                          "text-muted-foreground shrink-0",
                          config.stops.length > 2 && "hover:text-destructive"
                        )}
                        aria-label="Remove stop"
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export</CardTitle>
              <CardDescription>
                CSS with a solid fallback, Tailwind arbitrary value, or a 1200×630 SVG.
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

function RangeControl({
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
