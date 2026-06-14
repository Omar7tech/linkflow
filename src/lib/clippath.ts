export interface ClipPoint {
  /** Horizontal position, 0–100 (% of the box). */
  x: number;
  /** Vertical position, 0–100 (%). */
  y: number;
}

const fmt = (n: number) => `${Math.round(n * 10) / 10}`;

/** The `polygon(...)` value for the current points. */
export function toPolygon(points: ClipPoint[]): string {
  const pairs = points.map((p) => `${fmt(p.x)}% ${fmt(p.y)}%`).join(", ");
  return `polygon(${pairs})`;
}

export function toCss(points: ClipPoint[], className = "clip"): string {
  const value = toPolygon(points);
  return [
    `.${className} {`,
    `  clip-path: ${value};`,
    `  -webkit-clip-path: ${value};`,
    `}`,
  ].join("\n");
}

export function toTailwind(points: ClipPoint[]): string {
  const value = toPolygon(points).replace(/\s+/g, "_");
  return `[clip-path:${value}]`;
}

/** SVG `points` attribute for drawing the outline overlay. */
export function toSvgPoints(points: ClipPoint[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

/** Insert a new vertex at the midpoint of the longest edge — keeps shapes sane. */
export function insertPoint(points: ClipPoint[]): ClipPoint[] {
  if (points.length < 2) return [...points, { x: 50, y: 50 }];
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  const a = points[best];
  const b = points[(best + 1) % points.length];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const next = [...points];
  next.splice(best + 1, 0, mid);
  return next;
}

export interface ClipPreset {
  id: string;
  name: string;
  points: ClipPoint[];
}

const p = (pairs: [number, number][]): ClipPoint[] =>
  pairs.map(([x, y]) => ({ x, y }));

export const CLIP_PRESETS: ClipPreset[] = [
  { id: "triangle", name: "Triangle", points: p([[50, 0], [0, 100], [100, 100]]) },
  { id: "trapezoid", name: "Trapezoid", points: p([[20, 0], [80, 0], [100, 100], [0, 100]]) },
  { id: "rhombus", name: "Rhombus", points: p([[50, 0], [100, 50], [50, 100], [0, 50]]) },
  { id: "parallelogram", name: "Parallelogram", points: p([[25, 0], [100, 0], [75, 100], [0, 100]]) },
  { id: "pentagon", name: "Pentagon", points: p([[50, 0], [100, 38], [82, 100], [18, 100], [0, 38]]) },
  { id: "hexagon", name: "Hexagon", points: p([[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]]) },
  { id: "heptagon", name: "Heptagon", points: p([[50, 0], [90, 20], [100, 60], [75, 100], [25, 100], [0, 60], [10, 20]]) },
  { id: "octagon", name: "Octagon", points: p([[30, 0], [70, 0], [100, 30], [100, 70], [70, 100], [30, 100], [0, 70], [0, 30]]) },
  { id: "bevel", name: "Bevel", points: p([[20, 0], [80, 0], [100, 20], [100, 80], [80, 100], [20, 100], [0, 80], [0, 20]]) },
  { id: "star", name: "Star", points: p([[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]]) },
  { id: "cross", name: "Cross", points: p([[10, 25], [35, 25], [35, 0], [65, 0], [65, 25], [90, 25], [90, 75], [65, 75], [65, 100], [35, 100], [35, 75], [10, 75]]) },
  { id: "message", name: "Message", points: p([[0, 0], [100, 0], [100, 75], [75, 75], [75, 100], [50, 75], [0, 75]]) },
  { id: "arrow", name: "Arrow", points: p([[0, 20], [60, 20], [60, 0], [100, 50], [60, 100], [60, 80], [0, 80]]) },
  { id: "chevron", name: "Chevron", points: p([[75, 0], [100, 50], [75, 100], [0, 100], [25, 50], [0, 0]]) },
  { id: "point", name: "Point", points: p([[0, 0], [75, 0], [100, 50], [75, 100], [0, 100]]) },
  { id: "close", name: "Close X", points: p([[20, 0], [0, 20], [30, 50], [0, 80], [20, 100], [50, 70], [80, 100], [100, 80], [70, 50], [100, 20], [80, 0], [50, 30]]) },
];

export interface ClipFace {
  id: string;
  name: string;
  background: string;
}

export const CLIP_FACES: ClipFace[] = [
  { id: "emerald", name: "Emerald", background: "linear-gradient(135deg, #34d399, #0f766e)" },
  { id: "violet", name: "Violet", background: "linear-gradient(135deg, #a78bfa, #6d28d9)" },
  { id: "sunset", name: "Sunset", background: "linear-gradient(135deg, #fb923c, #db2777)" },
  { id: "ocean", name: "Ocean", background: "linear-gradient(135deg, #38bdf8, #1e3a8a)" },
  { id: "aurora", name: "Aurora", background: "radial-gradient(at 20% 30%, #7c3aed 0, transparent 50%), radial-gradient(at 80% 20%, #06b6d4 0, transparent 50%), #0f172a" },
];
