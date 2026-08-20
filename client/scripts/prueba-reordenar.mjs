/** Comprueba en un navegador real que se puede reordenar sin raton. */
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const API = 'http://localhost:4000/api';
const VIAJE = '6a83d22bf0f0726c18664017';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const perfilDir = join(tmpdir(), `rumbo-reordenar-${process.pid}`);
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${perfilDir}`,
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank',
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

let fallos = 0;
const check = (ok, texto) => {
  console.log(`  ${ok ? 'ok  ' : 'FALLA'} ${texto}`);
  if (!ok) fallos += 1;
};

try {
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i += 1) {
    try { wsUrl = (await (await fetch('http://127.0.0.1:9333/json/version')).json()).webSocketDebuggerUrl; }
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
  const ev = async (expr, prom = false) => {
    const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: prom }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };

  await cmd('Page.enable', {}, sessionId);
  await cmd('Runtime.enable', {}, sessionId);

  await cmd('Page.navigate', { url: BASE }, sessionId);
  await espera(1500);
  await ev(`(async () => {
    const r = await fetch('${API}/auth/login', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email:'demo@rumbo.app', password:'demo1234' }) });
    localStorage.setItem('rumbo_token', (await r.json()).data.token);
  })()`, true);

  await cmd('Page.navigate', { url: `${BASE}/viajes/${VIAJE}/itinerario` }, sessionId);
  await espera(3500);

  const titulos = () => ev(`JSON.stringify([...document.querySelectorAll('[data-dia]')]
      .filter(e => e.dataset.indice !== undefined && e.closest('.dia') === document.querySelector('.dia'))
      .map(e => e.querySelector('h4').innerText.trim()))`);

  const asa = await ev(`(() => {
    const b = document.querySelector('.agarradera');
    return b ? JSON.stringify({ tag: b.tagName, etiqueta: b.getAttribute('aria-label'),
      touchAction: getComputedStyle(b).touchAction,
      alto: Math.round(b.getBoundingClientRect().height),
      ancho: Math.round(b.getBoundingClientRect().width) }) : null;
  })()`);
  check(Boolean(asa), 'el asa existe');
  const a = JSON.parse(asa);
  check(a.tag === 'BUTTON', `el asa es un boton enfocable -> ${a.tag}`);
  check(/reordenar/i.test(a.etiqueta || ''), `tiene etiqueta accesible -> "${a.etiqueta}"`);
  check(a.touchAction === 'none', `touch-action: none (permite arrastrar con el dedo) -> ${a.touchAction}`);
  check(a.alto >= 24 && a.ancho >= 24, `objetivo tactil ${a.ancho}x${a.alto} (minimo 24x24)`);

  const antes = JSON.parse(await titulos());
  check(antes.length >= 2, `el primer dia tiene ${antes.length} actividades para reordenar`);

  // Se enfoca el asa de la primera y se baja con el teclado.
  await ev(`document.querySelector('.agarradera').focus()`);
  const enfocado = await ev(`document.activeElement.className`);
  check(String(enfocado).includes('agarradera'), `el asa recibe el foco -> ${enfocado}`);

  await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }, sessionId);
  await cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }, sessionId);
  await espera(2500);

  const despues = JSON.parse(await titulos());
  check(
    despues[0] === antes[1] && despues[1] === antes[0],
    `ArrowDown intercambia las dos primeras: [${antes.slice(0, 2)}] -> [${despues.slice(0, 2)}]`
  );

  // Se deja como estaba.
  await ev(`document.querySelectorAll('.agarradera')[1].focus()`);
  await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 }, sessionId);
  await cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 }, sessionId);
  await espera(2500);
  const final = JSON.parse(await titulos());
  check(final[0] === antes[0] && final[1] === antes[1], 'ArrowUp lo devuelve a su sitio');

  // --- Arrastre con el dedo -------------------------------------------
  // Se emula un dispositivo tactil y se arrastra el asa de la primera
  // actividad hasta la segunda.
  await cmd('Emulation.setDeviceMetricsOverride', {
    // Alto generoso a proposito: con 844 la segunda fila caia en y=843, debajo
    // de la barra inferior, y elementFromPoint devolvia la barra en su lugar.
    width: 390, height: 1600, deviceScaleFactor: 2, mobile: true,
    screenWidth: 390, screenHeight: 1600, positionX: 0, positionY: 0,
  }, sessionId);
  await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
  await cmd('Page.navigate', { url: `${BASE}/viajes/${VIAJE}/itinerario` }, sessionId);
  await espera(3500);

  const antesTactil = JSON.parse(await titulos());
  const puntos = JSON.parse(await ev(`(() => {
    const asas = document.querySelectorAll('.agarradera');
    const filas = document.querySelectorAll('[data-indice]');
    const a = asas[0].getBoundingClientRect();
    const b = filas[1].getBoundingClientRect();
    return JSON.stringify({
      x0: Math.round(a.x + a.width / 2), y0: Math.round(a.y + a.height / 2),
      x1: Math.round(b.x + b.width / 2), y1: Math.round(b.y + b.height / 2),
    });
  })()`));

  const toque = (type, x, y) => cmd('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 8, radiusY: 8, force: 1, id: 1 }],
  }, sessionId);

  await ev(`(() => {
    window.__log = [];
    for (const tipo of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend']) {
      window.addEventListener(tipo, (e) => window.__log.push(tipo + ':' + (e.pointerType || 'n/a')), true);
    }
    const asa = document.querySelector('.agarradera');
    asa.addEventListener('pointerdown', () => window.__log.push('ASA-pointerdown'), true);
  })()`);

  await toque('touchStart', puntos.x0, puntos.y0);
  await espera(120);
  // Varios pasos: un solo salto no se parece a un dedo y algunos handlers lo ignoran.
  for (let i = 1; i <= 5; i += 1) {
    await toque('touchMove',
      Math.round(puntos.x0 + ((puntos.x1 - puntos.x0) * i) / 5),
      Math.round(puntos.y0 + ((puntos.y1 - puntos.y0) * i) / 5));
    await espera(60);
  }
  await toque('touchEnd', puntos.x1, puntos.y1);
  await espera(2800);

  const registro = await ev('JSON.stringify(window.__log || [])');
  const cuenta = {};
  for (const x of JSON.parse(registro)) cuenta[x] = (cuenta[x] || 0) + 1;
  console.log('  [eventos]', JSON.stringify(cuenta));
  console.log('  [puntos]', JSON.stringify(puntos));

  const despuesTactil = JSON.parse(await titulos());
  check(
    despuesTactil[0] === antesTactil[1] && despuesTactil[1] === antesTactil[0],
    `arrastrando con el dedo: [${antesTactil.slice(0, 2)}] -> [${despuesTactil.slice(0, 2)}]`
  );

  // Se deja como estaba.
  await ev(`document.querySelectorAll('.agarradera')[1].focus()`);
  await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 }, sessionId);
  await cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 }, sessionId);
  await espera(2500);
  const restaurado = JSON.parse(await titulos());
  check(restaurado[0] === antesTactil[0], 'queda en el orden original');
} finally {
  ws?.close();
  chrome.kill();
}

console.log(fallos ? `\nFALLARON ${fallos}\n` : '\nTODO OK\n');
process.exit(fallos ? 1 : 0);
