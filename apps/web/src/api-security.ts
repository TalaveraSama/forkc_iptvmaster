import { getServerBase, getToken } from './connection.js';

const CSRF_COOKIE = 'iptvmaster_csrf';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function readCookie(name: string): string | undefined {
  for (const part of document.cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function installApiSecurity(): void {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const request = input instanceof Request ? input : undefined;
    const requestUrl = request
      ? request.url
      : input instanceof URL
        ? input.href
        : String(input);
    const url = new URL(requestUrl, window.location.href);
    const method = (init.method ?? request?.method ?? 'GET').toUpperCase();
    const headers = new Headers(request?.headers);
    new Headers(init.headers).forEach((value, name) =>
      headers.set(name, value),
    );

    // Mobile build: point API calls at the configured server and authenticate
    // with the bearer token instead of the same-origin session cookie. The
    // rewrite only applies to string/URL inputs (the app never issues API
    // calls as Request objects), so request bodies carried in `init` are kept.
    const serverBase = getServerBase();
    const token = getToken();
    let target = url;
    if (serverBase && !request && url.pathname.startsWith('/api/')) {
      target = new URL(url.pathname + url.search, serverBase);
    }
    const usingToken = Boolean(serverBase && token);
    if (usingToken) {
      headers.set('authorization', `Bearer ${token}`);
    }

    if (
      target.origin === window.location.origin &&
      target.pathname.startsWith('/api/') &&
      UNSAFE_METHODS.has(method)
    ) {
      const csrfToken = readCookie(CSRF_COOKIE);
      if (csrfToken) headers.set('x-iptvmaster-csrf', csrfToken);
    }

    const fetchInput = target === url ? input : target.toString();
    const response = await nativeFetch(fetchInput, {
      ...init,
      method,
      headers,
      credentials: usingToken ? 'omit' : (init.credentials ?? 'same-origin'),
    });
    if (
      response.status === 401 &&
      !target.pathname.startsWith('/api/v1/auth/')
    ) {
      window.dispatchEvent(new Event('iptvmaster:authentication-required'));
    }
    return response;
  };
}
