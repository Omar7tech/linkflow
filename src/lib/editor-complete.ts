/**
 * Context-aware completions for the live editor.
 *
 * The suggestion list is derived from where the caret actually is — tag names
 * only after `<`, attributes only inside a tag, CSS values only after a colon —
 * because a flat dictionary of every keyword is noise. Whatever the static
 * tables miss is filled in from identifiers already present in the buffer, so
 * your own class and variable names complete too.
 */

import type { EditorLang } from "./editor-highlight";

export interface Completion {
  label: string;
  /** Text to insert; defaults to `label`. `|` marks the caret. */
  insert?: string;
  detail?: string;
}

export interface CompletionResult {
  items: Completion[];
  /** Range in the document the accepted item replaces. */
  from: number;
  to: number;
}

export interface CompletionContext {
  enabledLibraries?: readonly string[];
}

const MAX_ITEMS = 40;

const HTML_DOCUMENT_SNIPPETS: Completion[] = [
  {
    label: "!",
    insert: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My page</title>
</head>
<body>
  |
</body>
</html>`,
    detail: "HTML page",
  },
  {
    label: "html:5",
    insert: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My page</title>
</head>
<body>
  |
</body>
</html>`,
    detail: "HTML page",
  },
];

// A focused, beginner-friendly set of common Tailwind utilities. Suggestions
// are intentionally contextual and only appear when the Tailwind library is on.
const TAILWIND_CLASSES = [
  "container", "mx-auto", "m-0", "m-2", "m-4", "m-6", "m-8", "mt-2", "mt-4", "mt-8",
  "mb-2", "mb-4", "mb-8", "p-0", "p-2", "p-4", "p-6", "p-8", "px-2", "px-4", "px-6",
  "py-2", "py-3", "py-4", "space-x-2", "space-x-4", "space-y-2", "space-y-4", "gap-2",
  "gap-4", "gap-6", "block", "inline-block", "hidden", "flex", "inline-flex", "grid",
  "grid-cols-1", "grid-cols-2", "grid-cols-3", "items-start", "items-center", "items-end",
  "justify-start", "justify-center", "justify-between", "justify-end", "flex-col", "flex-wrap",
  "w-full", "w-screen", "w-1/2", "max-w-sm", "max-w-md", "max-w-lg", "max-w-2xl", "h-full",
  "h-screen", "min-h-screen", "relative", "absolute", "fixed", "sticky", "inset-0", "top-0",
  "right-0", "bottom-0", "left-0", "z-10", "z-50", "overflow-hidden", "overflow-auto",
  "rounded", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-full", "border",
  "border-0", "border-gray-200", "border-gray-700", "bg-white", "bg-black", "bg-transparent",
  "bg-gray-50", "bg-gray-100", "bg-gray-800", "bg-gray-900", "bg-blue-500", "bg-emerald-500",
  "bg-red-500", "text-left", "text-center", "text-right", "text-xs", "text-sm", "text-base",
  "text-lg", "text-xl", "text-2xl", "text-3xl", "text-4xl", "font-normal", "font-medium",
  "font-semibold", "font-bold", "text-white", "text-black", "text-gray-500", "text-gray-700",
  "text-gray-900", "text-blue-500", "text-emerald-500", "leading-tight", "leading-relaxed",
  "tracking-tight", "truncate", "shadow", "shadow-md", "shadow-lg", "shadow-xl", "opacity-0",
  "opacity-50", "opacity-100", "cursor-pointer", "select-none", "transition", "transition-colors",
  "duration-200", "duration-300", "hover:bg-blue-600", "hover:opacity-80", "hover:scale-105",
  "focus:outline-none", "focus:ring-2", "sm:flex", "sm:grid-cols-2", "md:flex", "md:grid-cols-2",
  "lg:grid-cols-3", "dark:bg-gray-900", "dark:text-white",
];

const LIBRARY_GLOBALS: Record<string, string[]> = {
  gsap: ["gsap", "ScrollTrigger"],
  three: ["THREE"],
  anime: ["anime"],
  p5: ["p5", "createCanvas", "background", "draw", "setup"],
  matter: ["Matter"],
  d3: ["d3"],
  chartjs: ["Chart"],
  alpine: ["Alpine"],
};

