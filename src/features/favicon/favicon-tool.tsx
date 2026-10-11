"use client";

import * as React from "react";
import {
  CheckCircle2Icon, DownloadIcon, ImageIcon, Loader2Icon, MoonIcon, SunIcon, TriangleAlertIcon, UploadIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  buildHtmlSnippet, buildIco, buildPackage, buildSvg, canvasToPngBytes, checkFavicon, DEFAULT_FAVICON, emojiTag,
  FONTS, frameworkGuides, ICO_SIZES, packageFiles, PNG_SIZES, renderIcon,
  type ArtKind, type FaviconCheck, type FaviconDesign, type FaviconSource,
} from "@/lib/favicon";
import { cn } from "@/lib/utils";
import { buildZip } from "@/lib/zip";

/** Rasters are shrunk to this on the way in; nothing in the package is larger than 512px. */
const MAX_SOURCE = 1024;

interface Shots {
  light: Record<number, string>;
  dark: Record<number, string>;
  apple: string;
  maskable: string;
}

const SHOT_SIZES = [16, 32, 48, 96, 128];
const EMOJI = ["🚀", "⚡", "🔥", "✨", "🎯", "💡", "🌱", "🍀", "🌊", "🌙", "☕", "🍕", "🎨", "🎧", "📚", "🛒", "💬", "🔒", "🧭", "🏠", "❤️", "⭐", "🦊", "🐙"];
const LOOKS: { name: string; a: string; b: string; ink: string }[] = [
  { name: "Emerald", a: "#10b981", b: "#0f766e", ink: "#ffffff" },
  { name: "Ink", a: "#1f2937", b: "#030712", ink: "#ffffff" },
  { name: "Ocean", a: "#38bdf8", b: "#2563eb", ink: "#ffffff" },
  { name: "Violet", a: "#a78bfa", b: "#6d28d9", ink: "#ffffff" },
  { name: "Sunset", a: "#fb923c", b: "#e11d48", ink: "#ffffff" },
  { name: "Lemon", a: "#fde047", b: "#f59e0b", ink: "#1c1917" },
  { name: "Paper", a: "#ffffff", b: "#e5e7eb", ink: "#111827" },
];
const SHAPES = [
  { label: "Square", value: 0 },
  { label: "Rounded", value: 22 },
  { label: "Squircle", value: 34 },
  { label: "Circle", value: 50 },
];

