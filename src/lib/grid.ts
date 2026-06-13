/** 1-based inclusive cell coordinates of a rectangular grid area. */
export interface GridArea {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface GridItem {
  id: string;
  /** Valid CSS identifier — used for grid-template-areas and class names. */
  name: string;
  area: GridArea;
  /** Index into the item color palette. */
  color: number;
}

export interface GridConfig {
  columns: string[];
  rows: string[];
  /** Gap in px, applied to both axes. */
  gap: number;
  items: GridItem[];
}

/** Static class strings so Tailwind picks them up at build time. */
export const ITEM_COLORS = [
  "border-sky-500/60 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "border-violet-500/60 bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "border-rose-500/60 bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "border-cyan-500/60 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  "border-lime-500/60 bg-lime-500/15 text-lime-700 dark:text-lime-300",
  "border-fuchsia-500/60 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
] as const;

/** Track values offered in the quick picker — free text is also allowed. */
export const TRACK_PRESETS = ["1fr", "2fr", "3fr", "auto", "min-content", "max-content", "120px", "200px", "minmax(200px, 1fr)"];

const TRACK_PATTERN =
  /^(\d+(\.\d+)?(fr|px|rem|em|%|vw|vh)|auto|min-content|max-content|minmax\(.+\)|fit-content\(.+\)|repeat\(.+\))$/;

export function isValidTrack(value: string): boolean {
  return TRACK_PATTERN.test(value.trim());
}

/** Turn two corner cells (any order) into a normalized area. */
export function normalizeArea(r1: number, c1: number, r2: number, c2: number): GridArea {
  return {
    r1: Math.min(r1, r2),
    c1: Math.min(c1, c2),
    r2: Math.max(r1, r2),
    c2: Math.max(c1, c2),
  };
}

export function areasOverlap(a: GridArea, b: GridArea): boolean {
  return a.r1 <= b.r2 && a.r2 >= b.r1 && a.c1 <= b.c2 && a.c2 >= b.c1;
}

export function inBounds(area: GridArea, rows: number, cols: number): boolean {
  return area.r1 >= 1 && area.c1 >= 1 && area.r2 <= rows && area.c2 <= cols;
}

export function collides(area: GridArea, items: GridItem[], ignoreId?: string): boolean {
  return items.some((item) => item.id !== ignoreId && areasOverlap(area, item.area));
}

/** First free area of the given size (top-left scan), or null if none fits. */
export function findFreeArea(config: GridConfig, h: number, w: number): GridArea | null {
  const rows = config.rows.length;
  const cols = config.columns.length;
  for (let r = 1; r + h - 1 <= rows; r++) {
    for (let c = 1; c + w - 1 <= cols; c++) {
      const area: GridArea = { r1: r, c1: c, r2: r + h - 1, c2: c + w - 1 };
      if (!collides(area, config.items)) return area;
    }
  }
  return null;
}

/** Clamp an item's area into the grid, shrinking it if the grid got smaller. */
export function clampArea(area: GridArea, rows: number, cols: number): GridArea | null {
  const clamped: GridArea = {
    r1: Math.min(area.r1, rows),
    c1: Math.min(area.c1, cols),
    r2: Math.min(area.r2, rows),
    c2: Math.min(area.c2, cols),
  };
  return clamped.r1 >= 1 && clamped.c1 >= 1 ? clamped : null;
}

/** Sanitize free-text input into a CSS identifier usable in grid-template-areas. */
export function sanitizeName(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
  return /^[a-z]/.test(cleaned) ? cleaned : cleaned ? `a-${cleaned}` : "";
}

export function uniqueName(base: string, items: GridItem[], ignoreId?: string): string {
  const taken = new Set(items.filter((i) => i.id !== ignoreId).map((i) => i.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Matrix of area names ("." for empty) — the source for grid-template-areas. */
export function buildAreasMatrix({ rows, columns, items }: GridConfig): string[][] {
  const matrix = rows.map(() => columns.map(() => "."));
  for (const item of items) {
    for (let r = item.area.r1; r <= item.area.r2; r++) {
      for (let c = item.area.c1; c <= item.area.c2; c++) {
        matrix[r - 1][c - 1] = item.name;
      }
    }
  }
  return matrix;
}

/**
 * Greedy maximal-rectangle fill: turns every empty region into new items.
 * Scans top-left to bottom-right, expanding right then down.
 */
export function fillEmptyCells(config: GridConfig): GridItem[] {
  const rows = config.rows.length;
  const cols = config.columns.length;
  const matrix = buildAreasMatrix(config);
  const added: GridItem[] = [];
  const all = [...config.items];

  const free = (r: number, c: number) => matrix[r - 1][c - 1] === ".";

  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      if (!free(r, c)) continue;
      let c2 = c;
      while (c2 + 1 <= cols && free(r, c2 + 1)) c2++;
      let r2 = r;
      expand: while (r2 + 1 <= rows) {
        for (let cc = c; cc <= c2; cc++) if (!free(r2 + 1, cc)) break expand;
        r2++;
      }
      const name = uniqueName("area", [...all, ...added]);
      const item: GridItem = {
        id: crypto.randomUUID(),
        name,
        area: { r1: r, c1: c, r2, c2 },
        color: (all.length + added.length) % ITEM_COLORS.length,
      };
      added.push(item);
      for (let rr = r; rr <= r2; rr++) for (let cc = c; cc <= c2; cc++) matrix[rr - 1][cc - 1] = name;
    }
  }
  return added;
}

function gapValue(gap: number): string {
  return `${gap}px`;
}

export function toCss(config: GridConfig, className = "grid-container"): string {
  const matrix = buildAreasMatrix(config);
  const lines = [
    `.${className} {`,
    `  display: grid;`,
    `  grid-template-columns: ${config.columns.join(" ")};`,
    `  grid-template-rows: ${config.rows.join(" ")};`,
  ];
  if (config.items.length > 0) {
    lines.push(`  grid-template-areas:`);
    matrix.forEach((row, i) => {
      lines.push(`    "${row.join(" ")}"${i === matrix.length - 1 ? ";" : ""}`);
    });
  }
  lines.push(`  gap: ${gapValue(config.gap)};`, `}`);

  for (const item of config.items) {
    lines.push(``, `.${item.name} {`, `  grid-area: ${item.name};`, `}`);
  }
  return lines.join("\n");
}

export function toHtml(config: GridConfig, className = "grid-container"): string {
  const children = config.items
    .map((item) => `  <div class="${item.name}">${item.name}</div>`)
    .join("\n");
  return `<div class="${className}">\n${children}\n</div>`;
}

export function toTailwind(config: GridConfig): string {
  const cols = config.columns.join("_");
  const rowsT = config.rows.join("_");
  const container = `grid grid-cols-[${cols}] grid-rows-[${rowsT}] gap-[${gapValue(config.gap)}]`;
  const children = config.items
    .map((item) => {
      const { r1, c1, r2, c2 } = item.area;
      const cls = `col-start-${c1} col-end-${c2 + 1} row-start-${r1} row-end-${r2 + 1}`;
      return `  <div class="${cls}">${item.name}</div>`;
    })
    .join("\n");
  return `<div class="${container}">\n${children}\n</div>`;
}

export interface GridPreset {
  id: string;
  name: string;
  columns: string[];
  rows: string[];
  gap: number;
  /** name + area pairs — ids and colors are assigned on apply. */
  areas: { name: string; area: GridArea }[];
}

export const GRID_PRESETS: GridPreset[] = [
  {
    id: "blank",
    name: "Blank 3 × 3",
    columns: ["1fr", "1fr", "1fr"],
    rows: ["1fr", "1fr", "1fr"],
    gap: 12,
    areas: [],
  },
  {
    id: "holy-grail",
    name: "Holy Grail",
    columns: ["220px", "1fr", "220px"],
    rows: ["auto", "1fr", "auto"],
    gap: 12,
    areas: [
      { name: "header", area: { r1: 1, c1: 1, r2: 1, c2: 3 } },
      { name: "sidebar", area: { r1: 2, c1: 1, r2: 2, c2: 1 } },
      { name: "main", area: { r1: 2, c1: 2, r2: 2, c2: 2 } },
      { name: "aside", area: { r1: 2, c1: 3, r2: 2, c2: 3 } },
      { name: "footer", area: { r1: 3, c1: 1, r2: 3, c2: 3 } },
    ],
  },
  {
    id: "dashboard",
    name: "Dashboard",
    columns: ["240px", "1fr", "1fr", "1fr"],
    rows: ["auto", "1fr", "1fr"],
    gap: 16,
    areas: [
      { name: "header", area: { r1: 1, c1: 1, r2: 1, c2: 4 } },
      { name: "nav", area: { r1: 2, c1: 1, r2: 3, c2: 1 } },
      { name: "stats", area: { r1: 2, c1: 2, r2: 2, c2: 4 } },
      { name: "chart", area: { r1: 3, c1: 2, r2: 3, c2: 3 } },
      { name: "activity", area: { r1: 3, c1: 4, r2: 3, c2: 4 } },
    ],
  },
  {
    id: "gallery",
    name: "Gallery",
    columns: ["1fr", "1fr", "1fr", "1fr"],
    rows: ["1fr", "1fr", "1fr"],
    gap: 8,
    areas: [
      { name: "featured", area: { r1: 1, c1: 1, r2: 2, c2: 2 } },
      { name: "tile-a", area: { r1: 1, c1: 3, r2: 1, c2: 3 } },
      { name: "tile-b", area: { r1: 1, c1: 4, r2: 1, c2: 4 } },
      { name: "tile-c", area: { r1: 2, c1: 3, r2: 2, c2: 4 } },
      { name: "tile-d", area: { r1: 3, c1: 1, r2: 3, c2: 2 } },
      { name: "wide", area: { r1: 3, c1: 3, r2: 3, c2: 4 } },
    ],
  },
  {
    id: "magazine",
    name: "Magazine",
    columns: ["2fr", "1fr", "1fr"],
    rows: ["auto", "1fr", "1fr", "auto"],
    gap: 16,
    areas: [
      { name: "masthead", area: { r1: 1, c1: 1, r2: 1, c2: 3 } },
      { name: "lead", area: { r1: 2, c1: 1, r2: 3, c2: 1 } },
      { name: "story-a", area: { r1: 2, c1: 2, r2: 2, c2: 3 } },
      { name: "story-b", area: { r1: 3, c1: 2, r2: 3, c2: 2 } },
      { name: "story-c", area: { r1: 3, c1: 3, r2: 3, c2: 3 } },
      { name: "footer", area: { r1: 4, c1: 1, r2: 4, c2: 3 } },
    ],
  },
];

export function applyPreset(preset: GridPreset): GridConfig {
  return {
    columns: [...preset.columns],
    rows: [...preset.rows],
    gap: preset.gap,
    items: preset.areas.map((a, i) => ({
      id: crypto.randomUUID(),
      name: a.name,
      area: { ...a.area },
      color: i % ITEM_COLORS.length,
    })),
  };
}
