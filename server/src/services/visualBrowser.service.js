// Store the browser with the installed package so it survives Render's build/runtime handoff.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '0';
const { chromium } = await import('playwright-core');

export function launchVisualBrowser() {
  return chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    headless: true,
    timeout: 30000,
  });
}
