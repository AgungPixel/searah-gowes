import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
if (config.d1_databases[0].database_id === '00000000-0000-0000-0000-000000000000') {
  console.error('Buat D1 di akun Cloudflare kamu dan isi database_id di wrangler.jsonc terlebih dahulu.');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'migrations', 'apply', 'DB', '--remote'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
