/**
 * Sorting Lab engine — algorithms, the trace they record, and the player that
 * walks that trace in either direction.
 *
 * The important idea: an algorithm doesn't animate anything. It runs to
 * completion against a scratch array and records an *invertible* list of steps.
 * A write remembers the value it replaced, a swap is its own inverse, a marker
 * can be unset. That single property is what makes the timeline scrubbable,
 * steppable backwards and instant to seek — none of which is possible with the
 * usual "queue a setTimeout per frame" approach.
 *
 * Everything is deterministic given a seed, so a run can be replayed exactly.
 */

/* ---------------------------------- steps --------------------------------- */

export type StepType =
  | "compare" // read two positions, no mutation
  | "swap" // exchange two positions
  | "write" // set one position to a value
  | "sorted" // this position is final
  | "pivot" // this position is the current pivot
  | "range"; // the sub-array currently being worked on

export interface Step {
  t: StepType;
  i: number;
  /** Second index for compare/swap, or the range's upper bound. */
  j?: number;
  /** New value, for a write. */
  v?: number;
  /** Replaced value, so the write can be undone. */
  p?: number;
}

export interface Trace {
  steps: Step[];
  comparisons: number;
  writes: number;
  /** Reads plus writes — the fairest single number to race algorithms on. */
  accesses: number;
  /** True when an algorithm bailed out against the step ceiling. */
  truncated: boolean;
}

/** Guards the pathological cases (bogo) and keeps memory bounded. */
const MAX_STEPS = 400_000;

/**
 * Collects steps while an algorithm runs. Every mutation goes through here so
 * the counters and the trace can never drift apart.
 */
class Recorder {
  readonly steps: Step[] = [];
  comparisons = 0;
  writes = 0;
  accesses = 0;
  truncated = false;

  private push(step: Step): boolean {
    if (this.steps.length >= MAX_STEPS) {
      this.truncated = true;
      return false;
    }
    this.steps.push(step);
    return true;
  }

  get full(): boolean {
    return this.truncated || this.steps.length >= MAX_STEPS;
  }

  /** Records a comparison of two positions. Returns `a <= b` for convenience. */
  compare(array: number[], i: number, j: number): number {
    this.comparisons++;
    this.accesses += 2;
    this.push({ t: "compare", i, j });
    return array[i] - array[j];
  }

  /** Compares a position against a value already in hand (insertion, radix). */
  compareValue(array: number[], i: number, value: number, mirror = i): number {
    this.comparisons++;
    this.accesses += 1;
    this.push({ t: "compare", i, j: mirror });
    return array[i] - value;
  }

  swap(array: number[], i: number, j: number) {
    if (i === j) return;
    this.writes += 2;
    this.accesses += 4;
    this.push({ t: "swap", i, j });
    const tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }

  write(array: number[], i: number, value: number) {
    this.writes++;
    this.accesses += 1;
    this.push({ t: "write", i, v: value, p: array[i] });
    array[i] = value;
  }

  sorted(i: number) {
    this.push({ t: "sorted", i });
  }

  pivot(i: number) {
    this.push({ t: "pivot", i });
  }

  range(lo: number, hi: number) {
    this.push({ t: "range", i: lo, j: hi });
  }

  finish(): Trace {
    return {
      steps: this.steps,
      comparisons: this.comparisons,
      writes: this.writes,
      accesses: this.accesses,
      truncated: this.truncated,
    };
  }
}

/* -------------------------------- algorithms ------------------------------ */

export type AlgorithmId =
  | "bubble"
  | "cocktail"
  | "gnome"
  | "insertion"
  | "binaryInsertion"
  | "selection"
  | "shell"
  | "comb"
  | "merge"
  | "quick"
  | "heap"
  | "counting"
  | "radix"
  | "bogo";

type Runner = (array: number[], rec: Recorder) => void;

const bubble: Runner = (a, rec) => {
  for (let end = a.length - 1; end > 0 && !rec.full; end--) {
    let swapped = false;
    for (let i = 0; i < end; i++) {
      if (rec.compare(a, i, i + 1) > 0) {
        rec.swap(a, i, i + 1);
        swapped = true;
      }
    }
    rec.sorted(end);
    // The early exit is what gives bubble sort its O(n) best case.
    if (!swapped) {
      for (let i = 0; i < end; i++) rec.sorted(i);
      return;
    }
  }
  rec.sorted(0);
};

