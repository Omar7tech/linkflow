"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CompassIcon,
  EraserIcon,
  FlagIcon,
  GaugeIcon,
  MapIcon,
  MountainIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  RouteIcon,
  ShuffleIcon,
  SquareIcon,
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
  EMPTY,
  FRONTIER,
  HEURISTICS,
  MAZES,
  PATH,
  VISITED,
  WALL,
  WEIGHT,
  WEIGHT_COST,
  generateMaze,
  idx,
  initialPlayState,
  makeGrid,
  search,
  seek,
  xOf,
  yOf,
  type AlgorithmId,
  type Grid,
  type HeuristicId,
  type MazeId,
  type PlayState,
  type SearchTrace,
} from "@/lib/pathfinding";
import { cn } from "@/lib/utils";

/** Odd sizes keep the maze carvers (which work on odd coordinates) honest. */
const makeOdd = (n: number) => (n % 2 === 0 ? n + 1 : n);

const MIN_COLS = 21;
const MAX_COLS = 71;

const MIN_SPEED = 2;
const MAX_SPEED = 4000;
const speedFromSlider = (v: number) => Math.round(MIN_SPEED * Math.pow(MAX_SPEED / MIN_SPEED, v / 100));
const sliderFromSpeed = (s: number) =>
  Math.round((Math.log(s / MIN_SPEED) / Math.log(MAX_SPEED / MIN_SPEED)) * 100);

type Brush = "wall" | "weight" | "erase" | "start" | "end";

const BRUSHES: { id: Brush; label: string; icon: typeof SquareIcon }[] = [
  { id: "wall", label: "Wall", icon: SquareIcon },
  { id: "weight", label: "Swamp", icon: MountainIcon },
  { id: "erase", label: "Erase", icon: EraserIcon },
  { id: "start", label: "Start", icon: CompassIcon },
  { id: "end", label: "Goal", icon: FlagIcon },
];

interface Palette {
  empty: string;
  wall: string;
  weight: string;
  frontier: string;
  visited: string;
  path: string;
  head: string;
  start: string;
  end: string;
  grid: string;
}

const PALETTES: Record<"light" | "dark", Palette> = {
  dark: {
    empty: "#0e1a17",
    wall: "#334155",
    weight: "#1e3a34",
    frontier: "#0e7490",
    visited: "#155e56",
    path: "#fbbf24",
    head: "#f8fafc",
    start: "#34d399",
    end: "#fb7185",
    grid: "rgba(255,255,255,0.05)",
  },
  light: {
    empty: "#f1f5f9",
    wall: "#475569",
    weight: "#bbf7d0",
    frontier: "#7dd3fc",
    visited: "#5eead4",
    path: "#f59e0b",
    head: "#0f172a",
    start: "#059669",
    end: "#e11d48",
    grid: "rgba(15,23,42,0.06)",
  },
};

function fitCanvas(canvas: HTMLCanvasElement) {
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

/** Draws the grid plus the search state on top of it. */
function paintGrid(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  state: PlayState,
  palette: Palette,
  w: number,
  h: number
) {
  const cell = Math.min(w / grid.cols, h / grid.rows);
  const ox = (w - cell * grid.cols) / 2;
  const oy = (h - cell * grid.rows) / 2;
  ctx.clearRect(0, 0, w, h);

  for (let i = 0; i < grid.cells.length; i++) {
    const x = ox + xOf(grid.cols, i) * cell;
    const y = oy + yOf(grid.cols, i) * cell;
    const terrain = grid.cells[i];
    const visual = state.cells[i];

    let fill = palette.empty;
    if (terrain === WALL) fill = palette.wall;
    else if (visual === PATH) fill = palette.path;
    else if (visual === VISITED) fill = palette.visited;
    else if (visual === FRONTIER) fill = palette.frontier;
    else if (terrain === WEIGHT) fill = palette.weight;

    ctx.fillStyle = fill;
    ctx.fillRect(x, y, cell, cell);

    // Swamp keeps a visible texture even once the search has covered it.
    if (terrain === WEIGHT && visual !== PATH) {
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(x + cell * 0.34, y + cell * 0.34, cell * 0.32, cell * 0.32);
    }
  }

  // Grid lines, only when the cells are big enough to warrant them.
  if (cell > 7) {
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= grid.cols; c++) {
      ctx.moveTo(Math.round(ox + c * cell) + 0.5, oy);
      ctx.lineTo(Math.round(ox + c * cell) + 0.5, oy + grid.rows * cell);
    }
    for (let r = 0; r <= grid.rows; r++) {
      ctx.moveTo(ox, Math.round(oy + r * cell) + 0.5);
      ctx.lineTo(ox + grid.cols * cell, Math.round(oy + r * cell) + 0.5);
    }
    ctx.stroke();
  }

  if (state.head >= 0) {
    ctx.fillStyle = palette.head;
    const x = ox + xOf(grid.cols, state.head) * cell;
    const y = oy + yOf(grid.cols, state.head) * cell;
    ctx.fillRect(x + cell * 0.25, y + cell * 0.25, cell * 0.5, cell * 0.5);
  }

  const marker = (i: number, color: string) => {
    const x = ox + xOf(grid.cols, i) * cell;
    const y = oy + yOf(grid.cols, i) * cell;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + cell / 2, y + cell / 2, Math.max(2, cell * 0.34), 0, Math.PI * 2);
    ctx.fill();
  };
  marker(grid.start, palette.start);
  marker(grid.end, palette.end);
}

