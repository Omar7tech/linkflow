/**
 * Text operations for the live editor.
 *
 * Every command is a pure function over `(value, selectionStart, selectionEnd)`
 * that returns a single replacement range. The component applies it through
 * `document.execCommand("insertText")`, which is the only way to mutate a
 * textarea without wiping the browser's native undo stack — so Ctrl+Z still
 * walks back through indenting, commenting and tag completion the way it does
 * through typing.
 */

import { paintTypes, TT, type EditorLang } from "./editor-highlight";

/** A replacement plus where the caret should land afterwards. */
export interface Edit {
  from: number;
  to: number;
  text: string;
  selStart: number;
  selEnd: number;
}

/** Elements that never take a closing tag. */
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
]);

/** Elements whose contents are text, not markup. */
const RAW_TAGS = new Set(["script", "style", "pre", "textarea"]);

const OPEN_TO_CLOSE: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const QUOTES = new Set(['"', "'", "`"]);

export const lineStartAt = (v: string, i: number) => v.lastIndexOf("\n", i - 1) + 1;

export const lineEndAt = (v: string, i: number) => {
  const n = v.indexOf("\n", i);
  return n === -1 ? v.length : n;
};

const leadingWhitespace = (line: string) => /^[ \t]*/.exec(line)![0];

/** 1-based line and column for the status bar. */
export function caretPosition(value: string, index: number) {
  const start = lineStartAt(value, index);
  let line = 1;
  for (let i = 0; i < start; i++) if (value[i] === "\n") line++;
  return { line, column: index - start + 1 };
}

/* ----------------------------------------------------------- indenting */

/** Tab / Shift+Tab. Indents the selected lines, or inserts one unit inline. */
export function indentCommand(
  value: string,
  selStart: number,
  selEnd: number,
  tabSize: number,
  outdent: boolean
): Edit | null {
  const unit = " ".repeat(tabSize);
  const multiline = value.slice(selStart, selEnd).includes("\n");

  if (!multiline && !outdent) {
    // Land on the next tab stop rather than always inserting `tabSize` spaces.
    const column = selStart - lineStartAt(value, selStart);
    const spaces = tabSize - (column % tabSize) || tabSize;
    const text = " ".repeat(spaces);
    return { from: selStart, to: selEnd, text, selStart: selStart + spaces, selEnd: selStart + spaces };
  }

  const from = lineStartAt(value, selStart);
  const to = lineEndAt(value, selEnd);
  const lines = value.slice(from, to).split("\n");

  let firstDelta = 0;
  let totalDelta = 0;
  const next = lines.map((line, i) => {
    if (outdent) {
      const ws = leadingWhitespace(line);
      let remove = 0;
      while (remove < tabSize && remove < ws.length) {
        if (ws[remove] === "\t") {
          remove++;
          break;
        }
        remove++;
      }
      if (i === 0) firstDelta = -remove;
      totalDelta -= remove;
      return line.slice(remove);
    }
    if (line.length === 0 && lines.length > 1) return line;
    if (i === 0) firstDelta = unit.length;
    totalDelta += unit.length;
    return unit + line;
  });

  return {
    from,
    to,
    text: next.join("\n"),
    selStart: Math.max(from, selStart + firstDelta),
    selEnd: Math.max(from, selEnd + totalDelta),
  };
}

/* --------------------------------------------------------- commenting */

