/**
 * Post-`cap add android` patch: allows cleartext (plain http) traffic so the
 * APK can reach an IPTVMaster server on the LAN, e.g. http://192.168.1.20:8080.
 * Android 9+ blocks http by default. The android/ platform project is a
 * generated artifact kept out of Git, so this idempotent patch is part of the
 * documented APK flow instead of a committed manifest edit (docs/APK.md).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve(
  import.meta.dirname,
  '../android/app/src/main/AndroidManifest.xml',
);

if (!existsSync(manifestPath)) {
  console.error('android/ project not found. Run first: npx cap add android');
  process.exit(1);
}

const source = readFileSync(manifestPath, 'utf8');
if (source.includes('usesCleartextTraffic')) {
  console.log('Cleartext traffic already enabled; nothing to do.');
  process.exit(0);
}

const patched = source.replace(
  '<application',
  '<application\n        android:usesCleartextTraffic="true"',
);
if (patched === source) {
  console.error(
    'Could not locate the <application> tag in AndroidManifest.xml',
  );
  process.exit(1);
}

writeFileSync(manifestPath, patched);
console.log('Enabled android:usesCleartextTraffic for LAN http servers.');
