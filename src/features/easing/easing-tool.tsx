"use client";

import * as React from "react";
import { GaugeIcon, RotateCcwIcon, SplineIcon, WavesIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { HistoryPanel } from "@/components/shared/history-panel";
import { TOOL_BY_ID } from "@/constants/tools";
import { useCopy } from "@/hooks/useCopy";
import { useHistory } from "@/hooks/useHistory";
import {
  BEZIER_PRESETS,
  SPRING_PRESETS,
  bezierPath,
  bezierToCss,
  samplesPath,
  solveSpring,
  toCss,
  toJs,
  toTailwind,
  type Bezier,
  type MotionExport,
  type Spring,
} from "@/lib/easing";
import { cn } from "@/lib/utils";

type Mode = "bezier" | "spring";

const SIZE = 260;
const PAD = 36;

export function EasingTool() {
  const history = useHistory("easing");
  const { copy } = useCopy();

  const [mode, setMode] = React.useState<Mode>("bezier");
  const [bezier, setBezier] = React.useState<Bezier>([0.34, 1.56, 0.64, 1]);
  const [spring, setSpring] = React.useState<Spring>(SPRING_PRESETS[2].value);
  const [bezierDuration, setBezierDuration] = React.useState(600);

  const springResult = React.useMemo(() => solveSpring(spring), [spring]);

  // The single source of truth that drives preview + every export.
  const motion: MotionExport =
    mode === "bezier"
      ? { timing: bezierToCss(bezier), duration: bezierDuration, bezier }
      : { timing: springResult.linear, duration: springResult.duration, spring };

  const exportTabs = [
    { id: "css", name: "CSS", code: toCss(motion) },
    { id: "tailwind", name: "Tailwind", code: toTailwind(motion) },
    { id: "js", name: "JS", code: toJs(motion) },
  ];

  const commit = () => {
    const label =
      mode === "bezier"
        ? bezierToCss(bezier)
        : `spring · ${spring.stiffness}/${spring.damping}/${spring.mass}`;
    history.add(label, motion.timing);
  };

  return (
    <GeneratorLayout
      tool={TOOL_BY_ID.easing}
      output={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export</CardTitle>
            <CardDescription>
              {mode === "spring"
                ? "Spring physics, baked into a CSS linear() curve any browser can run."
                : "Drop the timing function straight into your transition."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => {
                copy(motion.timing, "Timing function copied");
                commit();
              }}
              className="bg-muted/50 hover:bg-muted border-border w-full rounded-lg border p-3 text-left font-mono text-xs break-all transition-colors"
              aria-label="Copy timing function"
            >
              {motion.timing}
            </button>

            <Tabs defaultValue="css" className="w-full">
              <TabsList className="w-full">
                {exportTabs.map((t) => (
                  <TabsTrigger key={t.id} value={t.id} className="flex-1">
                    {t.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {exportTabs.map((t) => (
                <TabsContent key={t.id} value={t.id}>
                  <div className="relative">
                    <pre className="bg-muted/50 border-border max-h-72 overflow-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                      {t.code}
                    </pre>
                    <CopyButton
                      text={t.code}
                      label=""
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1.5 right-1.5"
                      successMessage={`${t.name} copied`}
                      onCopied={commit}
                      aria-label={`Copy ${t.name}`}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      }
      footer={<HistoryPanel history={history} />}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SplineIcon className="text-primary size-4" />
              Curve
            </CardTitle>
            <CardDescription>
              {mode === "bezier"
                ? "Drag the two handles to shape the timing function. Pull a handle past the top or bottom for overshoot."
                : "Tune the physics — stiffness, damping and mass — and watch the curve settle."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="bg-muted/50 inline-flex rounded-lg p-1">
              <ModeButton active={mode === "bezier"} onClick={() => setMode("bezier")} icon={SplineIcon}>
                Cubic bezier
              </ModeButton>
              <ModeButton active={mode === "spring"} onClick={() => setMode("spring")} icon={WavesIcon}>
                Spring
              </ModeButton>
            </div>

            <div className="grid gap-6 sm:grid-cols-[260px_1fr]">
              <div className="flex justify-center">
                {mode === "bezier" ? (
                  <BezierEditor value={bezier} onChange={setBezier} />
                ) : (
                  <CurvePlot samples={springResult.samples} />
                )}
              </div>

              <div className="space-y-5">
                {mode === "bezier" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {BEZIER_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setBezier(p.value)}
                          className={cn(
                            "rounded-md border px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                            sameBezier(p.value, bezier)
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border hover:bg-muted text-muted-foreground"
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                    <SliderRow
                      label="Duration"
                      value={bezierDuration}
                      unit="ms"
                      min={150}
                      max={2000}
                      step={50}
                      onChange={setBezierDuration}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {SPRING_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSpring(p.value)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                            sameSpring(p.value, spring)
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border hover:bg-muted text-muted-foreground"
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                    <SliderRow
                      label="Stiffness"
                      value={spring.stiffness}
                      min={20}
                      max={700}
                      step={5}
                      onChange={(v) => setSpring((s) => ({ ...s, stiffness: v }))}
                    />
                    <SliderRow
                      label="Damping"
                      value={spring.damping}
                      min={2}
                      max={120}
                      step={1}
                      onChange={(v) => setSpring((s) => ({ ...s, damping: v }))}
                    />
                    <SliderRow
                      label="Mass"
                      value={spring.mass}
                      min={0.2}
                      max={5}
                      step={0.1}
                      onChange={(v) => setSpring((s) => ({ ...s, mass: v }))}
                    />
                    <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px]">
                      <span>
                        <span className="text-foreground font-bold">{springResult.duration}ms</span>{" "}
                        settle
                      </span>
                      <span>
                        {springResult.bouncy ? (
                          <>
                            <span className="text-foreground font-bold">
                              +{Math.round(springResult.overshoot * 100)}%
                            </span>{" "}
                            overshoot
                          </>
                        ) : (
                          "no overshoot"
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GaugeIcon className="text-primary size-4" />
              Live preview
            </CardTitle>
            <CardDescription>
              The same curve applied to position, scale, rotation and opacity — looping so you can
              feel the motion.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Preview timing={motion.timing} duration={motion.duration} />
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}

/* ---------------------------- Bezier editor ----------------------------- */

function BezierEditor({ value, onChange }: { value: Bezier; onChange: (b: Bezier) => void }) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [drag, setDrag] = React.useState<1 | 2 | null>(null);

  const inner = SIZE - PAD * 2;
  const mx = (u: number) => PAD + u * inner;
  const my = (u: number) => PAD + (1 - u) * inner;

  const update = React.useCallback(
    (handle: 1 | 2, clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scale = SIZE / rect.width;
      const px = (clientX - rect.left) * scale;
      const py = (clientY - rect.top) * scale;
      const x = clamp((px - PAD) / inner, 0, 1);
      const y = clamp(1 - (py - PAD) / inner, -0.5, 1.5);
      onChange(
        handle === 1
          ? [round(x), round(y), value[2], value[3]]
          : [value[0], value[1], round(x), round(y)]
      );
    },
    [inner, onChange, value]
  );

  React.useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => update(drag, e.clientX, e.clientY);
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, update]);

  const [x1, y1, x2, y2] = value;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="border-border bg-card w-full max-w-[260px] touch-none rounded-xl border"
      role="application"
      aria-label="Cubic bezier curve editor"
    >
      {/* baseline grid */}
      <rect
        x={PAD}
        y={PAD}
        width={inner}
        height={inner}
        className="fill-muted/30 stroke-border"
        strokeWidth={1}
      />
      <line x1={mx(0)} y1={my(0)} x2={mx(1)} y2={my(1)} className="stroke-border" strokeDasharray="4 4" />

      {/* handle leashes */}
      <line x1={mx(0)} y1={my(0)} x2={mx(x1)} y2={my(y1)} className="stroke-primary/50" strokeWidth={1.5} />
      <line x1={mx(1)} y1={my(1)} x2={mx(x2)} y2={my(y2)} className="stroke-primary/50" strokeWidth={1.5} />

      {/* the curve */}
      <path d={bezierPath(value, SIZE, PAD)} className="stroke-primary fill-none" strokeWidth={2.5} />

      {/* endpoints */}
      <circle cx={mx(0)} cy={my(0)} r={4} className="fill-muted-foreground" />
      <circle cx={mx(1)} cy={my(1)} r={4} className="fill-muted-foreground" />

      {/* draggable handles */}
      <Handle cx={mx(x1)} cy={my(y1)} onDown={() => setDrag(1)} active={drag === 1} />
      <Handle cx={mx(x2)} cy={my(y2)} onDown={() => setDrag(2)} active={drag === 2} />
    </svg>
  );
}

function Handle({
  cx,
  cy,
  onDown,
  active,
}: {
  cx: number;
  cy: number;
  onDown: () => void;
  active: boolean;
}) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={active ? 9 : 7}
      onPointerDown={(e) => {
        e.preventDefault();
        onDown();
      }}
      className="fill-primary cursor-grab active:cursor-grabbing"
      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
    />
  );
}

/** Read-only curve plot for spring mode, including overshoot above the box. */
function CurvePlot({ samples }: { samples: number[] }) {
  const inner = SIZE - PAD * 2;
  const mx = (u: number) => PAD + u * inner;
  const my = (u: number) => PAD + (1 - u) * inner;
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="border-border bg-card w-full max-w-[260px] rounded-xl border"
      role="img"
      aria-label="Spring curve"
    >
      <rect x={PAD} y={PAD} width={inner} height={inner} className="fill-muted/30 stroke-border" strokeWidth={1} />
      <line x1={mx(0)} y1={my(1)} x2={mx(1)} y2={my(1)} className="stroke-border" strokeDasharray="4 4" />
      <line x1={mx(0)} y1={my(0)} x2={mx(1)} y2={my(0)} className="stroke-border" strokeDasharray="4 4" />
      <path d={samplesPath(samples, SIZE, PAD)} className="stroke-primary fill-none" strokeWidth={2.5} />
    </svg>
  );
}

/* ------------------------------- Preview -------------------------------- */

function Preview({ timing, duration }: { timing: string; duration: number }) {
  const [on, setOn] = React.useState(false);

  // Yoyo between states on a loop, pausing briefly at each end.
  React.useEffect(() => {
    const id = window.setInterval(() => setOn((v) => !v), duration + 650);
    const kick = window.setTimeout(() => setOn(true), 120);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(kick);
    };
  }, [duration, timing]);

  const style = (props: React.CSSProperties): React.CSSProperties => ({
    transitionProperty: "transform, opacity",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: timing,
    ...props,
  });

  return (
    <div className="space-y-5">
      {/* position */}
      <Track label="Translate">
        <div
          className="bg-primary size-10 rounded-lg shadow-sm"
          style={style({ transform: on ? "translateX(calc(100% - 2.5rem))" : "translateX(0)" })}
        />
      </Track>

      <div className="grid gap-5 sm:grid-cols-3">
        <Demo label="Scale">
          <div
            className="bg-primary size-12 rounded-lg"
            style={style({ transform: on ? "scale(1)" : "scale(0.3)" })}
          />
        </Demo>
        <Demo label="Rotate">
          <div
            className="bg-primary size-12 rounded-lg"
            style={style({ transform: on ? "rotate(180deg)" : "rotate(0deg)" })}
          />
        </Demo>
        <Demo label="Fade">
          <div
            className="bg-primary size-12 rounded-lg"
            style={style({ opacity: on ? 1 : 0.1, transform: on ? "scale(1)" : "scale(0.85)" })}
          />
        </Demo>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground inline-flex items-center gap-1.5 font-mono text-[11px]">
          <ZapIcon className="size-3.5" /> {duration}ms loop
        </span>
        <Button variant="outline" size="sm" onClick={() => setOn((v) => !v)}>
          <RotateCcwIcon className="size-3.5" /> Replay
        </Button>
      </div>
    </div>
  );
}

function Track({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-medium">{label}</p>
      <div className="bg-muted/40 border-border flex items-center rounded-lg border p-3">{children}</div>
    </div>
  );
}

function Demo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-medium">{label}</p>
      <div className="bg-muted/40 border-border flex h-24 items-center justify-center rounded-lg border">
        {children}
      </div>
    </div>
  );
}

/* -------------------------------- Shared -------------------------------- */

function ModeButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
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

const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const sameBezier = (a: Bezier, b: Bezier) => a.every((n, i) => n === b[i]);
const sameSpring = (a: Spring, b: Spring) =>
  a.mass === b.mass && a.stiffness === b.stiffness && a.damping === b.damping;