/* --------------------------------------------------------------- tables */

const HTML_TAGS = [
  "a", "abbr", "address", "article", "aside", "audio", "b", "blockquote", "body", "br", "button",
  "canvas", "caption", "code", "col", "colgroup", "datalist", "dd", "details", "dialog", "div",
  "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2",
  "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input",
  "ins", "kbd", "label", "legend", "li", "link", "main", "map", "mark", "menu", "meta", "meter",
  "nav", "noscript", "object", "ol", "optgroup", "option", "output", "p", "picture", "pre",
  "progress", "q", "s", "samp", "script", "section", "select", "slot", "small", "source", "span",
  "strong", "style", "sub", "summary", "sup", "svg", "table", "tbody", "td", "template",
  "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "u", "ul", "video", "wbr",
];

const GLOBAL_ATTRS = [
  "class", "id", "style", "title", "hidden", "tabindex", "role", "lang", "dir", "draggable",
  "contenteditable", "spellcheck", "data-", "aria-label", "aria-hidden", "aria-live",
  "aria-expanded", "aria-controls", "aria-describedby", "onclick", "oninput", "onchange",
  "onsubmit", "onmouseenter", "onmouseleave",
];

const TAG_ATTRS: Record<string, string[]> = {
  a: ["href", "target", "rel", "download", "hreflang"],
  img: ["src", "alt", "width", "height", "loading", "decoding", "srcset", "sizes"],
  input: ["type", "name", "value", "placeholder", "required", "disabled", "checked", "min", "max", "step", "pattern", "autocomplete", "readonly", "accept", "multiple"],
  button: ["type", "disabled", "form", "name", "value", "autofocus"],
  form: ["action", "method", "enctype", "target", "novalidate", "autocomplete"],
  link: ["rel", "href", "type", "media", "as", "crossorigin"],
  meta: ["name", "content", "charset", "property", "http-equiv"],
  script: ["src", "type", "async", "defer", "crossorigin", "integrity"],
  video: ["src", "controls", "autoplay", "loop", "muted", "poster", "playsinline", "preload", "width", "height"],
  audio: ["src", "controls", "autoplay", "loop", "muted", "preload"],
  iframe: ["src", "width", "height", "loading", "allow", "allowfullscreen", "sandbox", "title"],
  label: ["for"],
  option: ["value", "selected", "disabled"],
  select: ["name", "multiple", "required", "disabled", "size"],
  textarea: ["name", "rows", "cols", "placeholder", "required", "maxlength", "readonly"],
  table: ["border"],
  td: ["colspan", "rowspan", "headers"],
  th: ["colspan", "rowspan", "scope"],
  canvas: ["width", "height"],
  svg: ["viewBox", "width", "height", "fill", "stroke", "xmlns"],
  source: ["src", "srcset", "type", "media"],
  ol: ["start", "reversed", "type"],
  details: ["open"],
  dialog: ["open"],
};

const ATTR_VALUES: Record<string, string[]> = {
  type: ["text", "password", "email", "number", "tel", "url", "search", "date", "time", "checkbox", "radio", "range", "color", "file", "submit", "button", "hidden", "module", "text/css"],
  rel: ["stylesheet", "preconnect", "preload", "icon", "noopener", "noreferrer", "canonical", "alternate"],
  target: ["_blank", "_self", "_parent", "_top"],
  method: ["get", "post", "dialog"],
  loading: ["lazy", "eager"],
  decoding: ["async", "sync", "auto"],
  preload: ["none", "metadata", "auto"],
  dir: ["ltr", "rtl", "auto"],
  autocomplete: ["on", "off", "name", "email", "username", "current-password", "new-password"],
  crossorigin: ["anonymous", "use-credentials"],
  scope: ["row", "col", "rowgroup", "colgroup"],
};

