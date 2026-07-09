"use client";

import * as React from "react";
import {
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  Loader2Icon,
  PackageIcon,
  RotateCcwIcon,
  SmartphoneIcon,
  SparklesIcon,
  TabletIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  BACKGROUNDS,
  buildDevice,
  composeScene,
  computeFit,
  customBackground,
  FINISHES,
  renderScene,
  type DeviceId,
  type Orientation,
} from "@/lib/mockup3d";
import type { GLMockupRenderer } from "@/lib/mockup3d-gl";
import { cn } from "@/lib/utils";
import { buildZip, type ZipEntry } from "@/lib/zip";

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

const EXPORT_SCALES = [1, 2, 4] as const;

/** Curated one-click scene looks: camera, effects, backdrop and finish together. */
const PRESETS: {
  id: string;
  label: string;
  css: string;
  s: {
    rotX: number;
    rotY: number;
    zoom: number;
    lens: number;
    reflection: number;
    glare: number;
    glow: number;
    grain: number;
    bgId: string;
    finishId: string;
  };
}[] = [
  {
    id: "hero",
    label: "Emerald Hero",
    css: "linear-gradient(135deg,#022c22,#0f9b74)",
    s: { rotX: 8, rotY: -26, zoom: 1, lens: 0.38, reflection: 0.45, glare: 0.6, glow: 0.35, grain: 0, bgId: "emerald", finishId: "titanium" },
  },
  {
    id: "midnight",
    label: "Midnight Drama",
    css: "linear-gradient(135deg,#020617,#334155)",
    s: { rotX: 12, rotY: 48, zoom: 1.08, lens: 0.55, reflection: 0.6, glare: 0.75, glow: 0.5, grain: 0.15, bgId: "midnight", finishId: "black" },
  },
  {
    id: "studio",
    label: "Clean Studio",
    css: "linear-gradient(135deg,#fafafa,#e8ebee)",
    s: { rotX: 0, rotY: 0, zoom: 0.95, lens: 0.7, reflection: 0.25, glare: 0.35, glow: 0, grain: 0, bgId: "paper", finishId: "silver" },
  },
  {
    id: "sunset",
    label: "Sunset Pop",
    css: "linear-gradient(135deg,#431407,#fbbf24)",
    s: { rotX: 8, rotY: 26, zoom: 1.05, lens: 0.3, reflection: 0.5, glare: 0.6, glow: 0.45, grain: 0.1, bgId: "sunset", finishId: "orange" },
  },
  {
    id: "aurora",
    label: "Aurora Float",
    css: "linear-gradient(135deg,#042f2e,#a21caf)",
    s: { rotX: 26, rotY: -14, zoom: 0.92, lens: 0.25, reflection: 0.35, glare: 0.55, glow: 0.6, grain: 0.05, bgId: "aurora", finishId: "lavender" },
  },
  {
    id: "editorial",
    label: "Rose Editorial",
    css: "linear-gradient(135deg,#4c0519,#fda4af)",
    s: { rotX: 4, rotY: -38, zoom: 1, lens: 0.5, reflection: 0.3, glare: 0.5, glow: 0.25, grain: 0.2, bgId: "rose", finishId: "gold" },
  },
];

const SETTINGS_KEY = "mockup-scene-v1";

type Source =
  | { kind: "image"; media: ImageBitmap; url: string; name: string }
  | { kind: "video"; url: string; name: string };

