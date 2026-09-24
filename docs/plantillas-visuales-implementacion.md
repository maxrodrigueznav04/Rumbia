# Implementación de plantillas visuales

Estado: **en desarrollo, sin habilitar en producción**. Esta página registra el trabajo real y lo que falta antes de ofrecer la función a agencias.

## Etapa 1: base guardable (hecha en esta rama)

- Modelo `VisualTemplate` independiente de `ItineraryTemplate`.
- API para listar, crear, leer, editar, duplicar y archivar; solo el dueño de la agencia modifica la plantilla maestra.
- Cupos por plan y reserva de posición activa para evitar que dos creaciones simultáneas excedan el límite.
- Documento de diseño validado: páginas A4 fijas con texto, campos permitidos y formas; sin acceso a costos netos ni notas internas.
- Editor de borrador para páginas fijas con movimiento, tamaño, color, texto, campos, deshacer/rehacer y guardado. Disponible en desarrollo y oculto en producción salvo `VITE_ENABLE_VISUAL_TEMPLATES=true`.
- El diseño inicial omite la foto interior. Las imágenes todavía no se pueden subir ni insertar; el esquema reserva su tipo, pero la API rechaza esos elementos hasta tener biblioteca con control de pertenencia.

## Etapa 2: activos y diseño completo (pendiente)

- Biblioteca de imágenes por agencia con confirmación de derechos, verificación de archivo, límites y conservación de origen/licencia.
- Imagen de portada y fotos interiores opcionales, sin cuadros vacíos cuando se omitan.
- Más herramientas del lienzo: capas, guías, alineación, tipografías, fondos y controles de secciones variables del itinerario.
- Previsualización con datos reales y casos corto/largo; la muestra actual del editor usa valores de ejemplo.

## Etapa 3: propuesta por viaje y PDF (pendiente)

- Elegir plantilla dentro de un viaje y guardar una instancia editable sin cambiar la maestra.
- Crear una revisión inmutable al emitir, con versión de diseño y datos públicos autorizados. Modelo preparado para admitir varias propuestas por viaje después.
- Generar vista previa y PDF desde el mismo modelo. Ejecutar Chromium con Playwright en un proceso/servicio aislado de la API y medir su operación en la infraestructura real.
- Mantener la impresión heredada y el itinerario web como entregables distintos hasta que el nuevo PDF esté comprobado.

## Puerta de publicación

No activar `VITE_ENABLE_VISUAL_TEMPLATES` en producción hasta completar las etapas 2 y 3 y verificar: reutilización en dos viajes, PDFs de 3 y 15 días, ausencia de desbordes, vista previa concordante, permisos de agencia y cero exposición de campos internos.
