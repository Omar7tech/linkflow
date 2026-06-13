"use client";

import * as React from "react";
import {
  BarcodeIcon,
  DownloadIcon,
  LayersIcon,
  PaletteIcon,
  ScanLineIcon,
  SparklesIcon,
  TriangleAlertIcon,
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
import { Field } from "@/components/shared/field";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import {
  BARCODE_FORMATS,
  DEFAULT_BARCODE_OPTIONS,
  FORMAT_BY_ID,
  detectFormat,
  renderToPng,
  renderToSvg,
  safeName,
  zipBarcodes,
  type BarcodeFormat,
  type BarcodeOptions,
} from "@/lib/barcode";
import { dataUrlToBlob, downloadDataUrl, downloadText } from "@/lib/qr";
import { cn } from "@/lib/utils";

const MAX_BATCH_PREVIEW = 8;

export function BarcodeTool() {
  const history = useHistory("barcode");
  const [tab, setTab] = React.useState<"single" | "batch">("single");
  const [options, setOptions] = React.useState<BarcodeOptions>(DEFAULT_BARCODE_OPTIONS);
  const set = <K extends keyof BarcodeOptions>(key: K, value: BarcodeOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  /* ------------------------------- Single -------------------------------- */
  const [value, setValue] = React.useState("FORMA-2026");
  const [auto, setAuto] = React.useState(true);
  const [preview, setPreview] = React.useState<{ svg: string | null; error: string | null }>({
    svg: null,
    error: null,
  });

  // While auto-detect is on the format is derived, not stored — no effect,
  // no cascading renders. Everything downstream uses `liveOptions`.
  const format = auto ? detectFormat(value) : options.format;
  const liveOptions = React.useMemo<BarcodeOptions>(
    () => ({ ...options, format }),
    [options, format]
  );
  const meta = FORMAT_BY_ID[format];

  // Debounced live render of the single barcode.
  React.useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      renderToSvg(value, liveOptions).then((res) => {
        if (!cancelled) setPreview(res);
      });
    }, 140);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [value, liveOptions]);

  const pickFormat = (f: BarcodeFormat) => {
    setAuto(false);
    set("format", f);
  };

  // Turning auto-detect off freezes the currently detected format.
  const toggleAuto = (on: boolean) => {
    if (!on) set("format", detectFormat(value));
    setAuto(on);
  };

  const commit = () => {
    if (value.trim()) history.add(`${meta.name} · ${value.trim()}`, value.trim());
  };

  const downloadPng = async () => {
    const { dataUrl, error } = await renderToPng(value, liveOptions, 3);
    if (!dataUrl) return toast.error(error ?? "Nothing to export");
    downloadDataUrl(dataUrl, `${safeName(value)}.png`);
    commit();
  };

  const downloadSvg = () => {
    if (!preview.svg) return toast.error(preview.error ?? "Nothing to export");
    downloadText(preview.svg, `${safeName(value)}.svg`, "image/svg+xml");
    commit();
  };

  const copyPng = async () => {
    try {
      const { dataUrl } = await renderToPng(value, liveOptions, 3);
      if (!dataUrl) throw new Error();
      const blob = await dataUrlToBlob(dataUrl);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Barcode image copied");
      commit();
    } catch {
      toast.error("Your browser blocked image copy — download instead");
    }
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.barcode}
      output={
        tab === "single" ? (
          <Card aria-live="polite">
            <CardHeader>
              <CardTitle className="text-base">Live preview</CardTitle>
              <CardDescription>
                {preview.svg
                  ? "Scan to test, then download as vector SVG or high-res PNG."
                  : preview.error ?? "Your barcode renders here as you type."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <BarcodeStage svg={preview.svg} error={preview.error} transparent={options.transparent} />
              {preview.svg && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={downloadPng}>
                      <DownloadIcon /> PNG
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={downloadSvg}>
                      <DownloadIcon /> SVG
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={copyPng}>
                      Copy image
                    </Button>
                    <CopyButton
                      text={preview.svg}
                      label="Copy SVG"
                      variant="outline"
                      size="sm"
                      successMessage="SVG markup copied"
                      onCopied={commit}
                    />
                  </div>
                  <div className="bg-muted/50 border-border text-muted-foreground flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                    <span className="font-medium">{meta.name}</span>
                    <code className="max-w-[60%] truncate font-mono">{value.trim()}</code>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <BatchPanel options={options} onCommit={commit} />
        )
      }
      footer={<HistoryPanel history={history} />}
    >
      <div className="space-y-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "single" | "batch")}>
          <TabsList className="w-full">
            <TabsTrigger value="single" className="flex-1">
              <ScanLineIcon className="size-3.5" /> Single
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex-1">
              <LayersIcon className="size-3.5" /> Batch
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Content</CardTitle>
                <CardDescription>Type your data — the right symbology is chosen for you.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field
                  label="Value"
                  htmlFor="bc-value"
                  error={preview.error ?? undefined}
                  hint={!preview.error ? meta.hint : undefined}
                >
                  <Input
                    id="bc-value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={meta.sample}
                    className="font-mono"
                  />
                </Field>

                <div className="bg-muted/40 border-border flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="text-primary size-4" />
                    <div>
                      <p className="text-sm font-medium">Auto-detect format</p>
                      <p className="text-muted-foreground text-xs">
                        {auto ? (
                          <>
                            Detected <span className="text-foreground font-medium">{meta.name}</span>
                          </>
                        ) : (
                          "Off — choose a format below"
                        )}
                      </p>
                    </div>
                  </div>
                  <Switch checked={auto} onCheckedChange={toggleAuto} aria-label="Auto-detect format" />
                </div>

                <Field label="Format" htmlFor="bc-format">
                  <Select value={format} onValueChange={(v) => pickFormat(v as BarcodeFormat)}>
                    <SelectTrigger id="bc-format" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BARCODE_FORMATS.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </CardContent>
            </Card>

            <DesignCard options={options} set={set} />
          </TabsContent>

          <TabsContent value="batch" className="mt-6 space-y-6">
            <BatchInput options={options} set={set} />
            <DesignCard options={options} set={set} />
          </TabsContent>
        </Tabs>
      </div>
    </GeneratorLayout>
  );
}

