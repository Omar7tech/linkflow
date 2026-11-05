"use client";

import * as React from "react";
import {
  DicesIcon,
  DownloadIcon,
  FilmIcon,
  Grid3x3Icon,
  ImageIcon,
  LoaderCircleIcon,
  LayoutGridIcon,
  LockIcon,
  LockOpenIcon,
  PaletteIcon,
  PauseIcon,
  PlayIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { ImageDropzone } from "@/components/shared/image-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TOOL_BY_ID } from "@/constants/tools";
import { FONTS, FONT_BY_ID, bodyFont, embeddedFontCss, ensureFont, linkAllFonts, loadGoogleFont, measureEm, type FontId } from "@/lib/poster/fonts";
import {
  PALETTES,
  SIZES,
  STYLES,
  generate,
  helveticaMeasure,
  paletteOf,
  randomSeed,
  styleFor,
  type Measure,
  type Palette,
  type PosterContent,
  type PosterSettings,
  type SizeId,
} from "@/lib/poster/generate";
import { jpegToPdf } from "@/lib/poster/pdf";
import { TREATMENTS, loadPhoto, paletteFromPhoto, treatPhoto, type Photo, type Treatment } from "@/lib/poster/photo";
import { posterToSvg } from "@/lib/poster/render";
import { recordLoop, svgToImage } from "@/lib/poster/video";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ state */

const DEFAULT_CONTENT: PosterContent = {
  title: "Neue Form",
  subtitle: "Grafik und Raum",
  details: "12.03 – 28.05.2027\nKunsthalle Nord\nDi–So 10–18 Uhr",
  number: "27",
};

const DEFAULT_SETTINGS: PosterSettings = {
  size: "a3",
  style: "auto",
  palette: 0,
  custom: null,
  font: "inter",
  columns: 8,
  margin: 0.06,
  scale: 1,
  caseMode: "asis",
  layoutSeed: 11,
  typeSeed: 3,
};

/** Faces a shuffle picks from: the ones that carry a poster on their own. */
const SHUFFLE_FONTS: FontId[] = ["system", "inter", "archivo", "hanken", "schibsted", "space", "bricolage", "syne", "unbounded", "anton", "bebas", "oswald", "instrument"];

type Locks = { layout: boolean; colours: boolean; type: boolean };
type View = "flat" | "frame" | "street";

const subscribeNever = () => () => {};
const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ------------------------------------------------------------------- bits */

function LockToggle({ label, locked, onChange }: { label: string; locked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={locked}
      onClick={onChange}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
        locked ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {locked ? <LockIcon className="size-3.5" /> : <LockOpenIcon className="size-3.5" />}
      {label}
    </button>
  );
}

function Segmented<T extends string>({
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
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs transition-colors",
            value === v ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Inline SVG markup in a wrapper; the wrapper's classes style the svg. */
function Markup({ svg, className }: { svg: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/* ------------------------------------------------------------------- tool */

export function SwissPosterTool() {
  const hydrated = React.useSyncExternalStore(subscribeNever, () => true, () => false);
  const [content, setContent] = React.useState(DEFAULT_CONTENT);
  const [settings, setSettings] = React.useState(DEFAULT_SETTINGS);
  const [locks, setLocks] = React.useState<Locks>({ layout: false, colours: false, type: false });
  const [showGrid, setShowGrid] = React.useState(false);
  const [view, setView] = React.useState<View>("flat");
  const [motion, setMotion] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [history, setHistory] = React.useState<PosterSettings[]>([]);
  const [variants, setVariants] = React.useState<PosterSettings[] | null>(null);
  const [photo, setPhoto] = React.useState<Photo | null>(null);
  const [treatment, setTreatment] = React.useState<Treatment>("duotone");
  const [fontVersion, setFontVersion] = React.useState(0);
  const [busy, setBusy] = React.useState<{ kind: string; progress: number } | null>(null);
  const [fontQuery, setFontQuery] = React.useState("");
  const [customLabel, setCustomLabel] = React.useState<string | null>(null);
  const [fontState, setFontState] = React.useState<{ loading: boolean; error?: string }>({ loading: false });

  const applyGoogleFont = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fontQuery.trim()) return;
    setFontState({ loading: true });
    try {
      const def = await loadGoogleFont(fontQuery);
      setCustomLabel(def.label);
      setSettings((s) => ({ ...s, font: "custom" }));
      // Same id, new face: re-measure explicitly.
      setFontVersion((v) => v + 1);
      setFontState({ loading: false });
      setFontQuery("");
      toast.success(`${def.label} is ready`);
    } catch (error) {
      setFontState({ loading: false, error: (error as Error).message });
    }
  };

  React.useEffect(() => linkAllFonts(), []);

  // Re-measure once the chosen face is ready, so headlines fill exactly.
  React.useEffect(() => {
    let live = true;
    void ensureFont(settings.font).then(() => live && setFontVersion((v) => v + 1));
    return () => {
      live = false;
    };
  }, [settings.font]);

  const measureFor = React.useCallback(
    (font: FontId): Measure =>
      hydrated
        ? (text, role, weight) => measureEm(text, role === "head" ? FONT_BY_ID[font].family : bodyFont(font).family, weight)
        : helveticaMeasure,
    // fontVersion re-creates the measure once a face finishes loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, fontVersion]
  );

  const pal = paletteOf(settings);
  const treated = React.useMemo(() => {
    if (!photo) return null;
    // Inks chosen by brightness, so the photo always prints with contrast,
    // on light paper or dark: shadows in the darker colour, light in the brighter.
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [dark, light] = lum(pal.ink) < lum(pal.bg) ? [pal.ink, pal.bg] : [pal.bg, pal.ink];
    const highlight = treatment === "duotone" && Math.abs(lum(pal.accent) - lum(dark)) > 60 ? pal.accent : light;
    return treatPhoto(photo, treatment, dark, highlight);
  }, [photo, treatment, pal.ink, pal.accent, pal.bg]);
  const fullContent = React.useMemo(() => ({ ...content, photo: treated }), [content, treated]);
  const poster = React.useMemo(
    () => generate(fullContent, settings, measureFor(settings.font)),
    [fullContent, settings, measureFor]
  );

  // Motion preview clock.
  React.useEffect(() => {
    if (!motion) return;
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      setTime((performance.now() - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [motion]);

  const set = <K extends keyof PosterSettings>(key: K, value: PosterSettings[K]) => setSettings((s) => ({ ...s, [key]: value }));

  // Compositions shown recently, so a shuffle always lands somewhere new.
  const recent = React.useRef<string[]>([]);
  const freshSeed = React.useCallback(
    (avoid: string[]) => {
      let seed = randomSeed();
      for (let i = 0; i < 40 && avoid.includes(styleFor(seed, !!photo)); i++) seed = randomSeed();
      return seed;
    },
    [photo]
  );

  const shuffled = React.useCallback(
    (s: PosterSettings, avoid: string[] = recent.current): PosterSettings => {
      let palette = s.palette;
      if (!locks.colours) while (palette === s.palette) palette = Math.floor(Math.random() * PALETTES.length);
      return {
        ...s,
        layoutSeed: locks.layout ? s.layoutSeed : s.style === "auto" ? freshSeed(avoid) : randomSeed(),
        palette,
        custom: locks.colours ? s.custom : null,
        typeSeed: locks.type ? s.typeSeed : randomSeed(),
        font: locks.type ? s.font : pick(SHUFFLE_FONTS),
        caseMode: locks.type ? s.caseMode : pick(["upper", "asis", "asis", "lower"] as const),
      };
    },
    [locks, freshSeed]
  );

  React.useEffect(() => {
    recent.current = [poster.style, ...recent.current.filter((x) => x !== poster.style)].slice(0, 8);
  }, [poster.style]);

  const apply = (next: PosterSettings) => {
    setHistory((h) => [settings, ...h.filter((x) => x !== settings)].slice(0, 14));
    setSettings(next);
  };

  const shuffle = () => apply(shuffled({ ...settings, style: settings.style }));

  // Explore always explores compositions too, unless the layout is locked.
  const explore = () => {
    // Nine directions, nine different compositions.
    const seen = [poster.style as string];
    setVariants(
      Array.from({ length: 9 }, () => {
        const next = shuffled({ ...settings, style: locks.layout ? settings.style : "auto" }, seen);
        seen.push(styleFor(next.layoutSeed, !!photo));
        return next;
      })
    );
  };

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if ((event.target as HTMLElement).closest("input, textarea, button, [role=slider], [role=combobox]")) return;
      event.preventDefault();
      setSettings((s) => {
        const next = shuffled(s);
        setHistory((h) => [s, ...h].slice(0, 14));
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shuffled]);

  const size = SIZES[settings.size];
  const fileBase = (content.title.trim() || "poster").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  /* ---------------------------------------------------------------- export */

  const exportAs = async (kind: "pdf" | "png" | "svg" | "video") => {
    setBusy({ kind, progress: 0 });
    try {
      await ensureFont(settings.font);
      const fontCss = await embeddedFontCss([settings.font, "mono"]);
      if (kind === "svg") {
        const markup = posterToSvg(poster, {
          fontCss,
          width: size.print ? `${size.w}mm` : String(size.px![0]),
          height: size.print ? `${size.h}mm` : String(size.px![1]),
        });
        save(new Blob([markup], { type: "image/svg+xml" }), `${fileBase}.svg`);
      } else if (kind === "video") {
        const w = size.px ? size.px[0] : 1080;
        const h = size.px ? size.px[1] : Math.round((1080 * size.h) / size.w / 2) * 2;
        const { blob, ext } = await recordLoop(
          (t) => posterToSvg(poster, { t: t || 0.0001, fontCss, width: String(w), height: String(h) }),
          w,
          h,
          (progress) => setBusy({ kind, progress })
        );
        save(blob, `${fileBase}.${ext}`);
      } else {
        const px: [number, number] = size.print ? [Math.round((size.w / 25.4) * 300), Math.round((size.h / 25.4) * 300)] : size.px!;
        const img = await svgToImage(posterToSvg(poster, { fontCss, width: String(px[0]), height: String(px[1]) }));
        const canvas = document.createElement("canvas");
        canvas.width = px[0];
        canvas.height = px[1];
        canvas.getContext("2d")!.drawImage(img, 0, 0, px[0], px[1]);
        const type = kind === "png" ? "image/png" : "image/jpeg";
        const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("export"))), type, 0.95));
        if (kind === "png") save(blob, `${fileBase}.png`);
        else save(new Blob([jpegToPdf(new Uint8Array(await blob.arrayBuffer()), px, [size.w, size.h]) as BlobPart], { type: "application/pdf" }), `${fileBase}.pdf`);
      }
      toast.success(kind === "video" ? "Motion poster downloaded" : "Poster downloaded");
    } catch (error) {
      toast.error((error as Error).message || "The poster could not be exported.");
    } finally {
      setBusy(null);
    }
  };

  /* ---------------------------------------------------------------- render */

  const svg = hydrated ? posterToSvg(poster, { t: motion ? time : 0, showGrid, uid: "main" }) : "";
  const styleLabel = STYLES.find((s) => s.id === poster.style)?.label;

  const stage = (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-xl p-6 sm:p-10",
        view === "street"
          ? "bg-[#6f6a62] bg-[radial-gradient(circle_at_20%_10%,rgb(255_255_255/0.18),transparent_45%),repeating-linear-gradient(0deg,rgb(0_0_0/0.06)_0_2px,transparent_2px_26px),repeating-linear-gradient(90deg,rgb(0_0_0/0.05)_0_2px,transparent_2px_58px)]"
          : view === "frame"
            ? "bg-[#e7e4dd] bg-[radial-gradient(ellipse_at_50%_0%,#fbfaf7,transparent_70%)] dark:bg-[#d9d5cc]"
            : "bg-[radial-gradient(ellipse_at_50%_30%,#e9e9ec,#d4d4d8)] dark:bg-[radial-gradient(ellipse_at_50%_30%,#1c1c1f,#0b0b0c)]"
      )}
    >
      {hydrated ? (
        <div
          className={cn(
            "relative transition-transform duration-500",
            view === "frame" && "bg-[#111] p-[1.6%] shadow-[0_40px_60px_-30px_rgb(0_0_0/0.6)]",
            view === "street" && "-rotate-2 shadow-[6px_10px_18px_rgb(0_0_0/0.45)]"
          )}
          // Sized from the poster's proportions: as tall as the view allows, never wider than the column.
          style={{ width: `min(100%, ${(64 * poster.w) / poster.h}vh)` }}
        >
          {view === "frame" && <div className="absolute inset-[1.6%] bg-white" />}
          <Markup
            svg={svg}
            className={cn(
              "relative [&>svg]:block [&>svg]:h-full [&>svg]:w-full",
              view === "frame" && "p-[7%]",
              view === "flat" && "shadow-[0_30px_60px_-20px_rgb(0_0_0/0.45),0_2px_6px_rgb(0_0_0/0.15)]"
            )}
          />
          {view === "street" && (
            <>
              <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgb(255_255_255/0.12)_45%,transparent_55%),repeating-linear-gradient(78deg,transparent_0_40px,rgb(0_0_0/0.05)_40px_41px)] mix-blend-multiply" />
              <span className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rotate-3 bg-[#e8dfc9]/80" />
            </>
          )}
        </div>
      ) : (
        <div className="bg-muted aspect-[1/1.414] h-[60vh] animate-pulse rounded" />
      )}
      <p className={cn("mt-4 font-mono text-[11px]", view === "street" ? "text-white/70" : "text-muted-foreground")}>
        {size.label} · {styleLabel} · {FONT_BY_ID[settings.font].label} · {pal.name}
      </p>
    </div>
  );

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.poster}
      wideOutput
      output={
        <Card className="overflow-hidden">
          <CardContent className="space-y-5 p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Button className="h-11 rounded-full px-6" onClick={shuffle}>
                <DicesIcon /> Shuffle
              </Button>
              <Button variant="outline" className="h-11 rounded-full px-5" onClick={explore}>
                <LayoutGridIcon /> Explore 9
              </Button>
              <Button
                variant={motion ? "secondary" : "outline"}
                className="h-11 rounded-full px-5"
                onClick={() => {
                  setMotion((m) => !m);
                  setTime(0);
                }}
                aria-pressed={motion}
              >
                {motion ? <PauseIcon /> : <PlayIcon />} Motion
              </Button>
              <span className="text-muted-foreground hidden text-xs lg:inline">Space to shuffle</span>
              <span className="flex-1" />
              <div className="w-48">
                <Segmented label="View" value={view} options={[["flat", "Flat"], ["frame", "Framed"], ["street", "Street"]] as const} onChange={setView} />
              </div>
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <Grid3x3Icon className="size-3.5" />
                <Switch checked={showGrid} onCheckedChange={setShowGrid} aria-label="Show grid" />
              </label>
            </div>

            {variants ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Pick a direction</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={explore}>
                      <DicesIcon /> 9 more
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={() => setVariants(null)}>
                      <XIcon />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 rounded-xl bg-[radial-gradient(ellipse_at_50%_30%,#e9e9ec,#d4d4d8)] p-4 dark:bg-[radial-gradient(ellipse_at_50%_30%,#1c1c1f,#0b0b0c)]">
                  {variants.map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        apply(v);
                        setVariants(null);
                      }}
                      className="group/v transition-transform hover:-translate-y-1"
                      aria-label="Use this design"
                    >
                      <Markup
                        svg={posterToSvg(generate(fullContent, v, measureFor(v.font)), { uid: `v${i}` })}
                        className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full shadow-[0_14px_28px_-14px_rgb(0_0_0/0.5)] group-hover/v:ring-primary group-hover/v:ring-2"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              stage
            )}

            {history.length > 0 && hydrated && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">Earlier designs</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {history.map((h, i) => (
                    <button
                      key={`${h.layoutSeed}-${h.palette}-${h.font}-${i}`}
                      type="button"
                      onClick={() => apply(h)}
                      className="border-border/60 hover:border-primary w-14 shrink-0 overflow-hidden rounded-md border transition-colors"
                      aria-label="Restore this design"
                    >
                      <Markup svg={posterToSvg(generate(fullContent, h, measureFor(h.font)), { uid: `h${i}` })} className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void exportAs(size.print ? "pdf" : "png")} disabled={!!busy}>
                <DownloadIcon /> {size.print ? "Print PDF · 300 dpi" : `PNG ${size.px![0]}×${size.px![1]}`}
              </Button>
              {size.print && (
                <Button variant="outline" onClick={() => void exportAs("png")} disabled={!!busy}>
                  <DownloadIcon /> PNG
                </Button>
              )}
              <Button variant="outline" onClick={() => void exportAs("svg")} disabled={!!busy}>
                <DownloadIcon /> SVG
              </Button>
              <Button variant="outline" onClick={() => void exportAs("video")} disabled={!!busy}>
                <FilmIcon /> Motion video
              </Button>
              {busy && (
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {busy.kind === "video" ? `Recording the loop… ${Math.round(busy.progress * 100)}%` : "Rendering…"}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Words</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-title">Headline</Label>
              <Input id="p-title" value={content.title} maxLength={48} onChange={(e) => setContent((c) => ({ ...c, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-sub">Subtitle</Label>
              <Input id="p-sub" value={content.subtitle} maxLength={48} onChange={(e) => setContent((c) => ({ ...c, subtitle: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-details">Details</Label>
              <Textarea id="p-details" rows={3} value={content.details} onChange={(e) => setContent((c) => ({ ...c, details: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-number">Number</Label>
              <Input id="p-number" value={content.number} maxLength={4} onChange={(e) => setContent((c) => ({ ...c, number: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Typeface</CardTitle>
            <CardDescription>Each one measured exactly, so headlines fill their columns.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={(e) => void applyGoogleFont(e)} className="flex gap-2">
              <Input
                value={fontQuery}
                onChange={(e) => setFontQuery(e.target.value)}
                placeholder="Any Google Font, e.g. DM Serif Display"
                aria-label="Google Fonts family name"
                maxLength={60}
              />
              <Button type="submit" variant="outline" disabled={fontState.loading || !fontQuery.trim()}>
                {fontState.loading ? <LoaderCircleIcon className="animate-spin" /> : "Use"}
              </Button>
            </form>
            {fontState.error && <p className="text-destructive text-xs">{fontState.error}</p>}
            <div className="grid max-h-80 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
              {customLabel && (
                <button
                  type="button"
                  aria-pressed={settings.font === "custom"}
                  onClick={() => set("font", "custom")}
                  className={cn(
                    "col-span-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                    settings.font === "custom" ? "border-primary bg-primary/5" : "border-border/60 hover:border-foreground/25"
                  )}
                >
                  <span className="block truncate text-[22px] leading-tight" style={{ fontFamily: FONT_BY_ID.custom.family, fontWeight: FONT_BY_ID.custom.heavy }}>
                    Aa {customLabel}
                  </span>
                  <span className="text-muted-foreground block truncate text-[10px]">Your font, from Google Fonts</span>
                </button>
              )}
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={settings.font === f.id}
                  onClick={() => set("font", f.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-left transition-colors",
                    settings.font === f.id ? "border-primary bg-primary/5" : "border-border/60 hover:border-foreground/25"
                  )}
                >
                  <span className="block truncate text-[20px] leading-tight" style={{ fontFamily: f.family, fontWeight: f.heavy }}>
                    {f.caps ? "AA" : "Aa"} {f.caps ? "FORM" : "Form"}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium">{f.label}</span>
                  <span className="text-muted-foreground block truncate text-[10px]">{f.note}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Photo</CardTitle>
            <CardDescription>Printed in the poster&apos;s inks, the Swiss way.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {photo ? (
              <div className="flex items-center gap-3">
                {treated && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={treated.url} alt="" className="size-14 rounded-md object-cover" />
                )}
                <div className="flex flex-1 flex-col gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const p = paletteFromPhoto(photo);
                      setSettings((s) => ({ ...s, custom: { name: "From photo", ...p } }));
                    }}
                  >
                    <PaletteIcon /> Use its colours
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPhoto(null)}>
                    <XIcon /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <ImageDropzone
                onFile={async (file) => {
                  try {
                    setPhoto(await loadPhoto(file));
                    if (settings.style !== "auto" && !["circle", "orbit", "giant", "number", "strips"].includes(settings.style))
                      set("style", "strips");
                  } catch {
                    toast.error("That image couldn't be opened.");
                  }
                }}
                hint="Used in Photo strips, Circle, Orbit, Giant letter and Big number"
                className="min-h-28"
              />
            )}
            {photo && (
              <Segmented label="Treatment" value={treatment} options={TREATMENTS.map((t) => [t.id, t.label] as const)} onChange={setTreatment} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Keep when shuffling</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <LockToggle label="Layout" locked={locks.layout} onChange={() => setLocks((l) => ({ ...l, layout: !l.layout }))} />
            <LockToggle label="Colours" locked={locks.colours} onChange={() => setLocks((l) => ({ ...l, colours: !l.colours }))} />
            <LockToggle label="Type" locked={locks.type} onChange={() => setLocks((l) => ({ ...l, type: !l.type }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Design</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Composition</Label>
              <Select value={settings.style} onValueChange={(v) => set("style", v as PosterSettings["style"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Any (shuffle picks)</SelectItem>
                  {STYLES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Colours</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {PALETTES.map((p, i) => (
                  <button
                    key={p.name}
                    type="button"
                    title={p.name}
                    aria-label={p.name}
                    aria-pressed={!settings.custom && settings.palette === i}
                    onClick={() => setSettings((s) => ({ ...s, palette: i, custom: null }))}
                    className={cn(
                      "relative aspect-[3/4] overflow-hidden rounded-md border transition-shadow",
                      !settings.custom && settings.palette === i ? "ring-primary ring-offset-background ring-2 ring-offset-2" : "border-border/60"
                    )}
                    style={{ background: p.bg }}
                  >
                    <span className="absolute top-[14%] left-[18%] aspect-square w-[50%] rounded-full" style={{ background: p.accent }} />
                    <span className="absolute right-[15%] bottom-[14%] left-[15%] h-[12%]" style={{ background: p.ink }} />
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {(["bg", "ink", "accent", "accent2"] as const).map((key) => (
                  <label key={key} className="border-border/60 flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px]">
                    <span className="size-4 rounded" style={{ background: pal[key] }} />
                    {key === "bg" ? "Paper" : key === "ink" ? "Ink" : key === "accent" ? "Accent" : "Accent 2"}
                    <input
                      type="color"
                      className="sr-only"
                      value={pal[key]}
                      onChange={(e) => setSettings((s) => ({ ...s, custom: { ...paletteOf(s), name: "Custom", [key]: e.target.value } as Palette }))}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Letter case</Label>
              <Segmented label="Letter case" value={settings.caseMode} options={[["asis", "As typed"], ["upper", "UPPER"], ["lower", "lower"]] as const} onChange={(v) => set("caseMode", v)} />
            </div>

            {(
              [
                ["Columns", "columns", 4, 12, 1, (v: number) => `${v}`],
                ["Margin", "margin", 0.03, 0.12, 0.005, (v: number) => `${Math.round(v * 100)}%`],
                ["Headline size", "scale", 0.5, 1, 0.05, (v: number) => `${Math.round(v * 100)}%`],
              ] as const
            ).map(([label, key, min, max, step, fmt]) => (
              <div key={key} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label>{label}</Label>
                  <span className="text-muted-foreground font-mono text-xs tabular-nums">{fmt(settings[key])}</span>
                </div>
                <Slider value={[settings[key]]} min={min} max={max} step={step} onValueChange={([v]) => set(key, v)} aria-label={label} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Size</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={settings.size} onValueChange={(v) => set("size", v as SizeId)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SIZES) as SizeId[]).map((id) => (
                  <SelectItem key={id} value={id}>
                    {SIZES[id].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <p className="text-muted-foreground flex items-center gap-2 px-1 text-xs">
          <ImageIcon className="size-3.5" /> Every export embeds its fonts, so it prints exactly as shown.
        </p>
      </div>
    </GeneratorLayout>
  );
}