const cocktail: Runner = (a, rec) => {
  let lo = 0;
  let hi = a.length - 1;
  while (lo < hi && !rec.full) {
    let swapped = false;
    for (let i = lo; i < hi; i++) {
      if (rec.compare(a, i, i + 1) > 0) {
        rec.swap(a, i, i + 1);
        swapped = true;
      }
    }
    rec.sorted(hi--);
    for (let i = hi; i > lo; i--) {
      if (rec.compare(a, i - 1, i) > 0) {
        rec.swap(a, i - 1, i);
        swapped = true;
      }
    }
    rec.sorted(lo++);
    if (!swapped) break;
  }
  for (let i = lo; i <= hi; i++) rec.sorted(i);
};

const gnome: Runner = (a, rec) => {
  let i = 0;
  while (i < a.length && !rec.full) {
    if (i === 0 || rec.compare(a, i - 1, i) <= 0) i++;
    else {
      rec.swap(a, i - 1, i);
      i--;
    }
  }
  for (let k = 0; k < a.length; k++) rec.sorted(k);
};

const insertion: Runner = (a, rec) => {
  rec.sorted(0);
  for (let i = 1; i < a.length && !rec.full; i++) {
    const key = a[i];
    let j = i - 1;
    // Compare against the value held in hand, not against a[i] — a[i] is about
    // to be overwritten, which is exactly what a real insertion sort does.
    while (j >= 0 && rec.compareValue(a, j, key, i) > 0) {
      rec.write(a, j + 1, a[j]);
      j--;
    }
    rec.write(a, j + 1, key);
    rec.sorted(i);
  }
};

const binaryInsertion: Runner = (a, rec) => {
  rec.sorted(0);
  for (let i = 1; i < a.length && !rec.full; i++) {
    const key = a[i];
    let lo = 0;
    let hi = i;
    // Binary search collapses the comparisons to O(log n); the shifting is
    // still linear, which is the whole point of the comparison.
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (rec.compareValue(a, mid, key, i) <= 0) lo = mid + 1;
      else hi = mid;
    }
    for (let j = i - 1; j >= lo; j--) rec.write(a, j + 1, a[j]);
    rec.write(a, lo, key);
    rec.sorted(i);
  }
};

const selection: Runner = (a, rec) => {
  for (let i = 0; i < a.length - 1 && !rec.full; i++) {
    let min = i;
    rec.pivot(min);
    for (let j = i + 1; j < a.length; j++) {
      if (rec.compare(a, j, min) < 0) {
        min = j;
        rec.pivot(min);
      }
    }
    rec.swap(a, i, min);
    rec.sorted(i);
  }
  rec.sorted(a.length - 1);
};

const shell: Runner = (a, rec) => {
  // Ciura's gap sequence — measurably better than halving on small arrays.
  const gaps = [701, 301, 132, 57, 23, 10, 4, 1].filter((g) => g < a.length);
  if (!gaps.includes(1)) gaps.push(1);
  for (const gap of gaps) {
    if (rec.full) break;
    for (let i = gap; i < a.length; i++) {
      const key = a[i];
      let j = i;
      while (j >= gap && rec.compareValue(a, j - gap, key, i) > 0) {
        rec.write(a, j, a[j - gap]);
        j -= gap;
      }
      rec.write(a, j, key);
    }
  }
  for (let i = 0; i < a.length; i++) rec.sorted(i);
};

const comb: Runner = (a, rec) => {
  let gap = a.length;
  let swapped = true;
  while ((gap > 1 || swapped) && !rec.full) {
    gap = Math.max(1, Math.floor(gap / 1.3));
    swapped = false;
    for (let i = 0; i + gap < a.length; i++) {
      if (rec.compare(a, i, i + gap) > 0) {
        rec.swap(a, i, i + gap);
        swapped = true;
      }
    }
  }
  for (let i = 0; i < a.length; i++) rec.sorted(i);
};

const merge: Runner = (a, rec) => {
  const buffer = a.slice();
  const sort = (lo: number, hi: number) => {
    if (hi - lo < 2 || rec.full) return;
    const mid = (lo + hi) >> 1;
    sort(lo, mid);
    sort(mid, hi);
    rec.range(lo, hi - 1);

    for (let i = lo; i < hi; i++) buffer[i] = a[i];
    let left = lo;
    let right = mid;
    for (let k = lo; k < hi; k++) {
      if (left >= mid) rec.write(a, k, buffer[right++]);
      else if (right >= hi) rec.write(a, k, buffer[left++]);
      else {
        rec.comparisons++;
        rec.accesses += 2;
        rec.steps.push({ t: "compare", i: left, j: right });
        if (buffer[left] <= buffer[right]) rec.write(a, k, buffer[left++]);
        else rec.write(a, k, buffer[right++]);
      }
    }
  };
  sort(0, a.length);
  for (let i = 0; i < a.length; i++) rec.sorted(i);
};

