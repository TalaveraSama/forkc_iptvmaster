# Bundled mobile app

IPTVMaster's editor is a single-page React app. This document describes the
optional **Android APK** build that packages that editor as an installable app,
and the small, additive server changes that make it work. The browser editor is
unchanged: everything added here is opt-in and off by default for normal web
use.

## Why it needs anything special

The browser build is served by the IPTVMaster server itself, so its API calls
are same-origin and it authenticates with an `HttpOnly`, `SameSite=Strict`
session cookie plus a CSRF cookie/header pair (see
[ARCHITECTURE.md](./ARCHITECTURE.md), "Administrator boundary").

The bundled app ships those same static assets inside the APK and runs them from
a local `https://localhost` origin (Capacitor's Android scheme). The server is
reached on another host, so from the app's point of view every request is
**cross-origin**. Three consequences follow:

- A `SameSite=Strict` cookie is not sent on a cross-origin request, so the
  session cookie cannot be reused.
- The API's CSRF check requires a same-origin browser request.
- The browser/WebView blocks cross-origin reads unless the server opts in with
  CORS.

Rather than weaken the cookie model (which would affect the browser editor too),
the app uses a **bearer token** — the standard approach for a native client — and
the server opts in to CORS for the app's origin only.

## How it works

1. On first launch the app asks for the server address and stores it
   (`localStorage`). See `apps/web/src/connection.ts`.
2. It signs in at `POST /api/v1/auth/token` with the administrator credentials
   and receives a long-lived bearer token, which it stores and sends as
   `Authorization: Bearer <token>` on every API call. A small `fetch` wrapper
   (`apps/web/src/api-security.ts`) rewrites `/api/...` URLs to the configured
   server and attaches the token; logo/image URLs are prefixed the same way.
3. The server authenticates the bearer token, and because a bearer token is not
   an ambient credential the browser attaches automatically, token-authenticated
   requests are **exempt from the CSRF/same-origin checks** that protect the
   browser editor.

All of this is gated behind a build-time flag. The app is compiled with
`vite build --mode mobile`, which sets `VITE_IPTVMASTER_MOBILE=true`
(`apps/web/.env.mobile`). When that flag is unset — every normal build —
`isMobileBuild()` is false, the connection helpers are no-ops, and the bundle
behaves exactly as the browser editor does today.

## Server changes (additive, opt-in)

- **Migration `020_admin_api_tokens.sql`** adds an `admin_api_token` table.
  Only the SHA-256 hash of each token is stored, mirroring `admin_session`; a
  database leak cannot be replayed as a live token. Rows expire and are
  revocable; the maintenance scheduler prunes expired tokens.
- **`AuthService`** gains `issueApiToken`, `authenticateApiToken`,
  `revokeApiToken`, and `verifyAdministrator`. These are additive; the cookie
  session flow is untouched.
- **Endpoints**
  - `POST /api/v1/auth/token` — exchange credentials for a token (rate-limited
    like login; reachable cross-origin; sets no cookies).
  - `DELETE /api/v1/auth/token` — revoke the token sent on the request
    (mobile sign-out).
  - `GET /api/v1/auth/status` — also accepts a bearer token so the app can
    validate a stored token on launch.
- **Auth hook** — a request bearing a valid token is authenticated and skips the
  cookie CSRF/same-origin check. Cookie requests keep the existing behaviour.
- **CORS** — when the request `Origin` is one of the configured mobile origins,
  the API returns the appropriate CORS headers. Credentials stay **disabled**
  for these origins (the app uses a token, never cookies), and non-browser
  clients (IPTV players, `curl`) are unaffected because they send no `Origin`.

### Environment variables

| Variable                     | Default                                                    | Meaning                                                                             |
| ---------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `IPTVMASTER_API_TOKEN_HOURS` | `2160` (90 days)                                           | Lifetime of a mobile API token.                                                     |
| `IPTVMASTER_MOBILE_ORIGINS`  | `https://localhost,http://localhost,capacitor://localhost` | Origins allowed to call the API cross-origin for the app. Set to `none` to disable. |

The default origins match the Capacitor WebView, so the app works out of the box
once built. Operators can narrow the list to a single value.

## Security posture

- The bearer token is stored in the app's local storage. This is the same trust
  boundary as any native client holding a credential; it is revocable and
  expiring, and the device is assumed to be the operator's own.
- Enabling CORS for the app origin does **not** expose the browser editor: no
  cookies are sent cross-origin, and every cross-origin request still needs a
  valid bearer token that only the app possesses.
- The published playlist/EPG/Xtream player endpoints are unchanged and remain
  outside browser authentication (see ARCHITECTURE.md).
- Cleartext HTTP is permitted only inside the APK's network security config and
  matches IPTVMaster's LAN-over-HTTP design. Terminating TLS removes the need
  for it.

## Building

See [`../mobile/README.md`](../mobile/README.md) for the exact commands
(`build:mobile`, `cap sync`, Gradle `assembleDebug`).
