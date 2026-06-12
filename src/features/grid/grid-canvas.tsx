"use client";

import * as React from "react";
import {
  ITEM_COLORS,
  collides,
  normalizeArea,
  type GridArea,
  type GridItem,
} from "@/lib/grid";
import { cn } from "@/lib/utils";

interface Cell {
  r: number;
  c: number;
}

type DragState =
  | { mode: "create"; anchor: Cell; current: Cell }
  | { mode: "move"; id: string; size: { h: number; w: number }; offset: { dr: number; dc: number }; current: Cell }
  | { mode: "resize"; id: string; anchor: Cell; current: Cell };

interface TrackEdges {
  cols: { start: number; end: number }[];
  rows: { start: number; end: number }[];
}

const CORNERS = [
  { id: "nw", className: "-top-1.5 -left-1.5 cursor-nwse-resize" },
  { id: "ne", className: "-top-1.5 -right-1.5 cursor-nesw-resize" },
  { id: "sw", className: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
  { id: "se", className: "-bottom-1.5 -right-1.5 cursor-nwse-resize" },
] as const;

type Corner = (typeof CORNERS)[number]["id"];

function oppositeCorner(area: GridArea, corner: Corner): Cell {
  switch (corner) {
    case "nw":
      return { r: area.r2, c: area.c2 };
    case "ne":
      return { r: area.r2, c: area.c1 };
    case "sw":
      return { r: area.r1, c: area.c2 };
    case "se":
      return { r: area.r1, c: area.c1 };
  }
}

/** Pick the track index (1-based) whose extent contains v, snapping gaps to the nearest track. */
function pickTrack(edges: { start: number; end: number }[], v: number): number {
  for (let i = 0; i < edges.length; i++) {
    const next = edges[i + 1];
    const boundary = next ? (edges[i].end + next.start) / 2 : Infinity;
    if (v < boundary) return i + 1;
  }
  return edges.length;
}

interface GridCanvasProps {
  columns: string[];
  rows: string[];
  gap: number;
  items: GridItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (area: GridArea) => void;
  onMoveResize: (id: string, area: GridArea) => void;
}

export function GridCanvas({
  columns,
  rows,
  gap,
  items,
  selectedId,
  onSelect,
  onCreate,
  onMoveResize,
}: GridCanvasProps) {
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const edgesRef = React.useRef<TrackEdges>({ cols: [], rows: [] });
  const dragRef = React.useRef<DragState | null>(null);
  const [drag, setDragState] = React.useState<DragState | null>(null);

  const setDrag = (d: DragState | null) => {
    dragRef.current = d;
    setDragState(d);
  };

  const measure = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const edges: TrackEdges = { cols: [], rows: [] };
    canvas.querySelectorAll<HTMLElement>("[data-cell]").forEach((el) => {
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      const rect = el.getBoundingClientRect();
      if (r === 1) edges.cols[c - 1] = { start: rect.left, end: rect.right };
      if (c === 1) edges.rows[r - 1] = { start: rect.top, end: rect.bottom };
    });
    edgesRef.current = edges;
  };

  const cellFromPoint = (x: number, y: number): Cell => ({
    r: pickTrack(edgesRef.current.rows, y),
    c: pickTrack(edgesRef.current.cols, x),
  });

  const candidate = (d: DragState): GridArea => {
    if (d.mode === "create" || d.mode === "resize") {
      return normalizeArea(d.anchor.r, d.anchor.c, d.current.r, d.current.c);
    }
    const maxR1 = rows.length - d.size.h + 1;
    const maxC1 = columns.length - d.size.w + 1;
    const r1 = Math.min(Math.max(d.current.r - d.offset.dr, 1), maxR1);
    const c1 = Math.min(Math.max(d.current.c - d.offset.dc, 1), maxC1);
    return { r1, c1, r2: r1 + d.size.h - 1, c2: c1 + d.size.w - 1 };
  };

  const isValid = (d: DragState): boolean => {
    const area = candidate(d);
    return d.mode === "create" ? !collides(area, items) : !collides(area, items, d.id);
  };

  React.useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setDrag({ ...d, current: cellFromPoint(e.clientX, e.clientY) });
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d && isValid(d)) {
        const area = candidate(d);
        if (d.mode === "create") onCreate(area);
        else onMoveResize(d.id, area);
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // Listeners only need rebinding when a drag starts or ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  const startCreate = (e: React.PointerEvent, cell: Cell) => {
    if (e.button !== 0) return;
    measure();
    onSelect(null);
    setDrag({ mode: "create", anchor: cell, current: cell });
  };

  const startMove = (e: React.PointerEvent, item: GridItem) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    measure();
    onSelect(item.id);
    const cell = cellFromPoint(e.clientX, e.clientY);
    setDrag({
      mode: "move",
      id: item.id,
      size: { h: item.area.r2 - item.area.r1 + 1, w: item.area.c2 - item.area.c1 + 1 },
      offset: { dr: cell.r - item.area.r1, dc: cell.c - item.area.c1 },
      current: cell,
    });
  };

  const startResize = (e: React.PointerEvent, item: GridItem, corner: Corner) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    measure();
    onSelect(item.id);
    setDrag({
      mode: "resize",
      id: item.id,
      anchor: oppositeCorner(item.area, corner),
      current: cellFromPoint(e.clientX, e.clientY),
    });
  };

  const gridArea = (a: GridArea) => `${a.r1} / ${a.c1} / ${a.r2 + 1} / ${a.c2 + 1}`;
  const dragValid = drag ? isValid(drag) : true;

  return (
    <div
      ref={canvasRef}
      className="grid w-full touch-none rounded-xl select-none"
      style={{
        gridTemplateColumns: columns.join(" "),
        gridTemplateRows: rows.join(" "),
        gap: `${gap}px`,
      }}
    >
      {rows.flatMap((_, ri) =>
        columns.map((__, ci) => {
          const cell = { r: ri + 1, c: ci + 1 };
          return (
            <div
              key={`${cell.r}-${cell.c}`}
              data-cell
              data-r={cell.r}
              data-c={cell.c}
              onPointerDown={(e) => startCreate(e, cell)}
              className="border-border/60 hover:border-primary/40 hover:bg-primary/5 min-h-14 cursor-crosshair rounded-md border border-dashed transition-colors"
              style={{ gridRow: cell.r, gridColumn: cell.c }}
            />
          );
        })
      )}

      {items.map((item) => {
        const dragging = drag && drag.mode !== "create" && drag.id === item.id;
        const area = dragging ? candidate(drag) : item.area;
        const selected = selectedId === item.id;
        return (
          <div
            key={item.id}
            onPointerDown={(e) => startMove(e, item)}
            className={cn(
              "relative z-10 flex min-h-14 cursor-grab items-center justify-center rounded-md border-2 px-2 active:cursor-grabbing",
              ITEM_COLORS[item.color % ITEM_COLORS.length],
              selected && "ring-primary/50 ring-2 ring-offset-1",
              dragging && !dragValid && "ring-destructive ring-2"
            )}
            style={{ gridArea: gridArea(area) }}
          >
            <span className="pointer-events-none truncate font-mono text-xs font-bold">
              {item.name}
            </span>
            <span className="text-muted-foreground/70 pointer-events-none absolute right-1.5 bottom-1 font-mono text-[9px]">
              {area.r2 - area.r1 + 1}×{area.c2 - area.c1 + 1}
            </span>
            {selected &&
              CORNERS.map((corner) => (
                <span
                  key={corner.id}
                  onPointerDown={(e) => startResize(e, item, corner.id)}
                  className={cn(
                    "bg-background border-primary absolute z-20 size-3 rounded-full border-2",
                    corner.className
                  )}
                />
              ))}
          </div>
        );
      })}

      {drag?.mode === "create" && (
        <div
          className={cn(
            "border-primary bg-primary/10 pointer-events-none z-20 rounded-md border-2 border-dashed",
            !dragValid && "border-destructive bg-destructive/10"
          )}
          style={{ gridArea: gridArea(candidate(drag)) }}
        />
      )}
    </div>
  );
}
