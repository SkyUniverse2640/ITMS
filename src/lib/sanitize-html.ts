import DOMPurify from "isomorphic-dompurify";

/**
 * Allow-list for rich-text content produced by the TipTap editor.
 * Anything outside this set (script, iframe, event handlers, javascript: URLs,
 * style, etc.) is stripped. Used both when persisting content and when
 * rendering stored HTML, so untrusted input can never reach the DOM as markup.
 */
const RICH_TEXT_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "b", "strong", "i", "em", "u", "s", "strike", "del",
    "ul", "ol", "li", "blockquote", "code", "pre",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "a", "span", "hr",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
  // Only permit safe URL schemes on links.
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  ALLOW_DATA_ATTR: false,
};

/** Sanitize rich-text HTML for safe storage and rendering. */
export function sanitizeRichText(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, RICH_TEXT_CONFIG);
}