const quick: Runner = (a, rec) => {
  const sort = (lo: number, hi: number) => {
    if (lo >= hi || rec.full) {
      if (lo === hi) rec.sorted(lo);
      return;
    }
    rec.range(lo, hi);
    // Median-of-three pivot: keeps already-sorted input off the O(n²) path.
    const mid = (lo + hi) >> 1;
    if (rec.compare(a, mid, lo) < 0) rec.swap(a, mid, lo);
    if (rec.compare(a, hi, lo) < 0) rec.swap(a, hi, lo);
    if (rec.compare(a, mid, hi) < 0) rec.swap(a, mid, hi);

    const pivot = a[hi];
    rec.pivot(hi);
    let store = lo;
    for (let i = lo; i < hi; i++) {
      if (rec.compareValue(a, i, pivot, hi) < 0) rec.swap(a, i, store++);
    }
    rec.swap(a, store, hi);
    rec.sorted(store);
    sort(lo, store - 1);
    sort(store + 1, hi);
  };
  sort(0, a.length - 1);
};

const heap: Runner = (a, rec) => {
  const sift = (root: number, end: number) => {
    while (!rec.full) {
      const left = root * 2 + 1;
      if (left > end) return;
      let child = left;
      if (left + 1 <= end && rec.compare(a, left, left + 1) < 0) child = left + 1;
      if (rec.compare(a, root, child) >= 0) return;
      rec.swap(a, root, child);
      root = child;
    }
  };
  const n = a.length;
  for (let i = (n - 2) >> 1; i >= 0; i--) sift(i, n - 1);
  for (let end = n - 1; end > 0; end--) {
    rec.swap(a, 0, end);
    rec.sorted(end);
    sift(0, end - 1);
  }
  rec.sorted(0);
};

const counting: Runner = (a, rec) => {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    rec.accesses++;
    if (a[i] > max) max = a[i];
  }
  const counts = new Array<number>(max + 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    rec.compareValue(a, i, a[i], i);
    counts[a[i]]++;
  }
  let out = 0;
  for (let value = 0; value <= max && !rec.full; value++) {
    for (let k = 0; k < counts[value]; k++) {
      rec.write(a, out, value);
      rec.sorted(out);
      out++;
    }
  }
};

const radix: Runner = (a, rec) => {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    rec.accesses++;
    if (a[i] > max) max = a[i];
  }
  const output = new Array<number>(a.length).fill(0);
  for (let exp = 1; Math.floor(max / exp) > 0 && !rec.full; exp *= 10) {
    const counts = new Array<number>(10).fill(0);
    for (let i = 0; i < a.length; i++) {
      rec.compareValue(a, i, a[i], i);
      counts[Math.floor(a[i] / exp) % 10]++;
    }
    for (let d = 1; d < 10; d++) counts[d] += counts[d - 1];
    // Walking backwards is what keeps radix sort stable.
    for (let i = a.length - 1; i >= 0; i--) {
      rec.accesses++;
      const digit = Math.floor(a[i] / exp) % 10;
      output[--counts[digit]] = a[i];
    }
    for (let i = 0; i < a.length; i++) rec.write(a, i, output[i]);
  }
  for (let i = 0; i < a.length; i++) rec.sorted(i);
};

const bogo: Runner = (a, rec) => {
  const sorted = () => {
    for (let i = 0; i + 1 < a.length; i++) if (rec.compare(a, i, i + 1) > 0) return false;
    return true;
  };
  // Deterministic shuffle so a run can be replayed; the ceiling stops the joke
  // from eating the tab.
  let seed = 20260807;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  while (!sorted() && !rec.full) {
    for (let i = a.length - 1; i > 0; i--) rec.swap(a, i, Math.floor(next() * (i + 1)));
  }
  if (!rec.full) for (let i = 0; i < a.length; i++) rec.sorted(i);
};

const RUNNERS: Record<AlgorithmId, Runner> = {
  bubble,
  cocktail,
  gnome,
  insertion,
  binaryInsertion,
  selection,
  shell,
  comb,
  merge,
  quick,
  heap,
  counting,
  radix,
  bogo,
};

