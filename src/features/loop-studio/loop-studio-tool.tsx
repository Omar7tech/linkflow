"use client";

import * as React from "react";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileImageIcon,
  ImageIcon,
  PaletteIcon,
  PauseIcon,
  PlayIcon,
  Repeat2Icon,
  SparklesIcon,
  TypeIcon,
  UploadIcon,
  VideoIcon,
  WandSparklesIcon,
  XIcon,
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
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { buildZip, type ZipEntry } from "@/lib/zip";
import {
  DEFAULT_LOOP,
  FONTS,
  FPS_OPTIONS,
  PRESETS,
  SIZES,
  THEMES,
  buildImageSubject,
  buildSpriteSheet,
  buildSvgSubject,
  buildTextSubject,
  exportCss,
  exportGif,
  frameCount,
  loopFilename,
  presetAvailable,
  renderFrame,
  type BgType,
  type LoopConfig,
  type PresetId,
  type SourceKind,
  type Subject,
} from "@/lib/loop-studio";
import { cn } from "@/lib/utils";

const PREVIEW_MAX = 460;

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function LoopStudioTool() {
  const [rawCfg, setCfg] = useLocalStorage<LoopConfig>("forma:loop-studio", DEFAULT_LOOP);
  const cfg = React.useMemo(() => ({ ...DEFAULT_LOOP, ...rawCfg }), [rawCfg]);

  const [svgMarkup, setSvgMarkup] = React.useState<string | null>(null);
  const [image, setImage] = React.useState<{ el: HTMLImageElement; url: string; w: number; h: number } | null>(null);
  const [playing, setPlaying] = React.useState(true);
  const [progress, setProgress] = React.useState(0);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  // The scrubber writes here every frame; keeping it out of state avoids a
  // React render per frame while the loop plays.
  const tRef = React.useRef(0);
  const cfgKey = JSON.stringify(cfg);

  /* ---- subject ---- */
  const [fontsReady, setFontsReady] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => alive && setFontsReady(true)).catch(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const subject = React.useMemo<Subject | null>(() => {
    if (cfg.source === "svg") return svgMarkup ? buildSvgSubject(svgMarkup) : null;
    if (cfg.source === "image") return image ? buildImageSubject(image.el, image.w, image.h) : null;
    if (!cfg.text.trim()) return null;
    return buildTextSubject(cfg);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cfgKey captures cfg; fontsReady forces a remeasure
  }, [cfgKey, svgMarkup, image, fontsReady]);

  const preset = PRESETS.find((p) => p.id === cfg.preset) ?? PRESETS[0];
  const presetOk = presetAvailable(preset, subject);
  const frames = frameCount(cfg);

  /* ---- preview loop ---- */
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const css = Math.min(PREVIEW_MAX, cfg.size);
    const pixels = Math.round(css * dpr);
    if (canvas.width !== pixels) canvas.width = pixels;
    if (canvas.height !== pixels) canvas.height = pixels;

    let raf = 0;
    const start = performance.now() - tRef.current * cfg.duration * 1000;

    const paint = (t: number) => {
      // Snap to the exported frame grid so the preview shows real output.
      const frame = Math.floor(t * frames) % frames;
      renderFrame(ctx, cfg, subject, frame / frames, pixels);
    };

    if (!playing) {
      paint(tRef.current);
      return;
    }

    const tick = (now: number) => {
      const t = ((now - start) / (cfg.duration * 1000)) % 1;
      tRef.current = t;
      paint(t);
      setProgress(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cfgKey captures cfg
  }, [cfgKey, subject, playing, frames]);

  const patch = (p: Partial<LoopConfig>) => setCfg((c) => ({ ...c, ...p }));

  const scrub = (value: number) => {
    setPlaying(false);
    tRef.current = value;
    setProgress(value);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      const frame = Math.floor(value * frames) % frames;
      renderFrame(ctx, cfg, subject, frame / frames, canvas.width);
    }
  };

  /* ---- sources ---- */
  const loadSvg = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const text = await file.text();
    if (!buildSvgSubject(text)) {
      toast.error("No drawable shapes found in that SVG.");
      return;
    }
    setSvgMarkup(text);
    patch({ source: "svg" });
  };

  const loadImage = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      setImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { el, url, w: el.naturalWidth, h: el.naturalHeight };
      });
      patch({ source: "image" });
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("That image could not be read.");
    };
    el.src = url;
  };

  /* ---- exports ---- */
  const withBusy = async (label: string, job: () => Promise<void>) => {
    if (busy) return;
    setBusy(label);
    // Let the button repaint before the main thread goes to work.
    await new Promise((r) => setTimeout(r, 30));
    try {
      await job();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  };

  const downloadGif = () =>
    withBusy("gif", async () => {
      if (!subject) throw new Error("Add a wordmark or upload a logo first.");
      saveBlob(exportGif(cfg, subject), loopFilename(cfg, "gif"));
      toast.success(`GIF exported — ${frames} frames`);
    });

  const downloadSprite = () =>
    withBusy("sprite", async () => {
      if (!subject) throw new Error("Add a wordmark or upload a logo first.");
      const sheet = buildSpriteSheet(cfg, subject);
      const png = await canvasToBlob(sheet.canvas);
      if (!png) throw new Error("Could not render the sprite sheet.");
      const entries: ZipEntry[] = [
        { name: "loop-sprite.png", data: new Uint8Array(await png.arrayBuffer()) },
        { name: "loop.css", data: new TextEncoder().encode(sheet.css) },
      ];
      saveBlob(buildZip(entries), loopFilename(cfg, "sprite.zip"));
      toast.success(`Sprite sheet exported — ${sheet.columns}×${sheet.rows}`);
    });

  const downloadFrames = () =>
    withBusy("frames", async () => {
      if (!subject) throw new Error("Add a wordmark or upload a logo first.");
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = cfg.size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable in this browser.");
      const entries: ZipEntry[] = [];
      for (let i = 0; i < frames; i++) {
        renderFrame(ctx, cfg, subject, i / frames, cfg.size);
        const blob = await canvasToBlob(canvas);
        if (!blob) continue;
        entries.push({
          name: `frame-${String(i + 1).padStart(3, "0")}.png`,
          data: new Uint8Array(await blob.arrayBuffer()),
        });
      }
      saveBlob(buildZip(entries), loopFilename(cfg, "frames.zip"));
      toast.success(`${entries.length} PNG frames exported`);
    });

  const downloadWebm = () =>
    withBusy("webm", async () => {
      if (!subject) throw new Error("Add a wordmark or upload a logo first.");
      const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
        (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)
      );
      if (!type) throw new Error("This browser can't record WebM — try the GIF or sprite sheet.");

      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = cfg.size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable in this browser.");

      const stream = canvas.captureStream(0);
      const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.start();

      // Two passes so the loop is long enough to be obvious in a player, and
      // requestFrame drives the capture rather than the wall clock.
      const frameDelay = 1000 / cfg.fps;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < frames; i++) {
          renderFrame(ctx, cfg, subject, i / frames, cfg.size);
          track.requestFrame();
          await new Promise((r) => setTimeout(r, frameDelay));
        }
      }
      recorder.stop();
      await done;
      track.stop();
      saveBlob(new Blob(chunks, { type }), loopFilename(cfg, "webm"));
      toast.success("WebM exported");
    });

  const css = exportCss(cfg);
  const copyCss = async () => {
    if (!css) return;
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Clipboard blocked — select the code and copy it.");
    }
  };

  const previewSize = Math.min(PREVIEW_MAX, cfg.size);
  const needsSource =
    (cfg.source === "svg" && !svgMarkup) || (cfg.source === "image" && !image) || (cfg.source === "text" && !cfg.text.trim());

  return (
    <GeneratorLayout tool={TOOL_BY_ID.loop} output={null}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ---- Stage ---- */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="space-y-3 lg:sticky lg:top-20">
            <Card>
              <CardContent className="space-y-4">
                <div
                  className={cn(
                    "flex items-center justify-center rounded-xl p-4",
                    // A checkerboard makes transparent output obvious.
                    cfg.bgType === "transparent"
                      ? "bg-[linear-gradient(45deg,#00000010_25%,transparent_25%,transparent_75%,#00000010_75%),linear-gradient(45deg,#00000010_25%,transparent_25%,transparent_75%,#00000010_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]"
                      : "bg-muted/40"
                  )}
                >
                  <canvas
                    ref={canvasRef}
                    className="block max-w-full rounded-lg"
                    style={{ width: previewSize, height: previewSize }}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPlaying((p) => !p)}
                    aria-label={playing ? "Pause" : "Play"}
                  >
                    {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
                  </Button>
                  <Slider
                    min={0}
                    max={0.999}
                    step={0.001}
                    value={[progress]}
                    onValueChange={([v]) => scrub(v)}
                    aria-label="Scrub the loop"
                    className="flex-1"
                  />
                  <span className="text-muted-foreground w-24 shrink-0 text-right font-mono text-xs tabular-nums">
                    {String(Math.floor(progress * frames) + 1).padStart(2, "0")}/{frames}f
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Button onClick={downloadGif} disabled={!!busy || needsSource} className="font-semibold">
                    <DownloadIcon className="size-4" />
                    {busy === "gif" ? "Encoding…" : "GIF"}
                  </Button>
                  <Button variant="outline" onClick={downloadSprite} disabled={!!busy || needsSource}>
                    <FileImageIcon className="size-4" />
                    {busy === "sprite" ? "Building…" : "Sprite"}
                  </Button>
                  <Button variant="outline" onClick={downloadWebm} disabled={!!busy || needsSource}>
                    <VideoIcon className="size-4" />
                    {busy === "webm" ? "Recording…" : "WebM"}
                  </Button>
                  <Button variant="outline" onClick={downloadFrames} disabled={!!busy || needsSource}>
                    <ImageIcon className="size-4" />
                    {busy === "frames" ? "Zipping…" : "PNGs"}
                  </Button>
                </div>

                <p className="text-muted-foreground text-center text-xs">
                  {cfg.size}×{cfg.size} · {frames} frames · {cfg.fps}fps · {cfg.duration}s loop
                  {cfg.bgType === "transparent" && " · transparent"}
                </p>
              </CardContent>
            </Card>

            {css && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="flex items-center gap-2">
                      <SparklesIcon className="text-primary size-4" /> Pure CSS version
                    </span>
                    <Button type="button" size="sm" variant="outline" onClick={copyCss}>
                      {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted/50 max-h-56 overflow-auto rounded-lg p-3 font-mono text-xs leading-relaxed">
                    {css}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ---- Controls ---- */}
        <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-1">
          {/* Source */}
          <Section icon={TypeIcon} title="What's looping">
            <Segmented
              value={cfg.source}
              onChange={(v) => patch({ source: v as SourceKind })}
              options={[
                { value: "text", label: "Wordmark" },
                { value: "svg", label: "SVG" },
                { value: "image", label: "Image" },
              ]}
            />

            {cfg.source === "text" && (
              <>
                <Field label="Text">
                  <Input
                    value={cfg.text}
                    onChange={(e) => patch({ text: e.target.value })}
                    placeholder="Your wordmark"
                    className="font-medium"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Font">
                    <Select value={cfg.font} onValueChange={(v) => patch({ font: v })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONTS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Weight">
                    <Select value={String(cfg.weight)} onValueChange={(v) => patch({ weight: Number(v) })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[300, 400, 500, 600, 700, 800, 900].map((w) => (
                          <SelectItem key={w} value={String(w)}>
                            {w}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <SliderRow
                  label="Tracking"
                  value={Math.round(cfg.tracking * 100)}
                  unit="%"
                  min={-8}
                  max={40}
                  onChange={(v) => patch({ tracking: v / 100 })}
                />
              </>
            )}

            {cfg.source === "svg" && (
              <FileField
                accept=".svg,image/svg+xml"
                loaded={!!svgMarkup}
                label={svgMarkup ? "Replace SVG" : "Upload an SVG"}
                hint={
                  svgMarkup
                    ? `${buildSvgSubject(svgMarkup)?.parts.length ?? 0} shapes — Draw on and Stagger work with this.`
                    : "Paths, rects, circles and polygons are all read."
                }
                onFiles={loadSvg}
                onClear={svgMarkup ? () => setSvgMarkup(null) : undefined}
              />
            )}

            {cfg.source === "image" && (
              <FileField
                accept="image/*"
                loaded={!!image}
                label={image ? "Replace image" : "Upload a logo"}
                hint="A transparent PNG gives the cleanest result."
                onFiles={loadImage}
                onClear={
                  image
                    ? () => {
                        URL.revokeObjectURL(image.url);
                        setImage(null);
                      }
                    : undefined
                }
              />
            )}
          </Section>

          {/* Motion */}
          <Section icon={Repeat2Icon} title="Motion">
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => {
                const ok = presetAvailable(p, subject);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!ok}
                    onClick={() => patch({ preset: p.id as PresetId })}
                    title={ok ? p.hint : p.needsVector ? "Needs an SVG source" : "Needs more than one letter or shape"}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      cfg.preset === p.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <p className="text-muted-foreground text-xs">
              {presetOk ? preset.hint : "That motion needs a different source — pick another."}
            </p>

            <SliderRow
              label="Intensity"
              value={Math.round(cfg.amount * 100)}
              unit="%"
              min={10}
              max={100}
              onChange={(v) => patch({ amount: v / 100 })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Loop length">
                <Select value={String(cfg.duration)} onValueChange={(v) => patch({ duration: Number(v) })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 1.5, 2, 2.5, 3, 4, 6].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}s
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Frame rate">
                <Select value={String(cfg.fps)} onValueChange={(v) => patch({ fps: Number(v) })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FPS_OPTIONS.map((f) => (
                      <SelectItem key={f} value={String(f)}>
                        {f} fps
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {frames > 90 && (
              <p className="text-muted-foreground text-xs">
                {frames} frames makes a large GIF — drop the frame rate or the loop length to slim it down.
              </p>
            )}
          </Section>

          {/* Look */}
          <Section icon={PaletteIcon} title="Look">
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => patch(t.patch)}
                  className="border-border hover:border-primary hover:bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                >
                  <span className="size-4 shrink-0 rounded-full border" style={{ background: t.swatch }} />
                  {t.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Mark" value={cfg.color} onChange={(v) => patch({ color: v })} />
              <ColorField label="Accent" value={cfg.color2} onChange={(v) => patch({ color2: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Gradient mark</Label>
              <Switch checked={cfg.useGradient} onCheckedChange={(v) => patch({ useGradient: v })} />
            </div>

            <Field label="Background">
              <Segmented
                value={cfg.bgType}
                onChange={(v) => patch({ bgType: v as BgType })}
                options={[
                  { value: "gradient", label: "Gradient" },
                  { value: "solid", label: "Solid" },
                  { value: "transparent", label: "None" },
                ]}
              />
            </Field>
            {cfg.bgType === "gradient" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <ColorField label="From" value={cfg.bg1} onChange={(v) => patch({ bg1: v })} />
                  <ColorField label="To" value={cfg.bg2} onChange={(v) => patch({ bg2: v })} />
                </div>
                <SliderRow label="Angle" value={cfg.bgAngle} unit="°" min={0} max={360} onChange={(v) => patch({ bgAngle: v })} />
              </>
            )}
            {cfg.bgType === "solid" && <ColorField label="Colour" value={cfg.bg1} onChange={(v) => patch({ bg1: v })} wide />}

            <div className="grid grid-cols-2 gap-3">
              <SliderRow label="Glow" value={Math.round(cfg.glow * 100)} unit="%" min={0} max={100} onChange={(v) => patch({ glow: v / 100 })} />
              <SliderRow label="Shadow" value={Math.round(cfg.shadow * 100)} unit="%" min={0} max={100} onChange={(v) => patch({ shadow: v / 100 })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SliderRow label="Padding" value={Math.round(cfg.padding * 100)} unit="%" min={2} max={35} onChange={(v) => patch({ padding: v / 100 })} />
              <Field label="Size">
                <Select value={String(cfg.size)} onValueChange={(v) => patch({ size: Number(v) })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}px
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Section>

          <Button
            variant="ghost"
            className="text-muted-foreground w-full"
            onClick={() => {
              if (image) URL.revokeObjectURL(image.url);
              setImage(null);
              setSvgMarkup(null);
              setCfg(DEFAULT_LOOP);
            }}
          >
            <WandSparklesIcon className="size-4" /> Reset
          </Button>
        </div>
      </div>
    </GeneratorLayout>
  );
}

/* -------------------------------- UI helpers ------------------------------ */

function Section({ icon: Icon, title, children }: { icon: typeof TypeIcon; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="text-primary size-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        {hint && <span className="text-muted-foreground text-[11px]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="bg-muted/60 flex gap-1 rounded-lg p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  wide,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  return (
    <div className="space-y-1">
      {label && <Label className="text-[11px]">{label}</Label>}
      <div className={cn("flex items-center gap-1.5", wide && "w-full")}>
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-9 shrink-0 cursor-pointer p-1"
          aria-label={label ?? "Colour"}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 font-mono text-xs" />
      </div>
    </div>
  );
}

function SliderRow({
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

function FileField({
  accept,
  loaded,
  label,
  hint,
  onFiles,
  onClear,
}: {
  accept: string;
  loaded: boolean;
  label: string;
  hint: string;
  onFiles: (files: FileList | null) => void;
  onClear?: () => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => ref.current?.click()}>
          <UploadIcon className="size-4" /> {label}
        </Button>
        {loaded && onClear && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClear} aria-label="Remove">
            <XIcon className="size-4" />
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-[11px]">{hint}</p>
    </div>
  );
}
