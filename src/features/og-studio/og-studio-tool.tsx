"use client";

import * as React from "react";
import {
  DownloadIcon,
  ImageIcon,
  LayersIcon,
  PaletteIcon,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { dataUrlToBlob, downloadDataUrl } from "@/lib/qr";
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

export function OgStudioTool() {
  const history = useHistory("ogstudio");
  const [cfg, setCfg] = useLocalStorage<OgConfig>("forma:og-studio", DEFAULT_OG);
  // Uploaded assets stay in-session (too heavy for localStorage).
  const [logoSrc, setLogoSrc] = React.useState<string>();
  const [avatarSrc, setAvatarSrc] = React.useState<string>();
  const [bgSrc, setBgSrc] = React.useState<string>();

  const logo = useImage(logoSrc);
  const avatar = useImage(avatarSrc);
  const bg = useImage(bgSrc);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const set = <K extends keyof OgConfig>(key: K, value: OgConfig[K]) =>
    setCfg((prev) => ({ ...prev, [key]: value }));

  const size = SIZES.find((s) => s.id === cfg.sizeId) ?? SIZES[0];
  const cfgKey = JSON.stringify(cfg);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const run = async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* draw with whatever's loaded */
      }
      if (!cancelled && canvasRef.current)
        renderOg(canvasRef.current, cfg, { logo, avatar, bg });
    };
    const id = setTimeout(run, 80);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cfgKey captures cfg
  }, [cfgKey, logo, avatar, bg]);

  const commit = () =>
    history.add(`${size.name} · ${cfg.title.replace(/\*/g, "").slice(0, 40) || "card"}`, cfgKey);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    downloadDataUrl(canvas.toDataURL("image/png"), `${ogFilename(cfg)}.png`);
    commit();
    toast.success(`Exported ${size.w}×${size.h} PNG`);
  };

  const copyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await dataUrlToBlob(canvas.toDataURL("image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Image copied to clipboard");
      commit();
    } catch {
      toast.error("Your browser blocked image copy — download instead");
    }
  };

  const applyTemplate = (patch: Partial<OgConfig>) => setCfg((prev) => ({ ...prev, ...patch }));

  const metaTags = buildMetaTags(cfg);
  const routeCode = buildOgRoute(cfg);

  return (
    <GeneratorLayout tool={TOOL_BY_ID.ogstudio} output={null} footer={<HistoryPanel history={history} />}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---- Preview + export ---- */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="space-y-3 lg:sticky lg:top-20">
            <Card>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {SIZES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => set("sizeId", s.id)}
                      title={`${s.name} — ${s.w}×${s.h}`}
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
                </div>

                <div className="bg-muted/40 flex justify-center overflow-auto rounded-xl p-3">
                  <canvas
                    ref={canvasRef}
                    className="h-auto max-h-[62vh] w-auto max-w-full rounded-lg shadow-lg"
                    style={{ aspectRatio: `${size.w} / ${size.h}` }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={download} className="flex-1 font-semibold">
                    <DownloadIcon className="size-4" /> Download PNG
                  </Button>
                  <Button variant="outline" onClick={copyImage}>
                    Copy
                  </Button>
                  <Select value={String(cfg.scale)} onValueChange={(v) => set("scale", Number(v))}>
                    <SelectTrigger className="w-[92px]" aria-label="Export resolution">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1×</SelectItem>
                      <SelectItem value="2">2×</SelectItem>
                      <SelectItem value="3">3×</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-muted-foreground text-center text-xs">
                  {size.w} × {size.h} · {size.group} · exporting at {size.w * cfg.scale}×
                  {size.h * cfg.scale}
                </p>
              </CardContent>
            </Card>

            {/* ---- Code export ---- */}
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
                    <CodeBlock text={routeCode} filenameHint="app/opengraph-image.tsx — generates the card per page" />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ---- Controls ---- */}
        <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-1">
          {/* Templates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <WandSparklesIcon className="text-primary size-4" /> Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t.patch)}
                    className="border-border hover:border-primary hover:bg-muted/50 rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Content */}
          <Section icon={TypeIcon} title="Content">
            <div className="flex items-center justify-between">
              <Label>Eyebrow badge</Label>
              <Switch checked={cfg.showEyebrow} onCheckedChange={(v) => set("showEyebrow", v)} />
            </div>
            {cfg.showEyebrow && (
              <Input value={cfg.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} placeholder="Introducing" />
            )}
            <Field label="Title" hint="wrap a phrase in *asterisks* to accent it">
              <Textarea
                value={cfg.title}
                onChange={(e) => set("title", e.target.value)}
                rows={2}
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
          </Section>

          {/* Background */}
          <Section icon={ImageIcon} title="Background">
            <Segmented
              value={cfg.bgType}
              onChange={(v) => set("bgType", v as BgType)}
              options={[
                { value: "mesh", label: "Mesh" },
                { value: "gradient", label: "Gradient" },
                { value: "solid", label: "Solid" },
                { value: "image", label: "Image" },
              ]}
            />

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
                      onClick={() => setCfg((c) => ({ ...c, meshBase: p.base, mesh: p.blobs.map((b) => ({ ...b })) }))}
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
                          ...c,
                          mesh: c.mesh.map((mb, j) => (j === i ? { ...mb, color: v } : mb)),
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
                      onClick={() => setCfg((c) => ({ ...c, gradFrom: p.from, gradTo: p.to, gradAngle: p.angle }))}
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
          </Section>

          {/* Typography & color */}
          <Section icon={PaletteIcon} title="Type & color">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title font">
                <FontSelect value={cfg.titleFont} onChange={(v) => set("titleFont", v)} />
              </Field>
              <Field label="Body font">
                <FontSelect value={cfg.bodyFont} onChange={(v) => set("bodyFont", v)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <Field label="Align">
                <Segmented
                  value={cfg.align}
                  onChange={(v) => set("align", v as OgConfig["align"])}
                  options={[
                    { value: "left", label: "Left" },
                    { value: "center", label: "Center" },
                  ]}
                />
              </Field>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <ColorField label="Title" value={cfg.textColor} onChange={(v) => set("textColor", v)} />
              <ColorField label="Body" value={cfg.mutedColor} onChange={(v) => set("mutedColor", v)} />
              <ColorField label="Accent 1" value={cfg.accentFrom} onChange={(v) => set("accentFrom", v)} />
              <ColorField label="Accent 2" value={cfg.accentTo} onChange={(v) => set("accentTo", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Gradient accent</Label>
              <Switch checked={cfg.accentGradient} onCheckedChange={(v) => set("accentGradient", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto-fit text</Label>
              <Switch checked={cfg.autoFit} onCheckedChange={(v) => set("autoFit", v)} />
            </div>
            <SliderRow label="Title size" value={Math.round(cfg.titleScale * 100)} unit="%" min={60} max={160} onChange={(v) => set("titleScale", v / 100)} />
            <SliderRow label="Body size" value={Math.round(cfg.descScale * 100)} unit="%" min={60} max={160} onChange={(v) => set("descScale", v / 100)} />
            <Field label="Vertical position">
              <Segmented
                value={cfg.vAnchor}
                onChange={(v) => set("vAnchor", v as OgConfig["vAnchor"])}
                options={[
                  { value: "top", label: "Top" },
                  { value: "center", label: "Middle" },
                  { value: "bottom", label: "Bottom" },
                ]}
              />
            </Field>
          </Section>

          {/* Effects */}
          <Section icon={LayersIcon} title="Effects">
            <Field label="Pattern overlay">
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
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <label className="flex cursor-pointer items-center gap-2.5">
                <Switch checked={cfg.topGlow} onCheckedChange={(v) => set("topGlow", v)} />
                <span className="text-sm">Top glow</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <Switch checked={cfg.glass} onCheckedChange={(v) => set("glass", v)} />
                <span className="text-sm">Glass card</span>
              </label>
            </div>
          </Section>

          {/* Branding */}
          <Section icon={UserRoundIcon} title="Branding">
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
            {cfg.showFooter && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name">
                    <Input value={cfg.authorName} onChange={(e) => set("authorName", e.target.value)} placeholder="Forma" />
                  </Field>
                  <Field label="Handle">
                    <Input value={cfg.authorHandle} onChange={(e) => set("authorHandle", e.target.value)} placeholder="@handle" />
                  </Field>
                </div>
                <Field label="Domain">
                  <Input value={cfg.domain} onChange={(e) => set("domain", e.target.value)} placeholder="forma.tools" />
                </Field>
                {cfg.logoSlot !== "footer" && (
                  <UploadField
                    label="Avatar (footer)"
                    hasValue={!!avatarSrc}
                    onFile={(d) => setAvatarSrc(d)}
                    onClear={() => setAvatarSrc(undefined)}
                  />
                )}
              </>
            )}
          </Section>

          <Button
            variant="ghost"
            className="text-muted-foreground w-full"
            onClick={() => {
              setCfg(DEFAULT_OG);
              setLogoSrc(undefined);
              setAvatarSrc(undefined);
              setBgSrc(undefined);
            }}
          >
            <SparklesIcon className="size-4" /> Reset to default
          </Button>
        </div>
      </div>
    </GeneratorLayout>
  );
}

/* -------------------------------- UI helpers ------------------------------ */

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof TypeIcon;
  title: string;
  children: React.ReactNode;
}) {
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
