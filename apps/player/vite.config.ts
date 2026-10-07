import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The player consumes the published Xtream-compatible endpoints. In
// production it is served by the same Fastify process under /player/, so
// requests stay same-origin. During development Vite proxies the player API
// paths to the local API (or to `npm run mock` listening on the same port).
const apiTarget =
  process.env['IPTVMASTER_API_TARGET'] ?? 'http://127.0.0.1:8080';

// Development-only host allowlist for tunneled/preview environments
// (comma-separated, a leading dot matches subdomains). Empty keeps Vite's
// default localhost-only behavior.
const allowedHosts = (process.env['IPTVMASTER_DEV_ALLOWED_HOSTS'] ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

export default defineConfig({
  base: '/player/',
  plugins: [
    react(),
    {
      // Convenience for container/preview environments: send the bare host
      // root to the player base path instead of showing a 404.
      name: 'player-root-redirect',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url === '/' || request.url === '') {
            response.writeHead(302, { location: '/player/' });
            response.end();
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 5174,
    ...(allowedHosts.length > 0 ? { allowedHosts } : {}),
    proxy: {
      '/player_api.php': apiTarget,
      '/get.php': apiTarget,
      '/xmltv.php': apiTarget,
      '/live': apiTarget,
      '/movie': apiTarget,
      '/series': apiTarget,
      '/health': apiTarget,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
