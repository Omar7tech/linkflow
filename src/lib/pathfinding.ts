/**
 * Pathfinding Lab engine — grid, maze generators, search algorithms, and the
 * invertible trace they record.
 *
 * Same idea as the Sorting Lab: an algorithm never animates anything. It runs
 * to completion and records a list of steps, each of which remembers the cell
 * state it replaced. That makes the whole search scrubbable, steppable
 * backwards, and instant to seek — a `setTimeout` per visited node can do none
 * of those things.
 *
 * Deterministic given a seed, so a maze and a run can be reproduced exactly.
 */

/* ---------------------------------- grid ---------------------------------- */

/** What occupies a cell. Weights cost more to enter but are still passable. */
export const EMPTY = 0;
export const WALL = 1;
export const WEIGHT = 2;

export type Terrain = typeof EMPTY | typeof WALL | typeof WEIGHT;

/** Entering a weighted cell costs this much instead of 1. */
export const WEIGHT_COST = 6;

export interface Grid {
  cols: number;
  rows: number;
  cells: Uint8Array;
  start: number;
  end: number;
}

export function makeGrid(cols: number, rows: number): Grid {
  const cells = new Uint8Array(cols * rows);
  return {
    cols,
    rows,
    cells,
    start: idx(cols, Math.floor(cols * 0.12), Math.floor(rows / 2)),
    end: idx(cols, Math.floor(cols * 0.88), Math.floor(rows / 2)),
  };
}

export const idx = (cols: number, x: number, y: number) => y * cols + x;
export const xOf = (cols: number, i: number) => i % cols;
export const yOf = (cols: number, i: number) => Math.floor(i / cols);

/* -------------------------------- the trace -------------------------------- */

/** How a cell looks at a given moment in the search. */
export const NONE = 0;
export const FRONTIER = 1;
export const VISITED = 2;
export const PATH = 3;

export type CellState = typeof NONE | typeof FRONTIER | typeof VISITED | typeof PATH;

export interface Step {
  /** The cell this step touches. */
  i: number;
  /** The state it takes. */
  s: CellState;
  /** The state it had, so the step can be undone. */
  p: CellState;
}

export interface SearchTrace {
  steps: Step[];
  found: boolean;
  /** Number of cells in the path, including both ends. */
  pathLength: number;
  /** Total movement cost, counting weighted cells. */
  pathCost: number;
  /** Cells removed from the frontier and expanded. */
  visited: number;
  /** Largest the frontier ever got — the algorithm's memory high-water mark. */
  peakFrontier: number;
}

class Recorder {
  readonly steps: Step[] = [];
  private state: Uint8Array;
  visited = 0;
  peakFrontier = 0;

  constructor(size: number) {
    this.state = new Uint8Array(size);
  }

  set(i: number, s: CellState) {
    const p = this.state[i] as CellState;
    if (p === s) return;
    this.steps.push({ i, s, p });
    this.state[i] = s;
  }
}

/* ------------------------------- neighbours -------------------------------- */

export type HeuristicId = "manhattan" | "euclidean" | "octile" | "none";

export const HEURISTICS: { id: HeuristicId; label: string; hint: string }[] = [
  { id: "manhattan", label: "Manhattan", hint: "|dx| + |dy| — right for 4-way movement" },
  { id: "octile", label: "Octile", hint: "the honest one when diagonals are allowed" },
  { id: "euclidean", label: "Euclidean", hint: "straight-line distance; never overestimates" },
  { id: "none", label: "None", hint: "no guess at all — A* degenerates to Dijkstra" },
];

function heuristic(id: HeuristicId, ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  switch (id) {
    case "manhattan":
      return dx + dy;
    case "euclidean":
      return Math.sqrt(dx * dx + dy * dy);
    case "octile":
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    default:
      return 0;
  }
}

const ORTHOGONAL = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

