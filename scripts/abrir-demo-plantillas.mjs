import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'server');
const clientDir = path.join(root, 'client');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const responds = async (url) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(800) });
    return response.ok;
  } catch { return false; }
};

let api;
let web;
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  if (web && !web.killed) web.kill();
  if (api && !api.killed) api.kill();
  process.exitCode = code;
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());

async function waitFor(url, child, label) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await responds(url)) return;
    if (child.exitCode !== null) throw new Error(`${label} se cerró antes de iniciar.`);
    await sleep(250);
  }
  throw new Error(`${label} no respondió a tiempo.`);
}

try {
  const apiUp = await responds('http://127.0.0.1:4000/api/health');
  const webUp = await responds('http://127.0.0.1:5173/entrar');
  if (apiUp && webUp) {
    console.log('La demo ya está abierta: http://127.0.0.1:5173/entrar');
  } else {
    if (apiUp || webUp) throw new Error('Uno de los puertos de la demo ya está ocupado. Cierra el servidor anterior y vuelve a intentarlo.');

    api = spawn(process.execPath, ['scripts/demo-plantillas-visuales.mjs'], {
      cwd: serverDir, stdio: 'inherit', windowsHide: true,
    });
    await waitFor('http://127.0.0.1:4000/api/health', api, 'La API');
    web = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
      cwd: clientDir, stdio: 'inherit', windowsHide: true,
    });
    await waitFor('http://127.0.0.1:5173/entrar', web, 'La página');

    console.log('\nDemo lista: http://127.0.0.1:5173/entrar');
    console.log('Usuario: dueno@example.test  |  Contraseña: Prueba1234');
    console.log('Mantén esta ventana abierta mientras pruebas. Al cerrarla, la demo y sus datos de prueba se detendrán.\n');
    api.once('exit', () => { if (!closing) { console.error('La API se cerró.'); stop(1); } });
    web.once('exit', () => { if (!closing) { console.error('La página se cerró.'); stop(1); } });
  }
} catch (error) {
  console.error(error.message);
  stop(1);
}
