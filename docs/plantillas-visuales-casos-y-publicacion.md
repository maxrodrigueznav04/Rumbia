# Plantillas visuales: casos de uso y preparación de publicación

Revisión: 1 de octubre de 2026. Rama: `codex/plantillas-beta`. PR: #128.

## Conclusión

El usuario confirmó que sus pruebas de la beta funcionaron. Se revisaron visualmente sus tres PDF: dos documentos cortos de 3 páginas y uno de 15 días en 6 páginas, sin recortes ni páginas vacías observadas. Uno de esos archivos era de una prueba local anterior; los otros dos proceden de la sesión reciente de pruebas.

La revisión posterior encontró y corrigió pérdida de cambios al salir, reemplazo de ajustes sin aviso, selección con una revisión antigua, formato de actividades sin hora, falta de explicación del acceso vencido y del cupo excedido, y una advertencia de borrado que no mencionaba los PDF del viaje. Se añadió un identificador de emisión para recuperar el mismo resultado al reintentar una petición cuya respuesta se perdió.

La aplicación principal aún no tiene activada esta función. Las comprobaciones automatizadas no sustituyen una medida de memoria del servicio gratuito ni la comprobación de borrado contra Cloudinary real.

## Evidencia

- Pruebas de pantalla: `client/src/pages/VisualProposal.test.jsx`.
- Conservación del borrador y separación entre cuentas: `client/src/hooks/useVisualDraft.test.jsx`.
- API con MongoDB temporal y PDF real: `server/scripts/visual-integration.test.mjs`.
- Validación, imágenes, contenido público y errores reales de Chromium: `server/scripts/visual-templates.test.mjs`.
- Reinicio beta y limpieza de agencia/viaje con fallo y reintento remoto simulado: `server/scripts/visual-release.test.mjs`.
- Trece diseños con 3 y 15 días: `server/scripts/visual-pdf-prototype.mjs` (26 PDF).
- Revisión del código para las decisiones de producto que se indican expresamente como tales.

## Matriz de casos

