"use client";

import * as React from "react";
import {
  BookOpenIcon,
  CircleDotIcon,
  CodeIcon,
  GitPullRequestIcon,
  ListIcon,
  PlayIcon,
  ScaleIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { highlightCode } from "@/lib/codeshot";
import { renderMarkdown } from "@/lib/readme/markdown";
import { BLOCK_INFO, type Project } from "@/lib/readme/types";
import { cn } from "@/lib/utils";
import s from "./github.module.css";

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const COPY_ICON =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>';

/** Highlighted code, shared by every preview, keyed by theme, language and code. */
const highlighted = new Map<string, string>();
const pending = new Set<string>();
const keyOf = (theme: string, lang: string, code: string) =>
  `${theme}\u0000${lang}\u0000${code}`;

async function highlightInto(theme: string, lang: string, code: string) {
  const key = keyOf(theme, lang, code);
  if (highlighted.has(key) || pending.has(key)) return false;
  pending.add(key);
  try {
    const h = await highlightCode(
      code,
      lang,
      theme === "dark" ? "github-dark-default" : "github-light-default",
    );
    highlighted.set(
      key,
      h.lines
        .map((line) =>
          line
            .map((t) => `<span style="color:${t.color}">${esc(t.text)}</span>`)
            .join(""),
        )
        .join("\n"),
    );
  } catch {
    highlighted.set(key, esc(code));
  } finally {
    pending.delete(key);
  }
  return true;
}

/** Shows the light or dark half of each <picture>, like GitHub does for the reader's theme. */
function resolvePictures(md: string, dark: boolean) {
  return md.replace(
    /<picture>\s*<source media="\(prefers-color-scheme: dark\)" srcset="([^"]+)">\s*<img src="([^"]+)"([^>]*)>\s*<\/picture>/g,
    (_, d: string, l: string, rest: string) =>
      `<img src="${dark ? d : l}"${rest}>`,
  );
}

const DEMO: Record<string, [string, string]> = {
  license: ["license", "MIT"],
  stars: ["stars", "1.2k"],
  forks: ["forks", "86"],
  issues: ["issues", "3 open"],
  "last-commit": ["last commit", "today"],
  "npm/v": ["npm", "v1.0.0"],
  "npm/dm": ["downloads", "48k/month"],
  "bundlephobia/minzip": ["minzipped size", "4.2 kB"],
};

const svgUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export interface GithubPreviewProps {
  project: Project;
  markdown: string;
  assets: Record<string, string>;
  theme: "light" | "dark";
  narrow: boolean;
  mode: "preview" | "markdown";
  active: string | null;
  onPick: (id: string) => void;
  /** Markdown as exported (no section markers), for the source view. */
  source: string;
}

export function GithubPreview({
  project,
  markdown,
  assets,
  theme,
  narrow,
  mode,
  active,
  onPick,
  source,
}: GithubPreviewProps) {
  const dark = theme === "dark";
  const [tick, bump] = React.useReducer((n: number) => n + 1, 0);
  const root = React.useRef<HTMLDivElement>(null);

  // Asset files become data URLs; only the ones this theme shows are encoded.
  const urls = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const [path, content] of Object.entries(assets)) {
      if (
        /-(light|dark)\.svg$/.test(path) &&
        path.includes(dark ? "-light." : "-dark.")
      )
        continue;
      map[`./${path}`] = content.startsWith("data:")
        ? content
        : svgUrl(content);
    }
    return map;
  }, [assets, dark]);

  const rendered = React.useMemo(() => {
    let md = resolvePictures(markdown, dark).replace(
      /\.\/assets\/[\w.-]+/g,
      (m) => urls[m] ?? m,
    );
    // The starter's placeholder repo doesn't exist; show what real badges look like.
    if (project.owner === "your-name")
      md = md.replace(
        /https:\/\/img\.shields\.io\/github\/(license|stars|forks|issues|last-commit)\/your-name\/[^?"]+\?([^"]*)/g,
        (_, kind: string, q: string) => {
          const [label, message] = DEMO[kind];
          return `https://img.shields.io/static/v1?label=${label}&message=${encodeURIComponent(message)}&${q}`;
        },
      ).replace(
        /https:\/\/img\.shields\.io\/(npm\/v|npm\/dm|bundlephobia\/minzip)\/[^?"]+\?([^"]*)/g,
        (_, kind: string, q: string) => {
          const [label, message] = DEMO[kind];
          return `https://img.shields.io/static/v1?label=${encodeURIComponent(label)}&message=${encodeURIComponent(message)}&${q}`;
        },
      );
    return renderMarkdown(md);
  }, [markdown, dark, urls, project.owner]);

  // Highlight code blocks in the background, then show them.
  React.useEffect(() => {
    let live = true;
    const jobs = rendered.code.map((c) => highlightInto(theme, c.lang, c.code));
    if (mode === "markdown")
      jobs.push(highlightInto(theme, "markdown", source));
    Promise.all(jobs).then((changed) => {
      if (live && changed.some(Boolean)) bump();
    });
    return () => {
      live = false;
    };
  }, [rendered, theme, mode, source]);

  // Split into one piece per section, so typing in one leaves the others
  // (and their animated banners) untouched.
  const pieces = React.useMemo(() => {
    const html = rendered.html.replace(
      /<div class="highlight" data-code="(\d+)"><pre><code>[\s\S]*?<\/code><\/pre><\/div>/g,
      (whole, n: string) => {
        const c = rendered.code[Number(n)];
        const body = highlighted.get(keyOf(theme, c.lang, c.code));
        const inner = body
          ? `<pre><code>${body}</code></pre>`
          : whole.replace(/^<div[^>]*>|<\/div>$/g, "");
        return `<div class="highlight" data-code="${n}"><button type="button" class="rs-copy" data-copy="${n}" aria-label="Copy">${COPY_ICON}</button>${inner}</div>`;
      },
    );
    const parts = html.split(/<!--rs:(\w+)-->/);
    const out: { id: string; html: string }[] = [];
    if (parts[0].trim()) out.push({ id: "", html: parts[0] });
    for (let i = 1; i < parts.length; i += 2)
      out.push({ id: parts[i], html: parts[i + 1] ?? "" });
    return out;
    // `highlighted` changes outside React; the bump above re-runs this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered, theme, tick]);

  const outline = React.useMemo(
    () =>
      [
        ...rendered.html.matchAll(
          /<h([23]) id="([^"]+)"><a[^>]*>#<\/a>([\s\S]*?)<\/h\1>/g,
        ),
      ].map((m) => ({
        level: Number(m[1]),
        id: m[2],
        text: m[3].replace(/<[^>]+>/g, ""),
      })),
    [rendered],
  );

  const labels = React.useMemo(
    () =>
      Object.fromEntries(
        project.blocks.map((b) => [b.id, BLOCK_INFO[b.type].label]),
      ),
    [project.blocks],
  );

  const scrollTo = (id: string) => {
    const el = root.current?.querySelector(`[id="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const copy = target.closest<HTMLElement>(".rs-copy");
    if (copy) {
      const c = rendered.code[Number(copy.dataset.copy)];
      if (c) navigator.clipboard?.writeText(c.code).catch(() => {});
      copy.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="#1a7f37"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>';
      window.setTimeout(() => (copy.innerHTML = COPY_ICON), 1400);
      return;
    }
    const link = target.closest<HTMLAnchorElement>("a[href]");
    if (link) {
      e.preventDefault();
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("#")) {
        scrollTo(href.slice(1));
        return;
      }
      if (/^https?:\/\//.test(href))
        window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    if (target.closest("summary")) return;
    const block = target.closest<HTMLElement>("[data-block]");
    if (block?.dataset.block) onPick(block.dataset.block);
  };

  const hasLicense = project.blocks.some(
    (b) => b.type === "license" && !b.hidden,
  );
  const sourceLines = React.useMemo(() => {
    const body = highlighted.get(keyOf(theme, "markdown", source));
    return (body ?? esc(source)).split("\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, theme, tick, mode]);

  return (
    <div
      ref={root}
      data-theme={theme}
      className={cn(
        s.frame,
        narrow && s.narrow,
        "overflow-hidden rounded-xl border border-black/10 dark:border-white/10",
      )}
    >
      <div className={s.repoHead}>
        <div className={s.repoTitle}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            style={{ color: "var(--muted)", flex: "none" }}
            aria-hidden
          >
            <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" />
          </svg>
          <span className="truncate">
            <a href="#">{project.owner || "owner"}</a>
            <span className={s.sep}> / </span>
            <strong>
              <a href="#">{project.repo || "repo"}</a>
            </strong>
          </span>
          <span className={s.pill}>Public</span>
        </div>
        <nav className={s.tabs} aria-hidden>
          <span className={cn(s.tab, s.tabActive)}>
            <CodeIcon size={16} /> Code
          </span>
          <span className={s.tab}>
            <CircleDotIcon size={16} /> Issues
          </span>
          <span className={s.tab}>
            <GitPullRequestIcon size={16} /> Pull requests
          </span>
          {!narrow && (
            <span className={s.tab}>
              <PlayIcon size={16} /> Actions
            </span>
          )}
        </nav>
      </div>

      <div className={s.body}>
        <div className={s.box}>
          <div className={s.boxHead}>
            <span className={cn(s.boxTab, s.boxTabActive)}>
              <BookOpenIcon size={16} /> README
            </span>
            {hasLicense && (
              <span className={s.boxTab}>
                <ScaleIcon size={16} /> License
              </span>
            )}
            <span className="flex-1" />
            {mode === "preview" && outline.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Outline"
                    className="grid size-8 place-items-center rounded-md hover:bg-[var(--subtle)]"
                    style={{ color: "var(--muted)" }}
                  >
                    <ListIcon size={16} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 gap-0 p-1.5">
                  {outline.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => scrollTo(h.id)}
                      className={cn(
                        "hover:bg-muted truncate rounded-md px-2 py-1.5 text-left text-sm",
                        h.level === 3 && "pl-5 text-xs",
                      )}
                    >
                      {h.text}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </div>

          {mode === "preview" ? (
            <article className={s.md} onClick={onClick}>
              {pieces.map((p, i) =>
                p.id ? (
                  <div
                    key={p.id}
                    data-block={p.id}
                    data-label={
                      labels[p.id]
                        ? `Edit ${labels[p.id].toLowerCase()}`
                        : "Edit"
                    }
                    data-active={active === p.id}
                    dangerouslySetInnerHTML={{ __html: p.html }}
                  />
                ) : (
                  <div
                    key={`lead-${i}`}
                    dangerouslySetInnerHTML={{ __html: p.html }}
                  />
                ),
              )}
            </article>
          ) : (
            <pre className={s.source}>
              {sourceLines.map((line, i) => (
                <span
                  key={i}
                  dangerouslySetInnerHTML={{ __html: line || " " }}
                />
              ))}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
