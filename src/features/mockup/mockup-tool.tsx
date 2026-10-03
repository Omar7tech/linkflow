"use client";

import * as React from "react";
import {
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  LaptopIcon,
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
import { DEVICE_MODELS, type DeviceModel } from "@/lib/mockup-models";
import {
  BACKGROUNDS,
  composeScene,
  customBackground,
  duotoneBackground,
  FINISHES,
  type Orientation,
} from "@/lib/mockup3d";
import type { DeviceInfo, GLMockupRenderer, LayoutId, LightingId } from "@/lib/mockup3d-gl";
import { cn } from "@/lib/utils";
import { buildZip, type ZipEntry } from "@/lib/zip";

const KIND_ICON: Record<DeviceModel["kind"], typeof SmartphoneIcon> = {
  phone: SmartphoneIcon,
  tablet: TabletIcon,
  laptop: LaptopIcon,
};

const LAYOUTS: { id: LayoutId; label: string; devices: number }[] = [
  { id: "single", label: "Single", devices: 1 },
  { id: "duo", label: "Duo", devices: 2 },
  { id: "trio", label: "Trio", devices: 3 },
];

const LIGHTINGS: { id: LightingId; label: string }[] = [
  { id: "studio", label: "Studio" },
  { id: "soft", label: "Soft" },
  { id: "dramatic", label: "Drama" },
  { id: "neon", label: "Neon" },
];

const ANGLES: { label: string; rotX: number; rotY: number }[] = [
  { label: "Front", rotX: 0, rotY: 0 },
  { label: "Hero left", rotX: 8, rotY: -26 },
  { label: "Hero right", rotX: 8, rotY: 26 },
  { label: "Float", rotX: 26, rotY: -14 },
  { label: "Dramatic", rotX: 12, rotY: 48 },
  { label: "Flat lay", rotX: 58, rotY: -20 },
  { label: "Back", rotX: 6, rotY: 154 },
];

const ASPECTS: { id: string; label: string; w: number; h: number }[] = [
  { id: "1:1", label: "1:1", w: 1440, h: 1440 },
  { id: "4:5", label: "4:5", w: 1344, h: 1680 },
  { id: "9:16", label: "9:16", w: 1080, h: 1920 },
  { id: "16:9", label: "16:9", w: 1920, h: 1080 },
];

const EXPORT_SCALES = [1, 2, 4] as const;

type Anim = "off" | "orbit" | "float" | "reveal" | "scroll" | "pose";
const ANIMS: { id: Anim; label: string; ms: number }[] = [
  { id: "off", label: "Off", ms: 0 },
  { id: "orbit", label: "Orbit", ms: 9_000 }, // one full turn
  { id: "float", label: "Float", ms: 12_600 }, // one full drift cycle
  { id: "reveal", label: "Reveal", ms: 5_500 },
  { id: "scroll", label: "Scroll", ms: 8_000 },
  { id: "pose", label: "Pose", ms: 6_000 }, // labelled by the model (e.g. "Fold")
];

/** Curated one-click scene looks: camera, light, effects, backdrop and finish together. */
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
    shadow: number;
    glare: number;
    glow: number;
    grain: number;
    bgId: string;
    finishId: string;
    lighting: LightingId;
  };
}[] = [
  {
    id: "hero",
    label: "Emerald Hero",
    css: "linear-gradient(135deg,#022c22,#0f9b74)",
    s: { rotX: 8, rotY: -26, zoom: 1, lens: 0.38, reflection: 0.3, shadow: 0.6, glare: 0.6, glow: 0.3, grain: 0, bgId: "emerald", finishId: "titanium", lighting: "studio" },
  },
  {
    id: "midnight",
    label: "Midnight Drama",
    css: "linear-gradient(135deg,#020617,#334155)",
    s: { rotX: 12, rotY: 48, zoom: 1.05, lens: 0.55, reflection: 0.55, shadow: 0.4, glare: 0.8, glow: 0.45, grain: 0.15, bgId: "midnight", finishId: "black", lighting: "dramatic" },
  },
  {
    id: "studio",
    label: "Clean Studio",
    css: "linear-gradient(135deg,#fafafa,#e8ebee)",
    s: { rotX: 0, rotY: 0, zoom: 0.95, lens: 0.7, reflection: 0, shadow: 0.75, glare: 0.35, glow: 0, grain: 0, bgId: "paper", finishId: "silver", lighting: "soft" },
  },
  {
    id: "neon",
    label: "Neon Night",
    css: "linear-gradient(135deg,#ff2d95,#0b0b0e 45%,#19e3ff)",
    s: { rotX: 10, rotY: -34, zoom: 1, lens: 0.32, reflection: 0.55, shadow: 0.3, glare: 0.9, glow: 0.5, grain: 0.1, bgId: "graphite", finishId: "black", lighting: "neon" },
  },
  {
    id: "clay",
    label: "Soft Clay",
    css: "linear-gradient(135deg,#fdf6ec,#e7c496)",
    s: { rotX: 18, rotY: -22, zoom: 0.98, lens: 0.6, reflection: 0, shadow: 0.85, glare: 0.3, glow: 0, grain: 0, bgId: "sand", finishId: "clay-white", lighting: "soft" },
  },
  {
    id: "aurora",
    label: "Aurora Float",
    css: "linear-gradient(135deg,#042f2e,#a21caf)",
    s: { rotX: 26, rotY: -14, zoom: 0.92, lens: 0.25, reflection: 0.2, shadow: 0.55, glare: 0.55, glow: 0.6, grain: 0.05, bgId: "aurora", finishId: "lavender", lighting: "studio" },
  },
];

