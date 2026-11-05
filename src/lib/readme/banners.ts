/**
 * Banner, divider and footer artwork for READMEs, as self-contained SVG.
 *
 * GitHub shows repo images through an <img>, which plays SVG animations but
 * cannot fetch fonts, so fonts are embedded and animations use SMIL, which
 * needs no script. Every piece comes in a light and a dark version; the
 * README swaps them with the reader's GitHub theme.
 */
import type { BannerStyle } from "./types";

export interface BannerInput {
  title: string;
  tagline: string;
  accent: string;
  dark: boolean;
  animated: boolean;
  /** CSS font-family for display text. */
  font: string;
  /** Embedded @font-face rules, when the font is not a system font. */
  fontCss?: string;
}

const W = 1280;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MONO = `"Space Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
const SYSTEM = `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as [number, number, number];
}
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: string, b: string, t: number) => toHex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
/** The accent turned around the colour wheel, for a second, related hue. */
function shift(hex: string, deg: number) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255]);
}

const titleSize = (title: string, max = 104, room = 1080) => Math.max(40, Math.min(max, room / Math.max(1, title.length * 0.56)));

function frame(h: number, i: BannerInput, body: string, defs = "") {
  const style = i.fontCss ? `<style>${i.fontCss}</style>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}"><defs>${style}<clipPath id="r"><rect width="${W}" height="${h}" rx="24"/></clipPath>${defs}</defs><g clip-path="url(#r)">${body}</g></svg>`;
}

const anim = (i: BannerInput, s: string) => (i.animated ? s : "");

/* ---------------------------------------------------------------- styles */

function aurora(i: BannerInput) {
  const H = 320;
  const bg = i.dark ? "#0a0d14" : "#f7f8fb";
  const ink = i.dark ? "#f5f7fa" : "#0b0f19";
  const muted = i.dark ? "#9aa4b2" : "#4b5563";
  const c1 = i.accent;
  const c2 = shift(i.accent, 70);
  const c3 = shift(i.accent, -60);
  const blob = (cx: number, cy: number, r: number, c: string, dx: number, dy: number, dur: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" opacity="${i.dark ? 0.55 : 0.45}">${anim(
      i,
      `<animateTransform attributeName="transform" type="translate" values="0 0;${dx} ${dy};0 0" dur="${dur}s" repeatCount="indefinite"/>`
    )}</circle>`;
  const size = titleSize(i.title);
  const defs = `<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.09 0"/></filter>`;
  const body = `<rect width="${W}" height="${H}" fill="${bg}"/><g filter="url(#blur)">${blob(260, 60, 210, c1, 120, 40, 14)}${blob(980, 260, 230, c2, -140, -30, 17)}${blob(700, -20, 170, c3, 60, 70, 12)}</g><rect width="${W}" height="${H}" filter="url(#grain)"/><text x="640" y="${168 + size * 0.1}" text-anchor="middle" font-family='${i.font}' font-size="${size}" font-weight="800" letter-spacing="-2" fill="${ink}">${esc(i.title)}</text><text x="640" y="${226 + size * 0.1}" text-anchor="middle" font-family='${SYSTEM}' font-size="26" fill="${muted}">${esc(i.tagline)}</text>`;
  return frame(H, i, body, defs);
}