| Situación | Resultado definido | Evidencia o límite |
| --- | --- | --- |
| El agente no quiere usar plantilla | Conserva el PDF habitual y el enlace web. El viaje no crea una propuesta visual automáticamente. | Pantalla y revisión del itinerario. |
| Abre propuesta visual y no elige nada | No se puede emitir; puede volver al itinerario. | Pantalla/API. |
| La agencia no tiene plantillas publicadas | Se indica cómo ir a Plantillas. El dueño puede guardar un diseño listo; un agente requiere que el dueño lo publique. | Permisos y revisión de la interfaz. |
| Elige un diseño listo | Se guarda una plantilla publicada de la agencia y se puede reutilizar. | API y presets. |
| Intenta elegir una plantilla en borrador o archivada | La API la rechaza para una selección nueva. | API. |
| Selecciona una plantilla en un viaje | Se copia su diseño al viaje; no se trabaja directamente sobre la maestra. | API. |
| Cambia el título o mensaje del viaje | Cambia esa propuesta; no cambia la maestra ni otro viaje. | API/pantalla. |
| Edita la maestra después de seleccionarla | La propuesta conserva su copia. Los siguientes viajes pueden usar el nuevo diseño. | Copia de diseño y revisión del código. |
| Quiere cambiar de plantilla con ajustes propios | Debe confirmar el reemplazo; cancelar conserva el contenido. | Pantalla. |
| Selecciona la misma plantilla por accidente | El botón de cambio permanece desactivado. | Interfaz. |
| Recarga o navega fuera sin guardar | Al volver a la misma pestaña se ofrece recuperar o descartar el borrador. Antes de cerrar/recargar se solicita el aviso del navegador. | Pantalla/hook. No es un respaldo entre dispositivos; cerrar la pestaña elimina su almacenamiento de sesión. |
| Se pierde la conexión al guardar | Los cambios permanecen en pantalla y el borrador local permite recuperarlos. | Pantalla. Si el navegador impide almacenar el borrador se muestra un aviso. |
| Vuelve con un borrador y el servidor ya tiene cambios | Se avisa; recuperar exige revisar antes de guardar, descartar mantiene la versión del servidor. | Pantalla. |
| Cambia de cuenta o de agencia | Los borradores se separan por usuario, agencia y documento. | Hook y separación existente de sesión. |
| Dos personas guardan a la vez | Solo una actualización de la misma revisión prospera; la otra recibe un conflicto. | API con dos peticiones concurrentes reales. |
| Una pestaña antigua intenta cambiar la plantilla | Se rechaza por revisión antigua; no pisa el trabajo nuevo. | API. |
| No quiere una imagen interior | No se exige; el diseño inicial y los presets funcionan sin ella. | Validación, 26 PDF y pruebas del usuario. |
| No quiere imágenes en ninguna página | La plantilla básica funciona sin imágenes; el dueño también puede eliminar el arte de un preset. Debe conservar contenido útil en sus páginas. | Diseño básico emitido realmente y revisión del editor. |
| Sube una imagen propia | PNG/JPEG, hasta 8 MB, 300–6000 píxeles por lado, máximo 20 megapíxeles. Debe confirmar derechos de uso. | Validación e inspección de archivo; usuario confirmó foto subida y mostrada en PDF, unos 10 segundos o menos de emisión. |
| Usa una imagen con licencia | Debe confirmar derechos y proporcionar referencia. | Validación del servidor. No sustituye una verificación legal de la licencia. |
| Intenta usar una imagen de otra agencia | La API rechaza referencias que no están en su biblioteca. | Consulta por agencia y revisión del código. |
| Se intenta borrar una imagen usada | Se bloquea si aparece en el diseño actual (incluso sin guardar), otra plantilla, propuesta o emisión. | Pruebas de pantalla y controladores con MongoDB real temporal. Falta confirmar borrado de una imagen suelta con Cloudinary real. |
| Elimina una imagen suelta de biblioteca | Confirma el borrado definitivo; si falla el servicio remoto, conserva el registro y permite reintentar. Deshacer/Rehacer no vuelven a insertarla tras un borrado exitoso. | Cuatro pruebas de pantalla y controladores con Cloudinary simulado; pendiente prueba remota real. |
| Cloudinary no está configurado o falla | La subida devuelve un error; puede usar el arte incluido o un diseño sin fotos. | Servicio y validación. |
| Una imagen no carga al emitir | No se emite un PDF con esa imagen rota; se pide revisarla. El generador funciona tras corregir el problema. | Chromium real. |
| El texto no cabe en un cuadro fijo | Se rechaza la emisión con un mensaje para ajustar el cuadro o el texto. | Chromium real. |
| Añade una página vacía | Puede conservarla mientras diseña; la vista previa/emisión pide completarla o eliminarla. | Prueba de renderizado HTML. |
| Una actividad no tiene hora | Ocupa el ancho disponible y no deja una columna estrecha para su título. | HTML y CSS. |
| Falta precio | Se muestra «Precio por confirmar». | Datos públicos. |
| Falta contacto de agencia | El campo queda vacío; no se inventan datos. | Preparación de datos. |
| No hay itinerario | No se prepara una vista previa ni se emite hasta que exista. | Control en la API. |
| Acorta fechas y conserva días sobrantes | Se bloquea la propuesta hasta revisar esos días; no se descarta contenido silenciosamente. | API. |
| Cambia fechas, actividades o precio después de ver la vista previa | El hash de contenido impide emitir con esa vista previa antigua y exige revisarla. | Cambio de itinerario probado en API. |
| Cambia la propuesta o pierde acceso durante la generación | Antes de archivar se revisan de nuevo propuesta, viaje, pertenencia, agencia y cupo. | Revisión del código; cambios durante el render no se inyectaron en una prueba real. |
| Generador ocupado | Devuelve un aviso de ocupación y permite reintentar; no abre otro Chromium en ese proceso. | Prueba real de dos emisiones simultáneas. |
| Documento excesivo, fallo de imagen o desborde | Se rechaza con error y se libera la capacidad para la siguiente emisión. | Prueba real de fallo y recuperación. |
| Se pierde la respuesta de una emisión y reintenta | Se conserva el identificador de la solicitud mientras conserva esa vista previa; devuelve la misma emisión. | Pantalla y API con reintento real. Recargar y solicitar una vista previa nueva representa una nueva emisión. |
| Edita el viaje después de emitir | El PDF anterior recupera los bytes archivados; una emisión nueva puede recoger los datos actuales. | API y hash del archivo. |
| Se daña o falta el PDF archivado | Se muestra un error; no se reconstruye un documento distinto bajo el mismo número. | Archivo y hash. |
| Archiva la plantilla maestra | Libera cupo, impide nuevas selecciones y conserva las copias y PDF anteriores. | API/pantalla. |
| Elimina una plantilla completa | El dueño confirma una eliminación definitiva de borrador, publicada o archivada. Libera cupo y conserva copias de viajes, PDF y biblioteca; no se restaura la maestra. | Pantalla y API con MongoDB real temporal; descarga histórica idéntica, edición y nueva emisión tras borrar. |
| Cancela eliminar o falla la petición | Cancelar no envía el borrado; un error conserva la plantilla y se muestra en la confirmación. | Pruebas de pantalla. |
| Otra pestaña modifica o elimina antes de confirmar | La revisión vista es obligatoria; una revisión antigua se rechaza, dos borrados simultáneos solo producen una eliminación exitosa. | API, revisión de filtro atómico y concurrencia real. |
| Un agente o una agencia ajena intenta eliminar | No tiene permiso; el dueño puede eliminar también si vence el plan. | Pantalla y API. |
| Restaura una plantilla | Necesita cupo y acceso activo; se restaura como borrador y puede publicarla después. | Código de lista y validación de cupo. |
| Llega al cupo de su plan | No puede crear/duplicar/restaurar otra activa; puede archivar para liberar lugar. | API. |
| Dos creaciones compiten por el último cupo | Una prospera; la otra se rechaza. | Dos peticiones concurrentes con índice único real. |
| Baja de plan y tiene plantillas de más | Se conservan los datos. Debe archivar las sobrantes antes de nuevas selecciones/emisiones. | API/pantalla. |
| Vence el plan | Bloquea edición y nuevas emisiones; conserva lectura y descargas. El dueño puede archivar. | API/pantalla. |
| El agente intenta cambiar la maestra | Solo el dueño puede administrarla. El agente sí puede ajustar propuestas de viajes de su agencia con acceso activo. | API. |
| Abre datos de otra agencia | Se rechazan plantilla, propuesta, imágenes y descarga ajenas. | API y consultas por agencia. |
| El viaje es personal, aunque el usuario pertenezca a una agencia | Usa la impresión habitual; no se presenta el botón de propuesta de agencia. | Interfaz y validación de pertenencia en servidor. |
| Pega una dirección con ID inválido | Devuelve viaje no encontrado, no una excepción de MongoDB. | API. |
| Intenta insertar un campo privado | El esquema admite solo campos públicos; netos, margen, notas y códigos privados no se entregan como variables. | Validación y prueba de datos públicos. El texto libre escrito manualmente requiere revisión del agente. |
| El cliente recibe un enlace público | Mantiene el itinerario web actual. La nueva composición se entrega en PDF. | Decisión de alcance y código de enlace existente. |
| Borra el viaje | Tras confirmar, se eliminan su propuesta y su archivo de PDF; la plantilla de agencia se conserva. La confirmación ahora menciona los PDF. | Limpieza de viaje y texto de confirmación. |
| Se elimina la agencia y falla Cloudinary | Conserva las referencias pendientes para reintentar; la otra agencia no se toca. | Fallo/reintento simulado e integración de limpieza. |
| Se reinicia la beta | Conserva las ediciones; no vuelve a sembrar ni restablece la contraseña. | MongoDB temporal y bootstrap. |
| Se deshabilita la función | Se ocultan/bloquean rutas visuales; quedan guardados los datos y sigue el flujo habitual. | Bandera y autorización por agencia. |
| Quiere dos variantes a la vez | La primera versión muestra una propuesta activa por viaje. El modelo admite variantes futuras; no se promete aún una interfaz estándar/premium simultánea. | Alcance explícito. |
| Quiere que vuelos, hoteles y traslados aparezcan automáticamente | Esta versión añade portada, páginas de presentación, precio público y días/actividades. No incluye una sección automática de logística detallada. Puede añadir texto público a sus páginas o usar la impresión habitual; ampliar esta sección es trabajo funcional pendiente si se exige esa paridad. | Revisión del conjunto de datos y del renderizador. |

