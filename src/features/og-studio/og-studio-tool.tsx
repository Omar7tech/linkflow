"use client";

import * as React from "react";
import {
  CopyIcon,
  DownloadIcon,
  LayoutTemplateIcon,
  MonitorIcon,
  PaletteIcon,
  RotateCcwIcon,
  ShuffleIcon,
  TypeIcon,
  UploadIcon,
  UserRoundIcon,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  buildMetaTags,
  buildOgRoute,
  DEFAULT_OG,
  GRADIENT_PRESETS,
  MESH_PRESETS,
  OG_FONTS,
  ogFilename,
  renderOg,
  SIZES,
  TEMPLATES,
  type BgType,
  type Decor,
  type Highlight,
  type Layout,
  type MediaFrame,
  type OgAssets,
  type OgConfig,
  type PatternType,
} from "@/lib/og-studio";
import { cn } from "@/lib/utils";

/** Load a data-URL into a decoded <img>, re-rendering once ready. */
function useImage(src: string | undefined) {
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  React.useEffect(() => {
    let active = true;
    if (!src) {
      // Defer so we don't setState synchronously inside the effect body.
      const t = setTimeout(() => active && setImg(null), 0);
      return () => {
        active = false;
        clearTimeout(t);
      };
    }
    const el = new Image();
    el.onload = () => active && setImg(el);
    el.onerror = () => active && setImg(null);
    el.src = src;
    return () => {
      active = false;
    };
  }, [src]);
  return img;
}

const canvasBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));

const PANELS = [
  { id: "templates", label: "Templates", icon: LayoutTemplateIcon },
  { id: "content", label: "Content", icon: TypeIcon },
  { id: "look", label: "Look", icon: PaletteIcon },
  { id: "media", label: "Screenshot", icon: MonitorIcon },
  { id: "brand", label: "Brand", icon: UserRoundIcon },
] as const;

const LAYOUTS: { value: Layout; label: string }[] = [
  { value: "stack", label: "Words" },
  { value: "split", label: "Split" },
  { value: "showcase", label: "Showcase" },
  { value: "quote", label: "Quote" },
];
const DECORS: { value: Decor; label: string }[] = [
  { value: "none", label: "None" },
  { value: "rings", label: "Rings" },
  { value: "beams", label: "Beams" },
  { value: "orbs", label: "Orbs" },
  { value: "horizon", label: "Horizon" },
  { value: "waves", label: "Waves" },
  { value: "stars", label: "Stars" },
];
const HIGHLIGHTS: { value: Highlight; label: string }[] = [
  { value: "text", label: "Color" },
  { value: "marker", label: "Marker" },
  { value: "underline", label: "Underline" },
  { value: "pill", label: "Pill" },
];

/** A template drawn for real, at thumbnail size, with the words currently on the card. */
function TemplateThumb({ cfg, assets, drawn }: { cfg: OgConfig; assets: OgAssets; drawn: number }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (ref.current) renderOg(ref.current, cfg, assets, 0.24);
    });
    return () => cancelAnimationFrame(raf);
  }, [cfg, assets, drawn]);
  return <canvas ref={ref} className="block aspect-[1200/630] w-full" />;
}