function waves(i: BannerInput) {
  const H = 320;
  const bg = i.dark ? "#0d1117" : "#ffffff";
  const ink = i.dark ? "#f0f6fc" : "#1f2328";
  const muted = i.dark ? "#9198a1" : "#59636e";
  const wave = (y: number, amp: number, period: number, color: string, opacity: number, dur: number) => {
    let d = `M0 ${H}`;
    for (let x = 0; x <= W * 2; x += 20) d += ` L${x} ${y + Math.sin((x / period) * Math.PI * 2) * amp}`;
    d += ` L${W * 2} ${H} Z`;
    return `<path d="${d}" fill="${color}" opacity="${opacity}">${anim(i, `<animateTransform attributeName="transform" type="translate" values="0 0;${-period * Math.round(W / period)} 0" dur="${dur}s" repeatCount="indefinite"/>`)}</path>`;
  };
  const size = titleSize(i.title, 92);
  const body = `<rect width="${W}" height="${H}" fill="${bg}"/>${wave(230, 18, 320, mix(i.accent, bg, 0.6), 1, 16)}${wave(250, 14, 256, mix(i.accent, bg, 0.3), 1, 11)}${wave(272, 10, 213.3333, i.accent, 1, 8)}<text x="640" y="${120 + size * 0.2}" text-anchor="middle" font-family='${i.font}' font-size="${size}" font-weight="800" letter-spacing="-1.5" fill="${ink}">${esc(i.title)}</text><text x="640" y="${170 + size * 0.2}" text-anchor="middle" font-family='${SYSTEM}' font-size="24" fill="${muted}">${esc(i.tagline)}</text>`;
  return frame(H, i, body);
}

function terminal(i: BannerInput) {
  const H = 320;
  const bg = i.dark ? "#0d1117" : "#f6f8fa";
  const win = i.dark ? "#161b22" : "#ffffff";
  const line = i.dark ? "#30363d" : "#d1d9e0";
  const ink = i.dark ? "#e6edf3" : "#1f2328";
  const muted = i.dark ? "#7d8590" : "#6e7781";
  const cmd = `npx ${i.title.toLowerCase().replace(/\s+/g, "-")}`;
  const typeW = cmd.length * 13.2 + 4;
  const size = Math.min(84, 1000 / Math.max(1, i.title.length * 0.62));
  const reveal = i.animated
    ? `<rect x="134" y="104" width="0" height="30"><animate attributeName="width" values="0;${typeW};${typeW}" keyTimes="0;0.35;1" dur="5s" repeatCount="indefinite" calcMode="discrete" /></rect>`
    : `<rect x="134" y="104" width="${typeW}" height="30"/>`;
  // Typing: the reveal grows in character-sized steps.
  const steps = Array.from({ length: cmd.length + 1 }, (_, k) => ((k / cmd.length) * typeW).toFixed(1)).join(";");
  const typing = i.animated
    ? `<rect x="134" y="104" width="0" height="30"><animate attributeName="width" values="${steps};${typeW.toFixed(1)}" dur="5s" repeatCount="indefinite" calcMode="discrete"/></rect>`
    : reveal;
  const defs = `<clipPath id="type">${typing}</clipPath>`;
  const body = `<rect width="${W}" height="${H}" fill="${bg}"/><rect x="60" y="34" width="${W - 120}" height="${H - 68}" rx="14" fill="${win}" stroke="${line}"/><line x1="60" x2="${W - 60}" y1="78" y2="78" stroke="${line}"/>${[0, 1, 2]
    .map((k) => `<circle cx="${92 + k * 24}" cy="56" r="7" fill="${["#ff5f57", "#febc2e", "#28c840"][k]}"/>`)
    .join("")}<text x="${W / 2}" y="61" text-anchor="middle" font-family='${MONO}' font-size="15" fill="${muted}">zsh — ${esc(i.title.toLowerCase())}</text><text x="100" y="126" font-family='${MONO}' font-size="22" fill="${i.accent}">$</text><text x="134" y="126" font-family='${MONO}' font-size="22" fill="${ink}" clip-path="url(#type)">${esc(cmd)}</text><text x="100" y="${166 + size * 0.55}" font-family='${i.font}' font-size="${size}" font-weight="700" fill="${ink}">${esc(i.title)}<tspan fill="${i.accent}">_</tspan>${anim(i, `<animate attributeName="opacity" values="0;1;1" keyTimes="0;0.4;1" dur="5s" repeatCount="indefinite"/>`)}</text><text x="100" y="${H - 58}" font-family='${MONO}' font-size="18" fill="${muted}"># ${esc(i.tagline)}</text>`;
  return frame(H, i, body, defs);
}

