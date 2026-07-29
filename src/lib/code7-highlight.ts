/**
 * Syntax highlighting for the Code7 playground.
 *
 * The editor re-highlights on every keystroke, so this is deliberately not
 * Shiki: a TextMate grammar means a WASM download, an async API and ~10ms per
 * pass — enough to make the highlight layer lag a character behind the caret.
 * These hand-written scanners run synchronously in well under a millisecond on
 * playground-sized files, so the painted layer and the textarea never disagree.
 *
 * Each scanner paints a type id per character into one flat byte array. That
 * makes nesting trivial (an HTML scanner just hands the CSS scanner a range)
 * and turns "tokens for line N" into a run-length pass over a slice.
 */

export type Code7Lang = "html" | "css" | "js";

/** Token classes. Rendered as `c7-t{id}`; styled by the theme CSS variables. */
export const TT = {
  plain: 0,
  comment: 1,
  tag: 2,
  attr: 3,
  string: 4,
  keyword: 5,
  number: 6,
  punct: 7,
  fn: 8,
  prop: 9,
  value: 10,
  selector: 11,
  atrule: 12,
  regex: 13,
  atom: 14,
  meta: 15,
} as const;

/** Files past this size skip highlighting — plain text stays responsive. */
const MAX_HIGHLIGHT_CHARS = 200_000;

const isWordChar = (c: string) => /[A-Za-z0-9_$]/.test(c);
const isIdentStart = (c: string) => /[A-Za-z_$]/.test(c);

function paint(types: Uint8Array, from: number, to: number, type: number) {
  for (let i = from; i < to; i++) types[i] = type;
}

/* ------------------------------------------------------------------ CSS */

const CSS_ATOMS = new Set([
  "inherit", "initial", "unset", "revert", "none", "auto", "currentColor", "transparent",
]);

/**
 * Paints CSS over `[from, to)`. Tracks a block stack so that declarations
 * inside `@media { … }` are still read as selectors rather than properties.
 */
function scanCss(src: string, types: Uint8Array, from: number, to: number) {
  // Each entry says what the *contents* of the current block are.
  const stack: ("decl" | "nested")[] = [];
  let i = from;

  const inDeclBlock = () => stack.length > 0 && stack[stack.length - 1] === "decl";

  while (i < to) {
    const c = src[i];

    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 || end + 2 > to ? to : end + 2;
      paint(types, i, stop, TT.comment);
      i = stop;
      continue;
    }

    if (c === '"' || c === "'") {
      i = scanString(src, types, i, to, c);
      continue;
    }

    if (c === "{") {
      types[i] = TT.punct;
      i++;
      continue;
    }

    if (c === "}") {
      types[i] = TT.punct;
      stack.pop();
      i++;
      continue;
    }

    if (c === "@") {
      let j = i + 1;
      while (j < to && /[a-zA-Z-]/.test(src[j])) j++;
      paint(types, i, j, TT.atrule);
      const name = src.slice(i + 1, j).toLowerCase();
      // Conditional groups wrap rules; @font-face / @page wrap declarations.
      const wrapsRules = /^(media|supports|container|layer|scope|document|when|else)$/.test(name);
      // Prelude up to `{` or `;`.
      while (j < to && src[j] !== "{" && src[j] !== ";") {
        if (src[j] === '"' || src[j] === "'") {
          j = scanString(src, types, j, to, src[j]);
          continue;
        }
        if (/[0-9]/.test(src[j])) {
          const start = j;
          while (j < to && /[0-9.a-zA-Z%]/.test(src[j])) j++;
          paint(types, start, j, TT.number);
          continue;
        }
        if (isIdentStart(src[j])) {
          const start = j;
          while (j < to && /[\w-]/.test(src[j])) j++;
          paint(types, start, j, TT.value);
          continue;
        }
        types[j] = TT.punct;
        j++;
      }
      if (j < to && src[j] === "{") {
        types[j] = TT.punct;
        stack.push(wrapsRules ? "nested" : "decl");
        j++;
      } else if (j < to) {
        types[j] = TT.punct;
        j++;
      }
      i = j;
      continue;
    }

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (inDeclBlock()) {
      // property : value ;
      const start = i;
      while (i < to && !":;{}".includes(src[i]) && src[i] !== "/") i++;
      if (i < to && src[i] === ":") {
        paint(types, start, i, TT.prop);
        types[i] = TT.punct;
        i++;
        i = scanCssValue(src, types, i, to);
      } else {
        // A nested selector (CSS nesting) or a stray token.
        paint(types, start, i, TT.selector);
      }
      continue;
    }

    // Selector text up to the block or terminator.
    const start = i;
    while (i < to && !"{};".includes(src[i]) && !(src[i] === "/" && src[i + 1] === "*")) {
      if (src[i] === '"' || src[i] === "'") {
        paint(types, start, i, TT.selector);
        i = scanString(src, types, i, to, src[i]);
        continue;
      }
      i++;
    }
    paint(types, start, i, TT.selector);
    if (i < to && src[i] === "{") {
      types[i] = TT.punct;
      stack.push("decl");
      i++;
    } else if (i < to && (src[i] === "}" || src[i] === ";")) {
      if (src[i] === "}") stack.pop();
      types[i] = TT.punct;
      i++;
    }
  }
}