/* -------------------------------- metadata -------------------------------- */

export interface AlgorithmMeta {
  id: AlgorithmId;
  name: string;
  family: "Exchange" | "Insertion" | "Selection" | "Divide & conquer" | "Non-comparison" | "Joke";
  best: string;
  average: string;
  worst: string;
  space: string;
  stable: boolean;
  description: string;
  /** The thing worth noticing while watching it run. */
  watch: string;
  /** Hard cap on array size, for the ones that would never finish. */
  maxSize?: number;
}

export const ALGORITHMS: AlgorithmMeta[] = [
  {
    id: "bubble",
    name: "Bubble sort",
    family: "Exchange",
    best: "O(n)",
    average: "O(n²)",
    worst: "O(n²)",
    space: "O(1)",
    stable: true,
    description:
      "Repeatedly walks the list, swapping any two neighbours that are out of order. Each pass floats the largest remaining value to the end.",
    watch: "The sorted tail growing one item per pass, from the right.",
  },
  {
    id: "cocktail",
    name: "Cocktail shaker",
    family: "Exchange",
    best: "O(n)",
    average: "O(n²)",
    worst: "O(n²)",
    space: "O(1)",
    stable: true,
    description:
      "Bubble sort that alternates direction. Going both ways stops a small value stranded near the end from crawling left one step per pass.",
    watch: "Sorted regions closing in from both edges at once.",
  },
  {
    id: "gnome",
    name: "Gnome sort",
    family: "Exchange",
    best: "O(n)",
    average: "O(n²)",
    worst: "O(n²)",
    space: "O(1)",
    stable: true,
    description:
      "Walks forward until it finds a pair out of order, then walks backward swapping until the pair is fixed. One loop, no nesting.",
    watch: "The single cursor pacing forward and back like someone tidying shelves.",
  },
  {
    id: "insertion",
    name: "Insertion sort",
    family: "Insertion",
    best: "O(n)",
    average: "O(n²)",
    worst: "O(n²)",
    space: "O(1)",
    stable: true,
    description:
      "Takes each item in turn and slides it back into its place among the items already sorted — the way most people sort a hand of cards.",
    watch: "How little work it does when the input is already nearly sorted.",
  },
  {
    id: "binaryInsertion",
    name: "Binary insertion",
    family: "Insertion",
    best: "O(n log n)",
    average: "O(n²)",
    worst: "O(n²)",
    space: "O(1)",
    stable: true,
    description:
      "Insertion sort that binary-searches for the landing spot instead of scanning for it. Far fewer comparisons, exactly the same amount of shifting.",
    watch: "The comparison counter next to plain insertion sort — the gap is the whole idea.",
  },
  {
    id: "selection",
    name: "Selection sort",
    family: "Selection",
    best: "O(n²)",
    average: "O(n²)",
    worst: "O(n²)",
    space: "O(1)",
    stable: false,
    description:
      "Scans the unsorted region for the smallest value and swaps it into place. Always n² comparisons, but never more than n swaps.",
    watch: "The write counter staying tiny while comparisons pile up.",
  },
  {
    id: "shell",
    name: "Shell sort",
    family: "Insertion",
    best: "O(n log n)",
    average: "O(n^1.3)",
    worst: "O(n^1.5)",
    space: "O(1)",
    stable: false,
    description:
      "Insertion sort over decreasing gaps, using Ciura's sequence. Early wide passes move items most of the way home, so the final gap-1 pass has almost nothing left to do.",
    watch: "The array becoming coarsely ordered long before it is actually sorted.",
  },
  {
    id: "comb",
    name: "Comb sort",
    family: "Exchange",
    best: "O(n log n)",
    average: "O(n²/2^p)",
    worst: "O(n²)",
    space: "O(1)",
    stable: false,
    description:
      "Bubble sort with a shrinking gap — the same trick Shell plays on insertion sort. Kills off small values stuck near the end early.",
    watch: "The comb spacing tightening with each pass.",
  },
  {
    id: "merge",
    name: "Merge sort",
    family: "Divide & conquer",
    best: "O(n log n)",
    average: "O(n log n)",
    worst: "O(n log n)",
    space: "O(n)",
    stable: true,
    description:
      "Splits the array down to single items, then merges the pieces back in order. Predictable to a fault: the same n log n whatever the input looks like.",
    watch: "Sorted blocks doubling in width, then fusing.",
  },
  {
    id: "quick",
    name: "Quicksort",
    family: "Divide & conquer",
    best: "O(n log n)",
    average: "O(n log n)",
    worst: "O(n²)",
    space: "O(log n)",
    stable: false,
    description:
      "Picks a pivot with median-of-three, partitions everything around it, then recurses into both sides. The median-of-three choice is what keeps sorted input off the quadratic path.",
    watch: "The pivot locking into its final position and never moving again.",
  },
  {
    id: "heap",
    name: "Heapsort",
    family: "Selection",
    best: "O(n log n)",
    average: "O(n log n)",
    worst: "O(n log n)",
    space: "O(1)",
    stable: false,
    description:
      "Builds a max-heap in place, then repeatedly swaps the root to the end and re-sifts. Selection sort with a much better way of finding the maximum.",
    watch: "The chaotic heap-building phase, then the clean drain from the right.",
  },
  {
    id: "counting",
    name: "Counting sort",
    family: "Non-comparison",
    best: "O(n + k)",
    average: "O(n + k)",
    worst: "O(n + k)",
    space: "O(n + k)",
    stable: true,
    description:
      "Never compares two items. Tallies how many times each value occurs, then writes them back out in order — linear time, at the cost of a bucket per possible value.",
    watch: "One tallying pass, then the array written left to right in a single sweep.",
  },
  {
    id: "radix",
    name: "Radix sort (LSD)",
    family: "Non-comparison",
    best: "O(nk)",
    average: "O(nk)",
    worst: "O(nk)",
    space: "O(n + k)",
    stable: true,
    description:
      "Counting-sorts by the ones digit, then the tens, then the hundreds. Because each pass is stable, earlier digits survive later ones.",
    watch: "The array getting sorted one digit at a time — it looks wrong until the last pass.",
  },
  {
    id: "bogo",
    name: "Bogosort",
    family: "Joke",
    best: "O(n)",
    average: "O(n·n!)",
    worst: "Unbounded",
    space: "O(1)",
    stable: false,
    description:
      "Shuffles the array at random and checks whether it happened to come out sorted. Included because watching it fail is genuinely instructive about what the others are doing.",
    watch: "Nothing. That is the lesson. Capped at eight items for obvious reasons.",
    maxSize: 8,
  },
];

