import { Trip, Itinerary, Expense, Client, TripChat } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import { deleteVisualTripData } from '../services/visualCleanup.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { buildLinksForTrip } from '../services/bookingLinks.service.js';
import { convertirTotales } from '../services/exchange.service.js';
import { decorarSecciones, hayAfiliados } from '../services/affiliates.service.js';
import { addDays } from '../utils/dates.js';

/**
 * Realinea el itinerario cuando cambian las fechas del viaje.
 *
 * - Recalcula la fecha de cada dia (dia 1 = nueva fecha de salida). Sin esto el
 *   itinerario mostraria fechas que ya no corresponden al viaje.
 * - Si el viaje se alarga, agrega dias vacios al final.
 * - Si se acorta, NO borra nada: los dias sobrantes se reportan para que el
 *   usuario decida. Perder actividades en silencio seria mucho peor.
 */
async function sincronizarItinerario(trip) {
  const itinerary = await Itinerary.findOne({ trip: trip._id });
  if (!itinerary) return null;

  const dias = trip.durationDays;

  itinerary.days.forEach((day) => {
    day.date = addDays(trip.startDate, day.dayNumber - 1);
  });

  const agregados = [];
  for (let n = itinerary.days.length + 1; n <= dias; n += 1) {
    itinerary.days.push({
      dayNumber: n,
      date: addDays(trip.startDate, n - 1),
      title: `Dia ${n}`,
      summary: '',
      activities: [],
    });
    agregados.push(n);
  }

  const sobrantes = itinerary.days.filter((d) => d.dayNumber > dias);

  await itinerary.save();

  return {
    diasAgregados: agregados.length,
    diasSobrantes: sobrantes.length,
    actividadesEnSobrantes: sobrantes.reduce((s, d) => s + d.activities.length, 0),
  };
}

/**
 * Escapa los caracteres especiales de regex antes de meter texto de un
 * usuario en un new RegExp(). Sin esto, un patron tipo "(a+)+$" en el buscador
 * de viajes puede colgar el hilo de Node entero (ReDoS) -- y esto corre en
 * cada busqueda de cualquier cuenta con sesion, no solo en un endpoint de admin.
 */
export function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Confirma que un `client` (CRM) que se va a guardar en un Trip pertenezca
 * de verdad al usuario o a su agencia.
 *
 * updateTripSchema/createTripSchema solo validan que `client` tenga forma de
 * ObjectId -- sin este chequeo, cualquier cuenta podia apuntar su propio
 * viaje al cliente de OTRA cuenta o agencia con solo adivinar o conseguir su
 * id, y getTrip lo popula sin restriccion, exponiendo nombre, correo,
 * telefono y notas de un cliente ajeno.
 */
async function esClientePropio(clientId, user) {
  if (!clientId) return true;
  // agency:null en el respaldo personal, mismo motivo que filtroPertenencia
  // en client.controller.js: un cliente que se registro para OTRA agencia no
  // deberia poder vincularse via el respaldo "user: user._id" solo porque el
  // usuario ya no pertenece a ella.
  const filtro = user.agency
    ? { _id: clientId, $or: [{ agency: user.agency }, { user: user._id, agency: null }] }
    : { _id: clientId, user: user._id, agency: null };
  return Boolean(await Client.exists(filtro));
}

/**
 * Resuelve el filtro de pertenencia de un viaje: con agencia, se comparte
 * con el equipo -- mismo criterio que filtroPertenencia (client.controller.js)
 * y filtroVisible (templates.controller.js). Sin agencia (o para un viaje que
 * se creo antes de tener una), solo lo ve quien lo creo.
 *
 * Antes un viaje era solo de quien lo armaba, sin importar la agencia: un
 * agente que se iba (o lo sacaban) se llevaba consigo cada propuesta y cada
 * cliente vinculado, y el resto del equipo se quedaba sin nada. Con esto, un
 * viaje armado dentro de una agencia se queda con el equipo aunque su autor
 * ya no este.
 */
export function filtroPertenenciaTrip(user) {
  if (user.agency) {
    return { $or: [{ agency: user.agency }, { user: user._id, agency: null }] };
  }
  return { user: user._id, agency: null };
}

/**
 * Carga un viaje verificando que pertenezca al usuario autenticado o a su
 * agencia. Centraliza la comprobacion de propiedad para no repetirla en cada
 * handler.
 *
 * Dos pasos (no un Trip.findOne con el filtro de pertenencia de una vez) a
 * proposito: para distinguir "no existe" (404) de "existe pero no es tuyo"
 * (403) -- ver el comentario en expense.controller.js sobre por que
 * listExpenses quiere ese 403 explicito en vez de una lista vacia.
 */
