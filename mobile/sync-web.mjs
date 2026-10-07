// Copies the mobile web build (apps/web/dist) into Capacitor's webDir (./www).
//
// Run the mobile web build first, from the repository root:
//   npm run build:mobile -w @iptvmaster/web
// then, from this directory:
//   npm run sync:web && npx cap sync android
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '..', 'apps', 'web', 'dist');
const target = resolve(here, 'www');

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
process.stdout.write(`Copied ${source} -> ${target}\n`);