const DIAGONAL = [
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * Walkable neighbours. With diagonals on, a corner may only be cut when both
 * adjacent orthogonal cells are open — otherwise paths squeeze through walls
 * that visibly touch.
 */
function neighbours(grid: Grid, i: number, diagonal: boolean, out: number[]): number[] {
  out.length = 0;
  const { cols, rows, cells } = grid;
  const x = xOf(cols, i);
  const y = yOf(cols, i);
  for (const [dx, dy] of ORTHOGONAL) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
    const n = idx(cols, nx, ny);
    if (cells[n] !== WALL) out.push(n);
  }
  if (!diagonal) return out;
  for (const [dx, dy] of DIAGONAL) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
    const n = idx(cols, nx, ny);
    if (cells[n] === WALL) continue;
    if (cells[idx(cols, nx, y)] === WALL || cells[idx(cols, x, ny)] === WALL) continue;
    out.push(n);
  }
  return out;
}

const stepCost = (grid: Grid, from: number, to: number, diagonal: boolean): number => {
  const base = grid.cells[to] === WEIGHT ? WEIGHT_COST : 1;
  if (!diagonal) return base;
  const straight = xOf(grid.cols, from) === xOf(grid.cols, to) || yOf(grid.cols, from) === yOf(grid.cols, to);
  return straight ? base : base * Math.SQRT2;
};

/* ------------------------------- binary heap ------------------------------- */

/** Min-heap keyed on a parallel score array — the open set for Dijkstra and A*. */
class Heap {
  private items: number[] = [];
  private score: Float64Array;

  constructor(score: Float64Array) {
    this.score = score;
  }

  get size() {
    return this.items.length;
  }

  push(value: number) {
    const items = this.items;
    items.push(value);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.score[items[parent]] <= this.score[items[i]]) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): number {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let small = i;
        if (l < items.length && this.score[items[l]] < this.score[items[small]]) small = l;
        if (r < items.length && this.score[items[r]] < this.score[items[small]]) small = r;
        if (small === i) break;
        [items[small], items[i]] = [items[i], items[small]];
        i = small;
      }
    }
    return top;
  }
}

/* -------------------------------- algorithms ------------------------------- */

export type AlgorithmId = "astar" | "dijkstra" | "bfs" | "dfs" | "greedy" | "bidirectional";

export interface AlgorithmMeta {
  id: AlgorithmId;
  name: string;
  /** Does it always return the cheapest route? */
  optimal: string;
  weighted: boolean;
  description: string;
  watch: string;
}

export const ALGORITHMS: AlgorithmMeta[] = [
  {
    id: "astar",
    name: "A*",
    optimal: "Yes, with an admissible heuristic",
    weighted: true,
    description:
      "Dijkstra plus a guess. Each cell is scored by the distance already travelled plus an estimate of what remains, so the search leans toward the target instead of spreading evenly.",
    watch: "The search stretching toward the goal rather than growing as a circle.",
  },
  {
    id: "dijkstra",
    name: "Dijkstra",
    optimal: "Yes",
    weighted: true,
    description:
      "Always expands the cheapest reachable cell next. With no idea where the target is, it explores outward in every direction until it stumbles into it.",
    watch: "The perfectly even flood — and how much of the grid it burns through.",
  },
  {
    id: "bfs",
    name: "Breadth-first",
    optimal: "Yes, but only unweighted",
    weighted: false,
    description:
      "Expands in rings of equal step count. Guarantees the fewest steps, but treats a swamp exactly like open ground, so weights are ignored entirely.",
    watch: "Identical to Dijkstra until you paint weights — then the paths diverge.",
  },
  {
    id: "dfs",
    name: "Depth-first",
    optimal: "No",
    weighted: false,
    description:
      "Follows one direction as far as it can before backing up. It finds a route, almost never a good one — included precisely because the result looks so wrong.",
    watch: "The single wandering tendril, and the absurd path it settles for.",
  },
  {
    id: "greedy",
    name: "Greedy best-first",
    optimal: "No",
    weighted: false,
    description:
      "Always moves toward whatever looks closest to the goal, ignoring the distance already covered. Very fast, and confidently walks into dead ends.",
    watch: "How directly it charges at the target — and how badly a wall fools it.",
  },
  {
    id: "bidirectional",
    name: "Bidirectional",
    optimal: "Yes, unweighted",
    weighted: false,
    description:
      "Runs two breadth-first searches, one from each end, and stops when they touch. Two small circles cover far less area than one big one.",
    watch: "The two fronts growing toward each other and meeting in the middle.",
  },
];

