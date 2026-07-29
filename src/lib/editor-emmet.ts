/**
 * Emmet-style abbreviation expansion.
 *
 * `nav.menu>ul>li.item$*4>a[href=#]{Item $}` becomes real markup on Tab. This
 * is a focused subset — child/sibling/climb/grouping operators, multipliers,
 * `$` numbering, id/class/attribute/text shorthand and implicit tag names —
 * which covers what people actually type in a scratch playground.
 *
 * The CSS half is a lookup table with a numeric-suffix rule (`p20` →
 * `padding: 20px;`), the other thing worth muscle memory.
 */

/** Where the caret should end up, stripped out by the caller. */
export const CARET = "\u0000";

interface EmmetNode {
  name: string;
  id: string;
  classes: string[];
  attrs: [string, string][];
  text: string | null;
  repeat: number;
  children: EmmetNode[];
  /** A `(…)` group renders its children with no wrapper of its own. */
  group: boolean;
}

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
]);

/** Rendered on one line when they only hold text. */
const INLINE_TAGS = new Set([
  "a", "abbr", "b", "button", "cite", "code", "em", "i", "kbd", "label", "li",
  "mark", "option", "p", "q", "s", "small", "span", "strong", "sub", "sup",
  "td", "th", "time", "title", "u", "h1", "h2", "h3", "h4", "h5", "h6",
]);

/** Attributes Emmet fills in for you, with the caret parked in the first one. */
const IMPLIED_ATTRS: Record<string, [string, string][]> = {
  a: [["href", ""]],
  img: [["src", ""], ["alt", ""]],
  input: [["type", "text"]],
  link: [["rel", "stylesheet"], ["href", ""]],
  script: [["src", ""]],
  form: [["action", ""]],
  iframe: [["src", ""], ["frameborder", "0"]],
  source: [["src", ""]],
  video: [["src", ""], ["controls", ""]],
  audio: [["src", ""], ["controls", ""]],
};

/** Tag implied by the parent when the abbreviation starts with `.` or `#`. */
function implicitTag(parent: string | null): string {
  switch (parent) {
    case "ul":
    case "ol":
      return "li";
    case "table":
    case "tbody":
    case "thead":
    case "tfoot":
      return "tr";
    case "tr":
      return "td";
    case "select":
    case "optgroup":
      return "option";
    case "dl":
      return "dt";
    case "map":
      return "area";
    default:
      return "div";
  }
}

const HTML5_BOILERPLATE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${CARET}Document</title>
</head>
<body>

</body>
</html>`;

/** One-shot abbreviations that aren't worth running through the parser. */
const SNIPPETS: Record<string, string> = {
  "!": HTML5_BOILERPLATE,
  "!!!": HTML5_BOILERPLATE,
  "html:5": HTML5_BOILERPLATE,
  "link:css": `<link rel="stylesheet" href="${CARET}style.css">`,
  "script:src": `<script src="${CARET}"></${"script"}>`,
  "meta:vp": `<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
  "meta:utf": `<meta charset="UTF-8">`,
  "form:post": `<form action="${CARET}" method="post">\n\n</form>`,
  "btn": `<button type="button">${CARET}</button>`,
};

/* ------------------------------------------------------------- parsing */

class Parser {
  private i = 0;
  private readonly src: string;

  constructor(src: string) {
    this.src = src;
  }

  parse(): EmmetNode[] | null {
    const { nodes } = this.sequence();
    if (this.i < this.src.length) return null; // trailing junk — not an abbreviation
    return nodes.length ? nodes : null;
  }

  private peek() {
    return this.src[this.i] ?? "";
  }

  /**
   * Parses siblings until the input ends, a group closes, or a `^` climbs out.
   * The returned `climb` is how many levels the caller still has to pop.
   */
  private sequence(): { nodes: EmmetNode[]; climb: number } {
    const nodes: EmmetNode[] = [];

    for (;;) {
      const atom = this.atom();
      if (!atom) return { nodes, climb: 0 };
      nodes.push(atom);

      if (this.peek() === ">") {
        this.i++;
        const inner = this.sequence();
        atom.children.push(...inner.nodes);
        if (inner.climb > 0) {
          const remaining = inner.climb - 1;
          if (remaining > 0) return { nodes, climb: remaining };
          continue; // the climb landed here — keep taking siblings
        }
      }

      if (this.peek() === "+") {
        this.i++;
        continue;
      }
      if (this.peek() === "^") {
        let levels = 0;
        while (this.peek() === "^") {
          levels++;
          this.i++;
        }
        return { nodes, climb: levels };
      }
      return { nodes, climb: 0 };
    }
  }

