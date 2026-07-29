/**
 * Live editor core: what a sketch is, how it becomes a runnable document, and
 * how it leaves the page (link, single file, zip).
 *
 * The preview runs in an iframe sandboxed *without* `allow-same-origin`, so the
 * page you write gets a unique opaque origin: it can't read this document, our
 * storage or our cookies, no matter what it executes. Everything the preview
 * needs to talk back about — console output, errors, the element inspector —
 * goes through one postMessage bridge injected ahead of your code, stamped with
 * a per-session token so unrelated frames can't spoof it.
 */

export interface Sketch {
  id: string;
  name: string;
  html: string;
  css: string;
  js: string;
  /** Ids from `EDITOR_LIBRARIES`. */
  libs: string[];
  updatedAt: number;
}

export type PaneId = "html" | "css" | "js";

export const STORAGE_KEYS = {
  sketches: "forma:live-editor:sketches",
  current: "forma:live-editor:current",
  settings: "forma:live-editor:settings",
} as const;

export function createSketch(partial: Partial<Sketch> = {}): Sketch {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: "Untitled sketch",
    html: "",
    css: "",
    js: "",
    libs: [],
    updatedAt: Date.now(),
    ...partial,
  };
}

/* ---------------------------------------------------------- libraries */

export interface EditorLibrary {
  id: string;
  name: string;
  /** What it's for, in one line. */
  blurb: string;
  /** Markup injected into `<head>`. */
  tags: string;
}

export const EDITOR_LIBRARIES: readonly EditorLibrary[] = [
  {
    id: "tailwind",
    name: "Tailwind CSS",
    blurb: "Utility classes, compiled in the browser",
    tags: `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></${"script"}>`,
  },
  {
    id: "gsap",
    name: "GSAP + ScrollTrigger",
    blurb: "Timeline animation and scroll triggers",
    tags:
      `<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></${"script"}>` +
      `<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></${"script"}>`,
  },
  {
    id: "three",
    name: "Three.js",
    blurb: "WebGL scenes, meshes and shaders",
    tags: `<script src="https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js"></${"script"}>`,
  },
  {
    id: "anime",
    name: "Anime.js",
    blurb: "Small, expressive animation engine",
    tags: `<script src="https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"></${"script"}>`,
  },
  {
    id: "p5",
    name: "p5.js",
    blurb: "Creative coding sketches on canvas",
    tags: `<script src="https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/p5.min.js"></${"script"}>`,
  },
  {
    id: "matter",
    name: "Matter.js",
    blurb: "2D rigid-body physics",
    tags: `<script src="https://cdn.jsdelivr.net/npm/matter-js@0.19.0/build/matter.min.js"></${"script"}>`,
  },
  {
    id: "d3",
    name: "D3",
    blurb: "Data-driven documents and charts",
    tags: `<script src="https://cdn.jsdelivr.net/npm/d3@7"></${"script"}>`,
  },
  {
    id: "chartjs",
    name: "Chart.js",
    blurb: "Ready-made canvas charts",
    tags: `<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></${"script"}>`,
  },
  {
    id: "alpine",
    name: "Alpine.js",
    blurb: "Reactive bindings straight in markup",
    tags: `<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></${"script"}>`,
  },
  {
    id: "normalize",
    name: "Modern Normalize",
    blurb: "Cross-browser CSS baseline",
    tags: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/modern-normalize@3/modern-normalize.min.css">`,
  },
  {
    id: "inter",
    name: "Inter (Google Fonts)",
    blurb: "Variable UI typeface",
    tags:
      `<link rel="preconnect" href="https://fonts.googleapis.com">` +
      `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
      `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300..800&display=swap">`,
  },
  {
    id: "fontawesome",
    name: "Font Awesome",
    blurb: "Icon font for classic <i> markup",
    tags: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6/css/all.min.css">`,
  },
];

export const LIBRARY_BY_ID = new Map(EDITOR_LIBRARIES.map((l) => [l.id, l]));

/* ------------------------------------------------------------- bridge */