export async function findOwnedTrip(tripId, user) {
  const trip = await Trip.findById(tripId);
  if (!trip) throw ApiError.notFound('Viaje no encontrado.');

  const esPersonalPropio = !trip.agency && String(trip.user) === String(user._id);
  const esDeLaAgencia = trip.agency && user.agency && String(trip.agency) === String(user.agency);
  if (!esPersonalPropio && !esDeLaAgencia) throw ApiError.forbidden();

  return trip;
}

export const listTrips = asyncHandler(async (req, res) => {
  const { status, estadoPropuesta, atencion, q, page, limit } = req.validatedQuery;
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  // $and de condiciones separadas, nunca reasignando una clave "$or" que ya
  // trae filtroPertenenciaTrip: mismo bug que ya se corrigio en
  // listarClientes (client.controller.js) -- filter.$or = [...] aqui pisaria
  // por completo el $or de pertenencia en cuanto hubiera busqueda de texto,
  // y devolveria viajes de CUALQUIER agencia que calzaran con lo buscado.
  const condiciones = [filtroPertenenciaTrip(req.user)];

  if (status === 'proximos') condiciones.push({ endDate: { $gte: now } });
  else if (status === 'pasados') condiciones.push({ endDate: { $lt: now } });
  else if (status) condiciones.push({ status });

  if (estadoPropuesta) condiciones.push({ estadoPropuesta });
  if (atencion === 'salidas') condiciones.push({ startDate: { $gte: now, $lt: addDays(now, 7) } });
  if (atencion === 'pendientes') condiciones.push(filtroPendientes());

  if (q) {
    const re = new RegExp(escaparRegex(q), 'i');
    condiciones.push({ $or: [{ title: re }, { 'destination.name': re }, { 'cliente.nombre': re }] });
  }

  const filter = condiciones.length > 1 ? { $and: condiciones } : condiciones[0];

  const [trips, total] = await Promise.all([
    Trip.find(filter)
      .sort({ startDate: status === 'pasados' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Trip.countDocuments(filter),
  ]);

  const itinerarios = await Itinerary.find({ trip: { $in: trips.map((t) => t._id) } }).select('trip').lean();
  const conItinerario = new Set(itinerarios.map((i) => String(i.trip)));

  res.json({
    success: true,
    data: { trips: trips.map((t) => ({ ...t.toObject(), tieneItinerario: conItinerario.has(String(t._id)) })), pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } },
  });
});

function filtroPendientes() {
  return { estadoPropuesta: { $nin: ['cancelada', 'pagada'] }, status: { $ne: 'completado' },
    $or: [{ 'cliente.nombre': { $in: ['', null] } }, { 'lodging.0': { $exists: false } }] };
}

export const getPanel = asyncHandler(async (req, res) => {
  const propio = filtroPertenenciaTrip(req.user);
  const hoy = new Date(); hoy.setUTCHours(0, 0, 0, 0);
  const [porEnviar, seguimiento, proximasSalidas, pendientes] = await Promise.all([
    Trip.countDocuments({ ...propio, estadoPropuesta: 'borrador', endDate: { $gte: hoy } }),
    Trip.countDocuments({ ...propio, estadoPropuesta: 'enviada' }),
    Trip.countDocuments({ ...propio, startDate: { $gte: hoy, $lt: addDays(hoy, 7) } }),
    Trip.countDocuments({ ...propio, $and: [filtroPendientes()] }),
  ]);
  res.json({ success: true, data: { porEnviar, seguimiento, proximasSalidas, pendientes } });
});

export const getTrip = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user);
  await trip.populate([{ path: 'itinerary' }, { path: 'expenses', options: { sort: { date: -1 } } }]);

  /**
   * El cliente (CRM) solo se puebla si sigue siendo "propio" en la agencia
   * ACTUAL del usuario -- mismo chequeo que esClientePropio usa al guardar.
   * trip.client es una referencia aparte a la coleccion Client, con su
   * propio ciclo de vida (esClientePropio evalua Client.agency, no
   * Trip.agency): un cliente puede haberse creado, o desvinculado de la
   * agencia, en un momento distinto al del propio viaje, asi que se
   * revalida aqui aparte de que findOwnedTrip ya haya confirmado el viaje.
   */
  if (trip.client) {
    if (await esClientePropio(trip.client, req.user)) {
      await trip.populate({ path: 'client' });
    } else {
      trip.client = null;
    }
  }

  // Otras variantes del mismo prospecto (ver duplicarViaje): el raiz de la
  // familia no tiene grupoPropuesta propio, asi que el ancla es su propio id.
  // Mismo filtro de pertenencia que el viaje principal (findOwnedTrip de
  // arriba ya demostro que este usuario puede ver "trip"): si es de agencia,
  // las variantes armadas por cualquier companero de equipo tambien cuentan.
  const ancla = trip.grupoPropuesta || trip._id;
  const variantes = await Trip.find({
    _id: { $ne: trip._id },
    $and: [filtroPertenenciaTrip(req.user), { $or: [{ _id: ancla }, { grupoPropuesta: ancla }] }],
  })
    .select('title status startDate endDate destination')
    .sort({ createdAt: 1 });

  res.json({ success: true, data: { trip, variantes } });
});

