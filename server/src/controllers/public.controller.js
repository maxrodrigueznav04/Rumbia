import { Itinerary, Trip, ClickSalida, Agency } from '../models/index.js';
import { generateItinerary as callGemini } from '../services/gemini.service.js';
import { buildLinksForTrip } from '../services/bookingLinks.service.js';
import { decorarSecciones, hayAfiliados } from '../services/affiliates.service.js';
import { enviarCorreo, correoPropuestaAceptada } from '../services/email.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { isoDay, addDays } from '../utils/dates.js';
import env from '../config/env.js';

// Un invitado no puede pedir un viaje de tres semanas: cada dia extra cuesta
// tiempo de Gemini, y esto se sirve sin cuenta ni limite por usuario.
const MAX_DIAS_INVITADO = 7;

/**
 * Genera un itinerario de muestra SIN cuenta y SIN guardar nada.
 *
 * Existe porque pedir registro antes de enseñar el producto es lo que mas
 * usuarios pierde: nadie crea una cuenta para averiguar si algo le sirve. Aqui
 * el visitante ve el itinerario y los enlaces de reserva, y la cuenta se le
 * pide solo cuando quiere guardarlo.
 *
 * Nada de esto toca la base de datos: si el visitante cierra la pestaña, no
 * queda rastro suyo en ningun lado.
 */
export const generarItinerarioInvitado = asyncHandler(async (req, res) => {
  const { destination, country, startDate, endDate, travelers, interests, pace } = req.body;

  const inicio = new Date(startDate);
  const fin = new Date(endDate);
  const dias = Math.round((fin - inicio) / 86400000) + 1;

  if (dias < 1) throw ApiError.badRequest('La fecha de regreso no puede ser anterior a la de salida.');
  if (dias > MAX_DIAS_INVITADO) {
    throw ApiError.badRequest(
      `Sin cuenta se pueden probar viajes de hasta ${MAX_DIAS_INVITADO} días. Crea una cuenta gratis para planear viajes más largos.`
    );
  }

  const contexto = {
    destination: [destination, country].filter(Boolean).join(', '),
    startDate: isoDay(inicio),
    endDate: isoDay(fin),
    days: dias,
    travelers,
    interests: interests || [],
    pace: pace || 'moderado',
    budgetHint: 'medio',
    budgetAmount: 0,
    currency: 'MXN',
    idioma: req.idioma,
  };

  const resultado = await callGemini(contexto);

  const diasConFecha = resultado.days.map((d) => ({
    ...d,
    date: addDays(inicio, d.dayNumber - 1),
  }));

  // Se arma un viaje "de mentira" en memoria solo para reusar el constructor de
  // enlaces: es la misma logica que ve un usuario registrado, sin duplicarla.
  const viajeFicticio = {
    destination: { name: destination, country },
    origin: {},
    startDate: inicio,
    endDate: fin,
    travelers,
    lodging: [],
    localTransport: [],
    transport: {},
  };

  res.json({
    success: true,
    data: {
      itinerary: {
        days: diasConFecha,
        summary: resultado.summary,
        model: resultado.model,
        generatedBy: 'ia',
      },
      links: decorarSecciones(buildLinksForTrip(viajeFicticio)),
      conAfiliados: hayAfiliados(),
      // El cliente lo usa para explicar por que conviene crear una cuenta.
      guardado: false,
      maxDias: MAX_DIAS_INVITADO,
    },
  });
});

/**
 * El precio final que ve el cliente: costo real (actividades + logistica) mas
 * la cuota/margen de la agencia, si la capturo. Se comparte entre el enlace
 * publico y aceptarPropuesta (que la congela en el momento de aceptar) para
 * que las dos cuentas jamas se desalineen.
 */