## Pendientes antes de habilitar la aplicación principal

1. **Borrado de plantilla completa cerrado:** el usuario confirmó la eliminación en beta el 2 de octubre. Commit `00ee475`, web READY y CI `37076086470` exitoso. Conservación de propuestas/PDF comprobada en integración. También confirmó advertencia y recuperación del borrador, cancelación de cambio de plantilla y emisión. No repetir estas pruebas sin cambios que las afecten.
2. **Medir Render real:** tiempo de un PDF largo, memoria/CPU durante la emisión y registro de reinicios. Las emisiones exitosas del usuario prueban funcionamiento, no capacidad sostenida para varias agencias.
3. **Completar Cloudinary real:** el usuario ya confirmó foto propia mostrada en PDF, emitido en unos 10 segundos o menos. Se añadió botón de eliminación de biblioteca y se probó confirmación, protección de uso y fallo/reintento simulado. Falta borrar una foto desechable que no esté en ningún documento y confirmar su eliminación remota; eliminar una plantilla no comprueba eliminación de fotos en Cloudinary.
4. **Confirmar un respaldo de la base principal y el ID de la agencia piloto.** No usar la base, cuenta ni arranque sintético de la beta en el servicio real.
5. Verificar el commit exacto y las comprobaciones de GitHub antes de integrar. La publicación en el servicio principal requiere autorización cuando corresponda por el impacto sobre producción indicado en `CLAUDE.md`.

## Orden de publicación del piloto

1. Mantener la función visual apagada en la aplicación principal mientras se integra el código verificado.
2. En la API principal, confirmar `npm ci && npm run build:render` y `npm start`.
3. Configurar `VISUAL_TEMPLATES_ENABLED=true` y `VISUAL_TEMPLATES_AGENCIES=<ID de la agencia piloto>`; desplegar y confirmar salud e instalación de Chromium.
4. En la web principal, conservar su `VITE_API_URL` de producción y configurar `VITE_ENABLE_VISUAL_TEMPLATES=true` como Config en Production. Desplegar después de la API.
5. Probar en la agencia piloto: elegir plantilla, emisión corta/larga, descarga histórica y una cuenta fuera del piloto que conserve el flujo habitual.
6. Si la prueba operativa falla, desactivar `VISUAL_TEMPLATES_ENABLED` y desplegar la API. No borrar plantillas ni archivos para suspender la función.

No se cambian precios. Ampliar a todas las agencias y cambiar la infraestructura son decisiones posteriores al piloto.
