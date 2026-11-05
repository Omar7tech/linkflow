/**
 * Project → README.md and the asset files it references.
 *
 * Everything is written the way GitHub renders best: centred hero blocks in
 * HTML, <picture> so banners and charts follow the reader's light or dark
 * theme, <details> for long content, GitHub alerts, task lists and tables.
 */
import { FONT_BY_ID } from "@/lib/poster/fonts";
import { bannerSvg, dividerSvg, footerSvg } from "./banners";
import { BLOCK_INFO, type Badge, type BadgeStyle, type Block, type Project } from "./types";

export interface Output {
  markdown: string;
  /** Relative path → file contents (SVG text or a data: URL for uploads). */
  assets: Record<string, string>;
}

/** GitHub's heading anchor: lowercase, punctuation dropped, spaces to hyphens. */
export function slug(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

const enc = encodeURIComponent;
/** Shields.io escapes: dashes and underscores are doubled in static badges. */
const shieldText = (s: string) => enc(s.replace(/-/g, "--").replace(/_/g, "__"));

function badgeUrl(b: Badge, p: Project, style: BadgeStyle) {
  const repo = `${p.owner}/${p.repo}`;
  const pkg = p.blocks.find((x) => x.type === "install");
  const npm = pkg && pkg.type === "install" ? pkg.pkg : p.name.toLowerCase();
  const color = (b.color || p.accent).replace("#", "");
  const q = `?style=${style}&color=${color}${b.logo ? `&logo=${enc(b.logo)}&logoColor=white` : ""}`;
  switch (b.kind) {
    case "npm-version":
      return { img: `https://img.shields.io/npm/v/${npm}${q}`, href: `https://www.npmjs.com/package/${npm}`, alt: "npm version" };
    case "npm-downloads":
      return { img: `https://img.shields.io/npm/dm/${npm}${q}`, href: `https://www.npmjs.com/package/${npm}`, alt: "npm downloads" };
    case "bundle":
      return { img: `https://img.shields.io/bundlephobia/minzip/${npm}${q}`, href: `https://bundlephobia.com/package/${npm}`, alt: "bundle size" };
    case "license":
      return { img: `https://img.shields.io/github/license/${repo}${q}`, href: `https://github.com/${repo}/blob/main/LICENSE`, alt: "license" };
    case "stars":
      return { img: `https://img.shields.io/github/stars/${repo}${q}`, href: `https://github.com/${repo}/stargazers`, alt: "GitHub stars" };
    case "forks":
      return { img: `https://img.shields.io/github/forks/${repo}${q}`, href: `https://github.com/${repo}/network/members`, alt: "forks" };
    case "issues":
      return { img: `https://img.shields.io/github/issues/${repo}${q}`, href: `https://github.com/${repo}/issues`, alt: "open issues" };
    case "last-commit":
      return { img: `https://img.shields.io/github/last-commit/${repo}${q}`, href: `https://github.com/${repo}/commits`, alt: "last commit" };
    case "ci":
      return {
        img: `https://img.shields.io/github/actions/workflow/status/${repo}/${b.message || "ci.yml"}${q}&label=${shieldText(b.label || "build")}`,
        href: `https://github.com/${repo}/actions`,
        alt: "build status",
      };
    case "prs":
      return { img: `https://img.shields.io/badge/PRs-welcome-${color}${q.replace(`&color=${color}`, "")}`, href: `https://github.com/${repo}/pulls`, alt: "PRs welcome" };
    case "custom":
      return {
        img: `https://img.shields.io/badge/${shieldText(b.label || "label")}-${shieldText(b.message || "message")}-${color}${q.replace(`&color=${color}`, "")}`,
        href: "",
        alt: `${b.label}: ${b.message}`,
      };
  }
}

const picture = (light: string, dark: string, alt: string, width?: string) =>
  `<picture>\n    <source media="(prefers-color-scheme: dark)" srcset="${dark}">\n    <img src="${light}" alt="${alt}"${width ? ` width="${width}"` : ""}>\n  </picture>`;

export interface GenerateOptions {
  /** Embedded @font-face rules per font id, once loaded. */
  fontCss: Record<string, string>;
  /** Preview only: an HTML comment before each section so it can be picked. */
  markers?: boolean;
}

export function generate(p: Project, opts: GenerateOptions): Output {
  const assets: Record<string, string> = {};
  const out: string[] = ['<a id="readme-top"></a>', ""];
  const blocks = p.blocks.filter((b) => !b.hidden);
  const heading = (b: Block) => {
    const text = b.title?.trim();
    if (!text) return "";
    const emoji = p.emoji && BLOCK_INFO[b.type].emoji && b.title === BLOCK_INFO[b.type].heading ? `${BLOCK_INFO[b.type].emoji} ` : "";
    return `## ${emoji}${text}\n\n`;
  };
  const headed = blocks.filter((b) => b.title?.trim() && b.type !== "toc");

  if (p.dividers) {
    assets["assets/divider-light.svg"] = dividerSvg(p.accent, false, p.animated);
    assets["assets/divider-dark.svg"] = dividerSvg(p.accent, true, p.animated);
  }
  const divider = p.dividers ? `<p align="center">\n  ${picture("./assets/divider-light.svg", "./assets/divider-dark.svg", "", "100%")}\n</p>\n\n` : "";

  let shot = 0;
  blocks.forEach((b, index) => {
    const parts: string[] = [];
    if (opts.markers) parts.push(`<!--rs:${b.id}-->\n\n`);
    if (index > 0 && b.title?.trim() && divider) parts.push(divider);
    parts.push(heading(b));
    switch (b.type) {
      case "banner": {
        const font = FONT_BY_ID[b.font];
        const input = { title: p.name, tagline: b.tagline, accent: p.accent, animated: p.animated, font: `${font.family}`, fontCss: opts.fontCss[b.font] };
        assets["assets/banner-light.svg"] = bannerSvg(b.style, { ...input, dark: false });
        assets["assets/banner-dark.svg"] = bannerSvg(b.style, { ...input, dark: true });
        parts.push(`<p align="center">\n  ${picture("./assets/banner-light.svg", "./assets/banner-dark.svg", p.name, "100%")}\n</p>\n`);
        break;
      }
      case "badges": {
        const lines = b.items.map((badge) => {
          const u = badgeUrl(badge, p, b.style);
          const img = `<img src="${u.img}" alt="${u.alt}">`;
          return `  ${u.href ? `<a href="${u.href}">${img}</a>` : img}`;
        });
        parts.push(`<p align="center">\n${lines.join("\n")}\n</p>\n`);
        break;
      }
      case "intro": {
        const hasBanner = blocks.some((x) => x.type === "banner");
        if (!hasBanner) parts.push(`<h1 align="center">${p.name}</h1>\n\n`);
        if (b.text.trim()) parts.push(`<p align="center">\n  ${b.text.trim()}\n</p>\n`);
        const links = b.links.filter((l) => l.label.trim());
        if (links.length)
          parts.push(
            `\n<p align="center">\n  ${links.map((l) => `<a href="${l.url || "#"}"><strong>${l.label}</strong></a>`).join(" · ")}\n</p>\n`
          );
        break;
      }
      case "toc":
        parts.push(
          headed
            .filter((x) => x.id !== b.id)
            .map((x) => {
              const emoji = p.emoji && BLOCK_INFO[x.type].emoji && x.title === BLOCK_INFO[x.type].heading ? `${BLOCK_INFO[x.type].emoji} ` : "";
              return `- [${x.title}](#${slug(emoji + x.title)})`;
            })
            .join("\n") + "\n"
        );
        break;
      case "features": {
        const rows: string[] = [];
        for (let i = 0; i < b.items.length; i += b.columns) {
          const cells = b.items
            .slice(i, i + b.columns)
            .map((f) => `    <td width="${Math.floor(100 / b.columns)}%" valign="top">\n      <h3>${f.icon} ${f.title}</h3>\n      ${f.text}\n    </td>`);
          rows.push(`  <tr>\n${cells.join("\n")}\n  </tr>`);
        }
        parts.push(`<table>\n${rows.join("\n")}\n</table>\n`);
        break;
      }
      case "screenshots": {
        const imgs = b.images
          .filter((im) => im.src.trim() || im.file)
          .map((im) => {
            let src = im.src.trim();
            if (im.file) {
              const ext = im.file.match(/^data:image\/(\w+)/)?.[1]?.replace("jpeg", "jpg") ?? "png";
              src = `./assets/screenshot-${++shot}.${ext}`;
              assets[src.slice(2)] = im.file;
            }
            return { src, alt: im.alt || "Screenshot" };
          });
        if (!imgs.length) {
          parts.push("> Add screenshots to show it off.\n");
          break;
        }
        if (b.columns === 1) parts.push(imgs.map((im) => `<p align="center">\n  <img src="${im.src}" alt="${im.alt}" width="100%">\n</p>`).join("\n\n") + "\n");
        else {
          const rows: string[] = [];
          for (let i = 0; i < imgs.length; i += 2)
            rows.push(`  <tr>\n${imgs.slice(i, i + 2).map((im) => `    <td width="50%"><img src="${im.src}" alt="${im.alt}"></td>`).join("\n")}\n  </tr>`);
          parts.push(`<table>\n${rows.join("\n")}\n</table>\n`);
        }
        break;
      }
      case "install": {
        const flag = { npm: b.dev ? " -D" : "", pnpm: b.dev ? " -D" : "", yarn: b.dev ? " -D" : "", bun: b.dev ? " -d" : "" };
        const cmd = { npm: `npm install${flag.npm} ${b.pkg}`, pnpm: `pnpm add${flag.pnpm} ${b.pkg}`, yarn: `yarn add${flag.yarn} ${b.pkg}`, bun: `bun add${flag.bun} ${b.pkg}` };
        const [first, ...rest] = b.managers;
        if (first) parts.push("```bash\n" + cmd[first] + "\n```\n");
        if (rest.length)
          parts.push(
            `\n<details>\n  <summary>Other package managers</summary>\n\n` +
              rest.map((m) => "```bash\n" + cmd[m] + "\n```").join("\n\n") +
              `\n\n</details>\n`
          );
        if (b.extra.trim()) parts.push("\nThen:\n\n```bash\n" + b.extra.trim() + "\n```\n");
        break;
      }
      case "usage":
        if (b.note.trim()) parts.push(`${b.note.trim()}\n\n`);
        parts.push("```" + b.lang + "\n" + b.code.trim() + "\n```\n");
        break;
      case "api": {
        const cell = (s: string) => s.replace(/\|/g, "\\|");
        parts.push(
          `| Name | Type | Default | Description |\n| --- | --- | --- | --- |\n` +
            b.rows.map((r) => `| \`${cell(r.name)}\` | \`${cell(r.type)}\` | \`${cell(r.def)}\` | ${cell(r.desc)} |`).join("\n") +
            "\n"
        );
        break;
      }
      case "stack": {
        const ids = b.icons.join(",");
        const base = `https://skillicons.dev/icons?i=${ids}&perline=${b.perline}`;
        parts.push(`<p align="center">\n  <a href="https://skillicons.dev">\n  ${picture(`${base}&theme=light`, `${base}&theme=dark`, "Tech stack")}\n  </a>\n</p>\n`);
        break;
      }
      case "alert":
        parts.push(`> [!${b.kind}]\n` + b.text.trim().split("\n").map((l) => `> ${l}`).join("\n") + "\n");
        break;
      case "roadmap":
        parts.push(b.items.map((r) => `- [${r.done ? "x" : " "}] ${r.text}`).join("\n") + "\n");
        break;
      case "faq":
        parts.push(b.items.map((f) => `<details>\n  <summary><b>${f.q}</b></summary>\n\n${f.a}\n\n</details>`).join("\n\n") + "\n");
        break;
      case "contributing": {
        const repo = `${p.owner}/${p.repo}`;
        parts.push(`${b.text.trim()}\n`);
        if (b.contributors)
          parts.push(`\n<a href="https://github.com/${repo}/graphs/contributors">\n  <img src="https://contrib.rocks/image?repo=${repo}" alt="Contributors">\n</a>\n`);
        if (b.starHistory) {
          const base = `https://api.star-history.com/svg?repos=${repo}&type=Date`;
          parts.push(`\n<a href="https://star-history.com/#${repo}&Date">\n  ${picture(base, `${base}&theme=dark`, "Star history", "100%")}\n</a>\n`);
        }
        break;
      }
      case "license":
        parts.push(`Distributed under the ${b.license} License${b.holder ? `, © ${new Date().getFullYear()} ${b.holder}` : ""}. See [\`LICENSE\`](LICENSE) for details.\n`);
        break;
      case "profile": {
        const u = b.username || p.owner;
        const cards: string[] = [];
        if (b.stats)
          cards.push(picture(`https://github-readme-stats.vercel.app/api?username=${u}&show_icons=true&hide_border=true&theme=default`, `https://github-readme-stats.vercel.app/api?username=${u}&show_icons=true&hide_border=true&theme=github_dark`, "GitHub stats", "49%"));
        if (b.langs)
          cards.push(picture(`https://github-readme-stats.vercel.app/api/top-langs/?username=${u}&layout=compact&hide_border=true`, `https://github-readme-stats.vercel.app/api/top-langs/?username=${u}&layout=compact&hide_border=true&theme=github_dark`, "Top languages", "49%"));
        if (b.streak)
          cards.push(picture(`https://streak-stats.demolab.com?user=${u}&hide_border=true`, `https://streak-stats.demolab.com?user=${u}&hide_border=true&theme=github-dark-blue`, "GitHub streak", "98%"));
        parts.push(`<p align="center">\n  ${cards.join("\n  ")}\n</p>\n`);
        break;
      }
      case "custom":
        parts.push(b.markdown.trim() + "\n");
        break;
      case "footer":
        if (b.wave) {
          assets["assets/footer-light.svg"] = footerSvg(p.accent, false, p.animated);
          assets["assets/footer-dark.svg"] = footerSvg(p.accent, true, p.animated);
        }
        parts.push(
          `<p align="center">\n` +
            (b.text.trim() ? `  <sub>${b.text.trim()}</sub><br>\n` : "") +
            (b.backToTop ? `  <a href="#readme-top">↑ Back to top</a>\n` : "") +
            `</p>\n` +
            (b.wave ? `\n<p align="center">\n  ${picture("./assets/footer-light.svg", "./assets/footer-dark.svg", "", "100%")}\n</p>\n` : "")
        );
        break;
    }
    out.push(parts.join(""));
  });

  return { markdown: out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n", assets };
}

/* ----------------------------------------------------------------- health */

export interface HealthCheck {
  id: string;
  label: string;
  ok: boolean;
  fix?: Block["type"];
}

/** What a reader looks for, checked against the README. */
export function health(p: Project): { score: number; checks: HealthCheck[] } {
  const live = p.blocks.filter((b) => !b.hidden);
  const has = (t: Block["type"]) => live.some((b) => b.type === t);
  const long = live.filter((b) => b.title?.trim()).length >= 6;
  const checks: HealthCheck[] = [
    { id: "visual", label: "A banner or title", ok: has("banner") || has("intro"), fix: "banner" },
    { id: "what", label: "Says what it is", ok: live.some((b) => b.type === "intro" && b.text.trim().length > 20) || p.description.length > 20, fix: "intro" },
    { id: "badges", label: "Status badges", ok: has("badges"), fix: "badges" },
    { id: "install", label: "How to install", ok: has("install"), fix: "install" },
    { id: "usage", label: "A usage example", ok: has("usage"), fix: "usage" },
    { id: "visuals", label: "Screenshots or a demo", ok: has("screenshots") || live.some((b) => b.type === "intro" && b.links.some((l) => l.url)), fix: "screenshots" },
    { id: "toc", label: "Contents for a long page", ok: !long || has("toc"), fix: "toc" },
    { id: "contributing", label: "How to contribute", ok: has("contributing"), fix: "contributing" },
    { id: "license", label: "A license", ok: has("license"), fix: "license" },
  ];
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return { score, checks };
}
