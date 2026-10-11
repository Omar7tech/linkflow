"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  Loader2Icon,
  ShuffleIcon,
  SlidersHorizontalIcon,
  TypeIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  FRAME_RATIOS,
  LANGUAGES,
  backdropCss,
  highlightCode,
  langFromFilename,
  plainTokens,
  renderCodeshot,
  resolveFontFamily,
  warmHighlighter,
  type CodeshotConfig,
  type Highlighted,
  type Lang,
} from "@/lib/codeshot";
import { cn } from "@/lib/utils";

const CHECKER: React.CSSProperties = {
  backgroundImage: "repeating-conic-gradient(#d4d4d833 0% 25%, transparent 0% 50%)",
  backgroundSize: "16px 16px",
};

const canvasBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));

export function CodeshotTool() {
  const history = useHistory("codeshot");
  const [config, setConfig] = React.useState<CodeshotConfig>(DEFAULT_CODESHOT);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const set = <K extends keyof CodeshotConfig>(key: K, value: CodeshotConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  // Colored tokens, tagged with what they were made from. Highlighting only
  // reruns when the code, language, theme or tab width change — never for a
  // padding or backdrop tweak.
  const sourceKey = `${config.language}\u0000${config.themeId}\u0000${config.tabSize}\u0000${config.code}`;
  const [colored, setColored] = React.useState<{ key: string; hl: Highlighted } | null>(null);
  React.useEffect(() => {
    let live = true;
    highlightCode(config.code, config.language, config.themeId, config.tabSize).then(
      (hl) => live && setColored({ key: sourceKey, hl }),
      () => {}
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sourceKey covers them
  }, [sourceKey]);
  React.useEffect(() => void warmHighlighter(), []);

  // What gets drawn: the colored tokens if they match the code on screen,
  // otherwise the same code plain, in the last theme's colors — so typing is
  // never a frame behind and there is a picture before the highlighter lands.
  const tokens = React.useMemo(
    () =>
      colored?.key === sourceKey
        ? colored.hl
        : plainTokens(config.code, config.tabSize, colored?.hl.bg, colored?.hl.fg),
    [colored, sourceKey, config.code, config.tabSize]
  );
  const pending = colored?.key !== sourceKey;

  // Redraw once the chosen webfont is really there (measuring before gives the wrong grid).
  const [fontReady, setFontReady] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    document.fonts
      .load(`${config.fontSize}px ${resolveFontFamily(config.fontFamily)}`)
      .then(() => live && setFontReady((n) => n + 1), () => {});
    return () => {
      live = false;
    };
  }, [config.fontFamily, config.fontSize]);

  // The preview is drawn at screen resolution; the export is drawn separately at its own.
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const drawn = renderCodeshot(canvas, config, tokens, Math.min(2, window.devicePixelRatio || 1));
      setSize((s) => (s.width === drawn.width && s.height === drawn.height ? s : drawn));
    });
    return () => cancelAnimationFrame(raf);
  }, [config, tokens, fontReady]);

  const transparent = config.backdropId === "none";
  const filename = (config.title || "code").replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-") || "code";
  const commit = () => history.add(`${config.language} · ${config.title || "snippet"}`, config.code);

  const exportBlob = () => {
    const out = document.createElement("canvas");
    renderCodeshot(out, config, tokens, config.scale);
    return canvasBlob(out);
  };

  const downloadPng = async () => {
    const blob = await exportBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.png`;
    a.click();
    URL.revokeObjectURL(url);
    commit();
  };

  const copyImage = async () => {
    try {
      const blob = await exportBlob();
      if (!blob) throw new Error("no image");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Image copied to clipboard");
      commit();
    } catch {
      toast.error("Your browser blocked image copy — download instead");
    }
  };

  const stepTheme = (by: number) => {
    const i = CODE_THEMES.findIndex((t) => t.id === config.themeId);
    set("themeId", CODE_THEMES[(i + by + CODE_THEMES.length) % CODE_THEMES.length].id);
  };
  const shuffle = () => {
    const pick = <T,>(from: readonly T[]) => from[Math.floor(Math.random() * from.length)];
    const backdrops = BACKDROPS.filter((b) => b.id !== "none");
    setConfig((c) => ({ ...c, themeId: pick(CODE_THEMES).id, backdropId: pick(backdrops).id }));
  };

  // Naming the window after a file picks its language.
  const setTitle = (title: string) => {
    const lang = langFromFilename(title);
    setConfig((c) => ({ ...c, title, ...(lang ? { language: lang } : {}) }));
  };
  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 200_000) {
      toast.error("That file is too long for one image");
      return;
    }
    const code = (await file.text()).replace(/\r\n/g, "\n").trimEnd();
    const lang = langFromFilename(file.name);
    setConfig((c) => ({ ...c, code, title: file.name, ...(lang ? { language: lang } : {}) }));
  };
  // Tab indents instead of leaving the box.
  const onCodeKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const pad = " ".repeat(config.tabSize);
    set("code", value.slice(0, a) + pad + value.slice(b));
    requestAnimationFrame(() => el.setSelectionRange(a + pad.length, a + pad.length));
  };

  return (
    <GeneratorLayout tool={TOOL_BY_ID.codeshot} output={null} footer={<HistoryPanel history={history} />}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* The picture, with the two choices that change it most right above it. */}
          <Card className="overflow-hidden py-0">
            <div className="border-border flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <Select value={config.language} onValueChange={(v) => set("language", v as Lang)}>
                <SelectTrigger className="w-36" aria-label="Language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={() => stepTheme(-1)} aria-label="Previous theme" title="Previous theme">
                  <ChevronLeftIcon />
                </Button>
                <Select value={config.themeId} onValueChange={(v) => set("themeId", v)}>
                  <SelectTrigger className="w-44" aria-label="Theme">
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
                <Button variant="ghost" size="icon" onClick={() => stepTheme(1)} aria-label="Next theme" title="Next theme">
                  <ChevronRightIcon />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={shuffle} className="ml-auto">
                <ShuffleIcon /> Shuffle
              </Button>
            </div>

            <div
              className="bg-muted/40 relative flex min-h-64 items-center justify-center overflow-auto p-4 sm:p-6"
              style={transparent ? CHECKER : undefined}
            >
              <canvas
                ref={canvasRef}
                className="block h-auto max-w-full rounded-lg"
                style={{ width: size.width || undefined }}
                aria-label="Code image preview"
              />
              {pending && (
                <span className="bg-background/90 border-border text-muted-foreground absolute top-3 right-3 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]">
                  <Loader2Icon className="size-3 animate-spin" /> Coloring
                </span>
              )}
            </div>

            <div className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
              <p className="text-muted-foreground mr-auto font-mono text-[11px] tabular-nums">
                {size.width * config.scale} × {size.height * config.scale} px
              </p>
              <Select value={String(config.scale)} onValueChange={(v) => set("scale", Number(v))}>
                <SelectTrigger className="w-20" aria-label="Export size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1×</SelectItem>
                  <SelectItem value="2">2×</SelectItem>
                  <SelectItem value="3">3×</SelectItem>
                  <SelectItem value="4">4×</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={copyImage}>
                <CopyIcon /> Copy
              </Button>
              <Button size="sm" onClick={downloadPng} className="font-semibold">
                <DownloadIcon /> Download PNG
              </Button>
            </div>
          </Card>

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
                onKeyDown={onCodeKey}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;
                  e.preventDefault();
                  void loadFile(file);
                }}
                rows={10}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="font-mono text-[13px] leading-relaxed"
                aria-label="Code"
                placeholder="Paste or type code, or drop a file here"
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cs-title">Window title</Label>
                  <Input id="cs-title" value={config.title} onChange={(e) => setTitle(e.target.value)} placeholder="app.ts" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cs-focus">Spotlight lines</Label>
                  <Input id="cs-focus" value={config.focus} onChange={(e) => set("focus", e.target.value)} placeholder="2-4, 7" inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cs-caption">Credit</Label>
                  <Input id="cs-caption" value={config.caption} onChange={(e) => set("caption", e.target.value)} placeholder="@yourhandle" />
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                A title like <code className="font-mono">main.py</code> sets the language. Spotlighted lines stay bright and the rest dim.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Style */}
        <div className="min-w-0">
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontalIcon className="text-primary size-4" /> Style
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Backdrop</Label>
                <div className="grid grid-cols-8 gap-1.5">
                  {BACKDROPS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => set("backdropId", b.id)}
                      className={cn(
                        "aspect-square rounded-lg border-2 transition-transform",
                        config.backdropId === b.id ? "border-primary scale-110" : "border-border/40 hover:scale-105"
                      )}
                      style={{ background: backdropCss(b) }}
                      aria-label={b.name}
                      aria-pressed={config.backdropId === b.id}
                      title={b.name}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => set("backdropId", "custom")}
                    className={cn(
                      "aspect-square rounded-lg border-2 transition-transform",
                      config.backdropId === "custom" ? "border-primary scale-110" : "border-border/40 hover:scale-105"
                    )}
                    style={{ background: `linear-gradient(135deg,${config.customBg1},${config.customBg2})` }}
                    aria-label="Custom backdrop"
                    aria-pressed={config.backdropId === "custom"}
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

              <Choice
                label="Shape"
                value={config.ratio}
                onChange={(v) => set("ratio", v)}
                options={FRAME_RATIOS.map((r) => ({ value: r.id, label: r.label }))}
              />
              <Choice
                label="Window"
                value={config.windowChrome}
                onChange={(v) => set("windowChrome", v)}
                options={[
                  { value: "mac", label: "Dots" },
                  { value: "outline", label: "Rings" },
                  { value: "minimal", label: "Title" },
                  { value: "none", label: "None" },
                ]}
              />

              <div className="grid grid-cols-2 gap-3">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </GeneratorLayout>
  );
}

function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="bg-muted/60 flex gap-1 rounded-lg p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
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
