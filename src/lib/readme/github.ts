/**
 * Reads a public GitHub repository (no sign-in) and drafts a README from
 * what is actually in it: description, topics, license, homepage, the
 * package.json (name, binaries, scripts, dependencies) and its CI workflow.
 */
import { fromTemplate, newBlock, type TemplateId } from "./templates";
import { uid, type Badge, type Project } from "./types";

/** npm dependency → skillicons.dev id. */
const STACK: Record<string, string> = {
  react: "react",
  next: "nextjs",
  vue: "vue",
  nuxt: "nuxtjs",
  svelte: "svelte",
  "@sveltejs/kit": "svelte",
  "solid-js": "solidjs",
  "@angular/core": "angular",
  astro: "astro",
  "@remix-run/react": "remix",
  gatsby: "gatsby",
  typescript: "ts",
  tailwindcss: "tailwind",
  vite: "vite",
  webpack: "webpack",
  express: "express",
  "@nestjs/core": "nestjs",
  prisma: "prisma",
  "@prisma/client": "prisma",
  three: "threejs",
  redux: "redux",
  "@reduxjs/toolkit": "redux",
  graphql: "graphql",
  mongoose: "mongodb",
  mongodb: "mongodb",
  pg: "postgres",
  mysql2: "mysql",
  redis: "redis",
  ioredis: "redis",
  jest: "jest",
  sass: "sass",
  electron: "electron",
  firebase: "firebase",
  "@supabase/supabase-js": "supabase",
  "@tauri-apps/api": "tauri",
  jquery: "jquery",
  bootstrap: "bootstrap",
  "@mui/material": "materialui",
  "styled-components": "styledcomponents",
  "react-native": "react",
  expo: "react",
};

const LANGUAGE: Record<string, string> = {
  TypeScript: "ts",
  JavaScript: "js",
  Python: "py",
  Go: "go",
  Rust: "rust",
  Java: "java",
  Kotlin: "kotlin",
  Swift: "swift",
  "C++": "cpp",
  C: "c",
  "C#": "cs",
  PHP: "php",
  Ruby: "ruby",
  Dart: "dart",
  HTML: "html",
  CSS: "css",
  Shell: "bash",
};

export function parseRepo(input: string): { owner: string; repo: string } | null {
  const m = input.trim().match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

interface RepoInfo {
  name: string;
  description: string | null;
  topics?: string[];
  license?: { spdx_id?: string } | null;
  homepage?: string | null;
  language?: string | null;
  default_branch: string;
  owner: { login: string; type: string };
}

export async function importRepo(input: string, accent: string, current: Project): Promise<Project> {
  const parsed = parseRepo(input);
  if (!parsed) throw new Error("Use owner/repo or a GitHub URL.");
  const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`);
  if (res.status === 404) throw new Error("That repository wasn't found, or it's private.");
  if (res.status === 403) throw new Error("GitHub's hourly limit for anonymous requests was hit. Try again in a bit.");
  if (!res.ok) throw new Error("GitHub didn't answer. Try again.");
  const repo = (await res.json()) as RepoInfo;

  const raw = (path: string) =>
    fetch(`https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${repo.default_branch}/${path}`).then((r) => (r.ok ? r.text() : null), () => null);
  const [pkgText, workflows] = await Promise.all([
    raw("package.json"),
    fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/.github/workflows`).then(
      (r) => (r.ok ? (r.json() as Promise<{ name: string }[]>) : []),
      () => []
    ),
  ]);
  let pkg: { name?: string; description?: string; private?: boolean; bin?: unknown; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> } | null = null;
  try {
    pkg = pkgText ? JSON.parse(pkgText) : null;
  } catch {
    pkg = null;
  }

  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const isProfile = parsed.owner.toLowerCase() === parsed.repo.toLowerCase();
  const isCli = !!pkg?.bin;
  const isApp = !isCli && ("next" in deps || "vite" in deps || "react-scripts" in deps || "nuxt" in deps || "astro" in deps || "@sveltejs/kit" in deps);
  const template: TemplateId = isProfile ? "profile" : isCli ? "cli" : isApp ? "app" : "library";

  const prettyName = isProfile ? parsed.owner : repo.name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const description = repo.description || pkg?.description || current.description;
  const base = { name: prettyName, owner: parsed.owner, repo: parsed.repo, description };
  const blocks = fromTemplate(template, base);
  const npmName = pkg?.name && !pkg.private ? pkg.name : null;
  const published = !!npmName && !isApp;

  // Fill each section with what the repo tells us.
  for (const b of blocks) {
    if (b.type === "banner" && !isProfile) b.tagline = description;
    if (b.type === "intro") {
      b.text = isProfile ? b.text : description;
      if (!isProfile) b.links = [repo.homepage ? { label: "Live demo", url: repo.homepage } : null, { label: "Report a bug", url: `https://github.com/${parsed.owner}/${parsed.repo}/issues` }].filter(Boolean) as { label: string; url: string }[];
    }
    if (b.type === "badges") {
      const items: Badge[] = [];
      if (published) items.push({ id: uid(), kind: "npm-version" }, { id: uid(), kind: "npm-downloads" });
      if (workflows.length) items.push({ id: uid(), kind: "ci", message: workflows[0].name });
      if (repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION") items.push({ id: uid(), kind: "license" });
      items.push({ id: uid(), kind: "stars" }, { id: uid(), kind: "last-commit" });
      if (published) items.push({ id: uid(), kind: "bundle" });
      b.items = items.slice(0, 6);
    }
    if (b.type === "install") {
      b.pkg = npmName ?? parsed.repo;
      if (!published) {
        b.managers = [];
        const dev = pkg?.scripts?.dev ? "npm run dev" : pkg?.scripts?.start ? "npm start" : "";
        b.extra = `git clone https://github.com/${parsed.owner}/${parsed.repo}.git\ncd ${parsed.repo}\nnpm install${dev ? `\n${dev}` : ""}`;
      }
    }
    if (b.type === "usage" && npmName && template === "library") b.code = b.code.replace(/from "[^"]+"/, `from "${npmName}"`);
    if (b.type === "stack") {
      const icons = new Set<string>();
      if (repo.language && LANGUAGE[repo.language]) icons.add(LANGUAGE[repo.language]);
      for (const dep of Object.keys(deps)) if (STACK[dep]) icons.add(STACK[dep]);
      if (pkg) icons.add("nodejs");
      if (icons.size) b.icons = [...icons].slice(0, 14);
    }
    if (b.type === "license") {
      b.license = repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : "MIT";
      b.holder = parsed.owner;
    }
    if (b.type === "profile") b.username = parsed.owner;
    if (b.type === "footer") b.text = `Made with care by <a href="https://github.com/${parsed.owner}">@${parsed.owner}</a>`;
  }
  // Topics become a feature list starting point when there's no better source.
  const features = blocks.find((b) => b.type === "features");
  if (features && features.type === "features" && repo.topics?.length) {
    features.items = repo.topics.slice(0, 6).map((t) => ({ icon: "✦", title: t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), text: "Describe what this means for your users." }));
  }
  // A web app benefits from a stack section even if the template had none.
  if (template !== "profile" && !blocks.some((b) => b.type === "stack") && Object.keys(deps).some((d) => STACK[d])) {
    const stack = newBlock("stack", base);
    if (stack.type === "stack") stack.icons = [...new Set(Object.keys(deps).map((d) => STACK[d]).filter(Boolean))].slice(0, 12);
    blocks.splice(Math.max(1, blocks.findIndex((b) => b.type === "install")), 0, stack);
  }

  return { ...current, ...base, accent, blocks };
}