/** Ctrl+/ — line comments for JS, block comments for CSS and HTML. */
export function toggleCommentCommand(
  value: string,
  selStart: number,
  selEnd: number,
  lang: EditorLang
): Edit {
  const from = lineStartAt(value, selStart);
  const to = lineEndAt(value, selEnd);
  const block = value.slice(from, to);
  const lines = block.split("\n");

  if (lang === "js") {
    const meaningful = lines.filter((l) => l.trim().length > 0);
    const allCommented =
      meaningful.length > 0 && meaningful.every((l) => l.trim().startsWith("//"));

    const next = lines.map((line) => {
      if (line.trim().length === 0) return line;
      if (allCommented) return line.replace(/^(\s*)\/\/ ?/, "$1");
      const ws = leadingWhitespace(line);
      return `${ws}// ${line.slice(ws.length)}`;
    });
    const text = next.join("\n");
    return { from, to, text, selStart: from, selEnd: from + text.length };
  }

  const [open, close] = lang === "css" ? ["/*", "*/"] : ["<!--", "-->"];
  const trimmed = block.trim();
  if (trimmed.startsWith(open) && trimmed.endsWith(close)) {
    const text = block
      .replace(new RegExp(`${escapeRe(open)}\\s?`), "")
      .replace(new RegExp(`\\s?${escapeRe(close)}(?=\\s*$)`), "");
    return { from, to, text, selStart: from, selEnd: from + text.length };
  }
  const ws = leadingWhitespace(lines[0]);
  const text = `${ws}${open} ${block.slice(ws.length)} ${close}`;
  return { from, to, text, selStart: from, selEnd: from + text.length };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ------------------------------------------------------- line movement */

/** Ctrl+D — copies the selected lines below themselves. */
export function duplicateLinesCommand(value: string, selStart: number, selEnd: number): Edit {
  const from = lineStartAt(value, selStart);
  const to = lineEndAt(value, selEnd);
  const block = value.slice(from, to);
  const offset = block.length + 1;
  return {
    from: to,
    to,
    text: `\n${block}`,
    selStart: selStart + offset,
    selEnd: selEnd + offset,
  };
}

/** Alt+Up / Alt+Down — swaps the selected lines with their neighbour. */
export function moveLinesCommand(
  value: string,
  selStart: number,
  selEnd: number,
  direction: -1 | 1
): Edit | null {
  const from = lineStartAt(value, selStart);
  const to = lineEndAt(value, selEnd);

  if (direction === -1) {
    if (from === 0) return null;
    const prevFrom = lineStartAt(value, from - 1);
    const block = value.slice(from, to);
    const prev = value.slice(prevFrom, from - 1);
    const text = `${block}\n${prev}`;
    const shift = from - prevFrom;
    return {
      from: prevFrom,
      to,
      text,
      selStart: selStart - shift,
      selEnd: selEnd - shift,
    };
  }

  if (to >= value.length) return null;
  const nextTo = lineEndAt(value, to + 1);
  const block = value.slice(from, to);
  const next = value.slice(to + 1, nextTo);
  const text = `${next}\n${block}`;
  const shift = next.length + 1;
  return { from, to: nextTo, text, selStart: selStart + shift, selEnd: selEnd + shift };
}

/* ------------------------------------------------------------- newline */

/**
 * Enter. Carries the current indentation down, adds a level after an opening
 * bracket or tag, and when the caret sits exactly between a pair it puts the
 * closing half on its own line.
 */
export function newlineCommand(
  value: string,
  selStart: number,
  selEnd: number,
  lang: EditorLang,
  tabSize: number
): Edit {
  const from = lineStartAt(value, selStart);
  const line = value.slice(from, selStart);
  const indent = leadingWhitespace(value.slice(from, lineEndAt(value, selStart)));
  const unit = " ".repeat(tabSize);

  const before = line.trimEnd();
  const prev = before[before.length - 1] ?? "";
  const after = value.slice(selEnd);
  const nextChar = after.trimStart()[0] ?? "";

  let opens = prev === "{" || prev === "(" || prev === "[";
  let closesNext = nextChar === "}" || nextChar === ")" || nextChar === "]";

  if (lang === "html") {
    const openTag = /<([a-zA-Z][\w:.-]*)(?:\s[^<>]*)?>$/.exec(before);
    if (openTag && !VOID_TAGS.has(openTag[1].toLowerCase()) && !before.endsWith("/>")) {
      opens = true;
      closesNext = /^<\//.test(after.trimStart());
    } else {
      opens = false;
    }
    if (prev === "{" && before.includes(":")) opens = true; // inline <style> block
  }

  if (opens && closesNext) {
    const text = `\n${indent}${unit}\n${indent}`;
    const caret = selStart + 1 + indent.length + unit.length;
    return { from: selStart, to: selEnd, text, selStart: caret, selEnd: caret };
  }

  const text = `\n${indent}${opens ? unit : ""}`;
  const caret = selStart + text.length;
  return { from: selStart, to: selEnd, text, selStart: caret, selEnd: caret };
}

/* ---------------------------------------------------------- auto-pairs */

/**
 * Bracket and quote handling for a printable keypress. Returns `null` when the
 * character should just be typed normally.
 */
export function autoPairCommand(
  value: string,
  selStart: number,
  selEnd: number,
  char: string,
  lang: EditorLang
): Edit | null {
  const hasSelection = selStart !== selEnd;
  const nextChar = value[selEnd] ?? "";
  const prevChar = value[selStart - 1] ?? "";

  // Wrap a selection in the pair instead of replacing it.
  if (hasSelection && (OPEN_TO_CLOSE[char] || QUOTES.has(char))) {
    const close = OPEN_TO_CLOSE[char] ?? char;
    const inner = value.slice(selStart, selEnd);
    return {
      from: selStart,
      to: selEnd,
      text: `${char}${inner}${close}`,
      selStart: selStart + 1,
      selEnd: selEnd + 1,
    };
  }

  if (hasSelection) return null;

  // Typing the closing half right before it just steps over it.
  if ((char === ")" || char === "]" || char === "}" || QUOTES.has(char)) && nextChar === char) {
    return { from: selStart, to: selStart, text: "", selStart: selStart + 1, selEnd: selStart + 1 };
  }

  if (OPEN_TO_CLOSE[char]) {
    // Don't close when it would run into a word — `foo(bar` shouldn't gain a `)`.
    if (/[\w$]/.test(nextChar)) return null;
    return {
      from: selStart,
      to: selStart,
      text: char + OPEN_TO_CLOSE[char],
      selStart: selStart + 1,
      selEnd: selStart + 1,
    };
  }

  if (QUOTES.has(char)) {
    if (/[\w$]/.test(prevChar) || /[\w$]/.test(nextChar)) return null;
    if (lang === "js" && char === "'" && /\w\s*$/.test(value.slice(Math.max(0, selStart - 2), selStart)))
      return null;
    return {
      from: selStart,
      to: selStart,
      text: char + char,
      selStart: selStart + 1,
      selEnd: selStart + 1,
    };
  }

  return null;
}

/** Backspace between an empty pair removes both halves. */
export function backspacePairCommand(
  value: string,
  selStart: number,
  selEnd: number,
  tabSize: number
): Edit | null {
  if (selStart !== selEnd || selStart === 0) return null;
  const prev = value[selStart - 1];
  const next = value[selStart];
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
  if (pairs[prev] && pairs[prev] === next) {
    return { from: selStart - 1, to: selStart + 1, text: "", selStart: selStart - 1, selEnd: selStart - 1 };
  }

  // Otherwise delete back to the previous tab stop when sitting in indentation.
  const from = lineStartAt(value, selStart);
  const before = value.slice(from, selStart);
  if (before.length > 0 && /^ +$/.test(before)) {
    const size = before.length % tabSize || tabSize;
    const target = selStart - size;
    return { from: target, to: selStart, text: "", selStart: target, selEnd: target };
  }
  return null;
}

/* ------------------------------------------------------------- HTML tags */

/** Typing `>` after an opening tag inserts the matching closing tag. */
export function closeTagCommand(value: string, selStart: number): Edit | null {
  const before = value.slice(0, selStart);
  const match = /<([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^<>])*)$/.exec(before);
  if (!match) return null;

  const [, name, attrs] = match;
  const tag = name.toLowerCase();
  if (VOID_TAGS.has(tag) || attrs.trimEnd().endsWith("/")) return null;
  // Only when the tag is genuinely unclosed further down.
  if (countOpenTags(value, tag) <= countCloseTags(value, tag)) return null;

  const closing = `></${name}>`;
  return {
    from: selStart,
    to: selStart,
    text: closing,
    selStart: selStart + 1,
    selEnd: selStart + 1,
  };
}

