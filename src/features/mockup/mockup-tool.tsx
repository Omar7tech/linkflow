"use client";

import * as React from "react";
import {
  DownloadIcon,
  ImageIcon,
  Loader2Icon,
  RotateCcwIcon,
  SmartphoneIcon,
  TabletIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  BACKGROUNDS,
  buildDevice,
  computeFit,
  customBackground,
  FINISHES,
  renderScene,
  type DeviceId,
  type Orientation,
} from "@/lib/mockup3d";
import { cn } from "@/lib/utils";

const DEVICES: { id: DeviceId; label: string; icon: typeof SmartphoneIcon }[] = [
  { id: "iphone", label: "Phone", icon: SmartphoneIcon },
  { id: "ipad", label: "Tablet", icon: TabletIcon },
];

const ANGLES: { label: string; rotX: number; rotY: number }[] = [
  { label: "Front", rotX: 0, rotY: 0 },
  { label: "Hero left", rotX: 8, rotY: -26 },
  { label: "Hero right", rotX: 8, rotY: 26 },
  { label: "Float", rotX: 26, rotY: -14 },
  { label: "Dramatic", rotX: 12, rotY: 48 },
];

const ASPECTS: { id: string; label: string; w: number; h: number }[] = [
  { id: "1:1", label: "1:1", w: 1440, h: 1440 },
  { id: "4:5", label: "4:5", w: 1344, h: 1680 },
  { id: "9:16", label: "9:16", w: 1080, h: 1920 },
  { id: "16:9", label: "16:9", w: 1920, h: 1080 },
];

type Source =
  | { kind: "image"; media: ImageBitmap; url: string; name: string }
  | { kind: "video"; url: string; name: string };

