/**
 * Swiss poster generator.
 *
 * Every poster is built on a modular grid (margins, columns, gutters, rows)
 * and every element snaps to it, which is what keeps a shuffle looking
 * designed rather than random. Compositions are the classic moves of the
 * International Typographic Style: a dominant form, a strong typographic
 * block, asymmetric balance, small precise information in columns, and
 * photography printed in one or two inks.
 *
 * Elements can carry a motion: every motion is a seamless 6-second loop, so
 * any poster can also become a moving poster.
 */
import { FONT_BY_ID, bodyFont, type FontId } from "./fonts";
import type { TreatedPhoto } from "./photo";

/* ---------------------------------------------------------------- random */

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
    range: (min: number, max: number) => min + next() * (max - min),
  };
}
type Rng = ReturnType<typeof rng>;

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

/* ----------------------------------------------------------------- sizes */

export type SizeId = "a4" | "a3" | "a2" | "b2" | "instagram" | "story";

/** Width and height in millimetres (social sizes use a 210 mm-wide frame). */
export const SIZES: Record<SizeId, { label: string; w: number; h: number; print: boolean; px?: [number, number] }> = {
  a4: { label: "A4", w: 210, h: 297, print: true },
  a3: { label: "A3", w: 297, h: 420, print: true },
  a2: { label: "A2", w: 420, h: 594, print: true },
  b2: { label: "50 × 70 cm", w: 500, h: 700, print: true },
  instagram: { label: "Instagram 4:5", w: 210, h: 262.5, print: false, px: [1080, 1350] },
  story: { label: "Story 9:16", w: 210, h: 373.33, print: false, px: [1080, 1920] },
};

/* -------------------------------------------------------------- palettes */

export interface Palette {
  name: string;
  bg: string;
  ink: string;
  accent: string;
}

export const PALETTES: Palette[] = [
  { name: "Zürich", bg: "#f1ede4", ink: "#141414", accent: "#e3241b" },
  { name: "Basel", bg: "#e3241b", ink: "#141414", accent: "#f1ede4" },
  { name: "Ulm", bg: "#141414", ink: "#f1ede4", accent: "#e3241b" },
  { name: "Bauhaus", bg: "#ece4d3", ink: "#1b1b1b", accent: "#1d4fa6" },
  { name: "Lausanne", bg: "#1d4fa6", ink: "#f1ede4", accent: "#f2bd1d" },
  { name: "Signal", bg: "#f4f3ef", ink: "#111111", accent: "#ff4a1c" },
  { name: "Forest", bg: "#0f3a30", ink: "#e9f3ec", accent: "#34d399" },
  { name: "Ochre", bg: "#e9b949", ink: "#1a1612", accent: "#c8361c" },
  { name: "Ice", bg: "#dfe8ec", ink: "#0e2a47", accent: "#ff5b3a" },
  { name: "Rose", bg: "#f6d5d0", ink: "#2b1b1e", accent: "#1e5b3f" },
  { name: "Night", bg: "#0b1020", ink: "#eef0f6", accent: "#7c5cff" },
  { name: "Mono", bg: "#ffffff", ink: "#000000", accent: "#000000" },
];

/* --------------------------------------------------------------- content */

export interface PosterContent {
  title: string;
  subtitle: string;
  details: string;
  number: string;
  photo?: TreatedPhoto | null;
}

export type StyleId =
  | "circle"
  | "bars"
  | "type"
  | "diagonal"
  | "modular"
  | "concentric"
  | "number"
  | "stairs"
  | "orbit"
  | "echo"
  | "letters"
  | "giant"
  | "opart"
  | "strips"
  | "split";

export const STYLES: { id: StyleId; label: string; photo?: boolean }[] = [
  { id: "circle", label: "Circle" },
  { id: "orbit", label: "Orbit" },
  { id: "echo", label: "Echo" },
  { id: "split", label: "Split type" },
  { id: "letters", label: "Letter grid" },
  { id: "giant", label: "Giant letter" },
  { id: "opart", label: "Op-art" },
  { id: "strips", label: "Photo strips", photo: true },
  { id: "bars", label: "Bars" },
  { id: "type", label: "Typographic" },
  { id: "diagonal", label: "Diagonal" },
  { id: "modular", label: "Modular" },
  { id: "concentric", label: "Concentric" },
  { id: "number", label: "Big number" },
  { id: "stairs", label: "Stairs" },
];

export interface PosterSettings {
  size: SizeId;
  style: StyleId | "auto";
  palette: number;
  /** Overrides the palette when set. */
  custom: Palette | null;
  font: FontId;
  columns: number;
  /** Margin as a fraction of the poster width. */
  margin: number;
  /** Headline scale. */
  scale: number;
  caseMode: "upper" | "asis" | "lower";
  layoutSeed: number;
  typeSeed: number;
}

/* ---------------------------------------------------------------- motion */

export type Anim =
  | { type: "spin"; cx: number; cy: number; turns: number }
  | { type: "sway"; cx: number; cy: number; deg: number; delay?: number }
  | { type: "move"; dx: number; dy: number; delay?: number }
  | { type: "pulse"; cx: number; cy: number; s: number; delay?: number }
  | { type: "flow" };

export const LOOP = 6;

