"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  EyeIcon,
  ImageUpIcon,
  Trash2Icon,
  XCircleIcon,
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
import { Slider } from "@/components/ui/slider";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useHistory } from "@/hooks/useHistory";
import { analyzeLogo, reportToText, type Finding, type Grade, type LogoReport } from "@/lib/logo-test";
import { cn } from "@/lib/utils";

const ANALYZE_CAP = 256;

const BACKDROPS: { name: string; bg: string; dark: boolean }[] = [
  { name: "White", bg: "#ffffff", dark: false },
  { name: "Light gray", bg: "#f1f1f1", dark: false },
  { name: "Cream", bg: "#f5f0e6", dark: false },
  { name: "Slate", bg: "#334155", dark: true },
  { name: "Black", bg: "#000000", dark: true },
  { name: "Emerald", bg: "#10b981", dark: true },
  { name: "Indigo", bg: "#4f46e5", dark: true },
  { name: "Gradient", bg: "linear-gradient(135deg,#34d399,#22d3ee,#818cf8)", dark: true },
  {
    name: "Busy",
    bg: "repeating-conic-gradient(#e5e5e5 0 25%, #ffffff 0 50%) 0 0 / 28px 28px",
    dark: false,
  },
];

const SIZES = [16, 24, 32, 48, 64, 128];

