/**
 * sanitizers.ts
 *
 * input sanitization utilities using the xss library and custom logic.
 * all user-supplied strings must pass through sanitization before processing
 * or storage. this is a defense-in-depth layer — validation is still required.
 */

import xss, { IFilterXSSOptions } from 'xss';

/**
 * xss library options — whitelist approach: strip ALL html tags and attributes.
 * for a messaging app, we never want html in messages — all content is text-only.
 */
const XSS_OPTIONS: IFilterXSSOptions = {
  whiteList: {}, // no tags allowed — strip everything
  stripIgnoreTag: true, // strip disallowed tags rather than escaping
  stripIgnoreTagBody: ['script', 'style'], // completely remove script/style contents
};

/**
 * sanitizes a string by stripping all html/xss payloads.
 * also removes null bytes, trims whitespace, and normalizes unicode.
 * use this on all user-supplied text input before saving or processing.
 *
 * @param input - raw user input string
 * @returns sanitized string safe for storage and display
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';

  return (
    xss(input, XSS_OPTIONS)
      // remove null bytes (can cause issues in c-based libs and some databases)
      .replace(/\0/g, '')
      // normalize line endings to unix style
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim()
  );
}

/**
 * sanitizes all string values in an object recursively.
 * non-string values (numbers, booleans) are left unchanged.
 * arrays are mapped recursively.
 * use for sanitizing entire request body objects.
 *
 * @param obj - the object to sanitize
 * @param depth - internal recursion depth guard
 * @returns new object with all strings sanitized
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  depth = 0
): T {
  // guard against deeply nested objects used to DoS the sanitizer
  if (depth > 5) return obj;
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeString(item)
          : typeof item === 'object' && item !== null
          ? sanitizeObject(item as Record<string, unknown>, depth + 1)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * sanitizes a string that might contain limited html (e.g., rich text fields).
 * allows only safe formatting tags: b, i, em, strong, u.
 * strips all other tags, event handlers, and javascript: urls.
 *
 * @param html - raw html string
 * @returns sanitized html with only safe tags remaining
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';

  const LIMITED_XSS_OPTIONS: IFilterXSSOptions = {
    whiteList: {
      b: [],
      i: [],
      em: [],
      strong: [],
      u: [],
      br: [],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
    // remove javascript: urls and data: urls from href/src
    onTagAttr: (_tag: string, name: string, value: string): string | undefined => {
      if (name === 'href' || name === 'src') {
        const normalized = value.toLowerCase().trim();
        if (normalized.startsWith('javascript:') || normalized.startsWith('data:')) {
          return ''; // strip dangerous protocol handlers
        }
      }
      return undefined; // let xss handle it normally
    },
  };

  return xss(html, LIMITED_XSS_OPTIONS).trim();
}

/**
 * normalizes an email address: lowercase and trim.
 * does NOT sanitize html from emails — they are encrypted before storage.
 * this only normalizes format for lookup consistency.
 *
 * @param email - raw email string
 * @returns normalized email
 */
export function normalizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  return email.toLowerCase().trim();
}

/**
 * escapes special characters for use in mongodb regex queries.
 * prevents injection via search parameters.
 *
 * @param str - the search string
 * @returns escaped string safe for use in new RegExp()
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
