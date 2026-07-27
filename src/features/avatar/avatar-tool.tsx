"use client";

import * as React from "react";
import {
  CodeIcon,
  DicesIcon,
  DownloadIcon,
  FlipHorizontal2Icon,
  LinkIcon,
  RefreshCwIcon,
  RotateCwIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import { cn } from "@/lib/utils";

const API = "https://api.dicebear.com/9.x";

const STYLES: { id: string; label: string }[] = [
  { id: "adventurer", label: "Adventurer" },
  { id: "avataaars", label: "Avataaars" },
  { id: "big-smile", label: "Big Smile" },
  { id: "bottts", label: "Bottts" },
  { id: "croodles", label: "Croodles" },
  { id: "dylan", label: "Dylan" },
  { id: "fun-emoji", label: "Fun Emoji" },
  { id: "glass", label: "Glass" },
  { id: "icons", label: "Icons" },
  { id: "identicon", label: "Identicon" },
  { id: "initials", label: "Initials" },
  { id: "lorelei", label: "Lorelei" },
  { id: "micah", label: "Micah" },
  { id: "miniavs", label: "Miniavs" },
  { id: "notionists", label: "Notionists" },
  { id: "open-peeps", label: "Open Peeps" },
  { id: "personas", label: "Personas" },
  { id: "pixel-art", label: "Pixel Art" },
  { id: "rings", label: "Rings" },
  { id: "shapes", label: "Shapes" },
  { id: "thumbs", label: "Thumbs" },
];

const SWATCHES: { label: string; value: string | null }[] = [
  { label: "Default", value: null },
  { label: "Emerald", value: "#10b981" },
  { label: "Teal", value: "#0d9488" },
  { label: "Sky", value: "#0ea5e9" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Slate", value: "#e2e8f0" },
  { label: "Ink", value: "#1e293b" },
];

const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg,var(--muted) 25%,transparent 25%),linear-gradient(-45deg,var(--muted) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,var(--muted) 75%),linear-gradient(-45deg,transparent 75%,var(--muted) 75%)",
  backgroundSize: "18px 18px",
  backgroundPosition: "0 0,0 9px,9px -9px,-9px 0",
} as const;

type Opts = {
  format?: "svg" | "png";
  bgMode?: "solid" | "gradient";
  bg?: string | null;
  bg2?: string | null;
  bgRotation?: number;
  flip?: boolean;
  rotate?: number;
  scale?: number;
  radius?: number;
  size?: number;
};

function avatarUrl(style: string, seed: string, o: Opts = {}): string {
  const p = new URLSearchParams();
  p.set("seed", seed || "Forma");

  if (o.bgMode === "gradient") {
    const c1 = (o.bg || "#10b981").replace("#", "");
    const c2 = (o.bg2 || "#0d9488").replace("#", "");
    p.set("backgroundColor", `${c1},${c2}`);
    p.set("backgroundType", "gradientLinear");
    if (o.bgRotation != null) p.set("backgroundRotation", String(o.bgRotation));
  } else if (o.bg) {
    p.set("backgroundColor", o.bg.replace("#", ""));
  }

  if (o.flip) p.set("flip", "true");
  if (o.rotate) p.set("rotate", String(o.rotate));
  if (o.scale != null && o.scale !== 100) p.set("scale", String(o.scale));
  if (o.radius != null) p.set("radius", String(o.radius));
  if (o.size != null) p.set("size", String(o.size));

  return `${API}/${style}/${o.format ?? "svg"}?${p.toString()}`;
}

const ADJ = ["swift", "amber", "quiet", "lunar", "bold", "nova", "sage", "iris", "onyx", "reef", "dawn", "echo"];
const NOUN = ["fox", "otter", "willow", "comet", "harbor", "quartz", "maple", "raven", "delta", "peak", "wren", "cove"];
function randomSeed() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  return `${a}-${n}-${Math.floor(Math.random() * 900 + 100)}`;
}

async function downloadFile(url: string, filename: string) {
  const t = toast.loading("Preparing download…");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
    toast.success("Downloaded", { id: t });
  } catch {
    toast.error("Download failed — please try again.", { id: t });
  }
}

/**
 * Remote avatar with a skeleton while loading, silent auto-retry (DiceBear
 * occasionally rate-limits a burst), and a tappable retry on hard failure — so
 * a broken image never shows.
 */
