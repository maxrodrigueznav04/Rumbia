# Plantillas visuales reutilizables para propuestas de Rumbia

**Estado:** especificación de producto para revisión. No describe una función implementada.
**Fecha:** 24 de septiembre de 2026.

## Objetivo

Una agencia diseña una plantilla visual una vez, la guarda y la selecciona al preparar cada nuevo viaje. Rumbia rellena los datos del viaje y produce un PDF que se reconoce como una propuesta de esa agencia. La preparación de la segunda propuesta debe ser más rápida que volver a diseñarla en una herramienta externa.

La necesidad observada en `DaycoEjemplo.pdf` es concreta: el documento actual comienza con logística, repite la misma composición de actividades y deja el precio casi solo en la última página. Que un diseño más personalizable mejore la adquisición o retención de agencias sigue siendo una hipótesis por validar.

## Modelo de diseño acordado

La plantilla combina dos tipos de página:

1. **Páginas fijas de composición libre.** La agencia mueve y dimensiona textos, fotografías, logotipo, formas y campos dinámicos en la portada y en páginas narrativas como bienvenida, presentación de la agencia o cierre.
2. **Secciones de contenido variable.** La agencia diseña el estilo de un día y de una actividad. Rumbia repite esos componentes para los días reales del viaje y crea las páginas necesarias. También ofrece secciones de logística y precio con variantes visuales configurables. Un elemento colocado arbitrariamente sobre el área que crece no debe poder tapar contenido.

El editor debe ofrecer diseños de partida, pero una agencia puede crear una composición propia. Las plantillas visuales son distintas de `ItineraryTemplate`: las actuales reutilizan destinos y actividades; las nuevas reutilizan la presentación comercial.

## Recorrido del agente

1. **Crear plantilla.** Desde la sección de agencia, elegir un diseño inicial o un documento en blanco, asignarle nombre y formato de página.
2. **Diseñar.** Editar páginas fijas, insertar campos autorizados del viaje, configurar el estilo de las secciones variables y ordenar las secciones. Guardar borrador y previsualizar con un viaje de ejemplo corto y otro largo.
3. **Publicar plantilla.** Dejarla disponible para el equipo y, opcionalmente, marcarla como predeterminada. El dueño de la agencia administra la plantilla maestra; los agentes pueden seleccionarla.
4. **Preparar propuesta.** Dentro de un viaje, elegir una plantilla. Rumbia crea una instancia editable para ese viaje, rellena los datos y permite ajustar foto, título o mensaje sin alterar la plantilla maestra.
5. **Revisar y entregar.** Mostrar páginas reales antes de exportar, advertir sobre campos vacíos, imágenes faltantes, desbordes y datos de cotización pendientes. Al emitir el PDF, conservar la versión del diseño y de los datos que vio el viajero.

## Alcance de la primera versión

- Guardar, renombrar, duplicar, seleccionar y archivar plantillas de la agencia.
- Editor libre para portada y páginas narrativas con texto, imágenes, formas simples, logotipo, guías de alineación, capas y deshacer/rehacer.
- Campos dinámicos esenciales: destinatario, destino, fechas, viajeros, nombre y contacto de agencia, título del viaje y precio comercial autorizado.
- Diseño reutilizable de encabezado de día y tarjeta de actividad; paginación automática del itinerario.
- Secciones de resumen de transporte/hospedaje, precio e inclusiones/condiciones que puedan ordenarse y ocultarse.
- Ajustes propios de una propuesta sin modificar la plantilla maestra.
- Vista previa y PDF A4 con composición concordante. La primera entrega de la plantilla visual es exclusivamente PDF; el enlace web actual sigue disponible como un entregable separado, identificado con claridad.
- Versiones de plantilla y registro de la versión entregada. Una propuesta enviada no cambia silenciosamente al editar la plantilla o el viaje.

## Reglas de datos y seguridad

- El diseño consume un conjunto explícito de campos públicos, preparado desde los datos estructurados del viaje. No recibe el objeto completo del viaje ni de la agencia.
- Costos netos, margen, notas internas, códigos de reserva y referencias privadas quedan fuera del editor y del PDF destinado al viajero. Mostrar u ocultar el desglose comercial se resuelve con campos de precio autorizados, sin exponer datos internos.
- Los importes y fechas dinámicos se calculan en Rumbia; el editor no cambia su valor de origen. El agente puede agregar texto comercial libre, diferenciado de esos campos.
- Las imágenes y fuentes deben tener límites de tamaño y formatos admitidos. La plantilla se valida antes de guardarse y antes de generar el PDF.

## Criterios de aceptación

1. Una agencia diseña una plantilla, la usa en dos viajes distintos y vuelve a seleccionarla sin rehacer el diseño.
2. La misma plantilla produce PDFs legibles para viajes de 3 y 15 días, con títulos y descripciones largos, sin cortes, superposiciones ni páginas vacías accidentales.
3. La vista previa coincide con el PDF final en contenido, orden, imágenes y saltos de página relevantes.
4. Un cambio en la plantilla maestra no modifica una propuesta ya entregada; una edición propia del viaje no modifica la plantilla.
5. Ningún campo interno o costo neto puede insertarse mediante variables de la plantilla ni filtrarse en la exportación.
6. Un agente sin permiso de administración no puede modificar o eliminar la plantilla maestra de la agencia.

