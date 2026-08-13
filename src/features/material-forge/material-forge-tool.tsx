"use client";

import * as React from "react";
import {
  BoxIcon,
  CircleIcon,
  FlaskConicalIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  SunIcon,
  WandSparklesIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
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
  buildMaterialCss,
  DEFAULT_MATERIAL,
  MATERIAL_PRESETS,
  materialStyle,
  mutateMaterial,
  type MaterialConfig,
  type MaterialShape,
} from "@/lib/material-forge";
import { cn } from "@/lib/utils";
import styles from "./material-forge.module.css";

type MaterialStyle = React.CSSProperties & Record<`--${string}`, string>;

const SHAPE_LABELS: Record<MaterialShape, string> = {
  slab: "Interface slab",
  orb: "Material orb",
  button: "Action button",
};

export function MaterialForgeTool() {
  const history = useHistory("materialforge");
  const [config, setConfig] = React.useState<MaterialConfig>({ ...DEFAULT_MATERIAL });
  const [presetId, setPresetId] = React.useState(MATERIAL_PRESETS[0].id);
  const [shape, setShape] = React.useState<MaterialShape>("slab");
  const [light, setLight] = React.useState({ x: 34, y: 24 });
  const stageRef = React.useRef<HTMLDivElement>(null);

  const set = <K extends keyof MaterialConfig>(key: K, value: MaterialConfig[K]) => {
    setPresetId("custom");
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const loadPreset = (id: string) => {
    const preset = MATERIAL_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setPresetId(id);
    setConfig({ ...preset.config });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!config.reactive) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLight({
      x: Math.max(4, Math.min(96, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(4, Math.min(96, ((event.clientY - rect.top) / rect.height) * 100)),
    });
  };

  const css = buildMaterialCss(config);
  const tokens = JSON.stringify(
    {
      name: config.name,
      colors: { base: config.base, accent: config.accent },
      surface: {
        roughness: config.roughness,
        metallic: config.metallic,
        transmission: config.transmission,
        refraction: config.refraction,
        iridescence: config.iridescence,
        grain: config.grain,
      },
      geometry: { depth: config.depth, radius: config.radius },
      light: { angle: config.lightAngle, intensity: config.lightIntensity },
    },
    null,
    2
  );

  const specimenStyle = {
    ...materialStyle(config),
    "--light-x": `${light.x}%`,
    "--light-y": `${light.y}%`,
    transform: config.reactive
      ? `rotateX(${((50 - light.y) / 10).toFixed(2)}deg) rotateY(${((light.x - 50) / 10).toFixed(2)}deg)`
      : "none",
  } as MaterialStyle;

  const commit = () => history.add(`${config.name} · ${SHAPE_LABELS[shape]}`, css);

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.materialforge}
      output={null}
      fullBleed
      footer={<HistoryPanel history={history} />}
    >
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConicalIcon className="text-primary size-4" aria-hidden />
              Specimen library
            </CardTitle>
            <CardDescription>
              Start from a measured material, then push it beyond the reference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex snap-x gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3 xl:grid-cols-6">
              {MATERIAL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => loadPreset(preset.id)}
                  aria-pressed={presetId === preset.id}
                  className={cn(
                    "group flex min-h-20 min-w-52 snap-start items-center gap-3 rounded-xl border p-2 text-left transition-colors sm:min-w-0",
                    presetId === preset.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <span
                    className="size-12 shrink-0 rounded-lg border border-white/15 shadow-sm"
                    style={{
                      background: `radial-gradient(circle at 28% 22%, white, transparent 24%), linear-gradient(135deg, ${preset.config.accent}, ${preset.config.base} 72%)`,
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{preset.name}</span>
                    <span className="text-muted-foreground block truncate text-[11px]">
                      {preset.family}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">Response chamber</CardTitle>
                  <CardDescription>
                    Move across the chamber to inspect highlight, depth, and spectral response.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={shape} onValueChange={(value) => setShape(value as MaterialShape)}>
                    <SelectTrigger aria-label="Preview object">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="slab">
                          <BoxIcon /> Interface slab
                        </SelectItem>
                        <SelectItem value="orb">
                          <CircleIcon /> Material orb
                        </SelectItem>
                        <SelectItem value="button">
                          <SparklesIcon /> Action button
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPresetId("custom");
                      setConfig(mutateMaterial(config));
                    }}
                  >
                    <WandSparklesIcon data-icon="inline-start" />
                    Mutate
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                ref={stageRef}
                className={styles.stage}
                onPointerMove={handlePointerMove}
                onPointerLeave={() => config.reactive && setLight({ x: 34, y: 24 })}
              >
                <div className={styles.readout} aria-hidden>
                  <span>R {config.roughness.toString().padStart(3, "0")}</span>
                  <span>M {config.metallic.toString().padStart(3, "0")}</span>
                  <span>I {config.iridescence.toString().padStart(3, "0")}</span>
                </div>
                <div className={styles.specimenWrap}>
                  <div
                    className={cn(
                      styles.specimen,
                      shape === "orb" && styles.orb,
                      shape === "button" && styles.button,
                      config.animate && styles.animated
                    )}
                    style={specimenStyle}
                  >
                    {shape === "slab" && (
                      <div className={styles.materialMark}>
                        <span className={styles.materialIndex}>MF—{presetId === "custom" ? "X" : "01"}</span>
                        <span className={styles.materialIndex}>SYNTHETIC</span>
                      </div>
                    )}
                    <div className={styles.materialMark}>
                      <span className={styles.materialName}>{config.name}</span>
                    </div>
                  </div>
                </div>
                {config.reactive && (
                  <span
                    className={styles.lightCursor}
                    style={{ left: `${light.x}%`, top: `${light.y}%` }}
                    aria-hidden
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <SlidersHorizontalIcon className="text-primary size-4" aria-hidden />
                    Material properties
                  </CardTitle>
                  <CardDescription>{presetId === "custom" ? "Custom specimen" : config.name}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => loadPreset(MATERIAL_PRESETS[0].id)}
                  aria-label="Reset material"
                  title="Reset material"
                >
                  <RotateCcwIcon />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-5 grid grid-cols-2 gap-3">
                <ColorField label="Body" value={config.base} onChange={(value) => set("base", value)} />
                <ColorField
                  label="Spectral accent"
                  value={config.accent}
                  onChange={(value) => set("accent", value)}
                />
              </div>

              <Tabs defaultValue="surface">
                <TabsList className="w-full">
                  <TabsTrigger value="surface" className="flex-1">Surface</TabsTrigger>
                  <TabsTrigger value="optics" className="flex-1">Optics</TabsTrigger>
                  <TabsTrigger value="light" className="flex-1">Light</TabsTrigger>
                </TabsList>

                <TabsContent value="surface">
                  <div className="flex flex-col gap-5 pt-3">
                    <MaterialSlider label="Roughness" value={config.roughness} onChange={(v) => set("roughness", v)} />
                    <MaterialSlider label="Metallic" value={config.metallic} onChange={(v) => set("metallic", v)} />
                    <MaterialSlider label="Micro grain" value={config.grain} onChange={(v) => set("grain", v)} />
                    <MaterialSlider label="Physical depth" value={config.depth} unit="px" onChange={(v) => set("depth", v)} />
                    <MaterialSlider label="Edge radius" value={config.radius} unit="px" max={64} onChange={(v) => set("radius", v)} />
                  </div>
                </TabsContent>

                <TabsContent value="optics">
                  <div className="flex flex-col gap-5 pt-3">
                    <MaterialSlider label="Transmission" value={config.transmission} onChange={(v) => set("transmission", v)} />
                    <MaterialSlider label="Refraction" value={config.refraction} onChange={(v) => set("refraction", v)} />
                    <MaterialSlider label="Iridescence" value={config.iridescence} onChange={(v) => set("iridescence", v)} />
                    <MaterialSlider label="Internal glow" value={config.glow} onChange={(v) => set("glow", v)} />
                  </div>
                </TabsContent>

                <TabsContent value="light">
                  <div className="flex flex-col gap-5 pt-3">
                    <MaterialSlider label="Light angle" value={config.lightAngle} unit="°" max={360} onChange={(v) => set("lightAngle", v)} />
                    <MaterialSlider label="Intensity" value={config.lightIntensity} onChange={(v) => set("lightIntensity", v)} />
                    <MaterialToggle
                      icon={<SunIcon className="size-4" aria-hidden />}
                      label="Reactive light"
                      hint="Track the pointer as a movable studio light."
                      checked={config.reactive}
                      onChange={(value) => set("reactive", value)}
                    />
                    <MaterialToggle
                      icon={<SparklesIcon className="size-4" aria-hidden />}
                      label="Spectral drift"
                      hint="Slowly rotate the thin-film color layer."
                      checked={config.animate}
                      onChange={(value) => set("animate", value)}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-base">Material recipe</CardTitle>
                <CardDescription>
                  Pseudo-elements build the spectral film and grain without image assets.
                </CardDescription>
              </div>
              <Badge variant="secondary">Browser-native</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="css">
              <TabsList>
                <TabsTrigger value="css">CSS</TabsTrigger>
                <TabsTrigger value="tokens">Material tokens</TabsTrigger>
              </TabsList>
              <TabsContent value="css">
                <CodeOutput code={css} label="CSS" onCopied={commit} />
              </TabsContent>
              <TabsContent value="tokens">
                <CodeOutput code={tokens} label="material tokens" onCopied={commit} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

function MaterialSlider({
  label,
  value,
  unit = "%",
  min = 0,
  max = 100,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-muted-foreground font-mono text-xs">
          {value}{unit}
        </span>
      </div>
      <Slider min={min} max={max} value={[value]} onValueChange={([next]) => onChange(next)} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border p-2">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="size-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
        aria-label={label}
      />
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        <span className="text-muted-foreground block truncate font-mono text-[10px] uppercase">{value}</span>
      </span>
    </label>
  );
}

function MaterialToggle({
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <span className="text-primary mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <Label className="block">{label}</Label>
        <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function CodeOutput({ code, label, onCopied }: { code: string; label: string; onCopied: () => void }) {
  return (
    <div className="relative mt-3">
      <pre className="bg-muted/50 border-border max-h-96 overflow-auto rounded-xl border p-4 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {code}
      </pre>
      <CopyButton
        text={code}
        label=""
        variant="ghost"
        size="icon-sm"
        className="absolute top-2 right-2"
        successMessage={`${label} copied`}
        onCopied={onCopied}
        aria-label={`Copy ${label}`}
      />
    </div>
  );
}
