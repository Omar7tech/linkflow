/**
 * The editor. Turns a first-pass analysis into the decisions a senior
 * editor makes on a screen recording:
 *
 * - Trim the fumbling at the start and the switch back to stop at the end.
 * - Speed through silent waiting, never while someone is talking.
 * - Plan zoom shots around what matters: typing, clicks and their response,
 *   and the cursor resting while the narrator explains something.
 * - Size each shot to its subject: tight on a line of text, wider when the
 *   action is spread out.
 * - Hold the camera still. It only pans when the action leaves the middle
 *   of the frame, the way a camera operator works with a dead zone.
 * - Never zoom out just to zoom back in: nearby shots are joined by a pan.
 * - Pull out for scrolls and page changes, which need the whole view.
 * - Mark clicks for a ripple.
 */
import { voiceAt, type Analysis, type Sample } from "./analyze";
import { uid, type Click, type FocusPoint, type Speed, type Zoom } from "./types";

export interface Plan {
  trimStart: number;
  trimEnd: number;
  zooms: Zoom[];
  speeds: Speed[];
  clicks: Click[];
  summary: { trimmed: number; spedUp: number; saved: number; zooms: number; clicks: number };
}

interface Focus {
  t: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "typing" | "click" | "change" | "point";
}

const isActive = (s: Sample) => s.kind !== "idle";

function smartTrim(a: Analysis) {
  const { samples } = a;
  const firstActive = samples.find((s) => isActive(s) && s.kind !== "page") ?? samples[0];
  const firstVoice = a.voice.indexOf(1) * 0.1;
  const startAt = Math.min(firstActive?.t ?? 0, firstVoice >= 0 ? firstVoice : Infinity);
  const trimStart = startAt > 1 ? startAt - 0.5 : 0;

  // The recording usually ends with a switch back to this tab to press stop.
  let end = a.duration;
  for (let i = samples.length - 1; i >= 0 && samples[i].t > a.duration - 4; i--) {
    if (samples[i].kind === "page" && !voiceAt(a, samples[i].t)) {
      end = samples[i].t - 0.15;
      break;
    }
  }
  // Then drop the quiet tail.
  let lastActive = trimStart;
  for (const s of samples) if (s.t < end && (isActive(s) || voiceAt(a, s.t))) lastActive = s.t;
  const trimEnd = end - lastActive > 1.4 ? lastActive + 0.9 : end;
  return { trimStart, trimEnd: Math.max(trimStart + 1, trimEnd) };
}

function deadTime(a: Analysis, from: number, to: number): Speed[] {
  const out: Speed[] = [];
  let run: Sample[] = [];
  const close = () => {
    if (run.length) {
      const s = run[0].t;
      const e = run[run.length - 1].t;
      const len = e - s;
      if (len >= 2.2) out.push({ id: uid(), start: s + 0.35, end: e - 0.35, rate: len > 10 ? 8 : len > 5 ? 5 : 3, auto: true });
    }
    run = [];
  };
  for (const s of a.samples) {
    if (s.t < from || s.t > to) continue;
    const quiet = (s.kind === "idle" || s.kind === "cursor") && !voiceAt(a, s.t);
    if (quiet) run.push(s);
    else close();
  }
  close();
  return out;
}

function findClicks(a: Analysis): Click[] {
  const clicks: Click[] = [];
  const s = a.samples;
  let cursor: { x: number; y: number; t: number } | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c.cx >= 0 && c.kind === "cursor") {
      cursor = { x: c.cx, y: c.cy, t: c.t };
      continue;
    }
    if (!cursor || c.kind !== "local" || c.t - cursor.t > 1.2) continue;
    // Something near a resting cursor reacted: that's a click.
    const near = Math.abs(c.x - cursor.x) < Math.max(0.06, c.w / 2 + 0.02) && Math.abs(c.y - cursor.y) < Math.max(0.06, c.h / 2 + 0.02);
    const bigger = c.changed > 0.0012;
    const prevClick = clicks[clicks.length - 1];
    if (near && bigger && (!prevClick || c.t - prevClick.t > 0.5)) {
      clicks.push({ t: Math.max(0, c.t - 0.12), x: cursor.x, y: cursor.y });
      cursor = null;
    }
  }
  return clicks;
}

function focusPoints(a: Analysis, clicks: Click[]): Focus[] {
  const out: Focus[] = [];
  const s = a.samples;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c.kind === "local" && c.w * c.h <= 0.2) {
      // Typing: small, short-height changes recurring on one line.
      const line = s.slice(Math.max(0, i - 6), i + 6).filter((x) => x.kind === "local" && x.h < 0.08 && Math.abs(x.y - c.y) < 0.04);
      const typing = c.h < 0.08 && line.length >= 4;
      out.push({ t: c.t, x: c.x, y: c.y, w: c.w, h: c.h, kind: typing ? "typing" : "change" });
    }
  }
  for (const k of clicks) out.push({ t: k.t, x: k.x, y: k.y, w: 0.12, h: 0.08, kind: "click" });
  // The cursor coming to rest while the narrator talks: they're pointing at something.
  for (let i = 1; i < s.length; i++) {
    const c = s[i];
    if (c.kind !== "cursor" || c.cx < 0) continue;
    const next = s.slice(i + 1, i + 10);
    const rests = next.length >= 8 && next.every((x) => x.kind === "idle");
    if (rests && voiceAt(a, c.t + 0.4)) out.push({ t: c.t + 0.2, x: c.cx, y: c.cy, w: 0.2, h: 0.14, kind: "point" });
  }
  return out.sort((p, q) => p.t - q.t);
}

