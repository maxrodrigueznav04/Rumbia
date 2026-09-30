# Implementación de plantillas visuales

Estado: **beta preparada en una rama separada, sin habilitar en producción**. Esta página registra el trabajo real y lo que falta antes de ofrecer la función a agencias. Los pasos del entorno separado están en [la guía de despliegue beta](plantillas-visuales-beta-despliegue.md).

## Etapa 1: base guardable (hecha en esta rama)

- Modelo `VisualTemplate` independiente de `ItineraryTemplate`.
- API para listar, crear, leer, editar, duplicar y archivar; solo el dueño de la agencia modifica la plantilla maestra.
- Cupos por plan y reserva de posición activa para evitar que dos creaciones simultáneas excedan el límite.
- Documento de diseño validado: páginas A4 fijas con texto, campos permitidos y formas; sin acceso a costos netos ni notas internas.
- Editor de borrador para páginas fijas con movimiento, tamaño, color, texto, campos, orden de capas, alineación, tipografías, deshacer/rehacer y guardado. Disponible en desarrollo y oculto en producción salvo `VITE_ENABLE_VISUAL_TEMPLATES=true`.
- El diseño inicial omite la foto interior.
- Trece diseños de partida se muestran con portada de ejemplo y filtros por tipo de viaje. Usan cuatro composiciones de portada, cuatro diseños de presentación y seis imágenes de muestra: tres fotografías reales con licencia Unsplash y tres imágenes generadas para Rumbia, descritas en `server/assets/visual-presets/README.md`. Son imágenes ilustrativas, no una afirmación visual sobre el destino; la agencia puede sustituir la portada con una imagen propia. La segunda página presenta momentos del viaje, precio público y una invitación a conversar, sin afirmar disponibilidad, descuentos o servicios no confirmados. Una agencia puede guardar y publicar cualquiera en un paso, o crear desde cero. No se exige que la agencia suba una foto. El cupo y los permisos existentes siguen aplicando.
- El editor pone Deshacer, Rehacer y Guardar encima del lienzo; añadir elementos y las opciones detalladas se abren cuando se necesitan. En móvil se ve primero el lienzo y después los paneles de ajustes.

## Etapa 2: activos y diseño completo (parcial)

- Biblioteca de imágenes por agencia con confirmación de derechos, verificación básica del contenido real, límites y conservación de origen/licencia. El borrado de agencia elimina activos y los PDFs de GridFS; si Cloudinary falla conserva las referencias para reintentar. Prueba automatizada con fallo/reintento y aislamiento entre agencias; falta probarla con la cuenta real de Cloudinary.
- Imagen de portada sustituible y fotos interiores opcionales, sin cuadros vacíos cuando se omitan. El arte de muestra se incrusta en el PDF sin depender de un servicio externo; las fotos de agencia conservan la verificación de pertenencia y derechos declarados.
- El lienzo permite reordenar capas, alinear elementos, moverlos con flechas y cambiar la tipografía de títulos y texto. La sección variable del itinerario admite título, color de acento, tamaños y visibilidad de horarios/descripciones. Faltan guías visuales, controles de espaciado y una previsualización de esa sección dentro del editor.
- Previsualización con datos reales y casos corto/largo; la muestra actual del editor usa valores de ejemplo.

## Etapa 3: propuesta por viaje y PDF (implementación local, pendiente de validación operativa)

- Elegir plantilla publicada dentro de un viaje y guardar una instancia editable sin cambiar la maestra (implementado). La instancia permite ajustar título, mensaje e imagen de portada; falta ampliar los ajustes propios del viaje.
- Crear una revisión inmutable al emitir, con versión de diseño, datos públicos autorizados y el PDF final archivado en GridFS (implementado). Descargar una versión recupera los mismos bytes y comprueba su hash. El modelo tiene `variantSlot` para varias propuestas por viaje en el futuro; la interfaz usa solo una.
- Generar vista previa y PDF desde el mismo HTML seguro. Playwright controla Chromium en un proceso hijo, con una emisión simultánea para la beta gratuita. El build instala su navegador y emite un PDF real antes de aceptar el despliegue. Las tipografías Playfair Display, Libre Baskerville y Work Sans se incluyen con sus licencias en cliente y servidor: no dependen de fuentes del sistema. Los campos dinámicos reducen su tamaño contando los saltos entre palabras; el editor usa el mismo cálculo. El renderizador sigue rechazando desbordes. Pasaron 26 PDFs locales (3 y 15 días, trece diseños); falta medir memoria, tiempo y arranque en Render real.
- Las imágenes subidas necesitan credenciales Cloudinary configuradas. La API verifica agencia y derecho declarado, y bloquea borrar una imagen utilizada por plantillas, propuestas o versiones emitidas. Falta probar subida/borrado contra la cuenta real de Cloudinary.
- Las rutas del servidor están desactivadas en producción salvo `VISUAL_TEMPLATES_ENABLED=true` y una agencia autorizada en `VISUAL_TEMPLATES_AGENCIES`. La API devuelve la autorización y el cliente la comprueba además de su bandera. Las ilustraciones usan la URL absoluta de la API para funcionar entre Vercel y Render. Se añadieron rutas SPA y cabeceras de seguridad para Vercel.
- Prueba de integración con MongoDB temporal y Chromium instalado: dos agencias, dueño/agente, límite de Inicio, cambio de plan, reutilización de una plantilla en dos viajes, edición independiente, vista previa, dos emisiones reales, descarga idéntica y rechazo de acceso ajeno. Pruebas de arranque beta: rechazo de otra base, conservación de contraseña y ediciones al reiniciar.
- Revisión visual local en Chrome de la lista, editor, guardado y recarga de una plantilla, selección para un viaje y vista previa; sin errores de consola. La sesión y los datos usados eran temporales.
- Mantener la impresión heredada y el itinerario web como entregables distintos hasta que el nuevo PDF esté comprobado.

## Puerta de publicación

No activar `VITE_ENABLE_VISUAL_TEMPLATES` ni `VISUAL_TEMPLATES_ENABLED` en producción hasta verificar con datos reales: reutilización en dos viajes, PDFs de 3 y 15 días con textos e imágenes variables, ausencia de desbordes, vista previa concordante, permisos de agencia, cupos tras cambio de plan, cero exposición de campos internos y operación de Chromium/Cloudinary en el entorno de despliegue. La impresión heredada y el itinerario web siguen disponibles como entregables separados.
