"use client";

import * as React from "react";
import {
  ApertureIcon,
  ImageUpIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  XIcon,
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import {
  FILTER_PRESETS,
  FILTER_SCENES,
  defaults,
  toCss,
  toFilter,
  toStyle,
  toTailwind,
  type FilterConfig,
} from "@/lib/filterlab";
import { cn } from "@/lib/utils";

const clamp = (n: number) => Math.min(Math.max(n, 0), 100);

export function FilterLabTool() {
  const history = useHistory("filterlab");
  const [config, setConfig] = React.useState<FilterConfig>(
    FILTER_PRESETS[1].config,
  );
  const [presetId, setPresetId] = React.useState(FILTER_PRESETS[1].id);
  const [sceneId, setSceneId] = React.useState(FILTER_SCENES[0].id);
  const [image, setImage] = React.useState<string | null>(null);
  const [split, setSplit] = React.useState(55);

  const scene = FILTER_SCENES.find((s) => s.id === sceneId) ?? FILTER_SCENES[0];
  const stageRef = React.useRef<HTMLDivElement>(null);

  const set = <K extends keyof FilterConfig>(key: K, value: FilterConfig[K]) => {
    setPresetId("custom");
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const loadPreset = (id: string) => {
    const preset = FILTER_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setConfig(preset.config);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const startSplit = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const move = (clientX: number) =>
      setSplit(clamp(((clientX - rect.left) / rect.width) * 100));
    move(e.clientX);
    const onMove = (ev: PointerEvent) => move(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const subjectStyle: React.CSSProperties = image
    ? { backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: scene.background };

  const css = toCss(config);
  const tailwind = toTailwind(config);
  const commit = () => history.add(`Filter · ${toFilter(config)}`, css);

  const exportTabs = [
    { id: "css", name: "CSS", code: css },
    { id: "tailwind", name: "Tailwind", code: tailwind },
  ];

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.filterlab}
      output={null}
      footer={<HistoryPanel history={history} />}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        {/* The image comparison owns the wide column. */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="lg:sticky lg:top-20">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ApertureIcon className="text-primary size-4" />
                  Before / After
                </CardTitle>
                <CardDescription>
                  Drag the divider to compare. Left is filtered, right is the
                  original.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  ref={stageRef}
                  onPointerDown={startSplit}
                  className="relative h-80 w-full cursor-ew-resize touch-none overflow-hidden rounded-xl select-none sm:h-96 lg:h-[34rem]"
                >
                  {/* Original (right). */}
                  <div className="absolute inset-0" style={subjectStyle} />
                  {/* Filtered (left), revealed up to the split. */}
                  <div
                    className="absolute inset-0"
                    style={{
                      ...subjectStyle,
                      ...toStyle(config),
                      clipPath: `inset(0 ${100 - split}% 0 0)`,
                    }}
                  />

                  {/* Labels. */}
                  <span className="bg-background/80 text-foreground absolute top-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                    Filtered
                  </span>
                  <span className="bg-background/80 text-foreground absolute top-2 right-2 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                    Original
                  </span>

                  {/* Divider. */}
                  <div
                    className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
                    style={{ left: `${split}%` }}
                  >
                    <span className="absolute top-1/2 left-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-900 shadow-md">
                      <SlidersHorizontalIcon className="size-3.5" />
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {FILTER_SCENES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSceneId(s.id);
                        setImage(null);
                      }}
                      className={cn(
                        "h-9 w-12 overflow-hidden rounded-lg border-2 transition-all",
                        sceneId === s.id && !image
                          ? "border-primary scale-105"
                          : "border-border/40 hover:border-border",
                      )}
                      style={{ background: s.background }}
                      aria-label={`${s.name} scene`}
                      title={s.name}
                    />
                  ))}
                  {image && (
                    <span className="relative inline-flex">
                      <span
                        className="border-primary h-9 w-12 scale-105 rounded-lg border-2 bg-cover bg-center"
                        style={{ backgroundImage: `url(${image})` }}
                      />
                      <button
                        type="button"
                        onClick={() => setImage(null)}
                        className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full"
                        aria-label="Remove image"
                      >
                        <XIcon className="size-2.5" />
                      </button>
                    </span>
                  )}
                  <label
                    className="border-border/60 hover:border-border text-muted-foreground flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border-2 border-dashed px-2.5 text-xs font-bold"
                    title="Upload a photo"
                  >
                    <ImageUpIcon className="size-3.5" />
                    Your photo
                    <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSplit(55)}
                    className="text-muted-foreground ml-auto h-8 text-xs"
                  >
                    <RotateCcwIcon className="size-3.5" /> Center
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
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {FILTER_PRESETS.map((p) => (
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
                <FlSlider label="Brightness" value={config.brightness} unit="%" min={0} max={200} onChange={(v) => set("brightness", v)} />
                <FlSlider label="Contrast" value={config.contrast} unit="%" min={0} max={200} onChange={(v) => set("contrast", v)} />
                <FlSlider label="Saturation" value={config.saturate} unit="%" min={0} max={300} onChange={(v) => set("saturate", v)} />
                <FlSlider label="Hue" value={config.hue} unit="°" min={0} max={360} step={5} onChange={(v) => set("hue", v)} />
                <FlSlider label="Grayscale" value={config.grayscale} unit="%" min={0} max={100} onChange={(v) => set("grayscale", v)} />
                <FlSlider label="Sepia" value={config.sepia} unit="%" min={0} max={100} onChange={(v) => set("sepia", v)} />
                <FlSlider label="Invert" value={config.invert} unit="%" min={0} max={100} onChange={(v) => set("invert", v)} />
                <FlSlider label="Blur" value={config.blur} unit="px" min={0} max={20} onChange={(v) => set("blur", v)} />
                <FlSlider label="Opacity" value={config.opacity} unit="%" min={0} max={100} onChange={(v) => set("opacity", v)} />
              </div>

              <div className="space-y-4">
                <label className="flex items-start gap-3">
                  <Switch checked={config.shadow} onCheckedChange={(v) => set("shadow", v)} aria-label="Drop shadow" className="mt-0.5" />
                  <span className="text-sm">
                    Drop shadow
                    <span className="text-muted-foreground block text-xs">
                      A real drop-shadow() that follows the pixels, not the box.
                    </span>
                  </span>
                </label>
                {config.shadow && (
                  <div className="flex flex-wrap items-end gap-6 pl-12">
                    <div className="space-y-2">
                      <Label htmlFor="fl-shadow">Color</Label>
                      <Input
                        id="fl-shadow"
                        type="color"
                        value={config.shadowColor}
                        onChange={(e) => set("shadowColor", e.target.value)}
                        className="h-8 w-12 cursor-pointer p-1"
                        aria-label="Shadow color"
                      />
                    </div>
                    <div className="min-w-[140px] flex-1">
                      <FlSlider label="Shadow blur" value={config.shadowBlur} unit="px" min={0} max={50} onChange={(v) => set("shadowBlur", v)} />
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setConfig(defaults());
                  setPresetId("original");
                }}
                className="h-8 text-xs"
              >
                <RotateCcwIcon className="size-3.5" /> Reset filters
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export</CardTitle>
              <CardDescription>
                Apply to any image, video or element.
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

function FlSlider({
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
