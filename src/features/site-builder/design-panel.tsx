"use client";

import { CheckIcon, ShuffleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  FONTS, THEME_PRESETS, ratioOn, readableOn, themeTokens, type Theme,
} from "@/lib/site-builder";

interface DesignPanelProps {
  theme: Theme;
  onChange: (patch: Partial<Theme>, tag?: string) => void;
}

const PALETTE = [
  "#0f766e", "#15803d", "#1d4ed8", "#4338ca", "#6d28d9", "#be185d",
  "#b91c1c", "#ea580c", "#a16207", "#0f172a", "#334155", "#0891b2",
];

export function DesignPanel({ theme, onChange }: DesignPanelProps) {
  const tokens = themeTokens(theme);
  const buttonRatio = ratioOn(readableOn(theme.brand), theme.brand);
  const textRatio = ratioOn(tokens["--body"], tokens["--canvas"]);

  const surprise = () => {
    const preset = THEME_PRESETS[Math.floor(Math.random() * THEME_PRESETS.length)];
    const font = FONTS[Math.floor(Math.random() * FONTS.length)].id;
    onChange({ ...preset.theme, font });
  };

  return (
    <div className="space-y-5 px-4 py-4">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Ready-made looks</Label>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={surprise}>
            <ShuffleIcon className="size-3" />
            Surprise me
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {THEME_PRESETS.map((preset) => {
            const active = preset.theme.brand === theme.brand && preset.theme.scheme === theme.scheme;
            return (
              <button
                key={preset.id}
                onClick={() => onChange(preset.theme)}
                title={preset.name}
                className={cn(
                  "group relative overflow-hidden rounded-lg border p-1.5 transition-colors",
                  active ? "border-primary" : "border-border hover:border-foreground/30",
                )}
              >
                <span
                  className="block h-8 w-full rounded"
                  style={{ background: `linear-gradient(135deg, ${preset.theme.brand} 55%, ${preset.theme.accent} 55%)` }}
                />
                <span className="text-muted-foreground group-hover:text-foreground mt-1 block truncate text-[10px]">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <Label className="text-xs" htmlFor="sb-brand">Brand colour</Label>
        <div className="flex items-center gap-2">
          <input
            id="sb-brand"
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(theme.brand) ? theme.brand : "#0f766e"}
            onChange={(event) => onChange({ brand: event.target.value }, "brand")}
            className="border-border size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
            aria-label="Brand colour"
          />
          <Input
            value={theme.brand}
            onChange={(event) => onChange({ brand: event.target.value }, "brand")}
            className="h-9 font-mono text-xs"
            aria-label="Brand colour hex"
          />
        </div>
        <div className="grid grid-cols-12 gap-1">
          {PALETTE.map((color) => (
            <button
              key={color}
              aria-label={`Use ${color}`}
              onClick={() => onChange({ brand: color })}
              className={cn("h-5 rounded transition-transform hover:scale-110", theme.brand.toLowerCase() === color && "ring-foreground ring-2 ring-offset-1")}
              style={{ background: color }}
            />
          ))}
        </div>

        <div className="bg-muted/50 space-y-1 rounded-lg p-2.5 text-[11px]">
          <Readout label="Button text" ratio={buttonRatio} />
          <Readout label="Body text" ratio={textRatio} />
        </div>
      </section>

      <section className="space-y-2">
        <Label className="text-xs" htmlFor="sb-accent">Accent colour</Label>
        <div className="flex items-center gap-2">
          <input
            id="sb-accent"
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(theme.accent) ? theme.accent : "#f59e0b"}
            onChange={(event) => onChange({ accent: event.target.value }, "accent")}
            className="border-border size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
            aria-label="Accent colour"
          />
          <p className="text-muted-foreground text-[11px] leading-4">Used for stars, highlights and small details.</p>
        </div>
      </section>

      <Segmented
        label="Page mood"
        value={theme.scheme}
        options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
        onChange={(value) => onChange({ scheme: value as Theme["scheme"] })}
      />

      <section className="space-y-2">
        <Label className="text-xs">Typeface</Label>
        <div className="grid gap-1.5">
          {FONTS.map((font) => (
            <button
              key={font.id}
              onClick={() => onChange({ font: font.id })}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                theme.font === font.id ? "border-primary bg-primary/10" : "border-border hover:border-foreground/30",
              )}
            >
              <span>
                <span className="block text-xs font-medium">{font.name}</span>
                <span className="text-muted-foreground block text-[11px] leading-4">{font.note}</span>
              </span>
              {theme.font === font.id && <CheckIcon className="text-primary size-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      </section>

      <Segmented label="Headline size" value={theme.headings} options={[{ value: "tight", label: "Small" }, { value: "regular", label: "Regular" }, { value: "display", label: "Huge" }]} onChange={(value) => onChange({ headings: value as Theme["headings"] })} />
      <Segmented label="Spacing" value={theme.density} options={[{ value: "tight", label: "Tight" }, { value: "regular", label: "Regular" }, { value: "airy", label: "Airy" }]} onChange={(value) => onChange({ density: value as Theme["density"] })} />
      <Segmented label="Corners" value={theme.radius} options={[{ value: "square", label: "Sharp" }, { value: "soft", label: "Soft" }, { value: "round", label: "Round" }, { value: "pill", label: "Pill" }]} onChange={(value) => onChange({ radius: value as Theme["radius"] })} />
      <Segmented label="Buttons" value={theme.buttons} options={[{ value: "solid", label: "Solid" }, { value: "soft", label: "Soft" }, { value: "outline", label: "Outline" }]} onChange={(value) => onChange({ buttons: value as Theme["buttons"] })} />
      <Segmented label="Depth" value={theme.shadow} options={[{ value: "none", label: "Flat" }, { value: "soft", label: "Soft" }, { value: "lifted", label: "Lifted" }]} onChange={(value) => onChange({ shadow: value as Theme["shadow"] })} />
      <Segmented label="Page width" value={theme.width} options={[{ value: "narrow", label: "Narrow" }, { value: "regular", label: "Regular" }, { value: "wide", label: "Wide" }]} onChange={(value) => onChange({ width: value as Theme["width"] })} />
      <Segmented label="Behind the hero" value={theme.pattern} options={[{ value: "none", label: "Nothing" }, { value: "dots", label: "Dots" }, { value: "grid", label: "Grid" }, { value: "glow", label: "Glow" }, { value: "rays", label: "Rays" }]} onChange={(value) => onChange({ pattern: value as Theme["pattern"] })} />

      <div className="border-border/70 flex items-center justify-between gap-3 border-t pt-4">
        <div>
          <Label htmlFor="sb-animate" className="text-xs">Fade sections in</Label>
          <p className="text-muted-foreground text-[11px] leading-4">Respects reduced-motion settings.</p>
        </div>
        <Switch id="sb-animate" checked={theme.animate} onCheckedChange={(next) => onChange({ animate: next })} />
      </div>
    </div>
  );
}

function Readout({ label, ratio }: { label: string; ratio: number }) {
  const pass = ratio >= 4.5;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums", pass ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
        {ratio.toFixed(1)}:1 {pass ? "easy to read" : "hard to read"}
      </span>
    </div>
  );
}

function Segmented({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <section className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="bg-muted/60 flex gap-0.5 rounded-lg p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-md px-1.5 py-1.5 text-[11px] transition-colors",
              value === option.value ? "bg-background text-foreground shadow-xs font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
