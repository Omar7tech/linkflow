"use client";

import * as React from "react";
import {
  ActivityIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlagIcon,
  GaugeIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  ShuffleIcon,
  SlidersHorizontalIcon,
  SwatchBookIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import {
  ALGORITHMS,
  ALGORITHM_BY_ID,
  DISTRIBUTIONS,
  applyStep,
  generateArray,
  initialState,
  runAlgorithm,
  seek,
  type AlgorithmId,
  type DistributionId,
  type PlayerState,
  type Trace,
} from "@/lib/sorting";
import { PALETTES, VIEWS, frequencyFor, renderView, type Palette, type ViewId } from "@/lib/sorting-render";
import { cn } from "@/lib/utils";

const MIN_SIZE = 8;
const MAX_SIZE = 300;

/** Steps per second, mapped from the slider on a log scale. */
const MIN_SPEED = 2;
const MAX_SPEED = 20_000;
const speedFromSlider = (v: number) => Math.round(MIN_SPEED * Math.pow(MAX_SPEED / MIN_SPEED, v / 100));
const sliderFromSpeed = (s: number) =>
  Math.round((Math.log(s / MIN_SPEED) / Math.log(MAX_SPEED / MIN_SPEED)) * 100);

const formatNumber = (n: number) => n.toLocaleString("en-US");

/** Sizes a canvas to its CSS box at the device pixel ratio. */
function fitCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/* ---------------------------------- audio --------------------------------- */

/**
 * One oscillator per blip, created on demand. Lives outside React because it's
 * driven from the animation frame, not from a render.
 */
class Blipper {
  private ctx: AudioContext | null = null;
  private last = 0;

  play(value: number, max: number) {
    // Throttled hard: at a few thousand steps a second, every step would be noise.
    const now = performance.now();
    if (now - this.last < 28) return;
    this.last = now;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === "suspended") void this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = frequencyFor(value, max);
      gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.09, this.ctx.currentTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.13);
    } catch {
      /* audio is a bonus, never a requirement */
    }
  }

  close() {
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}

/* -------------------------------- container -------------------------------- */