function planShots(a: Analysis, focus: Focus[], speeds: Speed[], from: number, to: number): Zoom[] {
  // Scrolls, new pages and big changes (a modal, a new panel) need the whole view.
  const breaks = a.samples.filter((s) => s.kind === "scroll" || s.kind === "page" || (s.kind === "local" && s.w * s.h > 0.2)).map((s) => s.t);
  const breakBetween = (t0: number, t1: number) => breaks.some((b) => b > t0 && b < t1) || speeds.some((sp) => sp.start < t1 && sp.end > t0);
  const shots: Zoom[] = [];
  let group: Focus[] = [];

  const close = () => {
    const g = group;
    group = [];
    if (!g.length) return;
    const first = g[0].t;
    const last = g[g.length - 1].t;
    const strong = g.some((f) => f.kind === "click" || f.kind === "typing" || f.kind === "point");
    if (last - first < 0.6 && !strong) return;
    if (g.length < 3 && !strong) return;
    const typing = g.filter((f) => f.kind === "typing").length > g.length / 3;
    const clicked = g.some((f) => f.kind === "click");

    // Frame the subject, not everything that happened: size the shot to a
    // typical piece of the action with room around it, and let the camera
    // pan to follow the rest.
    const sizes = g.filter((f) => f.w * f.h < 0.15).map((f) => Math.max(f.w, f.h * 0.8));
    sizes.sort((p, q) => p - q);
    const subject = sizes.length ? sizes[Math.floor(sizes.length * 0.8)] : 0.3;
    const room = typing ? 0.3 : clicked ? 0.36 : 0.42;
    const max = typing ? 2.5 : clicked ? 2.2 : 2;
    const scale = Math.round(Math.min(max, Math.max(1.4, 1 / (subject + room))) * 10) / 10;

    // A camera with a dead zone: hold still, pan only when the action leaves
    // the middle of the frame, and lead typing so the line reads left to right.
    const zone = 0.2 / scale;
    let cx = g[0].x;
    let cy = g[0].y;
    if (typing) cx = g[0].x + 0.32 / scale;
    const path: FocusPoint[] = [{ t: first, x: cx, y: cy }];
    for (const f of g) {
      const ahead = f.kind === "typing" ? f.x + 0.12 / scale : f.x;
      if (Math.abs(ahead - cx) > zone || Math.abs(f.y - cy) > zone) {
        path.push({ t: f.t - 0.01, x: cx, y: cy });
        cx = f.kind === "typing" ? f.x + 0.3 / scale : f.x;
        cy = f.y;
        path.push({ t: f.t + 0.3, x: cx, y: cy });
      }
    }
    const hold = typing ? 1.3 : 1.1;
    shots.push({
      id: uid(),
      start: Math.max(from, first - 0.15),
      end: Math.min(to, last + hold),
      scale,
      x: path[0].x,
      y: path[0].y,
      path: path.length > 1 ? path : undefined,
      auto: true,
    });
  };

  for (const f of focus) {
    if (f.t < from || f.t > to) continue;
    if (speeds.some((sp) => f.t > sp.start && f.t < sp.end)) continue;
    if (group.length) {
      const prev = group[group.length - 1];
      // Far jumps get a fresh shot (out and back in); near ones a pan.
      const far = Math.hypot(f.x - prev.x, f.y - prev.y) > 0.5;
      if (f.t - prev.t > 1.6 || far || breakBetween(prev.t, f.t)) close();
    }
    group.push(f);
  }
  close();

  // Join close shots with a pan instead of pulling out and back in.
  for (let i = 0; i + 1 < shots.length; i++) {
    const a1 = shots[i];
    const b1 = shots[i + 1];
    if (b1.start - a1.end < 1.1 && !breakBetween(a1.end, b1.start)) a1.end = b1.start;
    if (a1.end > b1.start) a1.end = b1.start;
  }
  return shots.filter((z) => z.end - z.start > 0.5);
}

export function direct(a: Analysis): Plan {
  const { trimStart, trimEnd } = smartTrim(a);
  const speeds = deadTime(a, trimStart, trimEnd);
  const clicks = findClicks(a).filter((c) => c.t >= trimStart && c.t <= trimEnd);
  const zooms = planShots(a, focusPoints(a, clicks), speeds, trimStart, trimEnd);
  // Open on the wide shot: let viewers see the whole screen before the first move.
  if (zooms[0] && zooms[0].start < trimStart + 1) {
    zooms[0].start = trimStart + 1;
    if (zooms[0].end - zooms[0].start < 0.8) zooms.shift();
  }
  const saved = speeds.reduce((acc, s) => acc + (s.end - s.start) * (1 - 1 / s.rate), 0);
  return {
    trimStart,
    trimEnd,
    zooms,
    speeds,
    clicks,
    summary: {
      trimmed: trimStart + (a.duration - trimEnd),
      spedUp: speeds.length,
      saved,
      zooms: zooms.length,
      clicks: clicks.length,
    },
  };
}
