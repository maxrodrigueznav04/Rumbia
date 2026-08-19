/**
 * Puebla la base con un usuario demo y 3 viajes de ejemplo.
 *
 *   npm run seed          -> crea lo que falte (no duplica)
 *   npm run seed:reset    -> borra los datos del usuario demo y los recrea
 *
 * Pensado para que un reclutador pueda entrar con la cuenta demo y ver la app
 * llena, sin tener que capturar un viaje desde cero.
 */
import mongoose from 'mongoose';
import env from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User, Trip, Itinerary, Expense } from '../src/models/index.js';

const RESET = process.argv.includes('--reset');

const DEMO_EMAIL = process.env.SEED_USER_EMAIL || 'demo@rumbo.app';
const DEMO_PASSWORD = process.env.SEED_USER_PASSWORD || 'demo1234';

/** Fecha relativa a hoy, para que el seed nunca quede desactualizado. */
const daysFromNow = (n) => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

const tripBlueprints = [
  {
    title: 'Oaxaca en temporada de mezcal',
    destination: { name: 'Oaxaca de Juárez', country: 'MX', lat: 17.0732, lng: -96.7266 },
    origin: { name: 'Monterrey', country: 'MX', lat: 25.6866, lng: -100.3161 },
    startDate: daysFromNow(30),
    endDate: daysFromNow(34),
    travelers: 2,
    budget: { amount: 24000, currency: 'MXN' },
    status: 'planeado',
    notes: 'Prioridad: mercados, mezcalerías y Hierve el Agua.',
    transport: {
      outbound: {
        mode: 'avion',
        provider: 'Viva Aerobus',
        departureAt: daysFromNow(30),
        cost: 2450,
        isEstimate: false,
        bookingRef: 'VB4X9K',
      },
      inbound: { mode: 'avion', provider: 'Viva Aerobus', departureAt: daysFromNow(34), cost: 2610, isEstimate: false },
    },
    lodging: [
      {
        type: 'airbnb',
        name: 'Casa con patio en Jalatlaco',
        place: { name: 'Jalatlaco, Oaxaca', lat: 17.0654, lng: -96.7186 },
        checkIn: daysFromNow(30),
        checkOut: daysFromNow(34),
        totalCost: 5400,
        nights: 4,
        isEstimate: false,
      },
    ],
    localTransport: [
      { type: 'app-transporte', provider: 'DiDi', estimatedCost: 1200, notes: 'Traslados dentro de la ciudad.' },
      { type: 'renta-auto', provider: 'Local', estimatedCost: 1800, notes: 'Solo un día, para Hierve el Agua.' },
    ],
    itinerary: [
      {
        title: 'Llegada y centro histórico',
        summary: 'Aterrizaje al mediodía, tarde tranquila caminando el centro.',
        activities: [
          { time: '15:00', title: 'Check-in en Jalatlaco', category: 'descanso', cost: 0, lat: 17.0654, lng: -96.7186, desc: 'Dejar maletas y estirar las piernas por el barrio.' },
          { time: '17:00', title: 'Templo de Santo Domingo', category: 'cultura', cost: 0, lat: 17.0654, lng: -96.7233, desc: 'Fachada barroca y el jardín etnobotánico al lado.' },
          { time: '20:00', title: 'Cena en Mercado 20 de Noviembre', category: 'comida', cost: 250, lat: 17.0592, lng: -96.7255, desc: 'Pasillo del humo: tasajo y cecina al carbón.' },
        ],
      },
      {
        title: 'Monte Albán y mezcalerías',
        summary: 'Zona arqueológica temprano, tarde de catas.',
        activities: [
          { time: '08:30', title: 'Monte Albán', category: 'cultura', cost: 95, lat: 17.0439, lng: -96.7677, desc: 'Ir temprano: menos sol y menos gente.' },
          { time: '13:30', title: 'Comida en Criollo', category: 'comida', cost: 650, lat: 17.0721, lng: -96.7195, desc: 'Menú de temporada con producto local.' },
          { time: '18:00', title: 'Ruta de mezcalerías', category: 'vida-nocturna', cost: 400, lat: 17.0606, lng: -96.7259, desc: 'In Situ y Mezcaloteca, con reserva previa.' },
        ],
      },
      {
        title: 'Hierve el Agua',
        summary: 'Día de campo, salida temprano en auto rentado.',
        activities: [
          { time: '07:30', title: 'Salida hacia Hierve el Agua', category: 'traslado', cost: 0, lat: 16.8661, lng: -96.2761, desc: 'Hora y media de camino, llevar efectivo para las cuotas.' },
          { time: '10:00', title: 'Cascadas petrificadas', category: 'naturaleza', cost: 100, lat: 16.8661, lng: -96.2761, desc: 'Bajar al mirador antes de que llegue el turismo de grupo.' },
          { time: '14:00', title: 'Comida en Mitla', category: 'comida', cost: 220, lat: 16.9226, lng: -96.3597, desc: 'Parada de regreso; probar el mole amarillo.' },
          { time: '17:00', title: 'Árbol del Tule', category: 'naturaleza', cost: 15, lat: 17.0466, lng: -96.6362, desc: 'El tronco más ancho del mundo, 10 minutos de desvío.' },
        ],
      },
      {
        title: 'Mercados y compras',
        summary: 'Último día completo, ritmo lento.',
        activities: [
          { time: '10:00', title: 'Mercado de Benito Juárez', category: 'compras', cost: 300, lat: 17.0601, lng: -96.7263, desc: 'Chocolate, mole en pasta y chapulines para llevar.' },
          { time: '13:00', title: 'Taller de barro negro en San Bartolo', category: 'cultura', cost: 350, lat: 16.8296, lng: -96.7141, desc: 'Demostración y compra directa al taller.' },
          { time: '19:00', title: 'Cena en Los Danzantes', category: 'comida', cost: 700, lat: 17.0648, lng: -96.7238, desc: 'Patio bonito, reservar con anticipación.' },
        ],
      },
      {
        title: 'Regreso',
        summary: 'Vuelo por la tarde.',
        activities: [
          { time: '10:00', title: 'Desayuno en Boulenc', category: 'comida', cost: 180, lat: 17.0668, lng: -96.7245, desc: 'Panadería; llegar antes de las 10:30 o hay fila.' },
          { time: '13:00', title: 'Traslado al aeropuerto', category: 'traslado', cost: 250, lat: 16.9992, lng: -96.7266, desc: '30 minutos desde el centro.' },
        ],
      },
    ],
    expenses: [
      { category: 'comida', description: 'Cena de llegada', amount: 480, daysOffset: 30, isPaid: false },
      { category: 'actividades', description: 'Entradas Monte Albán (2)', amount: 190, daysOffset: 31, isPaid: false },
      { category: 'compras', description: 'Mezcal para regalo', amount: 900, daysOffset: 33, isPaid: false },
    ],
  },
  {
    title: 'Fin de semana en la CDMX',
    destination: { name: 'Ciudad de México', country: 'MX', lat: 19.4326, lng: -99.1332 },
    origin: { name: 'Monterrey', country: 'MX', lat: 25.6866, lng: -100.3161 },
    startDate: daysFromNow(9),
    endDate: daysFromNow(11),
    travelers: 1,
    budget: { amount: 9000, currency: 'MXN' },
    status: 'planeado',
    notes: 'Viaje corto, sin auto. Todo en metro o caminando.',
    transport: {
      outbound: { mode: 'autobus', provider: 'ETN', departureAt: daysFromNow(9), cost: 1180, isEstimate: false },
      inbound: { mode: 'autobus', provider: 'ETN', departureAt: daysFromNow(11), cost: 1180, isEstimate: false },
    },
    lodging: [
      {
        type: 'hotel',
        name: 'Hotel en la Roma Norte',
        place: { name: 'Roma Norte, CDMX', lat: 19.4183, lng: -99.1607 },
        checkIn: daysFromNow(9),
        checkOut: daysFromNow(11),
        totalCost: 3200,
        nights: 2,
        isEstimate: true,
      },
    ],
    localTransport: [{ type: 'transporte-publico', provider: 'Metro y Metrobus', estimatedCost: 200 }],
    itinerary: [
      {
        title: 'Centro y Bellas Artes',
        summary: 'Llegada temprano, día completo en el centro.',
        activities: [
          { time: '11:00', title: 'Palacio de Bellas Artes', category: 'cultura', cost: 90, lat: 19.4352, lng: -99.1412, desc: 'Murales de Rivera y Siqueiros en los pisos altos.' },
          { time: '14:00', title: 'Comida en El Cardenal', category: 'comida', cost: 550, lat: 19.4338, lng: -99.1389, desc: 'Clásico del centro; el pan de nata vale la pena.' },
          { time: '17:00', title: 'Templo Mayor', category: 'cultura', cost: 90, lat: 19.4346, lng: -99.1316, desc: 'Museo incluido en el boleto.' },
        ],
      },
      {
        title: 'Coyoacán y Frida',
        summary: 'Día al sur, con boleto comprado en línea.',
        activities: [
          { time: '10:00', title: 'Museo Frida Kahlo', category: 'cultura', cost: 320, lat: 19.3551, lng: -99.1626, desc: 'Comprar en línea con días de anticipación.' },
          { time: '13:00', title: 'Mercado de Coyoacán', category: 'comida', cost: 180, lat: 19.3502, lng: -99.1622, desc: 'Tostadas de la esquina, las de tinga.' },
          { time: '16:00', title: 'Viveros de Coyoacán', category: 'naturaleza', cost: 0, lat: 19.3494, lng: -99.1739, desc: 'Caminata tranquila entre árboles.' },
        ],
      },
      {
        title: 'Chapultepec y salida',
        summary: 'Mañana ligera antes del camión de la tarde.',
        activities: [
          { time: '09:30', title: 'Museo Nacional de Antropología', category: 'cultura', cost: 95, lat: 19.4260, lng: -99.1863, desc: 'Al menos la sala mexica, si el tiempo aprieta.' },
          { time: '14:00', title: 'Traslado a Terminal Norte', category: 'traslado', cost: 120, lat: 19.4779, lng: -99.1416, desc: 'Salir con 90 minutos de margen.' },
        ],
      },
    ],
    expenses: [
      { category: 'comida', description: 'Tacos de canasta', amount: 90, daysOffset: 9, isPaid: false },
      { category: 'actividades', description: 'Boleto Museo Frida (anticipado)', amount: 320, daysOffset: -2, isPaid: true },
    ],
  },
  {
    title: 'Roadtrip a la Huasteca Potosina',
    destination: { name: 'Ciudad Valles', country: 'MX', lat: 21.9954, lng: -99.0128 },
    origin: { name: 'Monterrey', country: 'MX', lat: 25.6866, lng: -100.3161 },
    startDate: daysFromNow(-45),
    endDate: daysFromNow(-40),
    travelers: 4,
    budget: { amount: 32000, currency: 'MXN' },
    status: 'completado',
    notes: 'Viaje en auto propio, cuatro personas dividiendo gasolina.',
    transport: {
      outbound: { mode: 'auto-propio', departureAt: daysFromNow(-45), cost: 2200, isEstimate: false, notes: 'Gasolina y casetas de ida.' },
      inbound: { mode: 'auto-propio', departureAt: daysFromNow(-40), cost: 2200, isEstimate: false, notes: 'Gasolina y casetas de regreso.' },
    },
    lodging: [
      {
        type: 'cabana',
        name: 'Cabañas en Micos',
        place: { name: 'Micos, San Luis Potosí', lat: 22.0197, lng: -99.1553 },
        checkIn: daysFromNow(-45),
        checkOut: daysFromNow(-40),
        totalCost: 12000,
        nights: 5,
        isEstimate: false,
      },
    ],
    localTransport: [{ type: 'renta-auto', provider: 'Auto propio', estimatedCost: 900, notes: 'Traslados entre cascadas.' }],
    itinerary: null, // viaje viejo: se guardo sin itinerario, sirve para probar el estado vacio
    expenses: [
      { category: 'actividades', description: 'Tour Cascada de Tamul', amount: 3200, daysOffset: -43, isPaid: true },
      { category: 'comida', description: 'Despensa para la semana', amount: 2800, daysOffset: -45, isPaid: true },
      { category: 'actividades', description: 'Entradas Puente de Dios', amount: 800, daysOffset: -42, isPaid: true },
      { category: 'otros', description: 'Propinas guías', amount: 500, daysOffset: -42, isPaid: true },
    ],
  },
];