/** Typing `</` completes the nearest still-open tag. */
export function closeNearestTagCommand(value: string, selStart: number): Edit | null {
  const before = value.slice(0, selStart);
  if (!before.endsWith("</")) return null;

  const stack: string[] = [];
  const re = /<(\/?)([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^<>])*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(before))) {
    const tag = m[2].toLowerCase();
    if (VOID_TAGS.has(tag) || m[3].trimEnd().endsWith("/")) continue;
    if (m[1]) {
      const idx = stack.lastIndexOf(tag);
      if (idx !== -1) stack.length = idx;
    } else {
      stack.push(tag);
    }
  }

  const tag = stack.pop();
  if (!tag) return null;
  const text = `${tag}>`;
  return {
    from: selStart,
    to: selStart,
    text,
    selStart: selStart + text.length,
    selEnd: selStart + text.length,
  };
}

function countOpenTags(value: string, tag: string) {
  return (value.match(new RegExp(`<${escapeRe(tag)}(\\s|>|$)`, "gi")) ?? []).length;
}

function countCloseTags(value: string, tag: string) {
  return (value.match(new RegExp(`</${escapeRe(tag)}\\s*>`, "gi")) ?? []).length;
}

/* ------------------------------------------------------------ re-indent */

/**
 * Tidies indentation without touching anything else.
 *
 * Reflowing markup is tempting but destructive — whitespace between inline
 * elements is significant, and a "pretty printer" that moves content between
 * lines silently changes the rendered page. This only ever rewrites the
 * whitespace at the start of a line, so the output always renders identically
 * to the input.
 */
