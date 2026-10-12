/**
 * @fileoverview Input sanitization utility functions.
 * Cleans and escapes user-provided content before display or submission.
 * Prevents XSS by stripping HTML tags and escaping special characters.
 */

/**
 * Strip all HTML tags from a string.
 * Used to sanitize user input before submitting to the API.
 * This is a defense-in-depth measure; the backend also sanitizes.
 */
export function sanitizeInput(input: string): string {
  // replace html tags with empty string
  return input
    .replace(/<[^>]*>/g, '')
    // collapse multiple whitespace characters into a single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Escape HTML special characters to prevent XSS when rendering raw strings.
 * Use this before inserting any user content into innerHTML contexts.
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => map[char] ?? char);
}

/**
 * Truncate a string to the specified maximum length, appending an ellipsis if truncated.
 * Used for message previews in room lists and notification text.
 * @param text - the string to truncate
 * @param maxLength - maximum number of characters before truncation
 * @param ellipsis - the string to append (default: '...')
 */
export function truncateText(
  text: string,
  maxLength: number,
  ellipsis = '...'
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  // cut at a word boundary where possible to avoid mid-word truncation
  const truncated = text.slice(0, maxLength - ellipsis.length);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + ellipsis;
  }
  return truncated + ellipsis;
}

/**
 * Sanitize a filename for safe use in file download operations.
 * Removes characters that are unsafe in file system paths.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

/**
 * Strip non-printable and control characters from a string.
 * Used to clean copy-pasted content that may contain hidden characters.
 */
export function stripControlChars(text: string): string {
  // remove all control characters except tab, newline, and carriage return
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}