const CSS_PROPERTIES = [
  "accent-color", "align-content", "align-items", "align-self", "animation", "animation-delay",
  "animation-direction", "animation-duration", "animation-fill-mode", "animation-iteration-count",
  "animation-name", "animation-timing-function", "aspect-ratio", "backdrop-filter",
  "backface-visibility", "background", "background-attachment", "background-blend-mode",
  "background-clip", "background-color", "background-image", "background-origin",
  "background-position", "background-repeat", "background-size", "block-size", "border",
  "border-bottom", "border-collapse", "border-color", "border-image", "border-left",
  "border-radius", "border-right", "border-spacing", "border-style", "border-top", "border-width",
  "bottom", "box-shadow", "box-sizing", "caret-color", "clip-path", "color", "color-scheme",
  "column-gap", "columns", "container", "container-type", "content", "cursor", "direction",
  "display", "filter", "flex", "flex-basis", "flex-direction", "flex-flow", "flex-grow",
  "flex-shrink", "flex-wrap", "float", "font", "font-family", "font-feature-settings",
  "font-size", "font-stretch", "font-style", "font-variant", "font-weight", "gap", "grid",
  "grid-area", "grid-auto-columns", "grid-auto-flow", "grid-auto-rows", "grid-column",
  "grid-row", "grid-template", "grid-template-areas", "grid-template-columns",
  "grid-template-rows", "height", "inline-size", "inset", "isolation", "justify-content",
  "justify-items", "justify-self", "left", "letter-spacing", "line-height", "list-style",
  "margin", "margin-block", "margin-bottom", "margin-inline", "margin-left", "margin-right",
  "margin-top", "mask", "max-height", "max-width", "min-height", "min-width", "mix-blend-mode",
  "object-fit", "object-position", "opacity", "order", "outline", "outline-offset", "overflow",
  "overflow-x", "overflow-y", "overscroll-behavior", "padding", "padding-block", "padding-bottom",
  "padding-inline", "padding-left", "padding-right", "padding-top", "perspective", "place-items",
  "place-content", "pointer-events", "position", "resize", "right", "rotate", "row-gap", "scale",
  "scroll-behavior", "scroll-margin", "scroll-padding", "scroll-snap-align", "scroll-snap-type",
  "text-align", "text-decoration", "text-indent", "text-overflow", "text-shadow",
  "text-transform", "text-wrap", "top", "touch-action", "transform", "transform-origin",
  "transform-style", "transition", "transition-delay", "transition-duration",
  "transition-property", "transition-timing-function", "translate", "user-select",
  "vertical-align", "visibility", "white-space", "width", "will-change", "word-break",
  "word-spacing", "writing-mode", "z-index",
];

const CSS_AT_RULES = ["media", "keyframes", "supports", "font-face", "import", "layer", "container", "property", "scope", "starting-style"];

