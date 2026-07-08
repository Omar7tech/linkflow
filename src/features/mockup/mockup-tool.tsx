"use client";

import * as React from "react";
import {
  ClipboardCopyIcon,
  DownloadIcon,
  FilmIcon,
  ImageIcon,
  MonitorUpIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SquareIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  CANVAS_PRESETS,
  DEFAULT_MOCKUP,
  GRADIENTS,
  renderMockup,
  type FrameKind,
  type MediaSource,
  type MockupOptions,
} from "@/lib/mockup";
import { cn } from "@/lib/utils";

type Media =
  | { kind: "image"; el: HTMLImageElement; url: string; width: number; height: number; name: string }
  | { kind: "video"; el: HTMLVideoElement; url: string; width: number; height: number; name: string }
  | { kind: "screen"; el: HTMLVideoElement; stream: MediaStream; width: number; height: number; name: string };

const FRAMES: { id: FrameKind; label: string }[] = [
  { id: "none", label: "None" },
  { id: "window", label: "Window" },
  { id: "browser", label: "Browser" },
  { id: "phone", label: "Phone" },
];

const RECORDER_MIMES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function MockupTool() {
  const [opts, setOpts] = React.useState<MockupOptions>({
    ...DEFAULT_MOCKUP,
    width: CANVAS_PRESETS[0].width,
    height: CANVAS_PRESETS[0].height,
  });
  const [media, setMedia] = React.useState<Media | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [recordSeconds, setRecordSeconds] = React.useState(0);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const mediaRef = React.useRef<Media | null>(null);
  mediaRef.current = media;

  const set = <K extends keyof MockupOptions>(key: K, value: MockupOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  const mediaSource: MediaSource | null = media
    ? { source: media.el, width: media.width, height: media.height }
    : null;

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    renderMockup(ctx, opts, mediaRef.current ? { source: mediaRef.current.el, width: mediaRef.current.width, height: mediaRef.current.height } : null);
  }, [opts]);

  // Static redraw whenever options or media change.
  React.useEffect(() => {
    draw();
  }, [draw, media]);

  // Continuous render loop while a video/screen source is live.
  React.useEffect(() => {
    if (!media || media.kind === "image") return;
    let raf = requestAnimationFrame(function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, [media, draw]);

  /* ------------------------------- Sources ------------------------------- */

  const clearMedia = React.useCallback(() => {
    setMedia((current) => {
      if (current) {
        if (current.kind === "screen") current.stream.getTracks().forEach((t) => t.stop());
        if (current.kind === "video") {
          current.el.pause();
          URL.revokeObjectURL(current.url);
        }
        if (current.kind === "image") URL.revokeObjectURL(current.url);
      }
      return null;
    });
  }, []);

  React.useEffect(() => clearMedia, [clearMedia]);

  const loadFile = React.useCallback(
    (file: File) => {
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          clearMedia();
          setMedia({ kind: "image", el: img, url, width: img.naturalWidth, height: img.naturalHeight, name: file.name });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          toast.error("Couldn't read that image");
        };
        img.src = url;
      } else if (file.type.startsWith("video/")) {
        const url = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.onloadedmetadata = () => {
          clearMedia();
          setMedia({ kind: "video", el: video, url, width: video.videoWidth, height: video.videoHeight, name: file.name });
          video.play().catch(() => undefined);
        };
        video.onerror = () => {
          URL.revokeObjectURL(url);
          toast.error("Couldn't read that video");
        };
        video.src = url;
      } else {
        toast.error("Drop an image or a video file");
      }
    },
    [clearMedia]
  );

  const captureScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        clearMedia();
        setMedia({ kind: "screen", el: video, stream, width: video.videoWidth, height: video.videoHeight, name: "Screen capture" });
        video.play().catch(() => undefined);
      };
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        toast.info("Screen sharing ended");
        clearMedia();
      });
    } catch {
      // Permission denied or dismissed — nothing to do.
    }
  };

  // Paste an image/video from the clipboard, anywhere on the page.
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.items ?? [])
        .find((item) => item.type.startsWith("image/") || item.type.startsWith("video/"))
        ?.getAsFile();
      if (file) {
        e.preventDefault();
        loadFile(file);
        toast.success("Pasted from clipboard");
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile]);

  /* ------------------------------- Exports ------------------------------- */

  const exportPng = (multiplier: number) => {
    const off = document.createElement("canvas");
    off.width = opts.width * multiplier;
    off.height = opts.height * multiplier;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    ctx.scale(multiplier, multiplier);
    renderMockup(ctx, opts, mediaSource);
    off.toBlob((blob) => {
      if (!blob) return toast.error("Export failed — try a smaller canvas");
      downloadBlob(blob, `forma-mockup${multiplier > 1 ? `@${multiplier}x` : ""}.png`);
      toast.success(`PNG exported at ${opts.width * multiplier}×${opts.height * multiplier}`);
    }, "image/png");
  };

  const copyPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast.success("Mockup copied as image");
      } catch {
        toast.error("Clipboard blocked image copy — download instead");
      }
    }, "image/png");
  };

  const stopRecording = React.useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    const current = mediaRef.current;
    if (current?.kind === "video") {
      current.el.loop = true;
      current.el.play().catch(() => undefined);
    }
  }, []);

  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas || !media || media.kind === "image") return;
    const stream = canvas.captureStream(30);
    const mime = RECORDER_MIMES.find((m) => MediaRecorder.isTypeSupported(m));
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: mime ?? "video/webm" });
      downloadBlob(blob, "forma-mockup.webm");
      toast.success("WebM video exported");
    };

    if (media.kind === "video") {
      // One clean pass: restart, disable looping and stop when the clip ends.
      media.el.loop = false;
      media.el.currentTime = 0;
      media.el.onended = () => {
        media.el.onended = null;
        stopRecording();
      };
      media.el.play().catch(() => undefined);
    }

    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    setRecordSeconds(0);
  };

  React.useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  /* ------------------------------ Randomizer ----------------------------- */

  const surpriseMe = () => {
    const g = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
    const frame = FRAMES[Math.floor(Math.random() * FRAMES.length)].id;
    setOpts((prev) => ({
      ...prev,
      transparent: false,
      from: g.from,
      to: g.to,
      angle: g.angle,
      frame,
      dark: Math.random() < 0.4,
      tilt: Math.round((Math.random() * 12 - 6) * 10) / 10,
      scale: 62 + Math.round(Math.random() * 24),
      shadow: 40 + Math.round(Math.random() * 45),
    }));
  };

  const presetId = CANVAS_PRESETS.find((p) => p.width === opts.width && p.height === opts.height)?.id ?? "custom";
  const canRecord = media !== null && media.kind !== "image";

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.mockup}
      output={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live preview</CardTitle>
            <CardDescription>
              {opts.width}×{opts.height}
              {media ? ` · ${media.name}` : " · waiting for media"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-border overflow-hidden rounded-lg border"
              style={
                opts.transparent
                  ? {
                      backgroundImage:
                        "repeating-conic-gradient(#e2e8f0 0% 25%, transparent 0% 50%)",
                      backgroundSize: "16px 16px",
                    }
                  : undefined
              }
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) loadFile(file);
              }}
            >
              <canvas
                ref={canvasRef}
                width={opts.width}
                height={opts.height}
                className="block h-auto w-full"
                aria-label="Mockup preview"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => exportPng(1)}>
                <DownloadIcon /> PNG
              </Button>
              <Button type="button" variant="outline" onClick={() => exportPng(2)}>
                @2x
              </Button>
              <Button type="button" variant="outline" onClick={copyPng}>
                <ClipboardCopyIcon /> Copy
              </Button>
              {canRecord &&
                (recording ? (
                  <Button type="button" variant="destructive" onClick={stopRecording}>
                    <SquareIcon /> Stop · {recordSeconds}s
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={startRecording}>
                    <FilmIcon /> Export WebM
                  </Button>
                ))}
            </div>
            {recording && (
              <p className="text-destructive flex items-center gap-1.5 text-xs">
                <span className="bg-destructive size-2 animate-pulse rounded-full" aria-hidden />
                Recording the canvas{media?.kind === "video" ? " — stops when the clip ends" : ""}…
              </p>
            )}
            {canRecord && !recording && (
              <p className="text-muted-foreground text-xs">
                Video exports as WebM without audio, at canvas resolution.
              </p>
            )}

            <Separator />
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Your images, videos and screen captures stay private — they&apos;re never stored anywhere.
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source</CardTitle>
            <CardDescription>Upload, drag onto the preview, paste, or capture your screen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFile(file);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => fileInputRef.current?.click()}>
                <UploadIcon /> Upload image or video
              </Button>
              <Button type="button" variant="outline" onClick={captureScreen}>
                <MonitorUpIcon /> Capture screen
              </Button>
              {media && (
                <Button type="button" variant="ghost" onClick={clearMedia}>
                  <Trash2Icon /> Remove
                </Button>
              )}
            </div>
            {media ? (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                {media.kind === "image" ? (
                  <ImageIcon className="size-3.5" aria-hidden />
                ) : (
                  <FilmIcon className="size-3.5" aria-hidden />
                )}
                {media.name} · {media.width}×{media.height}
                {media.kind !== "image" && " · live"}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Tip: hit <kbd className="bg-muted rounded border px-1 font-mono text-[10px]">Ctrl</kbd>
                +<kbd className="bg-muted rounded border px-1 font-mono text-[10px]">V</kbd> to paste
                a screenshot straight from your clipboard.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="mk-size">Canvas</Label>
                <Select
                  value={presetId}
                  onValueChange={(id) => {
                    const preset = CANVAS_PRESETS.find((p) => p.id === id);
                    if (preset) setOpts((prev) => ({ ...prev, width: preset.width, height: preset.height }));
                  }}
                >
                  <SelectTrigger id="mk-size" className="w-full">
                    <SelectValue placeholder={`Custom · ${opts.width}×${opts.height}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {CANVAS_PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                    {presetId === "custom" && (
                      <SelectItem value="custom" disabled>
                        Custom · {opts.width}×{opts.height}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mk-w">W</Label>
                <Input
                  id="mk-w"
                  type="number"
                  min={320}
                  max={4096}
                  className="w-24"
                  value={opts.width}
                  onChange={(e) => set("width", Math.max(320, Math.min(4096, Number(e.target.value) || 320)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mk-h">H</Label>
                <Input
                  id="mk-h"
                  type="number"
                  min={320}
                  max={4096}
                  className="w-24"
                  value={opts.height}
                  onChange={(e) => set("height", Math.max(320, Math.min(4096, Number(e.target.value) || 320)))}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Frame</Label>
              <div className="flex flex-wrap gap-1.5">
                {FRAMES.map((frame) => (
                  <Badge
                    key={frame.id}
                    asChild
                    variant={opts.frame === frame.id ? "default" : "outline"}
                    className="cursor-pointer"
                  >
                    <button type="button" onClick={() => set("frame", frame.id)}>
                      {frame.label}
                    </button>
                  </Badge>
                ))}
              </div>
              {(opts.frame === "browser" || opts.frame === "window") && (
                <label className="flex items-center gap-2 pt-1 text-sm">
                  <Switch checked={opts.dark} onCheckedChange={(v) => set("dark", v)} aria-label="Dark frame" />
                  Dark chrome
                </label>
              )}
              {opts.frame === "browser" && (
                <Input
                  aria-label="Address bar text"
                  placeholder="yourdomain.com"
                  value={opts.url}
                  onChange={(e) => set("url", e.target.value)}
                />
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Background</Label>
                <label className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Switch
                    checked={opts.transparent}
                    onCheckedChange={(v) => set("transparent", v)}
                    aria-label="Transparent background"
                  />
                  Transparent
                </label>
              </div>
              <div className={cn("flex flex-wrap gap-2", opts.transparent && "pointer-events-none opacity-40")}>
                {GRADIENTS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    title={g.name}
                    aria-label={`${g.name} background`}
                    onClick={() => setOpts((prev) => ({ ...prev, from: g.from, to: g.to, angle: g.angle, transparent: false }))}
                    className={cn(
                      "size-8 rounded-full border-2 transition-transform hover:scale-110",
                      opts.from === g.from && opts.to === g.to ? "border-foreground" : "border-transparent"
                    )}
                    style={{ background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` }}
                  />
                ))}
              </div>
              <div className={cn("flex items-center gap-3 pt-1", opts.transparent && "pointer-events-none opacity-40")}>
                <input
                  type="color"
                  value={opts.from}
                  onChange={(e) => set("from", e.target.value)}
                  aria-label="Gradient start color"
                  className="border-border size-8 cursor-pointer rounded border bg-transparent"
                />
                <input
                  type="color"
                  value={opts.to}
                  onChange={(e) => set("to", e.target.value)}
                  aria-label="Gradient end color"
                  className="border-border size-8 cursor-pointer rounded border bg-transparent"
                />
                <Slider
                  value={[opts.angle]}
                  min={0}
                  max={360}
                  step={5}
                  onValueChange={([v]) => set("angle", v)}
                  aria-label="Gradient angle"
                  className="flex-1"
                />
                <span className="text-muted-foreground w-10 text-right font-mono text-xs tabular-nums">
                  {opts.angle}°
                </span>
              </div>
            </div>

            <Separator />

            <div className="grid gap-5 sm:grid-cols-2">
              {(
                [
                  { key: "scale", label: "Size", min: 40, max: 95, suffix: "%" },
                  { key: "radius", label: "Corners", min: 0, max: 48, suffix: "px" },
                  { key: "tilt", label: "Tilt", min: -15, max: 15, suffix: "°" },
                  { key: "shadow", label: "Shadow", min: 0, max: 100, suffix: "%" },
                ] as const
              ).map((slider) => (
                <div key={slider.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{slider.label}</Label>
                    <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">
                      {opts[slider.key]}
                      {slider.suffix}
                    </span>
                  </div>
                  <Slider
                    value={[opts[slider.key]]}
                    min={slider.min}
                    max={slider.max}
                    step={1}
                    onValueChange={([v]) => set(slider.key, v)}
                    aria-label={slider.label}
                  />
                </div>
              ))}
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="mk-caption">Caption</Label>
                <Input
                  id="mk-caption"
                  placeholder="Introducing the new dashboard ✦"
                  value={opts.caption}
                  onChange={(e) => set("caption", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Position</Label>
                <div className="flex gap-1.5">
                  {(["Top", "Bottom"] as const).map((pos) => (
                    <Badge
                      key={pos}
                      asChild
                      variant={opts.captionTop === (pos === "Top") ? "default" : "outline"}
                      className="cursor-pointer"
                    >
                      <button type="button" onClick={() => set("captionTop", pos === "Top")}>
                        {pos}
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Button type="button" variant="secondary" onClick={surpriseMe}>
              <SparklesIcon /> Surprise me
            </Button>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}
