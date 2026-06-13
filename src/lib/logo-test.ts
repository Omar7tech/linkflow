/**
 * Logo visibility analysis — pure, on-device. Given the pixels of a logo it
 * measures the things that actually decide whether a mark works in the wild:
 * does it survive on light AND dark backgrounds, does it stay legible when
 * tiny, does it have breathing room, is it transparent, and is it restrained
 * in color. Returns graded metrics plus plain-English, actionable findings.
 *
 * Pixel data comes from a downscaled canvas (≤ ~256px) so this stays fast.
 */

import { extractPalette, luminance, rgbToHex, type RGB, type Swatch } from "./colorExtract";

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface Metric {
  key: string;
  label: string;
  score: number;
  grade: Grade;
  detail: string;
}

export interface Finding {
  level: "good" | "warn" | "bad";
  title: string;
  detail: string;
}

export interface LogoReport {
  width: number;
  height: number;
  aspect: number;
  hasAlpha: boolean;
  transparentBg: boolean;
  bgHex: string | null;
  /** Empty margin around the mark, as % of the smaller canvas side. */
  paddingPct: number;
  touchesEdge: boolean;
  /** Best contrast a part of the mark reaches on white / black (1–21). */
  contrastOnWhite: number;
  contrastOnBlack: number;
  safeOnLight: boolean;
  safeOnDark: boolean;
  palette: Swatch[];
  colorCount: number;
  /** 0 (flat) – 100 (busy). */
  complexity: number;
  /** Recommended minimum render size in px. */
  minLegibleSize: number;
  metrics: Metric[];
  findings: Finding[];
  score: number;
  grade: Grade;
}

const cr = (l1: number, l2: number) => {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
};

function scoreToGrade(s: number): Grade {
  if (s >= 90) return "A";
  if (s >= 75) return "B";
  if (s >= 60) return "C";
  if (s >= 45) return "D";
  return "F";
}

const dist = (a: RGB, b: RGB) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