/** The transform an element's motion adds at time t (seconds). */
export function animTransform(a: Anim | undefined, t: number): string {
  if (!a || !t) return "";
  const p = (t % LOOP) / LOOP;
  const wave = (delay = 0) => Math.sin((p + delay) * Math.PI * 2);
  switch (a.type) {
    case "spin":
      return `rotate(${p * 360 * a.turns} ${a.cx} ${a.cy})`;
    case "sway":
      return `rotate(${a.deg * wave(a.delay)} ${a.cx} ${a.cy})`;
    case "move":
      return `translate(${a.dx * wave(a.delay)} ${a.dy * wave(a.delay)})`;
    case "pulse": {
      const s = 1 + a.s * wave(a.delay);
      return `translate(${a.cx} ${a.cy}) scale(${s}) translate(${-a.cx} ${-a.cy})`;
    }
    default:
      return "";
  }
}

/* -------------------------------------------------------------- elements */

interface Base {
  t?: string;
  anim?: Anim;
}

export type El = Base &
  (
    | { k: "rect"; x: number; y: number; w: number; h: number; fill: string }
    | { k: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number }
    | { k: "path"; d: string; fill?: string; stroke?: string; sw?: number }
    | { k: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number }
    | {
        k: "text";
        x: number;
        y: number;
        text: string;
        size: number;
        weight: number;
        fill: string;
        stroke?: string;
        sw?: number;
        anchor?: "start" | "end" | "middle";
        fit?: number;
        tracking?: number;
        role?: "head" | "body" | "mono";
      }
    | { k: "ring"; cx: number; cy: number; r: number; text: string; size: number; weight: number; fill: string; tracking?: number }
    | { k: "wave"; x0: number; x1: number; y: number; amp: number; len: number; bulge: { x: number; y: number; r: number }; h: number; fill: string }
    | { k: "image"; x: number; y: number; w: number; h: number; href: string; clip?: string }
    | { k: "group"; clip?: string; children: El[] }
  );

export interface Clip {
  id: string;
  shape: El;
}

export interface Grid {
  m: number;
  cols: number;
  rows: number;
  colW: number;
  rowH: number;
  gutter: number;
}

export interface Poster {
  w: number;
  h: number;
  bg: string;
  els: El[];
  clips: Clip[];
  grid: Grid;
  style: StyleId;
  font: FontId;
  palette: Palette;
}

/* ----------------------------------------------------------- type metrics */

/**
 * Helvetica Bold advance widths (per 1000 em), the fallback measure before
 * the real fonts load (Arial shares these metrics).
 */
const HELV: Record<string, number> = {
  A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 556, K: 722, L: 611, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278, j: 278, k: 556, l: 278, m: 889,
  n: 611, o: 611, p: 611, q: 611, r: 389, s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, z: 500,
  " ": 278, ".": 278, ",": 278, "-": 333, "–": 556, ":": 333, "!": 333, "?": 611, "&": 722, "/": 278,
};

export type Measure = (text: string, role: "head" | "body", weight: number) => number;

export const helveticaMeasure: Measure = (text) => {
  let w = 0;
  for (const ch of text) w += HELV[ch] ?? (/\d/.test(ch) ? 556 : 600);
  return w / 1000;
};

/* --------------------------------------------------------------- builder */

interface Ctx {
  W: number;
  H: number;
  g: Grid;
  r: Rng;
  pal: Palette;
  c: PosterContent;
  s: PosterSettings;
  els: El[];
  clips: Clip[];
  colX: (i: number) => number;
  span: (n: number) => number;
  rowY: (j: number) => number;
  rows: (n: number) => number;
  head: { weight: number; tracking: number };
  em: (text: string, tracking?: number) => number;
  cap: number;
  title: string;
}

/** Splits a title into up to `max` lines with the most even widths. */
function lines(cx: Ctx, title: string, max: number) {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length <= 1 || max <= 1) return [words.join(" ")];
  const n = Math.min(max, words.length);
  let best: string[] = [words.join(" ")];
  let bestScore = Infinity;
  // Try every way to cut the words into n lines (titles are short).
  const cut = (start: number, left: number, acc: string[]) => {
    if (left === 1) {
      const all = [...acc, words.slice(start).join(" ")];
      const widths = all.map((l) => cx.em(l));
      const score = Math.max(...widths) - Math.min(...widths);
      if (score < bestScore) {
        bestScore = score;
        best = all;
      }
      return;
    }
    for (let i = start + 1; i <= words.length - left + 1; i++) cut(i, left - 1, [...acc, words.slice(start, i).join(" ")]);
  };
  cut(0, n, []);
  return best;
}

function headline(cx: Ctx, text: string, x: number, y: number, width: number, maxSize: number, fill: string, extra: Partial<Extract<El, { k: "text" }>> = {}) {
  const { tracking, weight } = cx.head;
  const natural = width / cx.em(text, tracking);
  const size = Math.min(maxSize, natural);
  cx.els.push({ k: "text", x, y, text, size, weight, fill, tracking, role: "head", fit: size === natural ? width : undefined, ...extra });
  return size;
}