  private atom(): EmmetNode | null {
    if (this.peek() === "(") {
      this.i++;
      const inner = this.sequence();
      if (this.peek() !== ")") return null;
      this.i++;
      const node = blankNode();
      node.group = true;
      node.children = inner.nodes;
      node.repeat = this.multiplier();
      return node;
    }

    const node = blankNode();
    node.name = this.ident();
    let sawModifier = false;

    for (;;) {
      const c = this.peek();
      if (c === "#") {
        this.i++;
        node.id = this.ident();
        sawModifier = true;
      } else if (c === ".") {
        this.i++;
        const cls = this.ident();
        if (!cls) return null;
        node.classes.push(cls);
        sawModifier = true;
      } else if (c === "[") {
        this.i++;
        if (!this.attributes(node)) return null;
        sawModifier = true;
      } else if (c === "{") {
        this.i++;
        const text = this.braced();
        if (text === null) return null;
        node.text = text;
        sawModifier = true;
      } else {
        break;
      }
    }

    if (!node.name && !sawModifier) return null;
    node.repeat = this.multiplier();
    return node;
  }

  private ident(): string {
    const start = this.i;
    while (this.i < this.src.length && /[\w$@:!-]/.test(this.src[this.i])) this.i++;
    return this.src.slice(start, this.i);
  }

  private multiplier(): number {
    if (this.peek() !== "*") return 1;
    this.i++;
    const start = this.i;
    while (/\d/.test(this.peek())) this.i++;
    const n = Number(this.src.slice(start, this.i));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 1;
  }

  /** `[href=# title="hi" disabled]` */
  private attributes(node: EmmetNode): boolean {
    for (;;) {
      while (this.peek() === " ") this.i++;
      if (this.peek() === "]") {
        this.i++;
        return true;
      }
      if (this.i >= this.src.length) return false;

      const start = this.i;
      while (this.i < this.src.length && /[\w:.@$-]/.test(this.src[this.i])) this.i++;
      const name = this.src.slice(start, this.i);
      if (!name) return false;

      let value = "";
      if (this.peek() === "=") {
        this.i++;
        const quote = this.peek();
        if (quote === '"' || quote === "'") {
          this.i++;
          const from = this.i;
          while (this.i < this.src.length && this.src[this.i] !== quote) this.i++;
          value = this.src.slice(from, this.i);
          this.i++;
        } else {
          const from = this.i;
          while (this.i < this.src.length && !/[\s\]]/.test(this.src[this.i])) this.i++;
          value = this.src.slice(from, this.i);
        }
      }
      node.attrs.push([name, value]);
    }
  }

  /** Text between `{}`, allowing balanced nested braces. */
  private braced(): string | null {
    let depth = 1;
    const start = this.i;
    while (this.i < this.src.length) {
      const c = this.src[this.i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          const text = this.src.slice(start, this.i);
          this.i++;
          return text;
        }
      }
      this.i++;
    }
    return null;
  }
}

function blankNode(): EmmetNode {
  return { name: "", id: "", classes: [], attrs: [], text: null, repeat: 1, children: [], group: false };
}

/* ------------------------------------------------------------ numbering */

/** Replaces `$` runs with the repeat index — `$$` pads to two digits. */
function numbered(text: string, index: number, total: number): string {
  return text.replace(/(\$+)(@(-)?(\d+)?)?/g, (_, dollars: string, mod: string, reverse: string, base: string) => {
    const start = base ? Number(base) : 1;
    const value = reverse ? total - index + start - 1 : index + start - 1;
    return String(value).padStart(dollars.length, "0");
  });
}

/* ------------------------------------------------------------ rendering */

interface RenderState {
  tabSize: number;
  caretPlaced: boolean;
}

