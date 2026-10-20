import DOMPurify from 'dompurify';

/**
 * Strip all markup from untrusted text (layout names, imported titles, research summaries).
 * The result is plain text and is always rendered as a React text node, never as HTML.
 */
export function sanitizeText(input: string, maxLength = 200): string {
  // Returning a fragment and reading textContent avoids HTML entity escaping (& stays &).
  const fragment = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_DOM_FRAGMENT: true,
  });
  const stripped = fragment.textContent ?? '';
  return stripped.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
