/**
 * Connection configuration for the bundled mobile (Capacitor) build.
 *
 * In the browser build the app is served by the IPTVMaster server itself, so
 * API calls are same-origin (`/api/v1/...`) and authentication uses the
 * HttpOnly session cookie. The mobile build instead ships these static assets
 * inside the APK and runs from a local `https://localhost` origin, so it must
 * know which server to talk to and authenticate with a bearer token.
 *
 * Everything here is a no-op unless the build was produced with
 * `VITE_IPTVMASTER_MOBILE=true`, which keeps the browser build byte-for-byte
 * identical in behaviour.
 */

const SERVER_KEY = 'iptvmaster.server';
const TOKEN_KEY = 'iptvmaster.token';

/** True only in the mobile build (see vite-env.d.ts). */
export function isMobileBuild(): boolean {
  return import.meta.env.VITE_IPTVMASTER_MOBILE === 'true';
}

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode); the session simply won't
    // survive a reload.
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Configured server base URL, or '' for the same-origin browser build. */
export function getServerBase(): string {
  if (!isMobileBuild()) return '';
  return normalizeBase(readStorage(SERVER_KEY));
}

export function setServerBase(url: string): void {
  writeStorage(SERVER_KEY, normalizeBase(url));
}

export function getToken(): string {
  if (!isMobileBuild()) return '';
  return readStorage(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (token) writeStorage(TOKEN_KEY, token);
  else removeStorage(TOKEN_KEY);
}

/** Clear all connection state (server + token), returning to the setup screen. */
export function clearConnection(): void {
  removeStorage(SERVER_KEY);
  removeStorage(TOKEN_KEY);
}

/**
 * Resolve a root-relative API/media path against the configured server. In the
 * browser build (no server configured) the path is returned unchanged so it
 * stays same-origin.
 */
export function apiUrl(path: string): string {
  const base = getServerBase();
  return base ? `${base}${path}` : path;
}

/**
 * The origin used to display player/EPG output URLs to the operator. In the
 * browser build this is the page origin; in the mobile build it is the
 * configured server.
 */
export function serverOrigin(): string {
  return getServerBase() || window.location.origin;
}
