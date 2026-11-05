"use client";

import * as React from "react";
import {
  CameraIcon,
  CircleIcon,
  DownloadIcon,
  FilmIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  SparklesIcon,
  SquareIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { TOOL_BY_ID } from "@/constants/tools";
import { SOLIDS, WALLPAPERS, wallpaperCss } from "@/lib/screen-studio/backgrounds";
import { buildCameraPath } from "@/lib/screen-studio/camera";
import { GIF_MAX_SECONDS, exportGif, exportVideo, outputSize } from "@/lib/screen-studio/export";
import { autoZooms, filmstrip, loadVideo, seek } from "@/lib/screen-studio/media";
import { pickScreen, speechSupported, startRecording, type Session } from "@/lib/screen-studio/record";
import { drawFrame, layout } from "@/lib/screen-studio/render";
import { DEFAULT_STYLE, uid, type Aspect, type BubbleCorner, type Edit, type FrameStyle, type Style } from "@/lib/screen-studio/types";
import { cn } from "@/lib/utils";
import { Timeline, type Selection } from "./timeline";

/* ------------------------------------------------------------------ bits */

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-muted/60 flex gap-0.5 rounded-lg p-0.5">
      {options.map(([v, l]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs whitespace-nowrap transition-colors",
            value === v ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children, value }: { label: string; children: React.ReactNode; value?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        {value && <span className="text-muted-foreground font-mono">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="py-0">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{title}</p>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("flex items-center justify-between gap-3 text-sm", disabled && "opacity-50")}>
      {label}
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ------------------------------------------------------------------- tool */

const subscribeNever = () => () => {};

type Phase = { kind: "start" } | { kind: "countdown"; n: number } | { kind: "recording" } | { kind: "loading"; label: string; p?: number } | { kind: "edit" };

interface Media {
  screenUrl: string;
  cameraUrl: string | null;
  duration: number;
  width: number;
  height: number;
}

export function ScreenStudioTool() {
  const [phase, setPhase] = React.useState<Phase>({ kind: "start" });
  const [opts, setOpts] = React.useState({ mic: true, camera: false, captions: true });
  const [media, setMedia] = React.useState<Media | null>(null);
  const [edit, setEdit] = React.useState<Edit | null>(null);
  const [thumbs, setThumbs] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<Selection>(null);
  const [playing, setPlaying] = React.useState(false);
  const [short, setShort] = React.useState(1080);
  const [exporting, setExporting] = React.useState<{ kind: "video" | "gif"; p: number } | null>(null);
  const [elapsed, setElapsed] = React.useState(0);

  const session = React.useRef<Session | null>(null);
  const camPreview = React.useRef<HTMLVideoElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const playhead = React.useRef<HTMLDivElement>(null);
  const clock = React.useRef<HTMLSpanElement>(null);
  const video = React.useRef<HTMLVideoElement | null>(null);
  const cam = React.useRef<HTMLVideoElement | null>(null);
  const wallpaper = React.useRef<HTMLImageElement | null>(null);
  const abort = React.useRef<AbortController | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const canSpeak = React.useSyncExternalStore(subscribeNever, speechSupported, () => false);

  const path = React.useMemo(
    () => (edit && media ? buildCameraPath(edit.zooms, media.duration, edit.style.snap) : null),
    [edit, media]
  );
  const setStyle = <K extends keyof Style>(key: K, value: Style[K]) => setEdit((e) => (e ? { ...e, style: { ...e.style, [key]: value } } : e));

  /* --------------------------------------------------------- loading */

  const open = async (screen: Blob, camera: Blob | null, captions: Edit["captions"]) => {
    setPhase({ kind: "loading", label: "Opening recording" });
    try {
      const screenUrl = URL.createObjectURL(screen);
      const cameraUrl = camera ? URL.createObjectURL(camera) : null;
      const v = await loadVideo(screenUrl, false);
      const c = cameraUrl ? await loadVideo(cameraUrl) : null;
      video.current = v;
      cam.current = c;
      const m = { screenUrl, cameraUrl, duration: v.duration, width: v.videoWidth, height: v.videoHeight };
      setPhase({ kind: "loading", label: "Finding the action", p: 0 });
      const zooms = await autoZooms(screenUrl, m.width / m.height, (p) => setPhase({ kind: "loading", label: "Finding the action", p }));
      setThumbs(await filmstrip(screenUrl, 14));
      setMedia(m);
      setEdit({
        trimStart: 0,
        trimEnd: m.duration,
        zooms,
        captions,
        style: { ...DEFAULT_STYLE, bubble: { ...DEFAULT_STYLE.bubble, show: !!c }, aspect: m.width / m.height < 1 ? "9:16" : "16:9" },
      });
      setSelected(null);
      setPhase({ kind: "edit" });
      if (zooms.length) toast(`${zooms.length} zoom${zooms.length > 1 ? "s" : ""} added where the action is`, { description: "Drag them on the timeline, or click the preview to aim one." });
    } catch {
      toast.error("That video couldn't be opened. Try an MP4 or WebM.");
      setPhase({ kind: "start" });
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) return toast.error("Drop a video file: MP4, WebM or MOV.");
    open(file, null, []);
  };

  /* ------------------------------------------------------- recording */

  const record = async () => {
    let display: MediaStream;
    try {
      display = await pickScreen();
    } catch {
      return; // Picker dismissed.
    }
    for (let n = 3; n > 0; n--) {
      setPhase({ kind: "countdown", n });
      await new Promise((r) => setTimeout(r, 800));
    }
    try {
      const s = await startRecording(display, opts);
      session.current = s;
      setElapsed(0);
      setPhase({ kind: "recording" });
      s.done.then((r) => {
        session.current = null;
        if (r.screen.size < 1000) {
          toast.error("Nothing was recorded.");
          setPhase({ kind: "start" });
          return;
        }
        open(r.screen, r.camera, r.captions);
      });
    } catch {
      display.getTracks().forEach((t) => t.stop());
      toast.error("Recording couldn't start in this browser.");
      setPhase({ kind: "start" });
    }
  };

  React.useEffect(() => {
    if (phase.kind !== "recording") return;
    const s = session.current;
    if (camPreview.current && s?.cameraStream) {
      camPreview.current.srcObject = s.cameraStream;
      camPreview.current.play().catch(() => {});
    }
    const timer = window.setInterval(() => setElapsed((performance.now() - (s?.startedAt ?? performance.now())) / 1000), 250);
    return () => window.clearInterval(timer);
  }, [phase.kind]);

  /* --------------------------------------------------------- preview */

  const size = edit ? outputSize(edit.style.aspect, 720) : { width: 1280, height: 720 };

  const paint = React.useCallback(() => {
    const ctx = canvas.current?.getContext("2d");
    const v = video.current;
    if (!ctx || !v || !edit || !path || !media) return;
    const t = v.currentTime;
    drawFrame(ctx, size.width, size.height, { video: v, cam: cam.current, wallpaper: wallpaper.current }, t, path.at(t), edit.style, edit.captions);
    if (playhead.current) playhead.current.style.left = `${(t / media.duration) * 100}%`;
    if (clock.current) clock.current.textContent = fmt(Math.max(0, t - edit.trimStart));
  }, [edit, path, media, size.width, size.height]);

  // Redraw on any change while paused.
  React.useEffect(() => {
    if (!playing) paint();
  }, [paint, playing]);

  // Playback loop.
  React.useEffect(() => {
    if (!playing || !edit) return;
    const v = video.current!;
    const c = cam.current;
    let raf = 0;
    const tick = () => {
      if (v.currentTime >= edit.trimEnd || v.ended) {
        v.pause();
        c?.pause();
        setPlaying(false);
        return;
      }
      if (c && Math.abs(c.currentTime - v.currentTime) > 0.15 && v.currentTime < c.duration) c.currentTime = v.currentTime;
      paint();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, edit, paint]);

  const toggle = async () => {
    const v = video.current;
    if (!v || !edit) return;
    if (playing) {
      v.pause();
      cam.current?.pause();
      setPlaying(false);
      return;
    }
    if (v.currentTime >= edit.trimEnd - 0.05 || v.currentTime < edit.trimStart) await seek(v, edit.trimStart);
    if (cam.current) cam.current.currentTime = Math.min(v.currentTime, cam.current.duration);
    await Promise.all([v.play(), cam.current?.play()]);
    setPlaying(true);
  };

  const seekTo = React.useCallback(
    async (t: number) => {
      const v = video.current;
      if (!v) return;
      v.currentTime = t;
      if (cam.current) cam.current.currentTime = Math.min(t, cam.current.duration || t);
      if (!playing) {
        await new Promise<void>((r) => v.addEventListener("seeked", () => r(), { once: true }));
        paint();
      }
    },
    [playing, paint]
  );

  // Clicking the preview aims the selected zoom there, or adds one.
  const aim = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!edit || !media || !video.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * size.width;
    const py = ((e.clientY - rect.top) / rect.height) * size.height;
    const L = layout(edit.style, size.width, size.height, media.width, media.height);
    const c = L.content;
    if (px < c.x || px > c.x + c.w || py < c.y || py > c.y + c.h) return;
    const cur = path!.at(video.current.currentTime);
    // Undo the current zoom to find the point in the recording.
    const x = cur.x + ((px - c.x) / c.w - 0.5) / cur.scale;
    const y = cur.y + ((py - c.y) / c.h - 0.5) / cur.scale;
    const t = video.current.currentTime;
    const hit = selected?.kind === "zoom" ? edit.zooms.find((z) => z.id === selected.id) : edit.zooms.find((z) => t >= z.start && t <= z.end);
    if (hit) {
      setEdit({ ...edit, zooms: edit.zooms.map((z) => (z.id === hit.id ? { ...z, x, y, path: undefined, auto: false } : z)) });
      setSelected({ kind: "zoom", id: hit.id });
    } else {
      const z = { id: uid(), start: Math.max(0, t - 0.1), end: Math.min(media.duration, t + 2.8), scale: 1.8, x, y };
      setEdit({ ...edit, zooms: [...edit.zooms, z] });
      setSelected({ kind: "zoom", id: z.id });
    }
  };

  const removeSelected = () => {
    if (!selected || !edit) return;
    setEdit(selected.kind === "zoom" ? { ...edit, zooms: edit.zooms.filter((z) => z.id !== selected.id) } : { ...edit, captions: edit.captions.filter((c) => c.id !== selected.id) });
    setSelected(null);
  };

  // Keyboard: space plays, delete removes the selection.
  React.useEffect(() => {
    if (phase.kind !== "edit") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable=true]")) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const rerunAuto = async () => {
    if (!media || !edit) return;
    setPhase({ kind: "loading", label: "Finding the action", p: 0 });
    const zooms = await autoZooms(media.screenUrl, media.width / media.height, (p) => setPhase({ kind: "loading", label: "Finding the action", p }));
    setEdit({ ...edit, zooms: [...edit.zooms.filter((z) => !z.auto), ...zooms] });
    setPhase({ kind: "edit" });
    toast(zooms.length ? `${zooms.length} auto zooms` : "No clear focus points found", { description: zooms.length ? undefined : "Add zooms by clicking the preview." });
  };

  /* ---------------------------------------------------------- export */

  const runExport = async (kind: "video" | "gif") => {
    if (!edit || !media || !path) return;
    if (playing) await toggle();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setExporting({ kind, p: 0 });
    const job = { screenUrl: media.screenUrl, cameraUrl: media.cameraUrl, wallpaper: wallpaper.current, edit, path, short, signal: ctrl.signal, onProgress: (p: number) => setExporting({ kind, p }) };
    try {
      if (kind === "video") {
        const out = await exportVideo(job);
        download(out.blob, `screen-studio.${out.ext}`);
      } else {
        download(await exportGif(job), "screen-studio.gif");
      }
      toast("Exported");
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error((err as Error).message || "Export failed.");
    } finally {
      setExporting(null);
      abort.current = null;
    }
  };

  const reset = () => {
    video.current?.pause();
    setPlaying(false);
    if (media) {
      URL.revokeObjectURL(media.screenUrl);
      if (media.cameraUrl) URL.revokeObjectURL(media.cameraUrl);
    }
    setMedia(null);
    setEdit(null);
    setThumbs([]);
    setPhase({ kind: "start" });
  };

  /* ------------------------------------------------------------ view */

  const zoom = selected?.kind === "zoom" ? edit?.zooms.find((z) => z.id === selected.id) : undefined;
  const caption = selected?.kind === "caption" ? edit?.captions.find((c) => c.id === selected.id) : undefined;

  if (phase.kind !== "edit" || !edit || !media) {
    return (
      <GeneratorLayout tool={TOOL_BY_ID.screenstudio} output={null}>
        <StartScreen
          phase={phase}
          opts={opts}
          setOpts={setOpts}
          canSpeak={canSpeak}
          elapsed={elapsed}
          camPreview={camPreview}
          onRecord={record}
          onStop={() => session.current?.stop()}
          onPickFile={() => fileInput.current?.click()}
          onDropFile={onFile}
        />
        <input ref={fileInput} type="file" accept="video/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </GeneratorLayout>
    );
  }

  const st = edit.style;
  const length = edit.trimEnd - edit.trimStart;

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.screenstudio}
      wideOutput
      output={
        <div className="space-y-3 lg:sticky lg:top-20">
          <div className="bg-muted/40 relative grid place-items-center overflow-hidden rounded-xl p-3">
            <canvas
              ref={canvas}
              width={size.width}
              height={size.height}
              onClick={aim}
              className="max-h-[62vh] w-auto max-w-full cursor-crosshair rounded-md shadow-sm"
              style={{ aspectRatio: `${size.width} / ${size.height}` }}
            />
          </div>

          <Card className="py-0">
            <CardContent className="space-y-3 p-3">
              <div className="flex items-center gap-2">
                <Button size="icon" className="size-9 rounded-full" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </Button>
                <span className="font-mono text-xs tabular-nums">
                  <span ref={clock}>0:00.0</span>
                  <span className="text-muted-foreground"> / {fmt(length)}</span>
                </span>
                <span className="text-muted-foreground hidden text-xs xl:inline">Click the preview to zoom there · Space to play</span>
                <span className="flex-1" />
                {selected && (
                  <Button size="sm" variant="ghost" className="text-muted-foreground h-8" onClick={removeSelected}>
                    <Trash2Icon /> Delete {selected.kind}
                  </Button>
                )}
              </div>
              <Timeline
                duration={media.duration}
                edit={edit}
                thumbs={thumbs}
                selected={selected}
                onSelect={setSelected}
                onChange={setEdit}
                onSeek={seekTo}
                playheadRef={playhead}
              />
            </CardContent>
          </Card>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Selection inspector. */}
        {zoom && (
          <Panel
            title={zoom.auto ? "Auto zoom" : "Zoom"}
            action={
              <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                <XIcon className="size-4" />
              </button>
            }
          >
            <Row label="Depth" value={`${zoom.scale.toFixed(1)}×`}>
              <Slider min={1.1} max={4} step={0.1} value={[zoom.scale]} onValueChange={([v]) => setEdit({ ...edit, zooms: edit.zooms.map((z) => (z.id === zoom.id ? { ...z, scale: v } : z)) })} />
            </Row>
            <p className="text-muted-foreground text-xs">
              {zoom.path ? "Follows the activity on screen. Click the preview to pin it to one spot instead." : "Click the preview to aim it."}
            </p>
          </Panel>
        )}
        {caption && (
          <Panel
            title="Caption"
            action={
              <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                <XIcon className="size-4" />
              </button>
            }
          >
            <Input value={caption.text} onChange={(e) => setEdit({ ...edit, captions: edit.captions.map((c) => (c.id === caption.id ? { ...c, text: e.target.value } : c)) })} />
          </Panel>
        )}

        <Panel title="Background">
          <div className="grid grid-cols-6 gap-1.5">
            {WALLPAPERS.map((w) => (
              <Swatch key={w.id} label={w.label} active={st.background === w.id} css={wallpaperCss(w.id)} onClick={() => setStyle("background", w.id)} />
            ))}
            <Swatch label="Blur" active={st.background === "blur"} css="linear-gradient(135deg,#71717a,#27272a)" onClick={() => setStyle("background", "blur")}>
              <span className="text-[9px] font-semibold text-white/90">Blur</span>
            </Swatch>
            <label title="Your image" className={cn("grid aspect-square cursor-pointer place-items-center rounded-md border border-dashed transition-colors hover:border-foreground/40", st.background === "image" && "ring-primary ring-2 ring-offset-1 ring-offset-[var(--card)]")}>
              <ImagePlusIcon className="text-muted-foreground size-3.5" />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const img = new Image();
                  img.onload = () => {
                    wallpaper.current = img;
                    setStyle("background", "image");
                  };
                  img.src = URL.createObjectURL(f);
                }}
              />
            </label>
            {SOLIDS.map((c) => (
              <Swatch key={c} label={c} active={st.background === c} css={c} onClick={() => setStyle("background", c)} />
            ))}
          </div>
        </Panel>

        <Panel title="Frame">
          <Segmented label="Frame" value={st.frame} options={[["none", "None"], ["mac", "Window"], ["browser", "Browser"], ["glass", "Glass"]] as readonly (readonly [FrameStyle, string])[]} onChange={(v) => setStyle("frame", v)} />
          {st.frame === "browser" && <Input className="h-8 text-sm" value={st.url} onChange={(e) => setStyle("url", e.target.value)} placeholder="yourapp.com" />}
          <Row label="Padding" value={`${Math.round(st.padding * 100)}%`}>
            <Slider min={0} max={0.2} step={0.005} value={[st.padding]} onValueChange={([v]) => setStyle("padding", v)} />
          </Row>
          <Row label="Corners" value={`${st.radius}px`}>
            <Slider min={0} max={40} step={1} value={[st.radius]} onValueChange={([v]) => setStyle("radius", v)} />
          </Row>
          <Row label="Shadow" value={`${Math.round(st.shadow * 100)}%`}>
            <Slider min={0} max={1} step={0.05} value={[st.shadow]} onValueChange={([v]) => setStyle("shadow", v)} />
          </Row>
          <Row label="Format">
            <Segmented label="Format" value={st.aspect} options={[["16:9", "16:9"], ["4:3", "4:3"], ["1:1", "1:1"], ["4:5", "4:5"], ["9:16", "9:16"]] as readonly (readonly [Aspect, string])[]} onChange={(v) => setStyle("aspect", v)} />
          </Row>
        </Panel>

        <Panel
          title="Zoom"
          action={
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={rerunAuto}>
              <SparklesIcon /> Auto zoom
            </Button>
          }
        >
          <Row label="Motion" value={st.snap < 0.34 ? "Gentle" : st.snap < 0.67 ? "Smooth" : "Snappy"}>
            <Slider min={0} max={1} step={0.05} value={[st.snap]} onValueChange={([v]) => setStyle("snap", v)} />
          </Row>
          <Toggle label="Motion blur" checked={st.motionBlur} onChange={(v) => setStyle("motionBlur", v)} />
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground h-7 w-full text-xs"
            onClick={() => {
              setEdit({ ...edit, zooms: [] });
              setSelected(null);
            }}
            disabled={!edit.zooms.length}
          >
            <RotateCcwIcon /> Clear all zooms
          </Button>
        </Panel>

        <Panel title="Camera">
          <Toggle label="Show camera" checked={st.bubble.show} disabled={!media.cameraUrl} onChange={(v) => setStyle("bubble", { ...st.bubble, show: v })} />
          {!media.cameraUrl ? (
            <p className="text-muted-foreground text-xs">Turn the camera on when recording to add a bubble.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="grid grid-cols-2 gap-1">
                  {(["tl", "tr", "bl", "br"] as BubbleCorner[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Corner ${c}`}
                      onClick={() => setStyle("bubble", { ...st.bubble, corner: c })}
                      className={cn("size-6 rounded border", st.bubble.corner === c ? "border-primary bg-primary/20" : "hover:bg-muted")}
                    />
                  ))}
                </div>
                <div className="flex-1">
                  <Segmented label="Shape" value={st.bubble.shape} options={[["circle", "Circle"], ["rounded", "Rounded"]] as const} onChange={(v) => setStyle("bubble", { ...st.bubble, shape: v })} />
                </div>
              </div>
              <Row label="Size" value={`${Math.round(st.bubble.size * 100)}%`}>
                <Slider min={0.1} max={0.4} step={0.01} value={[st.bubble.size]} onValueChange={([v]) => setStyle("bubble", { ...st.bubble, size: v })} />
              </Row>
            </>
          )}
        </Panel>

        <Panel
          title="Captions"
          action={
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                const t = video.current?.currentTime ?? 0;
                const c = { id: uid(), start: t, end: Math.min(media.duration, t + 2.5), text: "New caption" };
                setEdit({ ...edit, captions: [...edit.captions, c] });
                setSelected({ kind: "caption", id: c.id });
              }}
            >
              <PlusIcon /> Add
            </Button>
          }
        >
          <Toggle label="Show captions" checked={st.captions.show} onChange={(v) => setStyle("captions", { ...st.captions, show: v })} />
          <Row label="Size" value={`${Math.round(st.captions.size * 100)}%`}>
            <Slider min={0.6} max={1.6} step={0.05} value={[st.captions.size]} onValueChange={([v]) => setStyle("captions", { ...st.captions, size: v })} />
          </Row>
          {edit.captions.length === 0 && <p className="text-muted-foreground text-xs">Record with your mic and captions to get them written for you, or add them by hand.</p>}
        </Panel>

        <Panel title="Export">
          <Row label="Quality">
            <Segmented label="Quality" value={short} options={[[720, "720p"], [1080, "1080p"], [1440, "1440p"]] as const} onChange={setShort} />
          </Row>
          {exporting ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <LoaderCircleIcon className="size-3.5 animate-spin" /> {exporting.kind === "video" ? "Rendering video" : "Encoding GIF"}
                </span>
                <span className="font-mono">{Math.round(exporting.p * 100)}%</span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div className="bg-primary h-full transition-[width]" style={{ width: `${exporting.p * 100}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-[11px]">{exporting.kind === "video" ? "Plays through once. Keep this tab open." : "One frame at a time."}</p>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => abort.current?.abort()}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => runExport("video")}>
                <DownloadIcon /> Video
              </Button>
              <Button variant="outline" onClick={() => runExport("gif")}>
                <FilmIcon /> GIF
              </Button>
              {length > GIF_MAX_SECONDS && <p className="text-muted-foreground col-span-2 text-[11px]">GIFs keep the first {GIF_MAX_SECONDS} seconds.</p>}
            </div>
          )}
          <Button variant="ghost" size="sm" className="text-muted-foreground w-full" onClick={reset}>
            <CircleIcon /> New recording
          </Button>
        </Panel>
      </div>
    </GeneratorLayout>
  );
}

function Swatch({ label, css, active, onClick, children }: { label: string; css: string; active: boolean; onClick: () => void; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn("grid aspect-square place-items-center rounded-md border border-black/10 transition-transform hover:scale-105 dark:border-white/10", active && "ring-primary ring-2 ring-offset-1 ring-offset-[var(--card)]")}
      style={{ background: css }}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------- start screen */

function StartScreen({
  phase,
  opts,
  setOpts,
  canSpeak,
  elapsed,
  camPreview,
  onRecord,
  onStop,
  onPickFile,
  onDropFile,
}: {
  phase: Phase;
  opts: { mic: boolean; camera: boolean; captions: boolean };
  setOpts: React.Dispatch<React.SetStateAction<{ mic: boolean; camera: boolean; captions: boolean }>>;
  canSpeak: boolean;
  elapsed: number;
  camPreview: React.RefObject<HTMLVideoElement | null>;
  onRecord: () => void;
  onStop: () => void;
  onPickFile: () => void;
  onDropFile: (f: File | undefined) => void;
}) {
  const [over, setOver] = React.useState(false);

  if (phase.kind === "countdown")
    return (
      <div className="grid h-[52vh] place-items-center rounded-2xl border">
        <span key={phase.n} className="text-primary animate-in zoom-in-50 fade-in font-mono text-8xl font-semibold duration-500">
          {phase.n}
        </span>
      </div>
    );

  if (phase.kind === "recording")
    return (
      <div className="grid h-[52vh] place-items-center rounded-2xl border">
        <div className="flex flex-col items-center gap-6 text-center">
          {opts.camera && <video ref={camPreview} muted playsInline className="size-28 -scale-x-100 rounded-full object-cover shadow-lg ring-2 ring-white/80" />}
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
            </span>
            <span className="font-mono text-3xl tabular-nums">
              {Math.floor(elapsed / 60)}:{Math.floor(elapsed % 60).toString().padStart(2, "0")}
            </span>
          </div>
          <p className="text-muted-foreground max-w-xs text-sm">Recording. Switch to what you want to show, then come back here to stop.</p>
          <Button size="lg" variant="destructive" className="rounded-full px-6" onClick={onStop}>
            <SquareIcon className="fill-current" /> Stop recording
          </Button>
        </div>
      </div>
    );

  if (phase.kind === "loading")
    return (
      <div className="grid h-[52vh] place-items-center rounded-2xl border">
        <div className="w-64 space-y-3 text-center">
          <LoaderCircleIcon className="text-primary mx-auto size-6 animate-spin" />
          <p className="text-sm font-medium">{phase.label}</p>
          {phase.p !== undefined && (
            <div className="bg-muted h-1 overflow-hidden rounded-full">
              <div className="bg-primary h-full transition-[width]" style={{ width: `${phase.p * 100}%` }} />
            </div>
          )}
        </div>
      </div>
    );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDropFile(e.dataTransfer.files[0]);
      }}
      className={cn("grid gap-4 rounded-2xl border p-4 transition-colors sm:p-6 lg:grid-cols-[1.15fr_1fr]", over && "border-primary bg-primary/5")}
    >
      {/* Record. */}
      <div className="bg-muted/40 flex flex-col justify-between gap-8 rounded-xl p-6 sm:p-8">
        <div className="space-y-2">
          <p className="font-heading text-2xl font-semibold tracking-tight">Record your screen</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Pick a tab, window or your whole screen. When you stop, it zooms in where you worked, frames it on a wallpaper and lays out your captions.
          </p>
        </div>
        <div className="space-y-2">
          <OptionRow icon={<MicIcon />} label="Microphone" checked={opts.mic} onChange={(v) => setOpts((o) => ({ ...o, mic: v, captions: v && o.captions }))} />
          <OptionRow icon={<CameraIcon />} label="Camera bubble" checked={opts.camera} onChange={(v) => setOpts((o) => ({ ...o, camera: v }))} />
          <OptionRow
            icon={<SparklesIcon />}
            label="Write captions as I talk"
            note={canSpeak ? undefined : "Needs Chrome or Edge"}
            checked={opts.captions && opts.mic && canSpeak}
            disabled={!opts.mic || !canSpeak}
            onChange={(v) => setOpts((o) => ({ ...o, captions: v }))}
          />
        </div>
        <Button size="lg" className="h-12 rounded-full text-base" onClick={onRecord}>
          <span className="size-2.5 rounded-full bg-red-500 ring-2 ring-white/70" /> Start recording
        </Button>
      </div>

      {/* Or a file. */}
      <button
        type="button"
        onClick={onPickFile}
        className="hover:border-primary/50 hover:bg-primary/[0.03] group flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors"
      >
        <span className="bg-muted grid size-12 place-items-center rounded-full transition-transform group-hover:-translate-y-0.5">
          <UploadIcon className="size-5" />
        </span>
        <span className="text-sm font-medium">Or drop a recording</span>
        <span className="text-muted-foreground text-xs">MP4, WebM or MOV from any recorder</span>
      </button>
    </div>
  );
}

function OptionRow({
  icon,
  label,
  note,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  note?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={cn("bg-background/60 flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm", disabled && "opacity-60")}>
      <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
      <span className="flex-1">
        {label}
        {note && <span className="text-muted-foreground ml-1.5 text-xs">{note}</span>}
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}