function AvatarImage({
  src,
  alt,
  className,
  rounded = "rounded-xl",
}: {
  src: string;
  alt: string;
  className?: string;
  rounded?: string;
}) {
  const [status, setStatus] = React.useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = React.useState(0);
  const [prevSrc, setPrevSrc] = React.useState(src);

  // Reset when the source changes (React's recommended in-render pattern — no effect).
  if (src !== prevSrc) {
    setPrevSrc(src);
    setStatus("loading");
    setAttempt(0);
  }

  const url = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

  return (
    <div className={cn("bg-muted/40 relative overflow-hidden", rounded, className)}>
      {status === "loading" && (
        <div className={cn("bg-muted absolute inset-0 animate-pulse", rounded)} aria-hidden />
      )}

      {status === "error" ? (
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            setAttempt((a) => a + 1);
          }}
          className="text-muted-foreground hover:text-foreground absolute inset-0 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors"
        >
          <RefreshCwIcon className="size-4" aria-hidden />
          Retry
        </button>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- remote SVG from DiceBear; next/image can't optimize SVGs and would need per-host config
        <img
          key={url}
          src={url}
          alt={alt}
          loading="lazy"
          onLoad={() => setStatus("loaded")}
          onError={() => {
            if (attempt < 2) setAttempt((a) => a + 1);
            else setStatus("error");
          }}
          className={cn("size-full transition-opacity duration-300", status !== "loaded" && "opacity-0")}
        />
      )}
    </div>
  );
}