/** Lines stacked downward from `top`, each filling `width`. Returns the bottom. */
function stack(cx: Ctx, words: string[], x: number, top: number, width: number, maxTotal: number, fill: string, anim?: (i: number) => Anim | undefined) {
  const sizes = words.map((w) => width / cx.em(w, cx.head.tracking));
  const total = sizes.reduce((s, z) => s + z * (cx.cap + 0.14), 0);
  const k = Math.min(cx.s.scale, maxTotal / total);
  let y = top;
  words.forEach((w, i) => {
    const size = sizes[i] * k;
    y += size * cx.cap;
    cx.els.push({
      k: "text",
      x,
      y,
      text: w,
      size,
      weight: cx.head.weight,
      fill,
      tracking: cx.head.tracking,
      role: "head",
      fit: k >= 0.999 ? width : undefined,
      anim: anim?.(i),
    });
    y += size * 0.16;
  });
  return y;
}

function info(cx: Ctx, x: number, top: number, fill: string, opts: { anchor?: "start" | "end"; subtitle?: boolean } = {}) {
  const size = cx.W * 0.021;
  let y = top;
  if (opts.subtitle !== false && cx.c.subtitle.trim()) {
    y += size * 1.5 * 0.72;
    cx.els.push({ k: "text", x, y, text: cx.c.subtitle, size: size * 1.5, weight: 700, fill, anchor: opts.anchor, tracking: -0.01, role: "body" });
    y += size * 1.1;
  }
  cx.c.details
    .split("\n")
    .filter((l) => l.trim())
    .forEach((line, i) => {
      y += size * 1.3;
      cx.els.push({ k: "text", x, y, text: line, size, weight: i === 0 ? 700 : 400, fill, anchor: opts.anchor, role: "body" });
    });
  return y;
}

const infoHeight = (cx: Ctx) => {
  const size = cx.W * 0.021;
  const n = cx.c.details.split("\n").filter((l) => l.trim()).length;
  return (cx.c.subtitle.trim() ? size * 2.6 : 0) + n * size * 1.3;
};

function meta(cx: Ctx, x: number, y: number, fill: string, anchor: "start" | "end" = "start") {
  const text = `N° ${cx.c.number || "01"}   ${cx.g.cols} × ${cx.g.rows}`;
  cx.els.push({ k: "text", x, y, text, size: cx.W * 0.014, weight: 400, fill, anchor, role: "mono", tracking: 0.04 });
}