export const ALGORITHM_BY_ID = Object.fromEntries(ALGORITHMS.map((a) => [a.id, a])) as Record<
  AlgorithmId,
  AlgorithmMeta
>;

export interface SearchOptions {
  heuristic: HeuristicId;
  /** Multiplier on the heuristic. 1 is A*, 0 is Dijkstra, above 1 gets greedy. */
  weight: number;
  diagonal: boolean;
}

/** Walks `cameFrom` back from the goal and records the path, nearest end first. */
function writePath(rec: Recorder, cameFrom: Int32Array, grid: Grid, from: number): { length: number; cost: number } {
  const path: number[] = [];
  let node = from;
  while (node !== -1) {
    path.push(node);
    node = cameFrom[node];
  }
  path.reverse();
  let cost = 0;
  for (let k = 0; k < path.length; k++) {
    if (k > 0) cost += grid.cells[path[k]] === WEIGHT ? WEIGHT_COST : 1;
    rec.set(path[k], PATH);
  }
  return { length: path.length, cost };
}

export function search(grid: Grid, algorithm: AlgorithmId, options: SearchOptions): SearchTrace {
  const size = grid.cols * grid.rows;
  const rec = new Recorder(size);
  const { start, end } = grid;

  const result = (found: boolean, path: { length: number; cost: number }): SearchTrace => ({
    steps: rec.steps,
    found,
    pathLength: path.length,
    pathCost: path.cost,
    visited: rec.visited,
    peakFrontier: rec.peakFrontier,
  });

  if (grid.cells[start] === WALL || grid.cells[end] === WALL) return result(false, { length: 0, cost: 0 });

  const cameFrom = new Int32Array(size).fill(-1);
  const seen = new Uint8Array(size);
  const buffer: number[] = [];

  /* ---- the two queue-based searches ---- */
  if (algorithm === "bfs" || algorithm === "dfs") {
    const stack: number[] = [start];
    seen[start] = 1;
    rec.set(start, FRONTIER);
    let live = 1;
    while (stack.length) {
      rec.peakFrontier = Math.max(rec.peakFrontier, live);
      // The only difference between the two: which end we take from.
      const current = algorithm === "bfs" ? stack.shift()! : stack.pop()!;
      live--;
      rec.set(current, VISITED);
      rec.visited++;
      if (current === end) return result(true, writePath(rec, cameFrom, grid, end));
      for (const n of neighbours(grid, current, options.diagonal, buffer)) {
        if (seen[n]) continue;
        seen[n] = 1;
        cameFrom[n] = current;
        rec.set(n, FRONTIER);
        stack.push(n);
        live++;
      }
    }
    return result(false, { length: 0, cost: 0 });
  }

  /* ---- two fronts, meeting in the middle ---- */
  if (algorithm === "bidirectional") {
    const fromStart = new Uint8Array(size);
    const fromEnd = new Uint8Array(size);
    const backFrom = new Int32Array(size).fill(-1);
    let queueA = [start];
    let queueB = [end];
    fromStart[start] = 1;
    fromEnd[end] = 1;
    rec.set(start, FRONTIER);
    rec.set(end, FRONTIER);

    while (queueA.length && queueB.length) {
      rec.peakFrontier = Math.max(rec.peakFrontier, queueA.length + queueB.length);
      // Always expand the smaller front — that is what keeps the two circles
      // balanced and the total area covered small.
      const forward = queueA.length <= queueB.length;
      const queue = forward ? queueA : queueB;
      const mine = forward ? fromStart : fromEnd;
      const theirs = forward ? fromEnd : fromStart;
      const links = forward ? cameFrom : backFrom;
      const nextQueue: number[] = [];

      for (const current of queue) {
        rec.set(current, VISITED);
        rec.visited++;
        for (const n of neighbours(grid, current, options.diagonal, buffer)) {
          if (theirs[n]) {
            // Touch point: splice the two chains into one path.
            links[n] = current;
            const joined: number[] = [];
            let node: number = n;
            while (node !== -1) {
              joined.unshift(node);
              node = cameFrom[node];
            }
            node = backFrom[n];
            while (node !== -1) {
              joined.push(node);
              node = backFrom[node];
            }
            if (!forward) joined.reverse();
            let cost = 0;
            for (let k = 0; k < joined.length; k++) {
              if (k > 0) cost += grid.cells[joined[k]] === WEIGHT ? WEIGHT_COST : 1;
              rec.set(joined[k], PATH);
            }
            return result(true, { length: joined.length, cost });
          }
          if (mine[n]) continue;
          mine[n] = 1;
          links[n] = current;
          rec.set(n, FRONTIER);
          nextQueue.push(n);
        }
      }
      if (forward) queueA = nextQueue;
      else queueB = nextQueue;
    }
    return result(false, { length: 0, cost: 0 });
  }

  /* ---- the priority-queue searches ---- */
  const g = new Float64Array(size).fill(Infinity);
  const f = new Float64Array(size).fill(Infinity);
  const closed = new Uint8Array(size);
  const heap = new Heap(f);
  const ex = xOf(grid.cols, end);
  const ey = yOf(grid.cols, end);

  const estimate = (i: number) =>
    heuristic(options.heuristic, xOf(grid.cols, i), yOf(grid.cols, i), ex, ey);

  g[start] = 0;
  f[start] =
    algorithm === "dijkstra" ? 0 : algorithm === "greedy" ? estimate(start) : options.weight * estimate(start);
  heap.push(start);
  rec.set(start, FRONTIER);
  let open = 1;

  while (heap.size) {
    rec.peakFrontier = Math.max(rec.peakFrontier, open);
    const current = heap.pop();
    open--;
    if (closed[current]) continue;
    closed[current] = 1;
    rec.set(current, VISITED);
    rec.visited++;
    if (current === end) return result(true, writePath(rec, cameFrom, grid, end));

    for (const n of neighbours(grid, current, options.diagonal, buffer)) {
      if (closed[n]) continue;
      const tentative = g[current] + stepCost(grid, current, n, options.diagonal);
      if (tentative >= g[n]) continue;
      g[n] = tentative;
      cameFrom[n] = current;
      // Greedy ignores the distance travelled; Dijkstra ignores the estimate.
      f[n] =
        algorithm === "greedy"
          ? estimate(n)
          : algorithm === "dijkstra"
            ? tentative
            : tentative + options.weight * estimate(n);
      heap.push(n);
      open++;
      rec.set(n, FRONTIER);
    }
  }
  return result(false, { length: 0, cost: 0 });
}