function swiss(i: BannerInput) {
  const H = 320;
  const bg = i.dark ? "#141414" : "#f1ede4";
  const ink = i.dark ? "#f1ede4" : "#141414";
  const size = titleSize(i.title, 120, 820);
  const grid = Array.from({ length: 11 }, (_, k) => `<line x1="${64 + k * 105.2}" x2="${64 + k * 105.2}" y1="0" y2="${H}" stroke="${ink}" stroke-opacity="0.07"/>`).join("");
  const body = `<rect width="${W}" height="${H}" fill="${bg}"/>${grid}<circle cx="1080" cy="150" r="190" fill="${i.accent}">${anim(i, `<animateTransform attributeName="transform" type="translate" values="0 0;-30 18;0 0" dur="9s" repeatCount="indefinite"/>`)}</circle><circle cx="1150" cy="240" r="52" fill="none" stroke="${ink}" stroke-width="3">${anim(i, `<animateTransform attributeName="transform" type="rotate" values="0 1080 150;360 1080 150" dur="24s" repeatCount="indefinite"/>`)}</circle><text x="64" y="70" font-family='${MONO}' font-size="16" letter-spacing="2" fill="${ink}">N° 01 — README</text><text x="60" y="${190 + size * 0.15}" font-family='${i.font}' font-size="${size}" font-weight="800" letter-spacing="-3" fill="${ink}">${esc(i.title)}</text><text x="64" y="${250 + size * 0.1}" font-family='${SYSTEM}' font-size="24" font-weight="600" fill="${ink}">${esc(i.tagline)}</text>`;
  return frame(H, i, body);
}

