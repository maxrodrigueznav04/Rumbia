# Prueba técnica de propuesta visual

Este prototipo no está conectado a cuentas, viajes ni datos de producción. Usa contenido ficticio para verificar la idea de una portada de composición fija y días de itinerario que se repiten con saltos de página automáticos.

## Resultado observado

- Mismo HTML y estilo para 3 y 15 días.
- Chromium produjo un PDF A4 de 2 páginas para 3 días y otro de 5 páginas para 15 días.
- Se comprobó visualmente cada página del caso largo. Los días 1-15 aparecen una vez, en orden, sin superposiciones observadas. El cierre queda junto al último día.
- Al mover el precio a la portada, el viaje corto evitó una página de precio casi vacía. Esto es una decisión de este diseño de ejemplo, no una regla para todas las plantillas.

## Qué falta probar

- Textos e imágenes reales de longitud variable, imágenes fallidas o lentas y múltiples estilos creados por usuarios.
- Coincidencia entre vista previa interactiva y PDF generado.
- Rendimiento, memoria y costo del renderizador aislado en la infraestructura que se elija.
- Unicode y accesibilidad del texto extraído: la representación visual de acentos es correcta, pero la extracción de texto de este PDF de Chromium devuelve caracteres de reemplazo para algunos acentos. También ocurre en el PDF actual usado como referencia; no debe asumirse resuelto para el producto nuevo.
- Integración con los permisos, planes y datos públicos autorizados de Rumbia.

El archivo `index.html` acepta `?days=3` o `?days=15` y puede abrirse en un navegador. Los PDFs de revisión están en `output/pdf/` de este worktree. Son muestras de maquetación, no propuestas comerciales listas para enviar.
