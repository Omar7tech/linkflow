"use client";

import * as React from "react";
import {
  ImageUpIcon,
  PlusIcon,
  ShapesIcon,
  Trash2Icon,
  VectorSquareIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import {
  CLIP_FACES,
  CLIP_PRESETS,
  insertPoint,
  toCss,
  toPolygon,
  toSvgPoints,
  toTailwind,
  type ClipPoint,
} from "@/lib/clippath";
import { cn } from "@/lib/utils";

const MIN_POINTS = 3;
const clamp = (n: number) => Math.min(Math.max(n, 0), 100);

export function ClipPathTool() {
  const history = useHistory("clippath");
  const [points, setPoints] = React.useState<ClipPoint[]>(CLIP_PRESETS[5].points);
  const [presetId, setPresetId] = React.useState(CLIP_PRESETS[5].id);
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);
  const [faceId, setFaceId] = React.useState(CLIP_FACES[0].id);
  const [image, setImage] = React.useState<string | null>(null);
  const [showImage, setShowImage] = React.useState(false);

  const face = CLIP_FACES.find((f) => f.id === faceId) ?? CLIP_FACES[0];
  const stageRef = React.useRef<HTMLDivElement>(null);
  const dragIdx = React.useRef<number | null>(null);

  const update = (next: ClipPoint[]) => {
    setPresetId("custom");
    setPoints(next);
  };

  const loadPreset = (id: string) => {
    const preset = CLIP_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setPoints(preset.points);
    setActiveIdx(null);
  };

  const startDrag = (idx: number) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setActiveIdx(idx);
    dragIdx.current = idx;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      if (dragIdx.current !== idx) return;
      const x = clamp(((ev.clientX - rect.left) / rect.width) * 100);
      const y = clamp(((ev.clientY - rect.top) / rect.height) * 100);
      setPresetId("custom");
      setPoints((prev) =>
        prev.map((pt, i) => (i === idx ? { x, y } : pt)),
      );
    };
    const onUp = () => {
      dragIdx.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const addPoint = () => {
    const next = insertPoint(points);
    update(next);
  };

  const removeActive = () => {
    if (activeIdx === null || points.length <= MIN_POINTS) return;
    update(points.filter((_, i) => i !== activeIdx));
    setActiveIdx(null);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImage(ev.target?.result as string);
      setShowImage(true);
    };
    reader.readAsDataURL(file);
  };

  const css = toCss(points);
  const tailwind = toTailwind(points);
  const polygon = toPolygon(points);
  const commit = () => history.add(`Clip · ${points.length} points`, css);

  const exportTabs = [
    { id: "css", name: "CSS", code: css },
    { id: "tailwind", name: "Tailwind", code: tailwind },
  ];

  const faceBg = showImage && image ? `url(${image}) center / cover` : face.background;

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.clippath}
      output={null}
      footer={<HistoryPanel history={history} />}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        {/* The clipped shape owns the wide column. */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="lg:sticky lg:top-20">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <VectorSquareIcon className="text-primary size-4" />
                  Editor
                </CardTitle>
                <CardDescription>
                  Drag the handles to reshape. Click a handle to select, then
                  remove it — or add one on the longest edge.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className="bg-muted/40 relative h-80 w-full touch-none overflow-hidden rounded-xl select-none sm:h-96 lg:h-[34rem]"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, var(--muted) 25%, transparent 25%), linear-gradient(-45deg, var(--muted) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--muted) 75%), linear-gradient(-45deg, transparent 75%, var(--muted) 75%)",
                    backgroundSize: "20px 20px",
                    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                  }}
                >
                  <div ref={stageRef} className="absolute inset-0">
                    {/* The actual clipped face. */}
                    <div
                      className="absolute inset-0"
                      style={{ background: faceBg, clipPath: polygon, WebkitClipPath: polygon }}
                    />

                    {/* Outline + handles overlay. */}
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <polygon
                        points={toSvgPoints(points)}
                        fill="none"
                        stroke="white"
                        strokeWidth={0.4}
                        strokeDasharray="1.5 1"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>

                    {points.map((pt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onPointerDown={startDrag(idx)}
                        className={cn(
                          "absolute size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 bg-white shadow ring-2 transition-transform active:cursor-grabbing active:scale-110",
                          activeIdx === idx
                            ? "border-primary ring-primary/40 scale-110"
                            : "border-slate-900/70 ring-black/20",
                        )}
                        style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                        aria-label={`Point ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={addPoint} className="h-8 text-xs">
                    <PlusIcon className="size-3.5" /> Add point
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={removeActive}
                    disabled={activeIdx === null || points.length <= MIN_POINTS}
                    className="h-8 text-xs"
                  >
                    <Trash2Icon className="size-3.5" /> Remove
                  </Button>

                  <div className="ml-auto flex items-center gap-2">
                    {CLIP_FACES.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setFaceId(f.id);
                          setShowImage(false);
                        }}
                        className={cn(
                          "size-7 overflow-hidden rounded-full border-2 transition-all",
                          faceId === f.id && !showImage
                            ? "border-primary scale-110"
                            : "border-border/40 hover:border-border",
                        )}
                        style={{ background: f.background }}
                        aria-label={`${f.name} fill`}
                        title={f.name}
                      />
                    ))}
                    {image && (
                      <span className="relative inline-flex">
                        <button
                          type="button"
                          onClick={() => setShowImage(true)}
                          className={cn(
                            "size-7 overflow-hidden rounded-full border-2 bg-cover bg-center transition-all",
                            showImage ? "border-primary scale-110" : "border-border/40",
                          )}
                          style={{ backgroundImage: `url(${image})` }}
                          aria-label="Your image"
                          title="Your image"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImage(null);
                            setShowImage(false);
                          }}
                          className="bg-foreground text-background absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full"
                          aria-label="Remove image"
                        >
                          <XIcon className="size-2" />
                        </button>
                      </span>
                    )}
                    <label
                      className="border-border/60 hover:border-border text-muted-foreground flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-dashed"
                      title="Clip your own image"
                    >
                      <ImageUpIcon className="size-3.5" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShapesIcon className="text-primary size-4" />
                Shapes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-4 gap-2">
                {CLIP_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => loadPreset(preset.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors",
                      presetId === preset.id
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-border",
                    )}
                    title={preset.name}
                  >
                    <span
                      className="bg-primary/80 size-7"
                      style={{ clipPath: toPolygon(preset.points) }}
                    />
                    <span className="text-[10px] font-bold tracking-tight">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-3 pt-1">
                <Switch
                  checked={showImage}
                  onCheckedChange={(v) => {
                    if (v && !image) {
                      toast.error("Upload an image first");
                      return;
                    }
                    setShowImage(v);
                  }}
                  aria-label="Clip image"
                  disabled={!image}
                />
                <span className="text-sm">
                  Clip an image
                  <span className="text-muted-foreground block text-xs">
                    Preview the mask on your own image instead of a gradient.
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export</CardTitle>
              <CardDescription>
                A clip-path polygon — works on any element, image or video.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="css" className="w-full">
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
                      <pre className="bg-muted/50 border-border max-h-96 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                        {t.code}
                      </pre>
                      <CopyButton
                        text={t.code}
                        label=""
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1.5 right-1.5"
                        successMessage={`${t.name} copied`}
                        onCopied={commit}
                        aria-label={`Copy ${t.name}`}
                      />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </GeneratorLayout>
  );
}