/**
 * Runtime injected into the preview before anything else.
 *
 * Written as a plain string rather than a module so it can be inlined into
 * `srcdoc` — the frame has no origin, so it can't fetch anything of ours.
 * `__TOKEN__` is swapped for a per-session value the parent checks on receipt.
 */
const BRIDGE = String.raw`
(function () {
  var TOKEN = "__TOKEN__";
  var MAX_MESSAGES = 2000;
  var sent = 0;

  function post(type, payload) {
    if (sent > MAX_MESSAGES) return;
    sent++;
    if (sent === MAX_MESSAGES) {
      type = "console";
      payload = { level: "warn", parts: ["Console output muted — too many messages from this run."] };
    }
    try { parent.postMessage({ source: TOKEN, type: type, payload: payload }, "*"); } catch (e) {}
  }

  /* ---- value formatting ---- */

  function typeName(value) {
    return Object.prototype.toString.call(value).slice(8, -1);
  }

  function format(value, depth, seen) {
    depth = depth || 0;
    seen = seen || [];
    if (value === null) return "null";
    if (value === undefined) return "undefined";

    var t = typeof value;
    if (t === "string") return depth === 0 ? value : '"' + value + '"';
    if (t === "number" || t === "boolean" || t === "bigint") return String(value);
    if (t === "symbol") return value.toString();
    if (t === "function") return (value.name ? "ƒ " + value.name + "()" : "ƒ ()");

    if (value instanceof Error) return value.stack || (value.name + ": " + value.message);
    if (typeof Node !== "undefined" && value instanceof Node) {
      if (value.nodeType === 1) {
        var tag = value.tagName.toLowerCase();
        var id = value.id ? "#" + value.id : "";
        var cls = value.className && typeof value.className === "string"
          ? "." + value.className.trim().split(/\s+/).join(".")
          : "";
        return "<" + tag + id + cls + ">";
      }
      return String(value.nodeName);
    }

    if (seen.indexOf(value) !== -1) return "[Circular]";
    if (depth > 3) return Array.isArray(value) ? "[…]" : "{…}";
    seen = seen.concat([value]);

    if (Array.isArray(value)) {
      var items = value.slice(0, 100).map(function (v) { return format(v, depth + 1, seen); });
      if (value.length > 100) items.push("… " + (value.length - 100) + " more");
      return "[" + items.join(", ") + "]";
    }

    var kind = typeName(value);
    if (kind === "Map") {
      var pairs = [];
      value.forEach(function (v, k) {
        if (pairs.length < 30) pairs.push(format(k, depth + 1, seen) + " => " + format(v, depth + 1, seen));
      });
      return "Map(" + value.size + ") {" + pairs.join(", ") + "}";
    }
    if (kind === "Set") {
      var vals = [];
      value.forEach(function (v) { if (vals.length < 30) vals.push(format(v, depth + 1, seen)); });
      return "Set(" + value.size + ") {" + vals.join(", ") + "}";
    }
    if (kind === "Date") return value.toISOString();
    if (kind === "RegExp") return String(value);

    var keys = Object.keys(value);
    var shown = keys.slice(0, 30).map(function (k) {
      return k + ": " + format(value[k], depth + 1, seen);
    });
    if (keys.length > 30) shown.push("… " + (keys.length - 30) + " more");
    var prefix = value.constructor && value.constructor.name && value.constructor.name !== "Object"
      ? value.constructor.name + " "
      : "";
    return prefix + "{" + shown.join(", ") + "}";
  }

  function emit(level, args) {
    var parts = [];
    for (var i = 0; i < args.length; i++) parts.push(format(args[i], 0, []));
    post("console", { level: level, parts: parts });
  }

  /* ---- console ---- */

  var native = {};
  ["log", "info", "warn", "error", "debug", "table", "dir", "trace"].forEach(function (name) {
    native[name] = console[name] ? console[name].bind(console) : function () {};
    console[name] = function () {
      emit(name === "debug" || name === "dir" || name === "table" || name === "trace" ? "log" : name, arguments);
      native[name].apply(console, arguments);
    };
  });

  var counters = {};
  var timers = {};
  console.count = function (label) {
    label = label || "default";
    counters[label] = (counters[label] || 0) + 1;
    post("console", { level: "log", parts: [label + ": " + counters[label]] });
  };
  console.time = function (label) { timers[label || "default"] = performance.now(); };
  console.timeEnd = function (label) {
    label = label || "default";
    var start = timers[label];
    if (start === undefined) return;
    delete timers[label];
    post("console", { level: "log", parts: [label + ": " + (performance.now() - start).toFixed(2) + "ms"] });
  };
  console.clear = function () { post("clear", null); };
  console.group = function () { emit("log", arguments); };
  console.groupEnd = function () {};
  console.assert = function (ok) {
    if (!ok) emit("error", ["Assertion failed"].concat([].slice.call(arguments, 1)));
  };

  /* ---- errors ---- */

  window.addEventListener("error", function (event) {
    if (event.message) {
      post("console", {
        level: "error",
        parts: [event.message + (event.lineno ? "  (line " + event.lineno + ")" : "")],
      });
    } else if (event.target && event.target.src) {
      post("console", { level: "error", parts: ["Failed to load " + event.target.src] });
    }
  }, true);

  window.addEventListener("unhandledrejection", function (event) {
    post("console", { level: "error", parts: ["Uncaught (in promise) " + format(event.reason, 0, [])] });
  });

  /* ---- storage shim ----
     An opaque origin throws on localStorage access, which breaks otherwise fine
     demo code. A memory-backed stand-in keeps those snippets running. */
  try {
    void window.localStorage.length;
  } catch (e) {
    var mem = {};
    var shim = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      clear: function () { mem = {}; },
      key: function (i) { return Object.keys(mem)[i] || null; },
      get length() { return Object.keys(mem).length; }
    };
    try {
      Object.defineProperty(window, "localStorage", { value: shim, configurable: true });
      Object.defineProperty(window, "sessionStorage", { value: shim, configurable: true });
    } catch (err) {}
  }

  /* ---- element inspector ---- */

  var overlay = null;
  var badge = null;
  var inspecting = false;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;border:1px solid #34d399;background:rgba(52,211,153,0.16);border-radius:2px;transition:all 60ms linear;display:none";
    badge = document.createElement("div");
    badge.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;font:600 11px ui-monospace,monospace;background:#0f766e;color:#ecfdf5;padding:2px 6px;border-radius:4px;white-space:nowrap;display:none";
    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(badge);
  }

  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el === document.body) return "body";
    var part = el.tagName.toLowerCase();
    if (el.id) return part + "#" + el.id;
    if (el.className && typeof el.className === "string") {
      var classes = el.className.trim().split(/\s+/).slice(0, 2);
      if (classes[0]) part += "." + classes.join(".");
    }
    var parent = el.parentElement;
    if (parent) {
      var sameTag = [].filter.call(parent.children, function (c) { return c.tagName === el.tagName; });
      if (sameTag.length > 1) part += ":nth-of-type(" + ([].indexOf.call(sameTag, el) + 1) + ")";
      if (parent !== document.body && parent !== document.documentElement) {
        return selectorFor(parent) + " > " + part;
      }
    }
    return part;
  }

  function describe(el) {
    var rect = el.getBoundingClientRect();
    var tag = el.tagName.toLowerCase();
    return {
      selector: selectorFor(el),
      tag: tag,
      /* Position among same-tag elements — lets the editor jump to the source. */
      index: [].indexOf.call(document.getElementsByTagName(tag), el),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  function paintOverlay(el) {
    ensureOverlay();
    var rect = el.getBoundingClientRect();
    overlay.style.display = "block";
    overlay.style.left = rect.left + "px";
    overlay.style.top = rect.top + "px";
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";

    var info = describe(el);
    badge.style.display = "block";
    badge.textContent = info.selector + "  " + info.width + "×" + info.height;
    badge.style.left = rect.left + "px";
    badge.style.top = (rect.top > 22 ? rect.top - 22 : rect.bottom + 4) + "px";
    return info;
  }

  function onMove(event) {
    if (!inspecting) return;
    var el = event.target;
    if (!el || el.nodeType !== 1 || el === overlay || el === badge) return;
    post("inspect-hover", paintOverlay(el));
  }

  function onPick(event) {
    if (!inspecting) return;
    event.preventDefault();
    event.stopPropagation();
    var el = event.target;
    if (el && el.nodeType === 1) post("inspect-pick", describe(el));
  }

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onPick, true);
  document.addEventListener("mouseleave", function () {
    if (overlay) { overlay.style.display = "none"; badge.style.display = "none"; }
  });

  /* ---- parent commands ---- */

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== TOKEN) return;

    if (data.type === "css") {
      var style = document.getElementById("__ed-user-css");
      if (style) style.textContent = data.payload;
      return;
    }

    if (data.type === "inspect") {
      inspecting = !!data.payload;
      ensureOverlay();
      if (!inspecting) { overlay.style.display = "none"; badge.style.display = "none"; }
      document.documentElement.style.cursor = inspecting ? "crosshair" : "";
      return;
    }

    if (data.type === "eval") {
      try {
        var result = (0, eval)(data.payload.code);
        post("eval-result", { id: data.payload.id, text: format(result, 0, []), ok: true });
      } catch (err) {
        post("eval-result", { id: data.payload.id, text: String(err), ok: false });
      }
    }
  });

  window.addEventListener("DOMContentLoaded", function () {
    post("ready", { title: document.title });
  });
  post("boot", null);
})();
`;