function photoIn(cx: Ctx, shape: El, id: string) {
  const p = cx.c.photo;
  if (!p) return false;
  cx.clips.push({ id, shape });
  // Cover the clip's box with the photo.
  const box =
    shape.k === "circle"
      ? { x: shape.cx - shape.r, y: shape.cy - shape.r, w: shape.r * 2, h: shape.r * 2 }
      : shape.k === "rect"
        ? { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
        : { x: 0, y: 0, w: cx.W, h: cx.H };
  const scale = Math.max(box.w / p.width, box.h / p.height);
  const w = p.width * scale;
  const h = p.height * scale;
  cx.els.push({ k: "image", x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h, href: p.url, clip: id });
  return true;
}

/* ---------------------------------------------------------- compositions */

const STYLE_FNS: Record<StyleId, (cx: Ctx) => void> = {
  circle(cx) {
    const { r, g, pal, W: PW, H } = cx;
    let radius = cx.span(g.cols) * r.range(0.36, 0.52);
    const c0 = { x: cx.colX(r.int(1, g.cols - 1)), y: cx.rowY(r.int(1, Math.max(1, Math.floor(g.rows * 0.45)))) };
    // The information goes to the top corner away from the circle, and the
    // circle never grows into it.
    const infoLeft = c0.x >= PW / 2;
    const infoW = cx.span(Math.ceil(g.cols * 0.45));
    const box = { x0: infoLeft ? g.m : PW - g.m - infoW, x1: infoLeft ? g.m + infoW : PW - g.m, y1: g.m + infoHeight(cx) + PW * 0.02 };
    const dx = Math.max(box.x0 - c0.x, 0, c0.x - box.x1);
    const dy = Math.max(0, c0.y - box.y1);
    radius = Math.max(cx.span(2), Math.min(radius, Math.hypot(dx, dy) - PW * 0.02));
    const disc: El = { k: "circle", cx: c0.x, cy: c0.y, r: radius, fill: pal.accent };
    if (!photoIn(cx, disc, "disc")) cx.els.push({ ...disc, anim: { type: "move", dx: 0, dy: PW * 0.015 } });
    if (r.chance(0.7))
      cx.els.push({
        k: "circle",
        cx: c0.x + radius * r.range(-0.7, 0.7),
        cy: c0.y + radius * r.range(0.3, 0.8),
        r: radius * r.range(0.25, 0.45),
        stroke: pal.ink,
        sw: PW * 0.004,
        anim: { type: "sway", cx: c0.x, cy: c0.y, deg: 14 },
      });
    const words = lines(cx, cx.title, r.int(1, 3));
    const top = H - g.m - Math.min(H * 0.34, words.length * H * 0.11);
    stack(cx, words, g.m, top, cx.span(g.cols), H - g.m - top, pal.ink);
    info(cx, infoLeft ? g.m : PW - g.m, g.m, pal.ink, { anchor: infoLeft ? "start" : "end" });
    meta(cx, infoLeft ? PW - g.m : g.m, g.m + PW * 0.012, pal.ink, infoLeft ? "end" : "start");
  },

  orbit(cx) {
    const { r, g, pal, W: PW, H } = cx;
    const R = cx.span(g.cols) * r.range(0.36, 0.44);
    const center = { x: PW / 2 + r.pick([-1, 0, 1]) * cx.span(1) * 0.5, y: g.m + R + cx.span(1) * 0.9 };
    const disc: El = { k: "circle", cx: center.x, cy: center.y, r: R * 0.78, fill: pal.accent };
    if (!photoIn(cx, disc, "orbit")) cx.els.push(disc);
    // The title runs round and round the circle.
    const unit = `${cx.title} — `;
    const size = R * 0.15;
    const circumference = 2 * Math.PI * R;
    const reps = Math.max(1, Math.round(circumference / (cx.em(unit, cx.head.tracking) * size)));
    cx.els.push({
      k: "ring",
      cx: center.x,
      cy: center.y,
      r: R,
      text: unit.repeat(reps),
      size,
      weight: cx.head.weight,
      fill: pal.ink,
      tracking: cx.head.tracking,
      anim: { type: "spin", cx: center.x, cy: center.y, turns: -1 / reps },
    });
    if (r.chance(0.6)) cx.els.push({ k: "circle", cx: center.x, cy: center.y, r: R * 1.18, stroke: pal.ink, sw: PW * 0.0025 });
    const bottom = H - g.m - infoHeight(cx);
    const words = lines(cx, cx.title, 2);
    const top = center.y + R * 1.35;
    stack(cx, words, g.m, top, cx.span(g.cols), Math.max(PW * 0.05, bottom - top - PW * 0.04), pal.ink);
    info(cx, g.m, bottom, pal.ink);
    meta(cx, PW - g.m, H - g.m, pal.ink, "end");
  },

  echo(cx) {
    const { r, g, pal, W: PW, H } = cx;
    const text = cx.title.split(/\s+/)[0] ?? cx.title;
    const width = cx.span(g.cols);
    const size = Math.min(width / cx.em(text, cx.head.tracking), H * 0.2) * cx.s.scale;
    const step = size * cx.cap * r.range(0.95, 1.12);
    const count = Math.ceil((H - g.m) / step);
    const solid = r.int(Math.floor(count * 0.35), Math.floor(count * 0.6));
    for (let i = 0; i < count; i++) {
      const y = g.m + size * cx.cap + i * step;
      const filled = i === solid;
      cx.els.push({
        k: "text",
        x: g.m,
        y,
        text,
        size,
        weight: cx.head.weight,
        fill: filled ? pal.accent : "none",
        stroke: filled ? undefined : pal.ink,
        sw: filled ? undefined : PW * 0.0018,
        tracking: cx.head.tracking,
        role: "head",
        fit: size === width / cx.em(text, cx.head.tracking) ? width : undefined,
        anim: { type: "move", dx: PW * 0.02 * (i % 2 ? 1 : -1), dy: 0, delay: i * 0.06 },
      });
    }
    const bh = infoHeight(cx) + PW * 0.05;
    cx.els.push({ k: "rect", x: PW - g.m - cx.span(Math.ceil(g.cols / 2)) - PW * 0.02, y: H - g.m - bh, w: cx.span(Math.ceil(g.cols / 2)) + PW * 0.02 + g.m, h: bh + g.m, fill: pal.bg });
    info(cx, PW - g.m, H - g.m - infoHeight(cx), pal.ink, { anchor: "end" });
    meta(cx, g.m, H - g.m, pal.ink);
  },

  split(cx) {
    const { r, g, pal, W: PW, H } = cx;
    const words = lines(cx, cx.title, 2);
    const shift = cx.span(1) * r.range(0.6, 1.4);
    // The halves move apart by the shift, so the type is fitted to what is left.
    const width = cx.span(g.cols) - shift;
    const sizes = words.map((w) => width / cx.em(w, cx.head.tracking));
    const size = Math.min(...sizes, H * 0.24) * cx.s.scale;
    const blockH = words.length * size * (cx.cap + 0.12);
    const top = H * r.range(0.22, 0.38);
    const cutY = top + blockH / 2;
    const textEls = (dx: number): El[] =>
      words.map((w, i) => ({
        k: "text" as const,
        x: g.m + shift / 2 + dx,
        y: top + (i + 1) * size * cx.cap + i * size * 0.12,
        text: w,
        size,
        weight: cx.head.weight,
        fill: pal.ink,
        tracking: cx.head.tracking,
        role: "head" as const,
      }));
    cx.clips.push({ id: "upper", shape: { k: "rect", x: 0, y: 0, w: PW, h: cutY, fill: "#000" } });
    cx.clips.push({ id: "lower", shape: { k: "rect", x: 0, y: cutY, w: PW, h: H, fill: "#000" } });
    cx.els.push({ k: "rect", x: 0, y: cutY - PW * 0.004, w: PW, h: PW * 0.008, fill: pal.accent });
    // The halves slide inside fixed windows: the clip stays, the type moves.
    cx.els.push({ k: "group", clip: "upper", children: [{ k: "group", children: textEls(-shift / 2), anim: { type: "move", dx: -shift * 0.4, dy: 0 } }] });
    cx.els.push({ k: "group", clip: "lower", children: [{ k: "group", children: textEls(shift / 2), anim: { type: "move", dx: shift * 0.4, dy: 0 } }] });
    const dot = cx.span(2);
    cx.els.push({ k: "circle", cx: PW - g.m - dot / 2, cy: g.m + dot / 2, r: dot / 2, fill: pal.accent, anim: { type: "pulse", cx: PW - g.m - dot / 2, cy: g.m + dot / 2, s: 0.08 } });
    info(cx, g.m, H - g.m - infoHeight(cx), pal.ink);
    meta(cx, g.m, g.m + PW * 0.012, pal.ink);
  },

  letters(cx) {
    const { r, g, pal, W: PW, H } = cx;
    const letters = [...cx.title.replace(/\s+/g, "")].slice(0, 24);
    const target = (H - 2 * g.m - infoHeight(cx)) * 0.82;
    let perRow = 2;
    let bestDiff = Infinity;
    for (let n = 2; n <= 6; n++) {
      const c = (PW - 2 * g.m - (n - 1) * g.gutter) / n;
      const height = Math.ceil(letters.length / n) * (c + g.gutter);
      const diff = height <= target ? target - height : (height - target) * 4;
      if (diff < bestDiff) {
        bestDiff = diff;
        perRow = n;
      }
    }
    const cell = (PW - 2 * g.m - (perRow - 1) * g.gutter) / perRow;
    const rowsN = Math.ceil(letters.length / perRow);
    const colors = [pal.ink, pal.accent, pal.bg];
    const top = g.m + PW * 0.02;
    letters.forEach((ch, i) => {
      const x = g.m + (i % perRow) * (cell + g.gutter);
      const y = top + Math.floor(i / perRow) * (cell + g.gutter);
      const kind = r.int(0, 2);
      const fill = colors[(i + kind) % 2];
      const ink = fill === pal.accent ? pal.bg : fill === pal.ink ? pal.bg : pal.ink;
      const center = { x: x + cell / 2, y: y + cell / 2 };
      if (kind === 0) cx.els.push({ k: "rect", x, y, w: cell, h: cell, fill });
      else if (kind === 1) cx.els.push({ k: "circle", cx: center.x, cy: center.y, r: cell / 2, fill });
      else cx.els.push({ k: "rect", x, y, w: cell, h: cell, fill: "none" });
      const size = cell * 0.82;
      cx.els.push({
        k: "text",
        x: center.x,
        y: center.y + size * cx.cap * 0.5,
        text: ch,
        size,
        weight: cx.head.weight,
        fill: kind === 2 ? pal.ink : ink,
        anchor: "middle",
        role: "head",
        anim: { type: "sway", cx: center.x, cy: center.y, deg: r.pick([0, 0, 8, -8]), delay: i * 0.05 },
      });
    });
    const after = top + rowsN * (cell + g.gutter);
    info(cx, g.m, Math.max(after + PW * 0.02, H - g.m - infoHeight(cx)), pal.ink);
    meta(cx, PW - g.m, H - g.m, pal.ink, "end");
  },

  giant(cx) {
    const { r, g, pal, W: PW, H } = cx;
    const letter = [...cx.title.trim()][0] ?? "A";
    const size = H * r.range(0.85, 1.05) * cx.s.scale;
    const x = PW * r.range(-0.15, 0.05);
    const y = H * r.range(0.72, 0.86);
    const shape: El = { k: "text", x, y, text: letter, size, weight: cx.head.weight, fill: pal.accent, role: "head" };
    if (!photoIn(cx, shape, "giant")) cx.els.push({ ...shape, anim: { type: "move", dx: PW * 0.03, dy: 0 } });
    const words = lines(cx, cx.title, 2);
    const colStart = Math.ceil(g.cols / 2);
    stack(cx, words, cx.colX(colStart), g.m, cx.span(g.cols - colStart), H * 0.2, pal.ink);
    info(cx, PW - g.m, H - g.m - infoHeight(cx), pal.ink, { anchor: "end" });
    meta(cx, PW - g.m, H * 0.3, pal.ink, "end");
  },

  opart(cx) {
    const { r, g, pal, W: PW, H } = cx;
    const band = PW * r.range(0.012, 0.022);
    const bulge = { x: cx.colX(r.int(1, g.cols - 2)), y: H * r.range(0.3, 0.55), r: PW * r.range(0.25, 0.4) };
    const baseline = H - g.m - infoHeight(cx) - PW * 0.02;
    const headSize = Math.min(H * 0.12 * cx.s.scale, cx.span(g.cols) / cx.em(cx.title, cx.head.tracking));
    const top = g.m;
    const bottom = baseline - headSize * cx.cap - PW * 0.05 - band * 3;
    for (let y = top; y < bottom; y += band * 2)
      cx.els.push({ k: "wave", x0: 0, x1: PW, y, amp: band * r.range(2, 4), len: PW * r.range(0.3, 0.6), bulge, h: band, fill: pal.ink, anim: { type: "flow" } });
    const disc = cx.span(2);
    cx.els.push({ k: "circle", cx: bulge.x, cy: bulge.y, r: disc / 2, fill: pal.accent, anim: { type: "pulse", cx: bulge.x, cy: bulge.y, s: 0.12 } });
    headline(cx, cx.title, g.m, baseline, cx.span(g.cols), H * 0.12 * cx.s.scale, pal.ink);
    info(cx, g.m, H - g.m - infoHeight(cx) + PW * 0.01, pal.ink);
  },

  strips(cx) {
    const { r, g, pal, W: PW, H } = cx;
    const p = cx.c.photo;
    const n = g.cols;
    const top = g.m + cx.rows(1);
    const height = H * r.range(0.5, 0.62);
    for (let i = 0; i < n; i++) {
      const x = cx.colX(i);
      const off = (r.int(-2, 2) * cx.rows(1)) / 2;
      const id = `strip${i}`;
      const rect: El = { k: "rect", x, y: top + off, w: g.colW + g.gutter * 0.5, h: height, fill: i % 3 === 0 ? pal.accent : pal.ink };
      if (p) {
        cx.clips.push({ id, shape: rect });
        const scale = Math.max((PW - 2 * g.m) / p.width, height / p.height);
        const w = p.width * scale;
        const h = p.height * scale;
        // Each strip carries its own slice of the photo, displaced with it.
        cx.els.push({ k: "group", clip: id, anim: { type: "move", dx: 0, dy: cx.rows(1) * 0.3, delay: i * 0.08 }, children: [{ k: "image", x: g.m + (PW - 2 * g.m - w) / 2, y: top + off + (height - h) / 2, w, h, href: p.url }] });
      } else cx.els.push({ ...rect, anim: { type: "move", dx: 0, dy: cx.rows(1) * 0.3, delay: i * 0.08 } });
    }
    const words = lines(cx, cx.title, 2);
    const titleTop = top + height + cx.rows(1);
    const bottom = stack(cx, words, g.m, titleTop, cx.span(g.cols), H - g.m - infoHeight(cx) - titleTop - PW * 0.03, pal.ink);
    info(cx, g.m, Math.max(bottom + PW * 0.015, H - g.m - infoHeight(cx)), pal.ink);
    meta(cx, PW - g.m, g.m + PW * 0.012, pal.ink, "end");
  },

  bars(cx) {
    const { r, g, pal, H, W: PW } = cx;
    const avail = H - 2 * g.m;
    const natural = avail / cx.em(cx.title, cx.head.tracking);
    const size = Math.min(cx.span(1) * 1.05 * cx.s.scale, natural);
    const x = g.m + size * cx.cap;
    cx.els.push({ k: "text", x, y: H - g.m, text: cx.title, size, weight: cx.head.weight, fill: pal.ink, tracking: cx.head.tracking, role: "head", fit: size === natural ? avail : undefined, t: `rotate(-90 ${x} ${H - g.m})` });
    let col = 2;
    const n = r.int(3, Math.min(6, g.cols - col));
    for (let i = 0; i < n && col < g.cols; i++) {
      const wCols = r.chance(0.35) ? 2 : 1;
      const topRow = r.int(0, Math.floor(g.rows * 0.55));
      const infoTop = H - g.m - infoHeight(cx) - PW * 0.03;
      const underInfo = cx.colX(col) + cx.span(wCols) > PW - g.m - cx.span(Math.ceil(g.cols / 2));
      const bottom = underInfo ? Math.min(infoTop, cx.rowY(g.rows - 1)) : H - g.m - (r.chance(0.5) ? cx.rows(r.int(1, 3)) + g.gutter : 0);
      const y = Math.min(cx.rowY(topRow), bottom - cx.rows(2));
      cx.els.push({ k: "rect", x: cx.colX(col), y, w: cx.span(wCols), h: bottom - y, fill: i % 2 ? pal.ink : pal.accent, anim: { type: "move", dx: 0, dy: cx.rows(1) * 0.6, delay: i * 0.12 } });
      col += wCols + (r.chance(0.3) ? 1 : 0);
    }
    info(cx, PW - g.m, H - g.m - infoHeight(cx), pal.ink, { anchor: "end" });
    meta(cx, PW - g.m, g.m + PW * 0.012, pal.ink, "end");
  },

  type(cx) {
    const { r, g, pal, H, W: PW } = cx;
    const words = cx.title.split(/\s+/).filter(Boolean).slice(0, 5);
    const bottom = stack(cx, words, g.m, g.m + PW * 0.03, cx.span(g.cols), H * 0.62, pal.ink, (i) => ({ type: "move", dx: PW * 0.012, dy: 0, delay: i * 0.1 }));
    const dot = cx.span(1) * r.range(0.6, 1);
    const dx = cx.colX(r.int(Math.floor(g.cols / 2), g.cols - 1)) + dot / 2;
    cx.els.push({ k: "circle", cx: dx, cy: bottom + dot, r: dot / 2, fill: pal.accent, anim: { type: "move", dx: 0, dy: -dot * 0.6 } });
    const ruleY = H - g.m - infoHeight(cx) - PW * 0.03;
    cx.els.push({ k: "line", x1: g.m, x2: PW - g.m, y1: ruleY, y2: ruleY, stroke: pal.ink, sw: PW * 0.002 });
    info(cx, g.m, H - g.m - infoHeight(cx), pal.ink);
    meta(cx, PW - g.m, H - g.m, pal.ink, "end");
  },

  diagonal(cx) {
    const { r, g, pal, W: PW, H } = cx;
    const angle = r.pick([-35, -45, -25, 30]);
    const t = `rotate(${angle} ${PW / 2} ${H / 2})`;
    const band = cx.span(1) * r.range(0.6, 1.4);
    const count = r.int(4, 8);
    // Headline first, stripes run below it, so type never sits on a dark band.
    const ty = H * r.range(0.3, 0.4);
    const start = ty + band * 0.9;
    for (let i = 0; i < count; i++)
      cx.els.push({ k: "rect", x: -PW, y: start + i * band * 1.6, w: PW * 3, h: band, fill: i === Math.floor(count / 2) ? pal.accent : pal.ink, t, anim: { type: "move", dx: PW * 0.04 * (i % 2 ? 1 : -1), dy: 0 } });
    const titleW = PW * 0.72;
    const tSize = Math.min(H * 0.12 * cx.s.scale, titleW / cx.em(cx.title, cx.head.tracking));
    cx.els.push({ k: "text", x: PW / 2, y: ty, text: cx.title, size: tSize, weight: cx.head.weight, fill: pal.ink, tracking: cx.head.tracking, role: "head", anchor: "middle", t });
    const top = H - g.m - infoHeight(cx);
    cx.els.push({ k: "rect", x: g.m - PW * 0.015, y: top - PW * 0.02, w: cx.span(Math.ceil(g.cols / 2)) + PW * 0.03, h: infoHeight(cx) + PW * 0.04, fill: pal.bg });
    info(cx, g.m, top, pal.ink);
    meta(cx, PW - g.m, g.m + PW * 0.012, pal.ink, "end");
  },

  modular(cx) {
    const { r, g, pal, W: PW, H } = cx;
    const words = lines(cx, cx.title, 2);
    const bottom = stack(cx, words, g.m, g.m + PW * 0.02, cx.span(g.cols), H * 0.26, pal.ink);
    const cell = g.colW;
    const step = g.colW + g.gutter;
    const top = bottom + g.gutter * 2;
    const rowsN = Math.max(2, Math.floor((H - g.m - infoHeight(cx) - top - g.gutter * 3) / step));
    const accentAt = [r.int(0, g.cols - 1), r.int(0, rowsN - 1)];
    const rule = r.int(0, 2);
    for (let j = 0; j < rowsN; j++)
      for (let i = 0; i < g.cols; i++) {
        const x = cx.colX(i);
        const y = top + j * step;
        const isAccent = i === accentAt[0] && j === accentAt[1];
        const on = rule === 0 ? (i + j) % 2 === 0 : rule === 1 ? (i * j) % 3 !== 1 : r.chance(0.55);
        if (!on && !isAccent) continue;
        const fill = isAccent ? pal.accent : pal.ink;
        const shape = r.int(0, 3);
        const center = { cx: x + cell / 2, cy: y + cell / 2 };
        const anim: Anim = { type: "sway", ...center, deg: shape > 1 ? 90 : 0, delay: (i + j) * 0.04 };
        if (shape === 0) cx.els.push({ k: "rect", x, y, w: cell, h: cell, fill });
        else if (shape === 1) cx.els.push({ k: "circle", cx: center.cx, cy: center.cy, r: cell / 2, fill, anim: { type: "pulse", ...center, s: 0.12, delay: (i + j) * 0.05 } });
        else {
          const corner = r.int(0, 3);
          const ox = corner % 2 ? x + cell : x;
          const oy = corner > 1 ? y + cell : y;
          const sx = corner % 2 ? -1 : 1;
          const sy = corner > 1 ? -1 : 1;
          cx.els.push({ k: "path", d: `M${ox} ${oy} L${ox + sx * cell} ${oy} A${cell} ${cell} 0 0 ${sx * sy > 0 ? 1 : 0} ${ox} ${oy + sy * cell} Z`, fill, anim });
        }
      }
    info(cx, g.m, H - g.m - infoHeight(cx), pal.ink);
    meta(cx, PW - g.m, H - g.m, pal.ink, "end");
  },

  concentric(cx) {
    const { r, g, pal, W: PW, H } = cx;
    const cornerX = r.chance(0.5) ? PW - g.m : g.m;
    const cornerY = r.chance(0.6) ? g.m + cx.rows(r.int(1, 3)) : H * 0.42;
    const step = g.colW * r.range(0.45, 0.8);
    const rings = Math.ceil((PW * 1.1) / step);
    const colors = [pal.accent, pal.bg, pal.ink, pal.bg];
    for (let i = rings; i > 0; i--)
      cx.els.push({ k: "circle", cx: cornerX, cy: cornerY, r: i * step, fill: colors[i % colors.length], anim: { type: "pulse", cx: cornerX, cy: cornerY, s: 0.03, delay: i * 0.04 } });
    const area = H * 0.36;
    cx.els.push({ k: "rect", x: 0, y: H - area - g.m, w: PW, h: area + g.m, fill: pal.bg });
    const words = lines(cx, cx.title, 2);
    const bottom = stack(cx, words, g.m, H - area - g.m + PW * 0.04, cx.span(g.cols), area * 0.55, pal.ink);
    info(cx, g.m, bottom + PW * 0.02, pal.ink);
    meta(cx, PW - g.m, H - g.m, pal.ink, "end");
  },

  number(cx) {
    const { r, g, pal, W: PW, H } = cx;
    const num = cx.c.number.trim() || "01";
    const split = cx.rowY(Math.floor(g.rows * r.range(0.45, 0.6)));
    const block: El = { k: "rect", x: 0, y: 0, w: PW, h: split, fill: pal.accent };
    if (!photoIn(cx, block, "block")) cx.els.push(block);
    const width = cx.span(g.cols) * r.range(0.95, 1.25);
    const size = width / cx.em(num, -0.04);
    cx.els.push({ k: "text", x: g.m - PW * 0.01, y: split - PW * 0.02, text: num, size, weight: cx.head.weight, fill: cx.c.photo ? pal.accent : pal.bg === pal.accent ? pal.ink : pal.bg, tracking: -0.04, role: "head", fit: width, anim: { type: "move", dx: PW * 0.025, dy: 0 } });
    const words = lines(cx, cx.title, 2);
    const bottom = stack(cx, words, g.m, split + PW * 0.04, cx.span(g.cols), (H - split) * 0.42, pal.ink);
    info(cx, cx.colX(Math.floor(g.cols / 2)), bottom + PW * 0.03, pal.ink);
    meta(cx, g.m, H - g.m, pal.ink);
  },

  stairs(cx) {
    const { r, g, pal, W: PW, H } = cx;
    const steps = Math.min(g.cols, r.int(4, 6));
    const per = Math.max(1, Math.floor(g.cols / steps));
    const rise = cx.rows(Math.max(1, Math.floor((g.rows * 0.55) / steps)));
    for (let i = 0; i < steps; i++) {
      const top = H - g.m - rise * (i + 1);
      cx.els.push({ k: "rect", x: cx.colX(i * per), y: top, w: cx.span(per), h: H - top, fill: i === steps - 1 ? pal.accent : i % 2 ? pal.ink : pal.accent, anim: { type: "move", dx: 0, dy: rise * 0.35, delay: i * 0.1 } });
    }
    const words = lines(cx, cx.title, r.int(1, 3));
    stack(cx, words, g.m, g.m + PW * 0.02, cx.span(g.cols), H * 0.3, pal.ink);
    info(cx, PW - g.m, H * 0.36, pal.ink, { anchor: "end" });
    meta(cx, g.m, H * 0.36 + PW * 0.012, pal.ink);
  },
};

/* ------------------------------------------------------------- generate */

const applyCase = (text: string, mode: PosterSettings["caseMode"], caps: boolean) =>
  caps || mode === "upper" ? text.toUpperCase() : mode === "lower" ? text.toLowerCase() : text;

export const paletteOf = (s: PosterSettings) => s.custom ?? PALETTES[s.palette % PALETTES.length];

export function generate(content: PosterContent, s: PosterSettings, measure: Measure = helveticaMeasure): Poster {
  const size = SIZES[s.size];
  const PW = size.w;
  const H = size.h;
  const r = rng(s.layoutSeed);
  const t = rng(s.typeSeed);
  const allowed = STYLES.filter((st) => !st.photo || content.photo);
  const style: StyleId = s.style === "auto" ? r.pick(allowed).id : s.style;
  const font = FONT_BY_ID[s.font];

  const m = PW * s.margin;
  const gutter = PW * 0.014;
  const cols = s.columns;
  const colW = (PW - 2 * m - (cols - 1) * gutter) / cols;
  const rows = Math.max(4, Math.round(((H - 2 * m) / (PW - 2 * m)) * cols));
  const rowH = (H - 2 * m - (rows - 1) * gutter) / rows;
  const grid: Grid = { m, cols, rows, colW, rowH, gutter };
  const pal = paletteOf(s);

  const head = {
    weight: font.heavy,
    tracking: font.id === "mono" ? -0.04 : t.pick([-0.015, -0.03, -0.045]),
  };
  const cx: Ctx = {
    W: PW,
    H,
    g: grid,
    r,
    pal,
    c: content,
    s,
    els: [],
    clips: [],
    colX: (i) => m + i * (colW + gutter),
    span: (n) => n * colW + (n - 1) * gutter,
    rowY: (j) => m + j * (rowH + gutter),
    rows: (n) => n * rowH + (n - 1) * gutter,
    head,
    em: (text, tracking = 0) => measure(text, "head", head.weight) + tracking * Math.max(0, [...text].length - 1),
    cap: font.id === "bebas" || font.id === "anton" || font.id === "oswald" ? 0.8 : 0.72,
    title: applyCase(content.title.trim() || "Poster", s.caseMode, !!font.caps),
  };
  STYLE_FNS[style](cx);
  return { w: PW, h: H, bg: pal.bg, els: cx.els, clips: cx.clips, grid, style, font: s.font, palette: pal };
}

export const fontsOf = (p: Poster) => ({ head: FONT_BY_ID[p.font], body: bodyFont(p.font) });
