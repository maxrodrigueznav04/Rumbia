# Rumbia — Planeador de viajes y cotizador para agencias

[![CI](https://github.com/maxrodrigueznav04/rumbia/actions/workflows/ci.yml/badge.svg)](https://github.com/maxrodrigueznav04/rumbia/actions/workflows/ci.yml)

Aplicación web full-stack para planear un viaje completo en un solo lugar: transporte de ida y
vuelta, hospedaje, transporte en el destino, itinerario día por día con asistencia inteligente,
mapa, clima y control de presupuesto. Para agencias y agentes de viaje, además cotiza con margen
y membrete propio, y trae un chat con el asistente para resolver dudas de planeación sin que el
cliente final lo vea.

> **Rumbia no reserva ni cobra nada.** Centraliza la información y estima costos; para reservar te
> manda al sitio del proveedor (Skyscanner, Booking, Airbnb…) con la búsqueda ya prellenada.
> Es una decisión de diseño consciente: reservar de verdad exige acuerdos comerciales con
> aerolíneas y hoteles que un proyecto individual no puede tener.

**Demo en vivo:** <https://rumbiamx.com> — cuenta de prueba `demo@rumbo.app` / `demo1234`

### Mis viajes

Cada tarjeta resume fechas, duración y qué tanto del presupuesto lleva gastado.

![Lista de viajes con su avance de presupuesto](docs/dashboard.png)

### Detalle del viaje

Los tres costos grandes (transporte, hospedaje y transporte en el destino), cada uno con sus
enlaces de salida ya prellenados, más el mapa del destino, el clima y el presupuesto desglosado.

![Detalle de un viaje: costos, enlaces de reserva, mapa, clima y presupuesto](docs/detalle.png)

### Itinerario generado con IA

Día por día, con horario, categoría y costo estimado por actividad. Se puede reordenar, editar y
regenerar; el mapa ubica las actividades que traen coordenadas.

![Itinerario generado con IA, con mapa de actividades](docs/itinerario.png)

### En el teléfono

<img src="docs/movil.png" alt="El detalle del viaje en pantalla de teléfono" width="330">

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite, React Router, Recharts, Leaflet |
| Backend | Node.js + Express 4 |
| Base de datos | MongoDB + Mongoose |
| Autenticación | JWT + bcrypt |
| IA | Google Gemini (salida JSON estructurada vía `responseSchema`) |
| Mapas | Leaflet + OpenStreetMap (sin API key) |
| Clima | OpenWeatherMap (5 días) + estimación climatológica propia para fechas lejanas |
| Divisas | Frankfurter (tasas del Banco Central Europeo, sin API key) |
| Validación | Zod en el borde de la API |
| Cobros | Stripe (Checkout + Customer Portal + webhooks) |

Todo el stack corre en tiers gratuitos, salvo el backend en producción (Render, plan Starter en
vez del gratuito, para evitar el cold-start de cara al lanzamiento público).

---

## Qué hace

- **Cuentas y perfil.** Registro/login con JWT, contraseñas hasheadas con bcrypt (12 rondas), y
  preferencias de viaje (estilos, ritmo, nivel de gasto) que alimentan el prompt de la IA.
- **Viajes.** Alta y edición de destino, fechas, número de viajeros y presupuesto. Dashboard con
  filtros (próximos, pasados, borradores) y buscador por nombre o destino.
- **Los tres gastos grandes**, cada uno con costo capturable y enlaces de salida ya prellenados
  con tus fechas y destino:
  - Transporte de ida/vuelta (avión, autobús, tren, auto propio) → Skyscanner, Google Flights,
    Rome2Rio, Busbud…
  - Hospedaje (hotel, hostal, Airbnb, cabaña) → Booking, Airbnb, Hostelworld. El costo se
    captura como **total de la estancia**, igual que lo cotizan esos sitios, y la tarifa por
    noche se deriva.
  - Transporte en destino (renta de auto, apps, taxi, transporte público) → DiscoverCars, Uber,
    Moovit…
- **Enlaces de afiliado, opcionales.** Los enlaces de reserva se pueden decorar con el
  identificador de una red de afiliados mediante la variable `AFFILIATE_LINKS`, sin tocar
  código. Soporta las dos formas que existen: añadir un parámetro a la URL del proveedor, o
  envolverla en un redirector como el de CJ Affiliate. Mientras la variable no exista, los
  enlaces salen como búsquedas públicas y **la app no dice que gana comisión, porque no la
  gana**. Cuando sí, los enlaces afectados se marcan en pantalla, llevan `rel="sponsored"` y
  aparece la divulgación junto a ellos.
- **Portada pública y generador sin cuenta.** Cualquiera puede armar un itinerario con IA y ver
  los enlaces de reserva sin registrarse; la cuenta se pide solo para guardarlo. Limitado por IP
  y a 7 días por itinerario, porque gasta cuota de Gemini.
- **Modo oscuro.** Claro, oscuro o "seguir al sistema" (default), con un botón en el header que
  cicla entre los tres. Redefine el mismo juego de variables CSS que ya usa toda la interfaz — no
  hubo que tocar ningún componente — y persiste en `localStorage`.
- **Compartir el itinerario.** Enlace público de solo lectura en `/i/:token`, revocable cuando
  quieras. No expone presupuesto, gastos ni datos de la cuenta. También se puede descargar en PDF
  con el mismo membrete de marca propia que el itinerario privado: quien reciba el enlace no ve
  la interfaz de la app, solo el plan de viaje.
- **Recuperación de contraseña por correo.** Enlace de un solo uso que caduca en 30 minutos. En
  la base se guarda el SHA-256 del token, nunca el token: si la base se filtrara, lo que hay ahí
  no sirve para entrar a ninguna cuenta. La respuesta es idéntica exista o no el correo, para que
  la pantalla no se pueda usar como buscador de direcciones registradas. Al restablecer se sellan
  los JWT anteriores, así que quien se hubiera metido pierde la sesión — que es lo único que hace
  útil un restablecimiento. Sin `RESEND_API_KEY` la app sigue en pie y en desarrollo el enlace se
  imprime en la consola del servidor.
- **Verificación de correo al registrarse.** La cuenta queda activa de inmediato (mismo flujo de
  siempre, sin fricción para entrar), pero "sin verificar" hasta confirmar el enlace que se manda
  al correo — caduca en 24 horas, con reenvío desde un aviso permanente en la app. Mientras tanto
  se puede navegar y editar viajes con normalidad; lo que queda bloqueado es lo que cuesta dinero
  real o se presta a abuso con correos desechables: generar con IA, el chat y crear una agencia
  (con su trial gratis de 7 días). Las cuentas de antes de este cambio nacen verificadas por
  default — no es una sorpresa retroactiva para quien ya estaba pagando.
- **Itinerario en PDF, con marca propia.** El botón *Descargar PDF* imprime el plan día por día
  sin la interfaz de la app. Si en el perfil se llena la marca (nombre, logo y contacto), el
  membrete sale con ella en vez de con la de Rumbia, que es lo que necesita quien arma itinerarios
  para terceros. Se resuelve con `@media print` y el diálogo del navegador: sin navegador headless
  en el servidor y con el texto seleccionable de verdad. El logo se sube directo desde el perfil
  (PNG, JPEG o WebP, hasta 2 MB) y se aloja en Cloudinary con una subida firmada desde el servidor
  —la clave secreta nunca llega al navegador—, o se puede pegar la URL de uno ya publicado.
  Los planes Agencia y Agencia Pro suman **marca blanca de verdad**: el pie deja de mencionar a
  Rumbia, y se puede elegir un color de acento propio que reemplaza el verde de Rumbia en toda la
  hoja (insignia, marcadores de día, actividades) — una sola variable CSS (`--marca`) hace que todo
  el documento lo respete, sin tocar reja por reja.
- **Agencias.** Varios agentes, cada uno con su propia cuenta y sus propios viajes, pueden
  compartir la misma marca en el PDF sin compartir contraseña. Quien crea la agencia administra
  el nombre, el logo y el contacto, y comparte un código de invitación fuera de la app (whatsapp,
  correo) para que los demás se unan desde su perfil. Mientras un agente pertenece a una agencia,
  su marca personal queda guardada pero inerte: la de la agencia es la que se imprime.
- **Cobro a agencias, con Stripe.** Crear una agencia es gratis (es solo la marca: nombre, logo,
  contacto), pero usarla —crear o editar viajes— requiere un plan activo desde el primer agente,
  aunque el dueño esté solo. Tres tiers según el tamaño del equipo — **Inicio** (1 a 3 agentes),
  **Agencia** (4 a 8) y **Agencia Pro** (hasta 15, con agentes extra pagados a partir de ahí) —,
  cada uno con precio mensual o anual (`Agency.js`, `capacidadAgentes`); se conservan además tres
  planes legacy (mensual/anual/de por vida) para quien ya estaba suscrito antes de los tiers
  nuevos. `npm run stripe:setup` en `server` crea los Products/Prices en Stripe y devuelve las
  variables listas para pegar en `.env`. Si el plan se vence o se cancela, la agencia no pierde
  nada: se congela en modo de solo lectura (se puede ver todo, no crear ni editar) hasta activarlo
  o reactivarlo. Sin `STRIPE_SECRET_KEY` el resto de la app sigue funcionando igual, simplemente no
  hay forma de cobrar.
- **Chat con el asistente, para el agente.** Widget flotante disponible en toda la app (no en la
  portada, que no requiere sesión). Puede hablar en general o, si hay un viaje abierto, con su
  contexto completo (destino, fechas, hospedajes, itinerario); solo aconseja, nunca escribe de
  vuelta al viaje — si el agente pide un cambio, el chat le dice qué pantalla o campo tocar. El
  cliente final nunca lo ve. Cupo mensual propio (`AI_CHAT_RATE_LIMIT_PER_HOUR` por hora, más alto
  que el de generar itinerarios porque una conversación manda muchos mensajes cortos) e historial
  persistente por viaje o en modo general (`TripChat`).
- **Página "Acerca de" (`/acerca`).** Explica el producto a viajeros y agencias por separado, con
  un simulador interactivo de cotización y comparativa de los tres tiers de precio.
- **Estado "aprobado por el cliente".** Un valor más en el estado del viaje, entre "planeado" y
  "en curso", para que un agente distinga una propuesta que ya armó de una que el cliente ya
  confirmó.
- **Reporte del dueño.** `GET /api/agency/reporte` cuenta cuántos viajes armó cada agente en el mes
  en curso (dueño incluido), ordenado de más a menos activo. Solo lo ve el dueño, mismo criterio
  que la lista de miembros.
- **Auditoría de acciones sensibles.** Sacar a un agente, regenerar el código de invitación, que
  una agencia se elimine (al salir el dueño sin nadie más), o que la cuenta admin se una saltándose
  el plan o el cupo — quedan registrados con quién, cuándo y el detalle (`AuditLog`). El dueño ve
  el registro de su propia agencia (`GET /api/agency/auditoria`); `ADMIN_EMAIL` ve el de todas
  (`GET /api/stats/auditoria`, o `npm run auditoria` en `server`). Se conserva un año.
- **Uso personal, siempre gratis, con un tope razonable.** Sin agencia de por medio (incluye la
  marca personal del PDF, que no requiere crear ninguna agencia), generar itinerarios con IA es
  gratis hasta 5 veces al mes por cuenta — de sobra para viajes propios o de familia, bajo para
  correr una operación de agencia disfrazada de uso personal. El límite vive en
  `LIMITE_GENERACIONES_PERSONAL` (`server/src/models/User.js`).
- **Cuenta admin, sin topes de uso.** Quien inicia sesión con el correo de `ADMIN_EMAIL` no tiene
  límite de generaciones con IA, nunca ve el candado de facturación congelada, y puede unirse a
  cualquier agencia aunque no tenga plan activo o esté al cupo. A propósito **no** salta ningún
  control de pertenencia: sigue sin poder ver o editar viajes, gastos o agencias de otras cuentas —
  `esAdmin()` (`server/src/utils/esAdmin.js`) solo quita topes de uso, nunca permisos sobre datos
  ajenos.
- **Medición de los clics de salida.** Propia, sin cookies ni herramientas de terceros: se
  guarda proveedor, sección, destino y fecha, nunca quién pulsó. Se ve con `npm run clicks` en
  `server`, o vía `GET /api/stats/clicks` si defines `ADMIN_EMAIL`. Los eventos se borran solos
  a los 180 días.
- **Páginas legales.** Términos, privacidad y cookies en `/terminos`, `/privacidad` y `/cookies`,
  accesibles sin sesión. Describen lo que el código hace: qué campos se guardan, qué recibe cada
  tercero y qué viaja en los enlaces de salida.
- **Itinerario con IA.** Gemini devuelve un plan día por día en JSON estructurado (actividades con
  hora, categoría, coordenadas y costo estimado). Todo es editable desde la interfaz: agregar,
  editar, quitar, renombrar días y arrastrar actividades para reordenarlas dentro de un día o
  moverlas a otro (con ratón, dedo o teclado). Cambiar la hora de una actividad la reacomoda sola
  entre sus vecinas del día; arrastrar sigue sin tocar la hora, para poder acomodar algo fuera de
  su orden cronológico sin que un guardado cualquiera lo deshaga.
- **Plantillas de itinerario reutilizables.** El botón *Guardar como plantilla* en un itinerario ya
  armado lo copia (destino y actividades, sin fechas de calendario) para aplicarlo a un cliente
  nuevo desde `/plantillas` sin volver a capturar nada a mano. Con agencia se comparten con todo el
  equipo; sin ella, son privadas. Aplicar una plantilla no pasa por Gemini, así que no cuenta
  contra el cupo de generaciones del plan personal.
- **Gastos sueltos.** Comidas, entradas y souvenirs con categoría, fecha y marca de pagado, que
  entran al desglose sin duplicar lo ya capturado en el viaje.
- **Mapa y clima.** Leaflet con un pin por actividad; clima real a 5 días y estimación por
  temporada para fechas más lejanas, siempre etiquetado como tal.
- **Presupuesto.** Gráfica de dona con el desglose por categoría, total por viajero y por día, y
  comparación contra el presupuesto que definiste. Si mezclas monedas, convierte con tasas reales
  (Frankfurter, sin API key) y, si el servicio no responde, avisa qué quedó sin sumar en vez de
  inventar un total.

---

## Cómo correrlo en local

### Requisitos

- Node.js 18 o superior
- MongoDB: local (`mongodb://127.0.0.1:27017`) o un cluster gratuito en
  [MongoDB Atlas](https://www.mongodb.com/atlas)

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
```

Llena `server/.env`:

| Variable | Obligatoria | Para qué sirve |
|---|:---:|---|
| `MONGO_URI` | sí | Cadena de conexión a MongoDB. |
| `JWT_SECRET` | sí | Firma de los tokens. Genera uno con el comando de abajo. |
| `PORT` | no | Puerto de la API (4000 por defecto). |
| `CLIENT_URL` | no | Origen permitido por CORS (`http://localhost:5173` por defecto). |
| `GEMINI_API_KEY` | no* | [Google AI Studio](https://aistudio.google.com/apikey). Sin ella la app funciona, pero el botón de generar itinerario responde con un aviso claro. |
| `GEMINI_MODEL` | no | `gemini-3.6-flash` por defecto. |
| `OPENWEATHER_API_KEY` | no* | [OpenWeatherMap](https://openweathermap.org/api). Sin ella el clima cae a estimación por temporada. |
| `AI_RATE_LIMIT_PER_HOUR` | no | Generaciones con IA por usuario por hora (10 por defecto). |
| `AI_CHAT_RATE_LIMIT_PER_HOUR` | no | Mensajes al chat de IA por usuario por hora (30 por defecto — más alto que el de arriba porque una conversación manda muchos mensajes cortos, no una generación pesada). |
| `ADMIN_EMAIL` | no | Correo con reporte de clics y sin topes de uso (generaciones ilimitadas, sin candado de facturación). Sin definirla, nadie tiene ninguno de los dos. |
| `RESEND_API_KEY` | no* | [Resend](https://resend.com/api-keys). Sin ella no sale el correo de recuperación; en desarrollo el enlace se imprime en la consola. |
| `MAIL_FROM` | no | Remitente. Con una cuenta nueva de Resend, y hasta verificar un dominio, hay que dejar `onboarding@resend.dev`: solo entrega al correo con el que se creó la cuenta. |
| `CLOUDINARY_CLOUD_NAME` `CLOUDINARY_API_KEY` `CLOUDINARY_API_SECRET` | no* | [Cloudinary](https://cloudinary.com), plan gratis (25 GB/mes). Los tres valores están juntos en el Dashboard. Sin ellos el botón de subir logo responde con un aviso claro; el campo de URL manual sigue funcionando igual. |
| `STRIPE_SECRET_KEY` `STRIPE_WEBHOOK_SECRET` | no* | Cobro a agencias. La primera sale de la [consola de Stripe](https://dashboard.stripe.com/apikeys); la segunda, de crear el endpoint del webhook ahí mismo. Sin ellas `/agency/billing` responde con un aviso claro; el resto de la app no se entera. |
| `STRIPE_PRICE_*` | no* | El Price de cada tier (Inicio, Agencia, Agencia Pro, mensual y anual) y el de agente extra donde aplica. Los crea `npm run stripe:setup` en `server`, que imprime todas las líneas listas para pegar aquí. |

Para generar el secreto:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Levanta la API:

```bash
npm run dev
```

Debe quedar en `http://localhost:4000`. Comprueba con `GET /api/health`.

### 2. Datos de ejemplo

```bash
npm run seed
```

Crea la cuenta `demo@rumbo.app` / `demo1234` con tres viajes: uno a Oaxaca con itinerario completo
de 5 días, un fin de semana en CDMX y un viaje ya terminado a la Huasteca. Es idempotente: correrlo
dos veces no duplica nada. Para rehacerlo desde cero:

```bash
npm run seed:reset
```

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

Abre `http://localhost:5173`. En desarrollo Vite proxea `/api` al puerto 4000, así que no hace
falta configurar `VITE_API_URL` ni lidiar con CORS.

### 4. Pruebas

```bash
cd server
npm test
```

Valida los modelos de Mongoose, los esquemas de Zod y los servicios sin necesidad de una base de
datos levantada.

El cliente tiene su propia suite con Vitest y Testing Library:

```bash
cd client
npm test
```

Cubre el formato de moneda y fechas, las reglas de validación, el hook de formularios (cuándo
aparece cada error y cómo se traducen los del backend), el cliente HTTP (token, 401, caída de red)
y los componentes base. Varias pruebas son de regresión: fijan bugs que ya se corrigieron, como
la etiqueta que no se ligaba cuando el control iba como hijo de `Campo`.

Las dos suites corren en cada push con GitHub Actions, junto con el build del cliente.

Con la API corriendo (`npm run dev` en otra terminal) hay dos suites de integración más, que
prueban contra la base real los payloads exactos que manda el cliente:

```bash
npm run test:api
```

Y una que comprueba la integración con OpenWeatherMap, mezclando pronóstico real y estimación:

```bash
npm run test:clima
```

---

## Deploy

El backend corre en Render (tier gratuito) y el frontend en Cloudflare Workers (tier gratuito,
con la CLI de `wrangler`, sin pasar por GitHub). El orden importa: el backend tiene que existir
primero para saber a qué URL apunta el frontend, y el frontend tiene que existir para configurar
`CLIENT_URL` en el backend.

### 0. Subir el repo a GitHub

Render despliega desde un repositorio, así que este paso va primero (Cloudflare no lo necesita:
se despliega directo desde tu máquina). El repo ya está inicializado y con el commit inicial hecho:

```bash
gh repo create rumbia --public --source=. --push
```

Si prefieres hacerlo desde la web: crea el repositorio vacío en GitHub y luego

```bash
git remote add origin https://github.com/TU-USUARIO/rumbia.git && git push -u origin main
```

Antes de subir, confirma que `.env` no viaja (debería devolver error, que es lo correcto):

```bash
git ls-files --error-unmatch server/.env
```

### 1. Base de datos en Atlas

Cluster M0 (gratuito, 512 MB). En **Network Access** agrega `0.0.0.0/0` para que
Render pueda conectarse, y usa un usuario dedicado a este proyecto. Guarda la
cadena de conexión con el nombre de la base incluido:

```
mongodb+srv://usuario:password@cluster.xxxxx.mongodb.net/rumbia?retryWrites=true&w=majority
```

Si la contraseña lleva `@`, `/`, `:` o `#`, cámbiala: rompen la URL y el error
que sale no lo explica.

### 2. Backend en Render

El repo trae [`render.yaml`](render.yaml): en Render elige **New -> Blueprint**,
apunta a este repositorio y captura las claves marcadas `sync: false`.
`JWT_SECRET` se genera solo.

A mano funciona igual: root directory `server`, build `npm install`,
start `npm start`, health check `/api/health`.

`CLIENT_URL` todavía no la sabes: pon cualquier valor y corrígela en el paso 4.
Cuando termine, copia la URL del servicio (algo como
`https://rumbia-api.onrender.com`) y comprueba que responde:

```bash
curl https://rumbia-api.onrender.com/api/health
```

Si vas a cobrar a agencias: corre `npm run stripe:setup` (local, contra tu cuenta de Stripe)
para conseguir los `STRIPE_PRICE_*` de cada tier, y crea el webhook en el dashboard de Stripe apuntando
a `https://rumbia-api.onrender.com/api/billing/webhook` con los eventos `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
`customer.subscription.updated` y `customer.subscription.deleted` — de ahí sale `STRIPE_WEBHOOK_SECRET`.
Los dos eventos `async_payment_*` cubren metodos de pago que confirman el cobro unos dias despues
(OXXO, SPEI): sin ellos, una agencia que pague por ahi se queda sin activar. Sin nada de esto la
app funciona igual, solo que nadie puede pagarte.

### 3. Frontend en Cloudflare Workers

A diferencia de Render, esto no se conecta a GitHub: el build se hace en tu máquina y
`wrangler deploy` sube el resultado directo a Cloudflare.

**Antes de seguir, pon la API en un subdominio propio** (ej. `api.tudominio.com`), no en el
`.onrender.com` crudo: la sesión vive en una cookie `httpOnly` (ver Seguridad), y una cookie que
viene de un dominio distinto al del front es "de tercero" para el navegador — Safari y Firefox la
bloquean por default, así que el login se rompería para buena parte de tus usuarios. En Render:
Settings → Custom Domains → agrega el subdominio, y sigue el registro CNAME que te muestre en el
DNS de tu dominio (con proxy/nube **desactivado** si usas Cloudflare, para que Render pueda emitir
su propio certificado sin interferencia).

1. Copia `client/.env.example` a `client/.env` y pon
   `VITE_API_URL=https://api.tudominio.com/api` (con `/api` al final, sin barra después).
   Vite lo incrusta en el build, así que tiene que existir *antes* de compilar — no hay ningún
   dashboard donde configurarlo después.
2. Desde `client/`:
   ```bash
   npm run build && npm run deploy
   ```
   La primera vez, `wrangler` pide iniciar sesión con tu cuenta de Cloudflare (abre el navegador solo).
3. El nombre del proyecto sale de `"name"` en [`client/wrangler.jsonc`](client/wrangler.jsonc); la
   URL final queda como `https://<name>.<tu-subdominio>.workers.dev`.

El plan gratuito de Cloudflare Workers permite uso comercial sin restricciones
(a diferencia del plan Hobby de Vercel) y no tiene límite de ancho de banda para contenido
estático — 100,000 peticiones/día es el único tope.

[`client/wrangler.jsonc`](client/wrangler.jsonc) trae `not_found_handling: "single-page-application"`,
que manda cualquier ruta que no sea un archivo real (`/viajes/:id`) a `index.html` en vez de dar
404 al recargar. No agregues un archivo `_redirects`: choca con esta opción y Cloudflare rechaza
el deploy con "Infinite loop detected".

### 4. Cerrar el círculo

Vuelve a Render y pon `CLIENT_URL` con la URL que te dio Cloudflare
(`https://rumbia.tu-subdominio.workers.dev`, **sin barra final** — aunque el servidor la
normaliza, es más claro sin ella). Redespliega. Sin este paso el navegador
bloquea las peticiones por CORS y la app se ve vacía.

### 5. Sembrar la cuenta demo

Desde tu máquina, apuntando a la base de producción:

```bash
cd server && MONGO_URI="tu-cadena-de-atlas" npm run seed
```

### Sobre el plan gratuito de Render

El servicio se duerme tras 15 minutos sin tráfico y la primera petición tarda
~30-50 s en despertarlo. La app lo maneja: muestra un aviso de "despertando el
servidor" en vez de un spinner mudo, y el cliente espera hasta 70 s antes de
rendirse. Aun así, conviene avisarlo en el README de tu demo.

En producción (`rumbiamx.com`) ya se pasó al plan Starter (~$7 USD/mes): con tráfico real de
usuarios pagando, ese cold-start le cuesta conversión al negocio de una forma que no vale la pena
en un proyecto de portafolio con el tier gratuito.

## Arquitectura

```
planeador-viajes-ia/
├── server/
│   ├── src/
│   │   ├── config/        env.js (valida variables al arrancar), db.js
│   │   ├── models/        User, Trip, Itinerary, Expense, ClickSalida, Agency,
│   │   │                  ItineraryTemplate, TripChat, AuditLog
│   │   ├── validators/    esquemas de Zod por endpoint
│   │   ├── middleware/    auth (JWT), validate, errorHandler, rateLimiters, billing, subirLogo, turnstile
│   │   ├── services/      gemini, chat, weather, exchange, bookingLinks, affiliates,
│   │   │                  email (Resend), logo (Cloudinary), stripe, turnstile
│   │   ├── controllers/   lógica de cada recurso
│   │   ├── routes/        auth, trip (+ itinerary anidado), expense, weather, agency
│   │   │                  (+ billing anidado), templates, chat, public, stats
│   │   ├── app.js         middleware y montaje de rutas
│   │   └── server.js      arranque y apagado ordenado
│   └── scripts/           seed.js, smoke-test.mjs, stripe-setup.mjs, prueba-*.mjs
└── client/
    └── src/
        ├── api/           cliente fetch + un módulo por recurso
        ├── context/       AuthContext
        ├── components/    kit de UI, layout, chat flotante, mapa, gráfica, clima
        ├── pages/         Inicio, Acerca, Entrar, Registro, Recuperar, Restablecer, Dashboard,
        │                  NuevoViaje, DetalleViaje, Itinerario, ItinerarioCompartido, Perfil,
        │                  Plantillas, Privacidad, Cookies, Terminos
        ├── hooks/         useFetch (carga, error, cancelación), useTema
        └── styles/        global.css con los tokens de diseño
```

### Modelo de datos

**User** — nombre, email único, password hasheado (`select: false`) y `preferences`
(estilos de viaje, ritmo, nivel de gasto, ciudad de origen, moneda).

**Trip** — pertenece a un User. Guarda destino y origen como subdocumentos con coordenadas, fechas,
viajeros, presupuesto y estado. Anida las tres secciones de gasto: `transport.outbound` /
`transport.inbound`, un arreglo de `lodging` y otro de `localTransport`. Expone virtuales
calculados: `durationDays`, `nightsCount` y `coreCosts` (transporte + hospedaje + local). Tiene dos
ejes de estado independientes: `status` (en qué va el viaje en sí: borrador → planeado → aprobado →
en-curso → completado) y `estadoPropuesta` (en qué va la venta: borrador → enviada → aceptada →
pagada, con cancelada como salida). `estadoPropuesta` avanza solo a "enviada" cuando se genera el
enlace público del itinerario, y a "aceptada" cuando el cliente acepta desde ese mismo enlace;
"pagada" y "cancelada" las pone el agente a mano.

**Itinerary** — uno por viaje (índice único sobre `trip`). Contiene `days[]`, y cada día sus
`activities[]` con hora, categoría, ubicación, costo estimado y `source` (`ia` o `usuario`).
Guarda el `promptContext` con el que se generó, para poder auditar el resultado.

**Expense** — gastos sueltos (comida, entradas, compras) ligados a un viaje. Se mantienen separados
de los costos capturados en el Trip para que el resumen no los cuente dos veces.

**Agency** — la marca que comparten varios agentes sin compartir cuenta ni contraseña: nombre,
logo, contacto, un `colorAcento` opcional (hex) para el PDF, y un `inviteCode` de 32 caracteres hex
para que se unan desde fuera de la app. El subdocumento `billing` guarda el plan, el estado de pago
(`trial` / `pendiente` / `activa` / `congelada`) y los agentes extra comprados; el virtual
`capacidadAgentes` calcula el tope real según el tier, y `marcaBlanca` dice si el plan (Agencia o
Pro) ya no debe mostrar el pie ni el verde de Rumbia en el PDF.

**TripChat** — historial de la conversación de un agente con el asistente. `trip` es opcional
(`null` = conversación general); índice único por `(user, trip)`, ya que ahora varios documentos
de un mismo usuario pueden compartir `trip: null`.

**ItineraryTemplate** — copia de un itinerario ya armado, sin fechas de calendario (días
relativos), para aplicarla a un cliente nuevo sin volver a capturar nada a mano. Vive separada de
`Itinerary` a propósito, para no tener que hacer `trip` opcional ahí.

**ClickSalida** — un clic en un enlace de salida hacia un proveedor. Deliberadamente anónimo: solo
proveedor, sección, destino y fecha, nunca usuario ni IP. Se borra solo a los 180 días.

**AuditLog** — quién hizo qué en las pocas acciones de agencia que son sensibles (sacar a un
agente, regenerar el código, que la agencia se elimine, admin uniéndose sin plan/cupo). `agency`
es opcional a propósito: el evento `agencia.eliminada` se registra justo antes de borrar el
documento al que apunta, así que no puede exigir una referencia que está a punto de dejar de
existir. Se conserva un año.

### Decisiones que vale la pena explicar

**Enlazar en vez de reservar.** Procesar reservas reales requiere contratos con GDS, aerolíneas y
cadenas hoteleras. La app construye la URL de búsqueda del proveedor con los datos del viaje ya
puestos y avisa explícitamente que la reserva se completa fuera; el usuario regresa a capturar el
costo real.

**Salida estructurada de Gemini.** El itinerario se pide con `responseMimeType: application/json` y
un `responseSchema`, así que la respuesta llega tipada y no hay que parsear texto libre ni limpiar
cercas de código. Aun así se normaliza todo antes de guardarlo: horas que no cumplan `HH:mm` se
descartan, las categorías fuera del enum caen a `otro` y las coordenadas inválidas se ignoran.

**Rate limiting por usuario en el endpoint de IA.** El límite general de la API es por IP, pero
`/itinerary/generate` se limita por `req.user._id`: lo que hay que proteger es la cuota de la API
key, y varios usuarios pueden compartir IP.

**Clima honesto.** El tier gratuito de OpenWeatherMap solo pronostica 5 días y la API de promedios
históricos es de pago. Para fechas más lejanas se estima la temperatura con un modelo estacional
por latitud y mes (invertido en el hemisferio sur) y la respuesta marca cada día con
`source: 'estimacion-historica'` para no vender una estimación como pronóstico.

**Nunca borrar datos en silencio.** Si acortas las fechas de un viaje, el itinerario no pierde
los días sobrantes: se marcan como "fuera del viaje", la app te dice cuántas actividades hay en
ellos y tú decides si los quitas. Alargarlo sí agrega días vacíos automáticamente, porque eso no
destruye nada. La misma idea aplica al clima: un día del pronóstico con menos de 4 lecturas de 3 h
no alcanza para calcular un mínimo y un máximo creíbles, así que se degrada a estimación en vez de
mostrar un rango inventado.

**Degradar sin romperse.** Si Gemini, OpenWeatherMap o el mapa fallan, la vista sigue en pie y
muestra un mensaje concreto. Sin `GEMINI_API_KEY` la app arranca igual y el endpoint responde 503
explicando qué falta; sin `OPENWEATHER_API_KEY` el clima cae a estimación.

**Validación en el borde.** Zod valida y coerciona cada payload antes de tocar Mongoose, así los
controladores trabajan con datos limpios y los errores llegan al front como una lista de
`{ field, message }` que los formularios pintan campo por campo.

**Validación en dos capas, sin duplicar la autoridad.** El cliente valida mientras el usuario
escribe (con `useFormulario`) para dar respuesta inmediata, pero el servidor sigue siendo quien
decide: los `details` que devuelve se mapean de vuelta a cada campo del formulario. El error solo
se muestra después de que el usuario salió del campo, no mientras teclea la primera letra.

---

## API

Las rutas privadas se autentican con una cookie `httpOnly` (`rumbia_token`) que
pone el propio servidor al iniciar sesión — el cliente nunca la lee ni la
maneja a mano, solo manda `credentials: 'include'`. El respaldo por header
`Authorization: Bearer <token>` y el campo `token` en el JSON de
register/login/etc. ya se quitaron: eran compatibilidad temporal para un
cliente que nunca llegó a usarlos.

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/health` | Estado del servicio y qué integraciones están configuradas. |
| `POST` | `/api/auth/register` | Crea cuenta e inicia sesión (deja la cookie puesta). |
| `POST` | `/api/auth/login` | Inicia sesión. |
| `POST` | `/api/auth/logout` | Cierra sesión: borra la cookie del lado del servidor. |
| `GET` `PATCH` | `/api/auth/me` | Perfil y preferencias. |
| `POST` | `/api/auth/me/logo` | Sube el logo de marca personal (Cloudinary). |
| `PATCH` | `/api/auth/me/password` | Cambia la contraseña. |
| `DELETE` | `/api/auth/me` | Elimina la cuenta y todo lo asociado. |
| `POST` | `/api/auth/forgot-password` · `/api/auth/reset-password` | Recuperación de contraseña por correo. |
| `POST` | `/api/auth/verify-email` · `/api/auth/resend-verification` | Confirma el correo con el token del enlace, o pide uno nuevo (con sesión). |
| `GET` `POST` | `/api/trips` | Lista (filtra por estado y texto) y crea. |
| `GET` `PATCH` `DELETE` | `/api/trips/:id` | Detalle, edición y borrado en cascada. |
| `POST` | `/api/trips/:id/duplicar` | Copia un viaje completo (útil para variantes de una misma propuesta). |
| `GET` | `/api/trips/:id/summary` | Desglose de presupuesto y datos para la gráfica. |
| `GET` | `/api/trips/:id/booking-links` | Enlaces de salida prellenados. |
| `GET` | `/api/trips/:id/weather` | Clima para las fechas del viaje. |
| `GET` | `/api/trips/:id/expenses` | Gastos del viaje con desglose por categoría. |
| `GET` `POST` `DELETE` | `/api/trips/:id/itinerary` | Consulta, crea vacío o elimina. |
| `POST` | `/api/trips/:id/itinerary/generate` | Genera con Gemini (limitado por usuario/hora). |
| `POST` `DELETE` | `/api/trips/:id/itinerary/share` | Activa o revoca el enlace público del itinerario. |
| `POST` | `/api/trips/:id/itinerary/plantilla` | Guarda el itinerario como plantilla reutilizable. |
| `PATCH` | `/api/trips/:id/itinerary/days/:dayId` | Edita título y resumen del día. |
| `DELETE` | `/api/trips/:id/itinerary/days/:dayId` | Elimina un día y renumera los siguientes. |
| `PATCH` | `/api/trips/:id/itinerary/days/:dayId/reorder` | Reordena las actividades del día. |
| `POST` | `/api/trips/:id/itinerary/days/:dayId/activities` | Agrega actividad. |
| `PATCH` `DELETE` | `…/activities/:activityId` | Edita o elimina actividad. |
| `PATCH` | `…/activities/:activityId/move` | Mueve la actividad a otro día. |
| `GET` `POST` | `/api/expenses` | Lista y crea gastos. |
| `PATCH` `DELETE` | `/api/expenses/:id` | Edita y elimina. |
| `GET` | `/api/weather` · `/api/weather/geocode` · `/api/weather/geocode/sugerencias` | Clima por coordenadas y búsqueda de lugares. |
| `GET` `POST` `PATCH` | `/api/agency` | Ver, crear y editar la agencia (marca, logo, contacto). |
| `POST` | `/api/agency/logo` | Sube el logo de la agencia (Cloudinary). |
| `POST` | `/api/agency/unirse` · `/api/agency/salir` | Unirse con un código de invitación o salir. |
| `POST` | `/api/agency/codigo` | Regenera el código de invitación. |
| `DELETE` | `/api/agency/miembros/:userId` | Saca a un agente de la agencia (solo el dueño). |
| `GET` | `/api/agency/reporte` | Viajes armados por cada agente en el mes (solo el dueño). |
| `GET` | `/api/agency/auditoria` | Últimas acciones sensibles de la agencia (solo el dueño). |
| `GET` | `/api/agency/billing` | Estado de pago y capacidad de agentes de la agencia. |
| `POST` | `/api/agency/billing/checkout` | Sesión de Stripe Checkout para activar o cambiar de plan. |
| `POST` | `/api/agency/billing/portal` | Enlace al Customer Portal de Stripe. |
| `PATCH` | `/api/agency/billing/agentes` | Sube o baja los agentes extra de una suscripción activa. |
| `POST` | `/api/billing/webhook` | Webhook de Stripe (firma verificada, body crudo — montado aparte del resto de `/agency/billing`, antes del parser de JSON). |
| `GET` `POST` `DELETE` | `/api/chat` | Historial, envío de mensaje y borrado del chat (general o por `tripId`). |
| `GET` `DELETE` | `/api/templates` `/api/templates/:id` | Lista y elimina plantillas. |
| `POST` | `/api/templates/:id/aplicar` | Crea un viaje nuevo a partir de una plantilla. |
| `POST` | `/api/public/itinerary` | Genera un itinerario sin cuenta (portada), limitado por IP. |
| `GET` | `/api/public/itinerary/:token` | Ve un itinerario compartido por enlace, sin sesión. |
| `POST` | `/api/public/itinerary/:token/aceptar` | El cliente acepta la propuesta desde el enlace: mueve `estadoPropuesta` a "aceptada" y avisa por correo a quien la armó. |
| `POST` | `/api/public/click` | Registra un clic de salida (con o sin sesión). |
| `GET` | `/api/stats/clicks` | Reporte de clics por proveedor (solo `ADMIN_EMAIL`). |
| `GET` | `/api/stats/auditoria` | Acciones sensibles de todas las agencias (solo `ADMIN_EMAIL`). |

Todas las respuestas siguen la misma forma:

```jsonc
// éxito
{ "success": true, "message": "Viaje creado.", "data": { "trip": { } } }

// error
{ "success": false, "message": "Datos invalidos.",
  "details": [{ "field": "endDate", "message": "La fecha de regreso no puede ser anterior a la de salida." }] }
```

---

## Seguridad

- Contraseñas con bcrypt (12 rondas) y `select: false` en el esquema.
- JWT firmado con secreto de entorno (HS256 explícito) y con un piso de 32 caracteres: el servidor
  no arranca con uno corto ni con el valor de ejemplo de `.env.example`. El middleware `protect`
  verifica que el usuario siga existiendo en cada petición y que el token no sea anterior al último
  cambio de contraseña.
- El token vive en una cookie `httpOnly` (invisible para JavaScript, incluido un script inyectado
  por XSS) en vez de `localStorage`. `api.rumbiamx.com` es un subdominio propio a propósito: sin
  eso la cookie sería "de tercero" para el navegador (dominio distinto al del front) y Safari/
  Firefox la bloquearían por default. Con `SameSite=Lax` alcanza como protección CSRF — no hace
  falta un esquema de tokens aparte — porque cliente y API, al compartir dominio raíz, se
  consideran el mismo sitio.
- Cada handler comprueba la propiedad del recurso: pedir el viaje de otra persona da 403, no 404
  con datos.
- Helmet, CORS restringido al origen del front en producción y límite de 1 MB en el body, del lado
  de la API. El front (Cloudflare Workers) trae su propio juego de cabeceras en
  `client/public/_headers` — CSP, `X-Frame-Options`, `Referrer-Policy`, HSTS — porque Workers sirve
  esos archivos directo, sin pasar por Express ni por Helmet.
- Rate limiting en varios niveles: general, login (contra fuerza bruta, además del bloqueo por
  cuenta tras 6 intentos), pedir/gastar el enlace de recuperación y generación con IA.
- Ninguna API key llega al navegador: el front habla solo con la API propia, que es quien llama a
  Gemini, OpenWeatherMap y Cloudinary.

### Rotar un secreto filtrado

Si `JWT_SECRET`, `MONGO_URI`, o alguna API key (Gemini, OpenWeatherMap, Resend, Cloudinary, Stripe,
Turnstile) se filtra o se sospecha comprometida:

1. **Genera el reemplazo primero**, sin tocar producción todavía:
   - `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
   - El resto: desde el panel del proveedor (revocar la vieja, crear una nueva). Mongo Atlas es el
     único caso con dos partes — cambiar la contraseña del usuario de base de datos actualiza
     también la cadena de `MONGO_URI`.
2. **Súbelo a las variables de entorno de Render** y redepliega. Hasta aquí no hay corte de
   servicio: el redeploy tarda lo que tarda siempre.
3. **Efecto sobre sesiones activas**, según qué rotaste:
   - `JWT_SECRET`: todo JWT emitido con el secreto anterior deja de verificar de inmediato. Es el
     efecto buscado si el secreto se filtró — expulsa a todo el mundo, sesión robada incluida — pero
     avisa antes: cierra la sesión de cada persona conectada, no solo la de quien la robó.
   - Las demás claves no tocan sesiones: son credenciales servidor-a-servicio, invisibles para quien
     ya tiene un JWT válido.
4. **Revoca la clave vieja en el panel del proveedor** una vez confirmado que el redeploy tomó la
   nueva (que no queden ambas activas más tiempo del necesario).
5. Para `STRIPE_WEBHOOK_SECRET` específicamente: se regenera creando un endpoint nuevo en
   Developers → Webhooks (no hay botón de "rotar" sobre el mismo), apuntando a la misma URL, y
   borrando el viejo después de confirmar que el nuevo firma bien (`stripe listen` o esperar el
   primer evento real).

---

## Pendientes conocidos

- `npm audit` en `server/` reporta 3 avisos moderados de `qs` (arrastrado por `body-parser` y
  `express`): [array-limit bypass vía `comma:true`](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx)
  y [DoS vía `isBuffer`](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g). Verificado: no hay
  fix — Express 4.22.2 (la última versión de la rama 4.x) fija `body-parser: ~1.20.5`, que fija
  `qs: ~6.15.1`, un rango que nunca sale de "2.2.5 - 6.15.3" (el rango vulnerable completo).
  Subir a Express 5 arreglaría esto, pero es un cambio mayor con mucho más riesgo de romper algo
  que el que vale la pena para una severidad moderada — sobre todo porque ninguna de las dos
  condiciones de explotación aplica aquí: Rumbia nunca configura `comma:true` en el parser de
  query ni llama `qs.stringify` directo en ningún lado (solo lo usa Express por debajo, con su
  configuración por default, para parsear `req.query`). No correr `npm audit fix --force`: eso
  bajaría `express` de version sin que el codigo este migrado.
- El aviso de privacidad (`client/src/pages/Privacidad.jsx`, sección "Quién es responsable de tus
  datos") todavía no incluye un domicilio del responsable, que el art. 15 de la LFPDPPP exige.
  Falta agregarlo (`client/src/config/legal.js` es donde viven `RESPONSABLE`/`CONTACTO_PRIVACIDAD`,
  sería el lugar natural para un tercer dato de domicilio) en cuanto se tenga uno que publicar.
- El captcha con Cloudflare Turnstile (`server/src/services/turnstile.service.js`,
  `client/src/components/Captcha.jsx`) existe en el código pero se queda apagado a propósito:
  sin `TURNSTILE_SECRET_KEY` / `VITE_TURNSTILE_SITE_KEY` los formularios de registro y
  recuperación funcionan igual que si no existiera. Dar de alta la cuenta en Cloudflare causó
  crasheos, así que por ahora no se va a activar.
- El cobro a agencias con Stripe ya corre en modo live (Checkout, webhook, Prices en MXN). Muchas
  tarjetas mexicanas rechazan cargos en divisa extranjera aunque se les muestre convertida — por
  eso los Price de producción están en MXN nativo, no en USD (ver `stripe-setup.mjs`).
- El dominio `rumbiamx.com` todavía no tiene el DNS de Resend verificado (DKIM/SPF). Mientras
  tanto, `MAIL_FROM` sigue en `onboarding@resend.dev`: los correos transaccionales (bienvenida,
  recuperación de contraseña) funcionan, pero corren más riesgo de caer en spam que si salieran
  de un dominio propio verificado. No bloquea el registro ni el cobro — solo la entrega de esos
  correos.
- Endurecimiento de seguridad pendiente, ninguno urgente hoy — quedan anotados para cuando haya
  tiempo de hacerlos con calma (y de probarlos, algunos tocan flujos que no conviene romper):
  - **2FA en la cuenta admin** (`ADMIN_EMAIL`): es la única cuenta sin topes de uso ni candado de
    billing; hoy depende solo de la contraseña.
  - **Config del lado de los proveedores, no del código**: IP allowlist en MongoDB Atlas (nada de
    `0.0.0.0/0`), llaves restringidas (no la secret key completa) donde Stripe y Cloudinary lo
    permitan, y confirmar que el plan de Atlas tiene backups o point-in-time recovery — es la única
    red real contra un `deleteMany` mal apuntado.
