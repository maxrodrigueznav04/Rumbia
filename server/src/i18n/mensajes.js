/**
 * Traduce al inglés los mensajes de error que arma el servidor (ApiError,
 * validaciones de Zod, validaciones de Mongoose) sin tocar los ~130 sitios
 * que los lanzan: cada controlador/servicio sigue escribiendo su mensaje en
 * español tal cual, y justo antes de mandar la respuesta (errorHandler.js)
 * se busca aquí una traducción para `req.idioma === 'en'`. Si el mensaje no
 * está en el diccionario se deja en español -- mejor eso que inventar un
 * texto genérico que no describa el error real.
 *
 * EXACTOS: mensajes que siempre llegan idénticos, letra por letra.
 * DINAMICOS: mensajes armados con template strings (nombres, números,
 * códigos HTTP...); cada regla es un regex con grupos de captura + una
 * función que arma el inglés a partir de esos grupos.
 */

const EXACTOS = {
  // --- agencia / equipo ---
  'No perteneces a ninguna agencia.': "You don't belong to any agency.",
  'Ya perteneces a una agencia. Sal de ella antes de crear otra.':
    "You already belong to an agency. Leave it before creating another one.",
  'Ya perteneces a una agencia. Sal de ella antes de unirte a otra.':
    "You already belong to an agency. Leave it before joining another one.",
  'Ese código no corresponde a ninguna agencia.': "That code doesn't match any agency.",
  'Esta agencia todavía no tiene un plan activo. Pídele al dueño que lo active antes de unirte.':
    "This agency doesn't have an active plan yet. Ask the owner to activate one before you join.",
  'Eres el dueño y todavía hay otros agentes en la agencia. Sácalos primero, o pídeles que salgan ellos mismos.':
    "You're the owner and there are still other agents in the agency. Remove them first, or ask them to leave on their own.",
  'No puedes eliminarte a ti mismo. Usa la opción de salir.': "You can't remove yourself. Use the leave option instead.",
  'Ese agente no pertenece a tu agencia.': "That agent doesn't belong to your agency.",
  'Solo quien creó la agencia puede hacer esto.': 'Only whoever created the agency can do this.',
  'Este reporte no esta disponible para tu cuenta.': "This report isn't available for your account.",

  // --- plantillas ---
  'Plantilla no encontrada.': 'Template not found.',
  'Solo quien guardó la plantilla puede eliminarla.': 'Only whoever saved the template can delete it.',
  'Ya no perteneces a la agencia con la que se comparte esta plantilla.':
    "You no longer belong to the agency this template is shared with.",

  // --- billing / stripe ---
  'Esta agencia no tiene una suscripción activa que ajustar.': "This agency doesn't have an active subscription to adjust.",
  'Firma invalida.': 'Invalid signature.',
  'El cobro a agencias no esta configurado. Agrega STRIPE_SECRET_KEY en el .env del servidor.':
    "Billing for agencies isn't configured. Add STRIPE_SECRET_KEY to the server's .env.",
  'Esta agencia ya tiene un plan activo. Usa "Administrar plan" para cambiarlo, no actives uno nuevo.':
    'This agency already has an active plan. Use "Manage plan" to change it, not activate a new one.',
  'Esta agencia todavia no tiene un plan. Activa uno primero.': "This agency doesn't have a plan yet. Activate one first.",
  'El plan "vitalicio" es un pago único: no tiene una suscripción que ajustar.':
    'The "vitalicio" (lifetime) plan is a one-time payment: it has no subscription to adjust.',
  'Falta STRIPE_WEBHOOK_SECRET: no se puede verificar el webhook.':
    "Missing STRIPE_WEBHOOK_SECRET: the webhook can't be verified.",

  // --- clima ---
  'No se pudieron obtener las coordenadas del destino. Edítalo y agrega su ubicación.':
    "We couldn't get the destination's coordinates. Edit it and add its location.",
  'La API key de OpenWeatherMap es inválida.': 'The OpenWeatherMap API key is invalid.',
  'Se agotó la cuota diaria de OpenWeatherMap.': "The OpenWeatherMap daily quota has run out.",
  'OpenWeatherMap tardó demasiado en responder.': 'OpenWeatherMap took too long to respond.',

  // --- viajes / clientes / gastos ---
  'Viaje no encontrado.': 'Trip not found.',
  'Cliente no encontrado.': 'Client not found.',
  'Solo quien creó el viaje puede eliminarlo.': 'Only whoever created the trip can delete it.',
  'Gasto no encontrado.': 'Expense not found.',

  // --- itinerario ---
  'Día no encontrado en el itinerario.': 'Day not found in the itinerary.',
  'Actividad no encontrada.': 'Activity not found.',
  'Este viaje ya tiene un itinerario. Envía force:true para regenerarlo (se perderá el actual).':
    'This trip already has an itinerary. Send force:true to regenerate it (the current one will be lost).',
  'Este viaje ya tiene un itinerario.': 'This trip already has an itinerary.',
  'Este viaje todavia no tiene itinerario.': "This trip doesn't have an itinerary yet.",
  'Este viaje no tiene itinerario.': "This trip doesn't have an itinerary.",
  'Este viaje no tiene itinerario que convertir en plantilla.': "This trip doesn't have an itinerary to turn into a template.",
  'No puedes quedarte sin días. Elimina el itinerario completo.': "You can't be left with no days. Delete the whole itinerary instead.",
  'La lista debe contener exactamente los ids de las actividades del día.':
    "The list must contain exactly the ids of the day's activities.",

  // --- publico / invitado ---
  'La fecha de regreso no puede ser anterior a la de salida.': "The return date can't be earlier than the departure date.",
  'Este enlace ya no existe o dejo de compartirse.': 'This link no longer exists or is no longer shared.',
  'El viaje de este itinerario ya no existe.': 'The trip for this itinerary no longer exists.',
  'Esta propuesta ya no se puede aceptar desde aqui.': 'This proposal can no longer be accepted from here.',

  // --- auth ---
  'No pudimos crear la cuenta. Intenta de nuevo.': "We couldn't create the account. Try again.",
  'Ese email ya está registrado.': 'That email is already registered.',
  'Este enlace ya no sirve. Pide uno nuevo desde el aviso en la app.':
    'This link no longer works. Request a new one from the notice in the app.',
  'Email o contraseña incorrectos.': 'Incorrect email or password.',
  'Este enlace ya no sirve. Pide uno nuevo y ábrelo antes de que caduque.':
    'This link no longer works. Request a new one and open it before it expires.',
  'La contraseña actual no es correcta.': 'The current password is incorrect.',
  'La cuenta ya no existe.': 'The account no longer exists.',
  'La contraseña no es correcta.': 'The password is incorrect.',
  'La cuenta de demostración no se puede eliminar: la usan otras personas para probar la app.':
    'The demo account cannot be deleted: other people use it to try the app.',
  'Falta el token de acceso.': 'Missing access token.',
  'Tu sesión expiró, inicia sesión de nuevo.': 'Your session expired, log in again.',
  'Token inválido.': 'Invalid token.',
  'El usuario del token ya no existe.': "The token's user no longer exists.",
  'Tu contraseña cambió. Inicia sesión de nuevo.': 'Your password changed. Log in again.',
  'Verifica tu correo antes de continuar: revisa tu bandeja de entrada (o spam) y pulsa el enlace que te mandamos al crear tu cuenta.':
    "Verify your email before continuing: check your inbox (or spam) and click the link we sent you when you created your account.",

  // --- billing congelado ---
  'El periodo de prueba gratuita de tu agencia ha concluido. Tus viajes siguen guardados, pero necesitas activar un plan para crear o editar contenido.':
    "Your agency's free trial has ended. Your trips are still saved, but you need to activate a plan to create or edit content.",
  'La suscripción de tu agencia no está activa. Tus viajes siguen ahí, pero no puedes crear ni editar nada hasta que se active un plan.':
    "Your agency's subscription isn't active. Your trips are still there, but you can't create or edit anything until a plan is activated.",

  // --- validaciones genericas ---
  'Datos invalidos.': 'Invalid data.',
  'Datos inválidos.': 'Invalid data.',

  // --- upload de logo ---
  'No pudimos verificar que eres una persona. Intenta de nuevo.': "We couldn't verify you're a person. Try again.",
  'El logo debe ser PNG, JPEG o WebP.': 'The logo must be PNG, JPEG, or WebP.',
  'No se recibió ningún archivo.': 'No file was received.',
  'El logo pesa demasiado. El máximo es 2 MB.': 'The logo is too large. The maximum is 2 MB.',
  'No se pudo leer el archivo.': "We couldn't read the file.",
  'Subir logos no esta configurado. Agrega las claves de Cloudinary en el .env del servidor.':
    "Logo uploads aren't configured. Add the Cloudinary keys to the server's .env.",
  'No se pudo subir el logo. Intenta de nuevo en un momento.': "We couldn't upload the logo. Try again in a moment.",

  // --- gemini (itinerario) ---
  'La generación con IA no está configurada. Agrega GEMINI_API_KEY en el .env del servidor.':
    "AI generation isn't configured. Add GEMINI_API_KEY to the server's .env.",
  'La API key de Gemini es inválida o no tiene permisos. Revisa GEMINI_API_KEY donde esté desplegado el servidor.':
    'The Gemini API key is invalid or lacks permissions. Check GEMINI_API_KEY wherever the server is deployed.',
  'La cuota de la API de Gemini se agotó por ahora. Intenta en unos minutos.':
    'The Gemini API quota has run out for now. Try again in a few minutes.',
  'El modelo de Gemini está saturado en este momento. Vuelve a intentar en un minuto.':
    'The Gemini model is overloaded right now. Try again in a minute.',
  'Gemini tuvo un problema técnico al generar el itinerario. Intenta de nuevo en unos minutos.':
    'Gemini had a technical problem generating the itinerary. Try again in a few minutes.',
  'Gemini bloqueó la respuesta por filtros de contenido. Prueba con otras notas.':
    'Gemini blocked the response due to content filters. Try different notes.',
  'Gemini devolvió una respuesta vacía.': 'Gemini returned an empty response.',
  'Gemini devolvió un JSON malformado.': 'Gemini returned malformed JSON.',
  'Gemini no generó ningún día de itinerario.': "Gemini didn't generate any itinerary days.",
  'Gemini tardó demasiado en responder. Intenta de nuevo.': 'Gemini took too long to respond. Try again.',

  // --- gemini (chat asistente) ---
  'El chat con IA no está configurado. Agrega GEMINI_API_KEY en el .env del servidor.':
    "The AI chat isn't configured. Add GEMINI_API_KEY to the server's .env.",
  'El asistente está saturado en este momento. Vuelve a intentar en un minuto.':
    'The assistant is overloaded right now. Try again in a minute.',
  'El asistente tuvo un problema técnico. Intenta de nuevo en unos minutos.':
    'The assistant had a technical problem. Try again in a few minutes.',
  'El asistente bloqueó la respuesta por filtros de contenido. Prueba reformular la pregunta.':
    'The assistant blocked the response due to content filters. Try rephrasing the question.',
  'El asistente devolvió una respuesta vacía.': 'The assistant returned an empty response.',
  'El asistente tardó demasiado en responder. Intenta de nuevo.': 'The assistant took too long to respond. Try again.',

  // --- errorHandler / genericos ---
  'Error interno del servidor.': 'Internal server error.',
  'No tienes permiso sobre este recurso.': "You don't have permission for this resource.",
  'No autenticado.': 'Not authenticated.',
  'Recurso no encontrado.': 'Resource not found.',
  'Conflicto con el estado actual.': 'Conflict with the current state.',
  'Demasiadas peticiones.': 'Too many requests.',
  'Servicio externo no disponible.': 'External service unavailable.',
  'Petición inválida.': 'Invalid request.',

  // --- validators/schemas.js (Zod) ---
  'Al menos 1 viajero.': 'At least 1 traveler.',
  'Color inválido, usa formato hexadecimal como #1F6F5C.': 'Invalid color, use hex format like #1F6F5C.',
  'Debe ser un número entero.': 'Must be a whole number.',
  'Debe ser un número.': 'Must be a number.',
  'Describe el gasto.': 'Describe the expense.',
  'El enlace no es válido.': 'The link is not valid.',
  'El nombre debe tener al menos 2 caracteres.': 'The name must have at least 2 characters.',
  'El nombre del cliente es obligatorio.': "The client's name is required.",
  'El nombre del lugar es obligatorio.': "The place's name is required.",
  'El nombre no puede quedar vacío.': "The name can't be empty.",
  'El nombre es obligatorio.': 'The name is required.',
  'El email es obligatorio.': 'Email is required.',
  'La contraseña es obligatoria.': 'Password is required.',
  'Email inválido.': 'Invalid email.',
  'Envía al menos un id.': 'Send at least one id.',
  'Escribe a dónde quieres ir.': 'Write where you want to go.',
  'Escribe al menos 2 caracteres.': 'Write at least 2 characters.',
  'Escribe cuántas noches.': 'Enter how many nights.',
  'Escribe cuántas personas viajan.': 'Enter how many people are traveling.',
  'Escribe cuántos viajan.': 'Enter how many are traveling.',
  'Escribe el código de invitación.': 'Enter the invite code.',
  'Escribe tu contraseña para confirmar.': 'Enter your password to confirm.',
  'Escribe un mensaje.': 'Write a message.',
  'Escribe un monto válido.': 'Enter a valid amount.',
  'Ese número es demasiado grande.': "That number is too large.",
  'Fecha inválida.': 'Invalid date.',
  'Identificador inválido.': 'Invalid identifier.',
  'Ingresa tu contraseña actual.': 'Enter your current password.',
  'La actividad necesita un titulo.': 'The activity needs a title.',
  'La contraseña debe tener al menos 8 caracteres.': 'The password must have at least 8 characters.',
  'La duración debe ser un número.': 'The duration must be a number.',
  'La fecha de salida de la parada no puede ser anterior a la de llegada.':
    "A stop's departure date can't be earlier than its arrival date.",
  'La hora debe tener formato HH:mm.': 'The time must be in HH:mm format.',
  'La nueva contraseña debe tener al menos 8 caracteres.': 'The new password must have at least 8 characters.',
  'Las fechas de cada parada deben caer dentro de las fechas del viaje.':
    "Each stop's dates must fall within the trip's dates.",
  'Latitud inválida.': 'Invalid latitude.',
  'Longitud inválida.': 'Invalid longitude.',
  'Máximo 2000 caracteres.': 'Maximum 2000 characters.',
  'Máximo 24 horas.': 'Maximum 24 hours.',
  'Máximo 30 viajeros.': 'Maximum 30 travelers.',
  'Máximo 365 noches.': 'Maximum 365 nights.',
  'Máximo 72 caracteres.': 'Maximum 72 characters.',
  'Máximo 5 estilos de viaje.': 'Maximum 5 travel styles.',
  'No enviaste ningún campo a actualizar.': "You didn't send any field to update.",
  'No puede ser negativa.': "It can't be negative.",
  'No puede ser negativo.': "It can't be negative.",
  'Número de día inválido.': 'Invalid day number.',
  'Ponle un nombre a la agencia.': 'Give the agency a name.',
  'Ponle un nombre a la plantilla.': 'Give the template a name.',
  'Ponle un título al viaje.': 'Give the trip a title.',
  'Posición inválida.': 'Invalid position.',
  'URL inválida.': 'Invalid URL.',
  'Usa el código de 3 letras, ej. MXN.': 'Use the 3-letter code, e.g. MXN.',
  'Índice inválido.': 'Invalid index.',
  'El destino necesita al menos un nombre.': 'The destination needs at least one name.',
};

