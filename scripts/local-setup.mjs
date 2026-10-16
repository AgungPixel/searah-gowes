import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
if (!existsSync('.dev.vars')) {
  writeFileSync('.dev.vars', `AUTH_SECRET=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
  console.log('Konfigurasi lokal siap.');
}
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'migrations', 'apply', 'DB', '--local'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