/** Paints a declaration value, stopping after `;` or before `}`. */
function scanCssValue(src: string, types: Uint8Array, start: number, to: number): number {
  let i = start;
  let depth = 0;
  while (i < to) {
    const c = src[i];
    if (c === ";" && depth === 0) {
      types[i] = TT.punct;
      return i + 1;
    }
    if (c === "}" && depth === 0) return i;

    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 || end + 2 > to ? to : end + 2;
      paint(types, i, stop, TT.comment);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      i = scanString(src, types, i, to, c);
      continue;
    }
    if (c === "#") {
      const s = i;
      i++;
      while (i < to && /[0-9a-fA-F]/.test(src[i])) i++;
      paint(types, s, i, TT.number);
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const s = i;
      while (i < to && /[0-9._]/.test(src[i])) i++;
      while (i < to && /[a-zA-Z%]/.test(src[i])) i++; // unit
      paint(types, s, i, TT.number);
      continue;
    }
    if (c === "!") {
      const s = i;
      i++;
      while (i < to && /[a-zA-Z]/.test(src[i])) i++;
      paint(types, s, i, TT.keyword);
      continue;
    }
    if (isIdentStart(c) || c === "-") {
      const s = i;
      while (i < to && /[\w-]/.test(src[i])) i++;
      const word = src.slice(s, i);
      if (src[i] === "(") {
        paint(types, s, i, TT.fn);
      } else if (word.startsWith("--")) {
        paint(types, s, i, TT.prop);
      } else if (CSS_ATOMS.has(word)) {
        paint(types, s, i, TT.atom);
      } else {
        paint(types, s, i, TT.value);
      }
      continue;
    }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (!/\s/.test(c)) types[i] = TT.punct;
    i++;
  }
  return i;
}

/** Paints a quoted string starting at `i`, returning the index after it. */
function scanString(src: string, types: Uint8Array, i: number, to: number, quote: string): number {
  let j = i + 1;
  while (j < to) {
    if (src[j] === "\\") {
      j += 2;
      continue;
    }
    if (src[j] === quote) {
      j++;
      break;
    }
    // An unterminated string shouldn't swallow the rest of the file.
    if (src[j] === "\n" && quote !== "`") break;
    j++;
  }
  paint(types, i, Math.min(j, to), TT.string);
  return Math.min(j, to);
}

/* ------------------------------------------------------------------- JS */

const JS_KEYWORDS = new Set([
  "var", "let", "const", "function", "return", "if", "else", "for", "while", "do", "break",
  "continue", "switch", "case", "default", "try", "catch", "finally", "throw", "new", "delete",
  "typeof", "instanceof", "in", "of", "class", "extends", "super", "import", "export", "from",
  "as", "async", "await", "yield", "static", "get", "set", "void", "with", "debugger",
]);

const JS_ATOMS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity", "this"]);