export function precioTotalPorPersonaDe(trip, itinerary) {
  const travelers = trip.travelers || 1;
  const costoPorPersonaSinMargen = itinerary.totalEstimatedCost + (trip.coreCosts.total || 0) / travelers;
  const margenMonto = trip.margen?.monto || 0;
  return Number(
    (
      margenMonto <= 0
        ? costoPorPersonaSinMargen
        : trip.margen.tipo === 'porcentaje'
          ? costoPorPersonaSinMargen * (1 + margenMonto / 100)
          : costoPorPersonaSinMargen + margenMonto / travelers
    ).toFixed(2)
  );
}

/**
 * Itinerario compartido por enlace, sin sesion.
 *
 * Se devuelve el viaje completo para leerlo: destino, fechas, dias, y como
 * llega/donde se hospeda/como se mueve (transport, lodging, localTransport),
 * con sus costos, para que quien lo recibe vea el plan entero y no solo las
 * actividades. Deliberadamente NO viajan el dueno, su correo, el limite de
 * presupuesto que se puso ni sus gastos ya registrados (Expense): eso es
 * finanzas personales de quien armo el viaje, no parte del plan a compartir.
 */
export const verItinerarioCompartido = asyncHandler(async (req, res) => {
  const itinerary = await Itinerary.findOne({ shareToken: req.params.token });
  if (!itinerary) {
    throw ApiError.notFound('Este enlace ya no existe o dejo de compartirse.');
  }

  // 'user' se pide solo para poder resolver la marca; nunca sale en la
  // respuesta tal cual, se extraen a mano los tres campos que si son publicos.
  // Si el dueno pertenece a una agencia, la marca es la de la agencia, no la
  // personal: es el mismo criterio que usa el PDF privado.
  const trip = await Trip.findById(itinerary.trip)
    .select(
      'title destination additionalDestinations origin startDate endDate travelers budget transport lodging localTransport ocultarDesglose ocultarCodigos margen estadoPropuesta user agency'
    )
    .populate({
      path: 'user',
      select: 'branding agency',
      // billing.plan va incluido solo para que el virtual marcaBlanca se
      // pueda calcular abajo -- el resto de billing (Stripe, fechas) nunca
      // sale de aqui.
      populate: {
        path: 'agency',
        select:
          'agencyName logoUrl contact colorAcento fuentePdf densidadPdf fondoPdf createdAt billing.plan billing.status billing.trialHasta',
      },
    });
  if (!trip) throw ApiError.notFound('El viaje de este itinerario ya no existe.');

  // Si el viaje pertenece a una agencia archivada, revocar acceso público (P02)
  if (trip.agency) {
    const agenciaTrip = await Agency.findById(trip.agency).select('status');
    if (agenciaTrip?.status === 'archivada') {
      throw ApiError.notFound('Este itinerario ya no está disponible.');
    }
  }

  // Lista blanca a proposito: branding/agency son lo unico del dueno que se
  // publica aqui. Si algun dia se le agrega un campo sensible a cualquiera de
  // los dos esquemas, no empieza a salir solo porque este endpoint reenvia el
  // objeto entero.
  //
  // Se prefiere la marca CONGELADA al compartir (itinerary.marcaCompartida)
  // sobre la marca en vivo del dueno: si ya mando este enlace a un cliente y
  // despues cambia de agencia, el enlace no debe empezar a mostrar la marca
  // nueva sola. Los enlaces compartidos antes de que existiera este campo no
  // tienen snapshot (queda vacio), asi que caen a resolverla en vivo como antes.
  const fuenteMarcaViva = trip.user?.agency || trip.user?.branding;
  const snapshot = itinerary.marcaCompartida;
  const tieneSnapshot = Boolean(
    snapshot?.agencyName || snapshot?.logoUrl || snapshot?.contact
  );
  const fuenteMarca = tieneSnapshot ? snapshot : fuenteMarcaViva;
  const marca = {
    agencyName: fuenteMarca?.agencyName || '',
    logoUrl: fuenteMarca?.logoUrl || '',
    contact: fuenteMarca?.contact || '',
    colorAcento: fuenteMarca?.colorAcento || '',
    fuentePdf: fuenteMarca?.fuentePdf || '',
    densidadPdf: fuenteMarca?.densidadPdf || 'normal',
    fondoPdf: fuenteMarca?.fondoPdf || '',
    // Solo la agencia trae este virtual; branding personal nunca lo tiene.
    marcaBlanca: tieneSnapshot
      ? Boolean(snapshot.marcaBlanca)
      : Boolean(trip.user?.agency?.marcaBlanca),
  };

  /**
   * Si el dueno activo "ocultar desglose" (agencias con paquete cerrado o que
   * le suman su comision), el precio de cada renglon se quita AQUI, en el
   * servidor: esconderlo solo en la pantalla no sirve de nada si la respuesta
   * cruda todavia trae el numero real para quien abra las herramientas del
   * navegador.
   *
   * Con el desglose oculto, TAMPOCO se manda coreCosts.total ni
   * itinerary.totalEstimatedCost (antes si se mandaban, "solo el total"):
   * junto con precioTotalPorPersona y travelers -- que si son publicos, son
   * el precio final -- esos dos numeros alcanzan para reconstruir el margen
   * a mano (costoSinMargen = totalEstimatedCost + coreCosts.total/travelers;
   * margen = precioTotalPorPersona - costoSinMargen), sin necesitar que
   * margenPorPersona viaje directo. Es la misma cuenta que hace este mismo
   * archivo un poco mas abajo para calcular precioTotalPorPersona.
   */
  const desglosePublico = !trip.ocultarDesglose;

  const transportPublico = desglosePublico
    ? trip.transport
    : {
        outbound: trip.transport?.outbound && {
          mode: trip.transport.outbound.mode,
          provider: trip.transport.outbound.provider,
          departureAt: trip.transport.outbound.departureAt,
          notes: trip.transport.outbound.notes,
        },
        inbound: trip.transport?.inbound && {
          mode: trip.transport.inbound.mode,
          provider: trip.transport.inbound.provider,
          departureAt: trip.transport.inbound.departureAt,
          notes: trip.transport.inbound.notes,
        },
      };

  const lodgingPublico = desglosePublico
    ? trip.lodging
    : (trip.lodging || []).map((l) => ({
        type: l.type,
        name: l.name,
        place: l.place,
        checkIn: l.checkIn,
        checkOut: l.checkOut,
        nights: l.nights,
        notes: l.notes,
      }));

  const localTransportPublico = desglosePublico
    ? trip.localTransport
    : (trip.localTransport || []).map((t) => ({
        type: t.type,
        provider: t.provider,
        notes: t.notes,
      }));

  const coreCostsPublico = desglosePublico ? trip.coreCosts : undefined;

  /**
   * Independiente de ocultarDesglose (eso es precio): bookingRef, externalUrl
   * y notes sirven para que el AGENTE administre la reserva ya hecha (codigo
   * de confirmacion, link para modificarla, recordatorios internos), no para
   * que el cliente final la manipule. Oculto por default (ver Trip.js).
   */
  const codigosPublicos = !trip.ocultarCodigos;
  const CAMPOS_CODIGO_RESERVA = ['bookingRef', 'externalUrl', 'notes'];
  const sinCodigos = (obj) => {
    if (!obj) return obj;
    const plano = typeof obj.toObject === 'function' ? obj.toObject() : { ...obj };
    for (const campo of CAMPOS_CODIGO_RESERVA) delete plano[campo];
    return plano;
  };
  const transportSinCodigos = codigosPublicos
    ? transportPublico
    : {
        outbound: sinCodigos(transportPublico.outbound),
        inbound: sinCodigos(transportPublico.inbound),
      };
  const lodgingSinCodigos = codigosPublicos ? lodgingPublico : (lodgingPublico || []).map(sinCodigos);
  const localTransportSinCodigos = codigosPublicos
    ? localTransportPublico
    : (localTransportPublico || []).map(sinCodigos);

  /**
   * El precio final que ve el cliente: costo real (actividades + logistica)
   * mas la cuota/margen de la agencia, si la capturo. El margen crudo (tipo y
   * monto) NUNCA viaja al publico: solo se manda como una linea reconciliada
   * ("Cuota de servicio") cuando el dueño decidio no ocultar el desglose; si
   * lo oculto, tampoco se manda esa linea, solo el precio final ya sumado.
   */
  const travelers = trip.travelers || 1;
  const costoPorPersonaSinMargen = itinerary.totalEstimatedCost + (trip.coreCosts.total || 0) / travelers;
  const margenMonto = trip.margen?.monto || 0;
  const precioTotalPorPersona = precioTotalPorPersonaDe(trip, itinerary);
  const margenPorPersona =
    desglosePublico && margenMonto > 0
      ? Number((precioTotalPorPersona - costoPorPersonaSinMargen).toFixed(2))
      : undefined;
  // Que exista un margen no es sensible por si solo (es normal que un
  // paquete incluya una cuota de servicio); lo que se protege es el MONTO,
  // que solo viaja arriba cuando el desglose esta visible. Este booleano
  // sirve para que el titulo diga "Precio total" aun con el desglose oculto.
  const hayMargen = margenMonto > 0;

  const diasPublicos = desglosePublico
    ? itinerary.days
    : itinerary.days.map((d) => {
        const { estimatedCost, activities, ...restoDia } = d.toObject();
        return { ...restoDia, activities: activities.map(({ estimatedCost: _c, ...resto }) => resto) };
      });

  res.json({
    success: true,
    data: {
      viaje: {
        title: trip.title,
        destination: trip.destination,
        additionalDestinations: trip.additionalDestinations,
        startDate: trip.startDate,
        endDate: trip.endDate,
        travelers: trip.travelers,
        durationDays: trip.durationDays,
        budget: { currency: trip.budget?.currency || 'MXN' },
        transport: transportSinCodigos,
        lodging: lodgingSinCodigos,
        localTransport: localTransportSinCodigos,
        coreCosts: coreCostsPublico,
        ocultarDesglose: trip.ocultarDesglose,
        ocultarCodigos: trip.ocultarCodigos,
        precioTotalPorPersona,
        margenPorPersona,
        hayMargen,
        estadoPropuesta: trip.estadoPropuesta,
      },
      itinerary: {
        days: diasPublicos,
        generatedBy: itinerary.generatedBy,
        totalEstimatedCost: desglosePublico ? itinerary.totalEstimatedCost : undefined,
        activityCount: itinerary.activityCount,
      },
      pins: itinerary.mapPins(),
      links: decorarSecciones(buildLinksForTrip(trip)),
      conAfiliados: hayAfiliados(),
      marca,
    },
  });
});

