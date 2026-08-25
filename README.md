# Rumbo — Planeador de viajes con IA

[![CI](https://github.com/maxrodrigueznav04/Rumbo/actions/workflows/ci.yml/badge.svg)](https://github.com/maxrodrigueznav04/Rumbo/actions/workflows/ci.yml)

Aplicación web full-stack para planear un viaje completo en un solo lugar: transporte de ida y
vuelta, hospedaje, transporte en el destino, itinerario día por día generado con IA, mapa, clima y
control de presupuesto.

> **Rumbo no reserva ni cobra nada.** Centraliza la información y estima costos; para reservar te
> manda al sitio del proveedor (Skyscanner, Booking, Airbnb…) con la búsqueda ya prellenada.
> Es una decisión de diseño consciente: reservar de verdad exige acuerdos comerciales con
> aerolíneas y hoteles que un proyecto individual no puede tener.

**Demo en vivo:** <https://rumbo-self.vercel.app> — cuenta de prueba `demo@rumbo.app` / `demo1234`

> El backend corre en el plan gratuito de Render, que duerme el servicio tras 15 minutos sin uso.
> La primera petición puede tardar cerca de un minuto; la app lo avisa mientras despierta.

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
| Validación | Zod en el borde de la API |

Todo el stack corre en tiers gratuitos.

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
- **Itinerario en PDF, con marca propia.** El botón *Descargar PDF* imprime el plan día por día
  sin la interfaz de la app. Si en el perfil se llena la marca (nombre, logo y contacto), el
  membrete sale con ella en vez de con la de Rumbo, que es lo que necesita quien arma itinerarios
  para terceros. Se resuelve con `@media print` y el diálogo del navegador: sin navegador headless
  en el servidor y con el texto seleccionable de verdad.
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
  moverlas a otro.
- **Gastos sueltos.** Comidas, entradas y souvenirs con categoría, fecha y marca de pagado, que
  entran al desglose sin duplicar lo ya capturado en el viaje.
- **Mapa y clima.** Leaflet con un pin por actividad; clima real a 5 días y estimación por
  temporada para fechas más lejanas, siempre etiquetado como tal.
- **Presupuesto.** Gráfica de dona con el desglose por categoría, total por viajero y por día, y
  comparación contra el presupuesto que definiste.

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
| `RESEND_API_KEY` | no* | [Resend](https://resend.com/api-keys). Sin ella no sale el correo de recuperación; en desarrollo el enlace se imprime en la consola. |
| `MAIL_FROM` | no | Remitente. Con una cuenta nueva de Resend, y hasta verificar un dominio, hay que dejar `onboarding@resend.dev`: solo entrega al correo con el que se creó la cuenta. |

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

Los tres servicios corren en tiers gratuitos. El orden importa, porque cada uno
necesita la URL del anterior.

### 0. Subir el repo a GitHub

Render y Vercel despliegan desde un repositorio, asi que este paso va primero.
El repo ya esta inicializado y con el commit inicial hecho:

```bash
gh repo create rumbo --public --source=. --push
```

Si prefieres hacerlo desde la web: crea el repositorio vacio en GitHub y luego

```bash
git remote add origin https://github.com/TU-USUARIO/rumbo.git && git push -u origin main
```

Antes de subir, confirma que `.env` no viaja (deberia devolver error, que es lo correcto):

```bash
git ls-files --error-unmatch server/.env
```

### 1. Base de datos en Atlas

Cluster M0 (gratuito, 512 MB). En **Network Access** agrega `0.0.0.0/0` para que
Render pueda conectarse, y usa un usuario dedicado a este proyecto. Guarda la
cadena de conexion con el nombre de la base incluido:

```
mongodb+srv://usuario:password@cluster.xxxxx.mongodb.net/rumbo?retryWrites=true&w=majority
```

Si la contrasena lleva `@`, `/`, `:` o `#`, cambiala: rompen la URL y el error
que sale no lo explica.

### 2. Backend en Render

El repo trae [`render.yaml`](render.yaml): en Render elige **New -> Blueprint**,
apunta a este repositorio y captura las claves marcadas `sync: false`.
`JWT_SECRET` se genera solo.

A mano funciona igual: root directory `server`, build `npm install`,
start `npm start`, health check `/api/health`.

`CLIENT_URL` todavia no la sabes: pon cualquier valor y corrigela en el paso 4.
Cuando termine, copia la URL del servicio (algo como
`https://rumbo-api.onrender.com`) y comprueba que responde:

```bash
curl https://rumbo-api.onrender.com/api/health
```

### 3. Frontend en Vercel

- Root directory: `client`
- Build command: `npm run build` - Output: `dist`
- Variable de entorno: `VITE_API_URL = https://rumbo-api.onrender.com/api`
  (con `/api` al final, sin barra despues)

[`client/vercel.json`](client/vercel.json) reescribe todas las rutas a
`index.html` para que los enlaces profundos (`/viajes/:id`) no den 404 al recargar.

### 4. Cerrar el circulo

Vuelve a Render y pon `CLIENT_URL` con la URL que te dio Vercel
(`https://rumbo.vercel.app`, **sin barra final** — aunque el servidor la
normaliza, es mas claro sin ella). Redespliega. Sin este paso el navegador
bloquea las peticiones por CORS y la app se ve vacia.

### 5. Sembrar la cuenta demo

Desde tu maquina, apuntando a la base de produccion:

```bash
cd server && MONGO_URI="tu-cadena-de-atlas" npm run seed
```

### Sobre el plan gratuito de Render

El servicio se duerme tras 15 minutos sin trafico y la primera peticion tarda
~30-50 s en despertarlo. La app lo maneja: muestra un aviso de "despertando el
servidor" en vez de un spinner mudo, y el cliente espera hasta 70 s antes de
rendirse. Aun asi, conviene avisarlo en el README de tu demo.

## Arquitectura

```
planeador-viajes-ia/
├── server/
│   ├── src/
│   │   ├── config/        env.js (valida variables al arrancar), db.js
│   │   ├── models/        User, Trip, Itinerary, Expense
│   │   ├── validators/    esquemas de Zod por endpoint
│   │   ├── middleware/    auth (JWT), validate, errorHandler, rateLimiters
│   │   ├── services/      gemini, weather, bookingLinks
│   │   ├── controllers/   lógica de cada recurso
│   │   ├── routes/        auth, trips, itinerary (anidado), expenses, weather
│   │   ├── app.js         middleware y montaje de rutas
│   │   └── server.js      arranque y apagado ordenado
│   └── scripts/           seed.js, smoke-test.mjs
└── client/
    └── src/
        ├── api/           cliente fetch + un módulo por recurso
        ├── context/       AuthContext
        ├── components/    kit de UI, layout, mapa, gráfica, clima
        ├── pages/         Entrar, Registro, Dashboard, NuevoViaje, DetalleViaje, Itinerario, Perfil
        ├── hooks/         useFetch (carga, error, cancelación)
        └── styles/        global.css con los tokens de diseño
```

### Modelo de datos

**User** — nombre, email único, password hasheado (`select: false`) y `preferences`
(estilos de viaje, ritmo, nivel de gasto, ciudad de origen, moneda).

**Trip** — pertenece a un User. Guarda destino y origen como subdocumentos con coordenadas, fechas,
viajeros, presupuesto y estado. Anida las tres secciones de gasto: `transport.outbound` /
`transport.inbound`, un arreglo de `lodging` y otro de `localTransport`. Expone virtuales
calculados: `durationDays`, `nightsCount` y `coreCosts` (transporte + hospedaje + local).

**Itinerary** — uno por viaje (índice único sobre `trip`). Contiene `days[]`, y cada día sus
`activities[]` con hora, categoría, ubicación, costo estimado y `source` (`ia` o `usuario`).
Guarda el `promptContext` con el que se generó, para poder auditar el resultado.

**Expense** — gastos sueltos (comida, entradas, compras) ligados a un viaje. Se mantienen separados
de los costos capturados en el Trip para que el resumen no los cuente dos veces.

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

Todas las rutas privadas esperan `Authorization: Bearer <token>`.

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/health` | Estado del servicio y qué integraciones están configuradas. |
| `POST` | `/api/auth/register` | Crea cuenta y devuelve token. |
| `POST` | `/api/auth/login` | Inicia sesión. |
| `GET` `PATCH` | `/api/auth/me` | Perfil y preferencias. |
| `PATCH` | `/api/auth/me/password` | Cambia la contraseña. |
| `GET` `POST` | `/api/trips` | Lista (filtra por estado y texto) y crea. |
| `GET` `PATCH` `DELETE` | `/api/trips/:id` | Detalle, edición y borrado en cascada. |
| `GET` | `/api/trips/:id/summary` | Desglose de presupuesto y datos para la gráfica. |
| `GET` | `/api/trips/:id/booking-links` | Enlaces de salida prellenados. |
| `GET` | `/api/trips/:id/weather` | Clima para las fechas del viaje. |
| `GET` | `/api/trips/:id/expenses` | Gastos del viaje con desglose por categoría. |
| `GET` `POST` `DELETE` | `/api/trips/:id/itinerary` | Consulta, crea vacío o elimina. |
| `POST` | `/api/trips/:id/itinerary/generate` | Genera con Gemini (limitado por usuario/hora). |
| `PATCH` | `/api/trips/:id/itinerary/days/:dayId` | Edita título y resumen del día. |
| `DELETE` | `/api/trips/:id/itinerary/days/:dayId` | Elimina un día y renumera los siguientes. |
| `PATCH` | `/api/trips/:id/itinerary/days/:dayId/reorder` | Reordena las actividades del día. |
| `POST` | `/api/trips/:id/itinerary/days/:dayId/activities` | Agrega actividad. |
| `PATCH` `DELETE` | `…/activities/:activityId` | Edita o elimina actividad. |
| `PATCH` | `…/activities/:activityId/move` | Mueve la actividad a otro día. |
| `GET` `POST` | `/api/expenses` | Lista y crea gastos. |
| `PATCH` `DELETE` | `/api/expenses/:id` | Edita y elimina. |
| `GET` | `/api/weather` · `/api/weather/geocode` | Clima por coordenadas y búsqueda de lugares. |

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
- JWT firmado con secreto de entorno; el middleware `protect` verifica que el usuario siga
  existiendo en cada petición.
- Cada handler comprueba la propiedad del recurso: pedir el viaje de otra persona da 403, no 404
  con datos.
- Helmet, CORS restringido al origen del front en producción y límite de 1 MB en el body.
- Rate limiting en tres niveles: general, login (contra fuerza bruta) y generación con IA.
- Ninguna API key llega al navegador: el front habla solo con la API propia, que es quien llama a
  Gemini y a OpenWeatherMap.

---

## Pendientes conocidos

- Sin recuperación de contraseña por correo.
- El itinerario no reordena las actividades al cambiar la hora: hay que arrastrarlas.
- Arrastrar funciona con ratón; en móvil aún no hay gesto táctil equivalente (se puede editar la
  actividad para cambiarla de sitio).
- Falta poner el responsable y el correo de contacto en `client/src/config/legal.js`: mientras
  tengan los marcadores, las páginas legales muestran un aviso pidiéndolo.
