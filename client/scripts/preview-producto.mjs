// Entorno visual local con datos ficticios en memoria; nunca conecta a MongoDB ni a producción.
// Ejecutar: node client/scripts/preview-producto.mjs
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const agencia = { _id: 'agencia-demo', owner: 'dueno-demo', agencyName: 'Agencia de prueba', marcaBlanca: true, capacidadAgentes: 15, billing: { status: 'activa', plan: 'pro_mensual' } };
let user = null;
const clientes = [{ _id: 'cliente-demo', nombre: 'Familia de prueba', telefono: '5550000000' }];
const itinerario = { _id: 'it-demo', generatedBy: 'ia', totalEstimatedCost: 1970, activityCount: 2,
  days: [{ _id: 'dia-demo', dayNumber: 1, date: '2026-10-10', title: 'Llegada y paseo', summary: 'Un día tranquilo para conocer el destino.', activities: [
    { _id: 'actividad-1', title: 'Paseo por el centro', time: '10:00', description: 'Recorrido a pie.', category: 'cultura', estimatedCost: 500, durationMinutes: 90, location: { name: 'Centro' } },
    { _id: 'actividad-2', title: 'Comida regional', time: '13:00', description: 'Degustación de cocina local.', category: 'comida', estimatedCost: 1470, durationMinutes: 90 },
  ] }] };
const base = { _id: 'viaje-demo', user: 'dueno-demo', title: 'Escapada de prueba', destination: { name: 'Mazamitla' }, origin: { name: 'Culiacán' }, startDate: '2026-10-10', endDate: '2026-10-13', durationDays: 4, nightsCount: 3, travelers: 10,
  status: 'planeado', estadoPropuesta: 'borrador', budget: { currency: 'MXN', amount: 90000 }, cliente: { nombre: 'Familia de prueba', contacto: '5550000000' }, client: clientes[0],
  margen: { tipo: 'fijo', monto: 1000 }, ocultarCodigos: true, ocultarDesglose: false,
  transport: { outbound: { mode: 'avion', provider: 'Proveedor de prueba', cost: 18000, isEstimate: true, bookingRef: 'CODIGO-PRIVADO' }, inbound: { mode: 'avion', provider: 'Proveedor de prueba', cost: 18000, isEstimate: true } },
  lodging: [{ name: 'Hotel de prueba', type: 'hotel', nights: 3, totalCost: 13500, subtotal: 13500, perNight: 4500, isEstimate: true }], localTransport: [{ type: 'renta-auto', provider: 'Proveedor de prueba', estimatedCost: 7500 }], coreCosts: { total: 57000, transport: 36000, lodging: 13500, localTransport: 7500 }, itinerary: itinerario, expenses: [], tieneItinerario: true, additionalDestinations: [] };
