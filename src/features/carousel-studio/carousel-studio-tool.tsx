"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  LayersIcon,
  PaletteIcon,
  PackageIcon,
  PlusIcon,
  SparklesIcon,
  TypeIcon,
  UploadIcon,
  UserRoundIcon,
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
import { Textarea } from "@/components/ui/textarea";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { buildZip, type ZipEntry } from "@/lib/zip";
import {
  DEFAULT_CAROUSEL,
  FONTS,
  makeSlide,
  renderSlide,
  SIZES,
  SLIDE_TYPES,
  slideFilename,
  sizeOf,
  THEMES,
  type BgType,
  type CarouselConfig,
  type PageIndicator,
  type SizeId,
  type Slide,
  type SlideImage,
  type SlideType,
} from "@/lib/carousel-studio";
import { cn } from "@/lib/utils";

interface LoadedImage extends SlideImage {
  url: string;
}

const PREVIEW_MAX = 560;

function loadFile(file: File): Promise<LoadedImage | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(null);
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => resolve({ el, w: el.naturalWidth, h: el.naturalHeight, url });
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    el.src = url;
  });
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function CarouselStudioTool() {
  const [rawCfg, setCfg] = useLocalStorage<CarouselConfig>("forma:carousel-studio", DEFAULT_CAROUSEL);
  const cfg = React.useMemo(() => ({ ...DEFAULT_CAROUSEL, ...rawCfg }), [rawCfg]);
  const [images, setImages] = React.useState<Record<string, LoadedImage>>({});
  const [current, setCurrent] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const size = sizeOf(cfg);
  const slides = cfg.slides;
  const idx = Math.min(current, Math.max(0, slides.length - 1));
  const slide = slides[idx];
  const cfgKey = JSON.stringify(cfg);

  const preview = React.useMemo(() => {
    const s = Math.min(1, PREVIEW_MAX / Math.max(size.w, size.h));
    return { w: Math.round(size.w * s), h: Math.round(size.h * s) };
  }, [size.w, size.h]);

  // Render the current slide (fonts-aware) whenever anything changes.
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* draw with whatever's ready */
      }
      if (!cancelled && canvasRef.current && slide)
        renderSlide(canvasRef.current, cfg, slide, idx, slides.length, images[slide.id], preview.w, preview.h);
    };
    const t = setTimeout(run, 40);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cfgKey captures cfg
  }, [cfgKey, idx, images, preview.w, preview.h]);

  const patch = (p: Partial<CarouselConfig>) => setCfg((c) => ({ ...c, ...p }));
  const patchSlide = (id: string, p: Partial<Slide>) =>
    setCfg((c) => ({ ...c, slides: c.slides.map((s) => (s.id === id ? { ...s, ...p } : s)) }));

  const addSlide = (type: SlideType) => {
    const s = makeSlide(type);
    setCfg((c) => {
      const next = [...c.slides];
      next.splice(idx + 1, 0, s);
      return { ...c, slides: next };
    });
    setCurrent(idx + 1);
  };

  const duplicateSlide = (id: string) =>
    setCfg((c) => {
      const i = c.slides.findIndex((s) => s.id === id);
      if (i < 0) return c;
      const copy = { ...c.slides[i], id: makeSlide().id, bullets: [...c.slides[i].bullets] };
      setImages((m) => (m[id] ? { ...m, [copy.id]: m[id] } : m));
      const next = [...c.slides];
      next.splice(i + 1, 0, copy);
      return { ...c, slides: next };
    });

  const moveSlide = (id: string, dir: -1 | 1) =>
    setCfg((c) => {
      const i = c.slides.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.slides.length) return c;
      const next = [...c.slides];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...c, slides: next };
    });

  const deleteSlide = (id: string) => {
    setImages((m) => {
      if (m[id]) URL.revokeObjectURL(m[id].url);
      const next = { ...m };
      delete next[id];
      return next;
    });
    setCfg((c) => ({ ...c, slides: c.slides.filter((s) => s.id !== id) }));
    setCurrent((i) => Math.max(0, i - 1));
  };

  const setSlideImage = async (id: string, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const img = await loadFile(file);
    if (!img) return;
    setImages((m) => {
      if (m[id]) URL.revokeObjectURL(m[id].url);
      return { ...m, [id]: img };
    });
  };

  const applyTheme = (p: Partial<CarouselConfig>) => setCfg((c) => ({ ...c, ...p }));

  const renderToBlob = (i: number): Promise<Blob | null> =>
    new Promise((resolve) => {
      const s = cfg.slides[i];
      if (!s) return resolve(null);
      const off = document.createElement("canvas");
      renderSlide(off, cfg, s, i, cfg.slides.length, images[s.id], size.w * cfg.scale, size.h * cfg.scale);
      off.toBlob((b) => resolve(b), "image/png");
    });

  const downloadCurrent = async () => {
    const blob = await renderToBlob(idx);
    if (blob) saveBlob(blob, `${slideFilename(cfg, idx)}.png`);
  };

  const copyCurrent = async () => {
    try {
      const blob = await renderToBlob(idx);
      if (!blob) throw new Error();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Slide copied to clipboard");
    } catch {
      toast.error("Your browser blocked image copy — download instead");
    }
  };

  const downloadAll = async () => {
    if (busy || !slides.length) return;
    setBusy(true);
    try {
      await document.fonts.ready.catch(() => {});
      const entries: ZipEntry[] = [];
      for (let i = 0; i < cfg.slides.length; i++) {
        const blob = await renderToBlob(i);
        if (!blob) continue;
        entries.push({ name: `${slideFilename(cfg, i)}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
      saveBlob(buildZip(entries), `${slideFilename(cfg, 0).replace(/-\d+$/, "")}-carousel.zip`);
      toast.success(`Exported ${entries.length} slides`);
    } catch {
      toast.error("Export failed — try fewer slides.");
    } finally {
      setBusy(false);
    }
  };

  const go = (d: -1 | 1) => setCurrent((i) => Math.min(slides.length - 1, Math.max(0, i + d)));

  return (
    <GeneratorLayout tool={TOOL_BY_ID.carousel} output={null}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ---- Preview + export ---- */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="space-y-3 lg:sticky lg:top-20">
            <Card>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {SIZES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => patch({ aspect: s.id as SizeId })}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                          cfg.aspect === s.id
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:bg-muted/50"
                        )}
                        title={`${s.name} · ${s.w}×${s.h}`}
                      >
                        {s.name} <span className="opacity-60">{s.note}</span>
                      </button>
                    ))}
                  </div>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {slides.length ? `${idx + 1} / ${slides.length}` : "0 slides"}
                  </span>
                </div>

                <div className="bg-muted/40 flex items-center justify-center gap-2 rounded-xl p-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => go(-1)}
                    disabled={idx <= 0}
                    aria-label="Previous slide"
                    className="shrink-0"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </Button>
                  <canvas
                    ref={canvasRef}
                    className="h-auto max-h-[54vh] w-auto max-w-full rounded-lg bg-black shadow-lg"
                    style={{ aspectRatio: `${size.w} / ${size.h}` }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => go(1)}
                    disabled={idx >= slides.length - 1}
                    aria-label="Next slide"
                    className="shrink-0"
                  >
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>

                {/* Slide dots */}
                {slides.length > 1 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {slides.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setCurrent(i)}
                        aria-label={`Slide ${i + 1}`}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          i === idx ? "bg-primary w-6" : "bg-muted-foreground/30 hover:bg-muted-foreground/60 w-1.5"
                        )}
                      />
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={downloadAll} disabled={busy || !slides.length} className="flex-1 font-semibold">
                    <PackageIcon className="size-4" />
                    {busy ? "Exporting…" : "Download all (ZIP)"}
                  </Button>
                  <Button variant="outline" onClick={downloadCurrent} disabled={!slides.length} title="Download this slide">
                    <DownloadIcon className="size-4" />
                  </Button>
                  <Button variant="outline" onClick={copyCurrent} disabled={!slides.length} title="Copy this slide">
                    <CopyIcon className="size-4" />
                  </Button>
                </div>
                <p className="text-muted-foreground text-center text-xs">
                  {size.w}×{size.h} · exporting at {size.w * cfg.scale}×{size.h * cfg.scale} · upload the PNGs as one
                  post.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ---- Controls ---- */}
        <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-1">
          {/* Themes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <WandSparklesIcon className="text-primary size-4" /> Theme
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => applyTheme(t.patch)}
                    className="border-border hover:border-primary hover:bg-muted/50 rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Slides */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <LayersIcon className="text-primary size-4" /> Slides
                </span>
                <AddSlideMenu onAdd={addSlide} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1.5">
                {slides.map((s, i) => (
                  <SlideRow
                    key={s.id}
                    index={i}
                    slide={s}
                    active={i === idx}
                    canUp={i > 0}
                    canDown={i < slides.length - 1}
                    onSelect={() => setCurrent(i)}
                    onUp={() => moveSlide(s.id, -1)}
                    onDown={() => moveSlide(s.id, 1)}
                    onDuplicate={() => duplicateSlide(s.id)}
                    onDelete={() => deleteSlide(s.id)}
                  />
                ))}
                {!slides.length && (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    Add your first slide to begin.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected slide */}
          {slide && (
            <Section icon={TypeIcon} title={`Slide ${idx + 1}`}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Layout">
                  <Select value={slide.type} onValueChange={(v) => patchSlide(slide.id, { type: v as SlideType })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SLIDE_TYPES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Align">
                  <Segmented
                    value={slide.align}
                    onChange={(v) => patchSlide(slide.id, { align: v as Slide["align"] })}
                    options={[
                      { value: "left", label: "Left" },
                      { value: "center", label: "Center" },
                    ]}
                  />
                </Field>
              </div>

              <Field label="Eyebrow" hint="small label above the title">
                <Input value={slide.eyebrow} onChange={(e) => patchSlide(slide.id, { eyebrow: e.target.value })} placeholder="Optional" />
              </Field>

              <Field label={slide.type === "quote" ? "Quote" : "Title"} hint="wrap a phrase in *asterisks* to accent it">
                <Textarea
                  value={slide.title}
                  onChange={(e) => patchSlide(slide.id, { title: e.target.value })}
                  rows={2}
                  className="resize-none font-medium"
                  placeholder="Your headline"
                />
              </Field>

              {slide.type === "bullets" ? (
                <Field label="Bullets" hint="one per line">
                  <Textarea
                    value={slide.bullets.join("\n")}
                    onChange={(e) => patchSlide(slide.id, { bullets: e.target.value.split("\n") })}
                    rows={4}
                    className="resize-none"
                    placeholder={"First point\nSecond point\nThird point"}
                  />
                </Field>
              ) : slide.type === "image" ? (
                <ImageField hasImage={!!images[slide.id]} onFile={(f) => setSlideImage(slide.id, f)} onClear={() => deleteImage(slide.id, setImages)} />
              ) : (
                <Field label={slide.type === "quote" ? "Attribution" : "Body"}>
                  <Textarea
                    value={slide.body}
                    onChange={(e) => patchSlide(slide.id, { body: e.target.value })}
                    rows={2}
                    className="resize-none"
                    placeholder={slide.type === "quote" ? "— Author" : "Supporting sentence."}
                  />
                </Field>
              )}

              {slide.type === "cta" && (
                <Field label="Button label">
                  <Input value={slide.cta} onChange={(e) => patchSlide(slide.id, { cta: e.target.value })} placeholder="Follow" />
                </Field>
              )}
            </Section>
          )}

          {/* Background */}
          <Section icon={ImageIcon} title="Background">
            <Segmented
              value={cfg.bgType}
              onChange={(v) => patch({ bgType: v as BgType })}
              options={[
                { value: "mesh", label: "Mesh" },
                { value: "gradient", label: "Gradient" },
                { value: "solid", label: "Solid" },
              ]}
            />
            {cfg.bgType === "mesh" && (
              <div className="grid grid-cols-4 gap-2">
                <ColorField label="Base" value={cfg.meshBase} onChange={(v) => patch({ meshBase: v })} />
                {cfg.mesh.map((b, i) => (
                  <ColorField
                    key={i}
                    label={`Blob ${i + 1}`}
                    value={b.color}
                    onChange={(v) => patch({ mesh: cfg.mesh.map((mb, j) => (j === i ? { ...mb, color: v } : mb)) })}
                  />
                ))}
              </div>
            )}
            {cfg.bgType === "gradient" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <ColorField label="From" value={cfg.gradFrom} onChange={(v) => patch({ gradFrom: v })} />
                  <ColorField label="To" value={cfg.gradTo} onChange={(v) => patch({ gradTo: v })} />
                </div>
                <SliderRow label="Angle" value={cfg.gradAngle} unit="°" min={0} max={360} onChange={(v) => patch({ gradAngle: v })} />
              </>
            )}
            {cfg.bgType === "solid" && <ColorField label="Color" value={cfg.solid} onChange={(v) => patch({ solid: v })} wide />}
          </Section>

          {/* Type & color */}
          <Section icon={PaletteIcon} title="Type & color">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title font">
                <FontSelect value={cfg.titleFont} onChange={(v) => patch({ titleFont: v })} />
              </Field>
              <Field label="Body font">
                <FontSelect value={cfg.bodyFont} onChange={(v) => patch({ bodyFont: v })} />
              </Field>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <ColorField label="Title" value={cfg.textColor} onChange={(v) => patch({ textColor: v })} />
              <ColorField label="Body" value={cfg.mutedColor} onChange={(v) => patch({ mutedColor: v })} />
              <ColorField label="Accent 1" value={cfg.accentFrom} onChange={(v) => patch({ accentFrom: v })} />
              <ColorField label="Accent 2" value={cfg.accentTo} onChange={(v) => patch({ accentTo: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Gradient accent</Label>
              <Switch checked={cfg.accentGradient} onCheckedChange={(v) => patch({ accentGradient: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SliderRow label="Grain" value={Math.round(cfg.grain * 100)} unit="%" min={0} max={100} onChange={(v) => patch({ grain: v / 100 })} />
              <SliderRow label="Vignette" value={Math.round(cfg.vignette * 100)} unit="%" min={0} max={70} onChange={(v) => patch({ vignette: v / 100 })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Top glow</Label>
              <Switch checked={cfg.topGlow} onCheckedChange={(v) => patch({ topGlow: v })} />
            </div>
          </Section>

          {/* Branding */}
          <Section icon={UserRoundIcon} title="Branding & navigation">
            <div className="flex items-center justify-between">
              <Label>Footer byline</Label>
              <Switch checked={cfg.showFooter} onCheckedChange={(v) => patch({ showFooter: v })} />
            </div>
            {cfg.showFooter && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name">
                  <Input value={cfg.authorName} onChange={(e) => patch({ authorName: e.target.value })} placeholder="Your name" />
                </Field>
                <Field label="Handle">
                  <Input value={cfg.authorHandle} onChange={(e) => patch({ authorHandle: e.target.value })} placeholder="@handle" />
                </Field>
              </div>
            )}
            <Field label="Page indicator">
              <Segmented
                value={cfg.pageIndicator}
                onChange={(v) => patch({ pageIndicator: v as PageIndicator })}
                options={[
                  { value: "dots", label: "Dots" },
                  { value: "count", label: "1 / N" },
                  { value: "none", label: "None" },
                ]}
              />
            </Field>
            <div className="flex items-center justify-between">
              <Label>Swipe arrow (except last)</Label>
              <Switch checked={cfg.swipeHint} onCheckedChange={(v) => patch({ swipeHint: v })} />
            </div>
          </Section>

          <Button
            variant="ghost"
            className="text-muted-foreground w-full"
            onClick={() => {
              Object.values(images).forEach((i) => URL.revokeObjectURL(i.url));
              setImages({});
              setCfg(DEFAULT_CAROUSEL);
              setCurrent(0);
            }}
          >
            <SparklesIcon className="size-4" /> Reset to sample
          </Button>
        </div>
      </div>
    </GeneratorLayout>
  );
}

function deleteImage(id: string, setImages: React.Dispatch<React.SetStateAction<Record<string, LoadedImage>>>) {
  setImages((m) => {
    if (m[id]) URL.revokeObjectURL(m[id].url);
    const next = { ...m };
    delete next[id];
    return next;
  });
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

function ColorField({ label, value, onChange, wide }: { label?: string; value: string; onChange: (v: string) => void; wide?: boolean }) {
  return (
    <div className="space-y-1">
      {label && <Label className="text-[11px]">{label}</Label>}
      <div className={cn("flex items-center gap-1.5", wide && "w-full")}>
        <Input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-9 shrink-0 cursor-pointer p-1" aria-label={label ?? "Color"} />
        {wide && <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 font-mono text-xs" />}
      </div>
    </div>
  );
}

function SliderRow({ label, value, unit, min, max, step = 1, onChange }: { label: string; value: number; unit: string; min: number; max: number; step?: number; onChange: (v: number) => void }) {
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

function FontSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
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
  );
}

function AddSlideMenu({ onAdd }: { onAdd: (t: SlideType) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <Button type="button" size="sm" onClick={() => setOpen((o) => !o)}>
        <PlusIcon className="size-4" /> Add slide
      </Button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className="border-border bg-popover absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border shadow-md">
            {SLIDE_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onAdd(t.id);
                  setOpen(false);
                }}
                className="hover:bg-muted block w-full px-3 py-2 text-left text-sm"
              >
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ImageField({ hasImage, onFile, onClear }: { hasImage: boolean; onFile: (f: FileList | null) => void; onClear: () => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <Label>Photo</Label>
      <div className="flex gap-2">
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => ref.current?.click()}>
          <UploadIcon className="size-4" /> {hasImage ? "Replace photo" : "Upload photo"}
        </Button>
        {hasImage && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClear} aria-label="Remove">
            <XIcon className="size-4" />
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-[11px]">Full-bleed with a dark scrim so the title stays readable.</p>
    </div>
  );
}

function SlideRow({
  index,
  slide,
  active,
  canUp,
  canDown,
  onSelect,
  onUp,
  onDown,
  onDuplicate,
  onDelete,
}: {
  index: number;
  slide: Slide;
  active: boolean;
  canUp: boolean;
  canDown: boolean;
  onSelect: () => void;
  onUp: () => void;
  onDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const label = SLIDE_TYPES.find((t) => t.id === slide.type)?.label ?? slide.type;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border p-1.5 transition-colors",
        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          {index + 1}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {slide.title.replace(/\*/g, "").trim() || label}
          </span>
          <span className="text-muted-foreground block text-[11px]">{label}</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center">
        <IconBtn label="Move up" disabled={!canUp} onClick={onUp}>
          ↑
        </IconBtn>
        <IconBtn label="Move down" disabled={!canDown} onClick={onDown}>
          ↓
        </IconBtn>
        <IconBtn label="Duplicate" onClick={onDuplicate}>
          <CopyIcon className="size-3.5" />
        </IconBtn>
        <IconBtn label="Delete" onClick={onDelete} danger>
          <XIcon className="size-3.5" />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled, danger }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-xs transition-colors disabled:opacity-30",
        danger ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