export function analyzeLogo(img: ImageData, naturalW: number, naturalH: number): LogoReport {
  const { data, width: w, height: h } = img;
  const px = (x: number, y: number) => (y * w + x) * 4;

  // --- Background: transparent, or a solid color read from the corners? ---
  let alphaMin = 255;
  for (let i = 3; i < data.length; i += 4) if (data[i] < alphaMin) alphaMin = data[i];
  const hasAlpha = alphaMin < 245;

  const corners: [number, number][] = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  let cAlpha = 0;
  const cSum: RGB = [0, 0, 0];
  for (const [cx, cy] of corners) {
    const i = px(cx, cy);
    cAlpha += data[i + 3];
    cSum[0] += data[i];
    cSum[1] += data[i + 1];
    cSum[2] += data[i + 2];
  }
  cAlpha /= 4;
  const bgColor: RGB = [Math.round(cSum[0] / 4), Math.round(cSum[1] / 4), Math.round(cSum[2] / 4)];
  const transparentBg = hasAlpha && cAlpha < 30;
  const bgHex = transparentBg ? null : rgbToHex(bgColor);

  // --- Single pass: content mask, bounding box, luminance histogram ---
  const isContent = (i: number): boolean => {
    const a = data[i + 3];
    if (transparentBg) return a > 60;
    if (a < 60) return false;
    return dist([data[i], data[i + 1], data[i + 2]], bgColor) > 48;
  };

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  const lumHist = new Array(101).fill(0);
  const contentRgba: number[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = px(x, y);
      if (!isContent(i)) continue;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const rgb: RGB = [data[i], data[i + 1], data[i + 2]];
      lumHist[Math.round(luminance(rgb) * 100)]++;
      contentRgba.push(rgb[0], rgb[1], rgb[2], 255);
    }
  }

  // Degenerate input — no detectable mark.
  if (count < 8) {
    return emptyReport(naturalW, naturalH, hasAlpha, transparentBg, bgHex);
  }

  const percentile = (p: number) => {
    const target = p * count;
    let acc = 0;
    for (let b = 0; b <= 100; b++) {
      acc += lumHist[b];
      if (acc >= target) return b / 100;
    }
    return 1;
  };
  const pLow = percentile(0.05);
  const pHigh = percentile(0.95);

  const contrastOnWhite = cr(1, pLow); // darkest ink vs white
  const contrastOnBlack = cr(pHigh, 0); // lightest ink vs black
  const safeOnLight = contrastOnWhite >= 3;
  const safeOnDark = contrastOnBlack >= 3;

  // --- Geometry: padding + edge bleed ---
  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  const marginPx = Math.min(minX, minY, w - 1 - maxX, h - 1 - maxY);
  const paddingPct = (marginPx / Math.min(w, h)) * 100;
  const touchesEdge = marginPx <= 0;

  // --- Palette + color restraint ---
  const palette = extractPalette(new Uint8ClampedArray(contentRgba), 8);
  const colorCount = palette.filter((s) => s.population > 0.04).length || 1;

  // --- Complexity / edge density inside the content box ---
  const lumAt = (x: number, y: number) => luminance([data[px(x, y)], data[px(x, y) + 1], data[px(x, y) + 2]]);
  let edges = 0;
  let total = 0;
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      total++;
      const d = Math.abs(lumAt(x, y) - lumAt(x + 1, y)) + Math.abs(lumAt(x, y) - lumAt(x, y + 1));
      if (d > 0.18) edges++;
    }
  }
  const edgeFraction = total ? edges / total : 0;
  const complexity = Math.round(Math.min(100, edgeFraction * 400));

  const minLegibleSize = snapSize(16 + (complexity / 100) * 80);

  const aspect = naturalW / naturalH;
  const contentAspect = contentW / contentH;

  /* --------------------------------- Metrics -------------------------------- */
  const metrics: Metric[] = [];

  const adaptScore =
    safeOnLight && safeOnDark
      ? contrastOnWhite >= 4.5 && contrastOnBlack >= 4.5
        ? 100
        : 85
      : safeOnLight || safeOnDark
        ? 58
        : 28;
  metrics.push({
    key: "adapt",
    label: "Light / dark adaptability",
    score: adaptScore,
    grade: scoreToGrade(adaptScore),
    detail:
      safeOnLight && safeOnDark
        ? "Reads clearly on both light and dark backgrounds."
        : safeOnLight
          ? "Works on light backgrounds but fades on dark ones."
          : safeOnDark
            ? "Works on dark backgrounds but fades on light ones."
            : "Low contrast on both — sits in a mid tone that struggles everywhere.",
  });

  const scaleScore = Math.max(10, 100 - complexity);
  metrics.push({
    key: "scale",
    label: "Scalability",
    score: scaleScore,
    grade: scoreToGrade(scaleScore),
    detail: `Stays legible down to about ${minLegibleSize}px. ${
      complexity > 60 ? "Lots of fine detail to lose when small." : "Clean enough for tiny sizes."
    }`,
  });

  const clearScore =
    paddingPct < 2 ? 42 : paddingPct < 6 ? 72 : paddingPct <= 26 ? 100 : paddingPct <= 40 ? 82 : 62;
  metrics.push({
    key: "clear",
    label: "Clear space",
    score: clearScore,
    grade: scoreToGrade(clearScore),
    detail: touchesEdge
      ? "The mark touches the edge — it'll be clipped in circular avatars."
      : `~${Math.round(paddingPct)}% padding around the mark.`,
  });

  const transScore = transparentBg ? 100 : hasAlpha ? 78 : 52;
  metrics.push({
    key: "trans",
    label: "Versatility",
    score: transScore,
    grade: scoreToGrade(transScore),
    detail: transparentBg
      ? "Transparent background — drops onto any color."
      : `Baked-in ${bgHex ?? "solid"} background — locked to one surface.`,
  });

  const colorScore = colorCount <= 3 ? 100 : colorCount <= 5 ? 80 : colorCount <= 7 ? 60 : 42;
  metrics.push({
    key: "color",
    label: "Color restraint",
    score: colorScore,
    grade: scoreToGrade(colorScore),
    detail: `${colorCount} dominant color${colorCount === 1 ? "" : "s"}. ${
      colorCount > 5 ? "Hard to reproduce in print, embroidery or one ink." : "Reproduces cleanly anywhere."
    }`,
  });

  const score = Math.round(
    adaptScore * 0.28 + scaleScore * 0.26 + clearScore * 0.16 + transScore * 0.15 + colorScore * 0.15
  );

  /* -------------------------------- Findings -------------------------------- */
  const findings: Finding[] = [];
  if (!safeOnLight && !safeOnDark)
    findings.push({
      level: "bad",
      title: "Low contrast everywhere",
      detail: "The mark sits in a mid tone. Add a darker or lighter version so it reads on real backgrounds.",
    });
  else if (!safeOnDark)
    findings.push({
      level: "warn",
      title: "Disappears on dark backgrounds",
      detail: "Ship a light/white variant for dark UIs, footers and merch.",
    });
  else if (!safeOnLight)
    findings.push({
      level: "warn",
      title: "Disappears on light backgrounds",
      detail: "Provide a dark variant for white pages and print.",
    });
  else
    findings.push({
      level: "good",
      title: "Adapts to light and dark",
      detail: "Strong contrast on both — versatile across surfaces.",
    });

  if (!transparentBg)
    findings.push({
      level: hasAlpha ? "warn" : "bad",
      title: hasAlpha ? "Partly opaque background" : "Solid background baked in",
      detail: "Re-export as a transparent PNG or SVG so the logo sits on any color.",
    });

  if (touchesEdge)
    findings.push({
      level: "warn",
      title: "No clear space",
      detail: "The mark runs to the edge and will be cropped in circular avatars. Add ~10% padding.",
    });

  if (complexity > 60)
    findings.push({
      level: "warn",
      title: "Too detailed for small sizes",
      detail: `Fine elements blur out below ~${minLegibleSize}px. Consider a simplified favicon glyph.`,
    });
  else
    findings.push({
      level: "good",
      title: "Scales down cleanly",
      detail: `Holds up to roughly ${minLegibleSize}px — fine for favicons and app icons.`,
    });

  if (colorCount > 5)
    findings.push({
      level: "warn",
      title: `${colorCount} colors`,
      detail: "A one- or two-color version will reproduce better in print and embroidery.",
    });

  if (Math.abs(aspect - 1) > 1.5 || Math.abs(contentAspect - 1) > 2.2)
    findings.push({
      level: "warn",
      title: "Very wide or tall",
      detail: "Square contexts (favicon, app icon, avatar) will leave big gaps. A stacked or icon-only lockup helps.",
    });

  return {
    width: naturalW,
    height: naturalH,
    aspect,
    hasAlpha,
    transparentBg,
    bgHex,
    paddingPct,
    touchesEdge,
    contrastOnWhite,
    contrastOnBlack,
    safeOnLight,
    safeOnDark,
    palette: palette.slice(0, 6),
    colorCount,
    complexity,
    minLegibleSize,
    metrics,
    findings,
    score,
    grade: scoreToGrade(score),
  };
}