export function reindent(value: string, lang: EditorLang, tabSize: number): string {
  const unit = " ".repeat(tabSize);
  const types = paintTypes(value, lang);
  const lines = value.split("\n");
  const out: string[] = [];

  let depth = 0;
  let offset = 0;
  let rawTag = "";

  for (const line of lines) {
    const start = offset;
    offset += line.length + 1;

    const trimmed = line.trim();
    if (trimmed.length === 0) {
      out.push("");
      continue;
    }

    // Inside a raw-text element or a multi-line string/comment: leave as-is.
    const firstType = types[start + leadingWhitespace(line).length] ?? TT.plain;
    if (rawTag) {
      out.push(line);
      if (new RegExp(`</${rawTag}`, "i").test(line)) {
        rawTag = "";
        depth = Math.max(0, depth - 1);
      }
      continue;
    }
    if (firstType === TT.comment || firstType === TT.string) {
      out.push(line);
      continue;
    }

    const { before, after, opensRaw } =
      lang === "html" ? htmlDelta(line) : bracketDelta(line, types, start);

    if (before < 0) depth = Math.max(0, depth + before);
    out.push(depth > 0 ? unit.repeat(depth) + trimmed : trimmed);
    depth = Math.max(0, depth + after);
    if (opensRaw) rawTag = opensRaw;
  }

  return out.join("\n");
}

/** Brace/bracket balance for a line, ignoring strings and comments. */
function bracketDelta(line: string, types: Uint8Array, start: number) {
  let before = 0;
  let after = 0;
  let seenContent = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (types[start + i] !== TT.punct) {
      if (!/\s/.test(c)) seenContent = true;
      continue;
    }
    if (c === "{" || c === "(" || c === "[") {
      after++;
      seenContent = true;
    } else if (c === "}" || c === ")" || c === "]") {
      if (after > 0) after--;
      else if (!seenContent) before--;
      else after--;
    } else if (!/\s/.test(c)) {
      seenContent = true;
    }
  }
  return { before, after, opensRaw: "" };
}

/** Open/close tag balance for a line of markup. */
function htmlDelta(line: string) {
  let before = 0;
  let after = 0;
  let opensRaw = "";
  let seenContent = false;

  const re = /<(\/?)([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^<>])*)>|<!--[\s\S]*?-->/g;
  let m: RegExpExecArray | null;
  let lastEnd = 0;

  while ((m = re.exec(line))) {
    if (line.slice(lastEnd, m.index).trim().length > 0) seenContent = true;
    lastEnd = m.index + m[0].length;
    if (!m[2]) continue; // comment

    const tag = m[2].toLowerCase();
    if (VOID_TAGS.has(tag) || m[3].trimEnd().endsWith("/")) {
      seenContent = true;
      continue;
    }
    if (m[1]) {
      if (after > 0) after--;
      else if (!seenContent) before--;
      else after--;
    } else {
      after++;
      seenContent = true;
      if (RAW_TAGS.has(tag) && !new RegExp(`</${tag}`, "i").test(line.slice(lastEnd))) {
        opensRaw = tag;
      }
    }
  }
  return { before, after, opensRaw };
}
