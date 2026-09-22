# Estado Actual del Producto: Rumbia

> **Fuente Única de Verdad sobre el Estado Técnico y Funcional del Software.**  
> **Última actualización:** Septiembre de 2026  
> **Estado:** Documento base para auditoría y registro con el fundador.

---

## Propósito de este Documento

Este archivo establece el **estado real de implementación técnica y funcional** del software de Rumbia. 

Dado que el documento `contexto-rumbia-agente.md` describe la visión integral, el alcance conceptual y la arquitectura completa prevista para la plataforma, este documento sirve como el **filtro de realidad operativa**: delimita con precisión qué capacidades existen hoy en el software, cuáles están en fase de construcción, cuáles están programadas a futuro y cuáles son meras hipótesis o conceptos.

---

## Definiciones de Estados de Funcionalidad

Para evitar malentendidos entre el equipo y los agentes de inteligencia artificial, rigen las siguientes definiciones estrictas:

* **IMPLEMENTADO:**  
  La funcionalidad existe actualmente en el código base desplegado y operativo, ha sido verificada y puede ser utilizada de forma efectiva por los usuarios finales.
* **EN DESARROLLO:**  
  La funcionalidad está siendo activamente programada o integrada técnicamente en este momento. Aún no se considera lista ni debe comunicarse como disponible para clientes reales.
* **PLANEADO / APROBADO:**  
  Existe una decisión formal de producto y arquitectura para construirla, pero su desarrollo técnico aún no ha iniciado o no se encuentra activo. No existe todavía en producción.
* **IDEA:**  
  Un concepto, sugerencia o propuesta bajo discusión que aún no ha recibido aprobación formal para incorporarse al plan de trabajo oficial.
* **DESCONOCIDO:**  
  No existe registro documentado suficiente en este archivo para determinar el estado de desarrollo de la función. Requiere confirmación directa con el fundador.

---

## Reglas Obligatorias para Agentes de Inteligencia Artificial

Al actuar como *Rumbia — CEO & Strategy* (o cualquier otro asistente automatizado), debes acatar sin excepción las siguientes directrices:

1. **La visión no implica existencia:** Que una funcionalidad aparezca detallada, explicada o ilustrada en `contexto-rumbia-agente.md` **NO significa bajo ninguna circunstancia que esté implementada en el código actual**.
2. **Consulta obligatoria de este archivo:** Para determinar si una función existe y puede ofrecerse a usuarios o citarse en estrategias comerciales inmediatas, la única fuente autorizada es `estado-actual-rumbia.md`.
3. **Tratamiento del estado no clasificado:** Si una funcionalidad o capacidad no figura explícitamente en la sección de *Implementado* de este documento, su estatus es rigurosamente **DESCONOCIDO**.
4. **Prohibición de suposición ascendente:** El estado **DESCONOCIDO nunca debe transformarse en IMPLEMENTADO mediante deducciones lógicas, suposiciones de conveniencia o entusiasmo estratégico**.
5. **Obligación de consultar al fundador:** Si una recomendación de mercadeo, un guion de ventas, una promesa comercial o una decisión de negocio depende de que una funcionalidad exista en el producto, el agente **debe consultar y validar directamente con el fundador antes de dar por sentado su funcionamiento**.

---

## Jerarquía Documental y Manejo de Contradicciones

1. **`decisiones-rumbia.md`:** Fuente de verdad sobre decisiones estratégicas vigentes, modelo de negocio y límites operativos.
2. **`estado-actual-rumbia.md` (Este documento):** Fuente de verdad sobre el estado real de implementación técnica y disponibilidad de funciones.
3. **`contexto-rumbia-agente.md`:** Fuente de contexto sobre producto, visión, mercado, funcionalidades contempladas, pricing, GTM y posicionamiento.

### Regla de resolución de contradicciones:
Si se detecta una aparente discrepancia o conflicto entre estos documentos (por ejemplo, una estrategia comercial en `contexto-rumbia-agente.md` que asume disponible una función que aquí no figura como *Implementada*, o una idea que roza una restricción de `decisiones-rumbia.md`):
* **El agente no debe inventar una reconciliación ni asumir una postura por su cuenta.**
* **El agente debe señalar la contradicción de manera explícita y transparente al fundador.**
* **El fundador será la única autoridad que determine cuál es la postura correcta y autorice la actualización de los documentos.**

---

## Registro de Funcionalidades por Categoría

### 1. Implementado
*(Funcionalidades operativas, desplegadas y verificadas en el código actual con pruebas automatizadas)*

#### A. Gestión Integral de Viajes y Propuestas
* **Gestión de viajes (`Trip`):** Creación, edición, duplicación y eliminación de propuestas y viajes.
* **Soporte multi-destino (`additionalDestinations`):** Planificación de paradas intermedias con rangos de fechas independientes y validados contra la duración del viaje.
* **Componentes de costos troncales (`coreCosts`):**
  * Transporte principal (ida y vuelta: `outbound` e `inbound`) con modo, proveedor, horarios y notas.
  * Hospedaje (`lodging`) con soporte de captura por noche o por costo total de estancia, noches y vinculación a destino o parada.
  * Movilidad interna (`localTransport`) con tipo de transporte, proveedor y costos estimados.