export function MockupTool() {
  const [device, setDevice] = React.useState<DeviceId>("iphone");
  const [orientation, setOrientation] = React.useState<Orientation>("portrait");
  const [finishId, setFinishId] = React.useState("titanium");
  const [bgId, setBgId] = React.useState("emerald");
  const [aspectId, setAspectId] = React.useState("1:1");
  const [rotX, setRotX] = React.useState(8);
  const [rotY, setRotY] = React.useState(-26);
  const [zoom, setZoom] = React.useState(1);
  const [lens, setLens] = React.useState(0.38); // 0 = wide angle, 1 = telephoto
  const [reflection, setReflection] = React.useState(0.45);
  const [glare, setGlare] = React.useState(0.6);
  const [glow, setGlow] = React.useState(0.3);
  const [grain, setGrain] = React.useState(0);
  const [glowRgb, setGlowRgb] = React.useState<[number, number, number]>([16, 185, 129]);
  const [customBg, setCustomBg] = React.useState("#10b981");
  const [spinning, setSpinning] = React.useState(false);
  const [source, setSource] = React.useState<Source | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dragRef = React.useRef<{ x: number; y: number; rotX: number; rotY: number } | null>(null);
  // Coalesce high-frequency pointermove events into one state update per frame.
  const pendingMove = React.useRef<{ x: number; y: number } | null>(null);
  const moveRaf = React.useRef(0);
  // The playing <video> element lives in a ref — it's imperative media, not render state.
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const finish = FINISHES.find((f) => f.id === finishId) ?? FINISHES[0];
  const background = React.useMemo(
    () =>
      bgId === "custom"
        ? customBackground(customBg)
        : (BACKGROUNDS.find((b) => b.id === bgId) ?? BACKGROUNDS[0]),
    [bgId, customBg]
  );
  const aspect = ASPECTS.find((a) => a.id === aspectId) ?? ASPECTS[0];

  // Device textures need canvases — only build in the browser, never during prerender.
  const spec = React.useMemo(
    () => (typeof document === "undefined" ? null : buildDevice(device, orientation, finish)),
    [device, orientation, finish]
  );
  // Camera distance from the lens slider — log scale, ~24mm wide to ~150mm tele.
  const camera = Math.round(320 * Math.pow(6.25, lens));
  const fit = React.useMemo(
    () => (spec ? computeFit(spec.plates, aspect.w, aspect.h, camera) : 1),
    [spec, aspect, camera]
  );

  // Keep the device screen in sync with the uploaded media.
  React.useEffect(() => {
    spec?.updateScreen(source?.kind === "image" ? source.media : videoRef.current);
  }, [spec, source]);

  const sceneOpts = React.useMemo(
    () => ({
      rotX: (rotX * Math.PI) / 180,
      rotY: (rotY * Math.PI) / 180,
      zoom,
      camera,
      reflection,
      glow,
      glowRgb,
      grain,
      floorY: spec?.floorY ?? 0,
      background: background.paint,
    }),
    [rotX, rotY, zoom, camera, reflection, glow, glowRgb, grain, spec, background]
  );

  // Static render on any change; continuous loop while a video is playing.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spec) return;
    canvas.width = aspect.w;
    canvas.height = aspect.h;
    const ctx = canvas.getContext("2d")!;
    spec.setView(sceneOpts.rotX, sceneOpts.rotY, glare);

    if (source?.kind === "video") {
      let raf = 0;
      const loop = () => {
        if (videoRef.current) spec.updateScreen(videoRef.current);
        renderScene(ctx, spec.plates, sceneOpts, fit);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }
    renderScene(ctx, spec.plates, sceneOpts, fit);
  }, [spec, sceneOpts, fit, aspect, source, glare]);

  React.useEffect(() => {
    return () => {
      if (!source) return;
      if (source.kind === "video") {
        videoRef.current?.pause();
        videoRef.current = null;
      }
      URL.revokeObjectURL(source.url);
    };
  }, [source]);

  // Turntable — gentle ping-pong sweep; grabbing the device pauses it.
  const spinDir = React.useRef(1);
  React.useEffect(() => {
    if (!spinning) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!dragRef.current) {
        setRotY((prev) => {
          let next = prev + spinDir.current * 26 * dt;
          if (next > 55) {
            next = 55;
            spinDir.current = -1;
          } else if (next < -55) {
            next = -55;
            spinDir.current = 1;
          }
          return next;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [spinning]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, rotX, rotY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    pendingMove.current = { x: e.clientX, y: e.clientY };
    if (moveRaf.current) return;
    moveRaf.current = requestAnimationFrame(() => {
      moveRaf.current = 0;
      const drag = dragRef.current;
      const p = pendingMove.current;
      if (!drag || !p) return;
      const scale = 0.35;
      setRotY(Math.max(-80, Math.min(80, drag.rotY + (p.x - drag.x) * scale)));
      setRotX(Math.max(-45, Math.min(60, drag.rotX + (p.y - drag.y) * scale)));
    });
  };
  const onPointerUp = () => {
    dragRef.current = null;
    pendingMove.current = null;
  };

  // Average color of the screen content — drives the bloom glow tint.
  const sampleTint = (el: ImageBitmap | HTMLVideoElement) => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(el, 0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    const m = Math.max(d[0], d[1], d[2], 1);
    // Normalize brightness so even dark screenshots produce a vivid glow.
    setGlowRgb([
      Math.round((d[0] * 235) / m),
      Math.round((d[1] * 235) / m),
      Math.round((d[2] * 235) / m),
    ]);
  };

  const loadFile = async (file: File) => {
    try {
      if (file.type.startsWith("video/")) {
        const url = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.src = url;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        await video.play();
        videoRef.current = video;
        sampleTint(video);
        setSource({ kind: "video", url, name: file.name });
      } else {
        const media = await createImageBitmap(file);
        sampleTint(media);
        setSource({
          kind: "image",
          media,
          url: URL.createObjectURL(file),
          name: file.name,
        });
      }
    } catch {
      toast.error("Couldn't load that file — try a PNG, JPG, MP4 or WebM.");
    }
  };

  const downloadPng = () => {
    if (!spec) return;
    const out = document.createElement("canvas");
    out.width = aspect.w * 2;
    out.height = aspect.h * 2;
    const ctx = out.getContext("2d")!;
    renderScene(ctx, spec.plates, sceneOpts, computeFit(spec.plates, out.width, out.height));
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${device}-mockup.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  // Records the canvas — either a playing screen video or the turntable spin.
  const canRecord = source?.kind === "video" || spinning;
  const recordWebm = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !canRecord || recording) return;
    const stream = canvas.captureStream(30);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${device}-mockup.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setRecording(false);
    };
    setRecording(true);
    if (source?.kind === "video" && video) video.currentTime = 0;
    recorder.start();
    const duration =
      source?.kind === "video" && video
        ? Math.min((video.duration || 8) * 1000, 15_000)
        : 9_000; // ~one full turntable sweep
    setTimeout(() => recorder.stop(), duration);
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.mockup}
      wideOutput
      output={
        <Card>
          <CardContent className="space-y-3">
            <div
              className={cn(
                "relative overflow-hidden rounded-xl border transition-colors",
                dragOver ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-border"
              )}
              style={
                bgId === "transparent"
                  ? {
                      backgroundImage:
                        "repeating-conic-gradient(#d4d4d833 0% 25%, transparent 0% 50%)",
                      backgroundSize: "16px 16px",
                    }
                  : undefined
              }
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void loadFile(file);
              }}
            >
              <canvas
                ref={canvasRef}
                className="mx-auto block h-auto max-h-[72vh] w-auto max-w-full cursor-grab touch-none active:cursor-grabbing"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
              {!source && !dragOver && (
                <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                  <span className="rounded-full bg-black/55 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                    Drop a screenshot or video anywhere on the canvas
                  </span>
                </div>
              )}
              {dragOver && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-emerald-500/15">
                  <span className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                    Release to place it on the screen
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground flex-1 text-xs">Drag the device to spin it</p>
              {canRecord && (
                <Button variant="outline" size="sm" onClick={recordWebm} disabled={recording}>
                  {recording ? <Loader2Icon className="animate-spin" /> : <VideoIcon />}
                  {recording ? "Recording…" : "WebM"}
                </Button>
              )}
              <Button size="sm" onClick={downloadPng}>
                <DownloadIcon /> PNG · 2×
              </Button>
            </div>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-5">
            <Tabs value={device} onValueChange={(v) => setDevice(v as DeviceId)}>
              <TabsList className="w-full">
                {DEVICES.map((d) => (
                  <TabsTrigger key={d.id} value={d.id} className="flex-1">
                    <d.icon className="size-4" /> {d.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex items-center justify-between">
              <Label>Orientation</Label>
              <Tabs value={orientation} onValueChange={(v) => setOrientation(v as Orientation)}>
                <TabsList>
                  <TabsTrigger value="portrait">Portrait</TabsTrigger>
                  <TabsTrigger value="landscape">Landscape</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <label
              className={cn(
                "border-border hover:bg-muted/50 cursor-pointer rounded-xl border transition-colors",
                source
                  ? "flex items-center gap-3 p-2.5"
                  : "flex flex-col items-center gap-1.5 border-dashed px-4 py-6 text-center"
              )}
            >
              {source ? (
                <>
                  {source.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={source.url}
                      alt="Uploaded screen content"
                      className="bg-muted size-12 shrink-0 rounded-lg border object-cover"
                    />
                  ) : (
                    <video
                      src={source.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="bg-muted size-12 shrink-0 rounded-lg border object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{source.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {source.kind === "video" ? "Video" : "Image"} · click to replace
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label="Remove screen content"
                    onClick={(e) => {
                      e.preventDefault();
                      setSource(null);
                      setGlowRgb([16, 185, 129]); // back to the placeholder's emerald
                    }}
                  >
                    <XIcon />
                  </Button>
                </>
              ) : (
                <>
                  <ImageIcon className="text-muted-foreground size-5" />
                  <span className="text-sm font-medium">Drop a screenshot or video</span>
                  <span className="text-muted-foreground text-xs">PNG, JPG, MP4 or WebM</span>
                </>
              )}
              <input
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void loadFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Camera angle</Label>
              <div className="flex flex-wrap gap-1.5">
                {ANGLES.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => {
                      setRotX(a.rotX);
                      setRotY(a.rotY);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      rotX === a.rotX && rotY === a.rotY
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {a.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setRotX(8);
                    setRotY(-26);
                    setZoom(1);
                  }}
                  className="border-border text-muted-foreground hover:text-foreground rounded-full border px-2.5 py-1 text-xs transition-colors"
                  aria-label="Reset view"
                >
                  <RotateCcwIcon className="size-3" />
                </button>
              </div>
            </div>

            <SliderRow
              label="Tilt"
              value={rotX}
              min={-45}
              max={60}
              step={1}
              display={`${Math.round(rotX)}°`}
              onChange={setRotX}
            />
            <SliderRow
              label="Turn"
              value={rotY}
              min={-80}
              max={80}
              step={1}
              display={`${Math.round(rotY)}°`}
              onChange={setRotY}
            />
            <SliderRow
              label="Zoom"
              value={zoom}
              min={0.55}
              max={1.6}
              step={0.01}
              display={`${Math.round(zoom * 100)}%`}
              onChange={setZoom}
            />
            <SliderRow
              label="Lens"
              value={lens}
              min={0}
              max={1}
              step={0.01}
              display={`${Math.round(camera / 13.3)}mm`}
              onChange={setLens}
            />
            <SliderRow
              label="Reflection"
              value={reflection}
              min={0}
              max={1}
              step={0.05}
              display={reflection === 0 ? "Off" : `${Math.round(reflection * 100)}%`}
              onChange={setReflection}
            />
            <SliderRow
              label="Screen glare"
              value={glare}
              min={0}
              max={1}
              step={0.05}
              display={glare === 0 ? "Off" : `${Math.round(glare * 100)}%`}
              onChange={setGlare}
            />
            <SliderRow
              label="Screen glow"
              value={glow}
              min={0}
              max={1}
              step={0.05}
              display={glow === 0 ? "Off" : `${Math.round(glow * 100)}%`}
              onChange={setGlow}
            />
            <SliderRow
              label="Grain"
              value={grain}
              min={0}
              max={1}
              step={0.05}
              display={grain === 0 ? "Off" : `${Math.round(grain * 100)}%`}
              onChange={setGrain}
            />

            <div className="flex items-center justify-between">
              <Label htmlFor="turntable">Turntable spin</Label>
              <Switch id="turntable" checked={spinning} onCheckedChange={setSpinning} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Finish</Label>
              <div className="flex flex-wrap gap-2">
                {FINISHES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFinishId(f.id)}
                    title={f.label}
                    className={cn(
                      "size-8 rounded-full border-2 transition-transform hover:scale-110",
                      finishId === f.id ? "border-emerald-500" : "border-border"
                    )}
                    style={{ background: `linear-gradient(135deg, ${f.light}, ${f.dark})` }}
                    aria-label={`${f.label} finish`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Backdrop</Label>
              <div className="grid grid-cols-6 gap-2">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBgId(b.id)}
                    title={b.label}
                    className={cn(
                      "aspect-square rounded-lg border-2 transition-transform hover:scale-105",
                      bgId === b.id ? "border-emerald-500" : "border-border"
                    )}
                    style={{ background: b.css }}
                    aria-label={`${b.label} backdrop`}
                  />
                ))}
                <label
                  title="Custom color"
                  className={cn(
                    "relative aspect-square cursor-pointer rounded-lg border-2 transition-transform hover:scale-105",
                    bgId === "custom" ? "border-emerald-500" : "border-border"
                  )}
                  style={{
                    background:
                      bgId === "custom"
                        ? background.css
                        : "conic-gradient(#f87171,#fbbf24,#34d399,#38bdf8,#a78bfa,#f87171)",
                  }}
                >
                  <input
                    type="color"
                    value={customBg}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    aria-label="Pick a custom backdrop color"
                    onChange={(e) => {
                      setCustomBg(e.target.value);
                      setBgId("custom");
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Canvas</Label>
              <Tabs value={aspectId} onValueChange={setAspectId}>
                <TabsList>
                  {ASPECTS.map((a) => (
                    <TabsTrigger key={a.id} value={a.id}>
                      {a.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">
          {display}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
      />
    </div>
  );
}