const CSS_VALUES: Record<string, string[]> = {
  display: ["block", "inline", "inline-block", "flex", "inline-flex", "grid", "inline-grid", "none", "contents", "flow-root"],
  position: ["static", "relative", "absolute", "fixed", "sticky"],
  "flex-direction": ["row", "row-reverse", "column", "column-reverse"],
  "justify-content": ["flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly", "start", "end"],
  "align-items": ["flex-start", "flex-end", "center", "baseline", "stretch", "start", "end"],
  "align-content": ["flex-start", "flex-end", "center", "space-between", "space-around", "stretch"],
  "flex-wrap": ["nowrap", "wrap", "wrap-reverse"],
  overflow: ["visible", "hidden", "scroll", "auto", "clip"],
  "overflow-x": ["visible", "hidden", "scroll", "auto", "clip"],
  "overflow-y": ["visible", "hidden", "scroll", "auto", "clip"],
  cursor: ["pointer", "default", "text", "move", "grab", "grabbing", "not-allowed", "wait", "crosshair", "zoom-in"],
  "text-align": ["left", "right", "center", "justify", "start", "end"],
  "text-transform": ["none", "uppercase", "lowercase", "capitalize"],
  "text-decoration": ["none", "underline", "line-through", "overline"],
  "font-weight": ["100", "200", "300", "400", "500", "600", "700", "800", "900", "bold", "normal", "lighter", "bolder"],
  "font-style": ["normal", "italic", "oblique"],
  "white-space": ["normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces"],
  "object-fit": ["fill", "contain", "cover", "none", "scale-down"],
  "box-sizing": ["border-box", "content-box"],
  visibility: ["visible", "hidden", "collapse"],
  "pointer-events": ["auto", "none"],
  "user-select": ["none", "auto", "text", "all"],
  "mix-blend-mode": ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "difference", "exclusion", "hue", "saturation", "color", "luminosity"],
  "background-size": ["cover", "contain", "auto", "100% 100%"],
  "background-repeat": ["no-repeat", "repeat", "repeat-x", "repeat-y", "space", "round"],
  "background-position": ["center", "top", "bottom", "left", "right", "center center"],
  "border-style": ["solid", "dashed", "dotted", "double", "none"],
  "list-style": ["none", "disc", "circle", "square", "decimal"],
  "word-break": ["normal", "break-all", "keep-all", "break-word"],
  "text-wrap": ["wrap", "nowrap", "balance", "pretty"],
  "scroll-behavior": ["auto", "smooth"],
  "will-change": ["auto", "transform", "opacity", "scroll-position"],
  "transition-timing-function": ["ease", "ease-in", "ease-out", "ease-in-out", "linear", "cubic-bezier(0.4, 0, 0.2, 1)", "steps(4, end)"],
  "animation-timing-function": ["ease", "ease-in", "ease-out", "ease-in-out", "linear", "cubic-bezier(0.4, 0, 0.2, 1)"],
  "animation-iteration-count": ["infinite", "1", "2", "3"],
  "animation-fill-mode": ["none", "forwards", "backwards", "both"],
  "animation-direction": ["normal", "reverse", "alternate", "alternate-reverse"],
  "flex-flow": ["row wrap", "column nowrap"],
  "grid-template-columns": ["repeat(3, 1fr)", "repeat(auto-fit, minmax(200px, 1fr))", "1fr 1fr", "auto 1fr auto"],
  "grid-auto-flow": ["row", "column", "dense", "row dense"],
  filter: ["blur(8px)", "brightness(1.2)", "contrast(1.2)", "grayscale(1)", "saturate(1.5)", "drop-shadow(0 4px 12px rgb(0 0 0 / 25%))"],
  "backdrop-filter": ["blur(12px)", "blur(12px) saturate(1.4)"],
  transform: ["translate(0, 0)", "translateX(0)", "translateY(0)", "scale(1)", "rotate(0deg)", "translate(-50%, -50%)"],
  transition: ["all 0.2s ease", "transform 0.3s ease", "opacity 0.2s ease"],
  "box-shadow": ["0 1px 2px rgb(0 0 0 / 10%)", "0 10px 30px rgb(0 0 0 / 20%)", "inset 0 1px 0 rgb(255 255 255 / 20%)", "none"],
};

const CSS_UNIVERSAL_VALUES = ["inherit", "initial", "unset", "revert", "var(--)", "calc()", "clamp()", "min()", "max()"];

const JS_KEYWORDS = [
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch",
  "case", "break", "continue", "class", "extends", "new", "try", "catch", "finally", "throw",
  "typeof", "instanceof", "async", "await", "import", "export", "default", "delete", "yield",
  "static", "of", "in", "this", "null", "undefined", "true", "false",
];

const JS_GLOBALS = [
  "console", "document", "window", "Math", "JSON", "Object", "Array", "String", "Number",
  "Boolean", "Promise", "Date", "Map", "Set", "Symbol", "RegExp", "Error", "fetch", "setTimeout",
  "setInterval", "clearTimeout", "clearInterval", "requestAnimationFrame", "localStorage",
  "navigator", "location", "history", "structuredClone", "queueMicrotask", "performance",
  "IntersectionObserver", "ResizeObserver", "MutationObserver", "URL", "Intl", "crypto",
];

