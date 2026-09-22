# Auditoría de Seguridad, Resiliencia y Preparación de Lanzamiento — Rumbia

**Última actualización:** 21 de septiembre de 2026  
**Rama principal:** `main` (HEAD: `43c18b0`)  
**Propósito:** Seguimiento técnico formal del estado de los hallazgos de auditoría (seguridad, aislamiento multi-tenant, ciclo de facturación, resiliencia de IA y privacidad de propuestas).

---

## 1. Tablero Ejecutivo de Estado

| Código | Categoría | Severidad Original | Descripción Corta | Estado Actual | Solución / Resolución |
|---|---|---|---|---|---|
| **P05** | Acceso / Billing | ALTO | Bloqueo indebido de funciones (equipo, marca blanca) en periodo de prueba de 14 días | **RESUELTO** | **PR #124** (`43c18b0`) — Virtuals `esTrialActivo`, `tieneAccesoActivo`, `marcaBlanca` y middleware `billing.js` |
| **P07** | Stripe / Billing | ALTO | Falta de idempotencia real y riesgo de inversión de estados o duplicidad en webhook | **RESUELTO** | **PR #124** (`43c18b0`) — `StripeEvent.findOne`, persistencia post-mutación, captura `11000` y control de timestamp |
| **S3** | Privacidad | ALTO | Deducción matemática de margen comercial en propuesta pública con "ocultar desglose" | **RESUELTO** | **PR #124** (`43c18b0`) — `ocultarDesglose: true` y `ocultarCodigos: true` por defecto; sanitización backend de totales |
| **S1** | Seguridad | ALTO | Exintegrante conserva vía de lectura a clientes de su antigua agencia | MITIGADO / CERRADO | Filtro de pertenencia por agencia y creador en `client.controller.js` y `trip.controller.js` |
| **S2** | Seguridad | ALTO | Exintegrante puede borrar plantillas compartidas que creó | MITIGADO / CERRADO | Validación combinada de autoría y membresía activa en `templates.controller.js` |
| **S4** | Seguridad | ALTO | Registro y pruebas gratuitas permiten abuso de identidad y consumo | EN PROCESO | Rate limits dedicados, CAPTCHA Turnstile y verificación de email en registro |
| **S5** | Seguridad | MEDIO | Migración a cookie httpOnly y revocación de sesión pendientes | MITIGADO | Cookies `httpOnly`, `SameSite=Lax` y eliminación de JWT en respuestas de sesión |
| **S6** | Dependencias | MEDIO | Avisos conocidos en árbol de dependencias (`qs`, `body-parser`) | EN SEGUIMIENTO | Monitoreo continuo mediante Dependabot y auditorías periódicas de npm |
| **B1** | Stripe | ALTO | Checkout duplicado y Customers de Stripe sin vinculación persistida previa | EN PROCESO | Reutilización de sesiones de checkout abiertas y verificación por agencia |
| **B2** | Stripe | ALTO | Borrado de cuenta/agencia puede dejar suscripciones recurrentes activas | EN PROCESO | Cancelación explícita de suscripción en Stripe antes de eliminación en MongoDB |
| **B3** | Stripe | ALTO | Activación o congelación por eventos atrasados de Stripe | **RESUELTO (P07)** | Integrado en resolución P07 (`stripeEventTimestamp` en `billing.controller.js`) |
| **B4** | Stripe | ALTO | Sincronización parcial de cambios de plan, asientos y renovación | EN PROCESO | Mapeo de Price IDs a planes y asientos en webhooks |
| **B5** | Stripe | ALTO | Checkout terminado no se comprueba como pago confirmado | EN EVALUACIÓN | Confirmación de `payment_status` antes de otorgar beneficios |
| **B6** | Frontend | MEDIO | Confirmaciones y "total a pagar" en UI pueden diferir | EN PROCESO | Cálculo de base + asientos en cliente y servidor |
| **R1** | IA (Gemini) | ALTO | Fallo de cuota en muestra pública de IA | EN MONITOREO | Manejo de cuotas, fallbacks de modelos (`gemini-2.5-flash` a `flash-lite`) y límites por IP |
| **R2** | IA (Gemini) | ALTO | Timeouts acumulados superan tiempo de espera del navegador | MITIGADO | Timeout de 150s en servicio Gemini y 190s en servidor Node |
| **R3** | IA (Gemini) | ALTO | Límites mensuales de itinerarios y chat por plan no reforzados | MITIGADO | Contadores centralizados `billing.usoIA` en `Agency.js` |
| **R4** | IA (Gemini) | ALTO | Concurrencia en contadores de cuota y rate limits | EN PROCESO | Validaciones atómicas y límites diferenciados |
| **R5** | Infraestructura | ALTO | Disponibilidad insuficiente en planes con suspensión por inactividad | EN PROCESO | Health check readiness y configuración de producción |
| **R6** | IA (Gemini) | MEDIO | Salida de IA incompleta o coordenadas nulas convertidas a 0,0 | MITIGADO | `ITINERARY_SCHEMA` estricto en Gemini con validación de días y actividades |
| **L1** | Legal / Privacidad | ALTO | Aviso de privacidad incompleto conforme a LFPDPPP | EN PROCESO | Actualización del aviso de privacidad y canales ARCO |
| **L2** | Legal / Privacidad | ALTO | Ciclo de eliminación incompleto y bloqueo de revocación sin suscripción | MITIGADO | Excepción explícita en middleware para revocar enlace público con cuenta congelada |
| **L3** | Privacidad | ALTO | Envío de datos personales a Gemini | MITIGADO | Minimización de datos en prompts y advertencias visibles al asesor |
| **U1** | UX | MEDIO | Pérdida de itinerario de demostración tras registro | PENDIENTE | Persistencia temporal en local/sesión antes de registrarse |
| **U2** | UX | MEDIO | Confusión de promesas de reservas y acceso en trial | **RESUELTO (P05)** | Acceso completo a equipo y marca blanca durante trial de 14 días |
| **U3** | Resiliencia | MEDIO | Entrega no durable de correos de recuperación | EN PROCESO | Integración con Resend y control de errores |
| **D1** | DevOps | ALTO | Despliegue sin dependencia estricta de CI | MITIGADO | Pipeline de CI en GitHub Actions con validación antes de despliegue |
| **D2** | Arquitectura | ALTO | Propiedad de viajes no explícitamente vinculada a la agencia | MITIGADO | Campo `agency` en `Trip` y aislamiento multi-tenant en queries |
| **D3** | Base de Datos | ALTO | Operaciones multi-documento sin transaccionalidad | EN PROCESO | Operaciones por etapas y mitigación de inconsistencias |
| **D4** | Comercial | MEDIO | Aceptación de propuesta sin versionado ni snapshot | MITIGADO | `marcaCompartida` y registro de fecha en aceptación digital |