export function MockupTool() {
  const [device, setDevice] = React.useState<DeviceId>("iphone");
  const [orientation, setOrientation] = React.useState<Orientation>("portrait");
  const [engine, setEngine] = React.useState<"webgl" | "classic">("webgl");
  const [glReady, setGlReady] = React.useState(false);
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
  const [anim, setAnim] = React.useState<"off" | "spin" | "float">("off");
  const [source, setSource] = React.useState<Source | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [recProgress, setRecProgress] = React.useState(0);
  const [dragOver, setDragOver] = React.useState(false);
  // Loaders — every slow path gets visible progress.
  const [mediaLoading, setMediaLoading] = React.useState(false);
  const [busyPng, setBusyPng] = React.useState(false);
  const [busyCopy, setBusyCopy] = React.useState(false);
  const [zipProgress, setZipProgress] = React.useState<number | null>(null);
  const [exportScale, setExportScale] = React.useState<(typeof EXPORT_SCALES)[number]>(2);
  // Photo backdrop — an uploaded image behind the device, with its own blur/dim.
  const [bgPhoto, setBgPhoto] = React.useState<{ media: ImageBitmap; url: string } | null>(null);
  const [bgBlur, setBgBlur] = React.useState(0.4);
  const [bgDim, setBgDim] = React.useState(0.3);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dragRef = React.useRef<{ x: number; y: number; rotX: number; rotY: number } | null>(null);
  // Coalesce high-frequency pointermove events into one state update per frame.
  const pendingMove = React.useRef<{ x: number; y: number } | null>(null);
  const moveRaf = React.useRef(0);
  // The playing <video> element lives in a ref — it's imperative media, not render state.
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  // WebGL engine instance, loaded on demand (three.js stays out of the initial bundle).
  const glRef = React.useRef<GLMockupRenderer | null>(null);

  React.useEffect(() => {
    if (engine !== "webgl" || glRef.current) return;
    let cancelled = false;
    void import("@/lib/mockup3d-gl").then((m) => {
      if (cancelled) return;
      try {
        glRef.current = new m.GLMockupRenderer();
      } catch {
        // WebGL unavailable — the classic engine keeps rendering.
      }
      setGlReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [engine]);
  React.useEffect(() => () => glRef.current?.dispose(), []);

  const finish = FINISHES.find((f) => f.id === finishId) ?? FINISHES[0];
  const background = React.useMemo(() => {
    if (bgId === "photo" && bgPhoto) {
      const { media } = bgPhoto;
      return {
        id: "photo",
        label: "Photo",
        css: `url(${bgPhoto.url}) center/cover`,
        paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => {
          const blurPx = bgBlur * w * 0.03;
          // Overscan while blurring so the edges never bleed transparent.
          const s = Math.max(w / media.width, h / media.height) * (1 + bgBlur * 0.1);
          const dw = media.width * s;
          const dh = media.height * s;
          ctx.save();
          if (blurPx >= 0.5) ctx.filter = `blur(${blurPx}px)`;
          ctx.drawImage(media, (w - dw) / 2, (h - dh) / 2, dw, dh);
          ctx.restore();
          if (bgDim > 0) {
            ctx.fillStyle = `rgba(2,6,8,${bgDim})`;
            ctx.fillRect(0, 0, w, h);
          }
        },
      };
    }
    return bgId === "custom"
      ? customBackground(customBg)
      : (BACKGROUNDS.find((b) => b.id === bgId) ?? BACKGROUNDS[0]);
  }, [bgId, customBg, bgPhoto, bgBlur, bgDim]);
  // Release the previous backdrop photo when it's replaced or on unmount.
  React.useEffect(() => {
    if (!bgPhoto) return;
    return () => {
      URL.revokeObjectURL(bgPhoto.url);
      bgPhoto.media.close();
    };
  }, [bgPhoto]);
  const aspect = ASPECTS.find((a) => a.id === aspectId) ?? ASPECTS[0];

  // Device textures need canvases — only build in the browser, never during prerender.
  const spec = React.useMemo(
    () => (typeof document === "undefined" ? null : buildDevice(device, orientation, finish)),
    [device, orientation, finish]
  );
  // Camera distance from the lens slider — log scale, ~24mm wide to ~150mm tele.
  const camera = Math.round(320 * Math.pow(6.25, lens));

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

  // One render path for preview and every export: draw the current scene
  // into any 2D context at any size, through whichever engine is active.
  const renderTo = React.useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      if (!spec) return;
      // glReady gates the first GL frame; if the context failed, gl stays null → classic.
      const gl = engine === "webgl" && glReady ? glRef.current : null;
      if (gl) {
        gl.setSize(w, h);
        gl.prepare(device, orientation, finish);
        gl.setScreen(source?.kind === "image" ? source.media : videoRef.current);
        gl.setView(sceneOpts.rotX, sceneOpts.rotY, sceneOpts.camera, sceneOpts.zoom, glare);
        gl.render();
        composeScene(ctx, gl.domElement, sceneOpts, gl.floorScreenY());
      } else {
        spec.setView(sceneOpts.rotX, sceneOpts.rotY, glare);
        if (source?.kind === "video" && videoRef.current) spec.updateScreen(videoRef.current);
        renderScene(ctx, spec.plates, sceneOpts, computeFit(spec.plates, w, h, sceneOpts.camera));
      }
    },
    [spec, sceneOpts, source, glare, engine, glReady, device, orientation, finish]
  );

  // Static render on any change; continuous loop while a video is playing.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spec) return;
    canvas.width = aspect.w;
    canvas.height = aspect.h;
    const ctx = canvas.getContext("2d")!;

    if (source?.kind === "video") {
      let raf = 0;
      const loop = () => {
        renderTo(ctx, aspect.w, aspect.h);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }
    renderTo(ctx, aspect.w, aspect.h);
  }, [renderTo, spec, aspect, source]);

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

  // Animation — turntable ping-pong or a weightless float drift; grabbing
  // the device pauses either one.
  const spinDir = React.useRef(1);
  React.useEffect(() => {
    if (anim === "off") return;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!dragRef.current) {
        if (anim === "spin") {
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
        } else {
          t += dt;
          setRotX(10 + Math.sin(t * 0.8) * 6);
          setRotY(-16 + Math.sin(t * 0.5) * 18);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [anim]);

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

  const loadBgPhoto = async (file: File) => {
    setMediaLoading(true);
    try {
      const media = await createImageBitmap(file);
      setBgPhoto({ media, url: URL.createObjectURL(file) });
      setBgId("photo");
    } catch {
      toast.error("Couldn't load that image for the backdrop.");
    } finally {
      setMediaLoading(false);
    }
  };

  const loadFile = async (file: File) => {
    setMediaLoading(true);
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
    } finally {
      setMediaLoading(false);
    }
  };

  // Render the scene at export size and hand back a PNG blob. Yields a frame
  // first so button spinners actually paint before the heavy work.
  const renderPngBlob = async (w: number, h: number): Promise<Blob | null> => {
    await new Promise((r) => requestAnimationFrame(r));
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    renderTo(out.getContext("2d")!, w, h);
    return new Promise((r) => out.toBlob(r, "image/png"));
  };

  const saveBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = async () => {
    if (!spec || busyPng) return;
    setBusyPng(true);
    try {
      const blob = await renderPngBlob(aspect.w * exportScale, aspect.h * exportScale);
      if (blob) saveBlob(blob, `${device}-mockup-${exportScale}x.png`);
    } finally {
      setBusyPng(false);
    }
  };

  const copyPng = async () => {
    if (!spec || busyCopy) return;
    setBusyCopy(true);
    try {
      const blob = await renderPngBlob(aspect.w * exportScale, aspect.h * exportScale);
      if (!blob) throw new Error("render failed");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Mockup copied to your clipboard.");
    } catch {
      toast.error("Clipboard images aren't available in this browser.");
    } finally {
      setBusyCopy(false);
    }
  };

  // Every aspect ratio at the chosen scale, packed into one ZIP.
  const exportAllSizes = async () => {
    if (!spec || zipProgress !== null) return;
    setZipProgress(0);
    try {
      const entries: ZipEntry[] = [];
      for (let i = 0; i < ASPECTS.length; i++) {
        const a = ASPECTS[i];
        const blob = await renderPngBlob(a.w * exportScale, a.h * exportScale);
        if (!blob) throw new Error("render failed");
        entries.push({
          name: `${device}-mockup-${a.id.replace(":", "x")}-${exportScale}x.png`,
          data: new Uint8Array(await blob.arrayBuffer()),
        });
        setZipProgress((i + 1) / ASPECTS.length);
      }
      saveBlob(buildZip(entries), `${device}-mockups-${exportScale}x.zip`);
    } catch {
      toast.error("Export failed — try a smaller size.");
    } finally {
      setZipProgress(null);
    }
  };

  // Records the canvas — a playing screen video, the turntable, or the float drift.
  const canRecord = source?.kind === "video" || anim !== "off";
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
    const duration =
      source?.kind === "video" && video
        ? Math.min((video.duration || 8) * 1000, 15_000)
        : anim === "float"
          ? 12_600 // one full float cycle
          : 9_000; // ~one full turntable sweep
    const started = performance.now();
    const ticker = setInterval(
      () => setRecProgress(Math.min(1, (performance.now() - started) / duration)),
      200
    );
    recorder.onstop = () => {
      clearInterval(ticker);
      saveBlob(new Blob(chunks, { type: "video/webm" }), `${device}-mockup.webm`);
      setRecording(false);
      setRecProgress(0);
    };
    setRecording(true);
    setRecProgress(0);
    if (source?.kind === "video" && video) video.currentTime = 0;
    recorder.start();
    setTimeout(() => recorder.stop(), duration);
  };

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setRotX(p.s.rotX);
    setRotY(p.s.rotY);
    setZoom(p.s.zoom);
    setLens(p.s.lens);
    setReflection(p.s.reflection);
    setGlare(p.s.glare);
    setGlow(p.s.glow);
    setGrain(p.s.grain);
    setBgId(p.s.bgId);
    setFinishId(p.s.finishId);
  };

  // Remember the scene setup between visits (uploaded media isn't persisted).
  // Restoring in an effect (not in initializers) keeps server and first client
  // render identical, so hydration never mismatches.
  /* eslint-disable react-hooks/set-state-in-effect */
  const restored = React.useRef(false);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>;
        if (s.device === "iphone" || s.device === "ipad") setDevice(s.device);
        if (s.orientation === "portrait" || s.orientation === "landscape")
          setOrientation(s.orientation);
        if (s.engine === "webgl" || s.engine === "classic") setEngine(s.engine);
        if (FINISHES.some((f) => f.id === s.finishId)) setFinishId(s.finishId as string);
        if (s.bgId === "custom" || BACKGROUNDS.some((b) => b.id === s.bgId))
          setBgId(s.bgId as string);
        if (ASPECTS.some((a) => a.id === s.aspectId)) setAspectId(s.aspectId as string);
        if (typeof s.customBg === "string" && /^#[0-9a-f]{6}$/i.test(s.customBg))
          setCustomBg(s.customBg);
        const sliders: [unknown, (v: number) => void, number, number][] = [
          [s.rotX, setRotX, -45, 60],
          [s.rotY, setRotY, -80, 80],
          [s.zoom, setZoom, 0.55, 1.6],
          [s.lens, setLens, 0, 1],
          [s.reflection, setReflection, 0, 1],
          [s.glare, setGlare, 0, 1],
          [s.glow, setGlow, 0, 1],
          [s.grain, setGrain, 0, 1],
          [s.bgBlur, setBgBlur, 0, 1],
          [s.bgDim, setBgDim, 0, 0.8],
        ];
        for (const [v, set, min, max] of sliders)
          if (typeof v === "number" && v >= min && v <= max) set(v);
        if (EXPORT_SCALES.includes(s.exportScale as 1)) setExportScale(s.exportScale as 1 | 2 | 4);
      }
    } catch {
      // Corrupt settings — start fresh.
    }
    restored.current = true;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (!restored.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify({
            device,
            orientation,
            engine,
            finishId,
            bgId: bgId === "photo" ? "emerald" : bgId, // the photo itself isn't persisted
            aspectId,
            customBg,
            rotX,
            rotY,
            zoom,
            lens,
            reflection,
            glare,
            glow,
            grain,
            bgBlur,
            bgDim,
            exportScale,
          })
        );
      } catch {
        // Storage full or blocked — persistence is best-effort.
      }
    }, 400);
    return () => clearTimeout(t);
  }, [device, orientation, engine, finishId, bgId, aspectId, customBg, rotX, rotY, zoom, lens, reflection, glare, glow, grain, bgBlur, bgDim, exportScale]);

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
              {engine === "webgl" && !glReady && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                  <span className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white">
                    <Loader2Icon className="size-3.5 animate-spin" /> Preparing the 3D engine…
                  </span>
                </div>
              )}
              {mediaLoading && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white">
                    <Loader2Icon className="size-3.5 animate-spin" /> Loading media…
                  </span>
                </div>
              )}
              {recording && (
                <div className="absolute inset-x-0 top-0 h-1 bg-black/25">
                  <div
                    className="h-full bg-emerald-500 transition-[width] duration-200 ease-linear"
                    style={{ width: `${recProgress * 100}%` }}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-muted-foreground min-w-28 flex-1 text-xs">
                Drag the device to spin it
              </p>
              <Tabs
                value={String(exportScale)}
                onValueChange={(v) => setExportScale(Number(v) as 1 | 2 | 4)}
              >
                <TabsList>
                  {EXPORT_SCALES.map((s) => (
                    <TabsTrigger key={s} value={String(s)}>
                      {s}×
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {canRecord && (
                <Button variant="outline" size="sm" onClick={recordWebm} disabled={recording}>
                  {recording ? <Loader2Icon className="animate-spin" /> : <VideoIcon />}
                  {recording ? `${Math.round(recProgress * 100)}%` : "WebM"}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={copyPng} disabled={busyCopy}>
                {busyCopy ? <Loader2Icon className="animate-spin" /> : <CopyIcon />}
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportAllSizes}
                disabled={zipProgress !== null}
                title="Every aspect ratio as one ZIP"
              >
                {zipProgress !== null ? <Loader2Icon className="animate-spin" /> : <PackageIcon />}
                {zipProgress !== null
                  ? `${Math.round(zipProgress * ASPECTS.length)}/${ASPECTS.length}`
                  : "All sizes"}
              </Button>
              <Button size="sm" onClick={downloadPng} disabled={busyPng}>
                {busyPng ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
                PNG
              </Button>
            </div>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-3">
            <Label className="flex items-center gap-1.5">
              <SparklesIcon className="size-3.5 text-emerald-500" /> One-click looks
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="group space-y-1 text-left"
                >
                  <span
                    className="border-border block aspect-[4/3] w-full rounded-lg border transition-transform group-hover:scale-[1.04]"
                    style={{ background: p.css }}
                  />
                  <span className="text-muted-foreground block truncate text-[11px]">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

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

            <div className="flex items-center justify-between">
              <Label>Renderer</Label>
              <Tabs value={engine} onValueChange={(v) => setEngine(v as "webgl" | "classic")}>
                <TabsList>
                  <TabsTrigger value="webgl">Realistic</TabsTrigger>
                  <TabsTrigger value="classic">Classic</TabsTrigger>
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
              <Label>Animation</Label>
              <Tabs value={anim} onValueChange={(v) => setAnim(v as typeof anim)}>
                <TabsList>
                  <TabsTrigger value="off">Off</TabsTrigger>
                  <TabsTrigger value="spin">Spin</TabsTrigger>
                  <TabsTrigger value="float">Float</TabsTrigger>
                </TabsList>
              </Tabs>
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
                <label
                  title="Photo backdrop"
                  className={cn(
                    "bg-muted relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 transition-transform hover:scale-105",
                    bgId === "photo" ? "border-emerald-500" : "border-border"
                  )}
                  style={
                    bgPhoto ? { background: `url(${bgPhoto.url}) center/cover` } : undefined
                  }
                  onClick={(e) => {
                    // A photo is already loaded — first click selects it;
                    // click again to replace it with a new file.
                    if (bgPhoto && bgId !== "photo") {
                      e.preventDefault();
                      setBgId("photo");
                    }
                  }}
                >
                  {!bgPhoto && (
                    <ImageIcon className="text-muted-foreground absolute inset-0 m-auto size-4" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label="Upload a photo backdrop"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void loadBgPhoto(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {bgId === "photo" && bgPhoto && (
                <div className="space-y-4 pt-2">
                  <SliderRow
                    label="Backdrop blur"
                    value={bgBlur}
                    min={0}
                    max={1}
                    step={0.05}
                    display={bgBlur === 0 ? "Off" : `${Math.round(bgBlur * 100)}%`}
                    onChange={setBgBlur}
                  />
                  <SliderRow
                    label="Backdrop dim"
                    value={bgDim}
                    min={0}
                    max={0.8}
                    step={0.05}
                    display={bgDim === 0 ? "Off" : `${Math.round(bgDim * 100)}%`}
                    onChange={setBgDim}
                  />
                </div>
              )}
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
