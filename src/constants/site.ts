export const SITE = {
  name: "Forma",
  tagline: "Form follows function.",
  description:
    "A free studio of everyday tools for developers and designers. Generators, converters and visual editors that take you from idea to finished asset in seconds.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://linkflow-pi.vercel.app",
  author: "Forma",
  twitter: "@formatools",
} as const;

export const STORAGE_KEYS = {
  history: (toolId: string) => `forma:history:${toolId}`,
  presets: (toolId: string) => `forma:presets:${toolId}`,
  favorites: "forma:favorites",
} as const;

export const HISTORY_LIMIT = 10;
