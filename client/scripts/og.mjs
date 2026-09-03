/**
 * Genera la imagen de Open Graph (1200x630).
 *
 * Se dibuja dentro de la app ya cargada en el navegador, no en un HTML suelto:
 * asi Sora y Manrope ya estan disponibles y la tarjeta sale con la tipografia
 * real de la marca en vez de una sustituta del sistema.
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const SALIDA = process.argv[2] || 'og.png';
const ESCALA = 1; // 1200x630 nativo: peso ligero (<250 KB) para WhatsApp y redes
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const perfilDir = join(tmpdir(), `rumbo-og-${process.pid}`);
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9444', `--user-data-dir=${perfilDir}`,
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--force-color-profile=srgb', '--window-size=1400,900', 'about:blank',
], { stdio: 'ignore' });

let ws, id = 0;
const pend = new Map();
const cmd = (method, params = {}, sessionId) =>
  new Promise((ok, falla) => {
    const n = ++id;
    pend.set(n, { ok, falla });
    ws.send(JSON.stringify(sessionId ? { id: n, method, params, sessionId } : { id: n, method, params }));
    setTimeout(() => pend.delete(n) && falla(new Error('timeout ' + method)), 30000);
  });

const TARJETA = `
<div id="og" style="
  width:1200px;height:630px;box-sizing:border-box;position:relative;overflow:hidden;
  background:linear-gradient(120deg,#1F6F5C 0%,#2F7F63 45%,#E4784A 100%);
  font-family:'Manrope Variable',sans-serif;color:#FBF6EC;
  padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between;">

  <svg style="position:absolute;right:-70px;top:-70px;opacity:0.16" width="520" height="520"
       viewBox="0 0 24 24" fill="none" stroke="#FBF6EC" stroke-width="0.7">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M15 9l-1.5 4.5L9 15l1.5-4.5z" fill="#FBF6EC" stroke="none"></path>
  </svg>

  <div style="display:flex;align-items:center;gap:16px;position:relative;">
    <div style="width:56px;height:56px;border-radius:16px;background:#FBF6EC;display:grid;
                place-items:center;color:#1F6F5C;font-family:'Sora Variable',sans-serif;
                font-weight:700;font-size:28px;">R</div>
    <span style="font-family:'Sora Variable',sans-serif;font-weight:700;font-size:34px;
                 letter-spacing:-0.01em;">Rumbia</span>
  </div>

  <div style="position:relative;">
    <h1 style="font-family:'Sora Variable',sans-serif;font-weight:700;font-size:62px;color:#FBF6EC;
               line-height:1.1;letter-spacing:-0.03em;margin:0 0 16px;max-width:18ch;">
      Planea viajes completos en minutos
    </h1>
    <p style="margin:0;font-size:26px;line-height:1.4;opacity:0.95;max-width:38ch;">
      Itinerarios día por día con IA · Para viajeros y agencias de viaje. Cotizaciones en PDF con tu logo y margen.
    </p>
  </div>

  <div style="display:flex;gap:12px;position:relative;flex-wrap:wrap;">
    ${['Itinerario con IA', 'Para agencias y viajeros', 'PDF con tu marca', 'Sin comisiones']
      .map(
        (t) => `<span style="border:1.5px solid rgba(251,246,236,0.55);border-radius:999px;
                 padding:10px 20px;font-size:20px;font-weight:600;background:rgba(0,0,0,0.12);">${t}</span>`
      )
      .join('')}
  </div>
</div>`;

try {
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i += 1) {
    try { wsUrl = (await (await fetch('http://127.0.0.1:9444/json/version')).json()).webSocketDebuggerUrl; }
    catch { await espera(300); }
  }
  ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.falla(new Error(m.error.message)) : p.ok(m.result); }
  });

  const { targetId } = await cmd('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cmd('Target.attachToTarget', { targetId, flatten: true });
  const ev = async (expr) => {
    const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };

  await cmd('Page.enable', {}, sessionId);
  await cmd('Runtime.enable', {}, sessionId);
  await cmd('Emulation.setDeviceMetricsOverride',
    { width: 1200, height: 630, deviceScaleFactor: ESCALA, mobile: false }, sessionId);

  // Se carga la app para que las fuentes de la marca queden disponibles.
  await cmd('Page.navigate', { url: BASE }, sessionId);
  await espera(2500);

  await ev(`document.body.innerHTML = ${JSON.stringify(TARJETA)};
    document.body.style.margin = '0';
    document.documentElement.style.background = '#1F6F5C';`);
  await ev(`document.fonts.ready.then(() => { window.__listo = true; })`);
  for (let i = 0; i < 40 && !(await ev('window.__listo')); i += 1) await espera(150);
  await espera(600);

  const usadas = await ev(`(() => {
    const h = document.querySelector('#og h1');
    return getComputedStyle(h).fontFamily;
  })()`);
  console.log('tipografia del titulo:', usadas);

  const shotPng = await cmd('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(SALIDA, Buffer.from(shotPng.data, 'base64'));
  const kbPng = Math.round(Buffer.from(shotPng.data, 'base64').length / 1024);
  console.log(`imagen PNG: ${SALIDA} 1200x630 (${kbPng} KB)`);

  const salidaJpg = SALIDA.replace(/\.png$/, '.jpg');
  const shotJpg = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 88 }, sessionId);
  writeFileSync(salidaJpg, Buffer.from(shotJpg.data, 'base64'));
  const kbJpg = Math.round(Buffer.from(shotJpg.data, 'base64').length / 1024);
  console.log(`imagen JPG: ${salidaJpg} 1200x630 (${kbJpg} KB)`);
} finally {
  ws?.close();
  chrome.kill();
}