const JS_GLOBALS = new Set([
  "console", "document", "window", "globalThis", "navigator", "location", "history", "screen",
  "Math", "JSON", "Object", "Array", "String", "Number", "Boolean", "Symbol", "BigInt", "Date",
  "RegExp", "Map", "Set", "WeakMap", "WeakSet", "Promise", "Proxy", "Reflect", "Error",
  "TypeError", "RangeError", "Intl", "URL", "URLSearchParams", "Blob", "File", "FileReader",
  "FormData", "Headers", "Request", "Response", "AbortController", "Event", "CustomEvent",
  "EventTarget", "Image", "Audio", "Worker", "crypto", "performance", "customElements",
  "IntersectionObserver", "ResizeObserver", "MutationObserver", "localStorage", "sessionStorage",
  "fetch", "setTimeout", "setInterval", "clearTimeout", "clearInterval", "requestAnimationFrame",
  "cancelAnimationFrame", "queueMicrotask", "structuredClone", "alert", "confirm", "prompt",
]);

/** Tokens after which a `/` starts a regex literal rather than division. */
const REGEX_PRECEDERS = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "case", "do", "else",
  "yield", "await", "throw",
]);

function scanJs(src: string, types: Uint8Array, from: number, to: number) {
  let i = from;
  // Last significant token — decides whether `/` opens a regex.
  let prev = "";

  while (i < to) {
    const c = src[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (c === "/" && src[i + 1] === "/") {
      let j = i;
      while (j < to && src[j] !== "\n") j++;
      paint(types, i, j, TT.comment);
      i = j;
      continue;
    }

    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 || end + 2 > to ? to : end + 2;
      paint(types, i, stop, TT.comment);
      i = stop;
      continue;
    }

    if (c === "/" && (prev === "" || REGEX_PRECEDERS.has(prev) || "(,=:[!&|?{};+-*%~^<>".includes(prev))) {
      const end = scanRegex(src, i, to);
      if (end > i) {
        paint(types, i, end, TT.regex);
        prev = "regex";
        i = end;
        continue;
      }
    }

    if (c === '"' || c === "'") {
      i = scanString(src, types, i, to, c);
      prev = "str";
      continue;
    }

    if (c === "`") {
      i = scanTemplate(src, types, i, to);
      prev = "str";
      continue;
    }

    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const s = i;
      if (c === "0" && /[xXbBoO]/.test(src[i + 1] ?? "")) {
        i += 2;
        while (i < to && /[0-9a-fA-F_]/.test(src[i])) i++;
      } else {
        while (i < to && /[0-9._]/.test(src[i])) i++;
        if (i < to && /[eE]/.test(src[i])) {
          i++;
          if (i < to && /[+-]/.test(src[i])) i++;
          while (i < to && /[0-9]/.test(src[i])) i++;
        }
      }
      if (i < to && src[i] === "n") i++; // BigInt
      paint(types, s, i, TT.number);
      prev = "num";
      continue;
    }

    if (isIdentStart(c)) {
      const s = i;
      while (i < to && isWordChar(src[i])) i++;
      const word = src.slice(s, i);
      let j = i;
      while (j < to && /[ \t]/.test(src[j])) j++;
      const call = src[j] === "(";
      const member = s > from && src[s - 1] === ".";

      let type: number = TT.plain;
      if (JS_KEYWORDS.has(word) && !member) type = TT.keyword;
      else if (JS_ATOMS.has(word) && !member) type = TT.atom;
      else if (call) type = TT.fn;
      else if (member) type = TT.prop;
      else if (JS_GLOBALS.has(word)) type = TT.value;
      else if (/^[A-Z]/.test(word)) type = TT.value;

      paint(types, s, i, type);
      prev = word;
      continue;
    }

    types[i] = TT.punct;
    prev = c;
    i++;
  }
}

/** Returns the index after a regex literal, or `i` when it isn't one. */
function scanRegex(src: string, i: number, to: number): number {
  let j = i + 1;
  let inClass = false;
  while (j < to) {
    const c = src[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === "\n") return i;
    if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    else if (c === "/" && !inClass) {
      j++;
      while (j < to && /[dgimsuvy]/.test(src[j])) j++;
      return j;
    }
    j++;
  }
  return i;
}

