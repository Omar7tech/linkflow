/**
 * Procedural material textures for the mockup tool's "Material" and "Wild"
 * finishes — carbon weave, suede, silk, leather, stone, glowing circuitry.
 * Everything is drawn into plain canvases (no three.js here), tiles seamlessly,
 * and can be made at any size, so the same code paints the device and the
 * little chips in the finish picker.
 */

export type MaterialTextureId =
  | "carbon"
  | "forged"
  | "alcantara"
  | "silk"
  | "leather"
  | "walnut"
  | "marble"
  | "nero"
  | "brushed"
  | "terrazzo"
  | "stardust"
  | "galaxy"
  | "magma"
  | "circuit";

export interface MaterialTexture {
  /** Color, multiplied by the finish's tint. */
  map?: HTMLCanvasElement;
  /** Height: white is raised. */
  bump?: HTMLCanvasElement;
  /** Light the surface gives off by itself. */
  emissive?: HTMLCanvasElement;
}

type Rgb = [number, number, number];
const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const grey = (v: number): Rgb => [v * 255, v * 255, v * 255];

function hash(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Value noise that repeats every `px` × `py` cells. */
function noise(x: number, y: number, px: number, py: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const wx = (v: number) => ((v % px) + px) % px;
  const wy = (v: number) => ((v % py) + py) % py;
  const a = hash(wx(xi), wy(yi), seed);
  const b = hash(wx(xi + 1), wy(yi), seed);
  const c = hash(wx(xi), wy(yi + 1), seed);
  const d = hash(wx(xi + 1), wy(yi + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Layered noise over the unit square; `fx`/`fy` are whole numbers, so it tiles. */
function fbm(u: number, v: number, fx: number, fy: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(u * fx, v * fy, fx, fy, seed + o * 17);
    total += amp;
    amp *= 0.5;
    fx *= 2;
    fy *= 2;
  }
  return sum / total;
}

/** Tiling cells: distance to the nearest cell's edge, and a random number per cell. */
function cells(u: number, v: number, n: number, seed: number): { edge: number; near: number; id: number } {
  const x = u * n;
  const y = v * n;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let d1 = 9;
  let d2 = 9;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i;
      const cy = yi + j;
      const wx = ((cx % n) + n) % n;
      const wy = ((cy % n) + n) % n;
      const d = Math.hypot(cx + hash(wx, wy, seed) - x, cy + hash(wx, wy, seed + 1) - y);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash(wx, wy, seed + 2);
      } else if (d < d2) d2 = d;
    }
  }
  return { edge: d2 - d1, near: d1, id };
}

function canvasOf(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!];
}

/** Fill several canvases at once from one per-pixel function over the unit square. */
function paint<K extends string>(size: number, keys: K[], pixel: (u: number, v: number) => Record<K, Rgb>): Record<K, HTMLCanvasElement> {
  const out = {} as Record<K, HTMLCanvasElement>;
  const images = {} as Record<K, ImageData>;
  const ctxs = {} as Record<K, CanvasRenderingContext2D>;
  for (const k of keys) {
    const [c, g] = canvasOf(size);
    out[k] = c;
    ctxs[k] = g;
    images[k] = g.createImageData(size, size);
  }
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const px = pixel((i + 0.5) / size, (j + 0.5) / size);
      const o = (j * size + i) * 4;
      for (const k of keys) {
        const d = images[k].data;
        d[o] = px[k][0];
        d[o + 1] = px[k][1];
        d[o + 2] = px[k][2];
        d[o + 3] = 255;
      }
    }
  }
  for (const k of keys) ctxs[k].putImageData(images[k], 0, 0);
  return out;
}

/* ------------------------------------------------------------- the materials */

/** 2×2 twill: each tow passes over two and under two, stepping one across per row. */
function carbon(size: number): MaterialTexture {
  const n = 8;
  return paint(size, ["map", "bump"], (u, v) => {
    const x = u * n;
    const y = v * n;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const warp = ((i + j) & 3) < 2; // the lengthwise tow is on top here
    const across = warp ? x - i : y - j;
    const round = Math.sin(Math.PI * across); // the tow's rounded back
    const fibre = 0.85 + 0.15 * noise((warp ? x : y) * 24, 0, n * 24, 1, 3); // strands along it
    const shade = (warp ? 0.2 : 0.085) * (0.35 + 0.65 * round) * fibre;
    return { map: grey(0.03 + shade), bump: grey(0.15 + 0.85 * round) };
  });
}

