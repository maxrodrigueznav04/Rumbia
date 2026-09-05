// Prueba pequena y segura para medir una API local sin instalar dependencias.
// Uso: npm run test:carga -- http://127.0.0.1:4000/api/health 200 20
const target = process.argv[2] || 'http://127.0.0.1:4000/api/health';
const total = Math.max(1, Math.min(5000, Number(process.argv[3] || 200)));
const concurrency = Math.max(1, Math.min(100, Number(process.argv[4] || 20)));
const url = new URL(target);

if (!['127.0.0.1', 'localhost'].includes(url.hostname) && process.env.ALLOW_REMOTE_LOAD_TEST !== 'yes') {
  console.error('Por seguridad, esta prueba solo apunta a localhost. Para un entorno propio remoto usa ALLOW_REMOTE_LOAD_TEST=yes.');
  process.exit(2);
}

const latencies = [];
const statuses = new Map();
let cursor = 0;
const started = performance.now();

async function worker() {
  while (cursor < total) {
    cursor += 1;
    const start = performance.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      await response.arrayBuffer();
      statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
    } catch {
      statuses.set('error', (statuses.get('error') || 0) + 1);
    }
    latencies.push(performance.now() - start);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
latencies.sort((a, b) => a - b);
const percentile = (p) => Math.round(latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))]);
const elapsed = performance.now() - started;
console.log(JSON.stringify({
  target: url.origin + url.pathname,
  total,
  concurrency,
  statuses: Object.fromEntries(statuses),
  requestsPerSecond: Number((total / (elapsed / 1000)).toFixed(1)),
  latencyMs: { p50: percentile(0.5), p95: percentile(0.95), max: Math.round(latencies.at(-1)) },
}, null, 2));

const failures = [...statuses.entries()].reduce(
  (sum, [status, count]) => sum + (status === 'error' || Number(status) >= 500 ? count : 0),
  0
);
if (failures > 0) process.exitCode = 1;