export const createTrip = asyncHandler(async (req, res) => {
  if (req.body.client && !(await esClientePropio(req.body.client, req.user))) {
    throw ApiError.badRequest('Cliente no encontrado.');
  }

  const payload = { ...req.body, user: req.user._id, agency: req.user.agency || null };

  // Moneda por defecto: la del perfil, si el usuario no mando una.
  if (!payload.budget?.currency) {
    payload.budget = { ...payload.budget, currency: req.user.preferences?.currency || 'MXN' };
  }

  const trip = await Trip.create(payload);
  res.status(201).json({ success: true, message: 'Viaje creado.', data: { trip } });
});

// Todo lo de updateTripSchema que NO se fusiona a mano mas abajo (budget,
// origin, margen, cliente, transport tienen su propio merge superficial por
// seccion). Hoy Zod ya descarta cualquier campo no declarado en el schema
// (updateTripSchema no es .passthrough()), asi que esto no cambia el
// comportamiento actual -- es una segunda barrera explicita: si algun dia se
// agrega un campo sensible (user, grupoPropuesta) al schema de validacion sin
// pensar en updateTrip, este allowlist sigue sin dejarlo pasar.
export const CAMPOS_EDITABLES_DIRECTO = [
  'title',
  'destination',
  'additionalDestinations',
  'startDate',
  'endDate',
  'travelers',
  'status',
  'estadoPropuesta',
  'coverImage',
  'notes',
  'lodging',
  'localTransport',
  'ocultarDesglose',
  'ocultarCodigos',
  'interests',
  'pace',
  'budgetLevel',
  'client',
];

export const updateTrip = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user);

  const fechasPrevias = `${trip.startDate?.getTime()}-${trip.endDate?.getTime()}`;

  // Fusion superficial por seccion: permite mandar solo transport.outbound
  // sin borrar transport.inbound. origin, margen y cliente necesitan el mismo
  // trato: un PATCH con un solo subcampo no debe borrar los demas.
  const { transport, budget, origin, margen, cliente, ...rest } = req.body;

  if (rest.client && !(await esClientePropio(rest.client, req.user))) {
    throw ApiError.badRequest('Cliente no encontrado.');
  }

  for (const campo of CAMPOS_EDITABLES_DIRECTO) {
    if (rest[campo] !== undefined) trip[campo] = rest[campo];
  }

  // budget tambien se fusiona: un PATCH con solo { amount } no debe dejar el
  // viaje sin moneda, que es lo que pasa al asignar el subdocumento entero.
  if (budget) {
    trip.budget = { ...trip.budget?.toObject?.(), ...budget };
  }

  if (origin) {
    trip.origin = { ...trip.origin?.toObject?.(), ...origin };
  }

  if (margen) {
    trip.margen = { ...trip.margen?.toObject?.(), ...margen };
  }

  if (cliente) {
    trip.cliente = { ...trip.cliente?.toObject?.(), ...cliente };
  }

  if (transport) {
    if (transport.outbound) {
      trip.transport.outbound = { ...trip.transport.outbound?.toObject(), ...transport.outbound };
    }
    if (transport.inbound) {
      trip.transport.inbound = { ...trip.transport.inbound?.toObject(), ...transport.inbound };
    }
  }

  await trip.save();

  const fechasCambiaron = `${trip.startDate?.getTime()}-${trip.endDate?.getTime()}` !== fechasPrevias;
  const itinerario = fechasCambiaron ? await sincronizarItinerario(trip) : null;

  res.json({
    success: true,
    message: 'Viaje actualizado.',
    data: { trip, ...(itinerario ? { itinerario } : {}) },
  });
});