/* ------------------------------ Subviews -------------------------------- */

function DesignCard({
  options,
  set,
}: {
  options: BarcodeOptions;
  set: <K extends keyof BarcodeOptions>(key: K, value: BarcodeOptions[K]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PaletteIcon className="text-primary size-4" />
          Design
        </CardTitle>
        <CardDescription>Colors, density and the human-readable line.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <ColorField
            label="Bars"
            id="bc-fg"
            value={options.lineColor}
            onChange={(v) => set("lineColor", v)}
          />
          <ColorField
            label="Background"
            id="bc-bg"
            value={options.background}
            onChange={(v) => set("background", v)}
            disabled={options.transparent}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <Switch
            checked={options.transparent}
            onCheckedChange={(v) => set("transparent", v)}
            aria-label="Transparent background"
          />
          <span className="text-sm">Transparent background</span>
        </label>

        <SliderRow label="Bar width" value={options.width} unit="px" min={1} max={4} step={0.5} onChange={(v) => set("width", v)} />
        <SliderRow label="Height" value={options.height} unit="px" min={40} max={180} step={5} onChange={(v) => set("height", v)} />
        <SliderRow label="Quiet zone" value={options.margin} unit="px" min={0} max={40} step={2} onChange={(v) => set("margin", v)} />

        <label className="flex cursor-pointer items-center gap-2.5">
          <Switch
            checked={options.displayValue}
            onCheckedChange={(v) => set("displayValue", v)}
            aria-label="Show text under barcode"
          />
          <span className="text-sm">Show text under barcode</span>
        </label>
        {options.displayValue && (
          <SliderRow label="Text size" value={options.fontSize} unit="px" min={10} max={28} step={1} onChange={(v) => set("fontSize", v)} />
        )}
      </CardContent>
    </Card>
  );
}

function BatchInput({
  options,
  set,
}: {
  options: BarcodeOptions;
  set: <K extends keyof BarcodeOptions>(key: K, value: BarcodeOptions[K]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Batch content</CardTitle>
        <CardDescription>One value per line — generate them all and download a ZIP.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Field label="Format" htmlFor="bc-batch-format" hint={FORMAT_BY_ID[options.format].hint}>
          <Select value={options.format} onValueChange={(v) => set("format", v as BarcodeFormat)}>
            <SelectTrigger id="bc-batch-format" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BARCODE_FORMATS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Card>
  );
}

function BatchPanel({ options, onCommit }: { options: BarcodeOptions; onCommit: () => void }) {
  const [text, setText] = React.useState("");
  const [kind, setKind] = React.useState<"png" | "svg">("png");
  const [busy, setBusy] = React.useState(false);

  const values = React.useMemo(
    () => text.split("\n").map((l) => l.trim()).filter(Boolean),
    [text]
  );

  // Live thumbnails for the first few values so the design is obvious.
  const [previews, setPreviews] = React.useState<{ value: string; svg: string | null }[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      const slice = values.slice(0, MAX_BATCH_PREVIEW);
      const out = await Promise.all(
        slice.map(async (value) => ({ value, svg: (await renderToSvg(value, options)).svg }))
      );
      if (!cancelled) setPreviews(out);
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [values, options]);

  const download = async () => {
    if (!values.length) return;
    setBusy(true);
    try {
      const { url, generated, skipped } = await zipBarcodes(values, options, kind);
      if (!url) {
        toast.error("None of those values are valid for this format");
        return;
      }
      downloadDataUrl(url, `barcodes-${kind}-${generated}.zip`);
      URL.revokeObjectURL(url);
      onCommit();
      toast.success(
        `Zipped ${generated} barcode${generated === 1 ? "" : "s"}` +
          (skipped.length ? ` · skipped ${skipped.length} invalid` : "")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Batch</CardTitle>
        <CardDescription>
          {values.length
            ? `${values.length} value${values.length === 1 ? "" : "s"} ready`
            : "Paste values on the left to begin."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"123456789012\n123456789013\n123456789014"}
          className="font-mono text-sm"
          aria-label="Batch values, one per line"
        />

        {previews.length > 0 && (
          <div className="space-y-2">
            {previews.map((p, i) => (
              <div
                key={i}
                className="border-border flex items-center gap-3 rounded-lg border p-2"
              >
                <div className="bg-white flex h-12 flex-1 items-center justify-center overflow-hidden rounded">
                  {p.svg ? (
                    <div className="[&>svg]:h-11 [&>svg]:w-auto" dangerouslySetInnerHTML={{ __html: p.svg }} />
                  ) : (
                    <span className="text-destructive inline-flex items-center gap-1 text-xs">
                      <TriangleAlertIcon className="size-3.5" /> invalid
                    </span>
                  )}
                </div>
                <code className="text-muted-foreground w-24 shrink-0 truncate text-right font-mono text-xs">
                  {p.value}
                </code>
              </div>
            ))}
            {values.length > MAX_BATCH_PREVIEW && (
              <p className="text-muted-foreground text-center text-xs">
                + {values.length - MAX_BATCH_PREVIEW} more
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Select value={kind} onValueChange={(v) => setKind(v as "png" | "svg")}>
            <SelectTrigger className="w-28" aria-label="ZIP file type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="png">PNG</SelectItem>
              <SelectItem value="svg">SVG</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={download} disabled={!values.length || busy} className="flex-1 font-semibold">
            <DownloadIcon /> {busy ? "Zipping…" : "Download ZIP"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BarcodeStage({
  svg,
  error,
  transparent,
}: {
  svg: string | null;
  error: string | null;
  transparent: boolean;
}) {
  if (!svg) {
    return (
      <div className="border-border bg-muted/30 text-muted-foreground flex min-h-40 w-full items-center justify-center rounded-xl border border-dashed p-6 text-center text-xs">
        {error ? (
          <span className="text-destructive inline-flex items-center gap-1.5">
            <TriangleAlertIcon className="size-4" /> {error}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <BarcodeIcon className="size-5 opacity-50" /> Barcode appears here as you type
          </span>
        )}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "border-border flex w-full items-center justify-center overflow-hidden rounded-xl border p-4",
        transparent ? "bg-[#fafafa]" : "bg-white"
      )}
      style={
        transparent
          ? {
              backgroundImage:
                "linear-gradient(45deg,#e5e5e5 25%,transparent 25%),linear-gradient(-45deg,#e5e5e5 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e5e5 75%),linear-gradient(-45deg,transparent 75%,#e5e5e5 75%)",
              backgroundSize: "14px 14px",
              backgroundPosition: "0 0,0 7px,7px -7px,-7px 0",
            }
          : undefined
      }
    >
      <div className="[&>svg]:h-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

function ColorField({
  label,
  id,
  value,
  onChange,
  disabled,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <div className={cn("flex items-center gap-2", disabled && "pointer-events-none opacity-40")}>
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-border size-8 cursor-pointer rounded-lg border bg-transparent p-0.5"
        />
        <span className="font-mono text-xs">{value}</span>
      </div>
    </Field>
  );
}

function SliderRow({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
  step: number;
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
