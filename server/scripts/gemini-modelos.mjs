// Le pregunta a Google directamente cuales modelos de Gemini estan
// disponibles para tu GEMINI_API_KEY, en vez de adivinar por prueba y error
// cual nombre de modelo sigue vivo -- Google retira versiones viejas con el
// tiempo, y MODELOS_FALLBACK en gemini.service.js puede quedar desactualizado.
//
//   cd server && npm run gemini:modelos
//
// No imprime la API key en ningun momento, solo nombres de modelo: es seguro
// pegar la salida completa donde sea.

import 'dotenv/config';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error('\nFalta GEMINI_API_KEY en server/.env.\n');
  process.exit(1);
}

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}`);
const data = await res.json();

if (!res.ok) {
  console.error(`\nGoogle respondio ${res.status}:\n`, JSON.stringify(data, null, 2));
  process.exit(1);
}

const conGenerateContent = (data.models || []).filter((m) =>
  (m.supportedGenerationMethods || []).includes('generateContent')
);

console.log(`\nModelos disponibles para esta API key (con generateContent):\n`);
for (const m of conGenerateContent) {
  console.log(`  ${m.name.replace('models/', '')}`);
}
console.log('');