/* ------------------------------------------------------- document build */

const DEFAULT_STYLE = `*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }`;

const isFullDocument = (html: string) => /^\s*(<!doctype|<html[\s>])/i.test(html);

/**
 * A literal `</script` inside inline JS would close the tag early. Escaping the
 * slash is invisible to the JS parser — `"<\/script>"` is the same string — so
 * the code runs unchanged.
 */
const inlineScript = (js: string) => js.replace(/<\/script/gi, String.raw`<\/script`);

/** Assembles the runnable document for the preview frame. */
export function buildPreviewDocument(
  sketch: Pick<Sketch, "html" | "css" | "js" | "libs">,
  options: { token: string }
): string {
  const bridge = `<script>${BRIDGE.replace("__TOKEN__", options.token)}</${"script"}>`;
  const libs = sketch.libs
    .map((id) => LIBRARY_BY_ID.get(id)?.tags ?? "")
    .join("\n");
  const style = `<style id="__ed-user-css">${sketch.css}</style>`;
  const script = sketch.js.trim() ? `<script>${inlineScript(sketch.js)}</${"script"}>` : "";

  if (isFullDocument(sketch.html)) {
    // The markup pane holds a whole page — thread our pieces into it instead of
    // wrapping, so the author's own <head> and attributes survive.
    let doc = sketch.html;
    doc = doc.includes("<head>")
      ? doc.replace("<head>", `<head>${bridge}`)
      : doc.replace(/(<html[^>]*>)/i, `$1<head>${bridge}</head>`);
    doc = doc.includes("</head>")
      ? doc.replace("</head>", `${libs}${style}</head>`)
      : doc.replace("<body", `${libs}${style}<body`);
    doc = doc.includes("</body>") ? doc.replace("</body>", `${script}</body>`) : doc + script;
    return doc;
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${bridge}
<style>${DEFAULT_STYLE}</style>
${libs}
${style}
</head>
<body>
${sketch.html}
${script}
</body>
</html>`;
}

/* -------------------------------------------------------------- export */

/** A standalone file that runs anywhere — no bridge, no editor scaffolding. */
export function exportSingleFile(sketch: Sketch): string {
  const libs = sketch.libs.map((id) => LIBRARY_BY_ID.get(id)?.tags ?? "").join("\n");
  if (isFullDocument(sketch.html)) {
    let doc = sketch.html;
    const style = sketch.css.trim() ? `<style>\n${sketch.css}\n</style>` : "";
    const script = sketch.js.trim() ? `<script>\n${inlineScript(sketch.js)}\n</${"script"}>` : "";
    doc = doc.includes("</head>") ? doc.replace("</head>", `${libs}\n${style}\n</head>`) : doc;
    doc = doc.includes("</body>") ? doc.replace("</body>", `${script}\n</body>`) : doc + script;
    return doc;
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(sketch.name)}</title>
${libs}
<style>
${DEFAULT_STYLE}

${sketch.css}
</style>
</head>
<body>
${sketch.html}
${sketch.js.trim() ? `<script>\n${inlineScript(sketch.js)}\n</${"script"}>` : ""}
</body>
</html>
`;
}

/** Split project files, for the zip download. */
export function exportProjectFiles(sketch: Sketch): { name: string; content: string }[] {
  const libs = sketch.libs.map((id) => LIBRARY_BY_ID.get(id)?.tags ?? "").join("\n");
  const html = isFullDocument(sketch.html)
    ? sketch.html
        .replace("</head>", `${libs}\n<link rel="stylesheet" href="style.css">\n</head>`)
        .replace("</body>", `<script src="script.js"></${"script"}>\n</body>`)
    : `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(sketch.name)}</title>
${libs}
<link rel="stylesheet" href="style.css">
</head>
<body>
${sketch.html}
<script src="script.js"></${"script"}>
</body>
</html>
`;

  return [
    { name: "index.html", content: html },
    { name: "style.css", content: `${DEFAULT_STYLE}\n\n${sketch.css}` },
    { name: "script.js", content: sketch.js },
  ];
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Filename-safe version of the sketch name. */
export function sketchSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "sketch"
  );
}