const trips = [base, { ...base, _id: 'viaje-pendiente', title: 'Viaje por completar', cliente: {}, client: null, transport: {}, lodging: [], localTransport: [], coreCosts: { total: 0 }, itinerary: null, tieneItinerario: false }];
const summary = { currency: 'MXN', breakdown: { transporte: 36000, hospedaje: 13500, 'transporte-local': 7500 }, chartData: [{ category: 'transporte', value: 36000 }, { category: 'hospedaje', value: 13500 }, { category: 'transporte-local', value: 7500 }], totals: { total: 57000, perTraveler: 5700, perDay: 14250 }, budget: { amount: 90000, remaining: 33000, usedPercent: 63, isSet: true }, itineraryEstimate: { perTraveler: 1970, allTravelers: 19700, activityCount: 2 }, conversion: { sinConvertir: [] } };
const fixture = { name: 'datos-ficticios-locales', configureServer(server) {
  server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return next();
    const path = url.pathname.slice(4);
    const json = (data, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: status < 400, data, message: status >= 400 ? data.message : undefined })); };
    const body = await new Promise((resolve) => { let data = ''; req.on('data', (chunk) => data += chunk); req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } }); });
    if (path === '/auth/login') {
      const agente = body.email?.startsWith('agente');
      const personal = body.email?.startsWith('personal');
      user = { _id: agente ? 'agente-demo' : personal ? 'personal-demo' : 'dueno-demo', name: agente ? 'Agente de prueba' : personal ? 'Viajero de prueba' : 'Dueño de prueba', email: body.email, agency: personal ? null : agencia, preferences: { perfilUso: personal ? 'personal' : 'agencia', homeCity: 'Culiacán', currency: 'MXN' } };
      return json({ user });
    }
    if (path === '/auth/logout') { user = null; return json({}); }
    if (!user) return json({ message: 'Inicia sesión con dueno@example.test o agente@example.test. Datos de prueba.' }, 401);
    if (req.headers['x-rumbia-user'] && req.headers['x-rumbia-user'] !== user._id) return json({ message: 'La cuenta activa cambió. Actualiza la sesión antes de continuar.' }, 409);
    if (path === '/auth/me') { if (req.method === 'PATCH') Object.assign(user, body); return json({ user }); }
    if (path === '/agency') return json({ agency: agencia, esDueno: user._id === agencia.owner, miembros: [{ _id: 'agente-demo', name: 'Agente de prueba', email: 'agente@example.test' }] });
    if (path === '/agency/reporte') return json({ totalMes: 2, mes: '2026-09', porAgente: [{ userId: 'dueno-demo', name: 'Dueño de prueba', cantidad: 1 }, { userId: 'agente-demo', name: 'Agente de prueba', cantidad: 1 }] });
    if (path === '/trips/panel') return json({ porEnviar: 2, seguimiento: 0, proximasSalidas: 0, pendientes: 1 });
    if (path === '/trips') {
      if (req.method === 'POST') { const trip = { ...body, _id: `nuevo-${trips.length}`, durationDays: Math.round((new Date(body.endDate) - new Date(body.startDate)) / 86400000) + 1, nightsCount: Math.round((new Date(body.endDate) - new Date(body.startDate)) / 86400000), client: clientes.find((c) => c._id === body.client) || null, coreCosts: { total: 0 }, expenses: [] }; trips.push(trip); return json({ trip }); }
      const result = trips.filter((t) => !url.searchParams.get('q') || t.title.includes(url.searchParams.get('q')));
      return json({ trips: result, pagination: { total: result.length, pages: 1 } });
    }
    if (path === '/clients') {
      if (req.method === 'POST') { const cliente = { ...body, _id: `cliente-${clientes.length}` }; clientes.push(cliente); return json({ cliente }); }
      return json({ clientes, pagination: { total: clientes.length, pages: 1 } });
    }
    if (path === '/templates') return json({ templates: [] });
    if (path === '/chat') return json({ messages: [] });
    if (path.endsWith('/summary')) { const trip = trips.find((t) => t._id === path.split('/')[2]); return json(trip?.coreCosts?.total ? summary : { ...summary, chartData: [], totals: { total: 0 }, itineraryEstimate: null }); }
    if (path.endsWith('/booking-links')) return json({ links: {} });
    if (path.endsWith('/weather')) return json(null);
    if (path.endsWith('/itinerary/plantilla')) return json({ template: { name: body.name } });
    if (path.endsWith('/itinerary')) return json({ itinerary: itinerario, pins: [] });
    if (/^\/trips\/[^/]+$/.test(path)) {
      const trip = trips.find((t) => t._id === path.split('/')[2]);
      if (req.method === 'PATCH') Object.assign(trip, body);
      return json({ trip, variantes: [] });
    }
    if (path === '/weather/geocode/sugerencias') return json({ places: [] });
    if (path === '/weather/geocode') return json({ place: { name: url.searchParams.get('q') } });
    return json({ message: 'Ruta fuera del entorno de prueba.' }, 404);
  });
} };
const server = await createServer({ root, define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') }, server: { host: '127.0.0.1', port: 5173, strictPort: true }, plugins: [fixture] });
await server.listen();
console.log('Vista local: http://127.0.0.1:5173 — datos ficticios. Acceso: dueno@example.test, agente@example.test o personal@example.test; contraseña de prueba cualquiera.');