function gridStyle(i: BannerInput) {
  const H = 340;
  const top = i.dark ? "#07060f" : "#fbfbff";
  const horizon = i.dark ? mix(i.accent, "#07060f", 0.55) : mix(i.accent, "#ffffff", 0.7);
  const lineC = i.dark ? i.accent : mix(i.accent, "#000000", 0.15);
  const ink = i.dark ? "#ffffff" : "#120f24";
  const muted = i.dark ? "#c8c2e8" : "#4a4466";
  const hy = 248;
  const verticals = Array.from({ length: 31 }, (_, k) => {
    const x = (k - 15) * 90;
    return `<line x1="${640 + x * 0.05}" y1="${hy}" x2="${640 + x * 3}" y2="${H + 40}" stroke="${lineC}" stroke-opacity="0.55" stroke-width="1.5"/>`;
  }).join("");
  // Floor lines march towards the viewer: each moves into the next one's place.
  const at = (t: number) => (hy + Math.pow(t / 8, 2) * (H - hy + 30)).toFixed(1);
  const horizontals = Array.from({ length: 9 }, (_, k) => {
    const move = anim(i, `<animate attributeName="y1" values="${at(k)};${at(k + 1)}" dur="1.2s" repeatCount="indefinite"/><animate attributeName="y2" values="${at(k)};${at(k + 1)}" dur="1.2s" repeatCount="indefinite"/>`);
    return `<line x1="0" x2="${W}" y1="${at(k + 0.5)}" y2="${at(k + 0.5)}" stroke="${lineC}" stroke-opacity="0.55" stroke-width="1.5">${move}</line>`;
  }).join("");
  const size = titleSize(i.title, 92);
  // A sunset sitting on the horizon, sliced by the classic stripes.
  const r = 74;
  const sunStripes = Array.from({ length: 5 }, (_, k) => `<rect x="${640 - r}" y="${hy - 44 + k * 9}" width="${r * 2}" height="${2 + k * 1.2}" fill="${horizon}"/>`).join("");
  const glow = i.dark ? ` filter="url(#glow)"` : "";
  const defs = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${horizon}"/></linearGradient><linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shift(i.accent, 40)}"/><stop offset="1" stop-color="${i.accent}"/></linearGradient><filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><clipPath id="floor"><rect y="${hy}" width="${W}" height="${H - hy}"/></clipPath><clipPath id="sky-clip"><rect width="${W}" height="${hy}"/></clipPath>`;
  const floor = `<rect y="${hy}" width="${W}" height="${H - hy}" fill="${top}"/><g clip-path="url(#floor)">${verticals}${horizontals}</g><line x1="0" x2="${W}" y1="${hy}" y2="${hy}" stroke="${lineC}" stroke-width="2"/>`;
  const sun = `<g clip-path="url(#sky-clip)"><circle cx="640" cy="${hy}" r="${r}" fill="url(#sun)">${anim(i, `<animate attributeName="r" values="${r};${r + 4};${r}" dur="6s" repeatCount="indefinite"/>`)}</circle>${sunStripes}</g>`;
  const body = `<rect width="${W}" height="${H}" fill="url(#sky)"/>${sun}${floor}<text x="640" y="${92 + size * 0.2}" text-anchor="middle" font-family='${i.font}' font-size="${size}" font-weight="800" letter-spacing="-1" fill="${ink}"${glow}>${esc(i.title)}</text><text x="640" y="${140 + size * 0.2}" text-anchor="middle" font-family='${SYSTEM}' font-size="22" fill="${muted}">${esc(i.tagline)}</text>`;
  return frame(H, i, body, defs);
}

function typing(i: BannerInput) {
  const H = 280;
  const bg = i.dark ? "#0d1117" : "#ffffff";
  const ink = i.dark ? "#f0f6fc" : "#1f2328";
  const phrases = i.tagline
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  const list = phrases.length ? phrases : [i.tagline || "Hello, world"];
  const size = titleSize(i.title, 84);
  const fs = 30;
  const charW = fs * 0.6;
  const slot = 3.6;
  const total = slot * list.length;
  const dots = `<pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="${ink}" opacity="0.08"/></pattern>`;
  const clips: string[] = [];
  const lines = list
    .map((p, k) => {
      const width = p.length * charW;
      const x = 640 - width / 2;
      if (!i.animated) return k === 0 ? `<text x="${x}" y="200" font-family='${MONO}' font-size="${fs}" fill="${i.accent}">${esc(p)}</text>` : "";
      const start = k / list.length;
      const end = (k + 1) / list.length;
      const steps = 12;
      const values: string[] = [];
      const times: string[] = [];
      // Typed in, held, deleted, inside this phrase's slot of the loop.
      for (let s = 0; s <= steps; s++) {
        times.push((start + (end - start) * 0.45 * (s / steps)).toFixed(4));
        values.push(((width * s) / steps).toFixed(1));
      }
      times.push((start + (end - start) * 0.85).toFixed(4));
      values.push(width.toFixed(1));
      times.push((end - 0.0001).toFixed(4));
      values.push("0");
      // Keep times and values as pairs so they stay aligned; times must rise strictly.
      const pairs: [number, string][] = [];
      for (const [t, v] of [[0, "0"] as [number, string], ...times.map((t, j) => [Number(t), values[j]] as [number, string]), [1, "0"] as [number, string]]) {
        if (pairs.length && t <= pairs[pairs.length - 1][0]) pairs[pairs.length - 1] = [pairs[pairs.length - 1][0], v];
        else pairs.push([t, v]);
      }
      const keyTimes = pairs.map(([t]) => t.toFixed(4));
      const vals = pairs.map(([, v]) => v);
      clips.push(
        `<clipPath id="t${k}"><rect x="${x}" y="168" height="44" width="0"><animate attributeName="width" values="${vals.join(";")}" keyTimes="${keyTimes.join(";")}" dur="${total}s" repeatCount="indefinite" calcMode="discrete"/></rect></clipPath>`
      );
      return `<text x="${x}" y="200" font-family='${MONO}' font-size="${fs}" fill="${i.accent}" clip-path="url(#t${k})">${esc(p)}</text>`;
    })
    .join("");
  const defs = dots + clips.join("");
  const body = `<rect width="${W}" height="${H}" fill="${bg}"/><rect width="${W}" height="${H}" fill="url(#dots)"/><text x="640" y="${100 + size * 0.2}" text-anchor="middle" font-family='${i.font}' font-size="${size}" font-weight="800" letter-spacing="-1.5" fill="${ink}">${esc(i.title)}</text>${lines}`;
  return frame(H, i, body, defs);
}

function minimal(i: BannerInput) {
  const H = 300;
  const bg = i.dark ? "#0d1117" : "#ffffff";
  const ink = i.dark ? "#f0f6fc" : "#1f2328";
  const muted = i.dark ? "#9198a1" : "#59636e";
  const letter = [...i.title.trim()][0]?.toUpperCase() ?? "R";
  const size = titleSize(i.title, 64, 900);
  const defs = `<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="${ink}" opacity="0.1"/></pattern><linearGradient id="mark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shift(i.accent, 25)}"/><stop offset="1" stop-color="${i.accent}"/></linearGradient><radialGradient id="fade" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="${bg}" stop-opacity="0"/><stop offset="1" stop-color="${bg}"/></radialGradient>`;
  const body = `<rect width="${W}" height="${H}" fill="${bg}"/><rect width="${W}" height="${H}" fill="url(#dots)"/><rect width="${W}" height="${H}" fill="url(#fade)"/><g>${anim(i, `<animateTransform attributeName="transform" type="translate" values="0 0;0 -6;0 0" dur="4s" repeatCount="indefinite"/>`)}<rect x="596" y="36" width="88" height="88" rx="24" fill="url(#mark)"/><text x="640" y="98" text-anchor="middle" font-family='${i.font}' font-size="52" font-weight="800" fill="#ffffff">${esc(letter)}</text></g><text x="640" y="${190 + size * 0.15}" text-anchor="middle" font-family='${i.font}' font-size="${size}" font-weight="800" letter-spacing="-1" fill="${ink}">${esc(i.title)}</text><text x="640" y="${236 + size * 0.15}" text-anchor="middle" font-family='${SYSTEM}' font-size="22" fill="${muted}">${esc(i.tagline)}</text>`;
  return frame(H, i, body, defs);
}

const STYLES: Record<BannerStyle, (i: BannerInput) => string> = {
  aurora,
  waves,
  terminal,
  swiss,
  grid: gridStyle,
  typing,
  minimal,
};

export const BANNER_STYLES: { id: BannerStyle; label: string }[] = [
  { id: "aurora", label: "Aurora" },
  { id: "waves", label: "Waves" },
  { id: "terminal", label: "Terminal" },
  { id: "typing", label: "Typing" },
  { id: "grid", label: "Synth grid" },
  { id: "swiss", label: "Swiss" },
  { id: "minimal", label: "Minimal" },
];

export const bannerSvg = (style: BannerStyle, input: BannerInput) => STYLES[style](input);

/** A thin rule between sections, with a light travelling along it. */
export function dividerSvg(accent: string, dark: boolean, animated: boolean) {
  const base = dark ? "#30363d" : "#d1d9e0";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 16" width="${W}" height="16"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0"/><stop offset="0.5" stop-color="${accent}"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient></defs><rect y="7" width="${W}" height="2" rx="1" fill="${base}"/><rect x="-400" y="6" width="400" height="4" rx="2" fill="url(#g)">${
    animated ? `<animate attributeName="x" values="-400;${W}" dur="4s" repeatCount="indefinite"/>` : ""
  }</rect></svg>`;
}

/** Layered waves to close the page. */
export function footerSvg(accent: string, dark: boolean, animated: boolean) {
  const H = 120;
  const layer = (y: number, amp: number, period: number, color: string, dur: number) => {
    let d = `M0 ${H}`;
    for (let x = 0; x <= W * 2; x += 20) d += ` L${x} ${y + Math.sin((x / period) * Math.PI * 2) * amp}`;
    d += ` L${W * 2} ${H} Z`;
    return `<path d="${d}" fill="${color}">${animated ? `<animateTransform attributeName="transform" type="translate" values="0 0;${-period * Math.round(W / period)} 0" dur="${dur}s" repeatCount="indefinite"/>` : ""}</path>`;
  };
  const bg = dark ? "#0d1117" : "#ffffff";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${layer(40, 12, 320, mix(accent, bg, 0.65), 14)}${layer(62, 10, 256, mix(accent, bg, 0.35), 10)}${layer(84, 8, 213.3333, accent, 7)}</svg>`;
}