/** Forged carbon: chopped tow pressed flat, every chip catching the light its own way. */
function forged(size: number): MaterialTexture {
  return paint(size, ["map", "bump"], (u, v) => {
    const c = cells(u, v, 9, 11);
    const streak = fbm(u, v, 3 + Math.floor(c.id * 5), 60, 2, Math.floor(c.id * 97));
    const shade = 0.03 + (0.04 + c.id * 0.2) * (0.55 + 0.45 * streak);
    return { map: grey(shade * smooth(0, 0.05, c.edge) + 0.02), bump: grey(0.5 + c.id * 0.3) };
  });
}

/** Suede nap: fine fibres, brushed lighter and darker in soft patches. */
function alcantara(size: number): MaterialTexture {
  return paint(size, ["map", "bump"], (u, v) => {
    const nap = fbm(u, v, 5, 5, 3, 21);
    const fibre = fbm(u, v, 96, 96, 2, 22);
    return { map: grey(0.62 + 0.3 * nap + 0.08 * fibre), bump: grey(fibre) };
  });
}

/** Silk lying in loose folds, with the faintest thread running across it. */
function silk(size: number): MaterialTexture {
  return paint(size, ["map", "bump"], (u, v) => {
    const drift = fbm(u, v, 2, 2, 3, 31);
    const fold = 0.5 + 0.5 * Math.sin(TAU * (u + 2 * v) + drift * 7);
    const thread = 0.5 + 0.5 * Math.sin(TAU * v * 160);
    return { map: grey(0.82 + 0.18 * fold), bump: grey(fold * 0.96 + thread * 0.04) };
  });
}

/** Pebbled leather: plump cells with creases between them. */
function leather(size: number): MaterialTexture {
  return paint(size, ["map", "bump"], (u, v) => {
    const wu = u + 0.02 * fbm(u, v, 6, 6, 2, 41);
    const c = cells(wu, v, 20, 42);
    const plump = smooth(0, 0.34, c.edge);
    const pore = fbm(u, v, 80, 80, 2, 43);
    return { map: grey(0.6 + 0.32 * plump + 0.08 * pore), bump: grey(plump * 0.9 + pore * 0.1) };
  });
}

/** Walnut: growth rings pulled into long grain, with darker streaks of figure. */
function walnut(size: number): MaterialTexture {
  const dark = hex("#2e1a0e");
  const mid = hex("#6b4226");
  const light = hex("#9a6a3f");
  return paint(size, ["map", "bump"], (u, v) => {
    const pull = fbm(u, v, 3, 1, 3, 51);
    const ring = Math.abs(((u * 6 + pull * 2.4) % 1) * 2 - 1);
    const streak = fbm(u, v, 90, 2, 2, 52);
    const t = clamp01(0.15 + 0.6 * ring + 0.35 * (streak - 0.5));
    return { map: t < 0.5 ? mix(dark, mid, t * 2) : mix(mid, light, t * 2 - 1), bump: grey(0.5 + 0.5 * streak) };
  });
}

/** Marble: a clouded ground with veins wandering through it. */
function marble(size: number, ground: Rgb, cloud: Rgb, vein: Rgb): MaterialTexture {
  return paint(size, ["map"], (u, v) => {
    const drift = fbm(u, v, 3, 3, 4, 61);
    const big = Math.pow(1 - Math.abs(Math.sin(Math.PI * (u * 2 + v + drift * 1.3))), 18);
    const fine = Math.pow(1 - Math.abs(Math.sin(Math.PI * (u * 3 - v * 2 + fbm(u, v, 5, 5, 3, 62) * 1.6))), 40);
    const base = mix(ground, cloud, smooth(0.35, 0.75, fbm(u, v, 4, 4, 3, 63)));
    return { map: mix(base, vein, clamp01(big * 0.9 + fine * 0.6)) };
  });
}

/** Brushed metal: hairline scratches all running one way. */
function brushed(size: number): MaterialTexture {
  return paint(size, ["map", "bump"], (u, v) => {
    const line = fbm(u, v, 2, 160, 3, 71);
    return { map: grey(0.78 + 0.22 * line), bump: grey(line) };
  });
}

