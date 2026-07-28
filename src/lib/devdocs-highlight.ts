/**
 * Syntax highlighting for DevDocs code blocks.
 *
 * Every docset tags its `<pre>` elements with `data-language`, but each one
 * arrives pre-tokenised by a different upstream tool (Pygments for Python,
 * rustdoc for Rust, Prism for MDN) with class names we'd have to style
 * separately. Re-highlighting from the plain text with Shiki gives all 800 sets
 * one consistent, readable palette instead.
 *
 * Shiki is imported on demand and blocks are highlighted as they scroll into
 * view — big reference pages carry hundreds of samples, and highlighting them
 * all up front would stall the page.
 */

/** DevDocs `data-language` values mapped onto Shiki language ids. */
const LANGUAGES: Record<string, string> = {
  bash: "bash",
  sh: "bash",
  shell: "bash",
  console: "bash",
  zsh: "bash",
  fish: "fish",
  powershell: "powershell",
  batch: "bat",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  csharp: "csharp",
  cs: "csharp",
  objectivec: "objective-c",
  swift: "swift",
  java: "java",
  kotlin: "kotlin",
  scala: "scala",
  groovy: "groovy",
  clojure: "clojure",
  elixir: "elixir",
  erlang: "erlang",
  haskell: "haskell",
  ocaml: "ocaml",
  fsharp: "fsharp",
  lisp: "lisp",
  elisp: "lisp",
  lua: "lua",
  perl: "perl",
  php: "php",
  python: "python",
  py: "python",
  ruby: "ruby",
  rb: "ruby",
  rust: "rust",
  go: "go",
  dart: "dart",
  julia: "julia",
  r: "r",
  crystal: "crystal",
  nim: "nim",
  zig: "zig",
  d: "d",
  haxe: "haxe",
  fortran: "fortran-free-form",
  matlab: "matlab",
  js: "javascript",
  javascript: "javascript",
  jsx: "jsx",
  ts: "typescript",
  typescript: "typescript",
  tsx: "tsx",
  coffeescript: "coffee",
  json: "json",
  json5: "json5",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  html: "html",
  vue: "vue",
  svelte: "svelte",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  stylus: "stylus",
  sql: "sql",
  graphql: "graphql",
  diff: "diff",
  markdown: "markdown",
  md: "markdown",
  ini: "ini",
  docker: "docker",
  dockerfile: "docker",
  nginx: "nginx",
  apache: "apache",
  makefile: "make",
  make: "make",
  cmake: "cmake",
  terraform: "terraform",
  hcl: "hcl",
  handlebars: "handlebars",
  twig: "twig",
  liquid: "liquid",
  jinja: "jinja",
  pug: "pug",
  erb: "erb",
  tex: "latex",
  latex: "latex",
  vim: "viml",
  regex: "regexp",
  wasm: "wasm",
  solidity: "solidity",
  prisma: "prisma",
  proto: "proto",
};

/** Themes are paired so one pass covers both colour schemes. */
const THEMES = { light: "github-light", dark: "github-dark" } as const;

type Shiki = typeof import("shiki");

let shikiPromise: Promise<Shiki> | null = null;
function loadShiki(): Promise<Shiki> {
  shikiPromise ??= import("shiki");
  return shikiPromise;
}

/** Languages Shiki refused, so a second block never retries a lost cause. */
const unsupported = new Set<string>();

export function shikiLanguage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  const lang = LANGUAGES[key];
  return lang && !unsupported.has(lang) ? lang : null;
}

/**
 * Replace one block's contents with highlighted markup. Returns false when the
 * language isn't supported, leaving the original text untouched.
 */
async function highlightBlock(block: HTMLElement, lang: string): Promise<boolean> {
  const code = block.textContent ?? "";
  if (!code.trim()) return false;

  try {
    const { codeToHtml } = await loadShiki();
    const html = await codeToHtml(code, {
      lang: lang as never,
      themes: THEMES,
      // Emit `--shiki-light` / `--shiki-dark` custom properties instead of a
      // baked-in colour, so the theme toggle needs no re-highlight.
      defaultColor: false,
    });

    // Take Shiki's tokens but keep our own `<pre>`, which already carries the
    // language label, copy button and page styling.
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const tokens = parsed.querySelector("code");
    if (!tokens) return false;

    block.innerHTML = tokens.innerHTML;
    block.dataset.highlighted = "true";
    return true;
  } catch {
    unsupported.add(lang);
    return false;
  }
}

/**
 * Highlight every `<pre data-language>` inside `root` as it enters the viewport.
 * Returns a teardown for the observer.
 */
export function highlightOnView(root: HTMLElement, viewport: HTMLElement | null): () => void {
  const blocks = [...root.querySelectorAll<HTMLElement>("pre[data-language]")].filter(
    (block) => !block.dataset.highlighted && shikiLanguage(block.dataset.language)
  );
  if (!blocks.length) return () => {};

  if (typeof IntersectionObserver === "undefined") {
    for (const block of blocks) {
      const lang = shikiLanguage(block.dataset.language);
      if (lang) void highlightBlock(block, lang);
    }
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const block = entry.target as HTMLElement;
        observer.unobserve(block);
        const lang = shikiLanguage(block.dataset.language);
        if (lang) void highlightBlock(block, lang);
      }
    },
    // A generous margin means a block is usually ready before it is read.
    { root: viewport, rootMargin: "400px 0px" }
  );

  for (const block of blocks) observer.observe(block);
  return () => observer.disconnect();
}
