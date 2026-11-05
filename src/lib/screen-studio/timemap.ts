/**
 * Source time ↔ output time. Trims cut the ends; speed-ups compress dead
 * time, so the output is shorter than the recording.
 */
import type { Edit } from "./types";

interface Piece {
  /** Source range. */
  s0: number;
  s1: number;
  rate: number;
  /** Output time at s0. */
  o0: number;
}

export interface TimeMap {
  duration: number;
  toOut: (t: number) => number;
  toSrc: (o: number) => number;
  rateAt: (t: number) => number;
  pieces: Piece[];
}

export function buildTimeMap(edit: Pick<Edit, "trimStart" | "trimEnd" | "speeds">): TimeMap {
  const { trimStart: a, trimEnd: b } = edit;
  const speeds = edit.speeds
    .map((s) => ({ start: Math.max(a, s.start), end: Math.min(b, s.end), rate: Math.max(1, s.rate) }))
    .filter((s) => s.end - s.start > 0.05)
    .sort((x, y) => x.start - y.start);
  const pieces: Piece[] = [];
  let t = a;
  let o = 0;
  const push = (s1: number, rate: number) => {
    if (s1 - t <= 1e-6) return;
    pieces.push({ s0: t, s1, rate, o0: o });
    o += (s1 - t) / rate;
    t = s1;
  };
  for (const s of speeds) {
    if (s.start < t) continue;
    push(s.start, 1);
    push(s.end, s.rate);
  }
  push(b, 1);
  if (!pieces.length) pieces.push({ s0: a, s1: b, rate: 1, o0: 0 });

  const find = (t: number) => pieces.find((p) => t < p.s1) ?? pieces[pieces.length - 1];
  return {
    pieces,
    duration: o,
    toOut(t) {
      const p = find(Math.min(b, Math.max(a, t)));
      return p.o0 + (Math.min(p.s1, Math.max(p.s0, t)) - p.s0) / p.rate;
    },
    toSrc(out) {
      const q = Math.min(o, Math.max(0, out));
      const p = pieces.find((x) => q < x.o0 + (x.s1 - x.s0) / x.rate) ?? pieces[pieces.length - 1];
      return Math.min(p.s1, p.s0 + (q - p.o0) * p.rate);
    },
    rateAt(t) {
      return find(t).rate;
    },
  };
}
