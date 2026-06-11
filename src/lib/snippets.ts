/** Export-snippet generators for a built link. */

export interface SnippetInput {
  href: string;
  label: string;
}

export function htmlSnippet({ href, label }: SnippetInput): string {
  return [
    `<a`,
    `  href="${escapeHtmlAttr(href)}"`,
    `  target="_blank"`,
    `  rel="noopener noreferrer"`,
    `  style="display:inline-block;padding:10px 20px;background:#18181b;color:#fff;border-radius:8px;font-family:system-ui,sans-serif;font-size:14px;font-weight:500;text-decoration:none;"`,
    `>`,
    `  ${escapeHtml(label)}`,
    `</a>`,
  ].join("\n");
}

export function reactSnippet({ href, label }: SnippetInput): string {
  const componentName = label.replace(/[^a-zA-Z0-9]/g, "") || "LinkButton";
  return [
    `export function ${componentName}Button() {`,
    `  return (`,
    `    <a`,
    `      href=${JSON.stringify(href)}`,
    `      target="_blank"`,
    `      rel="noopener noreferrer"`,
    `      className="inline-block rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"`,
    `    >`,
    `      ${escapeHtml(label)}`,
    `    </a>`,
    `  );`,
    `}`,
  ].join("\n");
}

export function markdownSnippet({ href, label }: SnippetInput): string {
  return `[${label.replace(/([\[\]])/g, "\\$1")}](${href})`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