const JS_SNIPPETS: Completion[] = [
  { label: "querySelector", insert: "document.querySelector('|')", detail: "dom" },
  { label: "querySelectorAll", insert: "document.querySelectorAll('|')", detail: "dom" },
  { label: "getElementById", insert: "document.getElementById('|')", detail: "dom" },
  { label: "addEventListener", insert: "addEventListener('click', (event) => {\n  |\n})", detail: "event" },
  { label: "forEach", insert: "forEach((item) => {\n  |\n})", detail: "array" },
  { label: "map", insert: "map((item) => |)", detail: "array" },
  { label: "requestAnimationFrame", insert: "requestAnimationFrame(function loop() {\n  |\n  requestAnimationFrame(loop)\n})", detail: "loop" },
  { label: "setTimeout", insert: "setTimeout(() => {\n  |\n}, 1000)", detail: "timer" },
  { label: "fetch", insert: "fetch('|')\n  .then((r) => r.json())\n  .then((data) => console.log(data))", detail: "net" },
  { label: "canvas", insert: "const canvas = document.querySelector('canvas')\nconst ctx = canvas.getContext('2d')|", detail: "snippet" },
];

const JS_MEMBERS: Record<string, string[]> = {
  console: ["log", "warn", "error", "info", "table", "time", "timeEnd", "group", "groupEnd", "clear", "count", "trace", "dir", "assert"],
  document: ["querySelector", "querySelectorAll", "getElementById", "createElement", "createTextNode", "addEventListener", "body", "head", "documentElement", "title", "forms", "images"],
  window: ["addEventListener", "innerWidth", "innerHeight", "scrollY", "scrollX", "requestAnimationFrame", "matchMedia", "getComputedStyle", "location", "devicePixelRatio"],
  Math: ["abs", "ceil", "floor", "round", "min", "max", "random", "pow", "sqrt", "hypot", "sin", "cos", "tan", "atan2", "PI", "E", "sign", "trunc", "cbrt", "log", "log2"],
  JSON: ["stringify", "parse"],
  Object: ["keys", "values", "entries", "assign", "freeze", "fromEntries", "create", "defineProperty", "groupBy"],
  Array: ["from", "of", "isArray"],
  Promise: ["all", "allSettled", "race", "any", "resolve", "reject"],
  localStorage: ["getItem", "setItem", "removeItem", "clear", "key", "length"],
  navigator: ["clipboard", "userAgent", "language", "share", "mediaDevices", "geolocation"],
  location: ["href", "hash", "search", "pathname", "reload", "assign", "origin"],
  crypto: ["randomUUID", "getRandomValues", "subtle"],
  performance: ["now", "mark", "measure"],
  gsap: ["to", "from", "fromTo", "set", "timeline", "registerPlugin", "matchMedia", "utils"],
  ScrollTrigger: ["create", "refresh", "update", "getAll", "killAll", "batch"],
  THREE: ["Scene", "PerspectiveCamera", "WebGLRenderer", "Mesh", "BoxGeometry", "SphereGeometry", "MeshStandardMaterial", "Color", "Vector2", "Vector3", "Clock"],
  d3: ["select", "selectAll", "scaleLinear", "scaleBand", "axisBottom", "axisLeft", "extent", "max", "min", "line", "arc", "pie"],
  anime: ["timeline", "stagger", "random", "set", "remove"],
  Matter: ["Engine", "Render", "Runner", "Bodies", "Body", "Composite", "Composites", "Constraint", "Events", "Mouse", "MouseConstraint"],
  Chart: ["register", "getChart", "defaults", "overrides"],
};

/** Members offered after `.` when the receiver is unknown. */
const JS_COMMON_MEMBERS = [
  "length", "push", "pop", "shift", "unshift", "slice", "splice", "concat", "join", "indexOf",
  "includes", "find", "findIndex", "filter", "map", "reduce", "forEach", "some", "every", "sort",
  "reverse", "flat", "flatMap", "at", "trim", "toUpperCase", "toLowerCase", "split", "replace",
  "replaceAll", "startsWith", "endsWith", "padStart", "padEnd", "repeat", "match", "toFixed",
  "then", "catch", "finally", "addEventListener", "removeEventListener", "appendChild", "remove",
  "classList", "style", "textContent", "innerHTML", "dataset", "value", "checked",
  "getBoundingClientRect", "setAttribute", "getAttribute", "closest", "matches", "cloneNode",
  "getContext", "focus", "blur", "scrollIntoView", "animate",
];

