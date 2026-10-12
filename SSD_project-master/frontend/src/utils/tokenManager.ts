/**
 * @fileoverview JWT access token management utilities.
 * Handles storing, retrieving, and expiry-checking the access token in localStorage.
 * NOTE: The refresh token is stored in an httpOnly cookie managed by the server.
 */

import { TOKEN_KEY } from '../config';

/**
 * Store the access token in localStorage.
 * This is a short-lived JWT (typically 15 minutes).
 */
export function storeAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Retrieve the access token from localStorage.
 * Returns null if no token is stored.
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Clear the access token from localStorage.
 * Called on logout and on failed refresh attempts.
 */
export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Decode a JWT payload without verifying the signature.
 * IMPORTANT: This is for client-side expiry checking ONLY.
 * The server always validates the signature; this is just a UX optimization
 * to avoid sending requests with obviously expired tokens.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    // jwt structure: header.payload.signature - we only need the payload (index 1)
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // base64url decode: replace url-safe chars and add padding if needed
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    // malformed token - treat as expired
    return null;
  }
}

/**
 * Check if a JWT token is expired based on its 'exp' claim.
 * Adds a 30-second buffer to account for clock skew between client and server.
 * @returns true if the token is expired or invalid
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    // if we can't decode the expiry, treat the token as expired to be safe
    return true;
  }
  // 'exp' is in seconds since epoch; subtract 30s buffer for clock skew
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp < nowInSeconds + 30;
}

/**
 * Get the user id from the access token payload without an API call.
 * Used for quick checks; always prefer the auth context for the full user object.
 */
export function getUserIdFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return (payload.sub as string) || (payload.userId as string) || null;
}
