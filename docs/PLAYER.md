# Player app (Netflix-style front end)

`apps/player` is an optional viewer-facing web app that consumes the
Xtream-compatible API published by IPTVMaster output profiles. It is not the
administrator editor (`apps/web`); it is what household devices open to browse
and play content: a hero banner, category carousels, film and series detail
sheets with episode browsers, search, "continue watching", and "my list".

The player never touches provider credentials. It logs in with the fixed
username `iptvmaster` and an output-profile token, exactly like any Xtream
Codes player, and playback uses the same token-authenticated `/live`,
`/movie`, and `/series` redirect paths, so video traffic still flows directly
between the device and the provider.

## Serving the app

Production builds are embedded in the application image: the API serves the
built player under **`/player/`** on the same origin (the admin editor stays
at `/`). Same-origin serving matters because production disables CORS, and
because the playback redirect paths then work without any extra
configuration.

Open `http://<server>:8080/player/`, enter the server address (pre-filled
with the current origin) and an output token, and the catalogue loads from
that profile's published media types.

The player also ships a web manifest with icons, so browsers can install it
to the home screen, and it can be packaged as an Android APK with Capacitor;
packaged clients reach the output API cross-origin only when the server sets
`IPTVMASTER_PLAYER_CORS_ORIGINS` (opt-in allowlist). Step-by-step build
instructions for the panel, the web player, and the APK live in
[docs/BUILD.md](./BUILD.md).

### Development

```sh
npm run dev                 # core + api + web + player (player on :5174)
```

The player dev server proxies `player_api.php`, `get.php`, `xmltv.php`, and
the playback paths to `http://127.0.0.1:8080` (override with
`IPTVMASTER_API_TARGET`). When working behind a tunnel or preview host, set
`IPTVMASTER_DEV_ALLOWED_HOSTS` to a comma-separated host allowlist (a
leading dot matches subdomains).

### Demo without a provider

A zero-dependency mock of the published Xtream API ships in
`apps/player/mock`:

```sh
npm run mock -w @iptvmaster/player    # listens on :8080
npm run dev -w @iptvmaster/player     # then open http://127.0.0.1:5174/player/
```

The login screen offers a demo-token button in development builds
(`demotoken1234567890`). The mock answers every catalogue action with a small
deterministic catalogue and redirects all playback to short public sample
MP4s, which exercises browsing, preroll ads, playback, resume, and favorites
end to end.

## White-label branding

Branding is runtime configuration, not build configuration: renaming the app
or swapping the logo never requires a rebuild.

Resolution order (each layer overrides the previous one):

1. Built-in defaults in `src/config.ts`.
2. `branding.json` served next to the built player (in the repository:
   `apps/player/public/branding.json`, deployed to `public/player/`).
3. Per-device overrides saved in `localStorage` from the in-app
   **⚙ Personalización** panel.

| Field             | Type                            | Meaning                                             |
| ----------------- | ------------------------------- | --------------------------------------------------- |
| `appName`         | string ≤ 80                     | Name shown in the navbar, login, and document title |
| `tagline`         | string ≤ 160                    | Subtitle on the login card and empty hero           |
| `logoUrl`         | http(s) URL or `""`             | Custom logo; `""` keeps the built-in mark           |
| `accentColor`     | `#rrggbb`                       | Buttons, highlights, progress bars                  |
| `backgroundColor` | `#rrggbb`                       | Page background                                     |
| `heroSource`      | `series` \| `movies` \| `mixed` | What the home hero rotates through daily            |
| `showLiveSection` | boolean                         | Show or hide the live-TV nav item and rows          |

Invalid values fall back to their defaults and are listed by the settings
panel, so a typo can never white-screen the app.

## Personalized advertising

Ads are client-selected from an `ads.json` document with the same resolution
order as branding (built-in default: enabled with an empty lineup; deployed
sample file ships two house ads and one banner). The selection engine
(`src/ads.ts`) is a pure, unit-tested function, so a server-driven ad API can
replace it later without UI changes.

### Document shape

```jsonc
{
  "enabled": true,
  "placements": {
    "preroll": { "enabled": true, "maxPerHour": 6 }, // before playback
    "banner": { "enabled": true, "maxPerHour": 12 }, // in-page on home
    "interstitial": { "enabled": true, "maxPerHour": 3 }, // before a detail sheet
  },
  "ads": [
    {
      "id": "video-sample", // unique, used for frequency capping
      "type": "video", // "video" | "image" | "message"
      "label": "Anuncio",
      "mediaUrl": "https://…/ad.mp4", // required for video/image (http/https)
      "clickUrl": "https://…", // optional click-through (new tab)
      "title": "", // message ads need title and/or text
      "text": "",
      "durationSec": 15, // image/message display time, video cap
      "skipAfterSec": 5, // skip button appears after this
      "weight": 3, // relative chance when several match
      "frequencyCapPerDay": 4, // null = unlimited
      "targeting": {
        "mediaTypes": ["vod", "series"], // context must match one
        "categories": ["Acción"], // substring of the category name
        "keywords": ["futbol"], // substring of title or category
        "hoursFrom": 18, // local hour window, wraps
        "hoursTo": 23, // midnight; null = unrestricted
      },
    },
  ],
}
```

### Personalization signals

- **Content context**: the media type, category name, and title being watched
  or opened. Category and keyword matching ignores case and accents
  (`futbol` matches _Fútbol_).
- **Local time of day**: hour windows, including overnight wraps (22→02).
- **Fatigue rules**: per-ad daily caps and per-placement hourly caps, counted
  per device in `localStorage`.

Every impression increments the counters before rendering, every placement
labels itself ("Anuncio"/"Promo"), overlays are skippable after
`skipAfterSec`, video ads carry a safety timeout so a stalled creative can
never trap the viewer, and click-throughs open in a new tab with `noopener`.
Only `http(s)` media and click URLs are accepted; ads are data, never HTML,
so a malformed document cannot inject scripts.

### Editing ads

The **⚙ Personalización** panel includes a JSON editor with validation:
apply changes for the current device, download the document to drop into
`public/player/ads.json` for all users, or reload the server copy and discard
local edits.

## Playback formats and browser limits

The player redirects to the provider stream, so what plays in a browser
depends on the provider container:

- **MP4** plays natively everywhere.
- **HLS (m3u8)** plays natively on Safari and through `hls.js` (lazy-loaded)
  elsewhere, provided the provider sends CORS headers; without them the
  fallback below appears.
- **TS/MKV**, the common IPTV containers, are not playable in browsers. The
  watch screen detects the failure and offers an external-player handoff:
  open the tokenized redirect URL in VLC/MPV/TiviMate or copy it.

This keeps the project boundary intact — IPTVMaster still does not proxy,
relay, or transcode video. If browser playback of TS becomes a requirement,
an opt-in local relay would be a deliberate architecture change (see
`docs/ARCHITECTURE.md`).

## What the player stores locally

Per-device `localStorage` only, namespaced `iptvmaster.player.*`: the chosen
server and token, branding/ads overrides, favorites, resume positions, and ad
impression counters. Nothing is sent anywhere except the IPTVMaster server
itself (catalogue and playback) and the ad media/click URLs configured by the
operator.

## Roadmap ideas

- Server-side ad decisions (the engine is already an injectable callback).
- TMDB enrichment for film metadata once the output API exposes it.
- EPG-backed live rows (`xmltv.php` is already published).
- Multiple household profiles behind one output token.