/* -------------------------------------------------------------- helpers */

const wordStart = (value: string, caret: number, pattern: RegExp) => {
  let i = caret;
  while (i > 0 && pattern.test(value[i - 1])) i--;
  return i;
};

function rank(items: Completion[], prefix: string): Completion[] {
  if (!prefix) return items.slice(0, MAX_ITEMS);
  const lower = prefix.toLowerCase();
  const scored: { item: Completion; score: number }[] = [];

  for (const item of items) {
    const label = item.label.toLowerCase();
    if (label === lower && !item.insert) continue; // nothing left to complete
    if (label.startsWith(lower)) scored.push({ item, score: 0 });
    else if (label.includes(lower)) scored.push({ item, score: 1 });
    else if (isSubsequence(lower, label)) scored.push({ item, score: 2 });
  }

  scored.sort((a, b) => a.score - b.score || a.item.label.length - b.item.label.length);
  return scored.slice(0, MAX_ITEMS).map((s) => s.item);
}

function isSubsequence(needle: string, haystack: string) {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return false;
}

const toItems = (labels: string[], detail: string): Completion[] =>
  labels.map((label) => ({ label, detail }));

/** Identifiers already used in this pane, so your own names complete too. */
function bufferWords(value: string, prefix: string, exclude: Set<string>): Completion[] {
  if (prefix.length < 2) return [];
  const found = new Set<string>();
  const re = /[A-Za-z_$][\w$-]{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) && found.size < 400) {
    if (!exclude.has(m[0])) found.add(m[0]);
  }
  return [...found].map((label) => ({ label, detail: "local" }));
}

/* --------------------------------------------------------------- entry */

export function getCompletions(
  value: string,
  caret: number,
  lang: EditorLang,
  explicit: boolean,
  context: CompletionContext = {}
): CompletionResult | null {
  if (lang === "html") return htmlCompletions(value, caret, explicit, context);
  if (lang === "css") return cssCompletions(value, caret, explicit);
  return jsCompletions(value, caret, explicit, context);
}

