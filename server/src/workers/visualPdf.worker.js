import { launchVisualBrowser } from '../services/visualBrowser.service.js';

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const chunks = [];
let size = 0;
for await (const chunk of process.stdin) {
  size += chunk.length;
  if (size > MAX_HTML_BYTES) throw new Error('El documento es demasiado grande.');
  chunks.push(chunk);
}
const html = Buffer.concat(chunks).toString('utf8');
let browser;
try {
  browser = await launchVisualBrowser();
  process.once('SIGTERM', async () => {
    await browser?.close().catch(() => {});
    process.exit(1);
  });
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith('data:')) return route.continue();
    try {
      const url = new URL(requestUrl);
      if (url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' &&
        url.pathname.startsWith(`/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`)) return route.continue();
    } catch { /* URL inválida: bloquear */ }
    return route.abort();
  });
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  const imagesOk = await page.evaluate(async () => {
    await Promise.all([...document.images].map((img) => img.decode().catch(() => null)));
    return [...document.images].every((img) => img.naturalWidth > 0);
  });
  if (!imagesOk) throw new Error('No se pudo cargar una imagen de la propuesta.');
  const overflow = await page.evaluate(() => [...document.querySelectorAll('.fixed-element.text,.fixed-element.highlights,.highlights>div')]
    .map((element, index) => ({ index, extraHeight: element.scrollHeight - element.clientHeight, extraWidth: element.scrollWidth - element.clientWidth }))
    .find((item) => item.extraHeight > 2 || item.extraWidth > 2));
  if (overflow) throw new Error(`Hay contenido que no cabe en una página fija (${overflow.index}, +${overflow.extraHeight}px de alto).`);
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true, timeout: 20000 });
  process.stdout.write(pdf);
  await context.close();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
}
