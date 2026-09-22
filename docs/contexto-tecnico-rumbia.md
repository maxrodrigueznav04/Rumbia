# Contexto Técnico de Rumbia

> **Documento de referencia técnica para agentes de IA y desarrolladores senior.**  
> **Fecha de auditoría:** 21 de septiembre de 2026  
> **Rama analizada:** `main`  
> **Commit analizado:** `43c18b0` (tras merge de PR #124)

---

## 1. Arquitectura General

* **Frontend:** Single Page Application (SPA) desarrollada con **React 18.3.1** y empaquetada mediante **Vite 8.2.2**. Utiliza **React Router 7.18.3** para la navegación del lado del cliente, **Leaflet 1.9.4** con React-Leaflet para mapas interactivos vectoriales, y **Recharts 2.12.7** para visualizaciones de presupuestos. El diseño visual se basa en variables CSS nativas sin frameworks utilitarios pesados, con soporte de modo claro/oscuro persistente y estilos de impresión (`@media print`) para generación de PDFs vectoriales con marca blanca en el navegador.
* **Backend:** API REST construida sobre **Node.js >= 18** (formato ES Modules nativo) utilizando **Express 4.19.2**. Implementa compresión (`compression`), cabeceras HTTP de seguridad (`helmet`), análisis de cookies (`cookie-parser`), registro de peticiones (`morgan`) y validación estricta de esquemas de datos en el borde de la API mediante **Zod 3.23.8**.
* **Base de Datos:** **MongoDB** gestionado a través de **Mongoose 8.6.0** (alojado en MongoDB Atlas). Esquemas estrictamente tipados, hooks de ciclo de vida (`pre-save`, `pre-validate`) y claves compuestas para garantizar aislamiento multi-tenant.
* **Autenticación:** Híbrida basada en credenciales locales. Las contraseñas se hashean mediante **bcryptjs** con factor de coste de 12 rondas. La sesión autenticada se emite como un **JWT** (firmado con HMAC-SHA256, expiración configurable por defecto a 7 días) almacenado en una **cookie `httpOnly`, `SameSite=Lax`**, con soporte de cabecera `Authorization: Bearer <token>` para compatibilidad y la cabecera `x-expected-user` para evitar colisiones entre pestañas concurrentes.
* **Despliegue:**
  * *Frontend:* Compilado a directorio estático `dist/` y desplegado globalmente en **Cloudflare Pages** mediante Wrangler (`https://rumbiamx.com`).
  * *Backend:* Desplegado como servicio web en **Render** (`rumbo-api`). El plan gratuito suspende la instancia tras 15 minutos sin tráfico; para mitigarlo, opera un cron job externo que envía pings cada 10 minutos a `/api/health`.
* **CI/CD:** **GitHub Actions** ejecuta validaciones en dos etapas: workflow `CI` (pruebas de backend con Node 22 y suite de frontend con build) y workflow `Deploy cliente a Cloudflare` (disparado automáticamente por `workflow_run` tras la aprobación exitosa de CI en `main`).
* **Servicios Externos Integrados:** Google Gemini API, Stripe, Resend, Cloudinary, OpenWeatherMap, Frankfurter (Banco Central Europeo), Photon (Komoot/OSM), Sentry y Cloudflare Turnstile.

---

## 2. Estructura Importante del Repositorio

```text
/ (raíz)
├── .github/workflows/
│   ├── ci.yml                     # Pipeline CI: pruebas backend/frontend y build Vite
│   ├── deploy-client.yml          # Despliegue a Cloudflare Pages dependiente de CI
│   └── mongo-backup.yml           # Respaldo periódico automatizado de base de datos
├── client/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js          # Fetch wrapper central, interceptores, timeout IA (180s)
│   │   │   └── index.js           # Módulos de endpoints (trips, auth, itinerary, agency, etc.)
│   │   ├── components/
│   │   │   ├── formularios/       # Modales de transporte, hospedaje, actividades y viaje
│   │   │   ├── HojaImpresion.jsx  # Layout del PDF de marca blanca (@media print)
│   │   │   ├── TarjetaAgencia.jsx # Panel maestro de planes, membresías y branding
│   │   │   ├── ChatFlotante.jsx   # Widget conversacional de IA para el asesor
│   │   │   └── LimiteDeError.jsx  # Error Boundary con reporte a Sentry
│   │   ├── context/
│   │   │   └── AuthContext.jsx    # Estado de sesión y sincronización inter-pestañas
│   │   ├── pages/                 # Rutas SPA (Inicio, Probar, Dashboard, Detalle, Itinerario, etc.)
│   │   ├── styles/global.css      # Sistema de diseño, variables CSS y temas
│   │   ├── App.jsx                # Definición de rutas públicas, protegidas y layouts
│   │   └── main.jsx               # Entry point e inicialización de Sentry
│   ├── package.json
│   └── vite.config.js
├── docs/                          # Memoria corporativa, estrategia y auditorías
├── server/
│   ├── scripts/
│   │   ├── smoke-test.mjs         # Suite integral de pruebas (103+ checks sin DB activa)
│   │   ├── stripe-setup.mjs       # Provisionamiento de productos y precios en Stripe
│   │   └── seed.js                # Semillas de datos para desarrollo y pruebas
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js              # Conexión y desconexión controlada de Mongoose
│   │   │   ├── env.js             # Validación y parseo de variables de entorno
│   │   │   └── sentry.js          # Inicialización y captura de excepciones en Node
│   │   ├── controllers/           # Controladores de dominio (auth, trip, itinerary, billing...)
│   │   ├── middleware/
│   │   │   ├── auth.js            # Extracción de JWT, protección de rutas e identidad
│   │   │   ├── billing.js         # soloLecturaSiCongelada: guardián de acceso a agencias
│   │   │   ├── errorHandler.js    # Manejador centralizado de excepciones (ApiError)
│   │   │   ├── rateLimiters.js    # Limitadores de peticiones por IP y usuario
│   │   │   └── validate.js        # Middleware de validación con Zod
│   │   ├── models/                # Modelos de datos Mongoose (User, Agency, Trip, etc.)
│   │   ├── routes/                # Enrutadores Express por dominio
│   │   ├── services/              # Integraciones externas (gemini, stripe, email, etc.)
│   │   ├── validators/schemas.js  # Esquemas canónicos de Zod para toda la API
│   │   ├── app.js                 # Configuración de Express, CORS y middleware global
│   │   └── server.js              # Arranque HTTP, timeouts y graceful shutdown
│   └── package.json
└── render.yaml                    # Blueprint de infraestructura en Render
```

---

## 3. Modelos Principales de Datos

### `User` (`server/src/models/User.js`)
* **Propósito:** Representa la cuenta individual de un usuario (viajero o asesor).
* **Relaciones:** `agency` (ObjectId ref `Agency`, opcional).
* **Campos relevantes:** `name`, `email` (único, lowercase), `password` (hasheado, `select: false`), `role` (`'dueño'` | `'agente'`), `emailVerified` (booleano), `verificationTokenHash` (SHA-256), `resetPasswordTokenHash` (SHA-256, vence en 30 min), `branding` (logo, nombre, contacto, color de acento personal), `usoIA` (`mes`, `generaciones`, `mensajesChat`).
* **Reglas:**
  * Si el usuario se une a una agencia, su branding personal queda inactivo pero preservado; prevalece el branding de la agencia.
  * Los contadores de `usoIA` personal quedan exentos si el usuario pertenece a una agencia activa.

### `Agency` (`server/src/models/Agency.js`)
* **Propósito:** Entidad de equipo y marca compartida entre múltiples asesores.
* **Relaciones:** `owner` (ObjectId ref `User`), los miembros apuntan a la agencia desde `User.agency`.
* **Campos relevantes:** `agencyName`, `logoUrl`, `contact`, `colorAcento`, `fuentePdf`, `densidadPdf`, `fondoPdf`, `inviteCode` (token hex de 32 caracteres), `billing` (subdocumento con `stripeCustomerId`, `stripeSubscriptionId`, `plan`, `moneda`, `status`, `extraAgentes`, `trialHasta`, `usoIA`, `ultimoEventoStripeEn`, `cancelaAlFinalizarPeriodo`).
* **Reglas y Virtuals:**
  * `esTrialActivo`: `billing.status === 'trial'` y `trialHasta > Date.now()`.
  * `tieneAccesoActivo`: `billing.status === 'activa' || esTrialActivo`.
  * `marcaBlanca`: Habilitado para planes `agencia_*`, `pro_*` o mientras `esTrialActivo` sea verdadero.
  * `capacidadAgentes`: 3 asientos (Inicio/default), 8 (Agencia), 15+ (Pro), más `extraAgentes`.
  * Cupos mensuales de IA por plan: Inicio (25 itinerarios / 60 chats), Agencia (150 itinerarios / chat ilimitado), Pro (500 itinerarios / chat ilimitado).

### `Trip` (`server/src/models/Trip.js`)
* **Propósito:** Entidad central de planificación y cotización de un viaje.
* **Relaciones:** `user` (ObjectId ref `User`), `agency` (ObjectId ref `Agency`, opcional), `client` (ObjectId ref `Client`, opcional).
* **Campos relevantes:** `title`, `destination`, `additionalDestinations` (paradas intermedias con fechas), `startDate`, `endDate`, `durationDays`, `travelers`, `budget` (monto y moneda), `status` (`borrador`, `planeado`, `en curso`, `finalizado`, `cancelado`), `estadoPropuesta` (`borrador`, `enviada`, `aprobada`, `rechazada`), `transport` (ida/vuelta con `mode`, `provider`, `cost`, `bookingRef`, `externalUrl`, `notes`), `lodging` (arreglo de hospedajes), `localTransport` (movilidad en destino), `coreCosts` (suma de transportes y hospedajes), `margen` (`tipo`: `fijo`|`porcentaje`, `monto`), `ocultarDesglose` (`default: true` para nuevas propuestas; los documentos históricos con `ocultarDesglose: false` conservan intacto su valor), `ocultarCodigos` (`default: true`), `shareToken` (token público revocable), `grupoPropuesta` (ancla de versiones duplicadas A/B).
* **Reglas:**
  * Validado en `pre-validate`: las fechas de paradas adicionales deben caer dentro del rango del viaje.
  * `findOwnedTrip`: Un viaje con `agency` asignada solo puede ser leído/editado por miembros activos de esa agencia; un viaje personal (`agency: null`) solo por su autor.
  * Privacidad por defecto: Todo viaje nuevo se crea con `ocultarDesglose: true` y `ocultarCodigos: true`. Los registros existentes conservan su configuración previa sin migraciones destructivas.

### `Itinerary` (`server/src/models/Itinerary.js`)
* **Propósito:** Cronograma de actividades diarias detalladas.
* **Relaciones:** `trip` (ObjectId ref `Trip`, índice único 1 a 1), `user` (ObjectId ref `User`).
* **Campos relevantes:** `days` (arreglo de días con `dayNumber`, `date`, `title`, `summary`, y `activities` que contienen `time`, `title`, `description`, `category`, `location`, `estimatedCost`, `durationMinutes`, `bookingUrl`), `generatedBy` (`'ia'` | `'manual'`), `model` (identificador del modelo de Gemini).

### `Client` (`server/src/models/Client.js`)
* **Propósito:** CRM de clientes y prospectos para agencias y asesores.
* **Relaciones:** `user` (ObjectId ref `User`), `agency` (ObjectId ref `Agency`, opcional).
* **Campos relevantes:** `nombre`, `email`, `telefono`, `notas`, `etiquetas`, `origen`.
* **Reglas:** Si pertenece a una agencia, la cartera se comparte con los compañeros; si no tiene agencia (`agency: null`), solo el usuario creador tiene acceso.

### `ItineraryTemplate` (`server/src/models/ItineraryTemplate.js`)
* **Propósito:** Banco de plantillas de itinerarios reutilizables.
* **Relaciones:** `user` (creador), `agency` (agencia compartida).

### `TripChat` (`server/src/models/TripChat.js`)
* **Propósito:** Historial persistente del asistente conversacional de IA por viaje o en modo general.
* **Campos:** `messages` (arreglo de `{ role: 'user'|'model', text, timestamp }`). Limitado en controlador a los últimos 100 mensajes por viaje.

### `StripeEvent` (`server/src/models/StripeEvent.js`)
* **Propósito:** Registro de auditoría e idempotencia para eventos de webhook de Stripe.
* **Campos:** `eventId` (único, indexado), `type`, `created`, `processedAt`.

### `AuditLog` (`server/src/models/AuditLog.js`)
* **Propósito:** Registro inmutable de acciones administrativas sensibles de la agencia (expulsión de miembros, regeneración de invitaciones, fallos de Stripe).

---

## 4. Controladores y Servicios Principales

### Controladores (`server/src/controllers/`)
* **`auth.controller.js`:** Registro con verificación de email por token seguro, login con cookie JWT, reseteo de contraseña en dos pasos, rotación de credenciales, subida de avatar/logo personal a Cloudinary y baja de cuenta con cascada de eliminación y cancelación de Stripe.
* **`trip.controller.js`:** CRUD de viajes, filtros por estado operativo y pipeline de ventas, duplicación de viajes para propuestas alternativas (compartiendo `grupoPropuesta`) y cálculo de costos base.
* **`itinerary.controller.js`:** Orquestación de llamadas a Gemini, creación de itinerarios en blanco, actualización de actividades con reordenamiento cronológico (`reordenarPorHora`), drag & drop entre días y exportación a PDF.
* **`agency.controller.js`:** Creación de agencia, actualización de configuraciones visuales (logo, colores, fuentes), generación y rotación de `inviteCode`, incorporación de agentes con validación de capacidad de plan, expulsión de miembros y reporte de productividad del equipo.
* **`billing.controller.js`:** Generación de sesiones de Stripe Checkout, resolución de URL para Customer Portal, y recepción del webhook de Stripe con procesamiento idempotente.
* **`client.controller.js`:** CRUD del CRM de clientes con filtros sanitizados (`escaparRegex`) y agregación de conteo de viajes vinculados por cliente.
* **`chat.controller.js`:** Manejo de mensajes hacia el asistente de IA, inyección del contexto resumido del viaje y verificación de cupos mensuales.
* **`public.controller.js`:** Exposición de itinerarios compartidos (`/i/:token`), filtrado estricto de privacidad (precios y códigos de reserva), aceptación formal de propuestas por clientes y tracking anónimo de clics.
* **`templates.controller.js`:** Guardado de un viaje como plantilla y aplicación de plantillas a nuevos viajes.
* **`expense.controller.js`:** Gestión de gastos ejecutados asociados a un viaje.
* **`weather.controller.js`:** Endpoint para consulta del clima del destino.

### Servicios (`server/src/services/`)
* **`gemini.service.js`:** Cliente HTTP para Google Gemini API (v1beta). Fuerza salida JSON estructurada con `responseSchema` (`ITINERARY_SCHEMA`), gestiona la cadena de respaldo (`gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-flash-latest`), geocodifica actividades y maneja abortos defensivos con timeout de 150s.
* **`chat.service.js`:** Genera las instrucciones de sistema (`buildSystemInstruction`) sintetizando destino, paradas, hoteles, presupuesto y transporte del viaje para el asistente interactivo.
* **`stripe.service.js`:** Wrapper sobre el SDK oficial de Stripe. Crea sesiones de Checkout con precios en MXN o USD, resuelve planes desde suscripciones y genera enlaces al portal de clientes.
* **`bookingLinks.service.js` & `affiliates.service.js`:** Construcción de enlaces de búsqueda prellenados a proveedores y decoración opcional con IDs de afiliado (vía parámetros o wrappers de redirección).
* **`weather.service.js`:** Consulta meteorológica a OpenWeatherMap con resolución de coordenadas mediante Photon (Komoot/OSM) y modelo climatológico senoidal histórico de respaldo sin API key.
* **`email.service.js`:** Envío de correos transaccionales mediante Resend (verificación de cuentas, restablecimiento de contraseña).
* **`logo.service.js`:** Subida directa y autenticada de imágenes (JPEG, PNG, WebP) hacia Cloudinary.
* **`exchange.service.js`:** Consulta y conversión de tipos de cambio de divisas mediante la API de Frankfurter con caché en memoria.
* **`turnstile.service.js`:** Verificación del token de Cloudflare Turnstile en el backend.

---

## 5. Rutas y API Principales

Todas las rutas privadas requieren autenticación previa vía cookie JWT o Bearer header.

* **Autenticación (`/api/auth`):**
  * `POST /register`: Alta de usuario (con honeypot y Turnstile opcional).
  * `POST /login`: Inicio de sesión (establece cookie `httpOnly`).
  * `POST /logout`: Cierre de sesión y limpieza de cookie.
  * `GET /me`: Consulta de identidad y estado de agencia del usuario actual.
  * `POST /forgot-password` & `POST /reset-password/:token`: Recuperación de contraseña.
  * `GET /verify-email/:token`: Confirmación de dirección de correo.
  * `DELETE /delete-account`: Eliminación definitiva de cuenta y datos asociados.
* **Viajes (`/api/trips`):**
  * `GET /`: Lista de viajes (filtros: `status`, `estadoPropuesta`, `atencion`, `q`, paginación).
  * `POST /`: Creación de nuevo viaje.
  * `GET /:id` & `PATCH /:id` & `DELETE /:id`: Detalle, edición y borrado de viaje.
  * `POST /:id/duplicate`: Duplicación de viaje para propuestas alternativas.
  * `POST /:id/itinerary/share` & `DELETE /:id/itinerary/share`: Generación y revocación de token público.
* **Itinerarios (`/api/trips/:id/itinerary`):**
  * `GET /`: Consulta del itinerario asociado al viaje.
  * `POST /generate`: Generación asistida con Gemini (consume cuota de IA).
  * `POST /blank`: Creación de estructura de itinerario vacía para edición manual.
  * `PATCH /days/:diaId/activities/:actId`: Edición de actividad individual (reordena por hora).
  * `POST /days/:diaId/move-activity`: Mover actividades entre días (drag & drop).
* **Agencia (`/api/agency`):**
  * `GET /mi-agencia`: Datos de la agencia, branding y límites de plan.
  * `POST /crear`: Creación de nueva agencia (inicia trial de 14 días).
  * `PATCH /branding`: Actualización de logo, colores, fuentes y fondos de PDF.
  * `POST /unirse`: Incorporación de un agente mediante `inviteCode`.
  * `POST /regenerar-codigo`: Rotación del código de invitación.
  * `DELETE /miembros/:userId`: Expulsión de un agente del equipo.
  * `GET /reporte`: Métricas mensuales de productividad de los asesores.
* **Facturación (`/api/billing`):**
  * `POST /checkout`: Creación de sesión de pago en Stripe para planes de agencia.
  * `POST /portal`: Enlace al Customer Portal de Stripe para gestionar tarjetas o cancelar.
  * `POST /webhook`: Receptor de eventos de Stripe (requiere firma raw).
* **CRM de Clientes (`/api/clients`):**
  * `GET /`: Listado de clientes con buscador y filtros de etiquetas.
  * `POST /`, `PATCH /:id`, `DELETE /:id`: Gestión de fichas de cliente.
* **Asistente Chat (`/api/chat`):**
  * `GET /`: Historial de mensajes (modo general o vinculado a `tripId`).
  * `POST /`: Envío de mensaje al asistente con contexto del viaje.
* **Rutas Públicas (`/api/public`):**
  * `GET /itinerary/:token`: Vista del itinerario compartido (aplica filtros de privacidad).
  * `POST /itinerary/:token/aceptar`: Aceptación formal de la propuesta por el viajero.
  * `POST /itinerary`: Generador de itinerarios de prueba sin cuenta (máximo 7 días).
  * `POST /click`: Registro anónimo de clic hacia proveedores externos.

---

## 6. Frontend: Estructura, Estado y Conexión

### 6.1. Organización y Pantallas
* **Vistas Públicas:** `Inicio.jsx` (hero y resumen de beneficios), `Probar.jsx` (generador interactivo de demostración), `Acerca.jsx` (comparativa detallada de planes y simulador de cotización).
* **Vistas Autenticadas:**
  * `Dashboard.jsx`: Lista de viajes con tarjetas que resumen presupuesto, fechas y estado comercial.
  * `NuevoViaje.jsx`: Asistente para crear viajes con destino principal, paradas, fechas y cliente.
  * `DetalleViaje.jsx`: Gestión centralizada de logística (vuelos, hoteles, autos), enlaces de reserva y mapa.
  * `Itinerario.jsx`: Interfaz de trabajo día por día con soporte de arrastrar y soltar, generación por IA y modal de exportación en PDF.
  * `Clientes.jsx`: Directorio CRM con búsqueda de prospectos e historial de viajes asociados.
  * `Plantillas.jsx`: Biblioteca de itinerarios reutilizables.
  * `Perfil.jsx` / `TarjetaAgencia.jsx`: Configuración personal, marca corporativa, administración de asientos y checkout de Stripe.
* **Vista Pública de Cliente:** `ItinerarioCompartido.jsx`: Pantalla optimizada para móviles que muestra el plan de viaje sin menús de administración, ocultando costos internos y códigos privados según la configuración del asesor.

### 6.2. Flujo de Datos y Conexión con la API
* **`src/api/client.js`:** Abstracción unificada de `fetch`. Maneja automáticamente la inclusión de credenciales (`credentials: 'include'`), decodifica respuestas JSON y traduce errores HTTP a objetos de error enriquecidos (`err.status`, `err.details`).
* **Prevención de colisión de sesiones:** Inyecta automáticamente la cabecera `x-expected-user` en operaciones mutantes (`POST`, `PATCH`, `DELETE`). Si el usuario cambia de cuenta en otra pestaña, el servidor rechaza la petición con código 409 antes de alterar datos ajenos.
* **`src/context/AuthContext.jsx`:** Provee el estado global del usuario actual (`user`, `autenticado`, `cargando`). Escucha eventos de `storage` y `BroadcastChannel` para sincronizar logins y logouts en tiempo real entre múltiples pestañas del navegador.
* **Gestión de Formularios:** El hook `useFormulario` valida entradas en el cliente antes de enviar y mapea los errores devueltos por Zod (`path` y `message`) directamente a los campos correspondientes de la interfaz.

---

## 7. Autorización y Seguridad

* **Manejo de Sesiones y Cookies:**
  * Al autenticarse, el servidor genera una cookie HTTP denominada `token` con banderas `httpOnly`, `SameSite=Lax` y `secure` (en producción). Esto protege la credencial contra ataques XSS.
  * Se mantiene soporte para cabecera `Authorization: Bearer <token>` para clientes que no admiten cookies o integraciones programáticas.
* **Aislamiento Multi-Tenant y Ownership:**
  * Todas las consultas de lectura y escritura en `Trip`, `Client` e `ItineraryTemplate` aplican un filtro de pertenencia estricto basado en `req.user.agency`.
  * Si el usuario tiene agencia, comparte el acceso con sus compañeros de equipo.
  * Si el usuario no tiene agencia (`agency: null`), el filtro exige `user: req.user._id, agency: null`.
  * La vinculación de clientes a viajes verifica en base de datos (`esClientePropio`) que el `clientId` pertenezca legítimamente a la misma cuenta o agencia antes de guardar.
* **Control de Acceso de Agencia (Guardián de Facturación):**
  * El middleware `soloLecturaSiCongelada` intercepta cualquier mutación (`POST`, `PATCH`, `DELETE`) en viajes, itinerarios y gastos. Si la agencia tiene suscripción congelada o el trial venció, bloquea la operación con `403 Forbidden`.
  * *Excepción explícita de seguridad:* Se permite siempre la operación `DELETE /api/trips/:id/itinerary/share` para que una agencia con cuenta congelada pueda revocar el enlace público de un viaje si lo necesita.
* **Defensa contra Denegación de Servicio (ReDoS y Timeouts):**
  * Toda búsqueda por texto libre pasa por la utilidad `escaparRegex` antes de armar patrones en MongoDB.
  * El servidor HTTP define `requestTimeout = 190000` ms (190 segundos), superior al timeout de 150 segundos de Gemini, asegurando que la conexión no sea abortada prematuramente por Node.

---

## 8. Stripe: Flujo Comercial, Webhooks y Robustez (P07)

### 8.1. Ciclo de Suscripción
1. **Checkout (`POST /api/billing/checkout`):**
   * El dueño de la agencia selecciona el plan (Inicio, Agencia o Pro) y la periodicidad (mensual o anual).
   * Se comprueba si ya existe una `checkoutSessionId` abierta no expirada para evitar duplicados por doble clic o múltiples pestañas.
   * Se invoca `stripe.checkout.sessions.create` con `mode: 'subscription'`, asociando el `stripeCustomerId` de la agencia (o creándolo si es la primera compra) y vinculando `agencyId` en los metadatos de la sesión y la suscripción.
2. **Customer Portal (`POST /api/billing/portal`):**
   * Genera un enlace de sesión al portal alojado de Stripe (`stripe.billingPortal.sessions.create`), donde el cliente puede actualizar tarjetas, descargar facturas o programar la cancelación.
3. **Manejo de Asientos Adicionales:**
   * El plan Pro permite agentes adicionales más allá de los 15 incluidos. La modificación actualiza la cantidad del ítem correspondiente en Stripe (`stripe.subscriptions.update`) y ajusta `extraAgentes` en MongoDB.

### 8.2. Webhooks y Corrección de Idempotencia P07 (RESUELTO - PR #124 / commit 43c18b0)
El endpoint `/api/billing/webhook` procesa los eventos firmados de Stripe (`customer.subscription.created`, `updated`, `deleted`, `checkout.session.completed`):
* **Firma Criptográfica:** Valida la cabecera `stripe-signature` contra el cuerpo crudo de la petición (`Buffer`) mediante `stripe.webhooks.constructEvent`.
* **Idempotencia Transaccional (P07 - Resuelto):**
  * Antes de procesar, consulta el modelo `StripeEvent` por `eventId`. Si ya fue procesado, responde inmediatamente `{ received: true, duplicado: true }` con código 200 sin re-ejecutar mutaciones.
  * Si ocurre un fallo intermedio durante la actualización de la agencia en MongoDB, **no se guarda el documento `StripeEvent`**, permitiendo que los reintentos automáticos de Stripe reintenten y completen la operación con éxito.
  * Si dos eventos idénticos llegan en paralelo provocando un error de clave duplicada (código Mongo `11000`), el controlador captura la excepción y responde 200 confirmando recepción sin lanzar error 500.
* **Prevención de Inversión de Estados:**
  * Cada evento compara su fecha de creación (`event.created`) contra `agencia.billing.ultimoEventoStripeEn`. Si llega un evento con timestamp anterior al último aplicado, se ignora para evitar que un webhook atrasado sobreescriba un estado más reciente.
* **Manejo de Cancelación:**
  * Si el usuario programa la cancelación al final del periodo desde el portal, Stripe emite `customer.subscription.updated` con `cancel_at_period_end: true`. La agencia se mantiene activa (`status: 'activa'`) pero marca `cancelaAlFinalizarPeriodo: true`. Al vencer el periodo, `customer.subscription.deleted` transiciona el estado a `'congelada'`.

---

## 9. Periodo de Prueba (Trial) y Corrección P05 (RESUELTO - PR #124 / commit 43c18b0)

* **Comportamiento del Trial:**
  * Toda agencia recién creada recibe automáticamente un periodo de prueba gratuito de **14 días** (`trialHasta` fijado a `Date.now() + 14 días`, `billing.status = 'trial'`).
  * Durante el trial, la agencia tiene acceso completo de escritura (crear y editar viajes, invitar hasta 3 agentes incluidos) gracias al virtual `tieneAccesoActivo` y la actualización de permisos en `agency.controller.js` y `billing.js`.
  * La marca blanca en PDF (`marcaBlanca = true`) está habilitada durante el trial para que la agencia evalúe la personalización completa.
* **Control de Vencimiento:**
  * Al expirar los 14 días, el virtual `esTrialActivo` pasa a `false`. El middleware `soloLecturaSiCongelada` bloquea inmediatamente nuevas creaciones o modificaciones, mostrando un aviso amigable que invita a activar un plan sin borrar los viajes creados.

---

## 10. Privacidad Pública y Sanitización de Propuestas (RESUELTO - PR #124 / commit 43c18b0)

Al consultar un itinerario compartido mediante su token público (`GET /api/public/itinerary/:token`), el servidor construye un DTO sanitizado en backend que **elimina permanentemente los siguientes datos sensibles** antes de responder:

1. **Supresión por `ocultarDesglose` (`true` por defecto para nuevas propuestas):**
   * Por defecto (`ocultarDesglose: true`), se eliminan los costos individuales (`estimatedCost`, `cost`) de transporte, hospedaje y transporte local.
   * **Protección contra Deducción de Margen:** El servidor en backend omite deliberadamente `coreCosts.total` y `itinerary.totalEstimatedCost`. Dado que `precioTotalPorPersona` y `travelers` son públicos, incluir los totales permitiría deducir algebraicamente el margen comercial del asesor restando los costos al precio final. Al omitirlos en backend, el margen queda matemáticamente blindado.
   * **Retrocompatibilidad histórica:** Los documentos históricos previamente creados con `ocultarDesglose: false` conservan intacto su valor, permitiendo a las agencias que expresamente desearon mostrar el desglose a sus viajeros mantener ese comportamiento.
2. **Supresión por `ocultarCodigos` (`true` por defecto):**
   * Oculto por defecto en todos los viajes nuevos. Elimina los campos `bookingRef` (localizadores de reserva de vuelos/hoteles), `externalUrl` (enlaces a portales privados de gestión) y `notes` (instrucciones internas del asesor) de todas las secciones logísticas.
3. **Datos Excluidos Universalmente:**
   * La lista de gastos reales (`Expense`), las notas privadas del viaje (`Trip.notes`), los identificadores de base de datos de usuarios y clientes, y cualquier rastro de la conversación con el asistente de IA (`TripChat`) nunca forman parte de la respuesta pública.

---

## 11. Integración con Inteligencia Artificial (Gemini)

* **Proveedor y Modelos:**
  * Consume la API v1beta de **Google Gemini** vía llamadas HTTPS directas con cabecera `x-goog-api-key`.
  * Modelo base configurable vía `GEMINI_MODEL` en variables de entorno (por defecto `gemini-2.5-flash` o `gemini-flash-latest`), con fallback automático secuencial hacia `gemini-2.5-flash-lite`.
* **Generación de Itinerarios (`itinerary.controller.js` + `gemini.service.js`):**
  * Impone salida JSON estricta mediante `responseSchema` (`ITINERARY_SCHEMA`), garantizando que la respuesta contenga días, actividades numeradas, horarios en formato `HH:mm`, categorías válidas, coordenadas aproximadas y costos referenciales por persona.
  * Construcción de prompt contextualizada: incluye destino, paradas intermedias de viajes multi-ciudad, ritmo (relajado/moderado/intenso), intereses seleccionados y presupuesto aproximado.
* **Asistente de Consulta para el Asesor (`TripChat`):**
  * Proporciona un chat flotante que asesora al agente sobre optimización de rutas, recomendaciones locales o ideas alternativas.
  * Inyecta instrucciones del sistema con el contexto consolidado del viaje (hoteles seleccionados, fechas, transporte) y conserva los últimos 20 turnos de diálogo.
  * La IA tiene prohibido por instrucción modificar directamente la base de datos; orienta al agente indicándole qué pantalla o campo modificar.
* **Control de Cuotas y Límites:**
  * *Uso personal:* Límite de 5 itinerarios y 60 mensajes de chat mensuales por usuario.
  * *Uso agencia:* Contadores centralizados a nivel de agencia (`billing.usoIA`) que aplican los límites mensuales del plan (Inicio: 25 itinerarios / 60 chats; Agencia: 150 itinerarios / chat libre; Pro: 500 itinerarios / chat libre).
  * *Generador público (`/probar`):* Limitado por IP a 3 peticiones por hora mediante `publicAiLimiter`, restringido a viajes de máximo 7 días.

---

## 12. Integraciones Externas

1. **Stripe:** Facturación de suscripciones recurrentes, gestión de métodos de pago en Customer Portal y webhooks criptográficamente verificados.
2. **Google Gemini:** Modelos generativos para estructuración de itinerarios y asistente de planificación.
3. **Resend:** API REST para despacho de correos electrónicos transaccionales de verificación y recuperación de cuenta.
4. **Cloudinary:** Almacenamiento optimizado de imágenes para logotipos de agencias y perfiles, subidos con firmas seguras generadas en el servidor.
5. **OpenWeatherMap:** Consulta meteorológica de pronóstico a 5 días para destinos turísticos.
6. **Photon (Komoot / OpenStreetMap):** Servicio de geocodificación abierto utilizado para autocompletar destinos y obtener coordenadas geográficas (latitud/longitud) sin requerir claves de API comerciales.
7. **Frankfurter (Banco Central Europeo):** Servicio público para consulta de tasas de cambio de divisas internacionales en tiempo real con caché local.
8. **Cloudflare Turnstile:** Reto CAPTCHA invisible opcional integrado en el registro para mitigar la creación automatizada de cuentas bot.
9. **Sentry:** Captura de excepciones en cliente (`@sentry/react`) y servidor (`@sentry/node`), activado automáticamente al proveer el DSN correspondiente.

---

## 13. Testing y Calidad

### Suites y Scripts
* **Backend (`server/`):**
  * `npm test`: Ejecuta `server/scripts/smoke-test.mjs` utilizando el ejecutor nativo de Node.js. Corre **149 checks automatizados** más 4 tests del runner que validan esquemas de Zod, aislamiento multi-tenant, sanitización de expresiones regulares, reglas de negocio de Stripe (idempotencia P07, resolución de planes), estimaciones climáticas y decoradores de afiliados sin depender de una base de datos activa.
  * `node scripts/resilience.test.mjs`: Corre **4 pruebas de resiliencia** (límites de trabajo activo, desconexión de clientes, sanitización de errores 5xx en producción y conservación de detalles de validación 4xx).
  * `npm run test:api`: Pruebas de integración HTTP contra API local en ejecución (`prueba-api.mjs`, `prueba-edicion.mjs`).
  * `npm run test:agencia`: Verificación del flujo de suscripción, membresías y permisos de agencia.
* **Frontend (`client/`):**
  * `npm test`: Ejecuta la suite de **Vitest** con `@testing-library/react` y `jsdom`. Corre **9 archivos / 85 pruebas unitarias** que cubren formateadores de moneda/fecha, cálculos comerciales de cotización, comportamiento de formularios reactivos (`useFormulario`), manejo de errores en `api/client.js` y accesibilidad de componentes UI.
* **Estado Actual:** Todas las suites de pruebas (backend, resiliencia y frontend) pasan limpiamente al 100% en el entorno de desarrollo y en los flujos de GitHub Actions.

---

## 14. CI/CD e Infraestructura de Despliegue

* **`.github/workflows/ci.yml`:**
  * Se activa en cada `push` o `pull_request` sobre la rama `main`.
  * Instala dependencias con `npm ci` bajo Node 22.
  * Ejecuta `npm test` en backend y `npm test` + `npm run build` en frontend.
  * Cancela automáticamente ejecuciones anteriores en progreso ante nuevos commits mediante grupos de concurrencia.
* **`.github/workflows/deploy-client.yml`:**
  * Se dispara mediante el evento `workflow_run` tras la conclusión exitosa de `CI` en `main`.
  * Clona exactamente el commit aprobado (`head_sha`), revalida pruebas y despliega los activos generados a Cloudflare Pages mediante `@cloudflare/wrangler`.
* **Despliegue de Backend (Render):**
  * Gestionado a través del blueprint `render.yaml`.
  * Servicio web `rumbo-api` conectado a la rama `main`, con comando de arranque `npm start` y ruta de comprobación de salud en `/api/health`.

---

## 15. Riesgos Técnicos Conocidos que Siguen Vigentes

1. **Suspensión por Inactividad en Render (Cold Starts):**
   * El servicio backend está configurado en el nivel gratuito de Render. A pesar del cron externo que emite pings periódicos cada 10 minutos, si el servicio externo de ping falla o se reinicia la instancia, el arranque en frío toma entre 50 y 80 segundos, degradando la experiencia inicial.
2. **Almacenamiento de Rate Limits en Memoria de Proceso:**
   * Los limitadores de `express-rate-limit` utilizan almacenamiento en memoria RAM local (`MemoryStore`). Reinicios del servidor o escalado a múltiples instancias reinician los contadores y no comparten el estado de cuotas entre réplicas.
3. **Ausencia de Transacciones Multidocumento en MongoDB:**
   * La eliminación en cascada de cuentas y agencias se ejecuta de forma secuencial (`deleteMany` en cascada). Al no operar dentro de una sesión transaccional con replica set obligatorio, un error no recuperable a mitad del proceso podría dejar registros huérfanos.

---

## 16. Deuda Técnica Relevante

1. **Dualidad de Precios Hardcodeados vs. Stripe:**
   * Los montos visuales y descripciones comerciales de los planes residen en código estático (`TarjetaAgencia.jsx`, `Agency.js`), mientras que los cobros reales dependen de los Price IDs configurados en Stripe. Un cambio de precio en Stripe requiere actualizar manualmente constantes en el código.
2. **Historial de Chat de IA No Paginado:**
   * La colección `TripChat` almacena los mensajes dentro de un arreglo en el mismo documento. Aunque se aplica un recorte defensivo a los últimos 100 mensajes, no existe paginación bajo demanda para conversaciones extensas.
3. **Manejo de Reintentos de Correo Transaccional:**
   * `email.service.js` envía correos a través de Resend de forma síncrona sin un sistema de cola persistente (outbox o BullMQ). Si la API de Resend experimenta una caída temporal, el correo de recuperación o bienvenida no se reintenta automáticamente.

---

## 17. Convenciones y Patrones del Proyecto

* **Módulos ES Nativos:** Todo el backend utiliza sintaxis ESM (`import`/`export`). Se prohíbe el uso de `require()` o `module.exports`.
* **Validación en el Borde con Zod:** Ningún controlador debe confiar en la estructura de `req.body`, `req.query` o `req.params`. Toda entrada debe validarse previamente con `validate(schema)` y consumirse a través de `req.validatedBody`, `req.validatedQuery` o `req.validatedParams`.
* **Manejo de Asincronía:** Todos los handlers de Express deben envolverse con `asyncHandler` para garantizar la captura de promesas rechazadas sin bloques `try/catch` redundantes.
* **Control de Errores Operacionales:** Lanzar siempre instancias de `ApiError` (`ApiError.badRequest`, `ApiError.unauthorized`, `ApiError.forbidden`, `ApiError.notFound`, etc.) con mensajes en español claros para el usuario final.
* **Seguridad Multi-Tenant Obligatoria:** Toda consulta de lectura, modificación o borrado de recursos de viaje o clientes debe incluir el filtro de pertenencia (`filtroPertenenciaTrip` o `filtroPertenencia`).
* **Diseño e Internacionalización:** El frontend utiliza etiquetas accesibles (`aria-label`), variables CSS centralizadas y diccionarios i18n (`src/locales/`) para soporte bilingüe (español/inglés).

---

## 18. Estado de Auditoría

* **Fecha de revisión técnica:** 18 de septiembre de 2026.
* **Rama examinada:** `main`.
* **Commit base:** `c897185` (*Amplia a 14 dias la prueba de agencias nuevas (#121)*).
* **Verificación local:** Se auditaron directamente los 179+ archivos fuente del backend y frontend, verificando el paso de las suites de pruebas automatizadas y la correspondencia entre la documentación de arquitectura y el código ejecutable.
