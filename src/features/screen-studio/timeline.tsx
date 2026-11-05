"use client";

import * as React from "react";
import { MessageSquareTextIcon, ZoomInIcon } from "lucide-react";
import { uid, type Edit } from "@/lib/screen-studio/types";
import { cn } from "@/lib/utils";

export type Selection = { kind: "zoom" | "caption"; id: string } | null;

type Drag =
  | { kind: "seek" }
  | { kind: "trim"; edge: "start" | "end" }
  | { kind: "zoom" | "caption"; id: string; mode: "move" | "start" | "end"; t0: number; start: number; end: number };

const fmt = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;

export function Timeline({
  duration,
  edit,
  thumbs,
  selected,
  onSelect,
  onChange,
  onSeek,
  playheadRef,
}: {
  duration: number;
  edit: Edit;
  thumbs: string[];
  selected: Selection;
  onSelect: (s: Selection) => void;
  onChange: (e: Edit) => void;
  onSeek: (t: number) => void;
  playheadRef: React.RefObject<HTMLDivElement | null>;
}) {
  const area = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<Drag | null>(null);
  const editRef = React.useRef(edit);
  React.useEffect(() => {
    editRef.current = edit;
  }, [edit]);

  const timeAt = (clientX: number) => {
    const r = area.current!.getBoundingClientRect();
    return Math.min(duration, Math.max(0, ((clientX - r.left) / r.width) * duration));
  };
  const pct = (t: number) => `${(t / duration) * 100}%`;

  const begin = (e: React.PointerEvent, d: Drag) => {
    e.stopPropagation();
    drag.current = d;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events have no pointer to capture.
    }
    if (d.kind === "seek") onSeek(timeAt(e.clientX));
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const t = timeAt(e.clientX);
    const cur = editRef.current;
    if (d.kind === "seek") onSeek(t);
    else if (d.kind === "trim") {
      if (d.edge === "start") onChange({ ...cur, trimStart: Math.min(t, cur.trimEnd - 0.5) });
      else onChange({ ...cur, trimEnd: Math.max(t, cur.trimStart + 0.5) });
      onSeek(t);
    } else {
      const dt = t - d.t0;
      let start = d.start;
      let end = d.end;
      if (d.mode === "move") {
        const len = d.end - d.start;
        start = Math.min(duration - len, Math.max(0, d.start + dt));
        end = start + len;
      } else if (d.mode === "start") start = Math.min(d.end - 0.3, Math.max(0, d.start + dt));
      else end = Math.max(d.start + 0.3, Math.min(duration, d.end + dt));
      if (d.kind === "zoom") onChange({ ...cur, zooms: cur.zooms.map((z) => (z.id === d.id ? { ...z, start, end, path: d.mode === "move" ? z.path?.map((p) => ({ ...p, t: p.t + (start - z.start) })) : z.path } : z)) });
      else onChange({ ...cur, captions: cur.captions.map((c) => (c.id === d.id ? { ...c, start, end } : c)) });
    }
  };

  const end = () => (drag.current = null);

  const addZoomAt = (clientX: number) => {
    const t = timeAt(clientX);
    const z = { id: uid(), start: Math.max(0, t - 0.2), end: Math.min(duration, t + 2.5), scale: 1.8, x: 0.5, y: 0.5 };
    onChange({ ...edit, zooms: [...edit.zooms, z] });
    onSelect({ kind: "zoom", id: z.id });
  };

  const addCaptionAt = (clientX: number) => {
    const t = timeAt(clientX);
    const c = { id: uid(), start: t, end: Math.min(duration, t + 2.5), text: "New caption" };
    onChange({ ...edit, captions: [...edit.captions, c] });
    onSelect({ kind: "caption", id: c.id });
  };

  const ticks = Math.min(12, Math.max(4, Math.floor(duration / 5)));

  return (
    <div className="select-none" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div ref={area} className="relative space-y-1.5" onPointerDown={(e) => begin(e, { kind: "seek" })}>
        {/* Time ruler. */}
        <div className="text-muted-foreground relative h-4 font-mono text-[10px]">
          {Array.from({ length: ticks + 1 }, (_, i) => (
            <span key={i} className="absolute -translate-x-1/2" style={{ left: `${(i / ticks) * 100}%` }}>
              {i > 0 && i < ticks ? fmt((i / ticks) * duration) : ""}
            </span>
          ))}
        </div>

        {/* Filmstrip with trim. */}
        <div className="bg-muted relative h-14 overflow-hidden rounded-lg">
          <div className="absolute inset-0 flex">
            {thumbs.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" draggable={false} className="h-full min-w-0 flex-1 object-cover" />
            ))}
          </div>
          <div className="absolute inset-y-0 left-0 bg-black/65" style={{ width: pct(edit.trimStart) }} />
          <div className="absolute inset-y-0 right-0 bg-black/65" style={{ width: `${100 - (edit.trimEnd / duration) * 100}%` }} />
          <div className="border-primary pointer-events-none absolute inset-y-0 rounded-lg border-2" style={{ left: pct(edit.trimStart), right: `${100 - (edit.trimEnd / duration) * 100}%` }} />
          {(["start", "end"] as const).map((edge) => (
            <div
              key={edge}
              role="slider"
              aria-label={edge === "start" ? "Trim start" : "Trim end"}
              aria-valuenow={edge === "start" ? edit.trimStart : edit.trimEnd}
              onPointerDown={(e) => begin(e, { kind: "trim", edge })}
              className="bg-primary absolute inset-y-0 z-10 w-2.5 cursor-ew-resize rounded-sm after:absolute after:inset-y-4 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded after:bg-black/40"
              style={{ left: `calc(${pct(edge === "start" ? edit.trimStart : edit.trimEnd)} - ${edge === "start" ? 0 : 10}px)` }}
            />
          ))}
        </div>

        {/* Zooms. */}
        <Track
          label="Zoom"
          icon={<ZoomInIcon className="size-3" />}
          hint="Double-click to add a zoom"
          onDoubleClick={(e) => addZoomAt(e.clientX)}
        >
          {edit.zooms.map((z) => (
            <Block
              key={z.id}
              left={pct(z.start)}
              width={pct(z.end - z.start)}
              active={selected?.kind === "zoom" && selected.id === z.id}
              tone="zoom"
              onPick={() => onSelect({ kind: "zoom", id: z.id })}
              onDrag={(e, mode) => begin(e, { kind: "zoom", id: z.id, mode, t0: timeAt(e.clientX), start: z.start, end: z.end })}
            >
              {z.auto ? "Auto " : ""}
              {z.scale.toFixed(1)}×
            </Block>
          ))}
        </Track>

        {/* Captions. */}
        <Track
          label="Captions"
          icon={<MessageSquareTextIcon className="size-3" />}
          hint="Double-click to add a caption"
          onDoubleClick={(e) => addCaptionAt(e.clientX)}
        >
          {edit.captions.map((c) => (
            <Block
              key={c.id}
              left={pct(c.start)}
              width={pct(c.end - c.start)}
              active={selected?.kind === "caption" && selected.id === c.id}
              tone="caption"
              onPick={() => onSelect({ kind: "caption", id: c.id })}
              onDrag={(e, mode) => begin(e, { kind: "caption", id: c.id, mode, t0: timeAt(e.clientX), start: c.start, end: c.end })}
            >
              {c.text}
            </Block>
          ))}
        </Track>

        {/* Playhead. */}
        <div ref={playheadRef} className="pointer-events-none absolute top-4 bottom-0 z-20 w-px bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.3)]" style={{ left: 0 }}>
          <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}

