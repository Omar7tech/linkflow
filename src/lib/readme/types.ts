/**
 * README Studio: a README is a project plus an ordered list of sections
 * ("blocks"). Every block knows how to become GitHub-flavoured markdown.
 */
import type { FontId } from "@/lib/poster/fonts";

export type BannerStyle = "aurora" | "waves" | "terminal" | "swiss" | "grid" | "typing" | "minimal";

export type BadgeKind =
  | "npm-version"
  | "npm-downloads"
  | "bundle"
  | "license"
  | "stars"
  | "forks"
  | "issues"
  | "last-commit"
  | "ci"
  | "prs"
  | "custom";

export interface Badge {
  id: string;
  kind: BadgeKind;
  label?: string;
  message?: string;
  color?: string;
  logo?: string;
}

export type BadgeStyle = "flat" | "flat-square" | "for-the-badge" | "plastic";

export type AlertKind = "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION";

interface Base {
  id: string;
  hidden?: boolean;
  /** Section heading; blocks without a heading leave it empty. */
  title?: string;
}

export type Block = Base &
  (
    | { type: "banner"; style: BannerStyle; tagline: string; font: FontId }
    | { type: "badges"; items: Badge[]; style: BadgeStyle }
    | { type: "intro"; text: string; links: { label: string; url: string }[] }
    | { type: "toc" }
    | { type: "features"; items: { icon: string; title: string; text: string }[]; columns: 2 | 3 }
    | { type: "screenshots"; images: { src: string; alt: string; file?: string }[]; columns: 1 | 2 }
    | { type: "install"; pkg: string; managers: ("npm" | "pnpm" | "yarn" | "bun")[]; extra: string; dev: boolean }
    | { type: "usage"; code: string; lang: string; note: string }
    | { type: "api"; rows: { name: string; type: string; def: string; desc: string }[] }
    | { type: "stack"; icons: string[]; perline: number }
    | { type: "alert"; kind: AlertKind; text: string }
    | { type: "roadmap"; items: { text: string; done: boolean }[] }
    | { type: "faq"; items: { q: string; a: string }[] }
    | { type: "contributing"; text: string; contributors: boolean; starHistory: boolean }
    | { type: "license"; license: string; holder: string }
    | { type: "profile"; username: string; stats: boolean; streak: boolean; langs: boolean }
    | { type: "custom"; markdown: string }
    | { type: "footer"; text: string; wave: boolean; backToTop: boolean }
  );

export type BlockType = Block["type"];

export interface Project {
  name: string;
  owner: string;
  repo: string;
  description: string;
  accent: string;
  animated: boolean;
  dividers: boolean;
  emoji: boolean;
  blocks: Block[];
}

export const BLOCK_INFO: Record<BlockType, { label: string; heading: string; emoji: string; hint: string }> = {
  banner: { label: "Banner", heading: "", emoji: "", hint: "Animated header image, light and dark" },
  badges: { label: "Badges", heading: "", emoji: "", hint: "Version, license, stars, CI…" },
  intro: { label: "Intro", heading: "", emoji: "", hint: "What it is, in a sentence or two" },
  toc: { label: "Table of contents", heading: "Table of contents", emoji: "🧭", hint: "Links to every section" },
  features: { label: "Features", heading: "Features", emoji: "✨", hint: "A grid of what it does" },
  screenshots: { label: "Screenshots", heading: "Screenshots", emoji: "🖼️", hint: "Show it off" },
  install: { label: "Install", heading: "Getting started", emoji: "🚀", hint: "npm, pnpm, yarn, bun" },
  usage: { label: "Usage", heading: "Usage", emoji: "🧑‍💻", hint: "A code example" },
  api: { label: "API table", heading: "API", emoji: "📚", hint: "Options or props" },
  stack: { label: "Tech stack", heading: "Built with", emoji: "🛠️", hint: "Logos of what you use" },
  alert: { label: "Callout", heading: "", emoji: "", hint: "GitHub note, tip or warning" },
  roadmap: { label: "Roadmap", heading: "Roadmap", emoji: "🗺️", hint: "Checklist of what's next" },
  faq: { label: "FAQ", heading: "FAQ", emoji: "💬", hint: "Collapsible questions" },
  contributing: { label: "Contributing", heading: "Contributing", emoji: "🤝", hint: "Contributors wall, star history" },
  license: { label: "License", heading: "License", emoji: "📄", hint: "MIT, Apache…" },
  profile: { label: "Profile stats", heading: "GitHub stats", emoji: "📈", hint: "For profile READMEs" },
  custom: { label: "Custom markdown", heading: "", emoji: "", hint: "Anything else" },
  footer: { label: "Footer", heading: "", emoji: "", hint: "Sign-off, wave, back to top" },
};

let counter = 0;
export const uid = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;