* **Multimoneda y conversión:** Presupuesto con selección de moneda y servicio de conversión de divisas con tasas de cambio y memoria caché (`currency.service.js`).
* **Ciclo de estados dual:**
  * Estado comercial de la propuesta (`estadoPropuesta`: `borrador`, `enviada`, `aceptada`, `rechazada`, `pagada`).
  * Estado operativo del viaje (`status`: `planificando`, `listo`, `en-curso`, `completado`, `cancelado`).
* **Directorio de clientes (CRM básico, `Client`):** Catálogo de clientes de la agencia con datos de contacto, notas operativas y vinculación directa a viajes.
* **Biblioteca de plantillas (`ItineraryTemplate`):** Creación de plantillas maestras a partir de viajes existentes y generación ágil de nuevos viajes basados en plantillas.
* **Seguridad y filtrado:** Búsqueda protegida contra ataques ReDoS (`escaparRegex`), paginación y lista blanca estricta de campos editables directos (`CAMPOS_EDITABLES_DIRECTO`).

#### B. Generación y Asistencia de Itinerarios con IA
* **Generación estructurada de itinerarios (Google Gemini):** Creación automatizada del día a día con actividades categorizadas, tiempos, duraciones, descripciones y costos estimados.
* **Arquitectura de tolerancia a fallos en IA:** Conmutación automática por cascada de modelos (`gemini-3.6-flash` → `gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-flash-latest`).
* **Edición interactiva de itinerarios:** Reordenamiento cronológico automático según horarios (`reorderByTime`), inserción manual de actividades y ajuste de días.
* **Visualización cartográfica:** Mapeo de actividades con coordenadas en mapas interactivos y extracción de pines geográficos (`mapPins`, Leaflet/OpenStreetMap).
* **Muestra para invitados sin registro:** Generación rápida de itinerarios de prueba de hasta 7 días sin persistencia en base de datos (`generarItinerarioInvitado`).
* **Asistente de consulta para el agente (`TripChat`):** Canal conversacional que asiste al asesor utilizando como contexto los datos y estructura del viaje (`chat.service.js`), sin exposición al cliente final.
* **Control de consumo de IA (`cupoIA`):** Cuotas mensuales de generación y chat según el plan de la agencia o uso personal.

#### C. Enlaces de Reserva y Clima
* **Enlaces estructurados de búsqueda (*deep-links*):** Generación automática de búsquedas con parámetros prellenados hacia Skyscanner, Google Flights, Booking.com, Airbnb, Rome2Rio, Busbud y ClickBus (`bookingLinks.service.js`).
* **Sistema de enlaces de afiliado (`affiliates.service.js`):** Decoración no intrusiva de enlaces con identificadores de afiliación configurados por entorno para monetización secundaria.
* **Información climática (`weather.service.js`):** Consulta de pronósticos meteorológicos inmediatos o estimación histórica estacional según las fechas y coordenadas del viaje.

#### D. Cotización, Marca Blanca y Privacidad
* **Automatización de margen comercial:** Configuración de margen porcentual o monto fijo por viajero que calcula automáticamente el `precioTotalPorPersona`.
* **Privacidad estricta por defecto:**
  * `ocultarDesglose: true` por defecto para nuevas propuestas (en esquemas de validación Zod y modelo Mongoose `Trip.js`): el servidor sanitiza en backend y elimina costos internos de proveedores, tarifas netas, `coreCosts.total`, `itinerary.totalEstimatedCost`, `margenPorPersona` y costos individuales de actividades en el endpoint público (`/i/:token`), blindando el margen comercial del asesor contra cualquier deducción matemática.
  * `ocultarCodigos: true` por defecto: el servidor suprime códigos de confirmación (`bookingRef`), notas privadas de reserva y URLs externas en vistas públicas.
  * **Retrocompatibilidad histórica:** Los documentos históricos previamente creados con `ocultarDesglose: false` conservan intacto su valor original, respetando la decisión previa del usuario.
* **Personalización de Marca Blanca:**
  * Carga y administración de logotipo corporativo (integración con Cloudinary).
  * Color de acento institucional en formato hexadecimal.
  * Selección de estilo tipográfico para documentos PDF (`editorial`, `clasica`, `moderna`).
  * Densidad de maquetación configurable (`compacta`, `normal`, `grande`).
  * Congelación de marca en itinerarios compartidos (`marcaCompartida`) para preservar el snapshot visual de la propuesta emitida.
  * Ocultamiento automático de la marca de agua de Rumbia en planes de pago y durante el periodo de prueba activo.
