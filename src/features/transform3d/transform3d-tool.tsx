"use client";

import * as React from "react";
import {
  Move3dIcon,
  RotateCcwIcon,
  Rotate3dIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  CARD_FACES,
  TRANSFORM3D_PRESETS,
  glarePosition,
  shadowStyle,
  toCss,
  toStyle,
  toTailwind,
  toTiltJs,
  type Transform3DConfig,
} from "@/lib/transform3d";
import { cn } from "@/lib/utils";

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

export function Transform3DTool() {
  const history = useHistory("transform3d");
  const [config, setConfig] = React.useState<Transform3DConfig>(
    TRANSFORM3D_PRESETS[0].config,
  );
  const [presetId, setPresetId] = React.useState(TRANSFORM3D_PRESETS[0].id);
  const [faceId, setFaceId] = React.useState(CARD_FACES[0].id);

  const face = CARD_FACES.find((f) => f.id === faceId) ?? CARD_FACES[0];
  const stageRef = React.useRef<HTMLDivElement>(null);

  const set = <K extends keyof Transform3DConfig>(
    key: K,
    value: Transform3DConfig[K],
  ) => {
    setPresetId("custom");
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const loadPreset = (id: string) => {
    const preset = TRANSFORM3D_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setConfig(preset.config);
  };

  // Drag anywhere on the stage to orbit: horizontal → rotateY, vertical → rotateX.
  const startOrbit = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setPresetId("custom");
    const startX = e.clientX;
    const startY = e.clientY;
    const baseX = config.rotateX;
    const baseY = config.rotateY;
    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      const dx = ev.clientX - startX;
      setConfig((prev) => ({
        ...prev,
        rotateX: clamp(baseX - dy * 0.4, -80, 80),
        rotateY: clamp(baseY + dx * 0.4, -80, 80),
      }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const css = toCss(config);
  const tailwind = toTailwind(config);
  const tiltJs = toTiltJs(config);
  const commit = () =>
    history.add(
      `3D · rX ${Math.round(config.rotateX)}° rY ${Math.round(config.rotateY)}° · ${config.perspective}px`,
      css,
    );

  const exportTabs = [
    { id: "css", name: "CSS", code: css },
    { id: "tailwind", name: "Tailwind", code: tailwind },
    { id: "js", name: "Hover tilt (JS)", code: tiltJs },
  ];

  const glare = glarePosition(config);
  const light = face.fg === "light";

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.transform3d}
      output={null}
      footer={<HistoryPanel history={history} />}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        {/* The 3D stage owns the wide column. */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="lg:sticky lg:top-20">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Rotate3dIcon className="text-primary size-4" />
                  Stage
                </CardTitle>
                <CardDescription>
                  Drag anywhere to orbit the card in 3D. Everything updates live.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  ref={stageRef}
                  onPointerDown={startOrbit}
                  className="bg-muted/40 relative flex h-80 w-full cursor-grab touch-none items-center justify-center overflow-hidden rounded-xl select-none active:cursor-grabbing sm:h-96 lg:h-[34rem]"
                  style={{ perspective: `${config.perspective}px` }}
                >
                  {/* Floor shadow, behind the card. */}
                  {config.shadow && (
                    <div
                      aria-hidden
                      className="absolute h-44 w-56 rounded-[40%] bg-black"
                      style={shadowStyle(config)}
                    />
                  )}

                  <div
                    className="relative flex h-56 w-72 flex-col justify-between overflow-hidden rounded-2xl p-5 shadow-xl"
                    style={{
                      background: face.background,
                      color: light ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.85)",
                      ...toStyle(config),
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "size-9 rounded-full",
                          light ? "bg-white/30" : "bg-slate-900/15",
                        )}
                      />
                      <Move3dIcon className="size-5 opacity-70" />
                    </div>
                    <div className="space-y-2">
                      <div
                        className={cn(
                          "h-2.5 w-28 rounded-full",
                          light ? "bg-white/55" : "bg-slate-900/35",
                        )}
                      />
                      <div
                        className={cn(
                          "h-2 w-20 rounded-full",
                          light ? "bg-white/35" : "bg-slate-900/20",
                        )}
                      />
                    </div>

                    {config.glare && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 mix-blend-screen"
                        style={{
                          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.6), rgba(255,255,255,0) 55%)`,
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {CARD_FACES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFaceId(f.id)}
                      className={cn(
                        "h-9 w-12 overflow-hidden rounded-lg border-2 transition-all",
                        faceId === f.id
                          ? "border-primary scale-105"
                          : "border-border/40 hover:border-border",
                      )}
                      style={{ background: f.background }}
                      aria-label={`${f.name} face`}
                      title={f.name}
                    />
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setConfig((p) => ({
                        ...p,
                        rotateX: 0,
                        rotateY: 0,
                        rotateZ: 0,
                      }))
                    }
                    className="text-muted-foreground ml-auto h-8 text-xs"
                  >
                    <RotateCcwIcon className="size-3.5" /> Reset angle
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
                Transform
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {TRANSFORM3D_PRESETS.map((p) => (
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
                <TfSlider label="Perspective" value={config.perspective} unit="px" min={200} max={2000} step={20} onChange={(v) => set("perspective", v)} />
                <TfSlider label="Rotate X" value={config.rotateX} unit="°" min={-80} max={80} onChange={(v) => set("rotateX", v)} />
                <TfSlider label="Rotate Y" value={config.rotateY} unit="°" min={-80} max={80} onChange={(v) => set("rotateY", v)} />
                <TfSlider label="Rotate Z" value={config.rotateZ} unit="°" min={-45} max={45} onChange={(v) => set("rotateZ", v)} />
                <TfSlider label="Depth (Z)" value={config.translateZ} unit="px" min={-100} max={300} step={5} onChange={(v) => set("translateZ", v)} />
                <TfSlider label="Scale" value={config.scale} unit="%" min={50} max={150} onChange={(v) => set("scale", v)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-start gap-3">
                  <Switch checked={config.glare} onCheckedChange={(v) => set("glare", v)} aria-label="Glare" className="mt-0.5" />
                  <span className="text-sm">
                    Light glare
                    <span className="text-muted-foreground block text-xs">
                      Specular highlight that tracks the tilt.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <Switch checked={config.shadow} onCheckedChange={(v) => set("shadow", v)} aria-label="Floor shadow" className="mt-0.5" />
                  <span className="text-sm">
                    Floor shadow
                    <span className="text-muted-foreground block text-xs">
                      Soft contact shadow that reacts to depth.
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
                CSS, Tailwind, or a drop-in pointer-tilt for any framework.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="css" className="w-full">
                <TabsList className="w-full">
                  {exportTabs.map((t) => (
                    <TabsTrigger key={t.id} value={t.id} className="flex-1 text-xs">
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

function TfSlider({
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
          {Math.round(value)}
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
