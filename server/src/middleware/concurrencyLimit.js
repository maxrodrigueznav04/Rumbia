/**
 * Limita trabajo pesado dentro de una instancia sin dependencias externas.
 * Las peticiones esperan poco tiempo; si la capacidad no se libera, reciben
 * un 503 con Retry-After en vez de acumularse hasta agotar memoria/timeouts.
 */
export function createConcurrencyLimit({ maxActive = 3, maxQueue = 6, maxWaitMs = 12000 } = {}) {
  let active = 0;
  const queue = [];

  const rejectBusy = (res) => {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(maxWaitMs / 1000))));
    res.status(503).json({
      success: false,
      message: 'Hay muchas generaciones en curso. Espera unos segundos e intenta de nuevo.',
    });
  };

  const startNext = () => {
    while (active < maxActive && queue.length) {
      const item = queue.shift();
      clearTimeout(item.timer);
      if (item.cancelled || item.req.aborted) continue;
      item.start();
    }
  };

  return function concurrencyLimit(req, res, next) {
    let released = false;
    let queuedItem;

    const release = () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
      startNext();
    };

    const start = () => {
      active += 1;
      res.once('finish', release);
      res.once('close', release);
      next();
    };

    if (active < maxActive) return start();
    if (queue.length >= maxQueue) return rejectBusy(res);

    queuedItem = { req, start, cancelled: false, timer: null };
    queuedItem.timer = setTimeout(() => {
      queuedItem.cancelled = true;
      const index = queue.indexOf(queuedItem);
      if (index >= 0) queue.splice(index, 1);
      if (!res.headersSent) rejectBusy(res);
    }, maxWaitMs);
    queuedItem.timer.unref?.();
    req.once('aborted', () => {
      queuedItem.cancelled = true;
      clearTimeout(queuedItem.timer);
      const index = queue.indexOf(queuedItem);
      if (index >= 0) queue.splice(index, 1);
    });
    queue.push(queuedItem);
    return undefined;
  };
}