/** Paints a template literal, recursing into `${…}` so expressions stay lit. */
function scanTemplate(src: string, types: Uint8Array, i: number, to: number): number {
  let j = i + 1;
  types[i] = TT.string;
  while (j < to) {
    if (src[j] === "\\") {
      types[j] = TT.string;
      if (j + 1 < to) types[j + 1] = TT.string;
      j += 2;
      continue;
    }
    if (src[j] === "`") {
      types[j] = TT.string;
      return j + 1;
    }
    if (src[j] === "$" && src[j + 1] === "{") {
      types[j] = TT.punct;
      types[j + 1] = TT.punct;
      // Find the matching brace, ignoring nested ones.
      let depth = 1;
      let k = j + 2;
      while (k < to && depth > 0) {
        if (src[k] === "{") depth++;
        else if (src[k] === "}") depth--;
        else if (src[k] === "`") k = scanTemplate(src, types, k, to) - 1;
        else if (src[k] === '"' || src[k] === "'") k = scanString(src, types, k, to, src[k]) - 1;
        k++;
      }
      scanJs(src, types, j + 2, Math.max(j + 2, k - 1));
      if (k - 1 < to) types[k - 1] = TT.punct;
      j = k;
      continue;
    }
    types[j] = TT.string;
    j++;
  }
  return to;
}

/* ----------------------------------------------------------------- HTML */

const RAW_TEXT_TAGS = new Set(["script", "style", "textarea", "title"]);

function scanHtml(src: string, types: Uint8Array, from: number, to: number) {
  let i = from;

  while (i < to) {
    const lt = src.indexOf("<", i);
    if (lt === -1 || lt >= to) {
      scanHtmlText(src, types, i, to);
      return;
    }
    scanHtmlText(src, types, i, lt);
    i = lt;

    if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i + 4);
      const stop = end === -1 || end + 3 > to ? to : end + 3;
      paint(types, i, stop, TT.comment);
      i = stop;
      continue;
    }

    if (src[i + 1] === "!" || src[i + 1] === "?") {
      const end = src.indexOf(">", i);
      const stop = end === -1 || end + 1 > to ? to : end + 1;
      paint(types, i, stop, TT.meta);
      i = stop;
      continue;
    }

    // `<` followed by something that can't start a tag name is literal text.
    const nameStart = src[i + 1] === "/" ? i + 2 : i + 1;
    if (!/[a-zA-Z]/.test(src[nameStart] ?? "")) {
      types[i] = TT.plain;
      i++;
      continue;
    }

    let j = nameStart;
    while (j < to && /[\w:.-]/.test(src[j])) j++;
    const tagName = src.slice(nameStart, j).toLowerCase();
    paint(types, i, j, TT.tag);

    // Attributes.
    let selfClosing = false;
    let scriptType = "";
    while (j < to && src[j] !== ">") {
      if (/\s/.test(src[j])) {
        j++;
        continue;
      }
      if (src[j] === "/") {
        selfClosing = true;
        types[j] = TT.tag;
        j++;
        continue;
      }
      if (src[j] === "=") {
        types[j] = TT.punct;
        j++;
        continue;
      }
      const attrStart = j;
      while (j < to && !/[\s=>/]/.test(src[j])) j++;
      const attrName = src.slice(attrStart, j).toLowerCase();
      paint(types, attrStart, j, TT.attr);

      let k = j;
      while (k < to && /\s/.test(src[k])) k++;
      if (src[k] === "=") {
        types[k] = TT.punct;
        k++;
        while (k < to && /\s/.test(src[k])) k++;
        const valueStart = k;
        if (src[k] === '"' || src[k] === "'") {
          k = scanString(src, types, k, to, src[k]);
        } else {
          while (k < to && !/[\s>]/.test(src[k])) k++;
          paint(types, valueStart, k, TT.string);
        }
        if (attrName === "type" && tagName === "script") {
          scriptType = src.slice(valueStart, k).replace(/["']/g, "").toLowerCase();
        }
        j = k;
      } else {
        j = k;
      }
    }
    if (j < to) {
      types[j] = TT.tag;
      j++;
    }
    i = j;

    // Raw-text elements: hand the body to the matching scanner.
    if (!selfClosing && src[nameStart - 1] !== "/" && RAW_TEXT_TAGS.has(tagName)) {
      const closeIdx = src.toLowerCase().indexOf(`</${tagName}`, i);
      const bodyEnd = closeIdx === -1 ? to : Math.min(closeIdx, to);
      if (tagName === "style") scanCss(src, types, i, bodyEnd);
      else if (tagName === "script") {
        const runnable = !scriptType || /javascript|module|jsx|babel/.test(scriptType);
        if (runnable) scanJs(src, types, i, bodyEnd);
        else if (scriptType.includes("json")) scanJs(src, types, i, bodyEnd);
      }
      i = bodyEnd;
    }
  }
}