/**
 * El cliente acepta la propuesta desde el enlace publico, sin sesion.
 *
 * Idempotente a proposito: un doble clic o una recarga de pagina no debe
 * reenviar el correo al agente ni pisar un estado mas avanzado (pagada) con
 * uno anterior (aceptada). Solo se puede aceptar desde "borrador" o
 * "enviada" -- una propuesta ya pagada o cancelada no se reabre desde aqui.
 *
 * El paso borrador/enviada -> aceptada es un findOneAndUpdate condicionado al
 * estado actual, no un read-then-save: dos aceptaciones que lleguen al mismo
 * tiempo (doble clic en dos pestañas, o el cliente reenviando la peticion por
 * una red lenta) solo pueden hacer match una vez, asi que solo una manda el
 * correo al agente y la otra cae directo al branch "ya habias aceptado".
 */
export const aceptarPropuesta = asyncHandler(async (req, res) => {
  const itinerary = await Itinerary.findOne({ shareToken: req.params.token });
  if (!itinerary) {
    throw ApiError.notFound('Este enlace ya no existe o dejo de compartirse.');
  }

  // Se necesita el trip ya cargado para calcular el precio (coreCosts,
  // margen) que se va a congelar en la aceptacion -- ninguno de esos campos
  // cambia con este update, asi que leerlo antes no abre ninguna ventana de
  // carrera para el estado en si (ese lo protege el filtro de abajo).
  const tripActual = await Trip.findById(itinerary.trip);
  if (!tripActual) throw ApiError.notFound('El viaje de este itinerario ya no existe.');

  // Si el viaje pertenece a una agencia archivada, revocar aceptación pública (P02)
  if (tripActual.agency) {
    const agenciaTrip = await Agency.findById(tripActual.agency).select('status');
    if (agenciaTrip?.status === 'archivada') {
      throw ApiError.notFound('Este itinerario ya no está disponible.');
    }
  }

  const aceptacion = {
    en: new Date(),
    ip: req.ip || '',
    userAgent: req.get('user-agent') || '',
    precioTotalPorPersona: precioTotalPorPersonaDe(tripActual, itinerary),
    itineraryVersion: itinerary.version,
  };

  const trip = await Trip.findOneAndUpdate(
    { _id: itinerary.trip, estadoPropuesta: { $in: ['borrador', 'enviada'] } },
    { $set: { estadoPropuesta: 'aceptada', aceptacion } },
    { new: true }
  ).populate({ path: 'user', select: 'name email preferences.idioma' });

  if (!trip) {
    // No hizo match: o ya estaba aceptada (posible incluso por una peticion
    // concurrente que gano la carrera hace un instante), o esta en un estado
    // que ya no se puede aceptar desde aqui. Se relee para saber cual de los
    // dos es, sin volver a tocar el estado.
    const actual = await Trip.findById(itinerary.trip).select('estadoPropuesta');
    if (actual?.estadoPropuesta === 'aceptada') {
      return res.json({
        success: true,
        message: 'Ya habias aceptado esta propuesta.',
        data: { estadoPropuesta: 'aceptada' },
      });
    }
    throw ApiError.badRequest('Esta propuesta ya no se puede aceptar desde aqui.');
  }

  // Sin await a proposito: quien acepta no debe esperar a que salga el
  // correo (enviarCorreo ya tiene su propio timeout de 10s) para ver la
  // confirmacion. enviarCorreo nunca lanza, asi que no hace falta .catch().
  if (trip.user?.email) {
    const enlace = `${env.clientUrl}/viajes/${trip._id}`;
    const { asunto, html, texto } = correoPropuestaAceptada({
      nombre: trip.user.name,
      viaje: trip.title,
      enlace,
      idioma: trip.user.preferences?.idioma,
    });
    enviarCorreo({ para: trip.user.email, asunto, html, texto });
  }

  res.json({ success: true, message: 'Propuesta aceptada.', data: { estadoPropuesta: trip.estadoPropuesta } });
});

/**
 * Registra un clic de salida. Responde 204 y no devuelve nada: el cliente lo
 * manda con sendBeacon justo antes de irse, y no debe esperar respuesta.
 *
 * Si falla, falla en silencio. Perder una metrica no puede impedir que el
 * usuario llegue al sitio del proveedor.
 */
export const registrarClick = asyncHandler(async (req, res) => {
  const { provider, section, destination, esAfiliado, origen } = req.body;
  try {
    await ClickSalida.create({ provider, section, destination, esAfiliado, origen });
  } catch (err) {
    // Una metrica perdida no es motivo para devolver un error al usuario,
    // pero si la DB esta caida o el modelo cambio, vale la pena verlo en logs.
    console.warn(`[clicks] no se pudo registrar el clic: ${err.message}`);
  }
  res.status(204).end();
});
