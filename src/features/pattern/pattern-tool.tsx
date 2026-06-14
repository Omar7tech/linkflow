"use client";

import * as React from "react";
import {
  DownloadIcon,
  GridIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import {
  PATTERNS,
  PATTERN_PRESETS,
  toCss,
  toStyle,
  toSvg,
  toTailwind,
  type PatternConfig,
  type PatternType,
} from "@/lib/pattern";
import { cn } from "@/lib/utils";

export function PatternTool() {
  const history = useHistory("pattern");
  const [config, setConfig] = React.useState<PatternConfig>(
    PATTERN_PRESETS[0].config,
  );
  const [presetId, setPresetId] = React.useState(PATTERN_PRESETS[0].id);

  const meta = PATTERNS.find((p) => p.type === config.type) ?? PATTERNS[0];

  const patch = (next: Partial<PatternConfig>) => {
    setPresetId("custom");
    setConfig((prev) => ({ ...prev, ...next }));
  };

  const loadPreset = (id: string) => {
    const preset = PATTERN_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setConfig(preset.config);
  };

  const swap = () => patch({ fg: config.bg, bg: config.fg });

  const css = toCss(config);
  const tailwind = toTailwind(config);
  const svg = toSvg(config);
  const commit = () =>
    history.add(`Pattern · ${meta.name} · ${config.size}px · ${config.fg}`, css);

  const downloadSvg = () => {
    try {
      const blob = new Blob([toSvg(config, 1600, 1000)], {
        type: "image/svg+xml",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pattern-${config.type}.svg`;
      a.click();
      URL.revokeObjectURL(a.href);
      commit();
      toast.success("SVG downloaded");
    } catch {
      toast.error("Could not export SVG");
    }
  };

  const exportTabs = [
    { id: "css", name: "CSS", code: css },
    { id: "tailwind", name: "Tailwind", code: tailwind },
    { id: "svg", name: "SVG", code: svg },
  ];

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.pattern}
      output={null}
      footer={<HistoryPanel history={history} />}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        {/* The pattern is the point — give it the wide column. */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="lg:sticky lg:top-20">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GridIcon className="text-primary size-4" />
                  Preview
                </CardTitle>
                <CardDescription>
                  Pure-CSS {meta.name.toLowerCase()} — sharp at any zoom, zero
                  image weight.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className="h-80 w-full overflow-hidden rounded-xl sm:h-96 lg:h-[34rem]"
                  style={toStyle(config)}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={swap}
                    className="h-8 text-xs"
                  >
                    <RefreshCwIcon className="size-3.5" /> Swap colors
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={downloadSvg}
                    className="text-muted-foreground ml-auto h-8 text-xs"
                  >
                    <DownloadIcon className="size-3.5" /> SVG
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontalIcon className="text-primary size-4" />
                Pattern
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-4 gap-2">
                {PATTERNS.map((p) => (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => patch({ type: p.type as PatternType })}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors",
                      config.type === p.type
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-border",
                    )}
                    title={p.name}
                  >
                    <span
                      className="h-9 w-full rounded"
                      style={toStyle({
                        ...config,
                        type: p.type,
                        size: Math.min(config.size, 18),
                      })}
                    />
                    <span className="text-[10px] font-bold tracking-tight">
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {PATTERN_PRESETS.map((p) => (
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

              <div className="space-y-5">
                <PatternSlider
                  label="Tile size"
                  value={config.size}
                  unit="px"
                  min={8}
                  max={120}
                  onChange={(v) => patch({ size: v })}
                />
                {meta.uses.weight && (
                  <PatternSlider
                    label="Weight"
                    value={config.weight}
                    unit="px"
                    min={1}
                    max={20}
                    onChange={(v) => patch({ weight: v })}
                  />
                )}
                {meta.uses.angle && (
                  <PatternSlider
                    label="Angle"
                    value={config.angle}
                    unit="°"
                    min={0}
                    max={180}
                    step={5}
                    onChange={(v) => patch({ angle: v })}
                  />
                )}
                <PatternSlider
                  label="Opacity"
                  value={config.opacity}
                  unit="%"
                  min={10}
                  max={100}
                  onChange={(v) => patch({ opacity: v })}
                />
              </div>

              <div className="flex flex-wrap items-end gap-6">
                <ColorField
                  id="pattern-fg"
                  label="Ink"
                  value={config.fg}
                  onChange={(v) => patch({ fg: v })}
                />
                <ColorField
                  id="pattern-bg"
                  label="Background"
                  value={config.bg}
                  onChange={(v) => patch({ bg: v })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export</CardTitle>
              <CardDescription>
                Drop the class on any element — it tiles seamlessly.
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

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
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
        <span className="text-muted-foreground font-mono text-xs">{value}</span>
      </div>
    </div>
  );
}

function PatternSlider({
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
