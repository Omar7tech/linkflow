export const SITE = {
  name: "Forma",
  tagline: "Form follows function.",
  description:
    "A free, private studio of everyday tools for developers and designers. Generators, converters and visual editors — everything runs in your browser; nothing is ever uploaded.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://forma.tools",
  author: "Forma",
  twitter: "@formatools",
} as const;

export const STORAGE_KEYS = {
  history: (toolId: string) => `forma:history:${toolId}`,
  presets: (toolId: string) => `forma:presets:${toolId}`,
} as const;

export const HISTORY_LIMIT = 10;
