"use client";

import * as React from "react";
import { ALargeSmallIcon, MinusIcon, PlusIcon, SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { TOOL_BY_ID } from "@/constants/tools";
import { buildScale, RATIO_PRESETS, toCss, toTailwind, type ScaleOptions } from "@/lib/fluid";

const SAMPLE = "The five boxing wizards jump quickly";

export function FluidTool() {
  const [opts, setOpts] = React.useState<ScaleOptions>({
    minVw: 360,
    maxVw: 1280,
    baseMin: 16,
    baseMax: 18,
    ratioMin: 1.2,
    ratioMax: 1.25,
    stepsUp: 5,
    stepsDown: 2,
  });

  const set = <K extends keyof ScaleOptions>(key: K, value: ScaleOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  const steps = buildScale(opts);
  const css = toCss(steps);
  const tailwind = toTailwind(steps);

  const exportTabs = [
    { id: "css", name: "CSS", code: css },
    { id: "tailwind", name: "Tailwind", code: tailwind },
  ];

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.fluid}
      output={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export</CardTitle>
            <CardDescription>Drop the variables in once; every size scales itself.</CardDescription>
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
                    <pre className="bg-muted/50 border-border max-h-96 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre">
                      {t.code}
                    </pre>
                    <CopyButton
                      text={t.code}
                      label=""
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1.5 right-1.5"
                      successMessage={`${t.name} copied`}
                      aria-label={`Copy ${t.name}`}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontalIcon className="text-primary size-4" />
              Settings
            </CardTitle>
            <CardDescription>
              Sizes interpolate linearly between the two viewports, then lock at the ends.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <SliderRow label="Min viewport" value={opts.minVw} unit="px" min={240} max={768} step={8} onChange={(v) => set("minVw", Math.min(v, opts.maxVw - 8))} />
              <SliderRow label="Max viewport" value={opts.maxVw} unit="px" min={768} max={1920} step={8} onChange={(v) => set("maxVw", Math.max(v, opts.minVw + 8))} />
              <SliderRow label="Base size · min" value={opts.baseMin} unit="px" min={12} max={24} step={0.5} onChange={(v) => set("baseMin", v)} />
              <SliderRow label="Base size · max" value={opts.baseMax} unit="px" min={14} max={32} step={0.5} onChange={(v) => set("baseMax", v)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <RatioSelect label="Scale ratio · min" value={opts.ratioMin} onChange={(v) => set("ratioMin", v)} />
              <RatioSelect label="Scale ratio · max" value={opts.ratioMax} onChange={(v) => set("ratioMax", v)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Stepper label="Steps up" value={opts.stepsUp} min={1} max={6} onChange={(v) => set("stepsUp", v)} />
              <Stepper label="Steps down" value={opts.stepsDown} min={0} max={3} onChange={(v) => set("stepsDown", v)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ALargeSmallIcon className="text-primary size-4" />
              Live scale
            </CardTitle>
            <CardDescription>Resize the window to watch every size flex in real time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {steps.map((s) => (
              <div key={s.index} className="border-border/60 border-b pb-5 last:border-0 last:pb-0">
                <div className="text-muted-foreground mb-1 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-foreground font-bold">{s.label}</span>
                  <span>
                    {s.minPx}px → {s.maxPx}px
                  </span>
                </div>
                <p
                  className="font-heading truncate font-bold tracking-tight"
                  style={{ fontSize: s.clamp }}
                  title={s.clamp}
                >
                  {SAMPLE}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

function SliderRow({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
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

function RatioSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RATIO_PRESETS.map((r) => (
            <SelectItem key={r.value} value={String(r.value)}>
              {r.name} · {r.value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer ${label}`}>
          <MinusIcon className="size-3.5" />
        </Button>
        <span className="w-8 text-center font-mono text-sm font-bold">{value}</span>
        <Button variant="outline" size="icon-sm" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More ${label}`}>
          <PlusIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