/* ------------------------------ maze builders ------------------------------ */

export type MazeId = "backtracker" | "prim" | "division" | "rooms" | "scatter" | "spiral" | "clear";

export const MAZES: { id: MazeId; label: string; hint: string }[] = [
  { id: "backtracker", label: "Backtracker", hint: "long winding corridors, few dead ends" },
  { id: "prim", label: "Prim", hint: "bushy, lots of short branches" },
  { id: "division", label: "Recursive division", hint: "clean rectangular rooms" },
  { id: "rooms", label: "Rooms", hint: "open chambers joined by doors" },
  { id: "scatter", label: "Scatter", hint: "random obstacles in open ground" },
  { id: "spiral", label: "Spiral", hint: "one very long path" },
  { id: "clear", label: "Clear", hint: "empty grid" },
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fills the grid with a maze. Start and end are always carved open afterwards
 * so a generated maze can never be trivially unsolvable.
 */
export function generateMaze(grid: Grid, kind: MazeId, seed: number, density = 0.28) {
  const { cols, rows, cells } = grid;
  const rand = mulberry32(seed);
  cells.fill(EMPTY);

  const carve = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < cols && y < rows) cells[idx(cols, x, y)] = EMPTY;
  };

  switch (kind) {
    case "scatter":
      for (let i = 0; i < cells.length; i++) {
        const r = rand();
        if (r < density) cells[i] = WALL;
        else if (r < density + 0.1) cells[i] = WEIGHT;
      }
      break;

    case "backtracker":
    case "prim": {
      // Both work on odd coordinates: cells at odd indices, walls between them.
      cells.fill(WALL);
      const inBounds = (x: number, y: number) => x > 0 && y > 0 && x < cols - 1 && y < rows - 1;
      const startX = 1;
      const startY = 1;
      carve(startX, startY);

      if (kind === "backtracker") {
        const stack: [number, number][] = [[startX, startY]];
        while (stack.length) {
          const [x, y] = stack[stack.length - 1];
          const options: [number, number][] = [];
          for (const [dx, dy] of ORTHOGONAL) {
            const nx = x + dx * 2;
            const ny = y + dy * 2;
            if (inBounds(nx, ny) && cells[idx(cols, nx, ny)] === WALL) options.push([nx, ny]);
          }
          if (!options.length) {
            stack.pop();
            continue;
          }
          const [nx, ny] = options[Math.floor(rand() * options.length)];
          carve((x + nx) / 2, (y + ny) / 2);
          carve(nx, ny);
          stack.push([nx, ny]);
        }
      } else {
        const frontier: [number, number, number, number][] = [];
        const addFrontier = (x: number, y: number) => {
          for (const [dx, dy] of ORTHOGONAL) {
            const nx = x + dx * 2;
            const ny = y + dy * 2;
            if (inBounds(nx, ny) && cells[idx(cols, nx, ny)] === WALL) frontier.push([nx, ny, x, y]);
          }
        };
        addFrontier(startX, startY);
        while (frontier.length) {
          const pick = Math.floor(rand() * frontier.length);
          const [nx, ny, px, py] = frontier.splice(pick, 1)[0];
          if (cells[idx(cols, nx, ny)] !== WALL) continue;
          carve((nx + px) / 2, (ny + py) / 2);
          carve(nx, ny);
          addFrontier(nx, ny);
        }
      }
      break;
    }

    case "division": {
      const divide = (x0: number, y0: number, x1: number, y1: number, depth: number) => {
        const w = x1 - x0;
        const h = y1 - y0;
        if (w < 4 || h < 4 || depth > 9) return;
        const vertical = w === h ? rand() < 0.5 : w > h;
        if (vertical) {
          // Wall on an even column, door on an odd row — keeps everything joined.
          const wx = x0 + 2 + Math.floor((rand() * (w - 3)) / 2) * 2;
          const door = y0 + Math.floor((rand() * h) / 2) * 2;
          for (let y = y0; y <= y1; y++) if (y !== door) cells[idx(cols, wx, y)] = WALL;
          divide(x0, y0, wx - 1, y1, depth + 1);
          divide(wx + 1, y0, x1, y1, depth + 1);
        } else {
          const wy = y0 + 2 + Math.floor((rand() * (h - 3)) / 2) * 2;
          const door = x0 + Math.floor((rand() * w) / 2) * 2;
          for (let x = x0; x <= x1; x++) if (x !== door) cells[idx(cols, x, wy)] = WALL;
          divide(x0, y0, x1, wy - 1, depth + 1);
          divide(x0, wy + 1, x1, y1, depth + 1);
        }
      };
      divide(0, 0, cols - 1, rows - 1, 0);
      break;
    }

    case "rooms": {
      cells.fill(WALL);
      const rooms: [number, number, number, number][] = [];
      for (let attempt = 0; attempt < 40 && rooms.length < 9; attempt++) {
        const w = 4 + Math.floor(rand() * 6);
        const h = 3 + Math.floor(rand() * 5);
        const x = 1 + Math.floor(rand() * (cols - w - 2));
        const y = 1 + Math.floor(rand() * (rows - h - 2));
        if (rooms.some(([rx, ry, rw, rh]) => x < rx + rw + 1 && x + w + 1 > rx && y < ry + rh + 1 && y + h + 1 > ry))
          continue;
        rooms.push([x, y, w, h]);
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) carve(xx, yy);
      }
      // Join each room to the previous one with an L-shaped corridor.
      for (let r = 1; r < rooms.length; r++) {
        const [ax, ay, aw, ah] = rooms[r - 1];
        const [bx, by, bw, bh] = rooms[r];
        const cx0 = Math.floor(ax + aw / 2);
        const cy0 = Math.floor(ay + ah / 2);
        const cx1 = Math.floor(bx + bw / 2);
        const cy1 = Math.floor(by + bh / 2);
        for (let x = Math.min(cx0, cx1); x <= Math.max(cx0, cx1); x++) carve(x, cy0);
        for (let y = Math.min(cy0, cy1); y <= Math.max(cy0, cy1); y++) carve(cx1, y);
      }
      break;
    }

    case "spiral": {
      cells.fill(EMPTY);
      let x0 = 1;
      let y0 = 1;
      let x1 = cols - 2;
      let y1 = rows - 2;
      let turn = 0;
      while (x1 - x0 > 3 && y1 - y0 > 3) {
        if (turn % 4 === 0) {
          for (let x = x0; x <= x1 - 2; x++) cells[idx(cols, x, y0)] = WALL;
          y0 += 2;
        } else if (turn % 4 === 1) {
          for (let y = y0; y <= y1 - 2; y++) cells[idx(cols, x1, y)] = WALL;
          x1 -= 2;
        } else if (turn % 4 === 2) {
          for (let x = x1; x >= x0 + 2; x--) cells[idx(cols, x, y1)] = WALL;
          y1 -= 2;
        } else {
          for (let y = y1; y >= y0 + 2; y--) cells[idx(cols, x0, y)] = WALL;
          x0 += 2;
        }
        turn++;
      }
      break;
    }

    default:
      break;
  }

  // The endpoints, and a little breathing room around them, are always open.
  for (const anchor of [grid.start, grid.end]) {
    const ax = xOf(cols, anchor);
    const ay = yOf(cols, anchor);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) carve(ax + dx, ay + dy);
  }
}

