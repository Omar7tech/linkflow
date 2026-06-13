"use client";

import * as React from "react";
import { Code2Icon, DownloadIcon, SlidersHorizontalIcon, TypeIcon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import {
  BACKDROPS,
  CODE_FONTS,
  CODE_THEMES,
  DEFAULT_CODESHOT,
  LANGUAGES,
  highlightCode,
  renderCodeshot,
  resolveFontFamily,
  type CodeshotConfig,
  type Lang,
} from "@/lib/codeshot";
import { dataUrlToBlob, downloadDataUrl } from "@/lib/qr";
import { cn } from "@/lib/utils";

export function CodeshotTool() {
  const history = useHistory("codeshot");
  const [config, setConfig] = React.useState<CodeshotConfig>(DEFAULT_CODESHOT);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const set = <K extends keyof CodeshotConfig>(key: K, value: CodeshotConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const transparent = config.backdropId === "none";
  const configKey = JSON.stringify(config);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      // Make sure the chosen webfont is loaded before measuring/drawing.
      try {
        await document.fonts.load(`${config.fontSize}px ${resolveFontFamily(config.fontFamily)}`);
      } catch {
        /* fall back to whatever's available */
      }
      const hl = await highlightCode(config.code, config.language, config.themeId, config.tabSize);
      if (!cancelled && canvasRef.current) renderCodeshot(canvasRef.current, config, hl);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- configKey captures config
  }, [configKey]);

  const filename = (config.title || "code").replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-") || "code";

  const commit = () => history.add(`${config.language} · ${config.title || "snippet"}`, config.code);

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    downloadDataUrl(canvas.toDataURL("image/png"), `${filename}.png`);
    commit();
  };

  const copyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await dataUrlToBlob(canvas.toDataURL("image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Image copied to clipboard");
      commit();
    } catch {
      toast.error("Your browser blocked image copy — download instead");
    }
  };

  return (
    <GeneratorLayout tool={TOOL_BY_ID.codeshot} output={null} footer={<HistoryPanel history={history} />}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Preview — leads on mobile, sticky on desktop. */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="lg:sticky lg:top-20 space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Code2Icon className="text-primary size-4" /> Preview
                </CardTitle>
                <CardDescription>Rendered on-canvas — exactly what you download.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className={cn("overflow-auto rounded-xl", transparent && "p-2")}
                  style={
                    transparent
                      ? {
                          backgroundImage:
                            "linear-gradient(45deg,#e5e5e5 25%,transparent 25%),linear-gradient(-45deg,#e5e5e5 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e5e5 75%),linear-gradient(-45deg,transparent 75%,#e5e5e5 75%)",
                          backgroundSize: "18px 18px",
                          backgroundPosition: "0 0,0 9px,9px -9px,-9px 0",
                        }
                      : undefined
                  }
                >
                  <canvas ref={canvasRef} className="h-auto w-full rounded-xl" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={downloadPng} className="flex-1 font-semibold">
                    <DownloadIcon className="size-4" /> Download PNG
                  </Button>
                  <Button variant="outline" onClick={copyImage}>
                    Copy image
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Controls */}
        <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TypeIcon className="text-primary size-4" /> Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={config.code}
                onChange={(e) => set("code", e.target.value)}
                rows={8}
                spellCheck={false}
                className="font-mono text-xs leading-relaxed"
                aria-label="Code"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cs-lang">Language</Label>
                  <Select value={config.language} onValueChange={(v) => set("language", v as Lang)}>
                    <SelectTrigger id="cs-lang" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cs-title">Window title</Label>
                  <Input id="cs-title" value={config.title} onChange={(e) => set("title", e.target.value)} placeholder="app.ts" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontalIcon className="text-primary size-4" /> Style
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="cs-theme">Theme</Label>
                <Select value={config.themeId} onValueChange={(v) => set("themeId", v)}>
                  <SelectTrigger id="cs-theme" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {CODE_THEMES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        <span className="text-muted-foreground ml-1.5 text-[10px]">{t.dark ? "dark" : "light"}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Background</Label>
                <div className="flex flex-wrap gap-2">
                  {BACKDROPS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => set("backdropId", b.id)}
                      className={cn(
                        "size-8 rounded-lg border-2 transition-transform",
                        config.backdropId === b.id ? "border-primary scale-110" : "border-border/40 hover:scale-105"
                      )}
                      style={{
                        background: b.stops
                          ? `linear-gradient(135deg,${b.stops[0]},${b.stops[1]})`
                          : b.id === "theme"
                            ? "linear-gradient(135deg,#475569,#1e293b)"
                            : "repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 8px 8px",
                      }}
                      aria-label={b.name}
                      title={b.name}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => set("backdropId", "custom")}
                    className={cn(
                      "size-8 rounded-lg border-2 transition-transform",
                      config.backdropId === "custom" ? "border-primary scale-110" : "border-border/40 hover:scale-105"
                    )}
                    style={{ background: `linear-gradient(135deg,${config.customBg1},${config.customBg2})` }}
                    aria-label="Custom background"
                    title="Custom"
                  />
                </div>
                {config.backdropId === "custom" && (
                  <div className="flex gap-2 pt-1">
                    <Input type="color" value={config.customBg1} onChange={(e) => set("customBg1", e.target.value)} className="h-8 w-12 cursor-pointer p-1" aria-label="Gradient start" />
                    <Input type="color" value={config.customBg2} onChange={(e) => set("customBg2", e.target.value)} className="h-8 w-12 cursor-pointer p-1" aria-label="Gradient end" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cs-chrome">Window</Label>
                  <Select value={config.windowChrome} onValueChange={(v) => set("windowChrome", v as CodeshotConfig["windowChrome"])}>
                    <SelectTrigger id="cs-chrome" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mac">Mac dots</SelectItem>
                      <SelectItem value="minimal">Title only</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cs-font">Font</Label>
                  <Select value={config.fontFamily} onValueChange={(v) => set("fontFamily", v)}>
                    <SelectTrigger id="cs-font" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CODE_FONTS.map((fnt) => (
                        <SelectItem key={fnt.label} value={fnt.value}>
                          {fnt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <CsSlider label="Font size" value={config.fontSize} unit="px" min={11} max={24} onChange={(v) => set("fontSize", v)} />
              <CsSlider label="Padding" value={config.padding} unit="px" min={0} max={120} step={4} onChange={(v) => set("padding", v)} />
              <CsSlider label="Corner radius" value={config.radius} unit="px" min={0} max={28} onChange={(v) => set("radius", v)} />

              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <Switch checked={config.lineNumbers} onCheckedChange={(v) => set("lineNumbers", v)} aria-label="Line numbers" />
                  <span className="text-sm">Line numbers</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2.5">
                  <Switch checked={config.shadow} onCheckedChange={(v) => set("shadow", v)} aria-label="Shadow" />
                  <span className="text-sm">Shadow</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cs-tab">Tab size</Label>
                  <Select value={String(config.tabSize)} onValueChange={(v) => set("tabSize", Number(v))}>
                    <SelectTrigger id="cs-tab" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 spaces</SelectItem>
                      <SelectItem value="4">4 spaces</SelectItem>
                      <SelectItem value="8">8 spaces</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cs-scale">Export size</Label>
                  <Select value={String(config.scale)} onValueChange={(v) => set("scale", Number(v))}>
                  <SelectTrigger id="cs-scale" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1× (standard)</SelectItem>
                    <SelectItem value="2">2× (retina)</SelectItem>
                    <SelectItem value="3">3× (print)</SelectItem>
                  </SelectContent>
                </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </GeneratorLayout>
  );
}

function CsSlider({
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
