"use client";

import * as React from "react";
import {
  ArrowLeftRightIcon,
  CheckIcon,
  ContrastIcon,
  PipetteIcon,
  ShuffleIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import { rgbString, rgbToHsl, type RGB } from "@/lib/colorExtract";
import {
  accessibleSuggestions,
  apcaLc,
  apcaVerdict,
  contrastRatio,
  overallGrade,
  parseHex,
  randomAccessiblePair,
  toHex,
  wcagLevels,
} from "@/lib/contrast";
import { cn } from "@/lib/utils";

type Slot = "fg" | "bg";

export function ContrastTool() {
  const [fg, setFg] = React.useState<RGB>([31, 41, 55]); // slate-800
  const [bg, setBg] = React.useState<RGB>([255, 255, 255]);

  const ratio = contrastRatio(fg, bg);
  const levels = wcagLevels(ratio);
  const grade = overallGrade(ratio);
  const lc = apcaLc(fg, bg);
  const suggestions = accessibleSuggestions(toHex(fg), bg);
  const passesAA = levels.aaNormal;

  const setSlot = (slot: Slot, rgb: RGB) => (slot === "fg" ? setFg(rgb) : setBg(rgb));
  const swap = () => {
    setFg(bg);
    setBg(fg);
  };
  const random = () => {
    const pair = randomAccessiblePair();
    setFg(pair.fg);
    setBg(pair.bg);
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.contrast}
      output={
        <ResultPanel
          ratio={ratio}
          grade={grade}
          levels={levels}
          lc={lc}
          fg={fg}
          bg={bg}
          passesAA={passesAA}
          suggestions={suggestions}
          onApplyFg={setFg}
        />
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ContrastIcon className="text-primary size-4" />
                  Colors
                </CardTitle>
                <CardDescription>Pick a text and background color to compare.</CardDescription>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button variant="outline" size="sm" onClick={swap} title="Swap colors">
                  <ArrowLeftRightIcon className="size-3.5" /> Swap
                </Button>
                <Button variant="outline" size="sm" onClick={random} title="Random accessible pair">
                  <ShuffleIcon className="size-3.5" /> Random
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <ColorField label="Text" value={fg} onChange={(rgb) => setSlot("fg", rgb)} />
            <ColorField label="Background" value={bg} onChange={(rgb) => setSlot("bg", rgb)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SparklesIcon className="text-primary size-4" />
              Preview
            </CardTitle>
            <CardDescription>How real content reads at these colors.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="space-y-4 rounded-xl border p-6 transition-colors"
              style={{ backgroundColor: rgbString(bg), color: rgbString(fg), borderColor: rgbString(fg) + "22" }}
            >
              <p className="text-3xl font-bold tracking-tight">Large heading text</p>
              <p className="text-base leading-relaxed">
                The quick brown fox jumps over the lazy dog. Small body copy at 16px shows whether
                paragraphs stay comfortable to read at these two colors.
              </p>
              <p className="text-sm leading-relaxed opacity-90">
                Secondary 14px text — the most common failure point for contrast.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span
                  className="rounded-lg border px-3 py-1.5 text-sm font-semibold"
                  style={{ borderColor: rgbString(fg) }}
                >
                  Outlined button
                </span>
                <span
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold"
                  style={{ backgroundColor: rgbString(fg), color: rgbString(bg) }}
                >
                  Solid button
                </span>
                <a href="#" onClick={(e) => e.preventDefault()} className="text-sm font-semibold underline underline-offset-4">
                  A text link
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

/* ------------------------------- Color field ------------------------------ */

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: RGB;
  onChange: (rgb: RGB) => void;
}) {
  const hex = toHex(value);
  const [draft, setDraft] = React.useState(hex);
  // Sync the editable draft when the upstream color changes (picker, swap, fix).
  const [lastHex, setLastHex] = React.useState(hex);
  if (hex !== lastHex) {
    setLastHex(hex);
    setDraft(hex);
  }

  const commit = (raw: string) => {
    const rgb = parseHex(raw);
    if (rgb) onChange(rgb);
    else setDraft(hex);
  };

  const eyedrop = async () => {
    const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!EyeDropperCtor) {
      toast.error("Your browser doesn't support the eyedropper");
      return;
    }
    try {
      const { sRGBHex } = await new EyeDropperCtor().open();
      const rgb = parseHex(sRGBHex);
      if (rgb) onChange(rgb);
    } catch {
      /* user cancelled */
    }
  };

  const [h, s, l] = rgbToHsl(value);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <label
          className="border-border relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border"
          style={{ backgroundColor: rgbString(value) }}
          title="Open color picker"
        >
          <input
            type="color"
            value={hex}
            onChange={(e) => commit(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label={`${label} color picker`}
          />
        </label>
        <div className="relative flex-1">
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm">
            #
          </span>
          <Input
            value={draft.replace(/^#/, "")}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="pl-7 font-mono uppercase"
            spellCheck={false}
            aria-label={`${label} hex value`}
          />
        </div>
        <Button variant="outline" size="icon" onClick={eyedrop} title="Pick from screen" aria-label="Eyedropper">
          <PipetteIcon className="size-4" />
        </Button>
      </div>
      <p className="text-muted-foreground font-mono text-[11px]">
        {rgbString(value)} · hsl({h}, {s}%, {l}%)
      </p>
    </div>
  );
}

/* ------------------------------ Result panel ------------------------------ */

function ResultPanel({
  ratio,
  grade,
  levels,
  lc,
  fg,
  bg,
  passesAA,
  suggestions,
  onApplyFg,
}: {
  ratio: number;
  grade: ReturnType<typeof overallGrade>;
  levels: ReturnType<typeof wcagLevels>;
  lc: number;
  fg: RGB;
  bg: RGB;
  passesAA: boolean;
  suggestions: { aa: RGB; aaa: RGB };
  onApplyFg: (rgb: RGB) => void;
}) {
  const pass = grade !== "Fail";
  return (
    <Card className="overflow-hidden">
      {/* Headline verdict on the live colors */}
      <div
        className="flex flex-col items-center gap-1 px-6 py-7 text-center"
        style={{ backgroundColor: rgbString(bg), color: rgbString(fg) }}
      >
        <span className="font-heading text-5xl font-bold tracking-tight tabular-nums">
          {ratio.toFixed(2)}
          <span className="text-2xl font-semibold opacity-70">:1</span>
        </span>
        <span
          className={cn(
            "mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
            pass ? "bg-emerald-500/20" : "bg-red-500/20"
          )}
        >
          {pass ? <CheckIcon className="size-3.5" /> : <XIcon className="size-3.5" />}
          {pass ? `Passes ${grade}` : "Fails WCAG"}
        </span>
      </div>

      <CardContent className="space-y-5 pt-5">
        <div className="grid grid-cols-2 gap-2">
          <LevelBadge label="AA · Normal text" hint="≥ 4.5:1" pass={levels.aaNormal} />
          <LevelBadge label="AA · Large text" hint="≥ 3:1" pass={levels.aaLarge} />
          <LevelBadge label="AAA · Normal text" hint="≥ 7:1" pass={levels.aaaNormal} />
          <LevelBadge label="AAA · Large text" hint="≥ 4.5:1" pass={levels.aaaLarge} />
          <LevelBadge label="UI & graphics" hint="≥ 3:1" pass={levels.uiComponent} className="col-span-2" />
        </div>

        {/* Modern APCA metric */}
        <div className="border-border/60 flex items-center justify-between rounded-lg border px-3 py-2">
          <div>
            <p className="text-sm font-semibold">
              APCA <span className="text-muted-foreground font-normal">Lc {Math.round(lc)}</span>
            </p>
            <p className="text-muted-foreground text-xs">WCAG 3 perceptual contrast</p>
          </div>
          <span className="text-muted-foreground text-right text-xs font-medium">{apcaVerdict(lc)}</span>
        </div>

        {/* Smart fix */}
        {!passesAA && (
          <div className="border-primary/30 bg-primary/5 space-y-3 rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <SparklesIcon className="text-primary size-4" /> Smart fix
            </p>
            <p className="text-muted-foreground text-xs">
              Closest accessible text color — same hue, adjusted lightness.
            </p>
            <div className="flex flex-wrap gap-2">
              <FixChip label="AA" rgb={suggestions.aa} bg={bg} onApply={() => onApplyFg(suggestions.aa)} />
              <FixChip label="AAA" rgb={suggestions.aaa} bg={bg} onApply={() => onApplyFg(suggestions.aaa)} />
            </div>
          </div>
        )}
        {passesAA && (
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
            <CheckIcon className="size-3.5 text-emerald-500" /> Meets AA for normal body text.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function LevelBadge({
  label,
  hint,
  pass,
  className,
}: {
  label: string;
  hint: string;
  pass: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2",
        pass
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-red-500/40 bg-red-500/10",
        className
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">{label}</p>
        <p className="text-muted-foreground font-mono text-[10px]">{hint}</p>
      </div>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full",
          pass ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
        )}
      >
        {pass ? <CheckIcon className="size-3.5" /> : <XIcon className="size-3.5" />}
      </span>
    </div>
  );
}

function FixChip({
  label,
  rgb,
  bg,
  onApply,
}: {
  label: string;
  rgb: RGB;
  bg: RGB;
  onApply: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onApply}
      className="border-border hover:border-primary group flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 transition-colors"
      title={`Apply ${toHex(rgb)}`}
    >
      <span
        className="flex size-7 items-center justify-center rounded-md text-[11px] font-bold"
        style={{ backgroundColor: rgbString(bg), color: rgbString(rgb) }}
      >
        Aa
      </span>
      <span className="text-left">
        <span className="block text-xs font-bold">{label}</span>
        <span className="text-muted-foreground block font-mono text-[10px] uppercase">{toHex(rgb)}</span>
      </span>
    </button>
  );
}
