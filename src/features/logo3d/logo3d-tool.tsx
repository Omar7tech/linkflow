"use client";

import * as React from "react";
import {
  CopyIcon,
  DownloadIcon,
  Loader2Icon,
  PackageIcon,
  RotateCcwIcon,
  SparklesIcon,
  UploadIcon,
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
import { BACKGROUNDS, composeScene, customBackground, type SceneOptions } from "@/lib/mockup3d";
import { LOGO_FINISHES, type GLLogoRenderer } from "@/lib/logo3d-gl";
import { cn } from "@/lib/utils";
import { buildZip, type ZipEntry } from "@/lib/zip";

const ANGLES: { label: string; rotX: number; rotY: number }[] = [
  { label: "Front", rotX: 0, rotY: 0 },
  { label: "Hero left", rotX: 10, rotY: -24 },
  { label: "Hero right", rotX: 10, rotY: 24 },
  { label: "Float", rotX: 24, rotY: -14 },
  { label: "Dramatic", rotX: 14, rotY: 44 },
];

const ASPECTS: { id: string; label: string; w: number; h: number }[] = [
  { id: "1:1", label: "1:1", w: 1440, h: 1440 },
  { id: "4:5", label: "4:5", w: 1344, h: 1680 },
  { id: "9:16", label: "9:16", w: 1080, h: 1920 },
  { id: "16:9", label: "16:9", w: 1920, h: 1080 },
];

const EXPORT_SCALES = [1, 2, 4] as const;

/** Starter marks so the studio never opens empty. */
const SAMPLES: { id: string; label: string; svg: string }[] = [
  {
    id: "bolt",
    label: "Bolt",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#10b981" d="M13 2 3 14h7l-1 8 11-13h-7l2-7z"/></svg>`,
  },
  {
    id: "star",
    label: "Star",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#f59e0b" d="M12 2l2.9 6.26 6.6 1.01-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.6-1.01z"/></svg>`,
  },
  {
    id: "badge",
    label: "Badge",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#0ea5e9" fill-rule="evenodd" d="M12 1l9.5 5.5v11L12 23l-9.5-5.5v-11L12 1zm0 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>`,
  },
];

const PRESETS: {
  id: string;
  label: string;
  css: string;
  s: {
    finishId: string;
    bgId: string;
    rotX: number;
    rotY: number;
    zoom: number;
    lens: number;
    reflection: number;
    glow: number;
    grain: number;
  };
}[] = [
  {
    id: "showroom",
    label: "Showroom Chrome",
    css: "linear-gradient(135deg,#f4f4f6,#334155)",
    s: { finishId: "chrome", bgId: "midnight", rotX: 12, rotY: -24, zoom: 1, lens: 0.45, reflection: 0.55, glow: 0.2, grain: 0.1 },
  },
  {
    id: "golden",
    label: "Golden Hour",
    css: "linear-gradient(135deg,#f9d976,#c2410c)",
    s: { finishId: "gold", bgId: "sunset", rotX: 8, rotY: 26, zoom: 1.02, lens: 0.35, reflection: 0.5, glow: 0.4, grain: 0.12 },
  },
  {
    id: "neon",
    label: "Neon Night",
    css: "linear-gradient(135deg,#34d399,#0b0b0e)",
    s: { finishId: "neon", bgId: "graphite", rotX: 10, rotY: -18, zoom: 1, lens: 0.3, reflection: 0.5, glow: 0.85, grain: 0.15 },
  },
  {
    id: "frosted",
    label: "Frosted Glass",
    css: "linear-gradient(135deg,#e0f2fe,#a21caf)",
    s: { finishId: "glass", bgId: "aurora", rotX: 14, rotY: -20, zoom: 0.96, lens: 0.25, reflection: 0.35, glow: 0.45, grain: 0.05 },
  },
  {
    id: "emeraldmark",
    label: "Emerald Mark",
    css: "linear-gradient(135deg,#34d399,#022c22)",
    s: { finishId: "emerald", bgId: "emerald", rotX: 10, rotY: -24, zoom: 1, lens: 0.4, reflection: 0.45, glow: 0.35, grain: 0 },
  },
  {
    id: "gallery",
    label: "Gallery White",
    css: "linear-gradient(135deg,#ffffff,#cfc8d8)",
    s: { finishId: "pearl", bgId: "paper", rotX: 6, rotY: -16, zoom: 0.95, lens: 0.6, reflection: 0.25, glow: 0, grain: 0 },
  },
];

const SETTINGS_KEY = "logo3d-scene-v1";
const MAX_PERSIST_SVG = 150_000;

function hexRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [16, 185, 129];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function Logo3DTool() {
  const [svg, setSvg] = React.useState(SAMPLES[0].svg);
  const [svgName, setSvgName] = React.useState<string | null>(null); // null = sample
  const [finishId, setFinishId] = React.useState("chrome");
  const [edgeFinishId, setEdgeFinishId] = React.useState("match");
  const [tint, setTint] = React.useState("#10b981");
  const [originalColors, setOriginalColors] = React.useState(false);
  // Surface controls — snap to the chosen finish, then stay hand-tweakable.
  const [metalness, setMetalness] = React.useState(LOGO_FINISHES[0].metalness);
  const [roughness, setRoughness] = React.useState(LOGO_FINISHES[0].roughness);
  const [shine, setShine] = React.useState(1.15);
  const [depth, setDepth] = React.useState(0.12);
  const [bevel, setBevel] = React.useState(0.012);
  const [bevelStyle, setBevelStyle] = React.useState<"soft" | "cut">("soft");
  const [bgId, setBgId] = React.useState("midnight");
  const [customBg, setCustomBg] = React.useState("#10b981");
  const [aspectId, setAspectId] = React.useState("1:1");
  const [rotX, setRotX] = React.useState(10);
  const [rotY, setRotY] = React.useState(-24);
  const [zoom, setZoom] = React.useState(1);
  const [lens, setLens] = React.useState(0.45);
  const [reflection, setReflection] = React.useState(0.5);
  const [glow, setGlow] = React.useState(0.3);
  const [grain, setGrain] = React.useState(0.1);
  const [anim, setAnim] = React.useState<"off" | "spin" | "float">("off");
  const [glReady, setGlReady] = React.useState(false);
  const [glFailed, setGlFailed] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [recProgress, setRecProgress] = React.useState(0);
  const [dragOver, setDragOver] = React.useState(false);
  const [busyPng, setBusyPng] = React.useState(false);
  const [busyCopy, setBusyCopy] = React.useState(false);
  const [zipProgress, setZipProgress] = React.useState<number | null>(null);
  const [exportScale, setExportScale] = React.useState<(typeof EXPORT_SCALES)[number]>(2);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dragRef = React.useRef<{ x: number; y: number; rotX: number; rotY: number } | null>(null);
  const pendingMove = React.useRef<{ x: number; y: number } | null>(null);
  const moveRaf = React.useRef(0);
  const glRef = React.useRef<GLLogoRenderer | null>(null);
  // Warn once per SVG that has nothing to extrude, not on every frame.
  const badSvgWarned = React.useRef<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void import("@/lib/logo3d-gl").then((m) => {
      if (cancelled) return;
      try {
        glRef.current = new m.GLLogoRenderer();
      } catch {
        setGlFailed(true);
      }
      setGlReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  React.useEffect(() => () => glRef.current?.dispose(), []);

  const finish = LOGO_FINISHES.find((f) => f.id === finishId) ?? LOGO_FINISHES[0];
  const edgeFinish =
    edgeFinishId === "match"
      ? null
      : (LOGO_FINISHES.find((f) => f.id === edgeFinishId) ?? null);
  const pickFinish = (f: (typeof LOGO_FINISHES)[number]) => {
    setFinishId(f.id);
    setMetalness(f.metalness);
    setRoughness(f.roughness);
    setShine(1.15);
  };
  const background = React.useMemo(
    () =>
      bgId === "custom"
        ? customBackground(customBg)
        : (BACKGROUNDS.find((b) => b.id === bgId) ?? BACKGROUNDS[0]),
    [bgId, customBg]
  );
  const aspect = ASPECTS.find((a) => a.id === aspectId) ?? ASPECTS[0];
  const camera = Math.round(320 * Math.pow(6.25, lens));
  const glowRgb = React.useMemo<[number, number, number]>(
    () => hexRgb(finish.kind === "neon" || finish.kind === "custom" ? tint : finish.color),
    [finish, tint]
  );

  const sceneOpts = React.useMemo<SceneOptions>(
    () => ({
      rotX: (rotX * Math.PI) / 180,
      rotY: (rotY * Math.PI) / 180,
      zoom,
      camera,
      reflection,
      glow,
      glowRgb,
      grain,
      floorY: 0, // unused — the GL engine supplies the floor line directly
      background: background.paint,
    }),
    [rotX, rotY, zoom, camera, reflection, glow, glowRgb, grain, background]
  );

  // One render path for preview and every export.
  const renderTo = React.useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const gl = glRef.current;
      if (!gl) return;
      gl.setSize(w, h);
      const ok = gl.setLogo(svg, {
        depth,
        bevel,
        bevelStyle,
        finish,
        edgeFinish,
        tint,
        originalColors,
        metalness,
        roughness,
        shine,
      });
      if (!ok) {
        if (badSvgWarned.current !== svg) {
          badSvgWarned.current = svg;
          toast.error("That SVG has no filled shapes to extrude — export it with fills, not strokes.");
        }
        return;
      }
      gl.setView(sceneOpts.rotX, sceneOpts.rotY, sceneOpts.camera, sceneOpts.zoom);
      gl.render();
      composeScene(ctx, gl.domElement, sceneOpts, gl.floorScreenY());
    },
    [svg, depth, bevel, bevelStyle, finish, edgeFinish, tint, originalColors, metalness, roughness, shine, sceneOpts]
  );

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !glReady) return;
    canvas.width = aspect.w;
    canvas.height = aspect.h;
    renderTo(canvas.getContext("2d")!, aspect.w, aspect.h);
  }, [renderTo, glReady, aspect]);

  // Animation — turntable ping-pong or a weightless float drift.
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
          setRotX(12 + Math.sin(t * 0.8) * 7);
          setRotY(-14 + Math.sin(t * 0.5) * 20);
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

  const loadSvgFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".svg") && file.type !== "image/svg+xml") {
      toast.error("Drop an SVG file — raster logos can't be extruded.");
      return;
    }
    const text = await file.text();
    if (!text.includes("<svg")) {
      toast.error("That file doesn't look like an SVG.");
      return;
    }
    badSvgWarned.current = null;
    setSvg(text);
    setSvgName(file.name);
  };

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
    if (busyPng || !glReady) return;
    setBusyPng(true);
    try {
      const blob = await renderPngBlob(aspect.w * exportScale, aspect.h * exportScale);
      if (blob) saveBlob(blob, `logo-3d-${exportScale}x.png`);
    } finally {
      setBusyPng(false);
    }
  };

  const copyPng = async () => {
    if (busyCopy || !glReady) return;
    setBusyCopy(true);
    try {
      const blob = await renderPngBlob(aspect.w * exportScale, aspect.h * exportScale);
      if (!blob) throw new Error("render failed");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("3D logo copied to your clipboard.");
    } catch {
      toast.error("Clipboard images aren't available in this browser.");
    } finally {
      setBusyCopy(false);
    }
  };

  const exportAllSizes = async () => {
    if (zipProgress !== null || !glReady) return;
    setZipProgress(0);
    try {
      const entries: ZipEntry[] = [];
      for (let i = 0; i < ASPECTS.length; i++) {
        const a = ASPECTS[i];
        const blob = await renderPngBlob(a.w * exportScale, a.h * exportScale);
        if (!blob) throw new Error("render failed");
        entries.push({
          name: `logo-3d-${a.id.replace(":", "x")}-${exportScale}x.png`,
          data: new Uint8Array(await blob.arrayBuffer()),
        });
        setZipProgress((i + 1) / ASPECTS.length);
      }
      saveBlob(buildZip(entries), `logo-3d-${exportScale}x.zip`);
    } catch {
      toast.error("Export failed — try a smaller size.");
    } finally {
      setZipProgress(null);
    }
  };

  const recordWebm = () => {
    const canvas = canvasRef.current;
    if (!canvas || anim === "off" || recording) return;
    const stream = canvas.captureStream(30);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const duration = anim === "float" ? 12_600 : 9_000;
    const started = performance.now();
    const ticker = setInterval(
      () => setRecProgress(Math.min(1, (performance.now() - started) / duration)),
      200
    );
    recorder.onstop = () => {
      clearInterval(ticker);
      saveBlob(new Blob(chunks, { type: "video/webm" }), "logo-3d.webm");
      setRecording(false);
      setRecProgress(0);
    };
    setRecording(true);
    setRecProgress(0);
    recorder.start();
    setTimeout(() => recorder.stop(), duration);
  };

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    const f = LOGO_FINISHES.find((x) => x.id === p.s.finishId);
    if (f) pickFinish(f);
    setEdgeFinishId("match");
    setBgId(p.s.bgId);
    setRotX(p.s.rotX);
    setRotY(p.s.rotY);
    setZoom(p.s.zoom);
    setLens(p.s.lens);
    setReflection(p.s.reflection);
    setGlow(p.s.glow);
    setGrain(p.s.grain);
  };

  // Remember the scene (and small SVGs) between visits.
  /* eslint-disable react-hooks/set-state-in-effect */
  const restored = React.useRef(false);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>;
        if (typeof s.svg === "string" && s.svg.includes("<svg") && s.svg.length <= MAX_PERSIST_SVG)
          setSvg(s.svg);
        if (typeof s.svgName === "string") setSvgName(s.svgName);
        if (LOGO_FINISHES.some((f) => f.id === s.finishId)) setFinishId(s.finishId as string);
        if (s.edgeFinishId === "match" || LOGO_FINISHES.some((f) => f.id === s.edgeFinishId))
          setEdgeFinishId(s.edgeFinishId as string);
        if (s.bevelStyle === "soft" || s.bevelStyle === "cut") setBevelStyle(s.bevelStyle);
        if (s.bgId === "custom" || BACKGROUNDS.some((b) => b.id === s.bgId))
          setBgId(s.bgId as string);
        if (ASPECTS.some((a) => a.id === s.aspectId)) setAspectId(s.aspectId as string);
        if (typeof s.tint === "string" && /^#[0-9a-f]{6}$/i.test(s.tint)) setTint(s.tint);
        if (typeof s.customBg === "string" && /^#[0-9a-f]{6}$/i.test(s.customBg))
          setCustomBg(s.customBg);
        if (typeof s.originalColors === "boolean") setOriginalColors(s.originalColors);
        const sliders: [unknown, (v: number) => void, number, number][] = [
          [s.depth, setDepth, 0.02, 0.4],
          [s.bevel, setBevel, 0, 0.03],
          [s.metalness, setMetalness, 0, 1],
          [s.roughness, setRoughness, 0.02, 1],
          [s.shine, setShine, 0.2, 2],
          [s.rotX, setRotX, -45, 60],
          [s.rotY, setRotY, -80, 80],
          [s.zoom, setZoom, 0.55, 1.6],
          [s.lens, setLens, 0, 1],
          [s.reflection, setReflection, 0, 1],
          [s.glow, setGlow, 0, 1],
          [s.grain, setGrain, 0, 1],
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
            svg: svg.length <= MAX_PERSIST_SVG ? svg : undefined,
            svgName,
            finishId,
            edgeFinishId,
            bevelStyle,
            metalness,
            roughness,
            shine,
            bgId,
            aspectId,
            tint,
            customBg,
            originalColors,
            depth,
            bevel,
            rotX,
            rotY,
            zoom,
            lens,
            reflection,
            glow,
            grain,
            exportScale,
          })
        );
      } catch {
        // Storage full or blocked — persistence is best-effort.
      }
    }, 400);
    return () => clearTimeout(t);
  }, [svg, svgName, finishId, edgeFinishId, bevelStyle, metalness, roughness, shine, bgId, aspectId, tint, customBg, originalColors, depth, bevel, rotX, rotY, zoom, lens, reflection, glow, grain, exportScale]);

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.logo3d}
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
                if (file) void loadSvgFile(file);
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
              {dragOver && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-emerald-500/15">
                  <span className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                    Release to extrude it
                  </span>
                </div>
              )}
              {!glReady && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                  <span className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white">
                    <Loader2Icon className="size-3.5 animate-spin" /> Preparing the 3D engine…
                  </span>
                </div>
              )}
              {glFailed && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white">
                    3D isn&apos;t available in this browser.
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
                {svgName
                  ? "Drag the logo to spin it"
                  : "Drop your SVG logo on the canvas · drag to spin"}
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
              {anim !== "off" && (
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
            <label className="border-border hover:bg-muted/50 flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors">
              <UploadIcon className="text-muted-foreground size-5" />
              <span className="text-sm font-medium">
                {svgName ?? "Drop your SVG logo here"}
              </span>
              <span className="text-muted-foreground text-xs">
                Filled vector shapes become 3D — strokes are ignored
              </span>
              <input
                type="file"
                accept=".svg,image/svg+xml"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void loadSvgFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Try:</span>
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    badSvgWarned.current = null;
                    setSvg(s.svg);
                    setSvgName(null);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    svg === s.svg
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
              {svgName && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label="Remove uploaded logo"
                  onClick={() => {
                    badSvgWarned.current = null;
                    setSvg(SAMPLES[0].svg);
                    setSvgName(null);
                  }}
                >
                  <XIcon className="size-3.5" />
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="origcolors">Use the SVG&apos;s own colors</Label>
              <Switch id="origcolors" checked={originalColors} onCheckedChange={setOriginalColors} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Material</Label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {LOGO_FINISHES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => pickFinish(f)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
                      finishId === f.id
                        ? "border-emerald-500/70 bg-emerald-500/10"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span
                      className="size-4 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                      style={{ background: f.css }}
                    />
                    <span
                      className={cn(
                        "truncate text-xs",
                        finishId === f.id
                          ? "font-medium text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {(finish.kind === "neon" || finish.kind === "custom") && (
              <div className="flex items-center justify-between">
                <Label htmlFor="tint">{finish.kind === "neon" ? "Neon color" : "Color"}</Label>
                <input
                  id="tint"
                  type="color"
                  value={tint}
                  onChange={(e) => setTint(e.target.value)}
                  className="border-border size-8 cursor-pointer rounded-lg border"
                  aria-label="Material color"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Edge sides</Label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {[
                  { id: "match", label: "Match face", css: "transparent" },
                  ...LOGO_FINISHES.filter((f) => f.id !== "custom"),
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setEdgeFinishId(f.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
                      edgeFinishId === f.id
                        ? "border-emerald-500/70 bg-emerald-500/10"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "size-4 shrink-0 rounded-full",
                        f.id === "match"
                          ? "border-muted-foreground/50 border border-dashed"
                          : "border border-black/10 dark:border-white/10"
                      )}
                      style={f.id === "match" ? undefined : { background: f.css }}
                    />
                    <span
                      className={cn(
                        "truncate text-xs",
                        edgeFinishId === f.id
                          ? "font-medium text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <SliderRow
              label="Metalness"
              value={metalness}
              min={0}
              max={1}
              step={0.05}
              display={`${Math.round(metalness * 100)}%`}
              onChange={setMetalness}
            />
            <SliderRow
              label="Roughness"
              value={roughness}
              min={0.02}
              max={1}
              step={0.02}
              display={`${Math.round(roughness * 100)}%`}
              onChange={setRoughness}
            />
            <SliderRow
              label="Shine"
              value={shine}
              min={0.2}
              max={2}
              step={0.05}
              display={`${Math.round(shine * 100)}%`}
              onChange={setShine}
            />
            <SliderRow
              label="Depth"
              value={depth}
              min={0.02}
              max={0.4}
              step={0.01}
              display={`${Math.round(depth * 100)}%`}
              onChange={setDepth}
            />
            <SliderRow
              label="Bevel"
              value={bevel}
              min={0}
              max={0.03}
              step={0.002}
              display={bevel === 0 ? "Off" : `${Math.round((bevel / 0.03) * 100)}%`}
              onChange={setBevel}
            />
            {bevel > 0 && (
              <div className="flex items-center justify-between">
                <Label>Bevel style</Label>
                <Tabs value={bevelStyle} onValueChange={(v) => setBevelStyle(v as typeof bevelStyle)}>
                  <TabsList>
                    <TabsTrigger value="soft">Soft</TabsTrigger>
                    <TabsTrigger value="cut">Cut</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}
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
                    setRotX(10);
                    setRotY(-24);
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
              label="Glow"
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
