# Implementación de plantillas visuales

Estado: **en desarrollo, sin habilitar en producción**. Esta página registra el trabajo real y lo que falta antes de ofrecer la función a agencias.

## Etapa 1: base guardable (hecha en esta rama)

- Modelo `VisualTemplate` independiente de `ItineraryTemplate`.
- API para listar, crear, leer, editar, duplicar y archivar; solo el dueño de la agencia modifica la plantilla maestra.
- Cupos por plan y reserva de posición activa para evitar que dos creaciones simultáneas excedan el límite.
- Documento de diseño validado: páginas A4 fijas con texto, campos permitidos y formas; sin acceso a costos netos ni notas internas.
- Editor de borrador para páginas fijas con movimiento, tamaño, color, texto, campos, orden de capas, alineación, tipografías, deshacer/rehacer y guardado. Disponible en desarrollo y oculto en producción salvo `VITE_ENABLE_VISUAL_TEMPLATES=true`.
- El diseño inicial omite la foto interior.
- Trece diseños de partida se muestran con portada de ejemplo y filtros por tipo de viaje. Diez están orientados a escenarios comerciales concretos (pareja, familia, distinción, costa, ciudad, naturaleza, gastronomía, celebración, ruta y bienestar). Su presentación incluye momentos del viaje, precio público y una invitación a conversar con la agencia, sin afirmar disponibilidad, descuentos o servicios no confirmados. Una agencia puede guardar y publicar cualquiera en un paso, o crear desde cero. Ninguno exige imágenes. El cupo y los permisos existentes siguen aplicando.
- El editor pone Deshacer, Rehacer y Guardar encima del lienzo; añadir elementos y las opciones detalladas se abren cuando se necesitan. En móvil se ve primero el lienzo y después los paneles de ajustes.

## Etapa 2: activos y diseño completo (parcial)

- Biblioteca de imágenes por agencia con confirmación de derechos, verificación básica del contenido real, límites y conservación de origen/licencia (implementada; falta probarla con la configuración real de Cloudinary y completar el borrado al eliminar una agencia).
- Imagen de portada y fotos interiores opcionales, sin cuadros vacíos cuando se omitan (implementado en el editor de borrador; falta comprobar la misma composición en PDF).
- El lienzo permite reordenar capas, alinear elementos, moverlos con flechas y cambiar la tipografía de títulos y texto. La sección variable del itinerario admite título, color de acento, tamaños y visibilidad de horarios/descripciones. Faltan guías visuales, controles de espaciado y una previsualización de esa sección dentro del editor.
- Previsualización con datos reales y casos corto/largo; la muestra actual del editor usa valores de ejemplo.

## Etapa 3: propuesta por viaje y PDF (implementación local, pendiente de validación operativa)

- Elegir plantilla publicada dentro de un viaje y guardar una instancia editable sin cambiar la maestra (implementado). La instancia permite ajustar título, mensaje e imagen de portada; falta ampliar los ajustes propios del viaje.
- Crear una revisión inmutable al emitir, con versión de diseño, datos públicos autorizados y el PDF final archivado en GridFS (implementado). Descargar una versión recupera los mismos bytes y comprueba su hash. El modelo tiene `variantSlot` para varias propuestas por viaje en el futuro; la interfaz usa solo una.
- Generar vista previa y PDF desde el mismo HTML seguro (implementado). Playwright controla Chromium en un proceso hijo con límite de concurrencia. Los campos dinámicos de título y destino reducen su tamaño cuando el contenido es largo; el renderizador sigue rechazando cualquier desborde. Se probaron PDFs locales de 3 y 15 días para los trece diseños y un título largo en una portada estrecha; falta medir memoria, tiempo y costo en la infraestructura real y provisionar Chromium allí.
- Las imágenes subidas necesitan credenciales Cloudinary configuradas. La API verifica agencia y derecho declarado, y bloquea borrar una imagen utilizada por plantillas, propuestas o versiones emitidas. Falta probar subida/borrado contra la cuenta real de Cloudinary.
- Las rutas del servidor también están desactivadas en producción salvo `VISUAL_TEMPLATES_ENABLED=true`; activar solo la bandera del cliente no habilita la API.
- Prueba de integración con MongoDB temporal y Chrome local: dos agencias, dueño/agente, límite de Inicio, cambio de plan, selección, vista previa, emisión, descarga idéntica y rechazo de acceso ajeno.
- Revisión visual local en Chrome de la lista, editor, guardado y recarga de una plantilla, selección para un viaje y vista previa; sin errores de consola. La sesión y los datos usados eran temporales.
- Mantener la impresión heredada y el itinerario web como entregables distintos hasta que el nuevo PDF esté comprobado.

## Puerta de publicación

No activar `VITE_ENABLE_VISUAL_TEMPLATES` ni `VISUAL_TEMPLATES_ENABLED` en producción hasta verificar con datos reales: reutilización en dos viajes, PDFs de 3 y 15 días con textos e imágenes variables, ausencia de desbordes, vista previa concordante, permisos de agencia, cupos tras cambio de plan, cero exposición de campos internos y operación de Chromium/Cloudinary en el entorno de despliegue. La impresión heredada y el itinerario web siguen disponibles como entregables separados.
