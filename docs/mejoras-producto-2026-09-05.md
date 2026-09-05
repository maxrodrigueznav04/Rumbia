# Mejoras de la experiencia de agencia

Cliente implementado en el código local. Servidor integrado con los 13 commits nuevos de GitHub y subido a main en df6e289; despliegue de Render pendiente de confirmar. No se modificaron cuentas de producción.

## Cambios

- Sesión sincronizada entre pestañas, con nombre, agencia y rol visibles. Las peticiones privadas incluyen la identidad esperada y el servidor rechaza una cuenta distinta antes de ejecutar la operación. Al cambiar de identidad se desmontan los formularios y el chat anteriores. Un error de red no se confunde con una sesión vencida.
- Cotización al inicio del viaje: servicios, actividades sugeridas incluidas, cuota, total y precio por persona en la moneda del viaje. Usa la base del enlace público, separada de los gastos internos. Los datos sin capturar aparecen como pendientes.
- Pasos visibles para completar costos, ajustar cliente y margen, revisar la propuesta y preparar su entrega. Vista previa local que respeta el desglose y los códigos privados. El PDF también respeta la ocultación de códigos y notas de las reservas.
- Un único control de gastos internos, sin la segunda gráfica redundante. Estado operativo “Listo para viajar” separado de propuesta “Aceptada”.
- Inicio con propuestas próximas sin enviar, seguimiento de enviadas, salidas en siete días y datos por completar. Los contadores se calculan en el servidor, fuera de la paginación. Las tarjetas identifican al responsable.
- Viajes / Reporte del equipo para el dueño. Tras integrar #85, la lista y sus métricas respetan la pertenencia actual: viajes de la agencia compartidos con sus integrantes y viajes personales previos visibles solo para su autor. Las tarjetas no atribuyen viajes ajenos al usuario actual.
- Configuración dividida en cuenta, marca, equipo y facturación. Un plan activo otorgado sin cliente de Stripe ya no presenta la compra duplicada.
- Nuevo viaje comienza con destino, fechas y viajeros. Preferencias y cliente son desplegables. Las agencias usan ritmo moderado y gasto medio por defecto, sin heredar los gustos personales del asesor.
- Selección paginada y búsqueda de clientes, con registro desde los formularios de creación y edición. Se mantiene la validación de pertenencia del cliente en el servidor.
- Plantillas permite elegir un itinerario existente y abre directamente su formulario de guardado.
- Márgenes laterales restaurados, mejor contraste secundario, encabezado adaptable a móvil y etiquetas accesibles en campos sin nombre explícito.

## Verificación

- Build de producción del cliente.
- Suite Vitest del cliente, incluidas regresiones de cuenta A/B, respuestas antiguas, errores de red, identidad esperada y cálculos de cotización.
- Smoke tests del servidor: modelos, validadores y servicios, sin base de datos.
- `node --test server/scripts/producto.test.mjs`: rechazo de identidad incorrecta, compatibilidad de clientes anteriores, alcance personal y de agencia de las métricas y validación de filtros.
- Navegador local con datos ficticios: inicio, cotización, vista previa, perfil/facturación, nuevo cliente y viaje, selector de plantillas, escritorio y móvil de 390 px, cierre e inicio de sesión sincronizados entre dos pestañas.

Para repetir la revisión visual: `node client/scripts/preview-producto.mjs`, abrir http://127.0.0.1:5173. Cuentas ficticias: `dueno@example.test`, `agente@example.test` y `personal@example.test`; contraseña de prueba cualquiera. La API de ese entorno es simulada y guarda datos solo en memoria. No sirve como prueba de persistencia real en MongoDB ni de pagos, correo, IA o publicación de enlaces.

## Publicación

El cambio requiere publicar cliente y servidor. Publicar primero el servidor conserva compatibilidad con el cliente anterior; después publicar el cliente activa la cabecera de identidad y el nuevo panel. No hay migración de datos ni cambios de precios o contratos de Stripe.

Antes de dar por verificada la versión pública, comprobar con cuentas de prueba reales: persistencia de un cliente y su viaje, cotización/PDF/enlace, y cambio de sesión entre pestañas. No se ejecutaron compras ni envíos de mensajes durante esta revisión.

## Integración con GitHub

Se conservaron los cambios remotos de verificación de correo, privacidad y pertenencia de viajes. Se resolvieron los conflictos de servidor y cliente; 138 pruebas del servidor, 5 de producto y 71 del cliente aprobadas (214), además del build. Respaldo original conservado en el stash codex-respaldo-mejoras-cliente-antes-integracion. El workflow remoto ya incluye VITE_API_URL y espera CI; las mejoras locales del cliente todavía no se han subido.
