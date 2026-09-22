/**
 * Website Builder — the renderer.
 *
 * Turns a site document into a standalone HTML page: semantic markup, one
 * stylesheet driven by CSS custom properties, and a small progressive
 * enhancement script. The same functions produce the live preview, with a few
 * extra attributes so the canvas can be clicked and typed into directly.
 *
 * Nothing here touches the DOM, so the output is identical in the preview and
 * in the downloaded file.
 */
import {
  BLOCKS, bool, defOf, fontPair, rows, safeHref, sectionAnchors, str, themeTokens,
  type Block, type BlockType, type Row, type Site, type Theme,
} from "./site-builder";

/* ------------------------------------------------------------- primitives */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const attr = (value: string) => escapeHtml(value).replace(/\n/g, " ");

/** A deliberately small subset of Markdown: bold, italic, code and links. */
export function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => `<a href="${attr(safeHref(href))}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** Blank lines separate paragraphs; a leading "- " starts a list. */
export function richText(value: string, editable = ""): string {
  const chunks = value.replace(/\r\n/g, "\n").split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean);
  if (!chunks.length) return "";
  const html = chunks.map((chunk) => {
    const lines = chunk.split("\n");
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      return `<ul class="sb-list">${lines.map((line) => `<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    return `<p>${lines.map(inlineMarkdown).join("<br>")}</p>`;
  }).join("\n      ");
  return editable ? `<div ${editable}>${html}</div>` : html;
}

const lines = (value: string): string[] => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

/* ------------------------------------------------------------ render context */

export interface RenderContext {
  site: Site;
  anchors: Map<string, string>;
  /** Preview mode adds selection + inline-editing hooks. */
  editing: boolean;
  used: Set<BlockType>;
}

/** Marks a piece of text as directly editable in the preview canvas. */
function edit(ctx: RenderContext, block: Block, field: string, index?: number, key?: string): string {
  if (!ctx.editing) return "";
  const path = index === undefined ? field : `${field}.${index}.${key}`;
  return `data-sb-edit="${attr(path)}" data-sb-owner="${attr(block.id)}" contenteditable="true" spellcheck="false"`;
}

const linkTargets = (href: string) => (/^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener"' : "");

function button(ctx: RenderContext, block: Block, labelKey: string, hrefKey: string, variant: "primary" | "ghost" | "outline"): string {
  const label = str(block, labelKey).trim();
  if (!label) return "";
  const href = safeHref(str(block, hrefKey) || "#");
  return `<a class="sb-btn sb-btn--${variant}" href="${attr(href)}"${linkTargets(href)}><span ${edit(ctx, block, labelKey)}>${escapeHtml(label)}</span></a>`;
}

function picture(ctx: RenderContext, src: string, alt: string, className: string, eager = false): string {
  if (!src.trim()) {
    return `<div class="${className} sb-ph" role="img" aria-label="${attr(alt || "Picture placeholder")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v14H3z"/><path d="m6 15 4-4 3 3 2-2 3 3"/><circle cx="9" cy="9" r="1.4"/></svg></div>`;
  }
  const loading = eager ? "" : ' loading="lazy" decoding="async"';
  return `<img class="${className}" src="${attr(src)}" alt="${attr(alt)}"${loading}>`;
}

function heading(ctx: RenderContext, block: Block, options: { level?: 2 | 3; center?: boolean } = {}): string {
  const title = str(block, "heading").trim();
  const intro = str(block, "intro").trim();
  if (!title && !intro) return "";
  const level = options.level ?? 2;
  return `<header class="sb-head${options.center === false ? "" : " sb-head--center"}">
        ${title ? `<h${level} ${edit(ctx, block, "heading")}>${escapeHtml(title)}</h${level}>` : ""}
        ${intro ? `<p class="sb-intro" ${edit(ctx, block, "intro")}>${escapeHtml(intro)}</p>` : ""}
      </header>`;
}

const reveal = (ctx: RenderContext, extra = "") =>
  `${ctx.site.theme.animate ? "sb-reveal " : ""}${extra}`.trim();

const stars = (rating: string) => {
  const count = Number(rating);
  if (!count) return "";
  return `<div class="sb-stars" aria-label="${count} out of 5">${Array.from({ length: count }, () =>
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.6 6 .7-4.5 4.1 1.3 6-5.4-3-5.4 3 1.3-6L3.4 9.5l6-.7z"/></svg>`).join("")}</div>`;
};

const CHECK_SVG = `<svg class="sb-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;

/* ---------------------------------------------------------------- embeds */

/** Normal page addresses people paste → the address an iframe actually needs. */
export function embedUrl(input: string): string {
  const value = input.trim();
  if (!value) return "";
  const youtube = value.match(/(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}`;
  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const loom = value.match(/loom\.com\/share\/([\w-]+)/i);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;
  if (/google\.[a-z.]+\/maps/i.test(value)) {
    if (/output=embed|\/embed/i.test(value)) return value;
    const place = value.match(/\/place\/([^/@]+)/);
    const query = place ? decodeURIComponent(place[1]).replace(/\+/g, " ") : value;
    return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  }
  if (/openstreetmap\.org/i.test(value) && !/export\/embed/i.test(value)) return value;
  return /^https:\/\//i.test(value) ? value : "";
}

/* ------------------------------------------------------------ the sections */

type Renderer = (block: Block, ctx: RenderContext) => string;

const RENDERERS: Record<BlockType, Renderer> = {
  banner: (block, ctx) => {
    const text = str(block, "text").trim();
    if (!text) return "";
    const label = str(block, "linkLabel").trim();
    const href = safeHref(str(block, "linkHref") || "#");
    return `<div class="sb-banner sb-banner--${attr(block.variant)}">
      <p><span ${edit(ctx, block, "text")}>${escapeHtml(text)}</span>${label ? ` <a href="${attr(href)}"${linkTargets(href)}>${escapeHtml(label)}</a>` : ""}</p>
    </div>`;
  },

  nav: (block, ctx) => {
    const logoImage = str(block, "logoImage");
    const logoText = str(block, "logoText").trim() || ctx.site.identity.name || "Home";
    const logo = logoImage
      ? `<img src="${attr(logoImage)}" alt="${attr(logoText)}" class="sb-logo__img">`
      : `<span ${edit(ctx, block, "logoText")}>${escapeHtml(logoText)}</span>`;
    const links = rows(block, "links").filter((row) => row.label?.trim());
    const menu = links.map((row, index) => {
      const href = safeHref(row.href || "#");
      return `<li><a href="${attr(href)}"${linkTargets(href)} ${edit(ctx, block, "links", index, "label")}>${escapeHtml(row.label)}</a></li>`;
    }).join("\n            ");
    const cta = button(ctx, block, "ctaLabel", "ctaHref", "primary");
    return `<header class="sb-nav sb-nav--${attr(block.variant)}"${bool(block, "sticky", true) ? ' data-sticky="true"' : ""}>
      <div class="sb-container sb-nav__inner">
        <a class="sb-logo" href="#top">${logo}</a>
        <button class="sb-burger" type="button" aria-expanded="false" aria-controls="sb-menu" aria-label="Open menu">
          <span></span><span></span><span></span>
        </button>
        <nav class="sb-menu" id="sb-menu" aria-label="Main">
          <ul>
            ${menu}
          </ul>
          ${cta ? `<div class="sb-nav__cta">${cta}</div>` : ""}
        </nav>
      </div>
    </header>`;
  },

  hero: (block, ctx) => {
    const eyebrow = str(block, "eyebrow").trim();
    const headline = str(block, "headline").trim();
    const subhead = str(block, "subhead").trim();
    const note = str(block, "note").trim();
    const image = str(block, "image");
    const buttons = [button(ctx, block, "primaryLabel", "primaryHref", "primary"), button(ctx, block, "secondaryLabel", "secondaryHref", "outline")].filter(Boolean).join("\n          ");
    const copy = `<div class="sb-hero__copy">
          ${eyebrow ? `<p class="sb-eyebrow" ${edit(ctx, block, "eyebrow")}>${escapeHtml(eyebrow)}</p>` : ""}
          ${headline ? `<h1 ${edit(ctx, block, "headline")}>${escapeHtml(headline)}</h1>` : ""}
          ${subhead ? `<p class="sb-lead" ${edit(ctx, block, "subhead")}>${escapeHtml(subhead)}</p>` : ""}
          ${buttons ? `<div class="sb-actions">${buttons}</div>` : ""}
          ${note ? `<p class="sb-note" ${edit(ctx, block, "note")}>${escapeHtml(note)}</p>` : ""}
        </div>`;

    if (block.variant === "image") {
      return `<section class="sb-section sb-hero sb-hero--image"${image ? ` style="--hero-image:url('${attr(image)}')"` : ""}>
      <div class="sb-container">${copy}</div>
    </section>`;
    }
    if (block.variant === "center" || block.variant === "minimal") {
      return `<section class="sb-section sb-hero sb-hero--${attr(block.variant)}">
      <div class="sb-container">
        ${copy}
        ${block.variant === "center" && image ? `<div class="sb-hero__shot">${picture(ctx, image, str(block, "imageAlt"), "sb-hero__img", true)}</div>` : ""}
      </div>
    </section>`;
    }
    return `<section class="sb-section sb-hero sb-hero--split">
      <div class="sb-container sb-hero__grid">
        ${copy}
        <div class="sb-hero__shot">${picture(ctx, image, str(block, "imageAlt"), "sb-hero__img", true)}</div>
      </div>
    </section>`;
  },

  logos: (block, ctx) => {
    const items = rows(block, "items").filter((row) => row.label?.trim() || row.image);
    if (!items.length) return "";
    const title = str(block, "heading").trim();
    return `<section class="sb-section sb-logos sb-logos--${attr(block.variant)}">
      <div class="sb-container">
        ${title ? `<p class="sb-logos__title" ${edit(ctx, block, "heading")}>${escapeHtml(title)}</p>` : ""}
        <ul class="sb-logos__row">
          ${items.map((row, index) => `<li>${row.image ? `<img src="${attr(row.image)}" alt="${attr(row.label || "")}" loading="lazy">` : `<span ${edit(ctx, block, "items", index, "label")}>${escapeHtml(row.label)}</span>`}</li>`).join("\n          ")}
        </ul>
      </div>
    </section>`;
  },

  features: (block, ctx) => {
    const items = rows(block, "items").filter((row) => row.title?.trim() || row.text?.trim());
    const columns = str(block, "columns", "3");
    const card = (row: Row, index: number) => {
      const marker = block.variant === "numbered"
        ? `<span class="sb-num">${index + 1}</span>`
        : block.variant === "checklist"
          ? `<span class="sb-tick">${CHECK_SVG}</span>`
          : row.icon ? `<span class="sb-emoji" ${edit(ctx, block, "items", index, "icon")}>${escapeHtml(row.icon)}</span>` : "";
      return `<li class="${reveal(ctx, "sb-feature")}">
            ${marker}
            ${row.title ? `<h3 ${edit(ctx, block, "items", index, "title")}>${escapeHtml(row.title)}</h3>` : ""}
            ${row.text ? `<p ${edit(ctx, block, "items", index, "text")}>${escapeHtml(row.text)}</p>` : ""}
          </li>`;
    };
    return `<section class="sb-section sb-features sb-features--${attr(block.variant)}">
      <div class="sb-container">
        ${heading(ctx, block)}
        <ul class="sb-grid" style="--cols:${attr(columns)}">
          ${items.map(card).join("\n          ")}
        </ul>
      </div>
    </section>`;
  },

  split: (block, ctx) => {
    const bullets = rows(block, "bullets").filter((row) => row.text?.trim());
    const eyebrow = str(block, "eyebrow").trim();
    const title = str(block, "heading").trim();
    const cta = button(ctx, block, "ctaLabel", "ctaHref", "primary");
    const copy = `<div class="sb-split__copy">
          ${eyebrow ? `<p class="sb-eyebrow" ${edit(ctx, block, "eyebrow")}>${escapeHtml(eyebrow)}</p>` : ""}
          ${title ? `<h2 ${edit(ctx, block, "heading")}>${escapeHtml(title)}</h2>` : ""}
          ${richText(str(block, "text"), edit(ctx, block, "text"))}
          ${bullets.length ? `<ul class="sb-ticks">${bullets.map((row, index) => `<li>${CHECK_SVG}<span ${edit(ctx, block, "bullets", index, "text")}>${escapeHtml(row.text)}</span></li>`).join("")}</ul>` : ""}
          ${cta ? `<div class="sb-actions">${cta}</div>` : ""}
        </div>`;
    const shot = `<div class="sb-split__shot">${picture(ctx, str(block, "image"), str(block, "imageAlt"), "sb-split__img")}</div>`;
    return `<section class="sb-section sb-split sb-split--${attr(block.variant)}">
      <div class="sb-container sb-split__grid">
        ${block.variant === "left" ? `${shot}\n        ${copy}` : `${copy}\n        ${shot}`}
      </div>
    </section>`;
  },

  stats: (block, ctx) => {
    const items = rows(block, "items").filter((row) => row.value?.trim());
    if (!items.length) return "";
    const title = str(block, "heading").trim();
    return `<section class="sb-section sb-stats sb-stats--${attr(block.variant)}">
      <div class="sb-container">
        ${title ? `<p class="sb-stats__title" ${edit(ctx, block, "heading")}>${escapeHtml(title)}</p>` : ""}
        <dl class="sb-stats__row">
          ${items.map((row, index) => `<div class="${reveal(ctx, "sb-stat")}">
            <dt ${edit(ctx, block, "items", index, "value")}>${escapeHtml(row.value)}</dt>
            <dd ${edit(ctx, block, "items", index, "label")}>${escapeHtml(row.label || "")}</dd>
          </div>`).join("\n          ")}
        </dl>
      </div>
    </section>`;
  },

  steps: (block, ctx) => {
    const items = rows(block, "items").filter((row) => row.title?.trim() || row.text?.trim());
    return `<section class="sb-section sb-steps sb-steps--${attr(block.variant)}">
      <div class="sb-container">
        ${heading(ctx, block)}
        <ol class="sb-steps__list">
          ${items.map((row, index) => `<li class="${reveal(ctx, "sb-step")}">
            <span class="sb-num">${index + 1}</span>
            <div>
              ${row.title ? `<h3 ${edit(ctx, block, "items", index, "title")}>${escapeHtml(row.title)}</h3>` : ""}
              ${row.text ? `<p ${edit(ctx, block, "items", index, "text")}>${escapeHtml(row.text)}</p>` : ""}
            </div>
          </li>`).join("\n          ")}
        </ol>
      </div>
    </section>`;
  },

  gallery: (block, ctx) => {
    const items = rows(block, "items");
    const columns = str(block, "columns", "3");
    return `<section class="sb-section sb-gallery sb-gallery--${attr(block.variant)}">
      <div class="sb-container">
        ${heading(ctx, block)}
        <ul class="sb-gallery__grid" style="--cols:${attr(columns)}">
          ${items.map((row, index) => `<li class="${reveal(ctx, "sb-shot")}">
            ${picture(ctx, row.image || "", row.alt || "", "sb-shot__img")}
            ${row.caption ? `<figcaption ${edit(ctx, block, "items", index, "caption")}>${escapeHtml(row.caption)}</figcaption>` : ""}
          </li>`).join("\n          ")}
        </ul>
      </div>
    </section>`;
  },

  pricing: (block, ctx) => {
    const items = rows(block, "items").filter((row) => row.name?.trim() || row.price?.trim());
    const note = str(block, "note").trim();
    const card = (row: Row, index: number) => {
      const features = lines(row.features || "");
      const cta = row.ctaLabel?.trim()
        ? `<a class="sb-btn ${row.badge?.trim() ? "sb-btn--primary" : "sb-btn--outline"}" href="${attr(safeHref(row.ctaHref || "#"))}">${escapeHtml(row.ctaLabel)}</a>`
        : "";
      if (block.variant === "menu") {
        return `<li class="sb-menu-item">
            <div class="sb-menu-item__head">
              <h3 ${edit(ctx, block, "items", index, "name")}>${escapeHtml(row.name || "")}</h3>
              <span class="sb-dots" aria-hidden="true"></span>
              <span class="sb-price" ${edit(ctx, block, "items", index, "price")}>${escapeHtml(row.price || "")}</span>
            </div>
            ${row.description ? `<p ${edit(ctx, block, "items", index, "description")}>${escapeHtml(row.description)}</p>` : ""}
          </li>`;
      }
      return `<li class="${reveal(ctx, `sb-plan${row.badge?.trim() ? " sb-plan--featured" : ""}`)}">
            ${row.badge?.trim() ? `<span class="sb-badge" ${edit(ctx, block, "items", index, "badge")}>${escapeHtml(row.badge)}</span>` : ""}
            <h3 ${edit(ctx, block, "items", index, "name")}>${escapeHtml(row.name || "")}</h3>
            <p class="sb-plan__price"><span ${edit(ctx, block, "items", index, "price")}>${escapeHtml(row.price || "")}</span>${row.period?.trim() ? ` <small>/ ${escapeHtml(row.period)}</small>` : ""}</p>
            ${row.description ? `<p class="sb-plan__desc" ${edit(ctx, block, "items", index, "description")}>${escapeHtml(row.description)}</p>` : ""}
            ${features.length ? `<ul class="sb-ticks">${features.map((line) => `<li>${CHECK_SVG}<span>${escapeHtml(line)}</span></li>`).join("")}</ul>` : ""}
            ${cta}
          </li>`;
    };
    return `<section class="sb-section sb-pricing sb-pricing--${attr(block.variant)}">
      <div class="sb-container">
        ${heading(ctx, block)}
        <ul class="${block.variant === "menu" ? "sb-menu-list" : "sb-plans"}">
          ${items.map(card).join("\n          ")}
        </ul>
        ${note ? `<p class="sb-note sb-note--center" ${edit(ctx, block, "note")}>${escapeHtml(note)}</p>` : ""}
      </div>
    </section>`;
  },

  testimonials: (block, ctx) => {
    const items = rows(block, "items").filter((row) => row.quote?.trim());
    if (!items.length) return "";
    const quote = (row: Row, index: number) => `<li class="${reveal(ctx, "sb-quote")}">
            ${stars(row.rating || "")}
            <blockquote ${edit(ctx, block, "items", index, "quote")}>${escapeHtml(row.quote)}</blockquote>
            <div class="sb-quote__who">
              ${row.photo ? `<img src="${attr(row.photo)}" alt="" loading="lazy">` : ""}
              <div>
                <p class="sb-quote__name" ${edit(ctx, block, "items", index, "name")}>${escapeHtml(row.name || "")}</p>
                ${row.role ? `<p class="sb-quote__role" ${edit(ctx, block, "items", index, "role")}>${escapeHtml(row.role)}</p>` : ""}
              </div>
            </div>
          </li>`;
    return `<section class="sb-section sb-testimonials sb-testimonials--${attr(block.variant)}">
      <div class="sb-container">
        ${heading(ctx, block)}
        <ul class="sb-quotes">
          ${items.map(quote).join("\n          ")}
        </ul>
      </div>
    </section>`;
  },

  faq: (block, ctx) => {
    const items = rows(block, "items").filter((row) => row.question?.trim());
    return `<section class="sb-section sb-faq sb-faq--${attr(block.variant)}">
      <div class="sb-container">
        ${heading(ctx, block)}
        <div class="sb-faq__list">
          ${items.map((row, index) => `<details class="sb-faq__item">
            <summary><span ${edit(ctx, block, "items", index, "question")}>${escapeHtml(row.question)}</span><span class="sb-faq__sign" aria-hidden="true"></span></summary>
            <div class="sb-faq__answer">${richText(row.answer || "", edit(ctx, block, "items", index, "answer"))}</div>
          </details>`).join("\n          ")}
        </div>
      </div>
    </section>`;
  },

  team: (block, ctx) => {
    const items = rows(block, "items").filter((row) => row.name?.trim());
    return `<section class="sb-section sb-team sb-team--${attr(block.variant)}">
      <div class="sb-container">
        ${heading(ctx, block)}
        <ul class="sb-grid" style="--cols:${attr(str(block, "columns", "3"))}">
          ${items.map((row, index) => {
      const body = `${picture(ctx, row.photo || "", row.name || "", "sb-person__img")}
              <h3 ${edit(ctx, block, "items", index, "name")}>${escapeHtml(row.name)}</h3>
              ${row.role ? `<p ${edit(ctx, block, "items", index, "role")}>${escapeHtml(row.role)}</p>` : ""}`;
      const href = row.link?.trim() ? safeHref(row.link) : "";
      return `<li class="${reveal(ctx, "sb-person")}">${href ? `<a href="${attr(href)}"${linkTargets(href)}>${body}</a>` : body}</li>`;
    }).join("\n          ")}
        </ul>
      </div>
    </section>`;
  },

  text: (block, ctx) => {
    const title = str(block, "heading").trim();
    return `<section class="sb-section sb-text sb-text--${attr(block.variant)}">
      <div class="sb-container">
        <div class="sb-prose">
          ${title ? `<h2 ${edit(ctx, block, "heading")}>${escapeHtml(title)}</h2>` : ""}
          ${richText(str(block, "body"), edit(ctx, block, "body"))}
        </div>
      </div>
    </section>`;
  },

  cta: (block, ctx) => {
    const headline = str(block, "headline").trim();
    const text = str(block, "text").trim();
    const note = str(block, "note").trim();
    const buttons = [button(ctx, block, "buttonLabel", "buttonHref", block.variant === "band" ? "ghost" : "primary"), button(ctx, block, "secondaryLabel", "secondaryHref", "outline")].filter(Boolean).join("\n          ");
    return `<section class="sb-section sb-cta sb-cta--${attr(block.variant)}">
      <div class="sb-container sb-cta__inner">
        <div>
          ${headline ? `<h2 ${edit(ctx, block, "headline")}>${escapeHtml(headline)}</h2>` : ""}
          ${text ? `<p ${edit(ctx, block, "text")}>${escapeHtml(text)}</p>` : ""}
        </div>
        <div class="sb-cta__actions">
          ${buttons}
          ${note ? `<p class="sb-note" ${edit(ctx, block, "note")}>${escapeHtml(note)}</p>` : ""}
        </div>
      </div>
    </section>`;
  },

  contact: (block, ctx) => {
    const email = str(block, "email").trim();
    const phone = str(block, "phone").trim();
    const address = str(block, "address").trim();
    const hours = str(block, "hours").trim();
    const mapUrl = str(block, "mapUrl").trim();
    const postMode = str(block, "formMode", "mailto") === "post" && str(block, "formAction").trim();
    const action = postMode ? safeHref(str(block, "formAction")) : email ? `mailto:${email}` : "";
    const form = block.variant === "details" ? "" : `<form class="sb-form" action="${attr(action)}" method="${postMode ? "post" : "get"}"${postMode ? "" : ' enctype="text/plain"'}>
          <div class="sb-field">
            <label for="sb-name">Your name</label>
            <input id="sb-name" name="name" type="text" autocomplete="name" required>
          </div>
          <div class="sb-field">
            <label for="sb-email">Your email</label>
            <input id="sb-email" name="email" type="email" autocomplete="email" required>
          </div>
          <div class="sb-field">
            <label for="sb-message">${escapeHtml(str(block, "messageLabel") || "Message")}</label>
            <textarea id="sb-message" name="message" rows="5" required></textarea>
          </div>
          <button class="sb-btn sb-btn--primary" type="submit">${escapeHtml(str(block, "buttonLabel") || "Send message")}</button>
          ${str(block, "privacyNote").trim() ? `<p class="sb-note" ${edit(ctx, block, "privacyNote")}>${escapeHtml(str(block, "privacyNote"))}</p>` : ""}
        </form>`;
    const detail = (label: string, value: string, href = "") => {
      if (!value) return "";
      const body = href ? `<a href="${attr(href)}">${escapeHtml(value)}</a>` : escapeHtml(value).replace(/\n/g, "<br>");
      return `<div class="sb-detail"><dt>${escapeHtml(label)}</dt><dd>${body}</dd></div>`;
    };
    const details = block.variant === "form" ? "" : `<dl class="sb-details">
          ${detail("Email", email, email ? `mailto:${email}` : "")}
          ${detail("Phone", phone, phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "")}
          ${detail("Address", address, mapUrl ? safeHref(mapUrl) : "")}
          ${detail("Hours", hours)}
        </dl>`;
    return `<section class="sb-section sb-contact sb-contact--${attr(block.variant)}">
      <div class="sb-container">
        ${heading(ctx, block)}
        <div class="sb-contact__grid">
          ${form}
          ${details}
        </div>
      </div>
    </section>`;
  },

  newsletter: (block, ctx) => {
    const action = safeHref(str(block, "action") || "#");
    const headline = str(block, "heading").trim();
    const text = str(block, "text").trim();
    return `<section class="sb-section sb-news sb-news--${attr(block.variant)}">
      <div class="sb-container sb-news__inner">
        <div>
          ${headline ? `<h2 ${edit(ctx, block, "heading")}>${escapeHtml(headline)}</h2>` : ""}
          ${text ? `<p ${edit(ctx, block, "text")}>${escapeHtml(text)}</p>` : ""}
        </div>
        <form class="sb-news__form" action="${attr(action)}" method="post" target="_blank">
          <label class="sb-sr" for="sb-news-email">Email address</label>
          <input id="sb-news-email" name="email" type="email" placeholder="you@example.com" autocomplete="email" required>
          <button class="sb-btn sb-btn--primary" type="submit">${escapeHtml(str(block, "buttonLabel") || "Subscribe")}</button>
        </form>
        ${str(block, "note").trim() ? `<p class="sb-note" ${edit(ctx, block, "note")}>${escapeHtml(str(block, "note"))}</p>` : ""}
      </div>
    </section>`;
  },

  embed: (block, ctx) => {
    const title = str(block, "heading").trim();
    const caption = str(block, "caption").trim();
    const ratio = str(block, "ratio", "16x9").replace("x", " / ");
    let frame = "";
    if (block.variant === "raw") {
      frame = str(block, "html").trim();
    } else {
      const src = embedUrl(str(block, "url"));
      frame = src
        ? `<iframe src="${attr(src)}" title="${attr(title || "Embedded content")}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>`
        : `<div class="sb-ph sb-ph--wide"><p>Add a video or map address in the panel on the right.</p></div>`;
    }
    return `<section class="sb-section sb-embed">
      <div class="sb-container">
        ${title ? `<header class="sb-head sb-head--center"><h2 ${edit(ctx, block, "heading")}>${escapeHtml(title)}</h2></header>` : ""}
        <div class="sb-embed__frame" style="--ratio:${attr(ratio)}">${frame}</div>
        ${caption ? `<p class="sb-note sb-note--center" ${edit(ctx, block, "caption")}>${escapeHtml(caption)}</p>` : ""}
      </div>
    </section>`;
  },

  divider: (block, ctx) => {
    const label = str(block, "label").trim();
    return `<div class="sb-divider sb-divider--${attr(block.variant)} sb-divider--${attr(str(block, "size", "m"))}">
      <div class="sb-container">
        ${block.variant === "label" && label ? `<p ${edit(ctx, block, "label")}>${escapeHtml(label)}</p>` : block.variant === "line" ? "<hr>" : ""}
      </div>
    </div>`;
  },

  footer: (block, ctx) => {
    const name = str(block, "logoText").trim() || ctx.site.identity.name;
    const tagline = str(block, "tagline").trim();
    const links = rows(block, "links").filter((row) => row.label?.trim());
    const social = rows(block, "social").filter((row) => row.label?.trim());
    const email = str(block, "email").trim();
    const phone = str(block, "phone").trim();
    const address = str(block, "address").trim();
    const copyright = str(block, "copyright").trim() || `© ${new Date().getFullYear()} ${name || "All rights reserved"}`;
    return `<footer class="sb-footer sb-footer--${attr(block.variant)}">
      <div class="sb-container sb-footer__grid">
        <div class="sb-footer__brand">
          ${name ? `<p class="sb-footer__name" ${edit(ctx, block, "logoText")}>${escapeHtml(name)}</p>` : ""}
          ${tagline ? `<p ${edit(ctx, block, "tagline")}>${escapeHtml(tagline)}</p>` : ""}
        </div>
        ${links.length ? `<nav class="sb-footer__links" aria-label="Footer">
          <ul>${links.map((row, index) => `<li><a href="${attr(safeHref(row.href || "#"))}" ${edit(ctx, block, "links", index, "label")}>${escapeHtml(row.label)}</a></li>`).join("")}</ul>
        </nav>` : ""}
        ${email || phone || address ? `<address class="sb-footer__contact">
          ${email ? `<a href="mailto:${attr(email)}">${escapeHtml(email)}</a>` : ""}
          ${phone ? `<a href="tel:${attr(phone.replace(/[^\d+]/g, ""))}">${escapeHtml(phone)}</a>` : ""}
          ${address ? `<span>${escapeHtml(address).replace(/\n/g, "<br>")}</span>` : ""}
        </address>` : ""}
      </div>
      <div class="sb-container sb-footer__base">
        <p ${edit(ctx, block, "copyright")}>${escapeHtml(copyright)}</p>
        ${social.length ? `<ul class="sb-social">${social.map((row) => {
      const href = safeHref(row.href || "#");
      return `<li><a href="${attr(href)}"${linkTargets(href)}>${escapeHtml(row.label)}</a></li>`;
    }).join("")}</ul>` : ""}
      </div>
    </footer>`;
  },
};

/* ------------------------------------------------------------------- CSS */

const BASE_CSS = `*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--canvas);color:var(--body);font-family:var(--font-body);font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto;display:block}
h1,h2,h3{font-family:var(--font-heading);font-weight:var(--weight-heading);color:var(--ink);letter-spacing:-.02em;margin:0 0 .5em}
h1{font-size:var(--h1);line-height:var(--h1-line)}
h2{font-size:var(--h2);line-height:1.15}
h3{font-size:var(--h3);line-height:1.3}
p{margin:0 0 1em}
a{color:var(--brand);text-underline-offset:3px}
ul,ol{margin:0;padding:0;list-style:none}
:focus-visible{outline:3px solid var(--brand);outline-offset:3px;border-radius:4px}
.sb-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.sb-skip{position:absolute;left:-9999px;top:0;background:var(--brand);color:var(--on-brand);padding:12px 18px;z-index:99}
.sb-skip:focus{left:8px;top:8px}
.sb-container{width:100%;max-width:var(--container);margin:0 auto;padding:0 24px}
.sb-section{padding:var(--section-pad) 0;position:relative}
.sb-section+.sb-section{border-top:0}
.sb-head{margin:0 auto clamp(28px,4vw,48px);max-width:60ch}
.sb-head--center{text-align:center}
.sb-head h2,.sb-head h3{margin-bottom:.35em}
.sb-intro{color:var(--muted);font-size:var(--lead);margin:0}
.sb-eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.75rem;font-weight:600;color:var(--brand);margin:0 0 14px}
.sb-lead{font-size:var(--lead);color:var(--body);max-width:56ch}
.sb-note{font-size:.85rem;color:var(--muted);margin:14px 0 0}
.sb-note--center{text-align:center}
.sb-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.sb-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 24px;border-radius:var(--radius-sm);font-weight:600;font-size:.97rem;text-decoration:none;border:1.5px solid transparent;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,background .18s ease,color .18s ease;font-family:inherit}
.sb-btn--primary{background:var(--brand);color:var(--on-brand);box-shadow:var(--shadow-sm)}
.sb-btn--primary:hover{background:var(--brand-strong);transform:translateY(-1px)}
.sb-btn--outline{border-color:var(--line);color:var(--ink);background:transparent}
.sb-btn--outline:hover{border-color:var(--brand);color:var(--brand)}
.sb-btn--ghost{background:var(--on-brand);color:var(--brand)}
.sb-btn--ghost:hover{transform:translateY(-1px)}
.sb-grid{display:grid;gap:var(--gap);grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))}
@media (min-width:900px){.sb-grid{grid-template-columns:repeat(var(--cols,3),1fr)}}
.sb-ticks{display:grid;gap:10px;margin:22px 0 0}
.sb-ticks li{display:flex;gap:10px;align-items:flex-start;color:var(--body)}
.sb-check{width:20px;height:20px;flex:none;margin-top:2px;fill:none;stroke:var(--brand);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.sb-list{list-style:disc;padding-left:1.2em;margin:0 0 1em;color:var(--body)}
.sb-list li{margin:.25em 0}
.sb-ph{display:grid;place-items:center;background:var(--surface);border:1px dashed var(--line);border-radius:var(--radius-md);color:var(--muted);min-height:200px;aspect-ratio:4/3}
.sb-ph svg{width:38px;height:38px;fill:none;stroke:currentColor;stroke-width:1.5;opacity:.7}
.sb-ph--wide{aspect-ratio:16/9;width:100%}
.sb-emoji{font-size:1.75rem;line-height:1;display:block;margin-bottom:14px}
.sb-num{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:999px;background:var(--brand-soft);color:var(--brand);font-weight:700;font-size:.95rem;margin-bottom:14px;flex:none}
.sb-tick{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:999px;background:var(--brand-soft);margin-bottom:14px}
.sb-tick .sb-check{width:18px;height:18px;margin:0}
.sb-stars{display:flex;gap:2px;margin-bottom:14px}
.sb-stars svg{width:17px;height:17px;fill:var(--accent)}
@media print{.sb-nav,.sb-banner,.sb-burger{display:none}.sb-section{padding:24px 0;break-inside:avoid}}`;

const BLOCK_CSS: Partial<Record<BlockType, string>> = {
  banner: `.sb-banner{padding:10px 24px;text-align:center;font-size:.9rem}
.sb-banner p{margin:0}
.sb-banner a{font-weight:600;text-decoration:underline}
.sb-banner--brand{background:var(--brand);color:var(--on-brand)}
.sb-banner--brand a{color:var(--on-brand)}
.sb-banner--soft{background:var(--brand-soft);color:var(--ink)}
.sb-banner--dark{background:var(--ink);color:var(--canvas)}
.sb-banner--dark a{color:var(--canvas)}`,

  nav: `.sb-nav{background:color-mix(in srgb,var(--canvas) 88%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);z-index:40}
.sb-nav[data-sticky]{position:sticky;top:0}
.sb-nav__inner{display:flex;align-items:center;gap:20px;min-height:72px}
.sb-logo{font-family:var(--font-heading);font-weight:var(--weight-heading);font-size:1.12rem;color:var(--ink);text-decoration:none;letter-spacing:-.02em}
.sb-logo__img{max-height:40px;width:auto}
.sb-menu{margin-left:auto;display:flex;align-items:center;gap:28px}
.sb-nav--center .sb-nav__inner{justify-content:space-between}
.sb-nav--center .sb-logo{order:2;margin:0 auto}
.sb-nav--center .sb-menu{order:1;margin:0}
.sb-nav--center .sb-nav__cta{order:3}
.sb-menu ul{display:flex;gap:26px;flex-wrap:wrap}
.sb-menu ul a{color:var(--body);text-decoration:none;font-size:.95rem;font-weight:500}
.sb-menu ul a:hover{color:var(--brand)}
.sb-burger{display:none;margin-left:auto;background:none;border:0;padding:10px;cursor:pointer;flex-direction:column;gap:5px}
.sb-burger span{display:block;width:22px;height:2px;background:var(--ink);transition:transform .2s ease,opacity .2s ease}
.sb-nav[data-open] .sb-burger span:nth-child(1){transform:translateY(7px) rotate(45deg)}
.sb-nav[data-open] .sb-burger span:nth-child(2){opacity:0}
.sb-nav[data-open] .sb-burger span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
@media (max-width:860px){
.sb-burger{display:flex}
.sb-js .sb-menu{display:none;position:absolute;left:0;right:0;top:100%;background:var(--canvas);border-bottom:1px solid var(--line);padding:18px 24px 26px;flex-direction:column;align-items:flex-start;gap:14px;box-shadow:var(--shadow)}
.sb-js .sb-nav[data-open] .sb-menu{display:flex}
.sb-menu ul{flex-direction:column;gap:14px;width:100%}
.sb-nav--center .sb-logo{margin:0}
}`,

  hero: `.sb-hero{padding-top:clamp(48px,7vw,104px)}
.sb-hero h1{margin-bottom:.35em}
.sb-hero__grid{display:grid;gap:clamp(32px,5vw,64px);align-items:center}
@media (min-width:900px){.sb-hero__grid{grid-template-columns:1.05fr .95fr}}
.sb-hero__img{width:100%;border-radius:var(--radius-lg);box-shadow:var(--shadow);object-fit:cover;aspect-ratio:4/3}
.sb-hero__shot .sb-ph{aspect-ratio:4/3;min-height:260px}
.sb-hero--center{text-align:center}
.sb-hero--center .sb-hero__copy{max-width:54rem;margin:0 auto}
.sb-hero--center .sb-lead{margin-left:auto;margin-right:auto}
.sb-hero--center .sb-actions{justify-content:center}
.sb-hero--center .sb-hero__shot{margin-top:clamp(36px,5vw,64px)}
.sb-hero--center .sb-hero__img{aspect-ratio:16/9}
.sb-hero--minimal{padding-bottom:clamp(36px,5vw,72px)}
.sb-hero--minimal .sb-hero__copy{max-width:46rem}
.sb-hero--image{background-image:linear-gradient(to right,rgba(0,0,0,.72),rgba(0,0,0,.34)),var(--hero-image,linear-gradient(135deg,var(--brand),var(--accent)));background-size:cover;background-position:center;color:#fff;padding-block:clamp(90px,14vw,190px)}
.sb-hero--image h1,.sb-hero--image .sb-lead,.sb-hero--image .sb-note{color:#fff}
.sb-hero--image .sb-eyebrow{color:#fff;opacity:.85}
.sb-hero--image .sb-hero__copy{max-width:46rem}
.sb-hero--image .sb-btn--outline{border-color:rgba(255,255,255,.65);color:#fff}
.sb-hero--image .sb-btn--outline:hover{background:rgba(255,255,255,.12);color:#fff}`,

  logos: `.sb-logos{padding-block:clamp(28px,4vw,56px)}
.sb-logos__title{text-align:center;color:var(--muted);font-size:.85rem;letter-spacing:.08em;text-transform:uppercase;margin:0 0 22px}
.sb-logos__row{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:clamp(24px,5vw,56px)}
.sb-logos__row li{color:var(--muted);font-family:var(--font-heading);font-weight:600;font-size:1.05rem;opacity:.85}
.sb-logos__row img{max-height:34px;width:auto;filter:grayscale(1);opacity:.75}
.sb-logos--boxed .sb-logos__row{background:var(--surface);border-radius:var(--radius-lg);padding:28px 32px}`,

  features: `.sb-feature h3{margin:0 0 .35em}
.sb-feature p{margin:0;color:var(--muted)}
.sb-features--cards .sb-feature{background:var(--card);border:1px solid var(--line);border-radius:var(--radius-md);padding:30px 26px;box-shadow:var(--shadow-sm)}
.sb-features--checklist .sb-feature,.sb-features--numbered .sb-feature{display:flex;gap:16px;align-items:flex-start;text-align:left}
.sb-features--checklist .sb-tick,.sb-features--numbered .sb-num{margin-bottom:0}`,

  split: `.sb-split__grid{display:grid;gap:clamp(30px,5vw,64px);align-items:center}
@media (min-width:900px){.sb-split__grid{grid-template-columns:1fr 1fr}}
.sb-split--wide .sb-split__grid{grid-template-columns:1fr}
.sb-split--wide .sb-split__shot{order:-1}
.sb-split__img{width:100%;border-radius:var(--radius-lg);box-shadow:var(--shadow);object-fit:cover;aspect-ratio:4/3}
.sb-split__copy p{color:var(--body)}`,

  stats: `.sb-stats__title{text-align:center;color:var(--muted);margin:0 0 24px}
.sb-stats__row{display:grid;gap:var(--gap);grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:0;text-align:center}
.sb-stat dt{font-family:var(--font-heading);font-weight:var(--weight-heading);font-size:clamp(2rem,1.4rem+2vw,3rem);color:var(--ink);line-height:1.05}
.sb-stat dd{margin:6px 0 0;color:var(--muted);font-size:.95rem}
.sb-stats--cards .sb-stat{background:var(--surface);border-radius:var(--radius-md);padding:28px 20px}
.sb-stats--band{background:var(--brand);color:var(--on-brand)}
.sb-stats--band dt,.sb-stats--band dd,.sb-stats--band .sb-stats__title{color:var(--on-brand)}
.sb-stats--band dd,.sb-stats--band .sb-stats__title{opacity:.82}`,

  steps: `.sb-steps__list{display:grid;gap:var(--gap)}
@media (min-width:900px){.sb-steps--numbered .sb-steps__list,.sb-steps--cards .sb-steps__list{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}}
.sb-step{display:flex;gap:18px;align-items:flex-start}
.sb-step h3{margin:0 0 .3em}
.sb-step p{margin:0;color:var(--muted)}
.sb-step .sb-num{margin-bottom:0}
.sb-steps--cards .sb-step{background:var(--card);border:1px solid var(--line);border-radius:var(--radius-md);padding:26px;box-shadow:var(--shadow-sm)}
.sb-steps--timeline .sb-steps__list{position:relative;gap:30px}
.sb-steps--timeline .sb-step{position:relative;padding-bottom:6px}
@media (min-width:700px){.sb-steps--timeline .sb-step::after{content:"";position:absolute;left:18px;top:46px;bottom:-30px;width:2px;background:var(--line)}
.sb-steps--timeline .sb-step:last-child::after{display:none}}`,

  gallery: `.sb-gallery__grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}
@media (min-width:800px){.sb-gallery__grid{grid-template-columns:repeat(var(--cols,3),1fr)}}
.sb-shot{margin:0}
.sb-shot__img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius-md)}
.sb-shot figcaption{font-size:.85rem;color:var(--muted);margin-top:8px}
.sb-gallery--mixed .sb-shot:nth-child(4n+1) .sb-shot__img{aspect-ratio:3/4}
.sb-gallery--mixed .sb-shot:nth-child(4n+4) .sb-shot__img{aspect-ratio:4/3}
.sb-gallery--strip .sb-gallery__grid{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:12px}
.sb-gallery--strip .sb-shot{flex:0 0 min(78vw,320px);scroll-snap-align:start}`,

  pricing: `.sb-plans{display:grid;gap:var(--gap);grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr));align-items:start}
.sb-plan{background:var(--card);border:1px solid var(--line);border-radius:var(--radius-lg);padding:32px 28px;position:relative;display:flex;flex-direction:column;gap:6px}
.sb-plan--featured{border-color:var(--brand);box-shadow:var(--shadow)}
.sb-badge{position:absolute;top:-13px;left:28px;background:var(--brand);color:var(--on-brand);font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:6px 12px;border-radius:999px}
.sb-plan h3{margin:0}
.sb-plan__price{font-family:var(--font-heading);font-weight:var(--weight-heading);font-size:2.1rem;color:var(--ink);margin:.1em 0 .2em;line-height:1.1}
.sb-plan__price small{font-size:.9rem;font-weight:400;color:var(--muted)}
.sb-plan__desc{color:var(--muted);margin:0}
.sb-plan .sb-btn{margin-top:auto;width:100%}
.sb-plan .sb-ticks{margin-bottom:24px}
.sb-menu-list{display:grid;gap:22px;max-width:760px;margin:0 auto}
.sb-menu-item__head{display:flex;align-items:baseline;gap:10px}
.sb-menu-item h3{margin:0;font-size:1.08rem}
.sb-menu-item p{margin:4px 0 0;color:var(--muted);font-size:.95rem;max-width:60ch}
.sb-dots{flex:1;border-bottom:1px dotted var(--line);transform:translateY(-4px)}
.sb-price{font-family:var(--font-heading);font-weight:600;color:var(--brand)}
.sb-pricing--simple .sb-plan{border:0;border-top:2px solid var(--line);border-radius:0;padding:26px 0;background:transparent;box-shadow:none}`,

  testimonials: `.sb-quotes{display:grid;gap:var(--gap);grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))}
.sb-quote{background:var(--card);border:1px solid var(--line);border-radius:var(--radius-md);padding:30px 28px;box-shadow:var(--shadow-sm)}
.sb-quote blockquote{margin:0 0 20px;color:var(--ink);font-size:1.03rem;line-height:1.6}
.sb-quote blockquote::before{content:"\\201C"}
.sb-quote blockquote::after{content:"\\201D"}
.sb-quote__who{display:flex;align-items:center;gap:12px}
.sb-quote__who img{width:44px;height:44px;border-radius:999px;object-fit:cover}
.sb-quote__name{margin:0;font-weight:600;color:var(--ink);font-size:.95rem}
.sb-quote__role{margin:0;color:var(--muted);font-size:.85rem}
.sb-testimonials--single .sb-quotes{grid-template-columns:1fr;max-width:780px;margin:0 auto;text-align:center}
.sb-testimonials--single .sb-quote{border:0;background:transparent;box-shadow:none;padding:0}
.sb-testimonials--single blockquote{font-size:clamp(1.25rem,1rem+1.2vw,1.75rem);font-family:var(--font-heading);line-height:1.4}
.sb-testimonials--single .sb-quote__who,.sb-testimonials--single .sb-stars{justify-content:center}
.sb-testimonials--wall .sb-quotes{columns:2;column-gap:var(--gap);display:block}
.sb-testimonials--wall .sb-quote{break-inside:avoid;margin-bottom:var(--gap)}
@media (max-width:760px){.sb-testimonials--wall .sb-quotes{columns:1}}`,

  faq: `.sb-faq__list{display:grid;gap:12px;max-width:820px;margin:0 auto}
.sb-faq--columns .sb-faq__list{max-width:none}
@media (min-width:900px){.sb-faq--columns .sb-faq__list{grid-template-columns:1fr 1fr;gap:12px 24px}}
.sb-faq__item{border:1px solid var(--line);border-radius:var(--radius-md);background:var(--card);padding:4px 22px}
.sb-faq__item[open]{border-color:var(--brand-line)}
.sb-faq__item summary{display:flex;align-items:center;justify-content:space-between;gap:16px;cursor:pointer;list-style:none;padding:18px 0;font-weight:600;color:var(--ink);font-family:var(--font-heading)}
.sb-faq__item summary::-webkit-details-marker{display:none}
.sb-faq__sign{position:relative;width:14px;height:14px;flex:none}
.sb-faq__sign::before,.sb-faq__sign::after{content:"";position:absolute;background:var(--brand);border-radius:2px;transition:transform .2s ease}
.sb-faq__sign::before{inset:6px 0;height:2px}
.sb-faq__sign::after{inset:0 6px;width:2px}
.sb-faq__item[open] .sb-faq__sign::after{transform:scaleY(0)}
.sb-faq__answer{padding:0 0 18px;color:var(--body)}
.sb-faq__answer p:last-child{margin-bottom:0}`,

  team: `.sb-person{text-align:center}
.sb-person a{text-decoration:none;color:inherit;display:block}
.sb-person__img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius-md);margin-bottom:16px}
.sb-person .sb-ph{aspect-ratio:1;min-height:0;margin-bottom:16px}
.sb-person h3{margin:0 0 2px;font-size:1.05rem}
.sb-person p{margin:0;color:var(--muted);font-size:.9rem}
.sb-team--cards .sb-person{background:var(--card);border:1px solid var(--line);border-radius:var(--radius-md);padding:22px;box-shadow:var(--shadow-sm)}`,

  text: `.sb-prose{max-width:68ch}
.sb-text--narrow .sb-prose{margin:0 auto}
.sb-text--wide .sb-prose{max-width:none}
.sb-prose h2{margin-bottom:.6em}
@media (min-width:900px){.sb-text--twocol .sb-prose{max-width:none;columns:2;column-gap:56px}
.sb-text--twocol .sb-prose h2{column-span:all}}`,

  cta: `.sb-cta__inner{display:flex;flex-wrap:wrap;gap:28px;align-items:center;justify-content:space-between}
.sb-cta h2{margin:0 0 .3em}
.sb-cta p{margin:0;color:var(--muted);max-width:52ch}
.sb-cta__actions{display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.sb-cta__actions .sb-btn+.sb-btn{margin-left:10px}
.sb-cta--band{background:var(--brand);color:var(--on-brand)}
.sb-cta--band h2,.sb-cta--band p{color:var(--on-brand)}
.sb-cta--band p{opacity:.88}
.sb-cta--band .sb-btn--outline{border-color:color-mix(in srgb,var(--on-brand) 55%,transparent);color:var(--on-brand)}
.sb-cta--card .sb-cta__inner{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:clamp(32px,5vw,56px)}
.sb-cta--split .sb-cta__inner{border-top:2px solid var(--line);padding-top:clamp(32px,4vw,48px)}`,

  contact: `.sb-contact__grid{display:grid;gap:clamp(28px,4vw,56px);align-items:start}
@media (min-width:880px){.sb-contact--split .sb-contact__grid{grid-template-columns:1.15fr .85fr}}
.sb-form{display:grid;gap:16px}
.sb-field{display:grid;gap:7px}
.sb-field label{font-size:.88rem;font-weight:600;color:var(--ink)}
.sb-field input,.sb-field textarea{font:inherit;font-size:.97rem;color:var(--ink);background:var(--card);border:1.5px solid var(--line);border-radius:var(--radius-sm);padding:12px 14px;width:100%}
.sb-field input:focus,.sb-field textarea:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
.sb-form .sb-btn{justify-self:start}
.sb-details{display:grid;gap:18px;margin:0}
.sb-detail dt{font-size:.78rem;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin-bottom:4px}
.sb-detail dd{margin:0;color:var(--ink);font-size:1.02rem}
.sb-detail a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--brand-line)}
.sb-detail a:hover{color:var(--brand)}
.sb-contact--details .sb-details{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}`,

  newsletter: `.sb-news--band{background:var(--surface)}
.sb-news__inner{display:grid;gap:22px;justify-items:center;text-align:center;max-width:640px;margin:0 auto}
.sb-news h2{margin:0 0 .3em}
.sb-news p{margin:0;color:var(--muted)}
.sb-news__form{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;width:100%}
.sb-news__form input{flex:1 1 220px;font:inherit;padding:13px 16px;border:1.5px solid var(--line);border-radius:var(--radius-sm);background:var(--card);color:var(--ink)}
.sb-news__form input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}`,

  embed: `.sb-embed__frame{position:relative;aspect-ratio:var(--ratio,16/9);border-radius:var(--radius-lg);overflow:hidden;background:var(--surface);border:1px solid var(--line)}
.sb-embed__frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.sb-embed__frame .sb-ph{height:100%;border:0;aspect-ratio:auto}`,

  divider: `.sb-divider--space{padding:0}
.sb-divider--s{height:36px}
.sb-divider--m{height:72px}
.sb-divider--l{height:120px}
.sb-divider--line,.sb-divider--label{height:auto;padding:clamp(24px,4vw,48px) 0}
.sb-divider hr{border:0;border-top:1px solid var(--line);margin:0}
.sb-divider--label p{margin:0;text-align:center;color:var(--muted);font-size:.82rem;letter-spacing:.14em;text-transform:uppercase;position:relative}
.sb-divider--label p::before,.sb-divider--label p::after{content:"";position:absolute;top:50%;width:min(26%,180px);height:1px;background:var(--line)}
.sb-divider--label p::before{left:0}
.sb-divider--label p::after{right:0}`,

  footer: `.sb-footer{background:var(--surface);border-top:1px solid var(--line);padding:clamp(40px,6vw,72px) 0 28px;margin-top:auto}
.sb-footer__grid{display:grid;gap:32px;align-items:start}
@media (min-width:820px){.sb-footer__grid{grid-template-columns:1.4fr 1fr 1fr}}
.sb-footer__name{font-family:var(--font-heading);font-weight:var(--weight-heading);font-size:1.1rem;color:var(--ink);margin:0 0 8px}
.sb-footer p{color:var(--muted);margin:0 0 6px;max-width:44ch}
.sb-footer__links ul{display:grid;gap:10px}
.sb-footer a{color:var(--body);text-decoration:none}
.sb-footer a:hover{color:var(--brand)}
.sb-footer__contact{font-style:normal;display:grid;gap:8px;color:var(--body)}
.sb-footer__base{display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;align-items:center;border-top:1px solid var(--line);margin-top:36px;padding-top:22px}
.sb-footer__base p{margin:0;font-size:.85rem}
.sb-social{display:flex;flex-wrap:wrap;gap:8px}
.sb-social a{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:.82rem;background:var(--card)}
.sb-footer--big{padding-top:clamp(56px,8vw,104px)}
.sb-footer--simple .sb-footer__grid{grid-template-columns:1fr;text-align:center;justify-items:center}
.sb-footer--simple .sb-footer__base{justify-content:center}`,
};

const PATTERN_CSS: Record<Theme["pattern"], string> = {
  none: "",
  dots: `.sb-hero::before{content:"";position:absolute;inset:0;background-image:radial-gradient(var(--brand-line) 1px,transparent 1px);background-size:22px 22px;opacity:.5;pointer-events:none;mask-image:linear-gradient(to bottom,#000,transparent)}`,
  grid: `.sb-hero::before{content:"";position:absolute;inset:0;background-image:linear-gradient(var(--brand-line) 1px,transparent 1px),linear-gradient(90deg,var(--brand-line) 1px,transparent 1px);background-size:64px 64px;opacity:.35;pointer-events:none;mask-image:radial-gradient(ellipse at top,#000,transparent 70%)}`,
  glow: `.sb-hero::before{content:"";position:absolute;inset:-20% -10% auto;height:520px;background:radial-gradient(45% 60% at 50% 0,var(--brand) 0,transparent 70%);opacity:.22;pointer-events:none;filter:blur(20px)}`,
  rays: `.sb-hero::before{content:"";position:absolute;inset:0;background:conic-gradient(from 210deg at 50% -20%,transparent 0deg,var(--brand-soft) 60deg,transparent 140deg);opacity:.8;pointer-events:none}`,
};

const ANIMATION_CSS = `@media (prefers-reduced-motion:no-preference){
.sb-js .sb-reveal{opacity:0;transform:translateY(14px)}
.sb-js .sb-reveal.is-in{opacity:1;transform:none;transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
}
@media print{.sb-js .sb-reveal{opacity:1!important;transform:none!important}}`;

const SCRIPT = `(function(){
  var root=document.documentElement;root.classList.add('sb-js');
  var nav=document.querySelector('.sb-nav'),burger=nav&&nav.querySelector('.sb-burger');
  if(burger){burger.addEventListener('click',function(){
    var open=nav.hasAttribute('data-open');
    if(open){nav.removeAttribute('data-open')}else{nav.setAttribute('data-open','')}
    burger.setAttribute('aria-expanded',String(!open));
    burger.setAttribute('aria-label',open?'Open menu':'Close menu');
  });
  nav.addEventListener('click',function(e){if(e.target.closest('.sb-menu a')){nav.removeAttribute('data-open');burger.setAttribute('aria-expanded','false')}});}
  var reveals=document.querySelectorAll('.sb-reveal');
  if(reveals.length&&'IntersectionObserver'in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    var io=new IntersectionObserver(function(entries){entries.forEach(function(entry){
      if(entry.isIntersecting){entry.target.classList.add('is-in');io.unobserve(entry.target)}})},{rootMargin:'0px 0px -8%',threshold:.08});
    reveals.forEach(function(el){io.observe(el)});
  }else{reveals.forEach(function(el){el.classList.add('is-in')})}
})();`;

/** The stylesheet for one site — only the sections actually on the page. */
export function buildCss(site: Site, used: Set<BlockType>): string {
  const tokens = themeTokens(site.theme);
  const vars = Object.entries(tokens).map(([key, value]) => `  ${key}: ${value};`).join("\n");
  const parts = [`:root {\n${vars}\n}`, BASE_CSS];
  for (const def of BLOCKS) if (used.has(def.type) && BLOCK_CSS[def.type]) parts.push(BLOCK_CSS[def.type]!);
  if (site.theme.pattern !== "none" && used.has("hero")) parts.push(PATTERN_CSS[site.theme.pattern]);
  if (site.theme.animate) parts.push(ANIMATION_CSS);
  if (site.theme.buttons === "soft") parts.push(`.sb-btn--primary{background:var(--brand-soft);color:var(--brand);box-shadow:none}
.sb-btn--primary:hover{background:var(--brand);color:var(--on-brand)}`);
  if (site.theme.buttons === "outline") parts.push(`.sb-btn--primary{background:transparent;color:var(--brand);border-color:var(--brand);box-shadow:none}
.sb-btn--primary:hover{background:var(--brand);color:var(--on-brand)}`);
  return parts.join("\n\n");
}

/* --------------------------------------------------------------- document */

export interface BuildOptions {
  /** Preview mode adds the selection outlines and inline editing hooks. */
  editing?: boolean;
  /** Preview only — the section the person is working on. */
  selected?: string;
  /** Preview only — restore the canvas scroll position after a rebuild. */
  scroll?: number;
  /** Link to an external stylesheet instead of inlining it. */
  externalCss?: string;
  /** Link to an external script instead of inlining it. */
  externalJs?: string;
}

export interface BuiltSite {
  html: string;
  css: string;
  js: string;
  used: Set<BlockType>;
}

const faviconDataUrl = (emoji: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="84">${emoji}</text></svg>`)}`;

function jsonLd(site: Site): string {
  const contact = site.blocks.find((block) => block.type === "contact" && !block.hidden);
  const footer = site.blocks.find((block) => block.type === "footer" && !block.hidden);
  const name = site.identity.name || site.meta.title || site.name;
  const graph: Record<string, unknown>[] = [{
    "@type": "Organization",
    name,
    description: site.meta.description || undefined,
    url: site.meta.url || undefined,
    email: (contact && str(contact, "email")) || (footer && str(footer, "email")) || site.identity.email || undefined,
    telephone: (contact && str(contact, "phone")) || (footer && str(footer, "phone")) || site.identity.phone || undefined,
    address: site.identity.address || (contact && str(contact, "address")) || undefined,
  }];
  const faq = site.blocks.find((block) => block.type === "faq" && !block.hidden);
  if (faq) {
    const items = rows(faq, "items").filter((row) => row.question?.trim() && row.answer?.trim());
    if (items.length) {
      graph.push({
        "@type": "FAQPage",
        mainEntity: items.map((row) => ({
          "@type": "Question", name: row.question,
          acceptedAnswer: { "@type": "Answer", text: row.answer },
        })),
      });
    }
  }
  const clean = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, (_, value) => (value === undefined ? undefined : value));
  return clean.replace(/</g, "\\u003c");
}

const PREVIEW_CSS = `.sb-sel{position:relative}
[data-sb-block]{position:relative}
[data-sb-block]::after{content:"";position:absolute;inset:0;border:2px solid transparent;pointer-events:none;transition:border-color .15s ease;z-index:5}
[data-sb-block]:hover::after{border-color:color-mix(in srgb,var(--brand) 40%,transparent)}
[data-sb-block][data-selected]::after{border-color:var(--brand)}
[data-sb-block][data-selected]::before{content:attr(data-sb-name);position:absolute;top:0;left:0;transform:translateY(-100%);background:var(--brand);color:var(--on-brand);font:600 11px/1.6 ui-sans-serif,system-ui,sans-serif;padding:2px 10px;border-radius:6px 6px 0 0;z-index:6;letter-spacing:.04em}
[data-sb-edit]{outline:none}
[data-sb-edit]:hover{background:color-mix(in srgb,var(--brand) 9%,transparent);box-shadow:0 0 0 2px color-mix(in srgb,var(--brand) 16%,transparent);border-radius:3px}
[data-sb-edit]:focus{background:color-mix(in srgb,var(--brand) 12%,transparent);box-shadow:0 0 0 2px var(--brand);border-radius:3px}
[data-sb-block] a{cursor:default}`;

const PREVIEW_SCRIPT = `(function(){
  var send=function(msg){parent.postMessage(Object.assign({source:'sb-canvas'},msg),'*')};
  document.addEventListener('click',function(e){
    var edit=e.target.closest('[data-sb-edit]');
    var block=e.target.closest('[data-sb-block]');
    if(e.target.closest('a')&&!edit)e.preventDefault();
    if(block)send({type:'select',id:block.getAttribute('data-sb-block'),field:edit?edit.getAttribute('data-sb-edit'):''});
  },true);
  document.addEventListener('input',function(e){
    var el=e.target.closest('[data-sb-edit]');
    if(!el)return;
    send({type:'edit',id:el.getAttribute('data-sb-owner'),path:el.getAttribute('data-sb-edit'),value:el.innerText.replace(/\\u00a0/g,' ')});
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&e.target.closest('[data-sb-edit]')&&!e.shiftKey){e.preventDefault();e.target.blur()}
    if((e.metaKey||e.ctrlKey)&&['z','y','s'].indexOf(e.key.toLowerCase())>-1){e.preventDefault();send({type:'key',key:e.key.toLowerCase(),shift:e.shiftKey})}
  });
  var ticking=false;
  addEventListener('scroll',function(){
    if(ticking)return;ticking=true;
    requestAnimationFrame(function(){ticking=false;send({type:'scroll',value:scrollY})});
  },{passive:true});
  addEventListener('message',function(e){
    var data=e.data||{};
    if(data.type==='scrollTo'){var el=document.querySelector('[data-sb-block="'+data.id+'"]');if(el)el.scrollIntoView({behavior:'smooth',block:'center'})}
    if(data.type==='select'){
      document.querySelectorAll('[data-selected]').forEach(function(el){el.removeAttribute('data-selected')});
      var el2=document.querySelector('[data-sb-block="'+data.id+'"]');if(el2)el2.setAttribute('data-selected','');
    }
  });
  send({type:'ready'});
})();`;

/** Builds the page. The only difference between preview and export is `editing`. */
export function buildSite(site: Site, options: BuildOptions = {}): BuiltSite {
  const visible = site.blocks.filter((block) => !block.hidden);
  const anchors = sectionAnchors(visible);
  const used = new Set<BlockType>(visible.map((block) => block.type));
  const ctx: RenderContext = { site, anchors, editing: !!options.editing, used };

  const body = visible.map((block) => {
    const html = RENDERERS[block.type](block, ctx).trim();
    if (!html) return "";
    const anchor = anchors.get(block.id) ?? block.id;
    const wrapper = options.editing
      ? ` data-sb-block="${attr(block.id)}" data-sb-name="${attr(defOf(block.type).name)}"${options.selected === block.id ? " data-selected" : ""}`
      : "";
    // The section id lives on the outermost element so in-page links land right.
    return html.replace(/^<(section|header|footer|div)\b/, `<$1 id="${attr(anchor)}"${wrapper}`);
  }).filter(Boolean).join("\n\n    ");

  const css = buildCss(site, used);
  const needsScript = used.has("nav") || site.theme.animate;
  const js = needsScript ? SCRIPT : "";
  const font = fontPair(site.theme.font);
  const title = site.meta.title.trim() || site.identity.name || site.name;
  const description = site.meta.description.trim();
  const lang = site.meta.lang.trim() || "en";
  const tokens = themeTokens(site.theme);

  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeHtml(title)}</title>`,
    description ? `<meta name="description" content="${attr(description)}">` : "",
    site.meta.indexable ? "" : `<meta name="robots" content="noindex, nofollow">`,
    `<meta name="theme-color" content="${attr(site.theme.brand)}">`,
    site.meta.url.trim() ? `<link rel="canonical" href="${attr(site.meta.url.trim())}">` : "",
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${attr(title)}">`,
    description ? `<meta property="og:description" content="${attr(description)}">` : "",
    site.meta.url.trim() ? `<meta property="og:url" content="${attr(site.meta.url.trim())}">` : "",
    site.meta.ogImage.trim() ? `<meta property="og:image" content="${attr(site.meta.ogImage.trim())}">` : "",
    `<meta name="twitter:card" content="${site.meta.ogImage.trim() ? "summary_large_image" : "summary"}">`,
    site.meta.favicon.trim() ? `<link rel="icon" href="${attr(faviconDataUrl(site.meta.favicon.trim()))}">` : "",
    font.google.length
      ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?${font.google.map((family) => `family=${family}`).join("&")}&display=swap">`
      : "",
    options.externalCss ? `<link rel="stylesheet" href="${attr(options.externalCss)}">` : `<style>\n${css}\n  </style>`,
    options.editing ? `<style>\n${PREVIEW_CSS}\n  </style>` : "",
    `<script type="application/ld+json">${jsonLd(site)}</script>`,
  ].filter(Boolean).join("\n  ");

  const scripts = [
    options.externalJs && js ? `<script src="${attr(options.externalJs)}" defer></script>` : js ? `<script>\n${js}\n  </script>` : "",
    options.editing ? `<script>\n${PREVIEW_SCRIPT}\n  </script>` : "",
    options.editing && options.scroll ? `<script>window.scrollTo(0,${Math.round(options.scroll)});</script>` : "",
  ].filter(Boolean).join("\n  ");

  const html = `<!doctype html>
<html lang="${attr(lang)}"${site.theme.scheme === "dark" ? ' style="color-scheme:dark"' : ""}>
<head>
  ${head}
</head>
<body id="top"${options.editing ? ' data-sb-canvas="1"' : ""}>
  <a class="sb-skip" href="#main">Skip to content</a>
  <main id="main">
    ${body || `<section class="sb-section"><div class="sb-container"><p style="text-align:center;color:${tokens["--muted"]}">This page has no sections yet.</p></div></section>`}
  </main>
  ${scripts}
</body>
</html>`;

  return { html, css, js, used };
}