/* ---------------------------------- player -------------------------------- */

export interface PlayState {
  cells: Uint8Array;
  /** The cell being expanded right now. */
  head: number;
}

export function initialPlayState(size: number): PlayState {
  return { cells: new Uint8Array(size), head: -1 };
}

export function seek(state: PlayState, steps: Step[], from: number, to: number): number {
  let cursor = from;
  while (cursor < to) {
    const step = steps[cursor++];
    state.cells[step.i] = step.s;
  }
  while (cursor > to) {
    const step = steps[--cursor];
    state.cells[step.i] = step.p;
  }
  // The head is read off the step we landed on, so a backwards seek can't leave
  // a stale marker behind.
  state.head = -1;
  for (let k = to - 1; k >= 0 && k > to - 40; k--) {
    if (steps[k].s === VISITED) {
      state.head = steps[k].i;
      break;
    }
  }
  return cursor;
}

/** Confirms a recorded path is contiguous and never crosses a wall. */
export function validatePath(grid: Grid, state: PlayState, diagonal: boolean): boolean {
  const path: number[] = [];
  for (let i = 0; i < state.cells.length; i++) if (state.cells[i] === PATH) path.push(i);
  if (!path.length) return true;
  if (!path.includes(grid.start) || !path.includes(grid.end)) return false;
  for (const i of path) if (grid.cells[i] === WALL) return false;

  // Every path cell but one end must touch another path cell.
  const buffer: number[] = [];
  for (const i of path) {
    const touching = neighbours(grid, i, diagonal, buffer).filter((n) => state.cells[n] === PATH).length;
    if (touching === 0) return false;
  }
  return true;
}
