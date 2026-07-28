"use client";

import * as React from "react";
import { toast } from "sonner";
import { highlightOnView } from "@/lib/devdocs-highlight";
import type { Heading } from "./doc-toc";
import "./docs-prose.css";

/** Inline SVGs so injected controls match the lucide icons used elsewhere. */
const ICON = {
  copy: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  link: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
};

/** Slugify a heading that arrived without an id of its own. */
function slugify(text: string, taken: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "section";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

/**
 * Renders a sanitised DevDocs page and wires up everything the raw HTML can't
 * do on its own: code blocks get syntax colours and a copy button, headings get
 * permalinks, in-docset links navigate without a reload, and anchors scroll
 * inside the pane rather than the window.
 */
export function DocPane({
  html,
  hash,
  onNavigate,
  onHeadings,
  scrollRef,
}: {
  html: string;
  /** Anchor to jump to once the page is on screen. */
  hash: string;
  /** Called with another page path, or `#anchor` for a same-page jump. */
  onNavigate: (target: string) => void;
  /** Reports the page's section headings for the "on this page" rail. */
  onHeadings: (headings: Heading[]) => void;
  /** The scrolling ancestor, so anchor jumps move the right element. */
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Everything here decorates markup we didn't author, so it runs after the
  // injection rather than being baked into the cached HTML.
  React.useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    for (const block of root.querySelectorAll("pre")) {
      const parent = block.parentElement;
      if (parent?.dataset.codeWrap !== undefined) continue;

      const wrap = document.createElement("div");
      wrap.dataset.codeWrap = "";
      const language = block.dataset.language;
      if (language) wrap.dataset.language = language;
      block.replaceWith(wrap);
      wrap.append(block);

      const button = document.createElement("button");
      button.type = "button";
      button.dataset.copyCode = "";
      button.className = "devdocs-copy";
      button.setAttribute("aria-label", "Copy code");
      button.innerHTML = ICON.copy;
      wrap.append(button);
    }

    const taken = new Set<string>();
    for (const el of root.querySelectorAll("[id]")) taken.add(el.id);

    const headings: Heading[] = [];
    for (const heading of root.querySelectorAll<HTMLElement>("h2, h3, h4")) {
      const text = (heading.textContent ?? "").trim();
      if (!text) continue;
      if (!heading.id) heading.id = slugify(text, taken);

      if (!heading.querySelector("[data-heading-anchor]")) {
        const anchor = document.createElement("a");
        anchor.href = `#${heading.id}`;
        anchor.dataset.headingAnchor = "";
        anchor.className = "devdocs-anchor";
        anchor.setAttribute("aria-label", `Link to ${text}`);
        anchor.innerHTML = ICON.link;
        heading.append(anchor);
      }

      if (heading.tagName !== "H4") {
        headings.push({ id: heading.id, text, level: heading.tagName === "H2" ? 2 : 3 });
      }
    }
    onHeadings(headings);

    return highlightOnView(root, scrollRef.current);
  }, [html, onHeadings, scrollRef]);

  // Jump to the requested anchor once the new markup has painted.
  React.useEffect(() => {
    const scroller = scrollRef.current;
    const root = contentRef.current;
    if (!scroller || !root) return;

    const target = hash
      ? (root.querySelector(`#${CSS.escape(hash)}`) ??
        root.querySelector(`[name="${CSS.escape(hash)}"]`))
      : null;

    if (!target) {
      scroller.scrollTo({ top: 0 });
      return;
    }
    const offset =
      target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, offset - 16), behavior: "smooth" });
  }, [html, hash, scrollRef]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    const copyButton = target.closest<HTMLElement>("[data-copy-code]");
    if (copyButton) {
      const code = copyButton.parentElement?.querySelector("pre")?.textContent ?? "";
      void navigator.clipboard
        .writeText(code)
        .then(() => toast.success("Code copied."))
        .catch(() => toast.error("Couldn't copy."));
      return;
    }

    const anchor = target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor) return;

    // Let the browser handle off-site links and deliberate new-tab clicks.
    if (anchor.hasAttribute("data-doc-external")) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;

    if (anchor.dataset.headingAnchor !== undefined) {
      event.preventDefault();
      onNavigate(anchor.getAttribute("href") ?? "");
      return;
    }

    const path = anchor.dataset.docPath;
    const anchorHash = anchor.dataset.docHash;
    if (path) {
      event.preventDefault();
      onNavigate(path);
    } else if (anchorHash) {
      event.preventDefault();
      onNavigate(`#${anchorHash}`);
    }
  };

  return (
    // Delegated so links and copy buttons stay plain HTML; keyboard users
    // activate the same anchors and buttons directly.
    <div className="devdocs-prose" onClick={handleClick}>
      <div ref={contentRef} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