function renderNodes(
  nodes: EmmetNode[],
  depth: number,
  parentTag: string | null,
  state: RenderState
): string[] {
  const lines: string[] = [];

  for (const node of nodes) {
    for (let n = 1; n <= node.repeat; n++) {
      if (node.group) {
        lines.push(...renderNodes(node.children, depth, parentTag, state));
        continue;
      }
      lines.push(...renderElement(node, depth, parentTag, n, node.repeat, state));
    }
  }
  return lines;
}

function renderElement(
  node: EmmetNode,
  depth: number,
  parentTag: string | null,
  index: number,
  total: number,
  state: RenderState
): string[] {
  const pad = " ".repeat(depth * state.tabSize);
  const tag = (node.name ? numbered(node.name, index, total) : implicitTag(parentTag)).toLowerCase();

  const attrs: [string, string][] = [];
  if (node.id) attrs.push(["id", numbered(node.id, index, total)]);
  if (node.classes.length)
    attrs.push(["class", node.classes.map((c) => numbered(c, index, total)).join(" ")]);
  for (const [name, value] of node.attrs) attrs.push([name, numbered(value, index, total)]);

  // Fill in the attributes Emmet implies, without overriding explicit ones.
  for (const [name, value] of IMPLIED_ATTRS[tag] ?? []) {
    if (!attrs.some(([n]) => n === name)) attrs.push([name, value]);
  }

  const attrText = attrs
    .map(([name, value]) => {
      if (value === "" && !state.caretPlaced && name !== "alt") {
        state.caretPlaced = true;
        return ` ${name}="${CARET}"`;
      }
      return ` ${name}="${value}"`;
    })
    .join("");

  const open = `<${tag}${attrText}>`;
  if (VOID_TAGS.has(tag)) return [pad + open];

  const text = node.text === null ? null : numbered(node.text, index, total);
  const close = `</${tag}>`;

  if (node.children.length === 0) {
    let body = text ?? "";
    if (body === "" && !state.caretPlaced) {
      state.caretPlaced = true;
      body = CARET;
    }
    if (text !== null || INLINE_TAGS.has(tag) || body === CARET) {
      return [pad + open + body + close];
    }
    return [pad + open, pad + close];
  }

  const inner = renderNodes(node.children, depth + 1, tag, state);
  const head = text ? [pad + open, `${" ".repeat((depth + 1) * state.tabSize)}${text}`] : [pad + open];
  return [...head, ...inner, pad + close];
}

/* --------------------------------------------------------------- entry */