/** Terrazzo: stone chips of every size set in pale cement. */
function terrazzo(size: number): MaterialTexture {
  const cement = hex("#efe8dc");
  const chips = ["#d97757", "#2f6f5e", "#e2b65b", "#3d4f7d", "#c9bfb2", "#1f2a2a", "#e6a4a0"].map(hex);
  return paint(size, ["map"], (u, v) => {
    let color = mix(cement, hex("#e4dccd"), fbm(u, v, 40, 40, 2, 81));
    for (const [n, seed, keep] of [[7, 82, 0.66], [15, 85, 0.7], [30, 88, 0.74]] as const) {
      const c = cells(u + 0.015 * fbm(u, v, 8, 8, 2, seed + 9), v, n, seed);
      if (c.id > keep && c.edge > 0.16) color = chips[Math.floor(c.id * 977) % chips.length];
    }
    return { map: color };
  });
}

/** Stardust: black lacquer full of flakes, each tilted its own way so they flash in turn. */
function stardust(size: number): MaterialTexture {
  const flakes = ["#ffffff", "#bcd7ff", "#ffe2a8", "#ffc4e6"].map(hex);
  return paint(size, ["map", "bump", "emissive"], (u, v) => {
    const c = cells(u, v, 46, 91);
    const speck = c.id > 0.55 ? 1 - smooth(0.06, 0.2, c.near) : 0;
    const color = flakes[Math.floor(c.id * 613) % flakes.length];
    const deep = mix(hex("#05060c"), hex("#111a3a"), fbm(u, v, 3, 3, 3, 92));
    return {
      map: mix(deep, color, speck * 0.9),
      bump: grey(cells(u, v, 70, 93).id),
      emissive: mix([0, 0, 0], color, speck * (c.id > 0.9 ? 0.9 : 0.25)),
    };
  });
}

/** A slice of night sky: gas clouds in three colors, and stars. */
function galaxy(size: number): MaterialTexture {
  const stops = [hex("#04051a"), hex("#1b1464"), hex("#7b2ff7"), hex("#f72585"), hex("#4cc9f0")];
  return paint(size, ["map", "emissive"], (u, v) => {
    const a = fbm(u + 0.2 * fbm(u, v, 3, 3, 3, 101), v, 2, 2, 5, 102);
    const b = fbm(u, v + 0.2 * fbm(u, v, 3, 3, 3, 103), 3, 3, 4, 104);
    let color = mix(stops[0], stops[1], smooth(0.3, 0.55, a));
    color = mix(color, stops[2], smooth(0.5, 0.75, a) * 0.8);
    color = mix(color, stops[3], smooth(0.55, 0.8, b) * 0.6);
    color = mix(color, stops[4], smooth(0.62, 0.85, a * b * 2.2) * 0.7);
    const s = cells(u, v, 60, 105);
    const star = s.id > 0.7 ? 1 - smooth(0.02, 0.1 + 0.08 * s.id, s.near) : 0;
    color = mix(color, [255, 255, 255], star);
    return { map: color, emissive: mix(mix([0, 0, 0], color, 0.45), [255, 255, 255], star) };
  });
}

/** Cooling lava: a black crust broken into plates, still lit from underneath. */
function magma(size: number): MaterialTexture {
  const ember = hex("#ff3b00");
  const core = hex("#ffd166");
  return paint(size, ["map", "bump", "emissive"], (u, v) => {
    const wu = u + 0.05 * fbm(u, v, 4, 4, 3, 111);
    const wv = v + 0.05 * fbm(u, v, 4, 4, 3, 112);
    const c = cells(wu, wv, 6, 113);
    const crack = 1 - smooth(0, 0.11, c.edge);
    const rock = 0.03 + 0.08 * fbm(u, v, 24, 24, 3, 114) + 0.03 * c.id;
    const heat = Math.pow(crack, 1.6) * (0.55 + 0.45 * fbm(u, v, 5, 5, 2, 115));
    return {
      map: grey(rock * (1 - crack * 0.7)),
      bump: grey(1 - crack),
      emissive: mix(mix([0, 0, 0], ember, clamp01(heat * 1.6)), core, smooth(0.6, 1, heat)),
    };
  });
}

