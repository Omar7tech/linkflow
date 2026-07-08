"use client";

import * as React from "react";
import { CheckIcon, DicesIcon, MoonIcon, SunIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import { useCopy } from "@/hooks/useCopy";
import {
  buildTheme,
  randomBrandHex,
  RAMP_STEPS,
  themeToCss,
  themeToJson,
  themeToShadcn,
  themeToTailwind,
  VIBES,
  type NeutralTint,
  type Theme,
  type VibeId,
} from "@/lib/foundry";
import { cn } from "@/lib/utils";

const NEUTRALS: { id: NeutralTint; label: string }[] = [
  { id: "tinted", label: "Brand-tinted" },
  { id: "pure", label: "Pure gray" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
];

const RATIOS: { value: number | undefined; label: string }[] = [
  { value: undefined, label: "Auto" },
  { value: 1.2, label: "1.200" },
  { value: 1.25, label: "1.250" },
  { value: 1.333, label: "1.333" },
  { value: 1.414, label: "1.414" },
];

export function FoundryTool() {
  const [brandHex, setBrandHex] = React.useState("#10b981");
  const [hexField, setHexField] = React.useState("#10b981");
  const [vibe, setVibe] = React.useState<VibeId>("minimal");
  const [neutral, setNeutral] = React.useState<NeutralTint>("tinted");
  const [ratio, setRatio] = React.useState<number | undefined>(undefined);
  const [dark, setDark] = React.useState(false);

  const theme = React.useMemo(
    () => buildTheme({ brandHex, vibe, neutral, ratio }),
    [brandHex, vibe, neutral, ratio]
  );

  // Load the vibe's Google Fonts pair for the live preview.
  React.useEffect(() => {
    const families = [...new Set([theme.vibe.headingFont, theme.vibe.bodyFont])]
      .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700`)
      .join("&");
    const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    let link = document.getElementById("foundry-fonts") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "foundry-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [theme.vibe]);

  const applyHex = (raw: string) => {
    setHexField(raw);
    const value = raw.trim().startsWith("#") ? raw.trim() : `#${raw.trim()}`;
    if (/^#[0-9a-fA-F]{6}$/.test(value)) setBrandHex(value.toLowerCase());
  };

  const roll = () => {
    const hex = randomBrandHex();
    setBrandHex(hex);
    setHexField(hex);
  };

  const exports = [
    { id: "css", name: "CSS", code: themeToCss(theme) },
    { id: "tailwind", name: "Tailwind v4", code: themeToTailwind(theme) },
    { id: "shadcn", name: "shadcn/ui", code: themeToShadcn(theme) },
    { id: "json", name: "JSON", code: themeToJson(theme) },
  ];

  return (
    <GeneratorLayout tool={TOOL_BY_ID.foundry} output={null}>
      <div className="space-y-6">
        {/* Controls */}
        <Card>
          <CardContent className="grid gap-6 lg:grid-cols-[auto_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="foundry-hex">Brand color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandHex}
                  onChange={(e) => applyHex(e.target.value)}
                  aria-label="Pick brand color"
                  className="border-border size-9 cursor-pointer rounded-lg border bg-transparent p-0.5"
                />
                <Input
                  id="foundry-hex"
                  value={hexField}
                  onChange={(e) => applyHex(e.target.value)}
                  className="w-28 font-mono"
                  spellCheck={false}
                />
                <Button variant="outline" size="icon" onClick={roll} aria-label="Random color">
                  <DicesIcon />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <PillGroup
                label="Vibe"
                options={VIBES.map((v) => ({ key: v.id, label: v.label }))}
                selected={vibe}
                onSelect={(k) => setVibe(k as VibeId)}
              />
              <PillGroup
                label="Neutrals"
                options={NEUTRALS.map((n) => ({ key: n.id, label: n.label }))}
                selected={neutral}
                onSelect={(k) => setNeutral(k as NeutralTint)}
              />
              <PillGroup
                label="Type scale"
                options={RATIOS.map((r) => ({ key: r.label, label: r.label }))}
                selected={RATIOS.find((r) => r.value === ratio)!.label}
                onSelect={(k) => setRatio(RATIOS.find((r) => r.label === k)?.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Live preview</CardTitle>
              <CardDescription>
                A mini product page rendered purely from your generated tokens.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDark((d) => !d)}
              aria-pressed={dark}
            >
              {dark ? <SunIcon /> : <MoonIcon />}
              {dark ? "Light" : "Dark"}
            </Button>
          </CardHeader>
          <CardContent>
            <Preview theme={theme} dark={dark} />
          </CardContent>
        </Card>

        {/* Ramps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Color ramps</CardTitle>
            <CardDescription>
              Perceptually even OKLCH scales — your color anchored into an 11-step ramp, neutrals
              and semantics matched to it. Click any step to copy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(
              [
                ["brand", "Brand"],
                ["neutral", "Neutral"],
                ["success", "Success"],
                ["warning", "Warning"],
                ["danger", "Danger"],
              ] as const
            ).map(([key, label]) => (
              <RampRow key={key} label={label} ramp={theme.ramps[key]} />
            ))}
            <p className="text-muted-foreground text-xs">
              Primary button text passes WCAG at{" "}
              <span className="text-foreground font-mono font-medium">
                {theme.primaryContrast.toFixed(2)}:1
              </span>{" "}
              — chosen by measured contrast, not guesswork.
            </p>
          </CardContent>
        </Card>

        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export</CardTitle>
            <CardDescription>
              The shadcn/ui block themes an entire shadcn app — paste it into globals.css and
              you&apos;re done.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="css">
              <TabsList className="w-full">
                {exports.map((e) => (
                  <TabsTrigger key={e.id} value={e.id} className="flex-1">
                    {e.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {exports.map((e) => (
                <TabsContent key={e.id} value={e.id}>
                  <div className="relative">
                    <pre className="bg-muted/50 border-border max-h-80 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed">
                      {e.code}
                    </pre>
                    <CopyButton
                      text={e.code}
                      label=""
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1.5 right-1.5"
                      successMessage={`${e.name} copied`}
                      aria-label={`Copy ${e.name}`}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

/* ------------------------------------------------------------- controls */

function PillGroup({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onSelect(option.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              selected === option.key
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RampRow({ label, ramp }: { label: string; ramp: Theme["ramps"]["brand"] }) {
  const { copy } = useCopy();
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground w-16 shrink-0 text-xs font-medium">{label}</span>
      <div className="grid flex-1 grid-cols-11 overflow-hidden rounded-lg">
        {RAMP_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => void copy(ramp[step], `${ramp[step]} copied`)}
            className="group relative h-9 transition-transform hover:z-10 hover:scale-110"
            style={{ backgroundColor: ramp[step] }}
            title={`${label.toLowerCase()}-${step}: ${ramp[step]}`}
          >
            <span className="sr-only">
              {label} {step} {ramp[step]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- preview */

function Preview({ theme, dark }: { theme: Theme; dark: boolean }) {
  const t = dark ? theme.dark : theme.light;
  const v = theme.vibe;
  const heading = `"${v.headingFont}", ui-sans-serif, sans-serif`;
  const body = `"${v.bodyFont}", ui-sans-serif, sans-serif`;
  const size = (name: string) => `${theme.type.find((s) => s.name === name)?.px ?? 16}px`;
  const transition = `all ${v.duration} ${v.easing}`;

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        backgroundColor: t.background,
        borderColor: t.border,
        color: t.foreground,
        fontFamily: body,
        transition,
      }}
    >
      {/* Nav */}
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: t.border }}
      >
        <div className="flex items-center gap-2">
          <span className="size-5" style={{ backgroundColor: t.primary, borderRadius: v.radius.sm }} />
          <span style={{ fontFamily: heading, fontWeight: v.headingWeight, fontSize: size("base") }}>
            Acme
          </span>
        </div>
        <div
          className="hidden items-center gap-4 sm:flex"
          style={{ color: t.mutedForeground, fontSize: size("sm") }}
        >
          <span>Product</span>
          <span>Pricing</span>
          <span>Docs</span>
        </div>
        <span
          className="px-3 py-1.5 font-medium"
          style={{
            backgroundColor: t.primary,
            color: t.primaryForeground,
            borderRadius: v.radius.md,
            fontSize: size("sm"),
            boxShadow: v.shadow.sm,
          }}
        >
          Sign up
        </span>
      </div>

      {/* Hero */}
      <div className="px-5 py-8 text-center sm:py-10">
        <span
          className="inline-block px-3 py-1 font-medium"
          style={{
            backgroundColor: t.accent,
            color: t.accentForeground,
            borderRadius: v.radius.full,
            fontSize: size("xs"),
          }}
        >
          Now in public beta
        </span>
        <h3
          className="mx-auto mt-3 max-w-md text-balance"
          style={{
            fontFamily: heading,
            fontWeight: v.headingWeight,
            fontSize: size("4xl"),
            lineHeight: 1.12,
          }}
        >
          Ship your next idea twice as fast
        </h3>
        <p
          className="mx-auto mt-3 max-w-sm"
          style={{ color: t.mutedForeground, fontSize: size("base"), lineHeight: 1.55 }}
        >
          Everything on this page — colors, type, spacing, corners, shadows — comes from your
          theme.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <span
            className="px-4 py-2 font-medium"
            style={{
              backgroundColor: t.primary,
              color: t.primaryForeground,
              borderRadius: v.radius.md,
              fontSize: size("sm"),
              boxShadow: v.shadow.md,
              transition,
            }}
          >
            Get started
          </span>
          <span
            className="border px-4 py-2 font-medium"
            style={{
              borderColor: t.border,
              color: t.foreground,
              backgroundColor: t.card,
              borderRadius: v.radius.md,
              fontSize: size("sm"),
            }}
          >
            Live demo
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-4 px-5 pb-6 sm:grid-cols-3">
        <div
          className="border p-4"
          style={{
            backgroundColor: t.card,
            borderColor: t.border,
            borderRadius: v.radius.lg,
            boxShadow: v.shadow.sm,
          }}
        >
          <p style={{ color: t.mutedForeground, fontSize: size("xs") }}>Monthly revenue</p>
          <p
            className="mt-1"
            style={{ fontFamily: heading, fontWeight: v.headingWeight, fontSize: size("2xl") }}
          >
            $48,210
          </p>
          <div className="mt-3 flex items-end gap-1">
            {[38, 52, 44, 66, 58, 80, 72, 96].map((h, i) => (
              <span
                key={i}
                className="flex-1"
                style={{
                  height: h / 2.6,
                  backgroundColor: i === 7 ? t.primary : t.muted,
                  borderRadius: v.radius.sm,
                }}
              />
            ))}
          </div>
        </div>

        <div
          className="border p-4"
          style={{
            backgroundColor: t.card,
            borderColor: t.border,
            borderRadius: v.radius.lg,
            boxShadow: v.shadow.sm,
          }}
        >
          <p className="font-medium" style={{ fontSize: size("sm") }}>
            Join the waitlist
          </p>
          <span
            className="mt-2 block border px-3 py-2"
            style={{
              borderColor: t.input,
              color: t.mutedForeground,
              borderRadius: v.radius.md,
              fontSize: size("sm"),
              backgroundColor: t.background,
            }}
          >
            you@company.com
          </span>
          <span
            className="mt-2 block px-3 py-2 text-center font-medium"
            style={{
              backgroundColor: t.primary,
              color: t.primaryForeground,
              borderRadius: v.radius.md,
              fontSize: size("sm"),
            }}
          >
            Notify me
          </span>
        </div>

        <div
          className="border p-4"
          style={{
            backgroundColor: t.card,
            borderColor: t.border,
            borderRadius: v.radius.lg,
            boxShadow: v.shadow.sm,
          }}
        >
          <p className="font-medium" style={{ fontSize: size("sm") }}>
            System status
          </p>
          <div className="mt-2.5 space-y-2" style={{ fontSize: size("xs") }}>
            {[
              ["API", theme.ramps.success[dark ? 400 : 600], "Operational"],
              ["Dashboard", theme.ramps.success[dark ? 400 : 600], "Operational"],
              ["Exports", theme.ramps.warning[dark ? 400 : 600], "Degraded"],
            ].map(([name, color, status]) => (
              <div key={name} className="flex items-center justify-between">
                <span style={{ color: t.mutedForeground }}>{name}</span>
                <span className="flex items-center gap-1.5" style={{ color }}>
                  <CheckIcon className="size-3" /> {status}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-1.5">
            <Badge
              style={{
                backgroundColor: t.accent,
                color: t.accentForeground,
                borderRadius: v.radius.full,
              }}
              className="border-0"
            >
              v2.4
            </Badge>
            <Badge
              style={{
                backgroundColor: t.muted,
                color: t.mutedForeground,
                borderRadius: v.radius.full,
              }}
              className="border-0"
            >
              {theme.vibe.label}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
