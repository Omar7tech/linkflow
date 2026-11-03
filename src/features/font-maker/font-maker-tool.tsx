"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  EraserIcon,
  LoaderCircleIcon,
  PenLineIcon,
  Redo2Icon,
  RotateCcwIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { TOOL_BY_ID } from "@/constants/tools";
import type { ShapeSettings } from "@/lib/font-maker/build";
import { SLOTS, SLOT_BY_KEY } from "@/lib/font-maker/charset";
import { decodeMask, encodeMask, type PenStyle, type Stroke } from "@/lib/font-maker/strokes";
import type { Mask } from "@/lib/font-maker/trace";
import { toWoff } from "@/lib/font-maker/ttf";
import { cn } from "@/lib/utils";
import { DrawPad } from "./draw-pad";
import { GlyphGrid } from "./glyph-grid";
import { ScanPanel } from "./scan-panel";
import { hasInk, useFontBuild, type BuildState, type SlotData } from "./use-font-build";

interface Settings {
  name: string;
  pen: PenStyle;
  penSize: number;
  weight: number;
  slant: number;
  spacing: number;
  sitOnBaseline: boolean;
  evenSizes: number;
  kerning: boolean;
  variation: boolean;
  fillLowercase: boolean;
}

const DEFAULTS: Settings = {
  name: "My Handwriting",
  pen: "fineliner",
  penSize: 26,
  weight: 0,
  slant: 0,
  spacing: 50,
  sitOnBaseline: true,
  evenSizes: 0.5,
  kerning: true,
  variation: true,
  fillLowercase: true,
};

const PENS: { value: PenStyle; label: string }[] = [
  { value: "fineliner", label: "Fineliner" },
  { value: "brush", label: "Brush" },
  { value: "nib", label: "Calligraphy" },
];

const BASE_COUNT = SLOTS.filter((s) => !s.alt).length;

/* ------------------------------------------------------------ persistence */

const STORE = "tm-font-maker-v1";

interface Saved {
  settings: Settings;
  slots: Record<string, { s: number[][]; m?: number[] }>;
}

function save(settings: Settings, slots: Record<string, SlotData>) {
  const out: Saved = { settings, slots: {} };
  for (const [key, slot] of Object.entries(slots)) {
    if (!hasInk(slot) && !slot.strokes.length) continue;
    out.slots[key] = {
      s: slot.strokes.map((st) => [
        st.erase ? 1 : 0,
        ...st.points.flatMap((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.p * 100) / 100]),
      ]),
      m: slot.scan ? encodeMask(slot.scan) : undefined,
    };
  }
  try {
    window.localStorage.setItem(STORE, JSON.stringify(out));
  } catch {
    // Storage full or blocked: the work just isn't kept between visits.
  }
}

function load(): { settings: Settings; slots: Record<string, SlotData> } | null {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    const slots: Record<string, SlotData> = {};
    for (const [key, value] of Object.entries(saved.slots ?? {})) {
      if (!SLOT_BY_KEY.has(key)) continue;
      const strokes: Stroke[] = value.s.map(([erase, ...flat]) => {
        const points = [];
        for (let i = 0; i + 2 < flat.length; i += 3) points.push({ x: flat[i], y: flat[i + 1], p: flat[i + 2] });
        return { points, erase: erase ? true : undefined };
      });
      slots[key] = { strokes, scan: value.m ? decodeMask(value.m) : undefined, rev: 1 };
    }
    return { settings: { ...DEFAULTS, ...saved.settings }, slots };
  } catch {
    return null;
  }
}

const subscribeNever = () => () => {};

/* ------------------------------------------------------------------ bits */

