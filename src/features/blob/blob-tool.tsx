"use client";

import * as React from "react";
import { DownloadIcon, ShapesIcon, ShuffleIcon, SlidersHorizontalIcon } from "lucide-react";
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
import { BLOB_SIZE, DEFAULT_SHAPE, toCss, toSvg, type ShapeConfig, type ShapeMode } from "@/lib/blob";
import { dataUrlToBlob, downloadDataUrl, downloadText } from "@/lib/qr";
import { cn } from "@/lib/utils";

export function BlobTool() {
  const history = useHistory("blob");
  const [config, setConfig] = React.useState<ShapeConfig>(DEFAULT_SHAPE);

  const set = <K extends keyof ShapeConfig>(key: K, value: ShapeConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const shuffle = () => set("seed", Math.floor(Math.random() * 1e9));

  const svg = toSvg(config);
  const css = toCss(config);
  const isWave = config.mode === "wave";

  const commit = () => history.add(`${config.mode} · ${config.c1}`, svg);

  const rasterize = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const w = isWave ? 1440 : BLOB_SIZE;
        const h = isWave ? 320 : BLOB_SIZE;
        const canvas = document.createElement("canvas");
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error());
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error());
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });

  const downloadPng = async () => {
    try {
      downloadDataUrl(await rasterize(), `${config.mode}.png`);
      commit();
    } catch {
      toast.error("Could not render PNG");
    }
  };

  const copyPng = async () => {
    try {
      const blob = await dataUrlToBlob(await rasterize());
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Image copied");
      commit();
    } catch {
      toast.error("Your browser blocked image copy — download instead");
    }
  };

  const exportTabs = [
    { id: "svg", name: "SVG", code: svg },
    { id: "css", name: "CSS", code: css },
  ];

  return (
    <GeneratorLayout tool={TOOL_BY_ID.blob} output={null} footer={<HistoryPanel history={history} />}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        {/* Preview */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="lg:sticky lg:top-20 space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShapesIcon className="text-primary size-4" /> Preview
                </CardTitle>
                <CardDescription>
                  {isWave ? "A full-width section divider." : "A unique organic blob — shuffle for more."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className={cn(
                    "bg-muted/40 border-border flex items-center justify-center overflow-hidden rounded-xl border",
                    isWave ? "p-0" : "p-8"
                  )}
                >
                  <div
                    className={cn(isWave ? "w-full" : "w-full max-w-sm", "[&>svg]:h-auto [&>svg]:w-full")}
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={shuffle} className="flex-1 font-semibold">
                    <ShuffleIcon className="size-4" /> Shuffle
                  </Button>
                  <Button variant="outline" onClick={downloadPng}>
                    <DownloadIcon className="size-4" /> PNG
                  </Button>
                  <Button variant="outline" onClick={copyPng}>
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Export</CardTitle>
                <CardDescription>Drop the SVG in your markup, or the CSS on any element.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="svg" className="w-full">
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
                        <pre className="bg-muted/50 border-border max-h-60 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                          {t.code}
                        </pre>
                        <div className="absolute top-1.5 right-1.5 flex gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => downloadText(t.code, `${config.mode}.${t.id}`, t.id === "svg" ? "image/svg+xml" : "text/css")} aria-label={`Download ${t.name}`}>
                            <DownloadIcon className="size-3.5" />
                          </Button>
                          <CopyButton text={t.code} label="" variant="ghost" size="icon-sm" successMessage={`${t.name} copied`} onCopied={commit} aria-label={`Copy ${t.name}`} />
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Controls */}
        <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontalIcon className="text-primary size-4" /> Shape
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/60 inline-flex w-full rounded-lg p-0.5">
                {(["blob", "wave"] as ShapeMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set("mode", m)}
                    className={cn(
                      "flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                      config.mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {!isWave ? (
                <>
                  <ShapeSlider label="Points" value={config.points} min={3} max={12} onChange={(v) => set("points", v)} />
                  <ShapeSlider label="Randomness" value={config.randomness} unit="%" min={0} max={100} onChange={(v) => set("randomness", v)} />
                </>
              ) : (
                <>
                  <ShapeSlider label="Layers" value={config.layers} min={1} max={4} onChange={(v) => set("layers", v)} />
                  <ShapeSlider label="Amplitude" value={config.amplitude} unit="%" min={5} max={100} onChange={(v) => set("amplitude", v)} />
                  <ShapeSlider label="Complexity" value={config.complexity} min={2} max={10} onChange={(v) => set("complexity", v)} />
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <Switch checked={config.flip} onCheckedChange={(v) => set("flip", v)} aria-label="Flip" />
                    <span className="text-sm">Flip vertically (top divider)</span>
                  </label>
                </>
              )}

              <div className="space-y-3 border-t border-border/60 pt-5">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <Switch checked={config.gradient} onCheckedChange={(v) => set("gradient", v)} aria-label="Gradient" />
                  <span className="text-sm">Gradient fill</span>
                </label>
                <div className="flex flex-wrap items-end gap-5">
                  <ColorPick label={config.gradient ? "Color 1" : "Color"} id="bl-c1" value={config.c1} onChange={(v) => set("c1", v)} />
                  {config.gradient && (
                    <ColorPick label="Color 2" id="bl-c2" value={config.c2} onChange={(v) => set("c2", v)} />
                  )}
                </div>
                {config.gradient && !isWave && (
                  <ShapeSlider label="Gradient angle" value={config.angle} unit="°" min={0} max={360} step={5} onChange={(v) => set("angle", v)} />
                )}
              </div>
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
        <Input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-12 cursor-pointer p-1" aria-label={label} />
        <span className="font-mono text-xs">{value}</span>
      </div>
    </div>
  );
}

function ShapeSlider({
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