export const ALGORITHM_BY_ID = Object.fromEntries(ALGORITHMS.map((a) => [a.id, a])) as Record<
  AlgorithmId,
  AlgorithmMeta
>;

/* ------------------------------- distributions ---------------------------- */

export type DistributionId =
  | "random"
  | "nearlySorted"
  | "reversed"
  | "fewUnique"
  | "sawtooth"
  | "gaussian";

export const DISTRIBUTIONS: { id: DistributionId; label: string; hint: string }[] = [
  { id: "random", label: "Random", hint: "the usual case" },
  { id: "nearlySorted", label: "Nearly sorted", hint: "where insertion sort shines" },
  { id: "reversed", label: "Reversed", hint: "the worst case for most" },
  { id: "fewUnique", label: "Few unique", hint: "lots of ties" },
  { id: "sawtooth", label: "Sawtooth", hint: "repeating ramps" },
  { id: "gaussian", label: "Bell curve", hint: "clustered in the middle" },
];

/** Small deterministic PRNG, so a seed reproduces an array exactly. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateArray(size: number, distribution: DistributionId, seed: number): number[] {
  const rand = mulberry32(seed);
  const max = 100;
  const out = new Array<number>(size);

  switch (distribution) {
    case "reversed":
      for (let i = 0; i < size; i++) out[i] = Math.round(max - (i / Math.max(1, size - 1)) * (max - 5));
      break;
    case "nearlySorted": {
      for (let i = 0; i < size; i++) out[i] = Math.round(5 + (i / Math.max(1, size - 1)) * (max - 5));
      // Disturb roughly a twentieth of the array — enough to be visible.
      const swaps = Math.max(1, Math.round(size / 20));
      for (let k = 0; k < swaps; k++) {
        const i = Math.floor(rand() * size);
        const j = Math.min(size - 1, i + 1 + Math.floor(rand() * 3));
        [out[i], out[j]] = [out[j], out[i]];
      }
      break;
    }
    case "fewUnique": {
      const buckets = [12, 30, 48, 66, 84];
      for (let i = 0; i < size; i++) out[i] = buckets[Math.floor(rand() * buckets.length)];
      break;
    }
    case "sawtooth": {
      const teeth = Math.max(2, Math.round(size / 18));
      for (let i = 0; i < size; i++) out[i] = Math.round(5 + ((i % teeth) / teeth) * (max - 5));
      break;
    }
    case "gaussian":
      for (let i = 0; i < size; i++) {
        // Sum of uniforms approximates a normal well enough to look right.
        const g = (rand() + rand() + rand() + rand()) / 4;
        out[i] = Math.max(3, Math.min(max, Math.round(g * max)));
      }
      break;
    default:
      for (let i = 0; i < size; i++) out[i] = Math.floor(rand() * max) + 3;
  }
  return out;
}

/* ---------------------------------- running -------------------------------- */