export function LogoTool() {
  const history = useHistory("logo");
  const [src, setSrc] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [report, setReport] = React.useState<LogoReport | null>(null);
  const [squint, setSquint] = React.useState(4);
  const [dragOver, setDragOver] = React.useState(false);

  const loadFile = React.useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file (PNG, SVG, JPG)");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, ANALYZE_CAP / Math.max(img.naturalWidth, img.naturalHeight));
      const cw = Math.max(1, Math.round(img.naturalWidth * scale));
      const ch = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        toast.error("Canvas unavailable");
        return;
      }
      ctx.drawImage(img, 0, 0, cw, ch);
      const data = ctx.getImageData(0, 0, cw, ch);
      const r = analyzeLogo(data, img.naturalWidth, img.naturalHeight);
      setReport(r);
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setName(file.name);
      history.add(`${file.name} · ${r.score}/100 (${r.grade})`, reportToText(r));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("Couldn't read that image");
    };
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- history.add is stable
  }, []);

  React.useEffect(() => () => {
    if (src) URL.revokeObjectURL(src);
  }, [src]);

  const reset = () => {
    setReport(null);
    setSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setName("");
  };

  if (!src || !report) {
    return (
      <GeneratorLayout tool={TOOL_BY_ID.logo} output={null} footer={<HistoryPanel history={history} />}>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) loadFile(file);
          }}
          className={cn(
            "border-border hover:border-primary/60 flex min-h-72 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors",
            dragOver && "border-primary bg-primary/5"
          )}
        >
          <span className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl">
            <ImageUpIcon className="size-6" />
          </span>
          <div>
            <p className="font-heading text-lg font-bold">Drop your logo to test it</p>
            <p className="text-muted-foreground mt-1 text-sm">
              PNG, SVG or JPG. Everything is analyzed on your device — nothing is uploaded.
            </p>
          </div>
          <span className="bg-primary text-primary-foreground mt-2 rounded-full px-5 py-2 text-sm font-semibold">
            Choose file
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) loadFile(file);
            }}
          />
        </label>
      </GeneratorLayout>
    );
  }

  return (
    <GeneratorLayout tool={TOOL_BY_ID.logo} output={null} footer={<HistoryPanel history={history} />}>
      <div className="space-y-6">
        {/* Header: file + reset */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="border-border flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-[repeating-conic-gradient(#e5e5e5_0_25%,#fff_0_50%)] bg-[length:12px_12px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- user data URL */}
              <img src={src} alt={name} className="size-full object-contain p-1" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="text-muted-foreground text-xs">
                {report.width}×{report.height} · {report.transparentBg ? "transparent" : (report.bgHex ?? "solid")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <CopyButton text={reportToText(report)} label="Report" variant="outline" size="sm" successMessage="Report copied" />
            <Button variant="outline" size="sm" onClick={reset}>
              <Trash2Icon className="size-3.5" /> New
            </Button>
          </div>
        </div>

        <ScoreCard report={report} />

        {/* Background matrix */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Background test</CardTitle>
            <CardDescription>The single most important check: does it hold up everywhere?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {BACKDROPS.map((b) => (
                <div key={b.name} className="space-y-1.5">
                  <div
                    className="border-border flex aspect-square items-center justify-center overflow-hidden rounded-xl border p-4"
                    style={{ background: b.bg }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- user data URL */}
                    <img src={src} alt={`Logo on ${b.name}`} className="max-h-full max-w-full object-contain" />
                  </div>
                  <p className="text-muted-foreground text-center text-[11px]">{b.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scale ramp */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scalability</CardTitle>
            <CardDescription>
              Actual favicon-to-icon sizes. We estimate it stays legible to ~{report.minLegibleSize}px.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Light", bg: "#ffffff", pad: "" },
              { label: "Dark", bg: "#0a0a0a", pad: "" },
            ].map((row) => (
              <div
                key={row.label}
                className="border-border flex flex-wrap items-end gap-5 overflow-x-auto rounded-xl border p-4"
                style={{ background: row.bg }}
              >
                {SIZES.map((s) => (
                  <div key={s} className="flex flex-col items-center gap-1.5">
                    <div className="flex items-end" style={{ height: 64 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- user data URL */}
                      <img
                        src={src}
                        alt={`${s}px`}
                        style={{ width: s, height: s, objectFit: "contain" }}
                        className={cn(s < report.minLegibleSize && "ring-1 ring-amber-400/70")}
                      />
                    </div>
                    <span className={cn("font-mono text-[10px]", row.bg === "#0a0a0a" ? "text-white/60" : "text-black/50")}>
                      {s}px
                    </span>
                  </div>
                ))}
              </div>
            ))}
            <p className="text-muted-foreground text-xs">
              <span className="text-amber-500">Amber ring</span> = below the recommended minimum size.
            </p>
          </CardContent>
        </Card>

        {/* Perception tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <EyeIcon className="text-primary size-4" /> Perception tests
            </CardTitle>
            <CardDescription>
              Squint (silhouette), grayscale (no color crutch) and pure shape.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FilterTile src={src} label={`Blur ${squint}px`} filter={`blur(${squint}px)`} bg="#ffffff" />
              <FilterTile src={src} label="Grayscale" filter="grayscale(1)" bg="#ffffff" />
              <FilterTile src={src} label="Silhouette" filter="brightness(0)" bg="#ffffff" />
              <FilterTile src={src} label="On dark" filter="grayscale(1) invert(1)" bg="#0a0a0a" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Squint amount</span>
                <span className="text-muted-foreground font-mono text-xs">{squint}px</span>
              </div>
              <Slider min={0} max={12} step={1} value={[squint]} onValueChange={([v]) => setSquint(v)} />
            </div>
          </CardContent>
        </Card>

        {/* Context mockups */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">In context</CardTitle>
            <CardDescription>How it lands as a favicon, app icon, avatar and in a nav bar.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {/* Browser tab */}
            <Mock label="Browser tab">
              <div className="bg-muted/60 flex items-center gap-2 rounded-t-lg px-3 pt-2">
                <div className="bg-background flex items-center gap-1.5 rounded-t-md px-2.5 py-1.5 text-xs">
                  <span className="flex size-4 items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- user data URL */}
                    <img src={src} alt="favicon" className="size-4 object-contain" />
                  </span>
                  <span className="text-muted-foreground max-w-24 truncate">{name.replace(/\.[^.]+$/, "")}</span>
                  <XCircleIcon className="text-muted-foreground/50 size-3" />
                </div>
              </div>
              <div className="bg-background h-8 rounded-b-lg" />
            </Mock>

            {/* App icon */}
            <Mock label="App icon">
              <div className="flex items-center justify-center gap-4 py-3">
                <div className="flex size-16 items-center justify-center overflow-hidden rounded-[22%] bg-white p-2.5 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element -- user data URL */}
                  <img src={src} alt="app icon" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex size-16 items-center justify-center overflow-hidden rounded-[22%] bg-neutral-900 p-2.5 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element -- user data URL */}
                  <img src={src} alt="app icon dark" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
            </Mock>

            {/* Social avatar */}
            <Mock label="Social avatar">
              <div className="flex items-center justify-center gap-4 py-3">
                <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-white p-2.5 shadow-md ring-1 ring-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- user data URL */}
                  <img src={src} alt="avatar" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-neutral-900 p-2.5 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element -- user data URL */}
                  <img src={src} alt="avatar dark" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
            </Mock>

            {/* Nav bar */}
            <Mock label="Nav bar">
              <div className="bg-neutral-900 flex h-12 items-center gap-4 rounded-lg px-4">
                <span className="flex h-6 items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- user data URL */}
                  <img src={src} alt="nav logo" className="h-6 max-w-28 object-contain" />
                </span>
                <span className="ml-auto flex gap-3 text-[11px] text-white/50">
                  <span>Home</span>
                  <span>About</span>
                </span>
              </div>
            </Mock>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

/* ------------------------------- Sub-views ------------------------------- */

const GRADE_COLOR: Record<Grade, string> = {
  A: "text-emerald-500",
  B: "text-emerald-500",
  C: "text-amber-500",
  D: "text-orange-500",
  F: "text-red-500",
};

function ScoreCard({ report }: { report: LogoReport }) {
  const r = report;
  const deg = r.score * 3.6;
  const ring = `conic-gradient(currentColor ${deg}deg, var(--muted) ${deg}deg 360deg)`;
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-5">
          <div className={cn("relative grid size-24 shrink-0 place-items-center rounded-full", GRADE_COLOR[r.grade])} style={{ background: ring }}>
            <div className="bg-card absolute inset-1.5 rounded-full" />
            <div className="relative text-center">
              <div className="text-2xl font-bold tabular-nums">{r.score}</div>
              <div className="text-muted-foreground text-[10px]">/ 100</div>
            </div>
          </div>
          <div>
            <div className={cn("font-heading text-3xl font-bold", GRADE_COLOR[r.grade])}>{r.grade}</div>
            <p className="text-muted-foreground max-w-48 text-xs">
              {r.score >= 75
                ? "Strong, versatile mark."
                : r.score >= 60
                  ? "Solid, with a few fixes."
                  : "Needs work to travel well."}
            </p>
            <div className="mt-2 flex gap-1">
              {r.palette.map((s) => (
                <span key={s.hex} className="border-border size-4 rounded-full border" style={{ background: s.hex }} title={s.hex} />
              ))}
            </div>
          </div>
        </div>

        <div className="grid flex-1 gap-x-6 gap-y-2.5 sm:grid-cols-1">
          {r.metrics.map((m) => (
            <div key={m.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{m.label}</span>
                <span className={cn("font-mono", GRADE_COLOR[scoreGrade(m.score)])}>{m.score}</span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div className={cn("h-full rounded-full", barColor(m.score))} style={{ width: `${m.score}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <CardContent className="border-border border-t pt-4">
        <ul className="space-y-2.5">
          {r.findings.map((fnd, i) => (
            <FindingRow key={i} finding={fnd} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const Icon = finding.level === "good" ? CheckCircle2Icon : finding.level === "warn" ? CircleAlertIcon : XCircleIcon;
  const color =
    finding.level === "good" ? "text-emerald-500" : finding.level === "warn" ? "text-amber-500" : "text-red-500";
  return (
    <li className="flex gap-2.5">
      <Icon className={cn("mt-0.5 size-4 shrink-0", color)} />
      <div>
        <p className="text-sm font-medium">{finding.title}</p>
        <p className="text-muted-foreground text-xs">{finding.detail}</p>
      </div>
    </li>
  );
}

function FilterTile({ src, label, filter, bg }: { src: string; label: string; filter: string; bg: string }) {
  return (
    <div className="space-y-1.5">
      <div className="border-border flex aspect-square items-center justify-center overflow-hidden rounded-xl border p-4" style={{ background: bg }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- user data URL */}
        <img src={src} alt={label} className="max-h-full max-w-full object-contain" style={{ filter }} />
      </div>
      <p className="text-muted-foreground text-center text-[11px]">{label}</p>
    </div>
  );
}

function Mock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      {children}
    </div>
  );
}

function scoreGrade(s: number): Grade {
  if (s >= 90) return "A";
  if (s >= 75) return "B";
  if (s >= 60) return "C";
  if (s >= 45) return "D";
  return "F";
}

function barColor(s: number): string {
  if (s >= 75) return "bg-emerald-500";
  if (s >= 60) return "bg-amber-500";
  if (s >= 45) return "bg-orange-500";
  return "bg-red-500";
}
