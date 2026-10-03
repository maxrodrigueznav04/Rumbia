import fs from 'node:fs';

const families = { 'playfair-display': 'Playfair Display', 'libre-baskerville': 'Libre Baskerville', 'work-sans': 'Work Sans' };
let cached;
export function visualFontCss() {
  cached ??= Object.entries(families).flatMap(([file, family]) => [400, 700].map((weight) => {
    const bytes = fs.readFileSync(new URL(`../../assets/visual-fonts/${file}-${weight}.woff2`, import.meta.url));
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2');}`;
  })).join('');
  return cached;
}