* **Entregables comerciales para el viajero:**
  * Generación y descarga de propuesta en PDF estilizada tipo bitácora editorial.
  * Enlace web interactivo público (`/i/:token`) con diseño móvil adaptable y botón de aceptación digital de la cotización (`aceptarPropuesta`).

#### E. Gestión de Agencia, Equipo y Facturación SaaS
* **Administración de agencia (`Agency`):** Configuración de identidad, datos de contacto y membresía de equipo.
* **Colaboración mediante código de invitación:** Incorporación de nuevos asesores al equipo (`unirseAgencia`) con control de cupos según el plan contratado.
* **Periodo de prueba de 14 días (Trial - P05 - RESUELTO en PR #124):** Habilitación integral de marca blanca y trabajo en equipo (hasta 3 agentes incluidos) durante el periodo de prueba sin requerir tarjeta previa, gobernado por los virtuals `esTrialActivo`, `tieneAccesoActivo` y `marcaBlanca`.
* **Control de acceso y congelación (`soloLecturaSiCongelada`):** Middleware que permite solo lectura de viajes cuando una suscripción o periodo de prueba ha expirado, impidiendo modificaciones no autorizadas.
* **Facturación recurrente con Stripe (P07 - RESUELTO en PR #124):**
  * Integración con Stripe Checkout y Stripe Customer Portal para suscripciones mensuales y anuales (Inicio, Agencia, Pro) y asientos adicionales de agentes.
  * Webhook de Stripe con idempotencia real: verificación previa con `StripeEvent.findOne`, ejecución atómica de cambios en la agencia con validación de timestamp (`stripeEventTimestamp`), y registro en `StripeEvent.create` únicamente tras completarse la operación con éxito en base de datos.
  * Manejo de fallos intermedios, captura de clave duplicada Mongo 11000 sin emitir 500 y reintentos limpios sin generación de estados inconsistentes.
  * Derivación dinámica de planes y asientos extra a partir de los Price IDs reales de los ítems de la suscripción, mitigando desalineaciones desde el portal de Stripe.
  * Proceso seguro de cancelación sin bloqueo ante borrado de cuentas (`cancelarSuscripcion`).

#### F. Seguridad, Autenticación y Auditoría
* **Sesiones seguras:** Autenticación JWT con cookies HttpOnly, sincronización de estado de sesión entre pestañas del navegador y validación de identidad en peticiones privadas.
* **Auditoría de eventos sensibles (`AuditLog`):** Registro de cambios críticos de cuentas, uniones a agencias y operaciones de facturación.
* **Manejo de errores y resiliencia:** Middleware centralizado con protección contra fugas de información interna en producción y limitadores de tasa de peticiones (rate limiting).

---

### 2. En Desarrollo
*(Funcionalidades en proceso activo de ajuste, integración o resolución técnica)*

* **Resolución de hallazgos restantes de la auditoría de lanzamiento:** Auditoría y hardening continuo tras la resolución y merge en `main` (PR #124, commit `43c18b0`) de P05 (Trial), P07 (Robustez de Webhook) y Privacidad de Desglose.
* **Reconciliación periódica de suscripciones de Stripe:** Tarea programada (cron job) para verificar y sincronizar en segundo plano el estado de agencias contra la API de Stripe ante posibles fallos de entrega acumulados de webhooks.

---

### 3. Planeado / Aprobado
*(Funcionalidades con decisión formal de producto pendientes de inicio técnico)*

* **Cobro digital de honorarios de agencia:** Módulo opcional para que el asesor pueda cobrar anticipos o tarifas de consultoría directamente al cliente final a través de su propia cuenta de cobro conectada (sin intermediación de inventario turístico).
* **Notificaciones automáticas multicanal:** Alertas por correo electrónico y mensajería (WhatsApp) al asesor cuando un cliente acepta una propuesta pública o cuando se aproxima la fecha de viaje.
* **Reportes comerciales y analíticas de conversión:** Panel con métricas de desempeño por agente (propuestas emitidas vs. aceptadas, tiempos de respuesta y volumen cotizado).

---

### 4. Ideas No Aprobadas / Descartadas
*(Propuestas y conceptos evaluados y expresamente descartados según `decisiones-rumbia.md`)*

* **Conversión en OTA (Online Travel Agency) / Venta directa de boletos:** Descartado formalmente. Rumbia no emite reservas, no gestiona inventario con GDS ni procesa pagos de servicios a aerolíneas u hoteles.
* **Comisiones por transacción de viaje / Markup sobre el inventario:** Descartado. Rumbia se sustenta exclusivamente en el modelo SaaS de suscripción mensual/anual de software.
* **Cobro por volumen de cotizaciones o límite estricto de propuestas:** Descartado para no desincentivar el uso diario de la plataforma por parte de los agentes.
* **Publicidad de terceros en la interfaz o propuestas:** Descartado por incompatibilidad con el servicio de marca blanca corporativa.