---

## 2. Detalle de Hallazgos Recientemente Resueltos

### P05 — Acceso y Permisos durante el Periodo de Prueba (14 Días)
* **Estado:** **RESUELTO**
* **Commit / PR:** [PR #124](https://github.com/maxrodrigueznav04/Rumbia/pull/124) — Commit `43c18b0` (rama `fix/trial-stripe-privacy`).
* **Archivos intervenidos:**
  - `server/src/models/Agency.js`
  - `server/src/middleware/billing.js`
  - `server/src/controllers/agency.controller.js`
* **Descripción del problema histórico:**  
  Las agencias recién creadas recibían un periodo de prueba de 14 días, pero el middleware de facturación (`billing.js`) y el controlador de agencia (`agency.controller.js`) exigían una suscripción activa de pago (`billing.status === 'activa'`) para permitir la personalización de marca blanca en PDFs y la incorporación de agentes colaboradores al equipo. Esto contradecía la propuesta comercial de evaluación completa del SaaS.
* **Solución técnica implementada:**
  1. **Virtuals de Negocio en `Agency.js`:**
     - `esTrialActivo`: Determina si la agencia se encuentra dentro de su ventana de 14 días (`trialHasta > Date.now()`).
     - `tieneAccesoActivo`: Retorna `true` si la suscripción está `'activa'` O si `esTrialActivo` es verdadero.
     - `marcaBlanca`: Habilita la eliminación de la marca de agua y personalización visual si el plan es `'agencia'`, `'pro'` O si `esTrialActivo` es verdadero.
  2. **Middleware de Acceso (`billing.js`):** Se actualizó la verificación para validar contra `agencia.tieneAccesoActivo` en lugar de una comparación rígida de status.
  3. **Adhesión de Miembros (`agency.controller.js`):** Se permite la incorporación de hasta 3 agentes durante el periodo de prueba sin requerir tarjeta de crédito previa.

---

### P07 — Idempotencia y Robustez en Webhooks de Stripe
* **Estado:** **RESUELTO**
* **Commit / PR:** [PR #124](https://github.com/maxrodrigueznav04/Rumbia/pull/124) — Commit `43c18b0` (rama `fix/trial-stripe-privacy`).
* **Archivos intervenidos:**
  - `server/src/controllers/billing.controller.js`
  - `server/scripts/smoke-test.mjs`
* **Descripción del problema histórico:**  
  La recepción de webhooks de Stripe carecía de un mecanismo transaccional seguro:
  - Los reintentos de Stripe ante fallos transitorios podían reprocesar eventos o generar estados duplicados.
  - Se guardaba el registro del evento en `StripeEvent` antes de confirmar las mutaciones en MongoDB, impidiendo que los reintentos legítimos de Stripe completaran una operación fallida.
  - Si dos eventos idénticos llegaban concurrentemente, el error de índice único de Mongo (`11000`) provocaba una respuesta HTTP 500 no controlada.
  - Eventos antiguos desfasados en la red podían sobreescribir estados más recientes.
* **Solución técnica implementada:**
  1. **Verificación Previa de Idempotencia:** `StripeEvent.findOne({ eventId })` verifica si el evento ya fue completado. En tal caso, responde inmediatamente HTTP 200 con `{ received: true, duplicado: true }`.
  2. **Persistencia Post-Operación:** `StripeEvent.create` se invoca únicamente **después** de que las actualizaciones en MongoDB de la agencia se hayan ejecutado exitosamente. Si la base de datos falla a la mitad, no se registra el evento y Stripe puede reintentarlo.
  3. **Captura de Colisiones Concurrentes:** Se captura explícitamente el código de error `11000` de MongoDB devolviendo HTTP 200, evitando que Stripe reciba errores 500 ante colisiones de reintento.
  4. **Protección contra Desorden de Red:** Validación de timestamp (`event.created >= agencia.billing.ultimoEventoStripeEn`) para descartar eventos atrasados.

---

### S3 — Privacidad Comercial y Blindaje del Margen en Propuestas Públicas
* **Estado:** **RESUELTO**
* **Commit / PR:** [PR #124](https://github.com/maxrodrigueznav04/Rumbia/pull/124) — Commit `43c18b0` (rama `fix/trial-stripe-privacy`).
* **Archivos intervenidos:**
  - `server/src/models/Trip.js`
  - `server/src/validators/schemas.js`
  - `server/src/controllers/public.controller.js`
  - `server/src/controllers/itinerary.controller.js`
  - `client/src/components/formularios/FormViaje.jsx`
  - `client/src/locales/es/agencia.json` y `client/src/locales/en/agencia.json`
* **Descripción del problema histórico:**  
  Aunque el asesor marcara la casilla "Ocultar desglose", el endpoint público `/api/public/itinerary/:token` entregaba los campos `coreCosts.total` y `itinerary.totalEstimatedCost`. Dado que el precio final por persona y el número de viajeros eran públicos, cualquier cliente o competidor podía restar algebraicamente los costos internos del total y deducir con exactitud el margen comercial y honorarios de la agencia.
* **Solución técnica implementada:**
  1. **Valores por Defecto Protectores:**
     - `ocultarDesglose: true` por defecto en el modelo `Trip.js` y en los esquemas de validación Zod (`schemas.js`) para toda propuesta nueva.
     - `ocultarCodigos: true` por defecto para proteger localizadores y notas privadas de reserva.
  2. **Sanitización Rigurosa en Backend (`public.controller.js`):**
     - Cuando `ocultarDesglose` está activo, el servidor suprime deliberadamente `coreCosts.total` y `itinerary.totalEstimatedCost`, además de los importes individuales de cada actividad y transporte.
     - Se elimina cualquier variable intermedia que permita la ingeniería inversa matemática del margen comercial.
  3. **Retrocompatibilidad Histórica:**
     - Los viajes creados con anterioridad que tengan `ocultarDesglose: false` conservan intacto su valor, respetando la decisión explícita de aquellas agencias que desean mostrar un desglose abierto a sus clientes.

---

## 3. Verificación y Calidad Automatizada

Todas las correcciones consolidadas en `main` cuentan con cobertura automatizada en el repositorio:

* **Backend (`server/scripts/smoke-test.mjs` + Node test runner):**
  - **149 checks automatizados** en smoke test sin dependencias externas de base de datos.
  - **4 tests** adicionales en el runner nativo de Node.js.
  - Validación específica de virtuals de `Agency.js` (P05), flujo de webhook de Stripe (P07) y sanitización pública (S3).
* **Resiliencia (`server/scripts/resilience.test.mjs`):**
  - **4 tests** de límites de trabajo, desconexión de clientes y sanitización de errores 5xx/4xx.
* **Frontend (`client/` vía Vitest):**
  - **9 suites de prueba / 85 tests unitarios** que verifican formularios, cotización, estados de autenticación y componentes visuales.
* **Compilación de Producción:**
  - `npm run build` en `client/` compila limpiamente sin advertencias de tipo ni errores de empaquetado.