/** Characters that mark a word as an abbreviation rather than prose. */
const ABBREV_HINT = /[>+^*.#[\]{}$:!]/;

const KNOWN_TAGS = new Set([
  "a", "abbr", "address", "article", "aside", "audio", "b", "blockquote", "body", "br", "button",
  "canvas", "caption", "cite", "code", "col", "colgroup", "datalist", "dd", "details", "dialog",
  "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "footer", "form", "h1",
  "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "iframe", "img",
  "input", "ins", "kbd", "label", "legend", "li", "link", "main", "map", "mark", "menu", "meta",
  "meter", "nav", "noscript", "object", "ol", "optgroup", "option", "output", "p", "picture",
  "pre", "progress", "q", "s", "samp", "script", "section", "select", "slot", "small", "source",
  "span", "strong", "style", "sub", "summary", "sup", "svg", "table", "tbody", "td", "template",
  "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "u", "ul", "video", "wbr",
]);

/**
 * Expands an HTML abbreviation. Returns `null` when the text doesn't look like
 * one, so the caller can fall back to inserting a tab.
 */
export function expandHtmlAbbreviation(abbr: string, tabSize: number): string | null {
  const src = abbr.trim();
  if (!src) return null;

  const snippet = SNIPPETS[src.toLowerCase()];
  if (snippet) return snippet;

  const looksLikeAbbrev = ABBREV_HINT.test(src) || KNOWN_TAGS.has(src.toLowerCase());
  if (!looksLikeAbbrev) return null;
  if (/\s/.test(src) && !src.includes("[") && !src.includes("{")) return null;

  const nodes = new Parser(src).parse();
  if (!nodes) return null;

  const state: RenderState = { tabSize, caretPlaced: false };
  const lines = renderNodes(nodes, 0, null, state);
  return lines.length ? lines.join("\n") : null;
}

/* ------------------------------------------------------------------ CSS */

/** Properties whose numeric shorthand is unitless. */
const UNITLESS = new Set(["z-index", "opacity", "line-height", "font-weight", "flex-grow", "order"]);

const CSS_NUMERIC: Record<string, string> = {
  m: "margin", mt: "margin-top", mr: "margin-right", mb: "margin-bottom", ml: "margin-left",
  p: "padding", pt: "padding-top", pr: "padding-right", pb: "padding-bottom", pl: "padding-left",
  w: "width", h: "height", maw: "max-width", mah: "max-height", miw: "min-width", mih: "min-height",
  t: "top", r: "right", b: "bottom", l: "left", fz: "font-size", lh: "line-height",
  fw: "font-weight", bdrs: "border-radius", br: "border-radius", z: "z-index", op: "opacity",
  g: "gap", gap: "gap", ls: "letter-spacing",
};

const CSS_SNIPPETS: Record<string, string> = {
  d: "display: ;", db: "display: block;", di: "display: inline;", dib: "display: inline-block;",
  df: "display: flex;", dif: "display: inline-flex;", dg: "display: grid;", dn: "display: none;",
  pos: "position: relative;", posa: "position: absolute;", posr: "position: relative;",
  posf: "position: fixed;", poss: "position: sticky;",
  fxd: "flex-direction: row;", fxdc: "flex-direction: column;", fxw: "flex-wrap: wrap;",
  jcc: "justify-content: center;", jcsb: "justify-content: space-between;",
  jcsa: "justify-content: space-around;", jcfe: "justify-content: flex-end;",
  aic: "align-items: center;", aife: "align-items: flex-end;", aist: "align-items: stretch;",
  ac: "place-items: center;",
  bg: "background: ;", bgc: "background-color: ;", bgi: "background-image: ;",
  bgs: "background-size: cover;", bgp: "background-position: center;",
  c: "color: ;", ta: "text-align: left;", tac: "text-align: center;", tar: "text-align: right;",
  td: "text-decoration: none;", tt: "text-transform: uppercase;",
  ff: "font-family: ;", fs: "font-style: italic;",
  bd: "border: 1px solid ;", bdn: "border: none;", bxsh: "box-shadow: 0 1px 2px rgb(0 0 0 / 10%);",
  ov: "overflow: hidden;", ovh: "overflow: hidden;", ova: "overflow: auto;",
  cur: "cursor: pointer;", curp: "cursor: pointer;",
  trs: "transition: all 0.2s ease;", trf: "transform: ;",
  gtc: "grid-template-columns: ;", gtr: "grid-template-rows: ;",
  anim: "animation: 1s ease infinite;", content: 'content: "";',
  bxz: "box-sizing: border-box;", vh: "height: 100vh;", wh: "width: 100%;",
};

/**
 * Expands a CSS abbreviation — either a table entry (`dib`) or a property with
 * a numeric suffix (`mt24` → `margin-top: 24px;`).
 */
export function expandCssAbbreviation(abbr: string): string | null {
  const src = abbr.trim().toLowerCase();
  if (!src) return null;

  const exact = CSS_SNIPPETS[src];
  if (exact) return exact.replace(": ;", `: ${CARET};`);

  const numeric = /^([a-z]+)(-?\d+(?:\.\d+)?)(p|e|r|vh|vw|%)?$/.exec(src);
  if (numeric) {
    const prop = CSS_NUMERIC[numeric[1]];
    if (!prop) return null;
    const raw = numeric[2];
    const suffix = numeric[3];
    const unit = UNITLESS.has(prop) && !suffix ? "" : suffix === "p" || suffix === "%" ? "%" : suffix === "e" ? "em" : suffix === "r" ? "rem" : suffix ? suffix : "px";
    const value = raw === "0" ? "0" : `${raw}${unit}`;
    return `${prop}: ${value};`;
  }

  const bare = CSS_NUMERIC[src];
  if (bare) return `${bare}: ${CARET};`;

  return null;
}