/* --------------------------------------------------------------- share */

interface SharePayload {
  n: string;
  h: string;
  c: string;
  j: string;
  l: string[];
}

const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (text: string) => {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Packs a sketch into a URL fragment. Deflate typically buys 3–4× on source
 * code, which is the difference between a shareable link and one that gets
 * truncated by chat apps. The `z`/`u` prefix records which encoding was used so
 * links still open in browsers without CompressionStream.
 */
export async function encodeSketchToHash(sketch: Sketch): Promise<string> {
  const payload: SharePayload = {
    n: sketch.name,
    h: sketch.html,
    c: sketch.css,
    j: sketch.js,
    l: sketch.libs,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const packed = await deflate(bytes);
  return packed ? `z${toBase64Url(packed)}` : `u${toBase64Url(bytes)}`;
}

export async function decodeSketchFromHash(hash: string): Promise<Sketch | null> {
  try {
    const mode = hash[0];
    const bytes = fromBase64Url(hash.slice(1));
    const raw = mode === "z" ? await inflate(bytes) : bytes;
    const payload = JSON.parse(new TextDecoder().decode(raw)) as SharePayload;
    if (typeof payload.h !== "string") return null;
    return createSketch({
      name: payload.n || "Shared sketch",
      html: payload.h ?? "",
      css: payload.c ?? "",
      js: payload.j ?? "",
      libs: Array.isArray(payload.l) ? payload.l.filter((id) => LIBRARY_BY_ID.has(id)) : [],
    });
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------- misc */

/** Human-readable byte count for the status bar. */
export function formatBytes(count: number): string {
  if (count < 1024) return `${count} B`;
  return `${(count / 1024).toFixed(count < 10240 ? 1 : 0)} KB`;
}

/**
 * Finds the source offset of the `index`-th element with this tag, so clicking
 * something in the preview can scroll the markup pane to it. Elements created
 * by scripts have no source to point at, hence the `null`.
 */
export function findTagOffset(html: string, tag: string, index: number): number | null {
  const re = new RegExp(`<${tag}(?=[\\s/>])`, "gi");
  let match: RegExpExecArray | null;
  let seen = 0;
  while ((match = re.exec(html))) {
    if (seen === index) return match.index;
    seen++;
  }
  return null;
}
