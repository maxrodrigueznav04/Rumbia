import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const cli = path.join(path.dirname(require.resolve('playwright-core/package.json')), 'cli.js');
const result = spawnSync(process.execPath, [cli, 'install', 'chromium', '--only-shell',
  ...(process.argv.includes('--with-deps') ? ['--with-deps'] : [])], {
  stdio: 'inherit', windowsHide: true,
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '0' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
