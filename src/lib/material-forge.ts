export type MaterialShape = "slab" | "orb" | "button";

export interface MaterialConfig {
  name: string;
  base: string;
  accent: string;
  roughness: number;
  metallic: number;
  transmission: number;
  refraction: number;
  iridescence: number;
  grain: number;
  glow: number;
  depth: number;
  radius: number;
  lightAngle: number;
  lightIntensity: number;
  reactive: boolean;
  animate: boolean;
}

export interface MaterialPreset {
  id: string;
  name: string;
  family: string;
  config: MaterialConfig;
}

export const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: "verdant-chrome",
    name: "Verdant chrome",
    family: "polished alloy",
    config: {
      name: "Verdant chrome",
      base: "#071f18",
      accent: "#64f5ad",
      roughness: 12,
      metallic: 92,
      transmission: 10,
      refraction: 42,
      iridescence: 58,
      grain: 5,
      glow: 32,
      depth: 44,
      radius: 28,
      lightAngle: 128,
      lightIntensity: 86,
      reactive: true,
      animate: true,
    },
  },
  {
    id: "polar-glass",
    name: "Polar glass",
    family: "frozen crystal",
    config: {
      name: "Polar glass",
      base: "#b9e8ff",
      accent: "#f8fdff",
      roughness: 24,
      metallic: 8,
      transmission: 78,
      refraction: 82,
      iridescence: 26,
      grain: 18,
      glow: 48,
      depth: 34,
      radius: 34,
      lightAngle: 145,
      lightIntensity: 76,
      reactive: true,
      animate: false,
    },
  },
  {
    id: "solar-ceramic",
    name: "Solar ceramic",
    family: "glazed mineral",
    config: {
      name: "Solar ceramic",
      base: "#ff6b35",
      accent: "#ffd58a",
      roughness: 48,
      metallic: 2,
      transmission: 4,
      refraction: 18,
      iridescence: 8,
      grain: 22,
      glow: 34,
      depth: 28,
      radius: 42,
      lightAngle: 116,
      lightIntensity: 82,
      reactive: true,
      animate: false,
    },
  },
  {
    id: "petrol-film",
    name: "Petrol film",
    family: "thin-film prism",
    config: {
      name: "Petrol film",
      base: "#10112d",
      accent: "#6df7d7",
      roughness: 18,
      metallic: 66,
      transmission: 22,
      refraction: 64,
      iridescence: 96,
      grain: 9,
      glow: 62,
      depth: 40,
      radius: 24,
      lightAngle: 210,
      lightIntensity: 92,
      reactive: true,
      animate: true,
    },
  },
  {
    id: "ember-velvet",
    name: "Ember velvet",
    family: "soft fibre",
    config: {
      name: "Ember velvet",
      base: "#3a0717",
      accent: "#ff416c",
      roughness: 88,
      metallic: 0,
      transmission: 0,
      refraction: 8,
      iridescence: 14,
      grain: 72,
      glow: 28,
      depth: 24,
      radius: 36,
      lightAngle: 158,
      lightIntensity: 64,
      reactive: true,
      animate: false,
    },
  },
  {
    id: "lunar-pearl",
    name: "Lunar pearl",
    family: "organic nacre",
    config: {
      name: "Lunar pearl",
      base: "#d7d0ea",
      accent: "#fff4dc",
      roughness: 32,
      metallic: 18,
      transmission: 18,
      refraction: 54,
      iridescence: 74,
      grain: 16,
      glow: 38,
      depth: 30,
      radius: 48,
      lightAngle: 132,
      lightIntensity: 74,
      reactive: true,
      animate: true,
    },
  },
];