const DINAMICOS = [
  {
    re: /^No se encontró el lugar "(.*)"\.$/,
    en: (m) => `We couldn't find the place "${m[1]}".`,
  },
  {
    re: /^Ya tienes (\d+) agente\(s\) en la agencia; no puedes bajar el cupo por debajo de eso\. Saca agentes primero\.$/,
    en: (m) => `You already have ${m[1]} agent(s) in the agency; you can't lower the seat count below that. Remove agents first.`,
  },
  {
    re: /^Esta agencia ya llegó a su límite de (\d+) agente\(s\)\. El dueño puede sumar más asientos desde su plan\.$/,
    en: (m) => `This agency already reached its limit of ${m[1]} agent(s). The owner can add more seats from their plan.`,
  },
  {
    re: /^Llegaste al límite de (\d+) mensajes al chat este mes en el plan personal\. Vuelve el próximo mes, o crea una agencia si necesitas más\.$/,
    en: (m) => `You reached the limit of ${m[1]} chat messages this month on the personal plan. Come back next month, or create an agency if you need more.`,
  },
  {
    re: /^Llegaste al límite de (\d+) itinerarios generados con IA este mes en el plan personal\. Vuelve el próximo mes, o crea una agencia si necesitas más\.$/,
    en: (m) => `You reached the limit of ${m[1]} AI-generated itineraries this month on the personal plan. Come back next month, or create an agency if you need more.`,
  },
  {
    re: /^Por ahora la IA genera itinerarios de máximo (\d+) días\.$/,
    en: (m) => `For now the AI generates itineraries of up to ${m[1]} days.`,
  },
  {
    re: /^El itinerario no tiene un día (\d+)\.$/,
    en: (m) => `The itinerary doesn't have a day ${m[1]}.`,
  },
  {
    re: /^Sin cuenta se pueden probar viajes de hasta (\d+) días\. Crea una cuenta gratis para planear viajes más largos\.$/,
    en: (m) => `Without an account you can try trips of up to ${m[1]} days. Create a free account to plan longer trips.`,
  },
  {
    re: /^Demasiados intentos fallidos\. Espera (\d+) minuto\(s\) e intenta de nuevo\.$/,
    en: (m) => `Too many failed attempts. Wait ${m[1]} minute(s) and try again.`,
  },
  {
    re: /^Plan "(.*)" no existe\.$/,
    en: (m) => `Plan "${m[1]}" doesn't exist.`,
  },
  {
    re: /^El plan "(.*)" no esta disponible en (.*)\.$/,
    en: (m) => `The plan "${m[1]}" isn't available in ${m[2]}.`,
  },
  {
    re: /^El plan "(.*)" no tiene sus Price de Stripe \((.*)\) configurados\. Corre "npm run stripe:setup" en server\/ y copia las variables al \.env\.$/,
    en: (m) => `The plan "${m[1]}" doesn't have its Stripe Prices (${m[2]}) configured. Run "npm run stripe:setup" in server/ and copy the variables to the .env.`,
  },
  {
    re: /^Stripe rechazó "(.*)": (.*)$/,
    en: (m) => `Stripe rejected "${m[1]}": ${m[2]}`,
  },
  {
    re: /^Stripe rechazó la solicitud: (.*)$/,
    en: (m) => `Stripe rejected the request: ${m[1]}`,
  },
  {
    re: /^OpenWeatherMap respondió (\d+)\.$/,
    en: (m) => `OpenWeatherMap responded ${m[1]}.`,
  },
  {
    re: /^No se pudo contactar a OpenWeatherMap: (.*)$/,
    en: (m) => `Couldn't reach OpenWeatherMap: ${m[1]}`,
  },
  {
    re: /^El modelo "(.*)" no está disponible para esta API key\. Cambia GEMINI_MODEL en el \.env del servidor\.$/,
    en: (m) => `The model "${m[1]}" isn't available for this API key. Change GEMINI_MODEL in the server's .env.`,
  },
  {
    re: /^Gemini respondió (\d+)\.$/,
    en: (m) => `Gemini responded ${m[1]}.`,
  },
  {
    re: /^No se pudo contactar a Gemini: (.*)$/,
    en: (m) => `Couldn't reach Gemini: ${m[1]}`,
  },
  {
    re: /^No se pudo contactar al asistente: (.*)$/,
    en: (m) => `Couldn't reach the assistant: ${m[1]}`,
  },
  {
    re: /^Tu agencia llegó al límite de (\d+) (mensajes al chat|itinerarios generados con IA) este mes en su plan\. Sube de plan para generar más\.$/,
    en: (m) =>
      `Your agency reached the limit of ${m[1]} ${
        m[2] === 'mensajes al chat' ? 'chat messages' : 'AI-generated itineraries'
      } this month on its plan. Upgrade your plan to generate more.`,
  },
  {
    re: /^Ruta no encontrada: (.*)$/,
    en: (m) => `Route not found: ${m[1]}`,
  },
  {
    re: /^Identificador inválido para el campo "(.*)"\.$/,
    en: (m) => `Invalid identifier for field "${m[1]}".`,
  },
  {
    re: /^Valor duplicado en "(.*)"\.$/,
    en: (m) => `Duplicate value for "${m[1]}".`,
  },
];

/**
 * Traduce `mensaje` al inglés si `idioma === 'en'` y hay una regla que lo
 * cubra. En cualquier otro caso (español, o inglés sin regla conocida) se
 * devuelve tal cual: nunca se inventa una traducción parcial.
 */
export function traducirMensaje(mensaje, idioma) {
  if (idioma !== 'en' || typeof mensaje !== 'string' || !mensaje) return mensaje;
  if (Object.prototype.hasOwnProperty.call(EXACTOS, mensaje)) return EXACTOS[mensaje];
  for (const { re, en } of DINAMICOS) {
    const m = mensaje.match(re);
    if (m) return en(m);
  }
  return mensaje;
}

export default traducirMensaje;
