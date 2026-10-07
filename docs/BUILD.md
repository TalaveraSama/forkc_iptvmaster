# Build guide: panel, player web y APK

How each distributable in this repository is produced. All commands run from
the repository root unless stated otherwise.

## 1. The panel (administrator editor + API)

The panel is the React editor in `apps/web` plus the Fastify API in
`apps/api`; in production they ship as **one container image** where the API
serves the built panel from `/`.

### Development (no Docker)

```sh
npm install
# PostgreSQL 17 for local work:
docker compose up -d postgres        # or point DATABASE_URL at any PG 17
DATABASE_URL=postgresql://iptvmaster:<password>@127.0.0.1:5432/iptvmaster \
IPTVMASTER_MASTER_KEY=<44-char base64 key> \
npm run dev
```

- Panel: http://127.0.0.1:5173 (Vite dev server, proxies `/api` to :8080)
- API: http://127.0.0.1:8080

Generate the two secrets like `.env.example` shows
(`openssl rand -base64 32` style values).

### Production image + stack (Docker/Podman)

```sh
docker build \
  --build-arg IPTVMASTER_VERSION=dev \
  --build-arg IPTVMASTER_REVISION=$(git rev-parse HEAD) \
  --tag iptvmaster:dev .
IPTVMASTER_IMAGE=iptvmaster:dev docker compose up -d
```

The panel (and the player app) are then served on `http://<host>:8080/`.
Required env: `POSTGRES_PASSWORD`, `IPTVMASTER_MASTER_KEY` (see
`.env.example`). For pushing a build to a LAN host over SSH see
[docs/DEPLOY.md](./DEPLOY.md); for VM/NAS installs see
[docs/PROXMOX_INSTALL.md](./PROXMOX_INSTALL.md) and
[docs/SYNOLOGY.md](./SYNOLOGY.md).

### Full verification (what CI runs)

```sh
npm run check          # format, lint, versions, typecheck, tests, build
```

## 2. The player web app

`apps/player` builds with the root pipeline (`npm run build`) and its output
is embedded in the image at `public/player`, served under **`/player/`** on
the same origin as the panel. Nothing extra is needed for web deployment.

Standalone development with the bundled mock provider:

```sh
npm run mock -w @iptvmaster/player   # mock Xtream API on :8080
npm run dev -w @iptvmaster/player    # player on :5174 (demo token button)
```

Details, branding, and ads: [docs/PLAYER.md](./PLAYER.md).

### Installable web app (PWA)

The player ships a web manifest and icons, so mobile/desktop browsers can
"Add to home screen" and open it fullscreen. The manifest uses relative URLs,
so it works under `/player/` and inside packaged builds alike.

## 3. Android APK (Capacitor)

The player becomes a native Android app through Capacitor 7. The generated
`apps/player/android/` project is a build artifact and is **not** committed
(`.gitignore`); regenerate it whenever needed.

### One-time machine setup

1. Install the JDK 21 and the Android SDK (Android Studio's SDK Manager is
   the easiest path). Set `ANDROID_HOME` (Android Studio default:
   `~/Android/Sdk` / `%LOCALAPPDATA%\Android\Sdk`).
2. Accept licenses once: `sdkmanager --licenses`.

### Build the debug APK

```sh
npm install                                   # fetches @capacitor/* too
cd apps/player

IPTVMASTER_PLAYER_BASE=/ npm run build        # bundle served from APK root
npx cap add android                           # first time only
npm run android:prepare                       # enables http (LAN) cleartext
npx cap sync android                          # copies dist + config

cd android
./gradlew assembleDebug                       # → android/app/build/outputs/apk/debug/app-debug.apk
```

On Windows use `gradlew.bat` and `set IPTVMASTER_PLAYER_BASE=/` (or
`$env:IPTVMASTER_PLAYER_BASE='/'` in PowerShell) before building.

Install on a device: `adb install -r app/build/outputs/apk/debug/app-debug.apk`
or copy the APK and open it on the phone (allow "unknown sources").

### Rebuild after player changes

```sh
cd apps/player
IPTVMASTER_PLAYER_BASE=/ npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

### Release APK / AAB (signed)

```sh
cd apps/player/android
keytool -genkey -v -keystore player-release.keystore -alias player \
  -keyalg RSA -keysize 2048 -validity 10000
./gradlew assembleRelease     # then sign, or configure signingConfigs in app/build.gradle
# Play Store bundle:
./gradlew bundleRelease
```

Keep the keystore offline and out of Git; a lost keystore means a lost app
identity.

### Server side for APK clients

The APK's WebView origin is `http://localhost`, which is cross-origin for
your LAN server. Add the WebView origin to the server `.env` and restart the
stack:

```sh
IPTVMASTER_PLAYER_CORS_ORIGINS=http://localhost,capacitor://localhost
```

This is an opt-in allowlist that only affects the token-authenticated output
API; administrator sessions never travel cross-origin (see the comment in
`.env.example`). Playback itself needs no CORS: `<video>` loads the redirect
target directly.

### Troubleshooting

- **Blank screen after splash**: the bundle was built with the wrong base.
  Rebuild with `IPTVMASTER_PLAYER_BASE=/` and `npx cap sync android`.
- **Login says "No se pudo contactar al servidor"**: the phone and the server
  are not on the same network, the `.env` allowlist is missing, or the server
  address lacks the port (`http://192.168.1.20:8080`).
- **Video fails inside the app but the catalogue works**: expected for
  TS/MKV containers and for HLS providers without CORS; the watch screen
  offers the external-player handoff. MP4 and CORS-enabled HLS play inline.
- **`cap add android` complains about missing webDir**: build the player
  first (`IPTVMASTER_PLAYER_BASE=/ npm run build`).
