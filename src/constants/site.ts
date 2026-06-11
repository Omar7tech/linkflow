export const SITE = {
  name: "LinkFlow",
  tagline: "Create, Share, Connect.",
  description:
    "Free client-side toolkit for WhatsApp links, QR codes, share links, vCards, UTM campaign URLs and more. No sign-up, no server — everything runs in your browser.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://linkflow.app",
  author: "LinkFlow",
  twitter: "@linkflow",
} as const;

export const STORAGE_KEYS = {
  history: (toolId: string) => `linkflow:history:${toolId}`,
  presets: (toolId: string) => `linkflow:presets:${toolId}`,
} as const;

export const HISTORY_LIMIT = 10;
