import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.env.VISUAL_TEMPLATES_ENABLED !== 'true') {
  console.log('[visual-pdf] Función desactivada; no se instala Chromium.');
} else {
  for (const script of ['install-visual-browser.mjs', 'check-visual-runtime.mjs']) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], {
      stdio: 'inherit', windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