function Track({
  label,
  icon,
  hint,
  children,
  onDoubleClick,
}: {
  label: string;
  icon: React.ReactNode;
  hint: string;
  children: React.ReactNode;
  onDoubleClick: (e: React.MouseEvent) => void;
}) {
  const empty = React.Children.count(children) === 0;
  return (
    <div className="bg-muted/50 relative h-8 rounded-md" onDoubleClick={onDoubleClick} title={hint}>
      {empty && (
        <span className="text-muted-foreground/70 pointer-events-none absolute inset-0 flex items-center gap-1.5 px-2 text-[11px]">
          {icon} {label} · {hint.toLowerCase()}
        </span>
      )}
      {children}
    </div>
  );
}

function Block({
  left,
  width,
  active,
  tone,
  children,
  onPick,
  onDrag,
}: {
  left: string;
  width: string;
  active: boolean;
  tone: "zoom" | "caption";
  children: React.ReactNode;
  onPick: () => void;
  onDrag: (e: React.PointerEvent, mode: "move" | "start" | "end") => void;
}) {
  return (
    <div
      className={cn(
        "absolute inset-y-0.5 flex min-w-3 items-center overflow-hidden rounded-[5px] border text-[10.5px] font-medium whitespace-nowrap",
        tone === "zoom" ? "border-primary/50 bg-primary/20 text-primary" : "border-sky-400/40 bg-sky-400/15 text-sky-600 dark:text-sky-300",
        active && (tone === "zoom" ? "border-primary bg-primary/35 ring-primary/30 ring-2" : "border-sky-400 bg-sky-400/30 ring-2 ring-sky-400/30")
      )}
      style={{ left, width }}
      onPointerDown={(e) => {
        onPick();
        onDrag(e, "move");
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize" onPointerDown={(e) => (onPick(), onDrag(e, "start"))} />
      <span className="truncate px-2">{children}</span>
      <span className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize" onPointerDown={(e) => (onPick(), onDrag(e, "end"))} />
    </div>
  );
}