const SETTINGS_KEY = "mockup-scene-v3";

type Source = { url: string; name: string; ratio: number } & (
  | { kind: "image"; media: ImageBitmap }
  | { kind: "video"; el: HTMLVideoElement }
);

function releaseSource(s: Source) {
  if (s.kind === "video") s.el.pause();
  URL.revokeObjectURL(s.url);
}

function rewindVideos(list: (Source | null)[]) {
  for (const s of list) if (s?.kind === "video") s.el.currentTime = 0;
}

async function readSource(file: File): Promise<Source> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("video/")) {
      const el = document.createElement("video");
      el.src = url;
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
      await el.play();
      return { kind: "video", el, url, name: file.name, ratio: el.videoHeight / (el.videoWidth || 1) };
    }
    const media = await createImageBitmap(file);
    return { kind: "image", media, url, name: file.name, ratio: media.height / media.width };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

/** Wrap degrees into -180..180 so the device can orbit all the way around. */
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
const easeOut = (p: number) => 1 - Math.pow(1 - p, 4);
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export function MockupTool() {
  const [device, setDevice] = React.useState(DEVICE_MODELS[0].id);
  const [orientation, setOrientation] = React.useState<Orientation>("portrait");
  const [layout, setLayout] = React.useState<LayoutId>("single");
  const [lighting, setLighting] = React.useState<LightingId>("studio");
  const [glReady, setGlReady] = React.useState(false);
  const [glFailed, setGlFailed] = React.useState(false);
  // Measurements of the device whose model is loaded; "failed" if it couldn't be.
  const [modelState, setModelState] = React.useState<{ id: string; info: DeviceInfo | null } | null>(null);
  const [finishId, setFinishId] = React.useState("burgundy");
  const [bgId, setBgId] = React.useState("emerald");
  const [aspectId, setAspectId] = React.useState("1:1");
  const [rotX, setRotX] = React.useState(8);
  const [rotY, setRotY] = React.useState(-26);
  const [zoom, setZoom] = React.useState(1);
  const [lens, setLens] = React.useState(0.38); // 0 = wide angle, 1 = telephoto
  const [reflection, setReflection] = React.useState(0.3);
  const [shadow, setShadow] = React.useState(0.6);
  const [glare, setGlare] = React.useState(0.6);
  const [glow, setGlow] = React.useState(0.3);
  const [grain, setGrain] = React.useState(0);
  const [scroll, setScroll] = React.useState(0);
  const [pose, setPose] = React.useState(0); // 0..1 along the model's pose animation
  const [glowRgb, setGlowRgb] = React.useState<[number, number, number]>([16, 185, 129]);
  // Two colors lifted from the screen content — powers the "Match" backdrop.
  const [match, setMatch] = React.useState<[string, string] | null>(null);
  const [customBg, setCustomBg] = React.useState("#10b981");
  const [anim, setAnim] = React.useState<Anim>("off");
  // One slot per device in the layout; empty slots repeat the first screen.
  const [sources, setSources] = React.useState<(Source | null)[]>(() => Array<Source | null>(6).fill(null));
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
  // WebGL engine instance, loaded on demand (three.js stays out of the initial bundle).
  const glRef = React.useRef<GLMockupRenderer | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void import("@/lib/mockup3d-gl").then((m) => {
      if (cancelled) return;
      try {
        glRef.current = new m.GLMockupRenderer();
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

  const model = DEVICE_MODELS.find((d) => d.id === device) ?? DEVICE_MODELS[0];
  // Fetch the device's model; the renderer picks it up once it is measured.
  React.useEffect(() => {
    let cancelled = false;
    void import("@/lib/mockup3d-gl")
      .then((m) => m.loadDeviceModel(model))
      .then((info) => {
        if (!cancelled) setModelState({ id: model.id, info });
      });
    return () => {
      cancelled = true;
    };
  }, [model]);
  const info = modelState?.id === model.id ? modelState.info : null;
  const modelFailed = modelState?.id === model.id && !modelState.info;

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
    if (bgId === "match" && match) return duotoneBackground(match[0], match[1]);
    return bgId === "custom"
      ? customBackground(customBg)
      : (BACKGROUNDS.find((b) => b.id === bgId) ?? BACKGROUNDS[0]);
  }, [bgId, customBg, bgPhoto, bgBlur, bgDim, match]);
  // Release the previous backdrop photo when it's replaced or on unmount.
  React.useEffect(() => {
    if (!bgPhoto) return;
    return () => {
      URL.revokeObjectURL(bgPhoto.url);
      bgPhoto.media.close();
    };
  }, [bgPhoto]);
  const aspect = ASPECTS.find((a) => a.id === aspectId) ?? ASPECTS[0];

  // Average backdrop color — bleeds into the studio so metal reflects its scene.
  const tint = React.useMemo<[number, number, number] | null>(() => {
    if (typeof document === "undefined" || bgId === "transparent") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 8;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    background.paint(g, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += d[i + k];
    return [sum[0] / 64, sum[1] / 64, sum[2] / 64];
  }, [background, bgId]);

  // One slot per screen: device by device, each device's screens in order.
  const deviceCount = LAYOUTS.find((l) => l.id === layout)?.devices ?? 1;
  const screenLabels = info?.screens ?? ["Screen"];
  const slotCount = deviceCount * screenLabels.length;
  const slotLabel = (i: number) =>
    screenLabels.length > 1
      ? `${screenLabels[i % screenLabels.length]}${deviceCount > 1 ? ` ${Math.floor(i / screenLabels.length) + 1}` : ""}`
      : `Screen ${i + 1}`;
  const shown = sources.slice(0, slotCount);
  const hasSource = shown.some(Boolean);
  const hasVideo = shown.some((s) => s?.kind === "video");
  // Content taller than the screen can be scrolled inside it.
  const screenRatio = info ? (orientation === "portrait" ? info.screenRatio : 1 / info.screenRatio) : Infinity;
  const scrollable = shown.some((s) => s && s.ratio > screenRatio * 1.05);
  // Camera distance from the lens slider — log scale, ~24mm wide to ~150mm tele.
  const camera = Math.round(320 * Math.pow(6.25, lens));

  const sceneOpts = React.useMemo(
    () => ({
      rotX: (rotX * Math.PI) / 180,
      rotY: (rotY * Math.PI) / 180,
      zoom,
      camera,
      reflection,
      shadow,
      glow,
      glowRgb,
      grain,
      background: background.paint,
    }),
    [rotX, rotY, zoom, camera, reflection, shadow, glow, glowRgb, grain, background]
  );

  // One render path for preview and every export: draw the current scene
  // into any 2D context at any size.
  const renderTo = React.useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const gl = glReady && info ? glRef.current : null;
      if (!gl) return;
      gl.setSize(w, h);
      if (!gl.prepare({ model, orientation, finish, layout, lighting, tint, pose: model.pose ? pose : 0 })) return;
      gl.setScreens(
        sources.slice(0, slotCount).map((s) => (!s ? null : s.kind === "image" ? s.media : s.el)),
        scroll
      );
      gl.setView(sceneOpts.rotX, sceneOpts.rotY, sceneOpts.camera, sceneOpts.zoom, glare);
      gl.render();
      composeScene(ctx, gl.domElement, sceneOpts, gl.floorScreenY());
    },
    [sceneOpts, sources, slotCount, scroll, glare, glReady, info, model, orientation, finish, layout, lighting, tint, pose]
  );

  // Static render on any change; continuous loop while a video is playing.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !glReady) return;
    canvas.width = aspect.w;
    canvas.height = aspect.h;
    const ctx = canvas.getContext("2d")!;

    if (hasVideo) {
      let raf = 0;
      const loop = () => {
        renderTo(ctx, aspect.w, aspect.h);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }
    renderTo(ctx, aspect.w, aspect.h);
  }, [renderTo, glReady, aspect, hasVideo]);

  // Release whatever media is still loaded when the tool unmounts.
  const sourcesRef = React.useRef(sources);
  React.useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);
  React.useEffect(
    () => () => {
      for (const s of sourcesRef.current) if (s) releaseSource(s);
    },
    []
  );

  // Animation. Each mode moves the camera from where the user left it; the
  // clock lives in a ref so a recording can restart the move from frame one.
  const viewRef = React.useRef({ rotX, rotY, zoom, scroll, pose });
  React.useEffect(() => {
    viewRef.current = { rotX, rotY, zoom, scroll, pose };
  });
  const animClock = React.useRef(0);
  React.useEffect(() => {
    if (anim === "off") return;
    const base = { ...viewRef.current };
    let raf = 0;
    let last = performance.now();
    animClock.current = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // Grabbing the device pauses the move.
      if (!dragRef.current) {
        const t = (animClock.current += dt);
        if (anim === "orbit") {
          setRotY((prev) => wrap(prev + 40 * dt));
        } else if (anim === "float") {
          setRotX(10 + Math.sin(t * 0.8) * 6);
          setRotY(-16 + Math.sin(t * 0.5) * 18);
        } else if (anim === "reveal") {
          // Swing in from behind and settle, hold, then go again.
          const e = easeOut(Math.min(1, (t % 5.5) / 3.4));
          setRotY(wrap(base.rotY - 150 * (1 - e)));
          setRotX(base.rotX + 26 * (1 - e));
          setZoom(base.zoom * (0.6 + 0.4 * e));
        } else if (anim === "scroll") {
          const p = (t % 8) / 8;
          setScroll(easeInOut(p < 0.5 ? p * 2 : 2 - p * 2));
          setRotY(base.rotY + Math.sin(t * 0.55) * 3.5);
        } else {
          // Run the model's pose there and back while the camera drifts around it.
          const p = (t % 6) / 6;
          setPose(easeInOut(p < 0.5 ? p * 2 : 2 - p * 2));
          setRotY(base.rotY + Math.sin((t / 6) * Math.PI * 2) * 22);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (anim === "reveal" || anim === "scroll" || anim === "pose") {
        setRotX(base.rotX);
        setRotY(base.rotY);
        setZoom(base.zoom);
        setScroll(base.scroll);
        setPose(base.pose);
      }
    };
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
      setRotY(wrap(drag.rotY + (p.x - drag.x) * scale));
      setRotX(Math.max(-60, Math.min(80, drag.rotX + (p.y - drag.y) * scale)));
    });
  };
  const onPointerUp = () => {
    dragRef.current = null;
    pendingMove.current = null;
  };

  // Read the screen content's colors: the average drives the bloom tint, and
  // average + most vivid pixel become the "Match" backdrop.
  const samplePalette = (el: ImageBitmap | HTMLVideoElement) => {
    const n = 16;
    const c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(el, 0, 0, n, n);
    const d = g.getImageData(0, 0, n, n).data;
    const avg = [0, 0, 0];
    let vivid = [0, 0, 0];
    let best = -1;
    for (let i = 0; i < d.length; i += 4) {
      const px = [d[i], d[i + 1], d[i + 2]];
      for (let k = 0; k < 3; k++) avg[k] += px[k] / (n * n);
      const hi = Math.max(...px);
      const score = (hi - Math.min(...px)) * (0.4 + (0.6 * hi) / 255);
      if (score > best) {
        best = score;
        vivid = px;
      }
    }
    // Normalize brightness so even dark screenshots produce a vivid glow.
    const m = Math.max(...avg, 1);
    setGlowRgb([
      Math.round((avg[0] * 235) / m),
      Math.round((avg[1] * 235) / m),
      Math.round((avg[2] * 235) / m),
    ]);
    // A colorless screenshot has no vivid pixel — fall back to a lifted average.
    const top = best < 40 ? avg.map((v) => (v * 200) / m) : vivid.map((v) => (v * 230) / Math.max(...vivid, 1));
    setMatch([hex(avg[0], avg[1], avg[2]), hex(top[0], top[1], top[2])]);
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

  // Load files into screens: a given slot, or the first free ones.
  const loadFiles = async (files: File[], at?: number) => {
    if (!files.length) return;
    setMediaLoading(true);
    try {
      const next = [...sources];
      let cursor = at ?? 0;
      for (const file of files.slice(0, slotCount)) {
        const src = await readSource(file);
        let i = at === undefined ? next.findIndex((s, idx) => idx < slotCount && !s) : cursor++;
        if (i < 0 || i >= slotCount) i = 0;
        const old = next[i];
        if (old) releaseSource(old);
        next[i] = src;
        if (i === 0) samplePalette(src.kind === "image" ? src.media : src.el);
      }
      setSources(next);
    } catch {
      toast.error("Couldn't load that file. Try a PNG, JPG, MP4 or WebM.");
    } finally {
      setMediaLoading(false);
    }
  };

  const removeSource = (i: number) => {
    const old = sources[i];
    if (!old) return;
    releaseSource(old);
    setSources(sources.map((s, idx) => (idx === i ? null : s)));
    if (i === 0) {
      setGlowRgb([16, 185, 129]); // back to the placeholder's emerald
      setMatch(null);
      if (bgId === "match") setBgId("emerald");
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
    if (!info || busyPng) return;
    setBusyPng(true);
    try {
      const blob = await renderPngBlob(aspect.w * exportScale, aspect.h * exportScale);
      if (blob) saveBlob(blob, `${device}-mockup-${exportScale}x.png`);
    } finally {
      setBusyPng(false);
    }
  };

  const copyPng = async () => {
    if (!info || busyCopy) return;
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
    if (!info || zipProgress !== null) return;
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
      toast.error("Export failed. Try a smaller size.");
    } finally {
      setZipProgress(null);
    }
  };

  // Records the canvas: a playing screen video, or one full pass of the animation.
  const canRecord = hasVideo || anim !== "off";
  const recordWebm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !canRecord || recording) return;
    const video = shown.find((s) => s?.kind === "video");
    const stream = canvas.captureStream(30);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const duration =
      anim !== "off"
        ? (ANIMS.find((a) => a.id === anim)?.ms ?? 9_000)
        : video?.kind === "video"
          ? Math.min((video.el.duration || 8) * 1000, 15_000)
          : 9_000;
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
    // Start every take from the top: the move and the screen videos.
    animClock.current = 0;
    rewindVideos(shown);
    recorder.start();
    setTimeout(() => recorder.stop(), duration);
  };

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setAnim("off");
    setRotX(p.s.rotX);
    setRotY(p.s.rotY);
    setZoom(p.s.zoom);
    setLens(p.s.lens);
    setReflection(p.s.reflection);
    setShadow(p.s.shadow);
    setGlare(p.s.glare);
    setGlow(p.s.glow);
    setGrain(p.s.grain);
    setBgId(p.s.bgId);
    setFinishId(p.s.finishId);
    setLighting(p.s.lighting);
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
        if (DEVICE_MODELS.some((d) => d.id === s.device)) setDevice(s.device as string);
        if (s.orientation === "portrait" || s.orientation === "landscape")
          setOrientation(s.orientation);
        if (LAYOUTS.some((l) => l.id === s.layout)) setLayout(s.layout as LayoutId);
        if (LIGHTINGS.some((l) => l.id === s.lighting)) setLighting(s.lighting as LightingId);
        if (FINISHES.some((f) => f.id === s.finishId)) setFinishId(s.finishId as string);
        if (s.bgId === "custom" || BACKGROUNDS.some((b) => b.id === s.bgId))
          setBgId(s.bgId as string);
        if (ASPECTS.some((a) => a.id === s.aspectId)) setAspectId(s.aspectId as string);
        if (typeof s.customBg === "string" && /^#[0-9a-f]{6}$/i.test(s.customBg))
          setCustomBg(s.customBg);
        const sliders: [unknown, (v: number) => void, number, number][] = [
          [s.rotX, setRotX, -60, 80],
          [s.rotY, setRotY, -180, 180],
          [s.zoom, setZoom, 0.55, 1.6],
          [s.lens, setLens, 0, 1],
          [s.reflection, setReflection, 0, 1],
          [s.shadow, setShadow, 0, 1],
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
    // Animated frames aren't settings — only save the scene at rest.
    if (!restored.current || anim !== "off") return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify({
            device,
            orientation,
            layout,
            lighting,
            finishId,
            // The photo and the sampled colors aren't persisted.
            bgId: bgId === "photo" || bgId === "match" ? "emerald" : bgId,
            aspectId,
            customBg,
            rotX,
            rotY,
            zoom,
            lens,
            reflection,
            shadow,
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
  }, [anim, device, orientation, layout, lighting, finishId, bgId, aspectId, customBg, rotX, rotY, zoom, lens, reflection, shadow, glare, glow, grain, bgBlur, bgDim, exportScale]);

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
                void loadFiles(Array.from(e.dataTransfer.files ?? []));
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
                    Release to place it on the screen
                  </span>
                </div>
              )}
              {glFailed || modelFailed ? (
                <div className="bg-muted/80 absolute inset-0 flex items-center justify-center p-6 text-center">
                  <p className="text-muted-foreground max-w-xs text-sm">
                    {glFailed
                      ? "This tool needs WebGL, which your browser has turned off or doesn't support."
                      : "The device model couldn't be loaded. Check your connection and reload the page."}
                  </p>
                </div>
              ) : (
                !(glReady && info) && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                    <span className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white">
                      <Loader2Icon className="size-3.5 animate-spin" /> Loading the {model.label} model…
                    </span>
                  </div>
                )
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
                {hasSource
                  ? "Drag to orbit, all the way around to the back"
                  : "Drop a screenshot or video on the canvas, then drag to orbit the device"}
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
                    className="border-border block aspect-4/3 w-full rounded-lg border transition-transform group-hover:scale-[1.04]"
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
            {DEVICE_MODELS.length > 1 && (
              <Tabs
                value={device}
                onValueChange={(id) => {
                  // Each model opens in its own colors, unposed.
                  const next = DEVICE_MODELS.find((d) => d.id === id);
                  if (!next) return;
                  if (anim === "pose") setAnim("off");
                  setDevice(id);
                  setFinishId(next.originalFinish);
                  setPose(0);
                }}
              >
                <TabsList className="w-full">
                  {DEVICE_MODELS.map((d) => {
                    const Icon = KIND_ICON[d.kind];
                    return (
                      <TabsTrigger key={d.id} value={d.id} className="flex-1">
                        <Icon className="size-4" /> {d.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            )}

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
              <Label>Layout</Label>
              <Tabs value={layout} onValueChange={(v) => setLayout(v as LayoutId)}>
                <TabsList>
                  {LAYOUTS.map((l) => (
                    <TabsTrigger key={l.id} value={l.id}>
                      {l.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {model.pose && (
              <SliderRow
                label={model.pose.label}
                value={pose}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round(pose * 100)}%`}
                onChange={setPose}
              />
            )}

            <div className="space-y-2">
              {shown.map((source, i) => (
                <label
                  key={i}
                  className={cn(
                    "border-border hover:bg-muted/50 cursor-pointer rounded-xl border transition-colors",
                    source || slotCount > 1
                      ? "flex items-center gap-3 p-2.5"
                      : "flex flex-col items-center gap-1.5 px-4 py-6 text-center",
                    !source && "border-dashed"
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
                          removeSource(i);
                        }}
                      >
                        <XIcon />
                      </Button>
                    </>
                  ) : slotCount > 1 ? (
                    <>
                      <span className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-lg">
                        <ImageIcon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{slotLabel(i)}</span>
                        <span className="text-muted-foreground block text-xs">
                          {i > 0 && sources[0] ? "Showing the first one · click to add its own" : "Add a screenshot or video"}
                        </span>
                      </span>
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
                      void loadFiles(Array.from(e.target.files ?? []), i);
                      e.target.value = "";
                    }}
                  />
                </label>
              ))}
            </div>

            {scrollable && (
              <SliderRow
                label="Page scroll"
                value={scroll}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round(scroll * 100)}%`}
                onChange={setScroll}
              />
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
              min={-60}
              max={80}
              step={1}
              display={`${Math.round(rotX)}°`}
              onChange={setRotX}
            />
            <SliderRow
              label="Turn"
              value={rotY}
              min={-180}
              max={180}
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

            <div className="space-y-1.5">
              <Label>Animation</Label>
              <Tabs value={anim} onValueChange={(v) => setAnim(v as Anim)}>
                <TabsList className="w-full">
                  {ANIMS.filter((a) => a.id !== "pose" || model.pose).map((a) => (
                    <TabsTrigger
                      key={a.id}
                      value={a.id}
                      className="flex-1"
                      disabled={a.id === "scroll" && !scrollable}
                    >
                      {a.id === "pose" ? model.pose?.label : a.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Lighting</Label>
              <Tabs value={lighting} onValueChange={(v) => setLighting(v as LightingId)}>
                <TabsList className="w-full">
                  {LIGHTINGS.map((l) => (
                    <TabsTrigger key={l.id} value={l.id} className="flex-1">
                      {l.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <SliderRow
              label="Shadow"
              value={shadow}
              min={0}
              max={1}
              step={0.05}
              display={shadow === 0 ? "Off" : `${Math.round(shadow * 100)}%`}
              onChange={setShadow}
            />
            <SliderRow
              label="Floor reflection"
              value={reflection}
              min={0}
              max={1}
              step={0.05}
              display={reflection === 0 ? "Off" : `${Math.round(reflection * 100)}%`}
              onChange={setReflection}
            />
            <SliderRow
              label="Glass reflections"
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
                    style={{
                      background: f.clay ? f.light : `linear-gradient(135deg, ${f.light}, ${f.dark})`,
                    }}
                    aria-label={`${f.label} finish`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Backdrop</Label>
              <div className="grid grid-cols-6 gap-2">
                {match && (
                  <button
                    type="button"
                    onClick={() => setBgId("match")}
                    title="Matched to your screen"
                    className={cn(
                      "relative aspect-square rounded-lg border-2 transition-transform hover:scale-105",
                      bgId === "match" ? "border-emerald-500" : "border-border"
                    )}
                    style={{ background: duotoneBackground(match[0], match[1]).css }}
                    aria-label="Backdrop matched to your screen"
                  >
                    <SparklesIcon className="absolute inset-0 m-auto size-3.5 text-white/90" />
                  </button>
                )}
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