/**
 * Duplica un viaje completo (logistica, margen, itinerario) para armar
 * variantes de una misma propuesta: "Opcion Economica" vs "Premium" sin
 * volver a capturar todo desde cero.
 *
 * La copia queda vinculada a la familia del original via grupoPropuesta
 * (ver el modelo), pero es un viaje independiente en todo lo demas: status
 * vuelve a "borrador", y no hereda gastos ya registrados ni el enlace
 * publico del original (cada variante comparte el suyo cuando este lista).
 */
export const duplicarViaje = asyncHandler(async (req, res) => {
  const original = await findOwnedTrip(req.params.id, req.user);
  const itinerarioOriginal = await Itinerary.findOne({ trip: original._id });

  const copia = await Trip.create({
    user: req.user._id,
    agency: req.user.agency || null,
    title: `${original.title} (copia)`,
    destination: {
      name: original.destination?.name,
      address: original.destination?.address,
      country: original.destination?.country,
      lat: original.destination?.lat,
      lng: original.destination?.lng,
    },
    origin: original.origin
      ? {
          name: original.origin.name,
          address: original.origin.address,
          country: original.origin.country,
          lat: original.origin.lat,
          lng: original.origin.lng,
        }
      : undefined,
    additionalDestinations: (original.additionalDestinations || []).map((p) => ({
      place: { name: p.place?.name, address: p.place?.address, country: p.place?.country, lat: p.place?.lat, lng: p.place?.lng },
      startDate: p.startDate,
      endDate: p.endDate,
    })),
    startDate: original.startDate,
    endDate: original.endDate,
    travelers: original.travelers,
    budget: { amount: original.budget?.amount, currency: original.budget?.currency },
    notes: original.notes,
    cliente: { nombre: original.cliente?.nombre, contacto: original.cliente?.contacto },
    ocultarDesglose: original.ocultarDesglose,
    ocultarCodigos: original.ocultarCodigos,
    margen: original.margen ? { tipo: original.margen.tipo, monto: original.margen.monto } : undefined,
    transport: {
      outbound: original.transport?.outbound ? original.transport.outbound.toObject() : undefined,
      inbound: original.transport?.inbound ? original.transport.inbound.toObject() : undefined,
    },
    lodging: (original.lodging || []).map((l) => {
      const { _id, id, subtotal, perNight, ...resto } = l.toObject();
      return resto;
    }),
    localTransport: (original.localTransport || []).map((t) => {
      const { _id, id, ...resto } = t.toObject();
      return resto;
    }),
    grupoPropuesta: original.grupoPropuesta || original._id,
  });

  if (itinerarioOriginal) {
    await Itinerary.create({
      trip: copia._id,
      user: req.user._id,
      generatedBy: itinerarioOriginal.generatedBy,
      model: itinerarioOriginal.model,
      promptContext: itinerarioOriginal.promptContext,
      days: itinerarioOriginal.days.map((d) => {
        const { _id, id, estimatedCost, ...restoDia } = d.toObject();
        return {
          ...restoDia,
          activities: (restoDia.activities || []).map(({ _id: _actId, id: _actIdAlias, ...resto }) => resto),
        };
      }),
      // Sin shareToken: la copia empieza sin enlace publico propio.
    });
  }

  res.status(201).json({ success: true, message: 'Viaje duplicado.', data: { trip: copia } });
});

export const deleteTrip = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user);

  // Compartir visibilidad con la agencia no es lo mismo que compartir el
  // permiso de borrar: mismo criterio que ya usa templates.controller.js
  // (eliminar) para plantillas -- ver/editar es del equipo, pero borrar el
  // trabajo de otro companero (aunque sea de la misma agencia) sigue siendo
  // solo de quien lo creo.
  if (String(trip.user) !== String(req.user._id)) {
    throw ApiError.forbidden('Solo quien creó el viaje puede eliminarlo.');
  }

  // Sin transacciones (Atlas free soporta replica set, pero no lo damos por hecho):
  // se borran los hijos primero para no dejar huerfanos si algo falla.
  await deleteVisualTripData(trip._id);
  await Promise.all([
    Itinerary.deleteOne({ trip: trip._id }),
    Expense.deleteMany({ trip: trip._id }),
    TripChat.deleteOne({ trip: trip._id }),
  ]);
  await trip.deleteOne();

  res.json({ success: true, message: 'Viaje eliminado.' });
});

