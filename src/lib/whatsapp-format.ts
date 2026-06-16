/**
 * Render WhatsApp's text formatting to safe HTML for a chat preview.
 *
 * WhatsApp's markup is its own dialect, not Markdown:
 *   *bold*   _italic_   ~strikethrough~   ```monospace```
 * plus literal newlines. We escape all user text first, then add only our own
 * tags, so the output is safe to inject with dangerouslySetInnerHTML.
 */

export const WA_MAX = 4096;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const nl = (s: string) => s.replace(/\n/g, "<br/>");

/** Inline runs: bold / italic / strikethrough. Operates on already-escaped text. */
function inline(s: string): string {
  // Each marker must hug non-space content and sit on a word boundary, the way
  // WhatsApp decides whether the asterisk/underscore/tilde is formatting.
  s = s.replace(/(^|[^\w*])\*(\S(?:[^*\n]*\S)?)\*(?=[^\w*]|$)/g, "$1<strong>$2</strong>");
  s = s.replace(/(^|[^\w_])_(\S(?:[^_\n]*\S)?)_(?=[^\w_]|$)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^\w~])~(\S(?:[^~\n]*\S)?)~(?=[^\w~]|$)/g, "$1<del>$2</del>");
  return s;
}

/** Convert WhatsApp-formatted text to preview HTML. */
export function whatsappToHtml(text: string): string {
  // ```monospace``` blocks are protected from inline formatting and may span lines.
  const parts = text.split(/```([\s\S]+?)```/g);
  return parts
    .map((part, i) =>
      i % 2 === 1
        ? `<code class="font-mono text-[0.92em]">${nl(escapeHtml(part))}</code>`
        : nl(inline(escapeHtml(part)))
    )
    .join("");
}