export function SortingTool() {
  const { resolvedTheme } = useTheme();
  const palette = PALETTES[resolvedTheme === "light" ? "light" : "dark"];

  const [algorithm, setAlgorithm] = React.useState<AlgorithmId>("quick");
  const [size, setSize] = React.useState(60);
  const [distribution, setDistribution] = React.useState<DistributionId>("random");
  const [seed, setSeed] = React.useState(1);
  const [view, setView] = React.useState<ViewId>("bars");
  const [speed, setSpeed] = React.useState(240);
  const [sound, setSound] = React.useState(false);
  const [raceIds, setRaceIds] = React.useState<AlgorithmId[]>([]);

  const meta = ALGORITHM_BY_ID[algorithm];
  const effectiveSize = Math.min(size, meta.maxSize ?? MAX_SIZE);

  const input = React.useMemo(
    () => generateArray(effectiveSize, distribution, seed),
    [effectiveSize, distribution, seed]
  );
  const trace = React.useMemo(() => runAlgorithm(algorithm, input), [algorithm, input]);

  // Remounting on a new run is how playback resets — no effect has to reach in
  // and clear the cursor, the state simply starts fresh.
  const runKey = `${algorithm}:${effectiveSize}:${distribution}:${seed}`;
  const raceKey = `${raceIds.join(",")}:${effectiveSize}:${distribution}:${seed}`;

  const toggleRacer = (id: AlgorithmId) =>
    setRaceIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });

  return (
    <GeneratorLayout tool={TOOL_BY_ID.sorting} output={null} fullBleed>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---- Stage ---- */}
        <div className="min-w-0 space-y-4">
          <Stage
            key={runKey}
            input={input}
            trace={trace}
            view={view}
            palette={palette}
            speed={speed}
            sound={sound}
            onToggleSound={() => setSound((s) => !s)}
            onReshuffle={() => setSeed((s) => s + 1)}
            elements={effectiveSize}
          />

          {/* Algorithm card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {meta.name}
                <span className="text-muted-foreground border-border rounded-full border px-2 py-0.5 text-[11px] font-normal">
                  {meta.family}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-normal",
                    meta.stable
                      ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {meta.stable ? "stable" : "not stable"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm leading-relaxed">{meta.description}</p>
              <p className="text-sm">
                <span className="text-muted-foreground">Watch for: </span>
                {meta.watch}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Complexity label="Best" value={meta.best} />
                <Complexity label="Average" value={meta.average} />
                <Complexity label="Worst" value={meta.worst} />
                <Complexity label="Extra space" value={meta.space} />
              </div>
            </CardContent>
          </Card>

          {/* Race */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FlagIcon className="text-primary size-4" /> Race
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Pick up to four and run them on this exact array, side by side. They finish at
                different moments because the winner is decided by array accesses, not by frames.
              </p>
              <div className="flex flex-wrap gap-2">
                {ALGORITHMS.filter((a) => !a.maxSize).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleRacer(a.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      raceIds.includes(a.id)
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {a.name}
                  </button>
                ))}
                {raceIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRaceIds([])}
                    className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
                  >
                    Clear
                  </button>
                )}
              </div>
              {raceIds.length > 0 && (
                <Race key={raceKey} ids={raceIds} input={input} view={view} palette={palette} speed={speed} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ---- Controls ---- */}
        <div className="min-w-0 space-y-6">
          <Section icon={ActivityIcon} title="Algorithm">
            <div className="space-y-3">
              {(["Exchange", "Insertion", "Selection", "Divide & conquer", "Non-comparison", "Joke"] as const).map(
                (family) => {
                  const group = ALGORITHMS.filter((a) => a.family === family);
                  if (!group.length) return null;
                  return (
                    <div key={family} className="space-y-1.5">
                      <Label className="text-[11px] tracking-wide uppercase">{family}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {group.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setAlgorithm(a.id)}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                              algorithm === a.id
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border text-muted-foreground hover:bg-muted/50"
                            )}
                          >
                            {a.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
            {meta.maxSize && (
              <p className="text-muted-foreground text-xs">
                Capped at {meta.maxSize} elements — beyond that it would never finish.
              </p>
            )}
          </Section>

          <Section icon={SlidersHorizontalIcon} title="The array">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Elements</Label>
                <span className="text-muted-foreground font-mono text-xs">{effectiveSize}</span>
              </div>
              <Slider
                min={MIN_SIZE}
                max={meta.maxSize ?? MAX_SIZE}
                step={1}
                value={[effectiveSize]}
                onValueChange={([v]) => setSize(v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Starting order</Label>
              <div className="grid grid-cols-2 gap-2">
                {DISTRIBUTIONS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDistribution(d.id)}
                    title={d.hint}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      distribution === d.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-muted-foreground text-[11px]">
                {DISTRIBUTIONS.find((d) => d.id === distribution)?.hint}
              </p>
            </div>
          </Section>

          <Section icon={GaugeIcon} title="Playback">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Speed</Label>
                <span className="text-muted-foreground font-mono text-xs">
                  {formatNumber(speed)} steps/s
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[sliderFromSpeed(speed)]}
                onValueChange={([v]) => setSpeed(speedFromSlider(v))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Sound</Label>
                <p className="text-muted-foreground text-[11px]">
                  A pentatonic blip per step, pitched by value.
                </p>
              </div>
              <Switch checked={sound} onCheckedChange={setSound} />
            </div>
          </Section>

          <Section icon={SwatchBookIcon} title="View">
            <div className="grid grid-cols-2 gap-2">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  title={v.hint}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    view === v.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-[11px]">{VIEWS.find((v) => v.id === view)?.hint}</p>
          </Section>
        </div>
      </div>
    </GeneratorLayout>
  );
}

/* ---------------------------------- stage --------------------------------- */

interface StageProps {
  input: number[];
  trace: Trace;
  view: ViewId;
  palette: Palette;
  speed: number;
  sound: boolean;
  elements: number;
  onToggleSound: () => void;
  onReshuffle: () => void;
}

function Stage({
  input,
  trace,
  view,
  palette,
  speed,
  sound,
  elements,
  onToggleSound,
  onReshuffle,
}: StageProps) {
  const [playing, setPlaying] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  // The player owns one mutable state object; steps are applied to it in place
  // so seeking never rebuilds the array from scratch.
  const stateRef = React.useRef<PlayerState>(initialState(input));
  const cursorRef = React.useRef(0);
  const blipper = React.useRef<Blipper | null>(null);
  const maxValue = React.useMemo(() => Math.max(1, ...input), [input]);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fitted = fitCanvas(canvas);
    if (!fitted) return;
    renderView(fitted.ctx, {
      state: stateRef.current,
      view,
      palette,
      width: fitted.w,
      height: fitted.h,
    });
  }, [view, palette]);

  React.useEffect(() => {
    draw();
  }, [draw, cursor]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  React.useEffect(() => () => blipper.current?.close(), []);

  /* ---- playback ---- */
  React.useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    // Fractional steps carry between frames so slow speeds stay smooth.
    let carry = 0;

    const tick = (now: number) => {
      carry += ((now - last) / 1000) * speed;
      last = now;
      const batch = Math.floor(carry);
      if (batch > 0) {
        carry -= batch;
        const state = stateRef.current;
        const end = Math.min(trace.steps.length, cursorRef.current + batch);
        for (let k = cursorRef.current; k < end; k++) applyStep(state, trace.steps[k]);
        cursorRef.current = end;
        setCursor(end);
        if (sound && end > 0) {
          blipper.current ??= new Blipper();
          blipper.current.play(state.values[trace.steps[end - 1].i] ?? 0, maxValue);
        }
        draw();
        if (end >= trace.steps.length) {
          setPlaying(false);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, trace, draw, sound, maxValue]);

  const goTo = React.useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(trace.steps.length, Math.round(target)));
      cursorRef.current = seek(stateRef.current, trace.steps, cursorRef.current, clamped);
      setCursor(clamped);
      draw();
    },
    [trace, draw]
  );

  const done = cursor >= trace.steps.length && trace.steps.length > 0;

  const togglePlay = React.useCallback(() => {
    if (done) {
      goTo(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  }, [done, goTo]);

  /* ---- keyboard ---- */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        goTo(cursorRef.current + (e.shiftKey ? 50 : 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        goTo(cursorRef.current - (e.shiftKey ? 50 : 1));
      } else if (e.key.toLowerCase() === "r") {
        onReshuffle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, goTo, onReshuffle]);

  /* ---- stats up to the cursor ---- */
  const stats = React.useMemo(() => {
    let comparisons = 0;
    let writes = 0;
    let accesses = 0;
    for (let k = 0; k < cursor; k++) {
      const step = trace.steps[k];
      if (step.t === "compare") {
        comparisons++;
        accesses += 2;
      } else if (step.t === "swap") {
        writes += 2;
        accesses += 4;
      } else if (step.t === "write") {
        writes++;
        accesses++;
      }
    }
    return { comparisons, writes, accesses };
  }, [cursor, trace]);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="bg-muted/30 rounded-xl p-3">
          <canvas ref={canvasRef} className="block h-[clamp(260px,46vh,560px)] w-full" aria-label="Sorting visualisation" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={togglePlay} className="min-w-28 font-semibold">
            {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
            {playing ? "Pause" : done ? "Replay" : "Play"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Step back"
            onClick={() => {
              setPlaying(false);
              goTo(cursorRef.current - 1);
            }}
            disabled={cursor === 0}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Step forward"
            onClick={() => {
              setPlaying(false);
              goTo(cursorRef.current + 1);
            }}
            disabled={done}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Restart"
            onClick={() => {
              setPlaying(false);
              goTo(0);
            }}
          >
            <RotateCcwIcon className="size-4" />
          </Button>
          <Button type="button" variant="outline" onClick={onReshuffle}>
            <ShuffleIcon className="size-4" /> New array
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={sound ? "Mute" : "Enable sound"}
            aria-pressed={sound}
            onClick={onToggleSound}
            className={cn(sound && "border-primary text-primary")}
          >
            {sound ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Slider
            min={0}
            max={Math.max(1, trace.steps.length)}
            step={1}
            value={[cursor]}
            onValueChange={([v]) => {
              setPlaying(false);
              goTo(v);
            }}
            aria-label="Scrub through the run"
            className="flex-1"
          />
          <span className="text-muted-foreground w-36 shrink-0 text-right font-mono text-xs tabular-nums">
            {formatNumber(cursor)} / {formatNumber(trace.steps.length)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Comparisons" value={stats.comparisons} total={trace.comparisons} />
          <Stat label="Writes" value={stats.writes} total={trace.writes} />
          <Stat label="Array accesses" value={stats.accesses} total={trace.accesses} />
          <Stat label="Elements" value={elements} />
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <Legend color={palette.compare} label="comparing" />
          <Legend color={palette.write} label="written" />
          <Legend color={palette.pivot} label="pivot" />
          <Legend color={palette.sorted} label="final position" />
          <span className="ml-auto hidden sm:inline">
            Space plays · ← → step · Shift+← → jump 50 · R reshuffles
          </span>
        </div>

        {trace.truncated && (
          <p className="text-muted-foreground text-xs">
            This run hit the step ceiling and was cut short — which for bogosort is rather the point.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------- race ---------------------------------- */

function Race({
  ids,
  input,
  view,
  palette,
  speed,
}: {
  ids: AlgorithmId[];
  input: number[];
  view: ViewId;
  palette: Palette;
  speed: number;
}) {
  const traces = React.useMemo(() => ids.map((id) => ({ id, trace: runAlgorithm(id, input) })), [ids, input]);

  const [running, setRunning] = React.useState(false);
  // Cursors live in state, not a ref, because the lane labels read them during
  // render — and the frame loop already re-renders to repaint.
  const [cursors, setCursors] = React.useState<number[]>(() => traces.map(() => 0));

  const statesRef = React.useRef<PlayerState[]>(traces.map(() => initialState(input)));
  // Mirror of `cursors` for the frame loop, which must not read stale state.
  const cursorsRef = React.useRef<number[]>(traces.map(() => 0));
  const canvasRefs = React.useRef<(HTMLCanvasElement | null)[]>([]);

  const drawAll = React.useCallback(() => {
    traces.forEach((_, i) => {
      const canvas = canvasRefs.current[i];
      if (!canvas) return;
      const fitted = fitCanvas(canvas);
      const state = statesRef.current[i];
      if (!fitted || !state) return;
      renderView(fitted.ctx, { state, view, palette, width: fitted.w, height: fitted.h, compact: true });
    });
  }, [traces, view, palette]);

  React.useEffect(() => {
    drawAll();
  }, [drawAll, cursors]);

  React.useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    const step = (now: number) => {
      carry += ((now - last) / 1000) * speed;
      last = now;
      const batch = Math.floor(carry);
      if (batch > 0) {
        carry -= batch;
        let anyLeft = false;
        const next = traces.map(({ trace }, i) => {
          const state = statesRef.current[i];
          const from = cursorsRef.current[i];
          const end = Math.min(trace.steps.length, from + batch);
          for (let k = from; k < end; k++) applyStep(state, trace.steps[k]);
          if (end < trace.steps.length) anyLeft = true;
          return end;
        });
        cursorsRef.current = next;
        setCursors(next);
        if (!anyLeft) {
          setRunning(false);
          return;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, traces]);

  const reset = () => {
    setRunning(false);
    statesRef.current = traces.map(() => initialState(input));
    cursorsRef.current = traces.map(() => 0);
    setCursors(traces.map(() => 0));
  };

  // Ranked by array accesses — the metric that doesn't flatter any one design.
  const ranking = [...traces].sort((a, b) => a.trace.accesses - b.trace.accesses);
  const longest = Math.max(1, ...traces.map((t) => t.trace.steps.length));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => setRunning((r) => !r)}>
          {running ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
          {running ? "Pause" : "Start race"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={reset}>
          <RotateCcwIcon className="size-4" /> Reset
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {traces.map(({ id, trace }, i) => {
          const at = cursors[i] ?? 0;
          const finished = at >= trace.steps.length;
          const place = ranking.findIndex((r) => r.id === id) + 1;
          return (
            <div key={id} className="border-border/60 rounded-xl border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{ALGORITHM_BY_ID[id].name}</span>
                <span className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums">
                  {finished ? `#${place} · ${formatNumber(trace.accesses)} acc` : `${formatNumber(at)} steps`}
                </span>
              </div>
              <canvas
                ref={(el) => {
                  canvasRefs.current[i] = el;
                }}
                className="block h-28 w-full"
                aria-label={`${ALGORITHM_BY_ID[id].name} race lane`}
              />
              <div className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
                <div
                  className={cn("h-full rounded-full", finished ? "bg-primary" : "bg-primary/50")}
                  style={{ width: `${Math.min(100, (at / Math.max(1, trace.steps.length)) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        Fewest array accesses wins: {ranking.map((r) => ALGORITHM_BY_ID[r.id].name).join(" · ")}. The
        longest run here is {formatNumber(longest)} steps.
      </p>
    </div>
  );
}

/* -------------------------------- UI helpers ------------------------------ */

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ActivityIcon;
  title: string;
  children: React.ReactNode;
}) {
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

function Stat({ label, value, total }: { label: string; value: number; total?: number }) {
  return (
    <div className="border-border/60 rounded-lg border p-2.5">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="font-mono text-lg tabular-nums">
        {formatNumber(value)}
        {total !== undefined && <span className="text-muted-foreground text-xs"> / {formatNumber(total)}</span>}
      </p>
    </div>
  );
}

function Complexity({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/60 rounded-lg border p-2.5">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