/** Links de salida hacia comparadores, con las fechas y el destino ya prellenados. */
export const getBookingLinks = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user);
  const { section, type, lodgingIndex } = req.validatedQuery;

  res.json({
    success: true,
    data: {
      links: decorarSecciones(buildLinksForTrip(trip, { section, type, lodgingIndex })),
      // La linea sobre comisiones solo aparece cuando de verdad hay enlaces de
      // afiliado activos: declarar que se gana comision sin ganarla seria tan
      // falso como callarlo cuando si se gana.
      disclaimer: hayAfiliados()
        ? 'Rumbia no procesa reservas ni pagos: estos enlaces te llevan al sitio del proveedor. Algunos son enlaces de afiliado, asi que si reservas podemos ganar una comision, sin ningun costo extra para ti.'
        : 'Rumbia no procesa reservas ni pagos. Estos enlaces te llevan al sitio del proveedor, donde completas la reserva.',
      conAfiliados: hayAfiliados(),
    },
  });
});

/**
 * Resumen de presupuesto: junta los costos capturados en el viaje
 * (transporte, hospedaje, transporte local) con los gastos sueltos, y compara
 * el total contra el presupuesto definido al crear el viaje.
 */
export const getTripSummary = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user);

  const [expenses, itinerary] = await Promise.all([
    Expense.find({ trip: trip._id }),
    Itinerary.findOne({ trip: trip._id }),
  ]);

  const core = trip.coreCosts;
  const moneda = trip.budget?.currency || 'MXN';

  // Un gasto puede estar en otra moneda que el viaje (un vuelo en USD y el
  // hotel en MXN). Antes se sumaban los numeros a secas y el total mentia.
  const { convertido, tasas, sinConvertir } = await convertirTotales(
    expenses.map((e) => ({ id: String(e._id), amount: e.amount, currency: e.currency, category: e.category, isPaid: e.isPaid })),
    moneda
  );

  // Los gastos manuales se suman por categoria; las categorias que ya cubre el
  // viaje (transporte/hospedaje/transporte-local) se acumulan encima, no se pisan.
  const manualByCategory = convertido.reduce((acc, e) => {
    acc[e.category] = Number(((acc[e.category] || 0) + e.convertido).toFixed(2));
    return acc;
  }, {});

  const breakdown = {
    transporte: Number((core.transport + (manualByCategory.transporte || 0)).toFixed(2)),
    hospedaje: Number((core.lodging + (manualByCategory.hospedaje || 0)).toFixed(2)),
    'transporte-local': Number(
      (core.localTransport + (manualByCategory['transporte-local'] || 0)).toFixed(2)
    ),
    comida: manualByCategory.comida || 0,
    actividades: manualByCategory.actividades || 0,
    compras: manualByCategory.compras || 0,
    otros: manualByCategory.otros || 0,
  };

  const total = Number(
    Object.values(breakdown).reduce((sum, v) => sum + v, 0).toFixed(2)
  );
  const budget = trip.budget?.amount || 0;
  const paid = Number(
    convertido.filter((e) => e.isPaid).reduce((s, e) => s + e.convertido, 0).toFixed(2)
  );

  res.json({
    success: true,
    data: {
      currency: moneda,
      // Que se convirtio y con que tasa. Si algo quedo fuera se dice cual, en
      // vez de dar un total redondo que no incluye todo.
      conversion: {
        aplicada: Object.keys(tasas).length > 0,
        tasas,
        sinConvertir,
      },
      breakdown,
      chartData: Object.entries(breakdown)
        .filter(([, value]) => value > 0)
        .map(([category, value]) => ({ category, value })),
      totals: {
        total,
        paid,
        pending: Number((total - paid).toFixed(2)),
        perTraveler: Number((total / (trip.travelers || 1)).toFixed(2)),
        perDay: Number((total / (trip.durationDays || 1)).toFixed(2)),
      },
      budget: {
        amount: budget,
        remaining: Number((budget - total).toFixed(2)),
        usedPercent: budget > 0 ? Number(((total / budget) * 100).toFixed(1)) : null,
        isOver: budget > 0 && total > budget,
        isSet: budget > 0,
      },
      // Costo sugerido por la IA: referencia, no se suma al total automaticamente
      // para no duplicar lo que el usuario ya capturo como gasto real.
      itineraryEstimate: itinerary
        ? {
            perTraveler: itinerary.totalEstimatedCost,
            allTravelers: Number((itinerary.totalEstimatedCost * (trip.travelers || 1)).toFixed(2)),
            activityCount: itinerary.activityCount,
          }
        : null,
      expenseCount: expenses.length,
    },
  });
});
