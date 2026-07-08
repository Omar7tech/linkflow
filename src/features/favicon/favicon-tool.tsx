"use client";

import * as React from "react";
import { DownloadIcon, ImageIcon, Loader2Icon, ShieldCheckIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  buildHtmlSnippet,
  buildIco,
  buildManifest,
  canvasToPngBytes,
  DEFAULT_FAVICON,
  frameworkGuides,
  ICO_SIZES,
  PNG_OUTPUTS,
  PREVIEW_SIZES,
  renderIcon,
  type FaviconOptions,
} from "@/lib/favicon";
import { cn } from "@/lib/utils";

interface SourceImage {
  el: HTMLImageElement;
  width: number;
  height: number;
  name: string;
  url: string;
  svgText: string | null;
}

export function FaviconTool() {
  const [opts, setOpts] = React.useState<FaviconOptions>(DEFAULT_FAVICON);
  const [source, setSource] = React.useState<SourceImage | null>(null);
  const [building, setBuilding] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const previewRefs = React.useRef<Record<number, HTMLCanvasElement | null>>({});

  const set = <K extends keyof FaviconOptions>(key: K, value: FaviconOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  const loadFile = React.useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file (PNG, SVG, JPG…)");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    const isSvg = file.type === "image/svg+xml";
    const finish = (svgText: string | null) => {
      img.onload = () => {
        setSource((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return {
            el: img,
            width: img.naturalWidth || 512,
            height: img.naturalHeight || 512,
            name: file.name,
            url,
            svgText,
          };
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error("Couldn't read that image");
      };
      img.src = url;
    };
    if (isSvg) {
      file.text().then((t) => finish(t));
    } else {
      finish(null);
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source.url);
    };
  }, [source]);

  // Redraw the preview tiles whenever the source or options change.
  React.useEffect(() => {
    if (!source) return;
    for (const size of PREVIEW_SIZES) {
      const target = previewRefs.current[size];
      if (!target) continue;
      const rendered = renderIcon(source.el, source.width, source.height, size, opts);
      const ctx = target.getContext("2d");
      if (ctx) {
        target.width = size;
        target.height = size;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(rendered, 0, 0);
      }
    }
  }, [source, opts]);

  const hasSvg = source?.svgText != null;
  const guides = frameworkGuides(opts, hasSvg);

  const downloadPackage = async () => {
    if (!source) return;
    setBuilding(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Standalone PNGs.
      for (const out of PNG_OUTPUTS) {
        const canvas = renderIcon(source.el, source.width, source.height, out.size, opts);
        zip.file(out.name, await canvasToPngBytes(canvas));
      }

      // Multi-resolution favicon.ico.
      const icoImages = await Promise.all(
        ICO_SIZES.map(async (size) => ({
          size,
          png: await canvasToPngBytes(renderIcon(source.el, source.width, source.height, size, opts)),
        }))
      );
      zip.file("favicon.ico", buildIco(icoImages));

      // Pass through the original SVG when supplied.
      if (source.svgText) zip.file("favicon.svg", source.svgText);

      zip.file("site.webmanifest", buildManifest(opts));
      zip.file(
        "README.txt",
        [
          "Forma favicon package",
          "",
          "1. Copy these files to the root of your site (or see the framework steps in the app).",
          "2. Add the following to your <head>:",
          "",
          buildHtmlSnippet(opts, hasSvg),
        ].join("\n")
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "favicon-package.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Favicon package downloaded");
    } catch {
      toast.error("Couldn't build the package — try a different image");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.favicon}
      output={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>
              {source ? "How your icon renders at each size." : "Upload an image to preview it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {source ? (
              <>
                {/* Browser-tab mockup */}
                <div className="border-border overflow-hidden rounded-lg border">
                  <div className="bg-muted flex items-center gap-2 px-3 py-2">
                    <div className="bg-background flex min-w-0 max-w-56 items-center gap-1.5 rounded-t-md px-2.5 py-1.5">
                      <canvas
                        ref={(el) => {
                          previewRefs.current[16] = el;
                        }}
                        width={16}
                        height={16}
                        className="size-4 shrink-0"
                      />
                      <span className="text-foreground/80 truncate text-xs">{opts.appName || "My App"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-4">
                  {PREVIEW_SIZES.filter((s) => s !== 16).map((size) => (
                    <div key={size} className="flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          "border-border flex items-center justify-center rounded-lg border p-1",
                          opts.background === "transparent" && "bg-[repeating-conic-gradient(#e2e8f0_0_25%,transparent_0_50%)] bg-[length:12px_12px]"
                        )}
                      >
                        <canvas
                          ref={(el) => {
                            previewRefs.current[size] = el;
                          }}
                          width={size}
                          height={size}
                          style={{ width: size, height: size }}
                        />
                      </div>
                      <span className="text-muted-foreground font-mono text-[10px]">{size}px</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground border-border flex min-h-32 items-center justify-center rounded-lg border border-dashed text-sm">
                No image yet
              </div>
            )}

            <Button type="button" className="w-full" disabled={!source || building} onClick={downloadPackage}>
              {building ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
              Download package (ZIP)
            </Button>

            <Separator />
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Your image stays private — it&apos;s never stored anywhere.
            </p>
          </CardContent>
        </Card>
      }
      footer={
        source && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Install it</CardTitle>
              <CardDescription>Pick your stack for exact steps, or grab the raw tags.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="html">
                <TabsList className="flex-wrap">
                  {guides.map((g) => (
                    <TabsTrigger key={g.id} value={g.id}>
                      {g.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {guides.map((g) => (
                  <TabsContent key={g.id} value={g.id} className="space-y-3 pt-4">
                    <ol className="space-y-2 text-sm">
                      {g.steps.map((step, i) => (
                        <li key={i} className="text-muted-foreground flex gap-2">
                          <span className="text-foreground/40 font-mono text-xs">{i + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                    <div className="relative">
                      <pre className="bg-muted/50 border-border max-h-60 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                        {g.code}
                      </pre>
                      <CopyButton
                        text={g.code}
                        label=""
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1.5 right-1.5"
                        successMessage={`${g.name} snippet copied`}
                        aria-label={`Copy ${g.name} snippet`}
                      />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        )
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source image</CardTitle>
            <CardDescription>Square works best — 512×512 or larger. SVG is passed through too.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFile(file);
                e.target.value = "";
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) loadFile(file);
              }}
              className="border-border hover:bg-muted/40 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors"
            >
              {source ? (
                <>
                  <ImageIcon className="text-muted-foreground size-5" aria-hidden />
                  <span className="text-sm font-medium">{source.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {source.width}×{source.height} · click to replace
                  </span>
                </>
              ) : (
                <>
                  <UploadIcon className="text-muted-foreground size-5" aria-hidden />
                  <span className="text-sm font-medium">Upload or drop an image</span>
                  <span className="text-muted-foreground text-xs">PNG, SVG, JPG or WebP</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="App name" htmlFor="fav-name" hint="Used in the manifest and Apple title.">
                <Input
                  id="fav-name"
                  value={opts.appName}
                  onChange={(e) => set("appName", e.target.value)}
                  placeholder="My App"
                />
              </Field>
              <div className="space-y-1.5">
                <Label htmlFor="fav-theme">Theme color</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="fav-theme"
                    type="color"
                    value={opts.themeColor}
                    onChange={(e) => set("themeColor", e.target.value)}
                    className="border-border size-9 shrink-0 cursor-pointer rounded border bg-transparent"
                  />
                  <Input
                    value={opts.themeColor}
                    onChange={(e) => set("themeColor", e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Background</Label>
                <label className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Switch
                    checked={opts.background === "transparent"}
                    onCheckedChange={(v) => set("background", v ? "transparent" : "#ffffff")}
                    aria-label="Transparent background"
                  />
                  Transparent
                </label>
              </div>
              {opts.background !== "transparent" && (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={opts.background}
                    onChange={(e) => set("background", e.target.value)}
                    aria-label="Background color"
                    className="border-border size-9 shrink-0 cursor-pointer rounded border bg-transparent"
                  />
                  <Input
                    value={opts.background}
                    onChange={(e) => set("background", e.target.value)}
                    className="font-mono"
                  />
                </div>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Padding</Label>
                  <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{opts.padding}%</span>
                </div>
                <Slider
                  value={[opts.padding]}
                  min={0}
                  max={40}
                  step={1}
                  onValueChange={([v]) => set("padding", v)}
                  aria-label="Padding"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Corner radius</Label>
                  <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{opts.radius}%</span>
                </div>
                <Slider
                  value={[opts.radius]}
                  min={0}
                  max={50}
                  step={1}
                  onValueChange={([v]) => set("radius", v)}
                  aria-label="Corner radius"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}
