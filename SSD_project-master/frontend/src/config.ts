/**
 * @fileoverview Application configuration constants.
 * Reads environment variables and exports typed constants used throughout the app.
 * Sensitive config (API URLs, keys) should never be hardcoded here.
 *
 * Deployment strategy:
 * - Development (CRA dev server on :3000): REACT_APP_API_URL points at :5000.
 * - Production (backend serves the build): both the SPA and the API live on
 *   the same origin, so API and socket URLs are computed from window.location
 *   at runtime. That way the same bundle works on localhost, any LAN IP,
 *   and any tunnel / reverse-proxy hostname.
 */

// pick sane runtime defaults based on how the app is being served.
// - in a browser, derive the origin from window.location
// - in a node/test context (window undefined), fall back to localhost
function getRuntimeOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:5000';
}

// base url for all api requests
// overridable at build-time via REACT_APP_API_URL (e.g. for CRA dev server
// talking to the separate :5000 backend)
export const API_URL =
  process.env.REACT_APP_API_URL || `${getRuntimeOrigin()}/api`;

// websocket server url for real-time messaging
// socket.io will connect to the same origin that served the page by default
export const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || getRuntimeOrigin();

// display name of the application used in page titles and branding
export const APP_NAME = process.env.REACT_APP_APP_NAME || 'Shield-Chat';

// localStorage key for storing the access token (short-lived JWT)
export const TOKEN_KEY = 'shield_chat_access';

// localStorage key for storing the refresh token identifier
export const REFRESH_KEY = 'shield_chat_refresh';
