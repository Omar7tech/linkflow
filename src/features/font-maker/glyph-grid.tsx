"use client";

import * as React from "react";
import { GROUP_LABELS, SLOTS, type SlotGroup } from "@/lib/font-maker/charset";
import type { Pen } from "@/lib/font-maker/strokes";
import { cn } from "@/lib/utils";
import { paintInk } from "./draw-pad";
import { hasInk, type SlotData } from "./use-font-build";

const GROUPS: SlotGroup[] = ["upper", "lower", "digits", "punct", "alt"];
const THUMB = 44;

const Thumb = React.memo(function Thumb({ slot, pen }: { slot: SlotData; pen: Pen }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.round(THUMB * dpr);
    el.width = size;
    el.height = size;
    const ctx = el.getContext("2d")!;
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim() || "#000";
    paintInk(ctx, size, slot.strokes, slot.scan, pen, ink, document.createElement("canvas"));
  }, [slot, pen]);
  return <canvas ref={ref} className="absolute inset-0 size-full" aria-hidden />;
});

interface GlyphGridProps {
  slots: Record<string, SlotData>;
  active: string;
  pen: Pen;
  onSelect: (key: string) => void;
}

/** Every character of the font, grouped, each showing what has been drawn so far. */
export function GlyphGrid({ slots, active, pen, onSelect }: GlyphGridProps) {
  return (
    <div className="space-y-5">
      {GROUPS.map((group) => {
        const members = SLOTS.filter((s) => s.group === group);
        const done = members.filter((s) => hasInk(slots[s.key])).length;
        return (
          <section key={group}>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-xs font-medium">{GROUP_LABELS[group]}</h3>
              <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
                {done}/{members.length}
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(2.6rem,1fr))] gap-1">
              {members.map((slot) => {
                const data = slots[slot.key];
                const inked = hasInk(data);
                return (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() => onSelect(slot.key)}
                    aria-label={`${slot.alt ? "Second version of " : ""}${slot.char}`}
                    aria-current={active === slot.key ? "true" : undefined}
                    className={cn(
                      "border-border/60 bg-background relative aspect-square overflow-hidden rounded-md border transition-colors",
                      active === slot.key ? "border-primary ring-primary/30 ring-2" : "hover:border-foreground/30"
                    )}
                  >
                    {inked && data ? (
                      <Thumb slot={data} pen={pen} />
                    ) : (
                      <span className="text-muted-foreground/40 absolute inset-0 grid place-items-center text-sm">
                        {slot.char}
                      </span>
                    )}
                    {slot.alt && (
                      <span className="text-muted-foreground/70 absolute top-0.5 right-1 font-mono text-[8px]">2</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