function save(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Reads an upload into something the renderer can draw quickly at any size. */
async function readSource(file: File): Promise<FaviconSource> {
  const svgText = file.type === "image/svg+xml" ? await file.text() : null;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const naturalW = img.naturalWidth || 512;
    const naturalH = img.naturalHeight || 512;
    // Vectors are redrawn large; photos are only ever shrunk.
    const scale = svgText ? MAX_SOURCE / Math.max(naturalW, naturalH) : Math.min(1, MAX_SOURCE / Math.max(naturalW, naturalH));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(naturalW * scale));
    canvas.height = Math.max(1, Math.round(naturalH * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { image: canvas, width: canvas.width, height: canvas.height, name: file.name, svgText };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function FaviconTool() {
  const [design, setDesign] = React.useState<FaviconDesign>(DEFAULT_FAVICON);
  const [source, setSource] = React.useState<FaviconSource | null>(null);
  const [shots, setShots] = React.useState<Shots | null>(null);
  const [checks, setChecks] = React.useState<FaviconCheck[]>([]);
  const [fontsReady, setFontsReady] = React.useState(0);
  const [building, setBuilding] = React.useState(false);
  const [onTab, setOnTab] = React.useState(false);
  const [pngSize, setPngSize] = React.useState("512");
  const fileInput = React.useRef<HTMLInputElement>(null);

  const set = <K extends keyof FaviconDesign>(key: K, value: FaviconDesign[K]) =>
    setDesign((current) => ({ ...current, [key]: value }));

  const ready = design.kind !== "image" || !!source;

  const loadFile = React.useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That file is not an image. Use PNG, SVG, JPG or WebP.");
      return;
    }
    readSource(file).then(
      (next) => {
        setSource(next);
        setDesign((current) => ({
          ...current,
          kind: "image",
          // A logo usually arrives with its own colours: start it clean rather than on the letter backdrop.
          ...(current.kind !== "image" ? { backdrop: "none" as const, radius: 0, padding: 0 } : {}),
        }));
      },
      () => toast.error("That image could not be read. Try exporting it again as PNG."),
    );
  }, []);

  // Paste a screenshot or a copied logo from anywhere on the page.
  React.useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find((entry) => entry.type.startsWith("image/"));
      if (file) loadFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile]);

  // Letters are drawn with the site's web fonts, which may land after the first paint.
  React.useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => alive && setFontsReady((count) => count + 1));
    return () => {
      alive = false;
    };
  }, []);

  // One pass renders every preview and the checks; the frame delay keeps sliders smooth.
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!ready) {
        setShots(null);
        setChecks([]);
        return;
      }
      const url = (size: number, variant = {}) => renderIcon(design, source, size, variant).toDataURL("image/png");
      setShots({
        light: Object.fromEntries(SHOT_SIZES.map((size) => [size, url(size)])),
        dark: Object.fromEntries([16, 32, 128].map((size) => [size, url(size, { dark: true })])),
        apple: url(128, { opaque: design.pageColor }),
        maskable: url(128, { maskable: true }),
      });
      setChecks(checkFavicon(design, source));
    });
    return () => cancelAnimationFrame(frame);
  }, [design, source, ready, fontsReady]);

  // "Try it on this tab": the real browser tab wears the icon until the switch goes off.
  React.useEffect(() => {
    if (!onTab || !shots) return;
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    link.href = shots.light[32];
    link.dataset.faviconPreview = "true";
    const hidden = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
    hidden.forEach((entry) => entry.remove());
    document.head.appendChild(link);
    return () => {
      link.remove();
      hidden.forEach((entry) => document.head.appendChild(entry));
    };
  }, [onTab, shots]);

  const svg = React.useMemo(() => (ready ? buildSvg(design, source) : null), [design, source, ready]);
  const guides = frameworkGuides(design, !!svg);
  const files = packageFiles(design, source);
  const oneTag = emojiTag(design);
  const title = design.appName.trim() || "My App";

  const downloadPackage = async () => {
    if (!ready) return;
    setBuilding(true);
    try {
      save(buildZip(await buildPackage(design, source)), "favicon-package.zip");
      toast.success("Package downloaded. The steps are below.");
    } catch {
      toast.error("The package could not be built. Try a different image.");
    } finally {
      setBuilding(false);
    }
  };

  const downloadIco = async () => {
    const images = await Promise.all(ICO_SIZES.map(async (size) => ({ size, png: await canvasToPngBytes(renderIcon(design, source, size)) })));
    save(new Blob([buildIco(images)], { type: "image/x-icon" }), "favicon.ico");
  };

  const downloadPng = async () => {
    const size = Number(pngSize);
    save(new Blob([await canvasToPngBytes(renderIcon(design, source, size))], { type: "image/png" }), `icon-${size}x${size}.png`);
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.favicon}
      output={
        <Card>
          <CardContent className="space-y-5">
            {shots ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Stage label="Light theme" icon={SunIcon} large={shots.light[128]} small={shots.light[16]} className="bg-white text-neutral-500" />
                  <Stage label="Dark theme" icon={MoonIcon} large={shots.dark[128]} small={shots.dark[16]} className="bg-[#202124] text-neutral-400" />
                </div>

                <div className="space-y-2">
                  <BrowserBar icon={shots.light[16]} title={title} />
                  <BrowserBar icon={shots.dark[16]} title={title} dark />
                </div>

                <div className="border-border rounded-lg border bg-white p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-neutral-200 bg-neutral-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={shots.light[32]} alt="" className="size-[18px]" />
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-[13px] text-neutral-800">{title}</span>
                      <span className="block truncate text-[11px] text-neutral-500">https://example.com</span>
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-[15px] text-[#1a0dab]">{title}: the page a search engine lists</p>
                </div>

                <div className="bg-muted/50 flex items-end justify-around rounded-lg px-3 py-4">
                  <PhoneIcon src={shots.apple} label="iPhone" className="rounded-[22%]" title={design.shortName.trim() || title} />
                  <PhoneIcon src={shots.maskable} label="Android" className="rounded-full" title={design.shortName.trim() || title} />
                  <div className="flex items-end gap-2.5">
                    {[16, 32, 48].map((size) => (
                      <figure key={size} className="flex flex-col items-center gap-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={shots.light[size]} alt="" style={{ width: size, height: size }} />
                        <figcaption className="text-muted-foreground font-mono text-[10px]">{size}</figcaption>
                      </figure>
                    ))}
                  </div>
                </div>

                <ul className="space-y-2">
                  {checks.map((check) => (
                    <li key={check.title} className="flex gap-2 text-xs leading-5">
                      {check.level === "good" ? (
                        <CheckCircle2Icon className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden />
                      ) : (
                        <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden />
                      )}
                      <span>
                        <span className="font-medium">{check.title}.</span>{" "}
                        <span className="text-muted-foreground">{check.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="text-muted-foreground border-border hover:bg-muted/40 flex min-h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm transition-colors"
              >
                <UploadIcon className="size-5" aria-hidden />
                Upload an image to see it everywhere it will appear
              </button>
            )}

            <div className="space-y-2">
              <Button type="button" size="lg" className="w-full" disabled={!ready || building} onClick={downloadPackage}>
                {building ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
                Download the full package
              </Button>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button type="button" variant="outline" size="sm" disabled={!ready} onClick={() => void downloadIco()}>.ico</Button>
                {svg && (
                  <Button type="button" variant="outline" size="sm" onClick={() => save(new Blob([svg], { type: "image/svg+xml" }), "favicon.svg")}>
                    .svg
                  </Button>
                )}
                <div className="flex items-center">
                  <Select value={pngSize} onValueChange={setPngSize}>
                    <SelectTrigger size="sm" className="rounded-r-none border-r-0 text-xs" aria-label="PNG size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PNG_SIZES.map((size) => (
                        <SelectItem key={size} value={String(size)}>{size}px</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" className="rounded-l-none" disabled={!ready} onClick={() => void downloadPng()}>
                    .png
                  </Button>
                </div>
                <CopyButton
                  text={buildHtmlSnippet(design, !!svg)}
                  label="Tags"
                  variant="outline"
                  size="sm"
                  successMessage="HTML tags copied"
                />
              </div>
            </div>

            <label className="border-border flex items-center justify-between gap-3 border-t pt-4 text-xs">
              <span>
                <span className="font-medium">Try it on this tab</span>
                <span className="text-muted-foreground block">Look up: your browser tab wears the icon.</span>
              </span>
              <Switch checked={onTab} disabled={!ready} onCheckedChange={setOnTab} aria-label="Show the icon on this browser tab" />
            </label>
          </CardContent>
        </Card>
      }
      footer={
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Install it</CardTitle>
              <CardDescription>Pick your stack for the exact steps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Tabs defaultValue="html">
                <TabsList className="flex-wrap">
                  {guides.map((guide) => (
                    <TabsTrigger key={guide.id} value={guide.id}>{guide.name}</TabsTrigger>
                  ))}
                </TabsList>
                {guides.map((guide) => (
                  <TabsContent key={guide.id} value={guide.id} className="space-y-3 pt-4">
                    <ol className="space-y-2 text-sm">
                      {guide.steps.map((step, index) => (
                        <li key={step} className="text-muted-foreground flex gap-2">
                          <span className="text-foreground/40 font-mono text-xs leading-5">{index + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                    <Snippet code={guide.code} name={guide.name} />
                  </TabsContent>
                ))}
              </Tabs>

              {oneTag && (
                <div className="border-border space-y-2 border-t pt-4">
                  <p className="text-sm font-medium">Or skip the files</p>
                  <p className="text-muted-foreground text-xs leading-5">
                    A bare emoji fits in one tag. No downloads and nothing to upload, though phones and old browsers fall back to no icon.
                  </p>
                  <Snippet code={oneTag} name="Emoji tag" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">What is in the package</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-border divide-y text-sm">
                {files.map((file) => (
                  <li key={file.name} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-4">
                    <code className="w-64 shrink-0 font-mono text-xs">{file.name}</code>
                    <span className="text-muted-foreground text-xs">{file.role}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      }
    >
      <div className="space-y-6">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            loadFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Artwork</CardTitle>
            <CardDescription>Start from your logo, or make an icon from letters or an emoji.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Segmented
              label="Artwork type"
              value={design.kind}
              onChange={(kind) => set("kind", kind as ArtKind)}
              options={[{ value: "text", label: "Letters" }, { value: "emoji", label: "Emoji" }, { value: "image", label: "Image" }]}
            />

            {design.kind === "image" && (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInput.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") fileInput.current?.click();
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    loadFile(event.dataTransfer.files?.[0]);
                  }}
                  className="border-border hover:bg-muted/40 flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed p-6 text-center transition-colors"
                >
                  {source ? <ImageIcon className="text-muted-foreground size-5" aria-hidden /> : <UploadIcon className="text-muted-foreground size-5" aria-hidden />}
                  <span className="text-sm font-medium">{source ? source.name : "Upload, drop or paste an image"}</span>
                  <span className="text-muted-foreground text-xs">
                    {source ? `${source.svgText ? "Vector" : `${source.width}×${source.height}`} · click to replace` : "PNG, SVG, JPG or WebP. Square, 512px or larger is ideal"}
                  </span>
                </div>
                <Segmented
                  label="How the image sits in the icon"
                  value={design.fit}
                  onChange={(fit) => set("fit", fit as FaviconDesign["fit"])}
                  options={[{ value: "contain", label: "Fit inside" }, { value: "cover", label: "Fill the shape" }]}
                />
              </>
            )}

            {design.kind === "text" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Letters" htmlFor="fav-text" hint="One or two read best at tab size.">
                  <Input
                    id="fav-text"
                    value={design.text}
                    onChange={(event) => set("text", [...event.target.value].slice(0, 3).join(""))}
                    className="font-heading text-lg font-semibold"
                  />
                </Field>
                <ColorField id="fav-ink" label="Letter colour" value={design.textColor} onChange={(value) => set("textColor", value)} />
                <div className="space-y-1.5">
                  <Label>Typeface</Label>
                  <Segmented label="Typeface" value={design.font} onChange={(font) => set("font", font as FaviconDesign["font"])} options={FONTS.map((font) => ({ value: font.id, label: font.name }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Weight</Label>
                  <Segmented
                    label="Weight"
                    value={String(design.weight)}
                    onChange={(weight) => set("weight", Number(weight) as FaviconDesign["weight"])}
                    options={[{ value: "500", label: "Medium" }, { value: "700", label: "Bold" }, { value: "900", label: "Black" }]}
                  />
                </div>
              </div>
            )}

            {design.kind === "emoji" && (
              <div className="space-y-3">
                <Field label="Emoji" htmlFor="fav-emoji" hint="Pick one below or paste any emoji.">
                  <Input
                    id="fav-emoji"
                    value={design.emoji}
                    onChange={(event) => set("emoji", event.target.value.slice(0, 12))}
                    className="w-24 text-center text-xl"
                  />
                </Field>
                <div className="flex flex-wrap gap-1">
                  {EMOJI.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => set("emoji", emoji)}
                      aria-label={`Use ${emoji}`}
                      aria-pressed={design.emoji === emoji}
                      className={cn(
                        "hover:bg-muted grid size-9 place-items-center rounded-lg border text-lg transition-colors",
                        design.emoji === emoji ? "border-primary bg-primary/10" : "border-transparent",
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shape and backdrop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Backdrop</Label>
              <Segmented
                label="Backdrop"
                value={design.backdrop}
                onChange={(backdrop) => set("backdrop", backdrop as FaviconDesign["backdrop"])}
                options={[{ value: "none", label: "None" }, { value: "solid", label: "Solid" }, { value: "gradient", label: "Gradient" }]}
              />
            </div>

            {design.backdrop !== "none" && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {LOOKS.map((look) => (
                    <button
                      key={look.name}
                      type="button"
                      title={look.name}
                      aria-label={`${look.name} colours`}
                      onClick={() => setDesign((current) => ({ ...current, bgColor: look.a, bgColor2: look.b, textColor: look.ink }))}
                      className="border-border size-8 rounded-lg border transition-transform hover:scale-110"
                      style={{ background: `linear-gradient(135deg, ${look.a}, ${look.b})` }}
                    />
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField id="fav-bg" label={design.backdrop === "gradient" ? "From" : "Colour"} value={design.bgColor} onChange={(value) => set("bgColor", value)} />
                  {design.backdrop === "gradient" && (
                    <ColorField id="fav-bg2" label="To" value={design.bgColor2} onChange={(value) => set("bgColor2", value)} />
                  )}
                </div>
                {design.backdrop === "gradient" && (
                  <Range label="Direction" value={design.bgAngle} min={0} max={360} step={5} unit="°" onChange={(value) => set("bgAngle", value)} />
                )}
              </>
            )}

            <div className="space-y-2">
              <Label>Shape</Label>
              <Segmented
                label="Shape"
                value={SHAPES.some((shape) => shape.value === design.radius) ? String(design.radius) : ""}
                onChange={(radius) => set("radius", Number(radius))}
                options={SHAPES.map((shape) => ({ value: String(shape.value), label: shape.label }))}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Range label="Corner radius" value={design.radius} min={0} max={50} unit="%" onChange={(value) => set("radius", value)} />
              <Range label="Padding" value={design.padding} min={0} max={40} unit="%" onChange={(value) => set("padding", value)} />
              <Range label="Move up or down" value={design.offsetY} min={-20} max={20} unit="%" onChange={(value) => set("offsetY", value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dark browser themes</CardTitle>
            <CardDescription>Chrome, Edge and Firefox can swap the icon when the browser is dark. Safari keeps the regular one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Segmented
              label="Dark theme icon"
              value={design.dark}
              onChange={(dark) => set("dark", dark as FaviconDesign["dark"])}
              options={[{ value: "same", label: "Same icon" }, { value: "invert", label: "Inverted" }, { value: "custom", label: "Own colours" }]}
            />
            {design.dark === "custom" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField id="fav-dark-bg" label="Backdrop" value={design.darkBg} onChange={(value) => set("darkBg", value)} />
                {design.kind === "text" && (
                  <ColorField id="fav-dark-ink" label="Letter colour" value={design.darkText} onChange={(value) => set("darkText", value)} />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Site details</CardTitle>
            <CardDescription>Written into the manifest and the tags.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Site name" htmlFor="fav-name">
              <Input id="fav-name" value={design.appName} placeholder="My App" onChange={(event) => set("appName", event.target.value)} />
            </Field>
            <Field label="Short name" htmlFor="fav-short" optional hint="Shown under the home-screen icon. About 12 characters.">
              <Input id="fav-short" value={design.shortName} placeholder={title} maxLength={24} onChange={(event) => set("shortName", event.target.value)} />
            </Field>
            <ColorField id="fav-theme" label="Theme colour" hint="Tints the browser bar on phones." value={design.themeColor} onChange={(value) => set("themeColor", value)} />
            <ColorField id="fav-page" label="Background colour" hint="Splash screen, and behind phone icons." value={design.pageColor} onChange={(value) => set("pageColor", value)} />
            <Field label="Folder on your site" htmlFor="fav-path" hint="Where the files will live. Leave as / for the site root.">
              <Input id="fav-path" value={design.path} placeholder="/" onChange={(event) => set("path", event.target.value)} className="font-mono" />
            </Field>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

/* ------------------------------------------------------------------- parts */

function Segmented({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-muted/60 flex w-full gap-0.5 rounded-lg p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs transition-colors",
            value === option.value ? "bg-background text-foreground font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

function ColorField({ id, label, hint, value, onChange }: { id: string; label: string; hint?: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = React.useState<string | null>(null);
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={HEX.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} picker`}
          className="border-border size-9 shrink-0 cursor-pointer rounded border bg-transparent"
        />
        <Input
          id={id}
          value={draft ?? value}
          spellCheck={false}
          // Half-typed colours stay in the box; the icon only changes once the value is a real one.
          onChange={(event) => {
            const next = event.target.value.trim();
            setDraft(next);
            if (HEX.test(next)) onChange(next.toLowerCase());
          }}
          onBlur={() => setDraft(null)}
          className="font-mono"
        />
      </div>
    </Field>
  );
}

function Range({
  label, value, min, max, step = 1, unit, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{value}{unit}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next)} aria-label={label} />
    </div>
  );
}

/** The icon large, beside the 16px render blown up so every pixel a tab shows is visible. */
function Stage({ label, icon: Icon, large, small, className }: { label: string; icon: typeof SunIcon; large: string; small: string; className: string }) {
  return (
    <figure className={cn("border-border flex flex-col gap-3 rounded-lg border p-3", className)}>
      <figcaption className="flex items-center gap-1.5 text-[11px]">
        <Icon className="size-3" aria-hidden />
        {label}
      </figcaption>
      <div className="flex items-end justify-center gap-3 pb-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={large} alt={`Icon on a ${label.toLowerCase()}`} className="size-20" />
        <span className="flex flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={small} alt="" className="size-12 [image-rendering:pixelated]" />
          <span className="font-mono text-[9px]">16px ×3</span>
        </span>
      </div>
    </figure>
  );
}

function BrowserBar({ icon, title, dark }: { icon: string; title: string; dark?: boolean }) {
  return (
    <div className={cn("flex items-end gap-1 overflow-hidden rounded-lg px-2 pt-2", dark ? "bg-[#202124]" : "bg-[#dee1e6]")} aria-hidden>
      <div className={cn("flex min-w-0 max-w-52 flex-1 items-center gap-2 rounded-t-lg px-3 py-2", dark ? "bg-[#35363a] text-neutral-100" : "bg-white text-neutral-800")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" className="size-4 shrink-0" />
        <span className="truncate text-xs">{title}</span>
        <span className="ml-auto text-xs opacity-50">×</span>
      </div>
      <div className={cn("flex min-w-0 max-w-40 flex-1 items-center gap-2 px-3 py-2 text-xs", dark ? "text-neutral-400" : "text-neutral-600")}>
        <span className={cn("size-4 shrink-0 rounded-full", dark ? "bg-neutral-600" : "bg-neutral-400")} />
        <span className="truncate">Another tab</span>
      </div>
    </div>
  );
}

function PhoneIcon({ src, label, title, className }: { src: string; label: string; title: string; className: string }) {
  return (
    <figure className="flex w-16 flex-col items-center gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${label} home screen icon`} className={cn("size-12 shadow-sm", className)} />
      <span className="w-full truncate text-center text-[10px] leading-3">{title}</span>
      <figcaption className="text-muted-foreground font-mono text-[10px]">{label}</figcaption>
    </figure>
  );
}

function Snippet({ code, name }: { code: string; name: string }) {
  return (
    <div className="relative">
      <pre className="bg-muted/50 border-border max-h-64 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
        {code}
      </pre>
      <CopyButton
        text={code}
        label=""
        variant="ghost"
        size="icon-sm"
        className="absolute top-1.5 right-1.5"
        successMessage={`${name} copied`}
        aria-label={`Copy ${name}`}
      />
    </div>
  );
}