export const DEFAULT_MATERIAL = MATERIAL_PRESETS[0].config;

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((v) => v + v).join("") : value;
  const parsed = Number.parseInt(normalized, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

export function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function materialStyle(config: MaterialConfig) {
  const contrast = 1.02 + config.metallic * 0.006;
  const saturation = 1 + config.iridescence * 0.008;
  const surfaceAlpha = Math.max(0.2, 1 - config.transmission / 125);
  const highlight = config.lightIntensity / 100;

  return {
    background: [
      `radial-gradient(circle at var(--light-x, 34%) var(--light-y, 24%), rgba(255,255,255,${(highlight * 0.9).toFixed(2)}) 0%, rgba(255,255,255,${(highlight * 0.18).toFixed(2)}) 15%, transparent 38%)`,
      `linear-gradient(${config.lightAngle}deg, ${rgba(config.accent, 0.95)} 0%, ${rgba(config.base, surfaceAlpha)} 34%, ${rgba(config.accent, 0.48)} 57%, ${rgba(config.base, 0.96)} 100%)`,
    ].join(", "),
    borderRadius: `${config.radius}px`,
    border: `1px solid rgba(255,255,255,${(0.18 + config.refraction / 180).toFixed(2)})`,
    boxShadow: [
      `0 ${Math.round(config.depth * 0.7)}px ${Math.round(24 + config.depth * 1.2)}px rgba(0,0,0,${(0.18 + config.depth / 240).toFixed(2)})`,
      `0 0 ${Math.round(config.glow * 0.8)}px ${rgba(config.accent, config.glow / 250)}`,
      `inset 0 1px 1px rgba(255,255,255,${(0.2 + config.refraction / 150).toFixed(2)})`,
      `inset 0 -${Math.max(1, Math.round(config.depth / 7))}px ${Math.max(8, Math.round(config.depth / 2))}px ${rgba(config.base, 0.42)}`,
    ].join(", "),
    backdropFilter: `blur(${(config.transmission / 5).toFixed(1)}px) saturate(${(1 + config.refraction / 100).toFixed(2)})`,
    WebkitBackdropFilter: `blur(${(config.transmission / 5).toFixed(1)}px) saturate(${(1 + config.refraction / 100).toFixed(2)})`,
    filter: `contrast(${contrast.toFixed(2)}) saturate(${saturation.toFixed(2)})`,
    "--material-accent": config.accent,
    "--material-base": config.base,
    "--material-iris": `${config.iridescence / 100}`,
    "--material-grain": `${config.grain / 100}`,
    "--material-refraction": `${config.refraction / 100}`,
  } as const;
}

export function buildMaterialCss(config: MaterialConfig) {
  const style = materialStyle(config);
  return `.material {
  --light-x: 34%;
  --light-y: 24%;
  --material-base: ${config.base};
  --material-accent: ${config.accent};
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-radius: ${style.borderRadius};
  border: ${style.border};
  background:
    radial-gradient(circle at var(--light-x) var(--light-y), rgba(255,255,255,${(config.lightIntensity / 112).toFixed(2)}) 0%, rgba(255,255,255,${(config.lightIntensity / 550).toFixed(2)}) 15%, transparent 38%),
    linear-gradient(${config.lightAngle}deg, ${rgba(config.accent, 0.95)} 0%, ${rgba(config.base, Math.max(0.2, 1 - config.transmission / 125))} 34%, ${rgba(config.accent, 0.48)} 57%, ${rgba(config.base, 0.96)} 100%);
  box-shadow: ${style.boxShadow};
  backdrop-filter: blur(${(config.transmission / 5).toFixed(1)}px) saturate(${(1 + config.refraction / 100).toFixed(2)});
}

.material::before {
  content: "";
  position: absolute;
  inset: -35%;
  z-index: -1;
  opacity: ${(config.iridescence / 100).toFixed(2)};
  background: conic-gradient(from 30deg, transparent, #ff4fd8, #5de7ff, #8dff7a, #ffe66d, transparent 72%);
  mix-blend-mode: color-dodge;
  transform: translate(calc((var(--light-x) - 50%) * .25), calc((var(--light-y) - 50%) * .25));
  filter: blur(${Math.round(8 + config.roughness / 4)}px);
}

.material::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: ${(config.grain / 230).toFixed(2)};
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.8'/%3E%3C/svg%3E");
  mix-blend-mode: soft-light;
}`;
}

export function mutateMaterial(source: MaterialConfig): MaterialConfig {
  const jitter = (value: number, amount: number) =>
    Math.max(0, Math.min(100, Math.round(value + (Math.random() - 0.5) * amount)));
  const darkBodies = ["#081c18", "#15112b", "#29101b", "#0b1930", "#27200d", "#181818"];
  const spectralAccents = ["#5ef2b6", "#75ddff", "#ff6cc4", "#ffb35c", "#a98bff", "#e9ff70"];

  return {
    ...source,
    name: "Uncatalogued specimen",
    base: darkBodies[Math.floor(Math.random() * darkBodies.length)],
    accent: spectralAccents[Math.floor(Math.random() * spectralAccents.length)],
    roughness: jitter(source.roughness, 42),
    metallic: jitter(source.metallic, 38),
    transmission: jitter(source.transmission, 34),
    refraction: jitter(source.refraction, 40),
    iridescence: jitter(source.iridescence, 54),
    grain: jitter(source.grain, 36),
    glow: jitter(source.glow, 42),
    depth: jitter(source.depth, 28),
    radius: Math.max(10, Math.min(64, jitter(source.radius, 30))),
    lightAngle: Math.floor(Math.random() * 360),
  };
}
