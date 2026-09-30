import fs from 'node:fs/promises';
import path from 'node:path';
import { VISUAL_PRESET_IDS, visualPresetDesign } from '../src/validators/visualTemplate.js';
import { renderVisualProposalHtml } from '../src/services/visualProposalHtml.service.js';
import { renderVisualPdf } from '../src/services/visualPdf.service.js';

const outDir = path.resolve('../output/pdf');
await fs.mkdir(outDir, { recursive: true });
let failures = 0;
for (const count of [3, 15]) {
  const data = {
    fields: {
      'trip.title': 'Del Pacífico a la magia',
      'trip.destination': 'San Diego → Anaheim',
      'trip.dates': '15—22 octubre 2026',
      'trip.travelers': '2 viajeros',
      'agency.name': 'DaycoTravels',
      'agency.contact': 'daycotravels@gmail.com',
      'proposal.price': '$41,158.80 MXN por persona',
    },
    highlights: [
      { date: '16 OCT', title: 'La Jolla Cove', summary: 'Calas y acantilados frente al Pacífico.' },
      { date: '18 OCT', title: 'Coronado', summary: 'Una última mañana de playa antes de viajar a Anaheim.' },
      { date: '21 OCT', title: 'Galaxy’s Edge', summary: 'Un día para explorar Batuu y repetir atracciones favoritas.' },
    ],
    assets: {}, showBrandCredit: false,
    days: Array.from({ length: count }, (_, index) => ({
      number: index + 1, date: `${index + 15} OCT`,
      title: [
        'La primera noche en Gaslamp', 'La Jolla frente al Pacífico',
        'Arte en Balboa Park, noche en Little Italy', 'Coronado y camino a Anaheim',
        'Un día en Disneyland Park', 'California Adventure al atardecer',
        'Galaxias lejanas y última noche', 'Desayuno, recuerdos y regreso',
      ][index % 8],
      summary: 'Un día con tiempo para disfrutar el destino y adaptar el recorrido al ritmo de quienes viajan.',
      activities: [
        { time: '09:30', title: 'Recorrido principal por el destino', description: 'Explorar el lugar con calma, detenerse en los puntos que más interesen y reservar tiempo para fotografías.' },
        { time: '13:00', title: 'Almuerzo sugerido', description: 'Una pausa para descubrir la cocina local; horario y disponibilidad por confirmar.' },
        { time: '17:30', title: 'Paseo de tarde', description: 'Caminar por la zona y regresar al alojamiento con margen suficiente para descansar.' },
      ],
    })),
  };
  for (const presetId of VISUAL_PRESET_IDS) {
    const html = renderVisualProposalHtml(visualPresetDesign(presetId), data);
    let pdf;
    try { pdf = await renderVisualPdf(html); }
    catch (err) { failures += 1; console.error(`${presetId}, ${count} días: ${err.message}`); continue; }
    const target = path.join(outDir, `plantilla-visual-${presetId}-${count}-dias-prueba.pdf`);
    await fs.writeFile(target, pdf);
    console.log(`${presetId}, ${count} días: ${pdf.length} bytes → ${target}`);
  }
}
if (failures) { console.error(`${failures} documentos fallaron.`); process.exitCode = 1; }