/** Which cell a pointer event landed on, or -1 if it missed the board. */
function cellAt(canvas: HTMLCanvasElement, grid: Grid, clientX: number, clientY: number): number {
  const rect = canvas.getBoundingClientRect();
  const cell = Math.min(rect.width / grid.cols, rect.height / grid.rows);
  const ox = (rect.width - cell * grid.cols) / 2;
  const oy = (rect.height - cell * grid.rows) / 2;
  const x = Math.floor((clientX - rect.left - ox) / cell);
  const y = Math.floor((clientY - rect.top - oy) / cell);
  if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return -1;
  return idx(grid.cols, x, y);
}

/* ------------------------------- component -------------------------------- */

export function PathfindingTool() {
  const { resolvedTheme } = useTheme();
  const palette = PALETTES[resolvedTheme === "light" ? "light" : "dark"];

  const [cols, setCols] = React.useState(45);
  const [algorithm, setAlgorithm] = React.useState<AlgorithmId>("astar");
  const [heuristic, setHeuristic] = React.useState<HeuristicId>("manhattan");
  const [weight, setWeight] = React.useState(1);
  const [diagonal, setDiagonal] = React.useState(false);
  const [brush, setBrush] = React.useState<Brush>("wall");
  const [maze, setMaze] = React.useState<MazeId>("backtracker");
  const [speed, setSpeed] = React.useState(120);
  const [compareWith, setCompareWith] = React.useState<AlgorithmId | null>(null);
  const [mazeSeed, setMazeSeed] = React.useState(1);

  const rows = makeOdd(Math.round(cols * 0.56));
  const oddCols = makeOdd(cols);

  const options = React.useMemo(() => ({ heuristic, weight, diagonal }), [heuristic, weight, diagonal]);
  const meta = ALGORITHM_BY_ID[algorithm];

  // A new board is a remount, so nothing has to reach in and reset state.
  const boardKey = `${oddCols}:${rows}:${maze}:${mazeSeed}`;

  return (
    <GeneratorLayout tool={TOOL_BY_ID.pathfinding} output={null} fullBleed>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <Workspace
            key={boardKey}
            cols={oddCols}
            rows={rows}
            maze={maze}
            seed={mazeSeed}
            algorithm={algorithm}
            compareWith={compareWith}
            options={options}
            brush={brush}
            palette={palette}
            speed={speed}
            onRegenerate={() => setMazeSeed((s) => s + 1)}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {meta.name}
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-normal",
                    meta.optimal.startsWith("Yes")
                      ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {meta.optimal.startsWith("Yes") ? "finds the best route" : "no optimality guarantee"}
                </span>
                {!meta.weighted && (
                  <span className="text-muted-foreground border-border rounded-full border px-2 py-0.5 text-[11px] font-normal">
                    ignores swamp cost
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm leading-relaxed">{meta.description}</p>
              <p className="text-sm">
                <span className="text-muted-foreground">Watch for: </span>
                {meta.watch}
              </p>
              <p className="text-muted-foreground text-xs">
                Optimality: {meta.optimal}. A swamp cell costs {WEIGHT_COST} to enter instead of 1 — paint
                some, then compare Dijkstra against breadth-first to see the difference it makes.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ---- Controls ---- */}
        <div className="min-w-0 space-y-6">
          <Section icon={RouteIcon} title="Algorithm">
            <div className="grid grid-cols-2 gap-2">
              {ALGORITHMS.map((a) => (
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

            <div className="space-y-1.5">
              <Label>Compare against</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCompareWith(null)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    compareWith === null
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  Off
                </button>
                {ALGORITHMS.filter((a) => a.id !== algorithm).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setCompareWith(a.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      compareWith === a.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
              <p className="text-muted-foreground text-[11px]">
                Runs both on the same board, driven by one scrubber.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Heuristic</Label>
              <div className="grid grid-cols-2 gap-2">
                {HEURISTICS.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHeuristic(h.id)}
                    title={h.hint}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      heuristic === h.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
              <p className="text-muted-foreground text-[11px]">
                {HEURISTICS.find((h) => h.id === heuristic)?.hint}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Heuristic weight</Label>
                <span className="text-muted-foreground font-mono text-xs">{weight.toFixed(1)}×</span>
              </div>
              <Slider min={0} max={3} step={0.1} value={[weight]} onValueChange={([v]) => setWeight(v)} />
              <p className="text-muted-foreground text-[11px]">
                0 turns A* into Dijkstra. Above 1 it gets greedier and faster, and stops guaranteeing the
                shortest route.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Diagonal moves</Label>
                <p className="text-muted-foreground text-[11px]">Corners between two walls stay blocked.</p>
              </div>
              <Switch checked={diagonal} onCheckedChange={setDiagonal} />
            </div>
          </Section>

          <Section icon={MapIcon} title="Board">
            <div className="space-y-1.5">
              <Label>Draw with</Label>
              <div className="grid grid-cols-3 gap-2">
                {BRUSHES.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBrush(b.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2 py-2 text-xs transition-colors",
                      brush === b.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <b.icon className="size-3.5" aria-hidden />
                    {b.label}
                  </button>
                ))}
              </div>
              <p className="text-muted-foreground text-[11px]">
                Drag on the board to draw. The route updates as you go.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Maze</Label>
              <div className="grid grid-cols-2 gap-2">
                {MAZES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMaze(m.id);
                      setMazeSeed((s) => s + 1);
                    }}
                    title={m.hint}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      maze === m.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-muted-foreground text-[11px]">{MAZES.find((m) => m.id === maze)?.hint}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Grid width</Label>
                <span className="text-muted-foreground font-mono text-xs">
                  {oddCols} × {rows}
                </span>
              </div>
              <Slider
                min={MIN_COLS}
                max={MAX_COLS}
                step={2}
                value={[oddCols]}
                onValueChange={([v]) => setCols(v)}
              />
            </div>
          </Section>

          <Section icon={GaugeIcon} title="Playback">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Speed</Label>
                <span className="text-muted-foreground font-mono text-xs">{speed} cells/s</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[sliderFromSpeed(speed)]}
                onValueChange={([v]) => setSpeed(speedFromSlider(v))}
              />
            </div>
          </Section>
        </div>
      </div>
    </GeneratorLayout>
  );
}

/* -------------------------------- workspace ------------------------------- */

/**
 * Owns the board itself. Edits replace the grid rather than mutating it — the
 * cells array is barely a kilobyte, so copying on each painted cell costs
 * nothing and keeps the search a pure function of an immutable input.
 */
function Workspace({
  cols,
  rows,
  maze,
  seed,
  algorithm,
  compareWith,
  options,
  brush,
  palette,
  speed,
  onRegenerate,
}: {
  cols: number;
  rows: number;
  maze: MazeId;
  seed: number;
  algorithm: AlgorithmId;
  compareWith: AlgorithmId | null;
  options: { heuristic: HeuristicId; weight: number; diagonal: boolean };
  brush: Brush;
  palette: Palette;
  speed: number;
  onRegenerate: () => void;
}) {
  const [grid, setGrid] = React.useState<Grid>(() => {
    const g = makeGrid(cols, rows);
    generateMaze(g, maze, seed);
    return g;
  });
  /** Counts edits so the player remounts and replays from the start. */
  const [version, setVersion] = React.useState(0);

  const trace = React.useMemo(() => search(grid, algorithm, options), [grid, algorithm, options]);
  const compareTrace = React.useMemo(
    () => (compareWith ? search(grid, compareWith, options) : null),
    [grid, compareWith, options]
  );

  const applyBrush = React.useCallback(
    (cell: number) => {
      if (cell < 0) return;
      if (brush === "start") {
        if (cell === grid.end || grid.cells[cell] === WALL) return;
        setGrid({ ...grid, start: cell });
      } else if (brush === "end") {
        if (cell === grid.start || grid.cells[cell] === WALL) return;
        setGrid({ ...grid, end: cell });
      } else {
        if (cell === grid.start || cell === grid.end) return;
        const next = brush === "wall" ? WALL : brush === "weight" ? WEIGHT : EMPTY;
        if (grid.cells[cell] === next) return;
        const cells = Uint8Array.from(grid.cells);
        cells[cell] = next;
        setGrid({ ...grid, cells });
      }
      setVersion((v) => v + 1);
    },
    [brush, grid]
  );

  const runKey = `${algorithm}:${compareWith}:${options.heuristic}:${options.weight}:${options.diagonal}:${version}`;

  return (
    <Board
      key={runKey}
      grid={grid}
      trace={trace}
      compareTrace={compareTrace}
      compareName={compareWith ? ALGORITHM_BY_ID[compareWith].name : null}
      primaryName={ALGORITHM_BY_ID[algorithm].name}
      palette={palette}
      speed={speed}
      onPaint={applyBrush}
      onRegenerate={onRegenerate}
    />
  );
}

/* ---------------------------------- board --------------------------------- */

interface BoardProps {
  grid: Grid;
  trace: SearchTrace;
  compareTrace: SearchTrace | null;
  compareName: string | null;
  primaryName: string;
  palette: Palette;
  speed: number;
  onPaint: (cell: number) => void;
  onRegenerate: () => void;
}

function Board({
  grid,
  trace,
  compareTrace,
  compareName,
  primaryName,
  palette,
  speed,
  onPaint,
  onRegenerate,
}: BoardProps) {
  const [playing, setPlaying] = React.useState(true);
  const [cursor, setCursor] = React.useState(0);

  const mainRef = React.useRef<HTMLCanvasElement>(null);
  const compareRef = React.useRef<HTMLCanvasElement>(null);
  const stateRef = React.useRef<PlayState>(initialPlayState(grid.cells.length));
  const compareStateRef = React.useRef<PlayState>(initialPlayState(grid.cells.length));
  const cursorRef = React.useRef(0);
  const painting = React.useRef(false);

  const total = Math.max(trace.steps.length, compareTrace?.steps.length ?? 0);

  const draw = React.useCallback(() => {
    const main = mainRef.current;
    if (main) {
      const fitted = fitCanvas(main);
      if (fitted) paintGrid(fitted.ctx, grid, stateRef.current, palette, fitted.w, fitted.h);
    }
    const other = compareRef.current;
    if (other && compareTrace) {
      const fitted = fitCanvas(other);
      if (fitted) paintGrid(fitted.ctx, grid, compareStateRef.current, palette, fitted.w, fitted.h);
    }
  }, [grid, palette, compareTrace]);

  React.useEffect(() => {
    draw();
  }, [draw, cursor]);

  React.useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(main);
    return () => ro.disconnect();
  }, [draw]);

  const goTo = React.useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(total, Math.round(target)));
      seek(stateRef.current, trace.steps, Math.min(cursorRef.current, trace.steps.length), Math.min(clamped, trace.steps.length));
      if (compareTrace) {
        seek(
          compareStateRef.current,
          compareTrace.steps,
          Math.min(cursorRef.current, compareTrace.steps.length),
          Math.min(clamped, compareTrace.steps.length)
        );
      }
      cursorRef.current = clamped;
      setCursor(clamped);
      draw();
    },
    [trace, compareTrace, total, draw]
  );

  React.useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    const tick = (now: number) => {
      carry += ((now - last) / 1000) * speed;
      last = now;
      const batch = Math.floor(carry);
      if (batch > 0) {
        carry -= batch;
        const next = Math.min(total, cursorRef.current + batch);
        goTo(next);
        if (next >= total) {
          setPlaying(false);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, total, goTo]);

  const done = cursor >= total && total > 0;

  /* ---- painting ---- */
  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = mainRef.current;
    if (!canvas) return;
    const cell = cellAt(canvas, grid, e.clientX, e.clientY);
    onPaint(cell);
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className={cn("grid gap-3", compareTrace ? "lg:grid-cols-2" : "grid-cols-1")}>
          <div className="space-y-2">
            {compareTrace && (
              <p className="text-muted-foreground text-xs font-medium">{primaryName}</p>
            )}
            <div className="bg-muted/30 rounded-xl p-2">
              <canvas
                ref={mainRef}
                onPointerDown={(e) => {
                  painting.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  handlePointer(e);
                }}
                onPointerMove={(e) => painting.current && handlePointer(e)}
                onPointerUp={() => (painting.current = false)}
                onPointerCancel={() => (painting.current = false)}
                className="block h-[clamp(240px,42vh,520px)] w-full cursor-crosshair touch-none"
                aria-label="Pathfinding board — drag to draw walls"
              />
            </div>
          </div>

          {compareTrace && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">{compareName}</p>
              <div className="bg-muted/30 rounded-xl p-2">
                <canvas
                  ref={compareRef}
                  className="block h-[clamp(240px,42vh,520px)] w-full"
                  aria-label={`${compareName} board`}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => (done ? (goTo(0), setPlaying(true)) : setPlaying((p) => !p))}
            className="min-w-28 font-semibold"
          >
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
          <Button type="button" variant="outline" onClick={onRegenerate}>
            <ShuffleIcon className="size-4" /> New maze
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Slider
            min={0}
            max={Math.max(1, total)}
            step={1}
            value={[cursor]}
            onValueChange={([v]) => {
              setPlaying(false);
              goTo(v);
            }}
            aria-label="Scrub through the search"
            className="flex-1"
          />
          <span className="text-muted-foreground w-28 shrink-0 text-right font-mono text-xs tabular-nums">
            {cursor} / {total}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Cells expanded" value={trace.visited} />
          <Stat label="Peak frontier" value={trace.peakFrontier} />
          <Stat label="Path length" value={trace.found ? trace.pathLength : 0} />
          <Stat label="Path cost" value={trace.found ? Math.round(trace.pathCost) : 0} />
        </div>

        {compareTrace && (
          <div className="border-border/60 rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground mb-1 text-xs">{compareName}</p>
            <p className="font-mono text-xs tabular-nums">
              {compareTrace.visited} expanded · path {compareTrace.found ? compareTrace.pathLength : "—"} ·
              cost {compareTrace.found ? Math.round(compareTrace.pathCost) : "—"}
            </p>
            {trace.found && compareTrace.found && (
              <p className="text-muted-foreground mt-1.5 text-xs">
                {trace.visited === compareTrace.visited
                  ? "Both explored the same number of cells."
                  : `${trace.visited < compareTrace.visited ? primaryName : compareName} explored ${Math.abs(
                      trace.visited - compareTrace.visited
                    )} fewer cells.`}
                {Math.round(trace.pathCost) !== Math.round(compareTrace.pathCost) &&
                  ` ${Math.round(trace.pathCost) < Math.round(compareTrace.pathCost) ? primaryName : compareName} found the cheaper route.`}
              </p>
            )}
          </div>
        )}

        {!trace.found && (
          <p className="text-muted-foreground text-xs">
            No route exists on this board — the goal is walled off. Erase a wall or generate a new maze.
          </p>
        )}

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <Legend color={palette.frontier} label="frontier" />
          <Legend color={palette.visited} label="expanded" />
          <Legend color={palette.path} label="route" />
          <Legend color={palette.weight} label={`swamp (costs ${WEIGHT_COST})`} />
          <Legend color={palette.start} label="start" />
          <Legend color={palette.end} label="goal" />
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------- UI helpers ------------------------------ */

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof RouteIcon;
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border/60 rounded-lg border p-2.5">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="font-mono text-lg tabular-nums">{value.toLocaleString("en-US")}</p>
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