export function OgStudioTool() {
  const history = useHistory("ogstudio");
  const [stored, setCfg] = useLocalStorage<OgConfig>("forma:og-studio", DEFAULT_OG);
  // A card saved before a setting existed takes that setting's default.
  const cfg = React.useMemo<OgConfig>(() => ({ ...DEFAULT_OG, ...stored }), [stored]);

  // Uploaded assets stay in-session (too heavy for localStorage).
  const [logoSrc, setLogoSrc] = React.useState<string>();
  const [avatarSrc, setAvatarSrc] = React.useState<string>();
  const [bgSrc, setBgSrc] = React.useState<string>();
  const [mediaSrc, setMediaSrc] = React.useState<string>();
  const logo = useImage(logoSrc);
  const avatar = useImage(avatarSrc);
  const bg = useImage(bgSrc);
  const media = useImage(mediaSrc);
  const assets = React.useMemo<OgAssets>(() => ({ logo, avatar, bg, media }), [logo, avatar, bg, media]);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [panel, setPanel] = React.useState<(typeof PANELS)[number]["id"]>("templates");
  const [templateId, setTemplateId] = React.useState<string | null>(null);

  const set = <K extends keyof OgConfig>(key: K, value: OgConfig[K]) =>
    setCfg((prev) => ({ ...DEFAULT_OG, ...prev, [key]: value }));

  const size = SIZES.find((s) => s.id === cfg.sizeId) ?? SIZES[0];
  const cfgKey = JSON.stringify(cfg);

  // Redraw once the webfonts are in; before that text is measured in a fallback.
  const [fontsIn, setFontsIn] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    document.fonts.ready.then(() => live && setFontsIn(1), () => {});
    return () => {
      live = false;
    };
  }, []);

  // The preview is drawn at about screen size; the export is drawn separately at full size.
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (canvasRef.current) renderOg(canvasRef.current, cfg, assets, Math.min(2, window.devicePixelRatio || 1) * 0.75);
    });
    return () => cancelAnimationFrame(raf);
  }, [cfg, assets, fontsIn]);

  const commit = () =>
    history.add(`${size.name} · ${cfg.title.replace(/\*/g, "").slice(0, 40) || "card"}`, cfgKey);

  const exportBlob = () => {
    const out = document.createElement("canvas");
    renderOg(out, cfg, assets, cfg.scale);
    return canvasBlob(out);
  };

  const download = async () => {
    const blob = await exportBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ogFilename(cfg)}.png`;
    a.click();
    URL.revokeObjectURL(url);
    commit();
    toast.success(`Exported ${size.w * cfg.scale}×${size.h * cfg.scale} PNG`);
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

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setTemplateId(t.id);
    setCfg((prev) => ({ ...DEFAULT_OG, ...prev, ...t.patch }));
  };
  const shuffle = () => {
    const others = TEMPLATES.filter((t) => t.id !== templateId);
    applyTemplate(others[Math.floor(Math.random() * others.length)]);
  };

  const usesMedia = cfg.layout === "split" || cfg.layout === "showcase";
  const metaTags = buildMetaTags(cfg);
  const routeCode = buildOgRoute(cfg);

  return (
    <GeneratorLayout tool={TOOL_BY_ID.ogstudio} output={null} footer={<HistoryPanel history={history} />}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ---- Stage + export ---- */}
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden py-0">
            <div className="border-border flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => set("sizeId", s.id)}
                  title={`${s.name} — ${s.w}×${s.h}`}
                  aria-pressed={cfg.sizeId === s.id}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                    cfg.sizeId === s.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {s.name}
                </button>
              ))}
              <Button variant="outline" size="sm" onClick={shuffle} className="ml-auto">
                <ShuffleIcon /> Shuffle
              </Button>
            </div>

            <div className="bg-muted/40 flex justify-center p-3 sm:p-5">
              <canvas
                ref={canvasRef}
                className="h-auto max-h-[62vh] w-auto max-w-full rounded-lg shadow-lg"
                style={{ aspectRatio: `${size.w} / ${size.h}` }}
                aria-label="Share card preview"
              />
            </div>

            <div className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
              <p className="text-muted-foreground mr-auto font-mono text-[11px] tabular-nums">
                {size.w * cfg.scale} × {size.h * cfg.scale} px · {size.group}
              </p>
              <Select value={String(cfg.scale)} onValueChange={(v) => set("scale", Number(v))}>
                <SelectTrigger className="w-20" aria-label="Export resolution">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1×</SelectItem>
                  <SelectItem value="2">2×</SelectItem>
                  <SelectItem value="3">3×</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={copyImage}>
                <CopyIcon /> Copy
              </Button>
              <Button size="sm" onClick={download} className="font-semibold">
                <DownloadIcon /> Download PNG
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ship it</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="meta">
                <TabsList className="w-full">
                  <TabsTrigger value="meta" className="flex-1">
                    Meta tags
                  </TabsTrigger>
                  <TabsTrigger value="route" className="flex-1">
                    Next.js route
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="meta" className="pt-3">
                  <CodeBlock text={metaTags} filenameHint="Paste into <head>" />
                </TabsContent>
                <TabsContent value="route" className="pt-3">
                  <CodeBlock text={routeCode} filenameHint="app/opengraph-image.tsx — generates the card per page (words and background only)" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* ---- Controls: one panel at a time ---- */}
        <div className="min-w-0">
          <Card className="py-0 lg:sticky lg:top-20">
            <div className="border-border flex gap-1 border-b p-1.5" role="tablist" aria-label="Card settings">
              {PANELS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={panel === p.id}
                  onClick={() => setPanel(p.id)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition-colors",
                    panel === p.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <p.icon className="size-4" aria-hidden />
                  {p.label}
                </button>
              ))}
            </div>

            <div className="space-y-5 p-4 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto">
              {panel === "templates" && (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        aria-pressed={templateId === t.id}
                        className="group space-y-1 text-left"
                      >
                        <span
                          className={cn(
                            "block overflow-hidden rounded-lg border-2 transition-transform group-hover:scale-[1.03]",
                            templateId === t.id ? "border-primary" : "border-border/60"
                          )}
                        >
                          <TemplateThumb cfg={thumbConfig(cfg, t.patch)} assets={assets} drawn={fontsIn} />
                        </span>
                        <span className="text-muted-foreground block truncate text-[11px]">{t.name}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    A template sets the whole look and keeps your words. Fine-tune it in the other tabs.
                  </p>
                </>
              )}

              {panel === "content" && (
                <>
                  <Field label="Layout" hint={usesMedia ? "uses the Screenshot tab" : undefined}>
                    <Segmented value={cfg.layout} onChange={(v) => set("layout", v)} options={LAYOUTS} />
                  </Field>
                  {cfg.layout !== "quote" && (
                    <>
                      <div className="flex items-center justify-between">
                        <Label>Eyebrow badge</Label>
                        <Switch checked={cfg.showEyebrow} onCheckedChange={(v) => set("showEyebrow", v)} />
                      </div>
                      {cfg.showEyebrow && (
                        <Input value={cfg.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} placeholder="Introducing" />
                      )}
                    </>
                  )}
                  <Field label={cfg.layout === "quote" ? "Quote" : "Title"} hint="wrap a phrase in *asterisks* to accent it">
                    <Textarea
                      value={cfg.title}
                      onChange={(e) => set("title", e.target.value)}
                      rows={3}
                      className="resize-none font-medium"
                      placeholder="Your headline"
                    />
                  </Field>
                  <Field label="Description">
                    <Textarea
                      value={cfg.description}
                      onChange={(e) => set("description", e.target.value)}
                      rows={2}
                      className="resize-none"
                      placeholder="A short supporting line."
                    />
                  </Field>
                  <Field label="Accent style">
                    <Segmented value={cfg.highlight} onChange={(v) => set("highlight", v)} options={HIGHLIGHTS} />
                  </Field>
                  {cfg.layout !== "split" && cfg.layout !== "showcase" && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Align">
                        <Segmented
                          value={cfg.align}
                          onChange={(v) => set("align", v)}
                          options={[
                            { value: "left", label: "Left" },
                            { value: "center", label: "Center" },
                          ]}
                        />
                      </Field>
                      <Field label="Position">
                        <Segmented
                          value={cfg.vAnchor}
                          onChange={(v) => set("vAnchor", v)}
                          options={[
                            { value: "top", label: "Top" },
                            { value: "center", label: "Mid" },
                            { value: "bottom", label: "Low" },
                          ]}
                        />
                      </Field>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Title font">
                      <FontSelect value={cfg.titleFont} onChange={(v) => set("titleFont", v)} />
                    </Field>
                    <Field label="Body font">
                      <FontSelect value={cfg.bodyFont} onChange={(v) => set("bodyFont", v)} />
                    </Field>
                  </div>
                  <Field label="Weight">
                    <Select value={String(cfg.titleWeight)} onValueChange={(v) => set("titleWeight", Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="500">Medium</SelectItem>
                        <SelectItem value="600">Semibold</SelectItem>
                        <SelectItem value="700">Bold</SelectItem>
                        <SelectItem value="800">Extrabold</SelectItem>
                        <SelectItem value="900">Black</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <SliderRow label="Title size" value={Math.round(cfg.titleScale * 100)} unit="%" min={60} max={160} onChange={(v) => set("titleScale", v / 100)} />
                  <SliderRow label="Body size" value={Math.round(cfg.descScale * 100)} unit="%" min={60} max={160} onChange={(v) => set("descScale", v / 100)} />
                  <div className="flex items-center justify-between">
                    <Label>Shrink text to fit</Label>
                    <Switch checked={cfg.autoFit} onCheckedChange={(v) => set("autoFit", v)} />
                  </div>
                </>
              )}

              {panel === "look" && (
                <>
                  <Field label="Background">
                    <Segmented
                      value={cfg.bgType}
                      onChange={(v) => set("bgType", v as BgType)}
                      options={[
                        { value: "mesh", label: "Mesh" },
                        { value: "gradient", label: "Gradient" },
                        { value: "solid", label: "Solid" },
                        { value: "image", label: "Photo" },
                      ]}
                    />
                  </Field>

                  {cfg.bgType === "mesh" && (
                    <>
                      <SwatchRow>
                        {MESH_PRESETS.map((p) => (
                          <Swatch
                            key={p.name}
                            title={p.name}
                            active={cfg.meshBase === p.base && cfg.mesh[0]?.color === p.blobs[0].color}
                            style={{
                              background: `radial-gradient(circle at 20% 25%, ${p.blobs[0].color}, transparent 60%), radial-gradient(circle at 80% 30%, ${p.blobs[1].color}, transparent 55%), ${p.base}`,
                            }}
                            onClick={() => setCfg((c) => ({ ...DEFAULT_OG, ...c, meshBase: p.base, mesh: p.blobs.map((b) => ({ ...b })) }))}
                          />
                        ))}
                      </SwatchRow>
                      <div className="grid grid-cols-4 gap-2">
                        <ColorField label="Base" value={cfg.meshBase} onChange={(v) => set("meshBase", v)} />
                        {cfg.mesh.map((b, i) => (
                          <ColorField
                            key={i}
                            label={`Blob ${i + 1}`}
                            value={b.color}
                            onChange={(v) =>
                              setCfg((c) => ({
                                ...DEFAULT_OG,
                                ...c,
                                mesh: cfg.mesh.map((mb, j) => (j === i ? { ...mb, color: v } : mb)),
                              }))
                            }
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {cfg.bgType === "gradient" && (
                    <>
                      <SwatchRow>
                        {GRADIENT_PRESETS.map((p) => (
                          <Swatch
                            key={p.name}
                            title={p.name}
                            active={cfg.gradFrom === p.from && cfg.gradTo === p.to}
                            style={{ background: `linear-gradient(${p.angle}deg, ${p.from}, ${p.to})` }}
                            onClick={() => setCfg((c) => ({ ...DEFAULT_OG, ...c, gradFrom: p.from, gradTo: p.to, gradAngle: p.angle }))}
                          />
                        ))}
                      </SwatchRow>
                      <div className="grid grid-cols-2 gap-2">
                        <ColorField label="From" value={cfg.gradFrom} onChange={(v) => set("gradFrom", v)} />
                        <ColorField label="To" value={cfg.gradTo} onChange={(v) => set("gradTo", v)} />
                      </div>
                      <SliderRow label="Angle" value={cfg.gradAngle} unit="°" min={0} max={360} onChange={(v) => set("gradAngle", v)} />
                    </>
                  )}

                  {cfg.bgType === "solid" && (
                    <ColorField label="Color" value={cfg.solid} onChange={(v) => set("solid", v)} wide />
                  )}

                  {cfg.bgType === "image" && (
                    <>
                      <UploadField
                        label="Background photo"
                        hasValue={!!bgSrc}
                        onFile={(d) => setBgSrc(d)}
                        onClear={() => setBgSrc(undefined)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <ColorField label="Scrim" value={cfg.imageOverlay} onChange={(v) => set("imageOverlay", v)} />
                        <div className="flex flex-col justify-end">
                          <SliderRow
                            label="Darken"
                            value={Math.round(cfg.imageOverlayOpacity * 100)}
                            unit="%"
                            min={0}
                            max={90}
                            onChange={(v) => set("imageOverlayOpacity", v / 100)}
                          />
                        </div>
                      </div>
                      <SliderRow label="Blur" value={cfg.imageBlur} unit="px" min={0} max={40} onChange={(v) => set("imageBlur", v)} />
                    </>
                  )}

                  <div className="border-border space-y-4 border-t pt-4">
                    <div className="grid grid-cols-4 gap-2">
                      <ColorField label="Title" value={cfg.textColor} onChange={(v) => set("textColor", v)} />
                      <ColorField label="Body" value={cfg.mutedColor} onChange={(v) => set("mutedColor", v)} />
                      <ColorField label="Accent 1" value={cfg.accentFrom} onChange={(v) => set("accentFrom", v)} />
                      <ColorField label="Accent 2" value={cfg.accentTo} onChange={(v) => set("accentTo", v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Blend the two accents</Label>
                      <Switch checked={cfg.accentGradient} onCheckedChange={(v) => set("accentGradient", v)} />
                    </div>
                  </div>

                  <div className="border-border space-y-4 border-t pt-4">
                    <Field label="Decoration" hint="drawn in the accent colors">
                      <Chips value={cfg.decor} onChange={(v) => set("decor", v)} options={DECORS} />
                    </Field>
                    {cfg.decor !== "none" && (
                      <SliderRow label="Strength" value={Math.round(cfg.decorStrength * 100)} unit="%" min={10} max={100} onChange={(v) => set("decorStrength", v / 100)} />
                    )}
                    <Field label="Pattern">
                      <Segmented
                        value={cfg.pattern}
                        onChange={(v) => set("pattern", v as PatternType)}
                        options={[
                          { value: "none", label: "None" },
                          { value: "dots", label: "Dots" },
                          { value: "grid", label: "Grid" },
                          { value: "lines", label: "Lines" },
                        ]}
                      />
                    </Field>
                    {cfg.pattern !== "none" && (
                      <div className="grid grid-cols-2 gap-3">
                        <ColorField label="Pattern" value={cfg.patternColor} onChange={(v) => set("patternColor", v)} />
                        <SliderRow label="Opacity" value={Math.round(cfg.patternOpacity * 100)} unit="%" min={2} max={30} onChange={(v) => set("patternOpacity", v / 100)} />
                      </div>
                    )}
                    <SliderRow label="Film grain" value={Math.round(cfg.grain * 100)} unit="%" min={0} max={100} onChange={(v) => set("grain", v / 100)} />
                    <SliderRow label="Vignette" value={Math.round(cfg.vignette * 100)} unit="%" min={0} max={70} onChange={(v) => set("vignette", v / 100)} />
                    <div className="flex flex-wrap gap-x-5 gap-y-3">
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <Switch checked={cfg.topGlow} onCheckedChange={(v) => set("topGlow", v)} />
                        <span className="text-sm">Top glow</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <Switch checked={cfg.glass} onCheckedChange={(v) => set("glass", v)} />
                        <span className="text-sm">Glass card</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <Switch checked={cfg.frame} onCheckedChange={(v) => set("frame", v)} />
                        <span className="text-sm">Frame</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {panel === "media" && (
                <>
                  {!usesMedia && (
                    <div className="border-border bg-muted/40 space-y-2 rounded-lg border p-3">
                      <p className="text-muted-foreground text-xs">
                        A screenshot shows in the Split and Showcase layouts. This card uses a words-only layout.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => set("layout", "split")}>
                          Use Split
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => set("layout", "showcase")}>
                          Use Showcase
                        </Button>
                      </div>
                    </div>
                  )}
                  <UploadField
                    label="Screenshot of your product or page"
                    hasValue={!!mediaSrc}
                    onFile={(d) => {
                      setMediaSrc(d);
                      if (!usesMedia) set("layout", "split");
                    }}
                    onClear={() => setMediaSrc(undefined)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Until you add one, the card shows a stand-in screen so you can judge the layout.
                  </p>
                  <Field label="Frame">
                    <Segmented
                      value={cfg.mediaFrame}
                      onChange={(v) => set("mediaFrame", v as MediaFrame)}
                      options={[
                        { value: "browser", label: "Browser" },
                        { value: "card", label: "Card" },
                        { value: "none", label: "Bare" },
                      ]}
                    />
                  </Field>
                  <SliderRow label="Tilt" value={cfg.mediaTilt} unit="°" min={-10} max={10} onChange={(v) => set("mediaTilt", v)} />
                </>
              )}

              {panel === "brand" && (
                <>
                  <Field label="Logo placement">
                    <Segmented
                      value={cfg.logoSlot}
                      onChange={(v) => set("logoSlot", v as OgConfig["logoSlot"])}
                      options={[
                        { value: "none", label: "None" },
                        { value: "top", label: "Top" },
                        { value: "footer", label: "Footer" },
                      ]}
                    />
                  </Field>
                  {cfg.logoSlot !== "none" && (
                    <UploadField
                      label="Logo (PNG/SVG)"
                      hasValue={!!logoSrc}
                      onFile={(d) => setLogoSrc(d)}
                      onClear={() => setLogoSrc(undefined)}
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <Label>Footer byline</Label>
                    <Switch checked={cfg.showFooter} onCheckedChange={(v) => set("showFooter", v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Name">
                      <Input value={cfg.authorName} onChange={(e) => set("authorName", e.target.value)} placeholder="TM TOOLS" />
                    </Field>
                    <Field label="Handle">
                      <Input value={cfg.authorHandle} onChange={(e) => set("authorHandle", e.target.value)} placeholder="@handle" />
                    </Field>
                  </div>
                  <Field label="Domain" hint="also shown in the browser frame">
                    <Input value={cfg.domain} onChange={(e) => set("domain", e.target.value)} placeholder="tools.twomindsengine.com" />
                  </Field>
                  {cfg.showFooter && cfg.logoSlot !== "footer" && (
                    <UploadField
                      label="Avatar (footer)"
                      hasValue={!!avatarSrc}
                      onFile={(d) => setAvatarSrc(d)}
                      onClear={() => setAvatarSrc(undefined)}
                    />
                  )}
                  <Button
                    variant="ghost"
                    className="text-muted-foreground w-full"
                    onClick={() => {
                      setCfg(DEFAULT_OG);
                      setTemplateId(null);
                      setLogoSrc(undefined);
                      setAvatarSrc(undefined);
                      setBgSrc(undefined);
                      setMediaSrc(undefined);
                    }}
                  >
                    <RotateCcwIcon className="size-4" /> Start over
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </GeneratorLayout>
  );
}

/** A template as it would look on the standard card, with the user's words. */
function thumbConfig(cfg: OgConfig, patch: Partial<OgConfig>): OgConfig {
  return { ...cfg, ...patch, sizeId: "og" };
}

/* -------------------------------- UI helpers ------------------------------ */

function Chips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === o.value
              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
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
  label: string;
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <div className={cn("flex items-center gap-1.5", wide && "w-full")}>
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-9 shrink-0 cursor-pointer p-1"
          aria-label={label}
        />
        {wide && (
          <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 font-mono text-xs" />
        )}
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

function FontSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OG_FONTS.map((f) => (
          <SelectItem key={f.value} value={f.value}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SwatchRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Swatch({
  active,
  style,
  title,
  onClick,
}: {
  active: boolean;
  style: React.CSSProperties;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={style}
      className={cn(
        "size-9 rounded-lg border-2 transition-transform",
        active ? "border-primary scale-110" : "border-border/40 hover:scale-105"
      )}
    />
  );
}

function UploadField({
  label,
  hasValue,
  onFile,
  onClear,
}: {
  label: string;
  hasValue: boolean;
  onFile: (dataUrl: string) => void;
  onClear: () => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const read = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => onFile(reader.result as string);
    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            read(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => ref.current?.click()}>
          <UploadIcon className="size-4" /> {hasValue ? "Replace" : "Upload"}
        </Button>
        {hasValue && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClear} aria-label="Remove">
            <XIcon className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function CodeBlock({ text, filenameHint }: { text: string; filenameHint: string }) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-[11px]">{filenameHint}</p>
      <div className="relative">
        <pre className="bg-muted/50 border-border max-h-64 overflow-auto rounded-lg border p-3 pr-12 font-mono text-[11px] leading-relaxed">
          {text}
        </pre>
        <CopyButton
          text={text}
          label=""
          variant="ghost"
          size="icon-sm"
          className="absolute top-1.5 right-1.5"
          successMessage="Copied"
          aria-label="Copy code"
        />
      </div>
    </div>
  );
}
