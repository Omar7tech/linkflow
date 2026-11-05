/**
 * GitHub-flavoured markdown → HTML, for the live preview.
 *
 * Covers what READMEs actually use, the way GitHub renders it: raw HTML
 * blocks (centred heroes, <picture>, <details>), markdown resuming after a
 * blank line inside them, alerts, task lists, tables, fenced code, and
 * heading anchors with GitHub's exact slugs. Raw HTML is sanitised.
 */
import { slug } from "./generate";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function sanitize(html: string) {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|srcset)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

function inline(text: string): string {
  const codes: string[] = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${esc(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  // Inline HTML (img, a, br, sub, b…) passes through, sanitised; the rest is escaped.
  const tags: string[] = [];
  s = s.replace(/<\/?[a-zA-Z][^<>]*>/g, (tag) => {
    tags.push(sanitize(tag));
    return `\u0001${tags.length - 1}\u0001`;
  });
  s = esc(s);
  s = s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${/^\s*javascript:/i.test(u) ? "#" : u}">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2">$2</a>');
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => tags[Number(i)]);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

const ALERTS: Record<string, string> = { NOTE: "Note", TIP: "Tip", IMPORTANT: "Important", WARNING: "Warning", CAUTION: "Caution" };

export interface Rendered {
  html: string;
  code: { lang: string; code: string }[];
}

export function renderMarkdown(md: string): Rendered {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  const code: Rendered["code"] = [];
  const used = new Map<string, number>();
  let i = 0;

  const isBlank = (l: string | undefined) => l === undefined || !l.trim();
  const startsBlock = (l: string) => /^(#{1,6}\s|```|>|\s*([-*+]|\d+\.)\s|\s*<|---\s*$|\|)/.test(l);

  const renderList = (start: number): number => {
    const ordered = /^\s*\d+\./.test(lines[start]);
    const items: string[] = [];
    let j = start;
    while (j < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[j])) {
      let text = lines[j].replace(/^\s*([-*+]|\d+\.)\s+/, "");
      const task = text.match(/^\[([ xX])\]\s+/);
      let prefix = "";
      let cls = "";
      if (task) {
        text = text.slice(task[0].length);
        prefix = `<input type="checkbox" disabled${task[1].trim() ? " checked" : ""}> `;
        cls = ' class="task-list-item"';
      }
      items.push(`<li${cls}>${prefix}${inline(text)}</li>`);
      j++;
    }
    out.push(`<${ordered ? "ol" : "ul"}${items.some((x) => x.includes("task-list-item")) ? ' class="contains-task-list"' : ""}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
    return j;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    // Fenced code.
    const fence = line.match(/^```\s*([\w+-]*)/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      code.push({ lang: fence[1] || "text", code: body.join("\n") });
      out.push(`<div class="highlight" data-code="${code.length - 1}"><pre><code>${esc(body.join("\n"))}</code></pre></div>`);
      continue;
    }
    // Raw HTML block: until the next blank line.
    if (/^\s*<\/?[a-zA-Z!]/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && !isBlank(lines[i])) body.push(lines[i++]);
      out.push(sanitize(body.join("\n")));
      continue;
    }
    // Headings.
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const text = h[2].trim();
      const base = slug(text.replace(/<[^>]+>/g, ""));
      const n = used.get(base) ?? 0;
      used.set(base, n + 1);
      const id = n ? `${base}-${n}` : base;
      out.push(`<h${h[1].length} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${inline(text)}</h${h[1].length}>`);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }
    // Blockquotes and GitHub alerts.
    if (/^>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      const alert = body[0]?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/);
      if (alert) {
        const inner = renderMarkdown(body.slice(1).join("\n"));
        out.push(`<div class="markdown-alert markdown-alert-${alert[1].toLowerCase()}"><p class="markdown-alert-title">${ALERTS[alert[1]]}</p>${inner.html}</div>`);
      } else out.push(`<blockquote>${renderMarkdown(body.join("\n")).html}</blockquote>`);
      continue;
    }
    // Lists.
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      i = renderList(i);
      continue;
    }
    // Tables.
    if (/^\|/.test(line) && /^\|?\s*:?-{3,}/.test(lines[i + 1] ?? "")) {
      const cells = (l: string) =>
        l
          .replace(/^\||\|\s*$/g, "")
          .split(/(?<!\\)\|/)
          .map((c) => inline(c.trim().replace(/\\\|/g, "|")));
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
      );
      continue;
    }
    // Paragraph.
    const para: string[] = [];
    while (i < lines.length && !isBlank(lines[i]) && !(para.length && startsBlock(lines[i]))) para.push(lines[i++]);
    out.push(`<p>${inline(para.join("\n")).replace(/\n/g, " ")}</p>`);
  }
  return { html: out.join("\n"), code };
}