export function runAlgorithm(id: AlgorithmId, input: number[]): Trace {
  const rec = new Recorder();
  const scratch = input.slice();
  RUNNERS[id](scratch, rec);
  return rec.finish();
}

/* ---------------------------------- player -------------------------------- */

/** Everything the renderer needs to draw one moment of the run. */
export interface PlayerState {
  values: number[];
  sorted: boolean[];
  /** The two positions being compared right now. */
  a: number;
  b: number;
  /** Position last written to. */
  written: number;
  pivot: number;
  rangeLo: number;
  rangeHi: number;
}

export function initialState(values: number[]): PlayerState {
  return {
    values: values.slice(),
    sorted: new Array(values.length).fill(false),
    a: -1,
    b: -1,
    written: -1,
    pivot: -1,
    rangeLo: -1,
    rangeHi: -1,
  };
}

/** Applies one step. Mutates in place — the player owns a single state object. */
export function applyStep(state: PlayerState, step: Step) {
  switch (step.t) {
    case "compare":
      state.a = step.i;
      state.b = step.j ?? -1;
      state.written = -1;
      break;
    case "swap": {
      const j = step.j ?? step.i;
      const tmp = state.values[step.i];
      state.values[step.i] = state.values[j];
      state.values[j] = tmp;
      state.a = step.i;
      state.b = j;
      state.written = step.i;
      break;
    }
    case "write":
      state.values[step.i] = step.v!;
      state.written = step.i;
      state.a = step.i;
      state.b = -1;
      break;
    case "sorted":
      state.sorted[step.i] = true;
      break;
    case "pivot":
      state.pivot = step.i;
      break;
    case "range":
      state.rangeLo = step.i;
      state.rangeHi = step.j ?? step.i;
      break;
  }
}

/**
 * Undoes one step. Only correct when steps are reverted in reverse order, which
 * is exactly how the scrubber walks backwards.
 */
export function revertStep(state: PlayerState, step: Step) {
  switch (step.t) {
    case "swap": {
      const j = step.j ?? step.i;
      const tmp = state.values[step.i];
      state.values[step.i] = state.values[j];
      state.values[j] = tmp;
      break;
    }
    case "write":
      state.values[step.i] = step.p!;
      break;
    case "sorted":
      state.sorted[step.i] = false;
      break;
    default:
      break;
  }
}

/**
 * Rebuilds the state at an arbitrary step index. Seeking forward replays only
 * the steps in between; seeking backwards rewinds them. Either way it is a
 * handful of array writes, so dragging the scrubber stays smooth even on a
 * hundred thousand steps.
 */
export function seek(state: PlayerState, steps: Step[], from: number, to: number): number {
  let cursor = from;
  while (cursor < to) applyStep(state, steps[cursor++]);
  while (cursor > to) revertStep(state, steps[--cursor]);
  // Highlights are transient: reading them off the step we landed on keeps a
  // backwards seek from leaving a stale marker behind.
  if (to > 0 && to <= steps.length) {
    const step = steps[to - 1];
    if (step.t === "compare" || step.t === "swap" || step.t === "write") {
      state.a = step.i;
      state.b = step.t === "compare" || step.t === "swap" ? (step.j ?? -1) : -1;
      state.written = step.t === "compare" ? -1 : step.i;
    }
  } else if (to === 0) {
    state.a = -1;
    state.b = -1;
    state.written = -1;
    state.pivot = -1;
    state.rangeLo = -1;
    state.rangeHi = -1;
  }
  return cursor;
}

/** Verifies a trace actually sorts — cheap insurance against a bad algorithm. */
export function isSorted(values: number[]): boolean {
  for (let i = 0; i + 1 < values.length; i++) if (values[i] > values[i + 1]) return false;
  return true;
}