function snapSize(n: number): number {
  const steps = [16, 24, 32, 48, 64, 96];
  return steps.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best), steps[0]);
}

function emptyReport(
  w: number,
  h: number,
  hasAlpha: boolean,
  transparentBg: boolean,
  bgHex: string | null
): LogoReport {
  return {
    width: w,
    height: h,
    aspect: w / h,
    hasAlpha,
    transparentBg,
    bgHex,
    paddingPct: 0,
    touchesEdge: false,
    contrastOnWhite: 1,
    contrastOnBlack: 1,
    safeOnLight: false,
    safeOnDark: false,
    palette: [],
    colorCount: 0,
    complexity: 0,
    minLegibleSize: 16,
    metrics: [],
    findings: [
      {
        level: "bad",
        title: "Couldn't read a logo",
        detail: "The image looks empty or fully transparent. Try a PNG or SVG with the mark visible.",
      },
    ],
    score: 0,
    grade: "F",
  };
}

/** Plain-text report for the copy/share button. */
export function reportToText(r: LogoReport): string {
  const lines = [
    `Logo Visibility Report`,
    `Overall: ${r.score}/100 (${r.grade})`,
    ``,
    `Dimensions: ${r.width}×${r.height} (${r.aspect.toFixed(2)}:1)`,
    `Background: ${r.transparentBg ? "transparent" : (r.bgHex ?? "solid")}`,
    `Dominant colors: ${r.colorCount}`,
    `Min legible size: ~${r.minLegibleSize}px`,
    `Contrast on white: ${r.contrastOnWhite.toFixed(1)}:1 · on black: ${r.contrastOnBlack.toFixed(1)}:1`,
    ``,
    `Scores:`,
    ...r.metrics.map((m) => `  • ${m.label}: ${m.score}/100 (${m.grade}) — ${m.detail}`),
    ``,
    `Findings:`,
    ...r.findings.map((f) => `  [${f.level.toUpperCase()}] ${f.title} — ${f.detail}`),
  ];
  return lines.join("\n");
}