export function AvatarTool() {
  const [style, setStyle] = React.useState("adventurer");
  const [seed, setSeed] = React.useState("Forma");
  const [bgMode, setBgMode] = React.useState<"solid" | "gradient">("solid");
  const [bg, setBg] = React.useState<string | null>(null);
  const [bg2, setBg2] = React.useState<string>("#0d9488");
  const [bgRotation, setBgRotation] = React.useState(45);
  const [flip, setFlip] = React.useState(false);
  const [rotate, setRotate] = React.useState(0);
  const [scale, setScale] = React.useState(100);
  const [radius, setRadius] = React.useState(0);

  const currentLabel = STYLES.find((s) => s.id === style)?.label ?? style;

  const opts: Opts = { bgMode, bg, bg2, bgRotation, flip, rotate, scale, radius };
  const mainUrl = avatarUrl(style, seed, opts);

  const variations = React.useMemo(
    () => Array.from({ length: 6 }, (_, i) => `${seed || "Forma"}-${i + 1}`),
    [seed]
  );

  const fileBase = `${style}-${(seed || "avatar").replace(/[^a-z0-9-]+/gi, "-")}`;

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error("Couldn't copy.");
    }
  }

  function surprise() {
    setStyle(STYLES[Math.floor(Math.random() * STYLES.length)].id);
    setSeed(randomSeed());
    const pick = SWATCHES[1 + Math.floor(Math.random() * (SWATCHES.length - 1))].value;
    const gradient = Math.random() > 0.5;
    setBgMode(gradient ? "gradient" : "solid");
    setBg(pick);
    setBg2(SWATCHES[1 + Math.floor(Math.random() * (SWATCHES.length - 1))].value ?? "#0d9488");
    setBgRotation(Math.floor(Math.random() * 360));
    setRotate(0);
    setScale(100);
    setFlip(Math.random() > 0.5);
    setRadius(Math.random() > 0.5 ? 50 : 0);
  }

  function reset() {
    setBgMode("solid");
    setBg(null);
    setFlip(false);
    setRotate(0);
    setScale(100);
    setRadius(0);
  }

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.avatar}
      output={
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>
              {currentLabel} · {seed || "Forma"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-border grid place-items-center rounded-xl border p-6" style={CHECKER}>
              <AvatarImage src={mainUrl} alt={`${currentLabel} avatar for “${seed || "Forma"}”`} className="size-48" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" onClick={() => downloadFile(mainUrl, `${fileBase}.svg`)}>
                <DownloadIcon /> SVG
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadFile(avatarUrl(style, seed, { ...opts, format: "png", size: 512 }), `${fileBase}.png`)
                }
              >
                <DownloadIcon /> PNG
              </Button>
              <Button type="button" variant="outline" onClick={() => copy(mainUrl, "Image URL copied")}>
                <LinkIcon /> Copy URL
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const t = toast.loading("Fetching SVG…");
                  try {
                    const res = await fetch(mainUrl);
                    if (!res.ok) throw new Error();
                    await navigator.clipboard.writeText(await res.text());
                    toast.success("SVG markup copied", { id: t });
                  } catch {
                    toast.error("Couldn't fetch the SVG.", { id: t });
                  }
                }}
              >
                <CodeIcon /> Copy SVG
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">Variations</p>
              <div className="grid grid-cols-6 gap-2">
                {variations.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSeed(v)}
                    className="hover:ring-2 hover:ring-emerald-500/40 rounded-lg transition-shadow"
                    title={`Use “${v}”`}
                  >
                    <AvatarImage src={avatarUrl(style, v, { radius: 12 })} alt={`Variation ${v}`} rounded="rounded-lg" className="aspect-square w-full" />
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      }
      footer={
        <p className="text-muted-foreground text-center text-xs">
          Avatars generated with{" "}
          <a href="https://www.dicebear.com/licenses/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            DiceBear
          </a>{" "}
          — check each style&apos;s license before commercial use.
        </p>
      }
    >
      <div className="space-y-6">
        {/* Identity */}
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="avatar-seed">Name or seed</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="avatar-seed"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="Type any name…"
                  className="min-w-40 flex-1 font-mono"
                />
                <Button type="button" variant="outline" onClick={() => setSeed(randomSeed())}>
                  <DicesIcon /> Random
                </Button>
                <Button type="button" onClick={surprise} className="bg-emerald-600 text-white hover:bg-emerald-600/90">
                  <SparklesIcon /> Surprise me
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                The same name always makes the same avatar — great for consistent profile pictures.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Background */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Background</CardTitle>
            <Tabs value={bgMode} onValueChange={(v) => setBgMode(v as "solid" | "gradient")}>
              <TabsList>
                <TabsTrigger value="solid">Solid</TabsTrigger>
                <TabsTrigger value="gradient">Gradient</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{bgMode === "gradient" ? "Color one" : "Color"}</Label>
              <div className="flex flex-wrap items-center gap-2">
                {SWATCHES.map((s) => {
                  const selected = bg === s.value;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setBg(s.value)}
                      className={cn(
                        "size-8 rounded-full border transition-transform hover:scale-105",
                        selected ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background" : "border-border"
                      )}
                      style={s.value ? { backgroundColor: s.value } : { ...CHECKER, backgroundSize: "8px 8px", backgroundPosition: "0 0,0 4px,4px -4px,-4px 0" }}
                      title={s.label}
                      aria-label={s.label}
                      aria-pressed={selected}
                    />
                  );
                })}
                <label className="border-border ml-1 inline-flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border">
                  <input
                    type="color"
                    value={bg && bg.startsWith("#") ? bg : "#10b981"}
                    onChange={(e) => setBg(e.target.value)}
                    className="size-10 cursor-pointer border-0 bg-transparent p-0"
                    aria-label="Custom color"
                  />
                </label>
              </div>
            </div>

            {bgMode === "gradient" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Color two</Label>
                  <label className="border-border inline-flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border">
                    <input
                      type="color"
                      value={bg2}
                      onChange={(e) => setBg2(e.target.value)}
                      className="size-10 cursor-pointer border-0 bg-transparent p-0"
                      aria-label="Second gradient color"
                    />
                  </label>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Gradient angle</Label>
                    <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{bgRotation}°</span>
                  </div>
                  <Slider value={[bgRotation]} min={0} max={360} step={5} onValueChange={([v]) => setBgRotation(v)} aria-label="Gradient angle" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Transform */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Transform</CardTitle>
            <button type="button" onClick={reset} className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-4 hover:underline">
              Reset
            </button>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="border-border hover:bg-muted/40 flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors">
              <span className="flex items-center gap-2 text-sm font-medium">
                <FlipHorizontal2Icon className="text-muted-foreground size-4" aria-hidden />
                Flip horizontally
              </span>
              <Switch checked={flip} onCheckedChange={setFlip} aria-label="Flip horizontally" />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm">
                  <RotateCwIcon className="text-muted-foreground size-4" aria-hidden />
                  Rotate
                </Label>
                <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{rotate}°</span>
              </div>
              <Slider value={[rotate]} min={0} max={360} step={5} onValueChange={([v]) => setRotate(v)} aria-label="Rotate" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Scale</Label>
                <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{scale}%</span>
              </div>
              <Slider value={[scale]} min={50} max={150} step={5} onValueChange={([v]) => setScale(v)} aria-label="Scale" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Corner radius</Label>
                <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs tabular-nums">{radius}</span>
              </div>
              <Slider value={[radius]} min={0} max={50} step={1} onValueChange={([v]) => setRadius(v)} aria-label="Corner radius" />
            </div>
          </CardContent>
        </Card>

        {/* Style browser */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Style</CardTitle>
            <CardDescription>Pick an art style — your name stays the same across all of them.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {STYLES.map((s) => {
                const selected = s.id === style;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    className={cn(
                      "group flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-colors",
                      selected ? "border-emerald-500/60 bg-emerald-500/5" : "border-border/60 hover:border-emerald-500/40"
                    )}
                    aria-pressed={selected}
                  >
                    <AvatarImage src={avatarUrl(s.id, seed, { radius: 12 })} alt={`${s.label} style`} rounded="rounded-lg" className="size-14" />
                    <span className={cn("w-full truncate text-center text-[11px] font-medium", selected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}