async function seed() {
  await connectDB();

  let user = await User.findOne({ email: DEMO_EMAIL });

  if (user && RESET) {
    console.log('[seed] --reset: borrando datos previos del usuario demo...');
    const trips = await Trip.find({ user: user._id }).select('_id');
    const tripIds = trips.map((t) => t._id);
    await Promise.all([
      Itinerary.deleteMany({ trip: { $in: tripIds } }),
      Expense.deleteMany({ trip: { $in: tripIds } }),
    ]);
    await Trip.deleteMany({ user: user._id });
    await User.deleteOne({ _id: user._id });
    user = null;
  }

  if (!user) {
    user = await User.create({
      name: 'Viajero Demo',
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      preferences: {
        travelStyles: ['gastronomia', 'cultura', 'naturaleza'],
        budgetLevel: 'medio',
        pace: 'moderado',
        homeCity: 'Monterrey',
        currency: 'MXN',
      },
    });
    console.log(`[seed] Usuario demo creado: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } else {
    console.log(`[seed] Usuario demo ya existia: ${DEMO_EMAIL}`);
  }

  const existingCount = await Trip.countDocuments({ user: user._id });
  if (existingCount > 0) {
    console.log(`[seed] El usuario ya tiene ${existingCount} viaje(s). Usa "npm run seed:reset" para recrearlos.`);
    await disconnectDB();
    return;
  }

  for (const bp of tripBlueprints) {
    const { itinerary: itineraryDays, expenses, ...tripData } = bp;
    const trip = await Trip.create({ ...tripData, user: user._id });

    if (itineraryDays) {
      await Itinerary.create({
        trip: trip._id,
        user: user._id,
        generatedBy: 'ia',
        model: env.gemini.model,
        promptContext: {
          destination: trip.destination.name,
          days: itineraryDays.length,
          travelers: trip.travelers,
          interests: user.preferences.travelStyles,
          budgetHint: user.preferences.budgetLevel,
          pace: user.preferences.pace,
        },
        days: itineraryDays.map((day, i) => ({
          dayNumber: i + 1,
          date: new Date(trip.startDate.getTime() + i * 86400000),
          title: day.title,
          summary: day.summary,
          activities: day.activities.map((a, idx) => ({
            time: a.time,
            title: a.title,
            description: a.desc,
            category: a.category,
            location: { name: a.title, lat: a.lat, lng: a.lng },
            estimatedCost: a.cost,
            durationMinutes: 90,
            source: 'ia',
            order: idx,
          })),
        })),
      });
    }

    if (expenses?.length) {
      await Expense.insertMany(
        expenses.map((e) => ({
          trip: trip._id,
          user: user._id,
          category: e.category,
          description: e.description,
          amount: e.amount,
          currency: trip.budget.currency,
          date: daysFromNow(e.daysOffset),
          isPaid: e.isPaid,
          isEstimate: !e.isPaid,
        }))
      );
    }

    console.log(`[seed] Viaje creado: ${trip.title} (${itineraryDays?.length || 0} dias, ${expenses?.length || 0} gastos)`);
  }

  console.log('\n[seed] Listo. Entra con:');
  console.log(`       email:    ${DEMO_EMAIL}`);
  console.log(`       password: ${DEMO_PASSWORD}\n`);

  await disconnectDB();
}

seed().catch(async (err) => {
  console.error('[seed] Fallo:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