function htmlCompletions(
  value: string,
  caret: number,
  explicit: boolean,
  context: CompletionContext
): CompletionResult | null {
  const before = value.slice(0, caret);
  const lastLt = before.lastIndexOf("<");
  const lastGt = before.lastIndexOf(">");

  // Outside any tag: only offer tags when the user asked for it.
  if (lastLt === -1 || lastLt < lastGt) {
    const from = wordStart(value, caret, /[\w:!-]/);
    const typed = value.slice(from, caret);
    const atDocumentStart = value.slice(0, from).trim() === "";
    if (!explicit && !(atDocumentStart && (typed === "!" || typed.startsWith("html:")))) return null;
    const pool = atDocumentStart
      ? [...HTML_DOCUMENT_SNIPPETS, ...toItems(HTML_TAGS, "tag")]
      : toItems(HTML_TAGS, "tag");
    return { items: rank(pool, typed), from, to: caret };
  }

  const inside = before.slice(lastLt);
  const tagMatch = /^<\/?([a-zA-Z][\w:.-]*)/.exec(inside);

  // Still typing the tag name.
  if (!tagMatch || /^<\/?[\w:.-]*$/.test(inside)) {
    const from = wordStart(value, caret, /[\w:.-]/);
    return { items: rank(toItems(HTML_TAGS, "tag"), value.slice(from, caret)), from, to: caret };
  }

  const tag = tagMatch[1].toLowerCase();
  const afterName = inside.slice(tagMatch[0].length);

  // Inside a quoted attribute value.
  const quoteMatch = /([\w:-]+)\s*=\s*(["'])([^"']*)$/.exec(afterName);
  if (quoteMatch) {
    const [, attr, , typed] = quoteMatch;
    if (attr.toLowerCase() === "class" && context.enabledLibraries?.includes("tailwind")) {
      const currentClass = /[^\s]*$/.exec(typed)?.[0] ?? "";
      const from = caret - currentClass.length;
      const items = rank(toItems(TAILWIND_CLASSES, "Tailwind"), currentClass);
      return items.length ? { items, from, to: caret } : null;
    }
    const pool = ATTR_VALUES[attr.toLowerCase()];
    if (!pool) return null;
    const from = caret - typed.length;
    return { items: rank(toItems(pool, "value"), typed), from, to: caret };
  }

  const from = wordStart(value, caret, /[\w:-]/);
  const prefix = value.slice(from, caret);
  if (!prefix && !explicit) return null;

  const attrs = [...(TAG_ATTRS[tag] ?? []), ...GLOBAL_ATTRS];
  const items = attrs.map((label) => ({
    label,
    insert: label.endsWith("-") ? label : `${label}="|"`,
    detail: "attr",
  }));
  return { items: rank(items, prefix), from, to: caret };
}

function cssCompletions(value: string, caret: number, explicit: boolean): CompletionResult | null {
  const before = value.slice(0, caret);
  const lineStart = before.lastIndexOf("\n") + 1;
  const line = before.slice(lineStart);

  // `@` rules.
  const atMatch = /@([\w-]*)$/.exec(line);
  if (atMatch) {
    const from = caret - atMatch[1].length;
    return { items: rank(toItems(CSS_AT_RULES, "at-rule"), atMatch[1]), from, to: caret };
  }

  const openBraces = (before.match(/\{/g) ?? []).length;
  const closeBraces = (before.match(/\}/g) ?? []).length;
  const inBlock = openBraces > closeBraces;

  const colon = line.lastIndexOf(":");
  const semicolon = line.lastIndexOf(";");

  // Value position — after `prop:` and before the next `;`.
  if (inBlock && colon > semicolon && colon !== -1) {
    // The property starts after the last separator on the line, which is the
    // `{` when the rule was opened on this same line.
    const propStart = Math.max(semicolon, line.lastIndexOf("{", colon)) + 1;
    const prop = line.slice(propStart, colon).trim();
    const from = wordStart(value, caret, /[\w%().,#-]/);
    const typed = value.slice(from, caret);
    const pool = [
      ...toItems(CSS_VALUES[prop] ?? [], prop),
      ...toItems(CSS_UNIVERSAL_VALUES, "global"),
    ];
    const items = rank([...pool, ...bufferWords(value, typed, new Set(CSS_PROPERTIES))], typed);
    return items.length ? { items, from, to: caret } : null;
  }

  if (!inBlock && !explicit) return null;

  const from = wordStart(value, caret, /[\w-]/);
  const typed = value.slice(from, caret);
  if (!typed && !explicit) return null;

  const items = rank(
    CSS_PROPERTIES.map((label) => ({ label, insert: `${label}: |;`, detail: "prop" })),
    typed
  );
  return items.length ? { items, from, to: caret } : null;
}

function jsCompletions(
  value: string,
  caret: number,
  explicit: boolean,
  context: CompletionContext
): CompletionResult | null {
  const before = value.slice(0, caret);

  // Member access.
  const member = /([\w$\]).]*?)\.([\w$]*)$/.exec(before);
  if (member) {
    const receiver = /([\w$]+)$/.exec(member[1])?.[1] ?? "";
    const typed = member[2];
    const from = caret - typed.length;
    const pool = JS_MEMBERS[receiver] ?? JS_COMMON_MEMBERS;
    const items = rank(toItems(pool, receiver || "member"), typed);
    return items.length ? { items, from, to: caret } : null;
  }

  const from = wordStart(value, caret, /[\w$]/);
  const typed = value.slice(from, caret);
  if (typed.length < 1 && !explicit) return null;

  const known = new Set([...JS_KEYWORDS, ...JS_GLOBALS]);
  const libraryGlobals = (context.enabledLibraries ?? []).flatMap(
    (library) => LIBRARY_GLOBALS[library] ?? []
  );
  const items = rank(
    [
      ...toItems(JS_KEYWORDS, "keyword"),
      ...toItems(JS_GLOBALS, "global"),
      ...toItems(libraryGlobals, "library"),
      ...JS_SNIPPETS,
      ...bufferWords(value, typed, known),
    ],
    typed
  );
  return items.length ? { items, from, to: caret } : null;
}
