import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the IPTVMaster admin-panel app.
 *
 * The web assets are the same React editor the server serves, built in mobile
 * mode (`vite build --mode mobile`) so it talks to a configurable server with a
 * bearer token instead of same-origin cookies. See ../../apps/web/src/connection.ts.
 *
 * `androidScheme: 'https'` means the bundled assets load from
 * `https://localhost`, which is one of the origins the API allows for CORS
 * (see IPTVMASTER_MOBILE_ORIGINS). The IPTVMaster server itself is reached over
 * the LAN, usually plain HTTP, so cleartext traffic is permitted for it via the
 * Android network security config (android/app/src/main/res/xml).
 */
const config: CapacitorConfig = {
  appId: 'com.iptvmaster.app',
  appName: 'IPTVMaster',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
};

export default config;