/** The three files a "download as a folder" export produces. */
export function buildFiles(site: Site): { name: string; content: string }[] {
  const single = buildSite(site);
  const split = buildSite(site, { externalCss: "styles.css", externalJs: single.js ? "script.js" : undefined });
  const files = [
    { name: "index.html", content: split.html },
    { name: "styles.css", content: `/* ${site.name}: generated stylesheet.\n   Colours, spacing and type all come from the custom properties in :root. */\n\n${single.css}\n` },
  ];
  if (single.js) files.push({ name: "script.js", content: `/* Menu, smooth scrolling and reveal-on-scroll. */\n${single.js}\n` });
  files.push({ name: "README.txt", content: readme(site) });
  return files;
}

function readme(site: Site): string {
  return `${site.name}
${"=".repeat(site.name.length)}

This folder is a complete website. It needs no build step, no server and no
account. index.html is the page, styles.css is the design, script.js runs the
menu and the scroll animations.

PUT IT ONLINE (pick one)

1. Netlify Drop. Go to app.netlify.com/drop and drag this folder onto the page.
   You get a live address in about ten seconds. Free.

2. Cloudflare Pages. Open pages.cloudflare.com, choose "Upload assets", drag the folder.

3. GitHub Pages. Create a repository, upload these files, then Settings →
   Pages → Deploy from branch → main / root.

4. Your own hosting. Upload the files into the public folder (often called
   public_html or www) with FTP or your host's file manager.

CHANGE SOMETHING

Colours, fonts and spacing are all defined once at the top of styles.css inside
:root. Edit a value there and it updates everywhere on the page.

THE CONTACT FORM

A page without a server cannot send email by itself. The form is set to
"${site.blocks.find((b) => b.type === "contact") ? str(site.blocks.find((b) => b.type === "contact")!, "formMode", "mailto") === "post" ? "a form service" : "the visitor's email app" : "the visitor's email app"}".
If you want submissions in your inbox, create a free form endpoint (Formspree,
Getform, Basin) and paste the address into the builder's contact section.

Generated with the Website Builder.
`;
}
