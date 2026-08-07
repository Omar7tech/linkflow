"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  LayersIcon,
  PackageIcon,
  PaletteIcon,
  PlusIcon,
  SmartphoneIcon,
  SparklesIcon,
  TabletSmartphoneIcon,
  TypeIcon,
  UploadIcon,
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
  DEFAULT_SHOTS,
  DEVICES,
  FONTS,
  FRAME_COLORS,
  FRAMES,
  LAYOUTS,
  MAX_PANELS,
  deviceOf,
  exportCount,
  makePanel,
  panelFilename,
  plainHeadline,
  renderPanel,
  THEMES,
  zipName,
  type BgType,
  type DeviceId,
  type FrameColor,
  type FrameKind,
  type Layout,
  type Panel,
  type PanelImage,
  type ShotConfig,
} from "@/lib/app-shots";
import { cn } from "@/lib/utils";

interface LoadedImage extends PanelImage {
  url: string;
}

/** Fallback preview size for the first paint, before the stage is measured. */
const PREVIEW_MAX = 520;
/** The stage's `p-3` padding, in px — excluded from the space the canvas gets. */
const STAGE_PAD = 12;
/** Thumbnails draw at 3× their CSS width so they stay sharp on HiDPI screens. */
const THUMB_W = 192;

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

export function AppShotsTool() {
  const [rawCfg, setCfg] = useLocalStorage<ShotConfig>("forma:app-shots", DEFAULT_SHOTS);
  const cfg = React.useMemo(() => ({ ...DEFAULT_SHOTS, ...rawCfg }), [rawCfg]);
  const [images, setImages] = React.useState<Record<string, LoadedImage>>({});
  const [current, setCurrent] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const device = deviceOf(cfg.device);
  const panels = cfg.panels;
  const idx = Math.min(current, Math.max(0, panels.length - 1));
  const panel = panels[idx];
  const cfgKey = JSON.stringify(cfg);

  // The stage's own size decides how big the preview may be. Measuring it (and
  // the viewport height, which the vh cap depends on) keeps the canvas honest
  // when the window resizes or the controls column reflows.
  const [stage, setStage] = React.useState({ w: 0, vh: 0 });
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    // clientWidth includes the stage's own p-3 padding, which the canvas can't use.
    const sync = () => setStage({ w: el.clientWidth - STAGE_PAD * 2, vh: window.innerHeight });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  /**
   * CSS size of the preview, and the backing-store size behind it. Drawing at
   * display size × devicePixelRatio is what keeps the preview as crisp as the
   * exported PNG — a fixed-size canvas stretched by CSS always looks soft.
   */
  const preview = React.useMemo(() => {
    const maxW = stage.w > 0 ? stage.w : PREVIEW_MAX;
    const maxH = stage.vh > 0 ? stage.vh * 0.56 : PREVIEW_MAX;
    const s = Math.min(maxW / device.w, maxH / device.h);
    const cssW = Math.max(1, Math.round(device.w * s));
    const cssH = Math.max(1, Math.round(device.h * s));
    const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 3);
    // Never ask for more pixels than the export itself has.
    const q = Math.min(dpr, device.w / cssW);
    return { cssW, cssH, w: Math.round(cssW * q), h: Math.round(cssH * q) };
  }, [device.w, device.h, stage.w, stage.vh]);

  // Draw the selected panel whenever anything it depends on changes.
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* draw with whatever's ready */
      }
      if (cancelled || !canvasRef.current || !panel) return;
      renderPanel(canvasRef.current, cfg, panel, device, {
        index: idx,
        total: panels.length,
        image: images[panel.id],
        outW: preview.w,
        outH: preview.h,
      });
    };
    const t = setTimeout(run, 40);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cfgKey captures cfg
  }, [cfgKey, idx, images, preview.w, preview.h]);

  const patch = (p: Partial<ShotConfig>) => setCfg((c) => ({ ...c, ...p }));
  const patchPanel = (id: string, p: Partial<Panel>) =>
    setCfg((c) => ({ ...c, panels: c.panels.map((s) => (s.id === id ? { ...s, ...p } : s)) }));

  const addPanel = () => {
    if (panels.length >= MAX_PANELS) return toast.error(`Stores cap listings at ${MAX_PANELS} screenshots.`);
    const p = makePanel(panel?.layout ?? "bottom");
    setCfg((c) => {
      const next = [...c.panels];
      next.splice(idx + 1, 0, p);
      return { ...c, panels: next };
    });
    setCurrent(idx + 1);
  };

  const duplicatePanel = (id: string) =>
    setCfg((c) => {
      const i = c.panels.findIndex((s) => s.id === id);
      if (i < 0 || c.panels.length >= MAX_PANELS) return c;
      const copy = { ...c.panels[i], id: makePanel().id };
      setImages((m) => (m[id] ? { ...m, [copy.id]: m[id] } : m));
      const next = [...c.panels];
      next.splice(i + 1, 0, copy);
      return { ...c, panels: next };
    });

  const movePanel = (id: string, dir: -1 | 1) =>
    setCfg((c) => {
      const i = c.panels.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.panels.length) return c;
      const next = [...c.panels];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...c, panels: next };
    });

  const deletePanel = (id: string) => {
    dropImage(id, setImages);
    setCfg((c) => ({ ...c, panels: c.panels.filter((s) => s.id !== id) }));
    setCurrent((i) => Math.max(0, i - 1));
  };

  const setPanelImage = async (id: string, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const img = await loadFile(file);
    if (!img) return toast.error("That file isn't an image.");
    setImages((m) => {
      if (m[id]) URL.revokeObjectURL(m[id].url);
      return { ...m, [id]: img };
    });
  };

  /**
   * Dropping a batch of screenshots fills the existing panels in order and adds
   * new ones for the overflow — the fastest path from a simulator dump to a
   * finished set.
   */
  const ingest = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    const loaded = (await Promise.all(list.map(loadFile))).filter(Boolean) as LoadedImage[];
    if (!loaded.length) return toast.error("No readable images in that drop.");

    setCfg((c) => {
      const next = [...c.panels];
      while (next.length < Math.min(MAX_PANELS, loaded.length)) next.push(makePanel(next[0]?.layout ?? "bottom"));
      const assigned = next.slice(0, loaded.length);
      setImages((m) => {
        const out = { ...m };
        assigned.forEach((p, i) => {
          if (out[p.id]) URL.revokeObjectURL(out[p.id].url);
          out[p.id] = loaded[i];
        });
        return out;
      });
      return { ...c, panels: next };
    });
    const skipped = loaded.length - Math.min(MAX_PANELS, loaded.length);
    toast.success(
      skipped > 0
        ? `Filled ${MAX_PANELS} panels — ${skipped} extra screenshot${skipped > 1 ? "s" : ""} skipped.`
        : `Filled ${loaded.length} panel${loaded.length > 1 ? "s" : ""}.`
    );
  };

  const toggleExportDevice = (id: DeviceId) =>
    setCfg((c) => {
      const has = c.exportDevices.includes(id);
      // The previewed size always stays in the export set.
      if (has && (c.exportDevices.length === 1 || id === c.device)) return c;
      return {
        ...c,
        exportDevices: has ? c.exportDevices.filter((d) => d !== id) : [...c.exportDevices, id],
      };
    });

  const selectDevice = (id: DeviceId) =>
    setCfg((c) => ({
      ...c,
      device: id,
      exportDevices: c.exportDevices.includes(id) ? c.exportDevices : [...c.exportDevices, id],
    }));

  const renderToBlob = (i: number, dev = device): Promise<Blob | null> =>
    new Promise((resolve) => {
      const p = cfg.panels[i];
      if (!p) return resolve(null);
      const off = document.createElement("canvas");
      renderPanel(off, cfg, p, dev, {
        index: i,
        total: cfg.panels.length,
        image: images[p.id],
        outW: dev.w * cfg.scale,
        outH: dev.h * cfg.scale,
      });
      off.toBlob((b) => resolve(b), "image/png");
    });

  const downloadCurrent = async () => {
    const blob = await renderToBlob(idx);
    if (blob) saveBlob(blob, panelFilename(cfg, device, idx, false));
  };

  const copyCurrent = async () => {
    try {
      const blob = await renderToBlob(idx);
      if (!blob) throw new Error("nothing to copy");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Screenshot copied to clipboard");
    } catch {
      toast.error("Your browser blocked image copy — download instead");
    }
  };

  const downloadAll = async () => {
    if (busy || !panels.length) return;
    setBusy(true);
    try {
      await document.fonts.ready.catch(() => {});
      const devices = cfg.exportDevices.length ? cfg.exportDevices : [cfg.device];
      const multi = devices.length > 1;
      const entries: ZipEntry[] = [];
      for (const id of devices) {
        const dev = deviceOf(id);
        for (let i = 0; i < cfg.panels.length; i++) {
          const blob = await renderToBlob(i, dev);
          if (!blob) continue;
          entries.push({
            name: panelFilename(cfg, dev, i, multi),
            data: new Uint8Array(await blob.arrayBuffer()),
          });
        }
      }
      if (!entries.length) throw new Error("nothing rendered");
      saveBlob(buildZip(entries), zipName(cfg));
      toast.success(`Exported ${entries.length} screenshots`);
    } catch {
      toast.error("Export failed — try fewer sizes or panels.");
    } finally {
      setBusy(false);
    }
  };

  const go = (d: -1 | 1) => setCurrent((i) => Math.min(panels.length - 1, Math.max(0, i + d)));

  const iosDevices = DEVICES.filter((d) => d.store === "App Store");
  const androidDevices = DEVICES.filter((d) => d.store === "Play Store");

  return (
    <GeneratorLayout tool={TOOL_BY_ID.appshots} output={null}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ---- Preview + export ---- */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="space-y-3 lg:sticky lg:top-20">
            <Card>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">
                    {device.label} · <span className="tabular-nums">{device.w}×{device.h}</span>
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {panels.length ? `${idx + 1} / ${panels.length}` : "0 panels"}
                  </span>
                </div>

                <div
                  ref={stageRef}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    void ingest(e.dataTransfer.files);
                  }}
                  className={cn(
                    "flex items-center justify-center rounded-xl p-3 transition-colors",
                    dragging ? "bg-primary/10 ring-primary ring-2" : "bg-muted/40"
                  )}
                >
                  <div className="relative flex max-w-full items-center justify-center">
                    <canvas
                      ref={canvasRef}
                      className="block rounded-lg bg-black shadow-lg"
                      style={{ width: preview.cssW, height: preview.cssH }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => go(-1)}
                      disabled={idx <= 0}
                      aria-label="Previous panel"
                      className="absolute left-1 top-1/2 -translate-y-1/2 shadow-md sm:left-2"
                    >
                      <ChevronLeftIcon className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => go(1)}
                      disabled={idx >= panels.length - 1}
                      aria-label="Next panel"
                      className="absolute right-1 top-1/2 -translate-y-1/2 shadow-md sm:right-2"
                    >
                      <ChevronRightIcon className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* Filmstrip — the row exactly as the store lists it. */}
                {panels.length > 0 && (
                  <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
                    {panels.map((p, i) => (
                      <PanelThumb
                        key={p.id}
                        cfg={cfg}
                        panel={p}
                        index={i}
                        total={panels.length}
                        image={images[p.id]}
                        active={i === idx}
                        onSelect={() => setCurrent(i)}
                      />
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={downloadAll} disabled={busy || !panels.length} className="flex-1 font-semibold">
                    <PackageIcon className="size-4" />
                    {busy ? "Exporting…" : `Download ${exportCount(cfg)} PNGs (ZIP)`}
                  </Button>
                  <Button variant="outline" onClick={downloadCurrent} disabled={!panels.length} title="Download this panel">
                    <DownloadIcon className="size-4" />
                  </Button>
                  <Button variant="outline" onClick={copyCurrent} disabled={!panels.length} title="Copy this panel">
                    <CopyIcon className="size-4" />
                  </Button>
                </div>
                <p className="text-muted-foreground text-center text-xs">
                  Drop your screenshots anywhere on the preview to fill every panel at once.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ---- Controls ---- */}
        <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-1">
          {/* Store sizes */}
          <Section icon={TabletSmartphoneIcon} title="Store sizes">
            <p className="text-muted-foreground -mt-1 text-xs">
              Tap a size to preview it. Tick every size you want in the ZIP — each one exports at its exact
              required resolution, in its own folder.
            </p>
            <DeviceGroup
              label="App Store"
              devices={iosDevices}
              cfg={cfg}
              onSelect={selectDevice}
              onToggle={toggleExportDevice}
            />
            <DeviceGroup
              label="Play Store"
              devices={androidDevices}
              cfg={cfg}
              onSelect={selectDevice}
              onToggle={toggleExportDevice}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="App name" hint="names the files">
                <Input value={cfg.appName} onChange={(e) => patch({ appName: e.target.value })} placeholder="My app" />
              </Field>
              <Field label="Export scale">
                <Segmented
                  value={String(cfg.scale)}
                  onChange={(v) => patch({ scale: Number(v) })}
                  options={[
                    { value: "1", label: "Exact" },
                    { value: "2", label: "2×" },
                  ]}
                />
              </Field>
            </div>
          </Section>

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
                    onClick={() => patch(t.patch)}
                    className="border-border hover:border-primary hover:bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                  >
                    <span className="size-4 shrink-0 rounded-full border" style={{ background: t.swatch }} />
                    {t.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Panels */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <LayersIcon className="text-primary size-4" /> Panels
                </span>
                <Button type="button" size="sm" onClick={addPanel} disabled={panels.length >= MAX_PANELS}>
                  <PlusIcon className="size-4" /> Add
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1.5">
                {panels.map((p, i) => (
                  <PanelRow
                    key={p.id}
                    index={i}
                    panel={p}
                    hasImage={!!images[p.id]}
                    active={i === idx}
                    canUp={i > 0}
                    canDown={i < panels.length - 1}
                    onSelect={() => setCurrent(i)}
                    onUp={() => movePanel(p.id, -1)}
                    onDown={() => movePanel(p.id, 1)}
                    onDuplicate={() => duplicatePanel(p.id)}
                    onDelete={() => deletePanel(p.id)}
                  />
                ))}
                {!panels.length && (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    Add a panel, or drop screenshots on the preview.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected panel */}
          {panel && (
            <Section icon={TypeIcon} title={`Panel ${idx + 1}`}>
              <Field label="Layout" hint={LAYOUTS.find((l) => l.id === panel.layout)?.hint}>
                <Select value={panel.layout} onValueChange={(v) => patchPanel(panel.id, { layout: v as Layout })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LAYOUTS.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Headline" hint="wrap a phrase in *asterisks* to accent it">
                <Textarea
                  value={panel.headline}
                  onChange={(e) => patchPanel(panel.id, { headline: e.target.value })}
                  rows={2}
                  className="resize-none font-medium"
                  placeholder="One benefit, five words"
                />
              </Field>

              <Field label="Subhead">
                <Textarea
                  value={panel.subhead}
                  onChange={(e) => patchPanel(panel.id, { subhead: e.target.value })}
                  rows={2}
                  className="resize-none"
                  placeholder="Optional supporting line."
                />
              </Field>

              {panel.layout !== "text" && (
                <ScreenshotField
                  hasImage={!!images[panel.id]}
                  onFile={(f) => setPanelImage(panel.id, f)}
                  onClear={() => dropImage(panel.id, setImages)}
                />
              )}
            </Section>
          )}

          {/* Device look */}
          <Section icon={SmartphoneIcon} title="Device">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cutout">
                <Select
                  value={cfg.frame}
                  onValueChange={(v) => patch({ frame: v as FrameKind | "auto" })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Match the size</SelectItem>
                    {FRAMES.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Finish">
                <Select value={cfg.frameColor} onValueChange={(v) => patch({ frameColor: v as FrameColor })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FRAME_COLORS.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SliderRow label="Size" value={Math.round(cfg.deviceScale * 100)} unit="%" min={35} max={110} onChange={(v) => patch({ deviceScale: v / 100 })} />
              <SliderRow label="Nudge" value={Math.round(cfg.deviceOffset * 100)} unit="%" min={-20} max={20} onChange={(v) => patch({ deviceOffset: v / 100 })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SliderRow label="3D tilt" value={cfg.tilt} unit="°" min={-30} max={30} onChange={(v) => patch({ tilt: v })} />
              <SliderRow label="Rotate" value={cfg.rotate} unit="°" min={-20} max={20} onChange={(v) => patch({ rotate: v })} />
            </div>
            <SliderRow label="Shadow" value={Math.round(cfg.shadow * 100)} unit="%" min={0} max={100} onChange={(v) => patch({ shadow: v / 100 })} />
            <div className="flex items-center justify-between">
              <div>
                <Label>Bleed off the edge</Label>
                <p className="text-muted-foreground text-[11px]">Lets a tall device crop at the bottom.</p>
              </div>
              <Switch checked={cfg.bleed} onCheckedChange={(v) => patch({ bleed: v })} />
            </div>
          </Section>

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

            <div className="flex items-center justify-between">
              <div>
                <Label>Continuous background</Label>
                <p className="text-muted-foreground text-[11px]">
                  One artwork flows across all {panels.length} panels.
                </p>
              </div>
              <Switch checked={cfg.continuous} onCheckedChange={(v) => patch({ continuous: v })} />
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

          {/* Type & colour */}
          <Section icon={PaletteIcon} title="Type & colour">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Headline font">
                <FontSelect value={cfg.titleFont} onChange={(v) => patch({ titleFont: v })} />
              </Field>
              <Field label="Body font">
                <FontSelect value={cfg.bodyFont} onChange={(v) => patch({ bodyFont: v })} />
              </Field>
            </div>
            <SliderRow label="Headline size" value={Math.round(cfg.titleScale * 100)} unit="%" min={60} max={150} onChange={(v) => patch({ titleScale: v / 100 })} />
            <div className="grid grid-cols-4 gap-2">
              <ColorField label="Headline" value={cfg.textColor} onChange={(v) => patch({ textColor: v })} />
              <ColorField label="Subhead" value={cfg.mutedColor} onChange={(v) => patch({ mutedColor: v })} />
              <ColorField label="Accent 1" value={cfg.accentFrom} onChange={(v) => patch({ accentFrom: v })} />
              <ColorField label="Accent 2" value={cfg.accentTo} onChange={(v) => patch({ accentTo: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Gradient accent</Label>
              <Switch checked={cfg.accentGradient} onCheckedChange={(v) => patch({ accentGradient: v })} />
            </div>
          </Section>

          <Button
            variant="ghost"
            className="text-muted-foreground w-full"
            onClick={() => {
              Object.values(images).forEach((i) => URL.revokeObjectURL(i.url));
              setImages({});
              setCfg(DEFAULT_SHOTS);
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

function dropImage(id: string, setImages: React.Dispatch<React.SetStateAction<Record<string, LoadedImage>>>) {
  setImages((m) => {
    if (m[id]) URL.revokeObjectURL(m[id].url);
    const next = { ...m };
    delete next[id];
    return next;
  });
}

/* -------------------------------- sub-views ------------------------------- */

function PanelThumb({
  cfg,
  panel,
  index,
  total,
  image,
  active,
  onSelect,
}: {
  cfg: ShotConfig;
  panel: Panel;
  index: number;
  total: number;
  image?: PanelImage;
  active: boolean;
  onSelect: () => void;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const device = deviceOf(cfg.device);
  const key = JSON.stringify(cfg);
  React.useEffect(() => {
    if (!ref.current) return;
    const h = Math.round((THUMB_W * device.h) / device.w);
    renderPanel(ref.current, cfg, panel, device, { index, total, image, outW: THUMB_W, outH: h });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures cfg
  }, [key, index, total, image, device.w, device.h]);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Panel ${index + 1}`}
      aria-current={active}
      className={cn(
        "shrink-0 overflow-hidden rounded-md border-2 transition-colors",
        active ? "border-primary" : "border-transparent hover:border-border"
      )}
    >
      <canvas ref={ref} className="block h-auto w-[52px] sm:w-[64px]" />
    </button>
  );
}

function DeviceGroup({
  label,
  devices,
  cfg,
  onSelect,
  onToggle,
}: {
  label: string;
  devices: typeof DEVICES;
  cfg: ShotConfig;
  onSelect: (id: DeviceId) => void;
  onToggle: (id: DeviceId) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide">{label}</Label>
      <div className="flex flex-col gap-1">
        {devices.map((d) => {
          const previewing = cfg.device === d.id;
          const exporting = cfg.exportDevices.includes(d.id);
          return (
            <div
              key={d.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-1.5 transition-colors",
                previewing ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
              )}
            >
              <button type="button" onClick={() => onSelect(d.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium">{d.label}</span>
                <span className="text-muted-foreground block text-[11px]">
                  {d.w}×{d.h} · {d.note}
                </span>
              </button>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 pr-1" title="Include in the ZIP export">
                <span className="text-muted-foreground text-[11px]">ZIP</span>
                <input
                  type="checkbox"
                  checked={exporting}
                  onChange={() => onToggle(d.id)}
                  className="accent-primary size-4 cursor-pointer"
                  aria-label={`Include ${d.label} in the export`}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PanelRow({
  index,
  panel,
  hasImage,
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
  panel: Panel;
  hasImage: boolean;
  active: boolean;
  canUp: boolean;
  canDown: boolean;
  onSelect: () => void;
  onUp: () => void;
  onDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const layout = LAYOUTS.find((l) => l.id === panel.layout)?.label ?? panel.layout;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border p-1.5 transition-colors",
        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          {index + 1}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {plainHeadline(panel.headline).trim() || layout}
          </span>
          <span className="text-muted-foreground block text-[11px]">
            {layout}
            {panel.layout !== "text" && !hasImage && " · no screenshot yet"}
          </span>
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

function ScreenshotField({
  hasImage,
  onFile,
  onClear,
}: {
  hasImage: boolean;
  onFile: (f: FileList | null) => void;
  onClear: () => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <Label>Screenshot</Label>
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
          <UploadIcon className="size-4" /> {hasImage ? "Replace screenshot" : "Upload screenshot"}
        </Button>
        {hasImage && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClear} aria-label="Remove screenshot">
            <XIcon className="size-4" />
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-[11px]">
        {hasImage ? "Cropped to fill the screen." : "Until you upload one, a neutral app mock stands in."}
      </p>
    </div>
  );
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

function ColorField({
  label,
  value,
  onChange,
  wide,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  return (
    <div className="space-y-1">
      {label && <Label className="text-[11px]">{label}</Label>}
      <div className={cn("flex items-center gap-1.5", wide && "w-full")}>
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-9 shrink-0 cursor-pointer p-1"
          aria-label={label ?? "Color"}
        />
        {wide && <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 font-mono text-xs" />}
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
        {FONTS.map((f) => (
          <SelectItem key={f.value} value={f.value}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-xs transition-colors disabled:opacity-30",
        danger
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