/** A circuit board: solder mask, copper traces, and a few of them carrying current. */
function circuit(size: number): MaterialTexture {
  const [map, m] = canvasOf(size);
  const [emissive, e] = canvasOf(size);
  const [bump, b] = canvasOf(size);
  m.fillStyle = "#06261d";
  m.fillRect(0, 0, size, size);
  e.fillStyle = "#000";
  e.fillRect(0, 0, size, size);
  b.fillStyle = "#555";
  b.fillRect(0, 0, size, size);
  let seed = 1234567;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const grid = 24;
  const step = size / grid;
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let k = 0; k < 46; k++) {
    let x = Math.floor(rand() * grid);
    let y = Math.floor(rand() * grid);
    const points: [number, number][] = [[x, y]];
    let dir = Math.floor(rand() * 4);
    for (let s = 0, turns = 2 + Math.floor(rand() * 4); s < turns; s++) {
      const len = 1 + Math.floor(rand() * 5);
      x += dirs[dir][0] * len;
      y += dirs[dir][1] * len;
      points.push([x, y]);
      dir = rand() < 0.35 ? 4 + Math.floor(rand() * 4) : Math.floor(rand() * 4);
    }
    const live = rand() < 0.3;
    const glow = rand() < 0.75 ? "#34f5b0" : "#fbbf24";
    // Drawn nine times over, so traces that leave one edge come back in on the other.
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        for (const [g, color, width] of [[m, "#0f7a58", 0.16], [b, "#fff", 0.16], ...(live ? ([[e, glow, 0.11]] as const) : [])] as const) {
          g.strokeStyle = g.fillStyle = color;
          g.lineWidth = step * width;
          g.lineCap = g.lineJoin = "round";
          g.beginPath();
          points.forEach(([px, py], i) => g[i ? "lineTo" : "moveTo"]((px + ox * grid + 0.5) * step, (py + oy * grid + 0.5) * step));
          g.stroke();
          for (const [px, py] of [points[0], points[points.length - 1]]) {
            g.beginPath();
            g.arc((px + ox * grid + 0.5) * step, (py + oy * grid + 0.5) * step, step * 0.24, 0, TAU);
            g.fill();
          }
        }
        // Gold on the pads.
        m.fillStyle = "#d4a84a";
        for (const [px, py] of [points[0], points[points.length - 1]]) {
          m.beginPath();
          m.arc((px + ox * grid + 0.5) * step, (py + oy * grid + 0.5) * step, step * 0.15, 0, TAU);
          m.fill();
        }
      }
    }
  }
  return { map, bump, emissive };
}

const cache = new Map<string, MaterialTexture>();

/** The canvases for a material, `size` pixels square. Painted once per size. */
export function materialTexture(id: MaterialTextureId, size: number): MaterialTexture {
  const key = `${id}|${size}`;
  let t = cache.get(key);
  if (t) return t;
  if (id === "carbon") t = carbon(size);
  else if (id === "forged") t = forged(size);
  else if (id === "alcantara") t = alcantara(size);
  else if (id === "silk") t = silk(size);
  else if (id === "leather") t = leather(size);
  else if (id === "walnut") t = walnut(size);
  else if (id === "marble") t = marble(size, hex("#f6f4f0"), hex("#e3e1dc"), hex("#7d7f86"));
  else if (id === "nero") t = marble(size, hex("#0b0b0d"), hex("#1a1a1f"), hex("#d9ad55"));
  else if (id === "brushed") t = brushed(size);
  else if (id === "terrazzo") t = terrazzo(size);
  else if (id === "stardust") t = stardust(size);
  else if (id === "galaxy") t = galaxy(size);
  else if (id === "magma") t = magma(size);
  else t = circuit(size);
  cache.set(key, t);
  return t;
}

/** Paint a material into a small canvas as it will look on a device — for picker chips. */
export function paintMaterialChip(canvas: HTMLCanvasElement, id: MaterialTextureId, tint: string) {
  const size = canvas.width;
  const t = materialTexture(id, size);
  const g = canvas.getContext("2d")!;
  g.globalCompositeOperation = "source-over";
  g.fillStyle = tint;
  g.fillRect(0, 0, size, size);
  if (t.map) {
    g.globalCompositeOperation = "multiply";
    g.drawImage(t.map, 0, 0, size, size);
  }
  if (t.bump) {
    // Relief shows as light and shade on the tint.
    g.globalCompositeOperation = "soft-light";
    g.drawImage(t.bump, 0, 0, size, size);
  }
  if (t.emissive) {
    g.globalCompositeOperation = "lighter";
    g.drawImage(t.emissive, 0, 0, size, size);
  }
  g.globalCompositeOperation = "source-over";
}
