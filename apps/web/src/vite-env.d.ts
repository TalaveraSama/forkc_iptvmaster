/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Set to the string "true" only in the mobile (Capacitor) build. When unset
   * the app behaves exactly as the browser build: same-origin API calls with
   * cookie authentication and no server-address configuration screen.
   */
  readonly VITE_IPTVMASTER_MOBILE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