function Segmented({
  label,
  value,
  options,
  onChange,
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
            value === option.value
              ? "bg-background text-foreground font-medium shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Control({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">{display}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} aria-label={label} />
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

/* --------------------------------------------------------------- preview */

const SAMPLES = [
  { label: "Pangram", text: "The quick brown fox jumps over the lazy dog." },
  { label: "Alphabet", text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 .,:;!?&@#$%" },
  { label: "Note", text: "Dear Sam,\nThanks for the coffee yesterday. See you on Friday!" },
  { label: "Doubles", text: "Hello, little balloon. Coffee, books and a sweet apple." },
];

function Preview({ build }: { build: BuildState }) {
  const [text, setText] = React.useState(SAMPLES[0].text);
  const [size, setSize] = React.useState(52);
  const [paper, setPaper] = React.useState<"light" | "dark">("light");

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Type with it</CardTitle>
          <CardDescription>This is your font, live. Edit the text to try any words.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SAMPLES.map((sample) => (
            <Button key={sample.label} size="sm" variant="outline" onClick={() => setText(sample.text)}>
              {sample.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border",
            paper === "light" ? "border-black/10 bg-[#fbfaf7] text-[#151515]" : "border-white/10 bg-[#0c0c0d] text-[#f4f4f5]"
          )}
        >
          {build.family ? (
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              spellCheck={false}
              aria-label="Preview text"
              className="block min-h-56 w-full resize-y bg-transparent p-6 leading-[1.25] outline-none sm:p-8"
              style={{ fontFamily: `"${build.family}", cursive`, fontSize: size }}
            />
          ) : (
            <div className="grid min-h-56 place-items-center p-8 text-center text-sm opacity-60">
              {build.status === "building" ? "Building your font…" : "Draw or scan a few letters and your font appears here."}
            </div>
          )}
          {build.status === "building" && build.family && (
            <span className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] dark:bg-white/10">
              <LoaderCircleIcon className="size-3 animate-spin" /> Updating
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex min-w-56 flex-1 items-center gap-3">
            <Label className="shrink-0 text-xs">Size</Label>
            <Slider value={[size]} min={18} max={120} step={1} onValueChange={([v]) => setSize(v)} aria-label="Preview size" />
          </div>
          <div className="w-40">
            <Segmented
              label="Paper"
              value={paper}
              options={[
                { value: "light", label: "Paper" },
                { value: "dark", label: "Night" },
              ]}
              onChange={(v) => setPaper(v as "light" | "dark")}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ tool */

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "my-handwriting";

function download(data: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Snapshot = { strokes: Stroke[]; scan?: Mask };

export function FontMakerTool() {
  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [slots, setSlots] = React.useState<Record<string, SlotData>>({});
  const [active, setActive] = React.useState("A");
  const [mode, setMode] = React.useState<"draw" | "scan">("draw");
  const [erasing, setErasing] = React.useState(false);
  const [showGhost, setShowGhost] = React.useState(true);
  const history = React.useRef(new Map<string, { past: Snapshot[]; future: Snapshot[] }>());

  // Restore saved work once the browser is available (setting state during
  // render, guarded, is React's pattern for deriving state from outside).
  const hydrated = React.useSyncExternalStore(subscribeNever, () => true, () => false);
  const [restored, setRestored] = React.useState(false);
  if (hydrated && !restored) {
    setRestored(true);
    const saved = load();
    if (saved) {
      setSettings(saved.settings);
      setSlots(saved.slots);
    }
  }

  React.useEffect(() => {
    if (!restored) return;
    const timer = window.setTimeout(() => save(settings, slots), 600);
    return () => window.clearTimeout(timer);
  }, [settings, slots, restored]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }));

  const pen = React.useMemo(() => ({ style: settings.pen, size: settings.penSize }), [settings.pen, settings.penSize]);
  const shape: ShapeSettings = {
    slant: settings.slant,
    spacing: settings.spacing,
    sitOnBaseline: settings.sitOnBaseline,
    evenSizes: settings.evenSizes,
    kerning: settings.kerning,
    variation: settings.variation,
    fillLowercase: settings.fillLowercase,
  };
  const build = useFontBuild(slots, pen, settings.weight, shape, settings.name);

  const slot = slots[active] ?? { strokes: [], rev: 0 };
  const meta = SLOT_BY_KEY.get(active)!;
  const index = SLOTS.findIndex((s) => s.key === active);
  const done = SLOTS.filter((s) => !s.alt && hasInk(slots[s.key])).length;

  const commit = React.useCallback((key: string, next: Snapshot) => {
    setSlots((all) => {
      const current = all[key] ?? { strokes: [], rev: 0 };
      const h = history.current.get(key) ?? { past: [], future: [] };
      h.past.push({ strokes: current.strokes, scan: current.scan });
      h.future = [];
      history.current.set(key, h);
      return { ...all, [key]: { strokes: next.strokes, scan: next.scan, rev: current.rev + 1 } };
    });
  }, []);

  const step = React.useCallback(
    (key: string, direction: "undo" | "redo") => {
      const h = history.current.get(key);
      const from = direction === "undo" ? h?.past : h?.future;
      if (!h || !from?.length) return;
      const target = from.pop()!;
      setSlots((all) => {
        const current = all[key] ?? { strokes: [], rev: 0 };
        (direction === "undo" ? h.future : h.past).push({ strokes: current.strokes, scan: current.scan });
        return { ...all, [key]: { strokes: target.strokes, scan: target.scan, rev: current.rev + 1 } };
      });
    },
    []
  );

  const go = React.useCallback((delta: number) => {
    setActive((key) => {
      const i = SLOTS.findIndex((s) => s.key === key);
      return SLOTS[(i + delta + SLOTS.length) % SLOTS.length].key;
    });
  }, []);

  React.useEffect(() => {
    if (mode !== "draw") return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]")) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        step(active, event.shiftKey ? "redo" : "undo");
      } else if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        step(active, "redo");
      } else if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key.toLowerCase() === "e" && !mod) setErasing((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, active, step, go]);

  const importScan = (cells: Map<string, Mask>) => {
    setSlots((all) => {
      const next = { ...all };
      for (const [key, mask] of cells) {
        const current = next[key] ?? { strokes: [], rev: 0 };
        next[key] = { strokes: [], scan: mask, rev: current.rev + 1 };
      }
      return next;
    });
  };

  const fileBase = slugify(settings.name);
  const css = `@font-face {
  font-family: "${settings.name.trim() || "My Handwriting"}";
  src: url("${fileBase}.woff") format("woff"),
       url("${fileBase}.ttf") format("truetype");
  font-display: swap;
}`;

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.fontmaker}
      wideOutput
      footer={<Preview build={build} />}
      output={
        <Card className="overflow-hidden">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b">
            <div className="w-56">
              <Segmented
                label="Input"
                value={mode}
                options={[
                  { value: "draw", label: "Draw" },
                  { value: "scan", label: "Scan paper" },
                ]}
                onChange={(v) => setMode(v as "draw" | "scan")}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-xs">
                <span className="text-foreground font-medium tabular-nums">{done}</span> of {BASE_COUNT} characters
              </span>
              <span className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
                <span className="bg-primary block h-full rounded-full transition-[width]" style={{ width: `${(done / BASE_COUNT) * 100}%` }} />
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            {mode === "draw" ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="icon-sm" variant="ghost" aria-label="Previous character" onClick={() => go(-1)}>
                      <ChevronLeftIcon />
                    </Button>
                    <span className="font-heading min-w-10 text-center text-2xl font-semibold">
                      {meta.char}
                      {meta.alt && <sup className="text-muted-foreground ml-0.5 text-xs">2</sup>}
                    </span>
                    <Button size="icon-sm" variant="ghost" aria-label="Next character" onClick={() => go(1)}>
                      <ChevronRightIcon />
                    </Button>
                    <span className="text-muted-foreground text-xs">
                      {meta.alt ? "Second version, used when the letter repeats" : `${index + 1} / ${SLOTS.length}`}
                    </span>
                    <span className="flex-1" />
                    <div className="bg-muted/60 flex gap-0.5 rounded-lg p-0.5">
                      <Button
                        size="icon-sm"
                        variant={erasing ? "ghost" : "secondary"}
                        aria-label="Pen"
                        aria-pressed={!erasing}
                        onClick={() => setErasing(false)}
                      >
                        <PenLineIcon />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant={erasing ? "secondary" : "ghost"}
                        aria-label="Eraser"
                        aria-pressed={erasing}
                        onClick={() => setErasing(true)}
                      >
                        <EraserIcon />
                      </Button>
                    </div>
                    <Button size="icon-sm" variant="ghost" aria-label="Undo" onClick={() => step(active, "undo")}>
                      <Undo2Icon />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Redo" onClick={() => step(active, "redo")}>
                      <Redo2Icon />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Clear this character"
                      onClick={() => commit(active, { strokes: [] })}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>

                  <div className="border-border/60 bg-background rounded-xl border">
                    <DrawPad
                      char={meta.char}
                      strokes={slot.strokes}
                      scan={slot.scan}
                      pen={pen}
                      erasing={erasing}
                      showGhost={showGhost}
                      onStroke={(stroke) => commit(active, { strokes: [...slot.strokes, stroke], scan: slot.scan })}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="text-muted-foreground flex items-center gap-2 text-xs">
                      <Switch checked={showGhost} onCheckedChange={setShowGhost} aria-label="Show guide letter" />
                      Guide letter
                    </label>
                    <p className="text-muted-foreground text-xs">
                      ← → to move · E for eraser · Ctrl/⌘ Z to undo
                    </p>
                    <Button size="sm" onClick={() => go(1)}>
                      Next <ChevronRightIcon />
                    </Button>
                  </div>
                </div>

                <div className="xl:max-h-[640px] xl:overflow-y-auto xl:pr-1">
                  <GlyphGrid slots={slots} active={active} pen={pen} onSelect={setActive} />
                </div>
              </div>
            ) : (
              <ScanPanel
                fontName={settings.name}
                onImport={(cells) => {
                  importScan(cells);
                }}
              />
            )}
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your font</CardTitle>
            <CardDescription>
              {build.font
                ? `${build.font.glyphCount} characters · ${build.font.kernPairs.toLocaleString()} kerning pairs${
                    build.font.alternates ? ` · ${build.font.alternates} second versions` : ""
                  }`
                : "Draw or scan letters to build it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="font-name">Name</Label>
              <Input
                id="font-name"
                value={settings.name}
                maxLength={40}
                onChange={(event) => set("name", event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={!build.font}
                onClick={() => build.font && download(build.font.ttf, `${fileBase}.ttf`, "font/ttf")}
              >
                <DownloadIcon /> .ttf
              </Button>
              <Button
                variant="outline"
                disabled={!build.font}
                onClick={async () => {
                  if (!build.font) return;
                  download(await toWoff(build.font.ttf), `${fileBase}.woff`, "font/woff");
                }}
              >
                <DownloadIcon /> .woff
              </Button>
            </div>
            <CopyButton text={css} label="Copy @font-face CSS" variant="ghost" size="sm" className="w-full" />
            {build.status === "error" && (
              <p className="text-destructive text-xs">Something in a letter could not be built: {build.error}</p>
            )}
            <p className="text-muted-foreground text-xs leading-relaxed">
              .ttf installs on Windows and macOS. .woff is the smaller file for websites.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pen</CardTitle>
            <CardDescription>Change it any time. Every letter you have drawn updates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Segmented label="Pen" value={settings.pen} options={PENS} onChange={(v) => set("pen", v as PenStyle)} />
            <Control
              label="Pen size"
              value={settings.penSize}
              display={`${settings.penSize}`}
              min={8}
              max={70}
              step={1}
              onChange={(v) => set("penSize", v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shape</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Control
              label="Weight"
              value={settings.weight}
              display={settings.weight > 0 ? `+${settings.weight}` : `${settings.weight}`}
              min={-3}
              max={4}
              step={1}
              onChange={(v) => set("weight", v)}
            />
            <Control
              label="Slant"
              value={settings.slant}
              display={`${settings.slant}°`}
              min={-10}
              max={20}
              step={1}
              onChange={(v) => set("slant", v)}
            />
            <Control
              label="Letter spacing"
              value={settings.spacing}
              display={`${settings.spacing}`}
              min={10}
              max={140}
              step={2}
              onChange={(v) => set("spacing", v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Smart cleanup</CardTitle>
            <CardDescription>What makes handwriting set like a real font.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SwitchRow
              label="Sit on the baseline"
              description="Letters that rest on the line are moved onto it exactly."
              checked={settings.sitOnBaseline}
              onChange={(v) => set("sitOnBaseline", v)}
            />
            <Control
              label="Even out sizes"
              value={Math.round(settings.evenSizes * 100)}
              display={`${Math.round(settings.evenSizes * 100)}%`}
              min={0}
              max={100}
              step={5}
              onChange={(v) => set("evenSizes", v / 100)}
            />
            <SwitchRow
              label="Auto kerning"
              description="Measures every pair of letters and tucks them together, like To and AV."
              checked={settings.kerning}
              onChange={(v) => set("kerning", v)}
            />
            <SwitchRow
              label="Natural variation"
              description="Doubled letters use your second version, so ll and ee never look copy-pasted."
              checked={settings.variation}
              onChange={(v) => set("variation", v)}
            />
            <SwitchRow
              label="Fill in missing lowercase"
              description="Uses a small capital for any lowercase letter you skip."
              checked={settings.fillLowercase}
              onChange={(v) => set("fillLowercase", v)}
            />
          </CardContent>
        </Card>

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-full"
          onClick={() => {
            if (!window.confirm("Start over? Every drawn and scanned letter will be removed.")) return;
            history.current.clear();
            setSlots({});
            setSettings(DEFAULTS);
            setActive("A");
            toast.success("Started a new font");
          }}
        >
          <RotateCcwIcon /> Start over
        </Button>
      </div>
    </GeneratorLayout>
  );
}
