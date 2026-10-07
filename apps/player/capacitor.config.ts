import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android packaging for the player app. The web bundle is built with
 * IPTVMASTER_PLAYER_BASE=/ before `npx cap sync android`, because the WebView
 * serves the bundle from the app root instead of the /player/ subpath.
 *
 * `androidScheme: 'http'` plus `allowNavigation` are not needed: the APK talks
 * to a LAN IPTVMaster server directly, and cleartext (plain http) is allowed
 * below so `http://192.168.x.x:8080` servers work. The server must list this
 * WebView origin in IPTVMASTER_PLAYER_CORS_ORIGINS (docs/APK.md).
 */
const config: CapacitorConfig = {
  appId: 'app.iptvmaster.player',
  appName: 'IPTVMaster Player',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