/** Text nodes are plain, except entities which get their own color. */
function scanHtmlText(src: string, types: Uint8Array, from: number, to: number) {
  let i = from;
  while (i < to) {
    if (src[i] === "&") {
      const semi = src.indexOf(";", i);
      if (semi !== -1 && semi < to && semi - i <= 12 && /^[#\w]+$/.test(src.slice(i + 1, semi))) {
        paint(types, i, semi + 1, TT.meta);
        i = semi + 1;
        continue;
      }
    }
    i++;
  }
}

/* -------------------------------------------------------------- render */

const ESCAPE_RE = /[&<>]/g;
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const escapeHtml = (s: string) => s.replace(ESCAPE_RE, (ch) => ESCAPES[ch]);

/**
 * Builds the markup for the painted layer that sits under the textarea.
 *
 * Every source line becomes one row: an optional gutter cell plus the code
 * cell. Keeping the line number *inside* the row is what lets soft wrap work —
 * a wrapped line grows taller and its number stays pinned to its first visual
 * row, which a separate gutter column could never manage.
 */
export function highlightToHtml(
  src: string,
  lang: Code7Lang,
  options: { lineNumbers?: boolean } = {}
): string {
  const lineNumbers = options.lineNumbers !== false;
  const lines = src.split("\n");
  const types = new Uint8Array(src.length);

  if (src.length <= MAX_HIGHLIGHT_CHARS) {
    if (lang === "html") scanHtml(src, types, 0, src.length);
    else if (lang === "css") scanCss(src, types, 0, src.length);
    else scanJs(src, types, 0, src.length);
  }

  const out: string[] = [];
  let offset = 0;

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    const end = offset + line.length;
    out.push('<div class="c7-row">');
    if (lineNumbers) out.push(`<span class="c7-ln">${n + 1}</span>`);
    out.push('<span class="c7-code">');

    if (line.length === 0) {
      // A zero-width space keeps empty rows exactly one line tall.
      out.push("​");
    } else {
      let runStart = offset;
      let runType = types[offset];
      for (let i = offset + 1; i <= end; i++) {
        const t = i < end ? types[i] : -1;
        if (t !== runType) {
          const text = escapeHtml(src.slice(runStart, i));
          out.push(runType === TT.plain ? text : `<span class="c7-t${runType}">${text}</span>`);
          runStart = i;
          runType = t;
        }
      }
    }

    out.push("</span></div>");
    offset = end + 1;
  }

  return out.join("");
}

/* -------------------------------------------------------------- themes */

export interface Code7Theme {
  id: string;
  name: string;
  dark: boolean;
}

/**
 * Editor themes. The old Code7 shipped an Ace theme dropdown, so the list keeps
 * a few of those names alive — "Terminal" especially, which is what most of the
 * original demos were written against.
 */
export const CODE7_THEMES: readonly Code7Theme[] = [
  { id: "emerald", name: "Emerald", dark: true },
  { id: "terminal", name: "Terminal", dark: true },
  { id: "midnight", name: "Midnight", dark: true },
  { id: "dracula", name: "Dracula", dark: true },
  { id: "monokai", name: "Monokai", dark: true },
  { id: "nord", name: "Nord", dark: true },
  { id: "cobalt", name: "Cobalt", dark: true },
  { id: "twilight", name: "Twilight", dark: true },
  { id: "paper", name: "Paper", dark: false },
  { id: "daylight", name: "Daylight", dark: false },
];

export const CODE7_THEME_IDS = new Set(CODE7_THEMES.map((t) => t.id));

export function isDarkTheme(id: string): boolean {
  return CODE7_THEMES.find((t) => t.id === id)?.dark ?? true;
}