## Validación antes de ampliar el editor

Mostrar el PDF actual y un prototipo a 3-5 agentes o agencias que preparen propuestas reales. Observar qué quieren personalizar, cuánto tiempo dedican a la plantilla inicial y si la reutilizan en un segundo viaje. Esa muestra orienta el producto; no demuestra por sí sola disposición de pago. Evaluar después con propuestas enviadas, reutilización y entrevistas sobre valor percibido.

## Decisiones de producto y entrega

### 1. Acceso por plan

- **Prueba de agencia activa:** puede crear una plantilla y usar el editor completo, incluida marca blanca, durante el periodo de prueba. Al vencer, la plantilla permanece guardada; no se elimina por falta de pago.
- **Inicio mensual/anual:** una plantilla activa. Puede usar logo y diseño propio, pero el PDF conserva el crédito de Rumbia correspondiente al plan Inicio. No se habilita marca blanca mediante el editor.
- **Agencia mensual/anual:** hasta cinco plantillas activas, con marca blanca.
- **Pro mensual/anual:** hasta quince plantillas activas, con marca blanca.
- **Planes heredados mensual/anual/vitalicio:** hasta cinco plantillas activas y la misma política de crédito de Rumbia que hoy les corresponde; no se reduce ninguna prestación previa.
- **Uso personal sin agencia o agencia sin acceso activo:** no puede crear ni emitir propuestas con plantillas de agencia. Puede seguir usando las funciones que su estado actual permita.

Los límites cuentan plantillas activas, no versiones históricas ni plantillas archivadas. Al bajar de plan, ninguna plantilla se borra: la agencia elige cuáles conservar activas hasta el nuevo límite y las demás quedan archivadas y editables al reactivar un plan suficiente. Estos cupos son un punto de partida comercial y operativo, no una cifra de disposición de pago validada. No se cambian precios ni contratos de Stripe en esta entrega.

### 2. Variantes por viaje

La primera versión permite **una propuesta visual activa por viaje**, con revisiones secuenciales. No incluye dos propuestas simultáneas estándar/premium dentro del mismo viaje. La propuesta activa puede revisarse y volverse a emitir; cada versión emitida conserva sus datos y diseño. El modelo de almacenamiento debe permitir varias propuestas por viaje en el futuro y no imponer una relación única permanente. Mientras tanto, las variantes comerciales pueden prepararse duplicando el viaje con las herramientas existentes.

### 3. Entrega web

La personalización visual nueva se presenta como **PDF de propuesta**. El enlace público actual continúa funcionando con su diseño actual y debe llamarse **itinerario web**, sin prometer que replica la plantilla PDF. Los botones y la vista previa deben distinguir ambos resultados. La paridad visual web se evaluará después de comprobar uso real de las plantillas PDF.

### 4. Motor de exportación

Para los nuevos PDFs visuales, la arquitectura elegida es **renderizado controlado con Chromium mediante Playwright en un proceso o servicio aislado de la API principal**. La vista previa y la exportación deben consumir el mismo modelo de documento y recursos visuales. La impresión actual (`window.print()`) permanece para el formato heredado durante la transición, pero no será el motor final del nuevo editor.

Antes de publicar el motor nuevo, hacer una prueba técnica con la misma plantilla en viajes de 3 y 15 días, textos largos, imágenes y distintos saltos de página. Verificar igualdad entre vista previa y PDF, tiempos, memoria y costo real de operación. La API no debe ejecutar trabajos pesados de PDF en su proceso de atención de solicitudes. Si el renderizado controlado no supera esta prueba, la función no se anuncia como disponible hasta ajustar paginación o infraestructura. Mover la generación al servidor no arregla automáticamente una plantilla mal diseñada.

### 5. Activos visuales y derechos de uso

La primera versión usa **fotografías y otros gráficos cargados por la agencia**, además de sus logos existentes. No incluye búsqueda automática en Google ni un catálogo externo de imágenes. Las subidas se almacenan en el servicio de medios de Rumbia, separadas por agencia, con validación del contenido real, límites de tamaño y dimensiones, versiones optimizadas para pantalla/PDF y borrado al eliminar la agencia o un activo sin referencias.

Antes de subir una imagen, la agencia debe confirmar: «Tengo derecho a usar esta imagen en propuestas comerciales y a compartir los documentos que la incluyan». Se registra quién la subió, cuándo y su origen declarado (propia o con licencia); la agencia puede guardar una referencia de licencia. Rumbia no afirma que esa confirmación verifique por sí sola la titularidad. Una biblioteca de fotografías de terceros solo se añadirá tras integrar una fuente con licencia adecuada y registrar sus condiciones de uso y atribución.
