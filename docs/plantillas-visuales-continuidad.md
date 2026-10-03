# Rumbia: guía para continuar las plantillas visuales

**Fecha de corte: 1 de octubre de 2026.**

### Repaso al retomar — 2 de octubre de 2026

- La rama local y el PR #128 siguen en `5915be3`. El PR permanece abierto, en borrador y sin fusionar; GitHub lo informa fusionable.
- La ejecución de CI `36941615894` sigue completada con resultado exitoso para esa revisión.
- Vercel informa READY para el despliegue de `5915be3` en el proyecto beta.
- Se volvió a comprobar la página de entrada de la beta y la salud de la API: ambas respondieron HTTP 200. La API permite el origen `https://beta.rumbiamx.com`.
- El usuario aportó una captura de Render: servicio `rumbia-api-beta`, rama `codex/plantillas-beta`, commit `5915be3` en estado **Live**, con el último despliegue exitoso. La versión de la API queda confirmada junto con la salud HTTP 200 comprobada en este repaso.
- El usuario confirmó la advertencia del navegador al recargar, la recuperación del contenido del borrador, la cancelación del reemplazo y la emisión correcta. Las tres pruebas manuales nuevas quedan cerradas. Cloudinary, rendimiento, respaldo y agencia piloto siguen pendientes.
- El repaso inicial no modificó código ni publicó en producción. Después de la aclaración del usuario se implementó el botón Eliminar y se incluyó esta guía en su commit; el cambio sigue destinado a la beta.
- El usuario aclaró con una captura que quiere eliminar plantillas completas desde Tus plantillas. Se añadió Eliminar a cada tarjeta, para dueño, con confirmación y revisión de concurrencia. Permite eliminar borradores, publicadas y archivadas, incluso con plan vencido; conserva copias por viaje, PDF y biblioteca de imágenes. Eliminar es definitivo; Archivar sigue permitiendo restaurar.
- Verificación local del cambio de borrado: 100 pruebas de cliente aprobadas, build aprobado e integración con MongoDB temporal y PDF real aprobada. La prueba confirma descarga histórica idéntica, edición y emisión después de eliminar la maestra, cupo liberado, permisos, conflicto de revisión y dos borrados simultáneos.
- El commit de borrado `00ee475744949c8f6ec2dbe40e8e9385f3e506e8` se subió a beta; Vercel confirmó READY y GitHub CI `37076086470` terminó con éxito (cliente/build, API y 26 PDF). El usuario confirmó que eliminó una plantilla desde la beta. El borrado remoto queda cerrado; no se eliminaron documentos del usuario mediante herramientas del asistente.
- El usuario confirmó que su foto se mostró correctamente en el PDF y estimó unos 10 segundos o menos para emitirlo. Subida/uso remoto de foto queda comprobado; es una medición aproximada de una emisión, no de memoria, concurrencia ni capacidad sostenida.
- Se añadió Eliminar bajo cada imagen de la biblioteca con confirmación. Una imagen usada en el diseño actual queda bloqueada; el servidor también bloquea uso en otras plantillas, propuestas y emisiones. Tras borrarla, Deshacer/Rehacer no pueden volver a insertar esa imagen. Cuatro pruebas de pantalla y una nueva prueba de controladores/MongoDB con Cloudinary simulado pasaron, junto con el build.
- Siguiente paso práctico: verificar el despliegue del cambio de biblioteca y borrar desde la beta una foto desechable que no figure en ningún documento. Continúan pendientes eliminación en Cloudinary real, estabilidad, respaldo y agencia piloto. El asistente no ha borrado imágenes reales del usuario.

## 1. Estado actual en una frase

Las plantillas visuales reutilizables están implementadas y disponibles en una beta separada; el usuario probó la emisión y quedó satisfecho. Se corrigieron casos adicionales y sus pruebas pasaron. **La función todavía no está habilitada en la aplicación principal: falta cerrar comprobaciones operativas y preparar un piloto.**

Esta guía permite retomar el trabajo sin reconstruir toda la conversación. La matriz de escenarios está en `plantillas-visuales-casos-y-publicacion.md`; las instrucciones de los paneles están en `plantillas-visuales-beta-despliegue.md`.

## 2. Objetivo y preferencias del usuario

Rumbia debe ayudar a agencias a crear propuestas que se sientan propias y animen al viajero a confirmar. El objetivo comercial del usuario es conseguir clientes y obtener ingresos de la aplicación.

La agencia prepara una plantilla una vez, la guarda y la selecciona para distintos viajes. No debe diseñar desde cero cada vez. Quien quiera trabajar rápido puede partir de diseños predeterminados.

Preferencias aceptadas:

- Diseño cómodo, natural, sofisticado y con personalidad; evitar apariencia genérica de generador de PDF.
- Frases editables, sin mensajes grandilocuentes ni redacción que parezca automática.
- Imágenes interiores opcionales. Una agencia puede preferir no ponerlas.
- Interfaz sencilla; acciones frecuentes, incluido deshacer, fáciles de encontrar.
- Personalizar una propuesta no debe alterar la plantilla maestra ni otros viajes.
- No cambiar los precios existentes como parte de esta implementación.
- El usuario necesita pasos claros y ayuda con capturas para Render, Vercel, MongoDB y Cloudflare. No pedir contraseñas ni claves por chat.

## 3. Qué se implementó

### Plantillas y editor

- Trece diseños predeterminados editables y reutilizables.
- Plantillas guardadas por agencia, con estados de borrador, publicada y archivada.
- Editor para páginas de presentación, textos, campos del viaje, formas, imágenes, arte y bloques destacados.
- Tipografías incluidas para mantener consistencia entre pantalla y PDF.
- Biblioteca de imágenes de la agencia, con validación de archivos y declaración de derechos de uso.
- Administración de la plantilla maestra reservada al dueño. Los agentes pueden ajustar propuestas de viajes de su agencia con acceso activo.

### Propuestas por viaje

- Seleccionar una plantilla copia su diseño al viaje.
- La copia se personaliza independientemente de la maestra.
- Vista previa antes de emitir.
- Emisiones numeradas y archivos PDF conservados en MongoDB GridFS, con comprobación de integridad.
- Un PDF ya emitido conserva sus bytes aunque después cambien el viaje o la plantilla.
- Solo se proporcionan variables públicas al generador: no se incluyen netos, margen, notas internas ni códigos privados como campos automáticos.

### Generación del PDF

- Renderizado controlado con Chromium, instalado y comprobado durante el build.
- Trabajo en un proceso separado; una generación simultánea por proceso, límite de tiempo y límites de tamaño.
- Rechazo de imágenes que no cargan y texto que desborda cuadros fijos.
- Recuperación del generador después de fallos; no debe quedar permanentemente ocupado.
- El PDF habitual y el enlace público siguen formando parte del flujo de la aplicación.

### Acceso por plan

| Plan | Plantillas activas permitidas |
| --- | --- |
| Prueba / Inicio | 1 |
| Agencia | 5 |
| Pro | 15 |
| Planes anteriores mensual, anual y vitalicio | 5 |

Archivar libera lugar sin borrar las copias ni los PDF ya emitidos. Si baja de plan y excede el cupo, debe archivar las sobrantes antes de nuevas selecciones o emisiones. Si vence el acceso, conserva lectura y descarga; se bloquean edición y nuevas emisiones.

## 4. Correcciones de la última revisión

La última revisión no fue solo un resumen: encontró y corrigió situaciones concretas.

1. **Borradores:** recuperación en la misma pestaña, separados por usuario, agencia y documento; aviso si la versión del servidor cambió y aviso del navegador al cerrar o recargar con cambios.
2. **Reemplazo de plantilla:** confirmación antes de sustituir ajustes propios; cancelar conserva el contenido; cambiar a la misma plantilla se desactiva.
3. **Concurrencia:** control de revisión para que una pestaña antigua no sobrescriba trabajo reciente; protección del último cupo ante dos creaciones simultáneas.
4. **Vista previa vigente:** si cambian diseño o datos del viaje, se exige revisar una nueva vista previa antes de emitir.
5. **Reintentos:** identificador de emisión para recuperar el mismo PDF si se perdió la respuesta, mientras se conserve esa vista previa.
6. **Acceso:** explicación del plan vencido y del cupo excedido; posibilidad de archivar para el dueño; descargas históricas disponibles.
7. **Contenido:** páginas vacías bloqueadas al previsualizar/emitir, actividades sin hora con ancho completo y detección de días sobrantes cuando se acortan las fechas.
8. **Permisos durante la emisión:** nueva comprobación de viaje, propuesta, agencia, pertenencia y cupo antes de archivar el resultado.
9. **Viajes personales:** no se muestra la opción de propuesta de agencia si el viaje es personal.
10. **Borrado de viaje:** la confirmación ahora menciona que también elimina los PDF de ese viaje.

El borrador local **no es un guardado automático en la nube**. No sirve entre dispositivos y cerrar la pestaña elimina normalmente su almacenamiento de sesión. Guardar sigue siendo necesario.

## 5. Qué se comprobó y qué no demuestra esa evidencia

| Comprobación | Resultado al corte |
| --- | --- |
| Pruebas del usuario en la beta | El usuario confirmó que todo lo que probó funcionó y que le gustó el resultado. |
| Tres PDF adjuntos | Revisados visualmente: dos cortos de 3 páginas y uno de 15 días en 6 páginas; sin recortes ni páginas vacías observadas. Uno procedía de una prueba local anterior. |
| Cliente | 96 pruebas; incluye recuperación de borradores, cambio de plantilla, acceso vencido y cupo excedido. |
| Servidor | 149 comprobaciones existentes y 21 pruebas de integración, validación y resiliencia. |
| Diseños | Los 13 diseños con viajes de 3 y 15 días: 26 PDF generados correctamente. |
| GitHub CI | Ambos trabajos exitosos: API y cliente/build. Ejecución 36941615894 sobre el commit 5915be3. Chromium real en Linux y MongoDB temporal. |
| Web beta actualizada | Vercel confirmó READY para el commit 5915be3; la página de entrada respondió HTTP 200. |
| API beta y conexión | `/api/health` respondió HTTP 200 y autorizó el origen `https://beta.rumbiamx.com`. |

**Límites de la evidencia:**

- El endpoint de salud no muestra el commit desplegado. La revisión de la API `5915be3` se confirmó el 2 de octubre con la captura del panel de Render; en despliegues futuros habrá que volver a verificar la versión.
- Un PDF exitoso no demuestra capacidad sostenida para varias agencias ni ausencia de reinicios por memoria.
- Se probó limpieza con fallos y reintentos remotos simulados; falta confirmar eliminación de una imagen suelta en Cloudinary real.
- La comprobación de permisos inmediatamente antes de archivar se revisó en el código; no se inyectó un cambio real de pertenencia durante el render en una prueba dedicada.
- No existe garantía de cubrir toda combinación imaginable. La matriz distingue comportamiento implementado, pruebas realizadas y límites pendientes.

## 6. Límites funcionales aceptados o pendientes de decisión

1. **Entrega web:** el enlace público conserva su presentación actual. El diseño nuevo se entrega en PDF; no hay paridad visual web/PDF.
2. **Variantes:** una propuesta visual activa por viaje. El modelo permite ampliar a variantes, pero todavía no hay una interfaz para estándar y premium simultáneas.
3. **Logística detallada:** el PDF visual contiene portada, presentación, precio público y días/actividades. **No incorpora automáticamente una sección detallada de vuelos, hoteles y traslados.** Si se necesita esa paridad para venderlo, hay que implementarla antes de ofrecerla. Mientras tanto, puede añadirse texto público o usarse la impresión habitual.
4. **Logotipo:** puede usarse una imagen subida; no hay un campo automático que tome el logo del perfil de agencia.
5. **Texto libre:** la agencia puede escribir sus propias frases; debe revisar que no introduzca datos internos en texto público.
6. **Archivo histórico:** conserva emisiones mientras exista el viaje. Borrar el viaje también borra sus propuestas y PDF, tras confirmación.

## 7. Ubicación del trabajo y estado de Git

| Elemento | Ubicación / estado |
| --- | --- |
| Repositorio | `maxrodrigueznav04/Rumbia` |
| Carpeta activa de esta función | `C:\Users\maxro\.codex\worktrees\plantillas-beta\Rumbo` |
| Rama | `codex/plantillas-beta` |
| Último commit de código verificado y subido | `5915be32281e5e3861c802a3bebd08a884617801` |
| Descripción del commit | `Protect visual proposal drafts, template changes and export retries` |
| Pull request | https://github.com/maxrodrigueznav04/Rumbia/pull/128 |
| Estado del PR | Abierto, borrador, sin fusionar; fusionable al corte. |
| Base consultada | `main`, commit `591a151293678b612f88dbe495ca7bb8e39f7523` |

La carpeta principal `C:\Users\maxro\OneDrive\Documents\Claude Cowork\Rumbo` tiene trabajo separado de conservación de agencias P02. **No confundirlo con la beta ni incorporarlo accidentalmente.** También existe el worktree original `plantillas-visuales`, que contiene trabajo previo y demostraciones. La versión `5915be3` de la tabla corresponde al código anterior al botón Eliminar; consultar `git log -1` y los despliegues para la revisión posterior de borrado.

Antes de continuar: consultar las instrucciones vigentes del repositorio, revisar `git status`, el estado remoto de `main` y el PR. No restaurar archivos ni borrar resultados para dejar limpio el árbol sin revisar primero.

`output/` contiene resultados locales no versionados que se conservaron. Esta guía, inicialmente local, se incluye junto al cambio de borrado para conservar la continuidad en el repositorio. No contiene secretos.

## 8. Infraestructura beta que ya existe

**No hay que volver a crear los proyectos ni rehacer el DNS si siguen funcionando.**

### API beta — Render

| Campo | Configuración |
| --- | --- |
| Servicio | `rumbia-api-beta` |
| Rama / carpeta | `codex/plantillas-beta` / `server` |
| Build | `npm ci && npm run build:render` |
| Inicio exclusivo beta | `npm run beta:start` |
| Plan | Gratuito |
| Base exclusiva | `rumbia_visual_beta` |
| Dominio API | https://api-beta.rumbiamx.com |
| URL Render | https://rumbia-api-beta.onrender.com |
| Salud | https://api-beta.rumbiamx.com/api/health |
| Origen web permitido | `https://beta.rumbiamx.com` |

El arranque beta prepara una cuenta verificada, una agencia sintética con acceso equivalente a Agencia, dos viajes de 3 y 15 días y dos plantillas. Es idempotente: conserva las ediciones y no restablece la contraseña al reiniciar. Cambiar `BETA_OWNER_PASSWORD` en Render no cambia la contraseña de una cuenta ya creada.

Los secretos se introducen en Render. No están en esta guía. El arranque beta rechaza otra base y claves de Stripe. No usar este arranque en el servicio principal.

### Web beta — Vercel

| Campo | Configuración |
| --- | --- |
| Proyecto | `rumbia-beta` |
| Rama de Production de este proyecto | `codex/plantillas-beta` |
| Carpeta / preset | `client` / Vite |
| Instalación / build / salida | `npm ci` / `npm run build` / `dist` |
| `VITE_API_URL` | `https://api-beta.rumbiamx.com/api` |
| `VITE_ENABLE_VISUAL_TEMPLATES` | `true` |
| Entrada | https://beta.rumbiamx.com/entrar |
| Dominio alternativo | https://rumbia-beta.vercel.app |
| ID de proyecto para herramientas | `prj_dX3jfegExlJIIFeS9ihi3WUVhYDZ` |
| ID de equipo | `team_gh3tS2LkiZivZKJklOi2S7dT` |

El nombre correcto es `VITE_API_URL`, no `VITE_API_URI`. Las variables Vite se incorporan al compilar: cambiar una exige otro despliegue. La URL de la API es configuración pública; no necesita tratarse como una contraseña.

La palabra Production en **este proyecto beta** significa el dominio estable de la beta, no la aplicación principal.

### DNS y sesión

- Cloudflare `api-beta`: CNAME a `rumbia-api-beta.onrender.com`, DNS only durante esta configuración.
- Cloudflare `beta`: CNAME indicado por Vercel, registrado como `f61f104506afafa0.vercel-dns-017.com`, DNS only.
- Ambos dominios se verificaron y HTTPS funciona al corte.
- Se corrigió una resolución DNS negativa temporal; no se diagnosticó una falla del código por ese incidente.
- Se usan subdominios del mismo dominio para mantener la sesión con las cookies actuales. Preferir `beta.rumbiamx.com` para las pruebas autenticadas.

## 9. Pendientes concretos, responsables y cierre esperado

| Pendiente | Quién participa | Cómo considerarlo cerrado |
| --- | --- | --- |
| Confirmar API actualizada — cerrado 2 de octubre | Usuario aportó captura de Render; asistente verificó salud. | `5915be3` aparece Live con despliegue exitoso; salud HTTP 200. |
| Repetir las tres protecciones nuevas — cerrado 2 de octubre | Usuario las probó en beta. | Confirmadas advertencia y recuperación del borrador, cancelación del reemplazo y emisión correcta. |
| Eliminar plantilla completa — cerrado 2 de octubre | Usuario confirmó eliminación en la beta; asistente comprobó CI. | Commit `00ee475`, CI `37076086470` exitoso y web READY; usuario confirmó borrado. Conservación de propuestas/PDF y permisos comprobados mediante integración. |
| Medir generación remota | Usuario da acceso a resultados del panel, sin secretos; asistente evalúa. | Registrar tiempo de PDF corto/largo, carga simultánea y errores/reinicios; decidir si el servicio gratuito sirve para el piloto. |
| Probar imágenes reales — parcialmente cerrado | Usuario; asistente guía o verifica. | Foto subida y mostrada en PDF, emisión aproximada de 10 segundos o menos. Pendiente borrado remoto de una foto desechable sin referencias; el botón de biblioteca se implementó y pasó pruebas locales. |
| Respaldo principal | Usuario/administrador de Atlas, con ayuda si hace falta. | Respaldo confirmado y ubicación/procedimiento de recuperación identificado antes de tocar producción. |
| Agencia piloto | Usuario identifica su agencia real; asistente comprueba el ID. | ID real confirmado; no usar la agencia sintética de la beta. |
| Revisar logística requerida | Usuario decide si la sección automática de vuelos/hoteles/traslados es necesaria para el piloto. | Alcance acordado; si es requisito, implementarlo y verificarlo antes de publicar. |
| Preparar integración | Asistente. | Comparar con `main` vigente, resolver posibles conflictos, pasar CI del commit exacto y dejar PR listo para la decisión de producción. |

El usuario ya confirmó expresamente las tres pruebas nuevas. No pedirlas de nuevo salvo que un cambio posterior afecte esos comportamientos; tampoco repetir toda la batería sin una razón concreta.

## 10. Primeros pasos al retomar

1. Leer esta guía y la matriz de casos; consultar el PR #128 y las instrucciones locales.
2. Revisar el estado del worktree beta sin alterar el trabajo de P02.
3. Comprobar web, salud API y último despliegue si hubo cambios desde el 2 de octubre. La revisión `5915be3` de Render ya fue confirmada; no pedir otra captura de la misma revisión sin motivo.
4. Plantilla eliminada y foto propia mostrada en PDF ya fueron confirmadas por el usuario. Verificar nuevo despliegue de biblioteca y pedir solo el borrado de una foto desechable sin referencias; después continuar estabilidad y respaldo.
5. Cerrar imágenes y medición de Render; registrar resultados y fallos concretos en esta guía o en la matriz.
6. Confirmar respaldo, agencia piloto y alcance de logística. Después preparar la integración principal.

## 11. Publicación del piloto: orden previsto

Este apartado describe el siguiente trabajo; **no significa que ya se haya publicado**.

1. Mantener inicialmente apagada la función en producción mientras se prepara el código.
2. Revisar y preparar el PR con las comprobaciones sobre el commit que realmente se integrará.
3. Aplicar la regla de `CLAUDE.md`: normalmente fusiona tras checks, pero pide confirmación ante cambios de alto impacto. Esta publicación afecta generación de documentos y limpieza de datos; preparar antes el resultado concreto y los pasos de recuperación, y obtener autorización cuando corresponda.
4. En la API principal, conservar base, secretos, suscripciones y origen reales. Usar build `npm ci && npm run build:render` y arranque `npm start`.
5. Activar `VISUAL_TEMPLATES_ENABLED=true` y restringir `VISUAL_TEMPLATES_AGENCIES=<ID de agencia piloto>`. Desplegar API y comprobar Chromium y salud.
6. En la web principal, conservar su URL real de API y compilar con `VITE_ENABLE_VISUAL_TEMPLATES=true`. Desplegar después de la API.
7. Probar selección, PDF corto/largo, imagen y descarga histórica en la agencia piloto. Comprobar también que una agencia fuera del piloto mantiene el flujo habitual sin acceso a la función nueva.
8. Observar resultados del piloto antes de ampliar. No cambiar precios ni comprar infraestructura automáticamente.

### Suspensión de la función

Si falla el piloto: configurar `VISUAL_TEMPLATES_ENABLED=false` en la API y volver a desplegar. Esto suspende las rutas visuales y conserva los datos; la impresión habitual sigue disponible. No borrar plantillas, archivos ni base para desactivar la función.

## 12. Archivos para orientarse en el código

| Área | Archivos principales |
| --- | --- |
| Lista/editor/propuesta | `client/src/pages/VisualTemplates.jsx`, `VisualTemplateEditor.jsx`, `VisualProposal.jsx` |
| Recuperación de borradores | `client/src/hooks/useVisualDraft.js`, `client/src/components/VisualDraftNotice.jsx` |
| Traducciones | `client/src/locales/es/visualTemplates.json`, equivalente `en` |
| Modelos | `server/src/models/VisualTemplate.js`, `VisualProposal.js`, `VisualProposalIssue.js`, `VisualAsset.js` |
| Controladores | `server/src/controllers/visualTemplates.controller.js`, `visualProposals.controller.js`, `visualAssets.controller.js` |
| Diseño/presets | `server/src/validators/visualTemplate.js`, `visualPresetDesigns.js` |
| Datos/HTML públicos | `server/src/services/visualProposalData.service.js`, `visualProposalHtml.service.js` |
| PDF/archivo | `server/src/services/visualPdf.service.js`, `visualPdfArchive.service.js`, `server/src/workers/visualPdf.worker.js` |
| Acceso/cupo/limpieza | `server/src/services/visualAccess.service.js`, `visualTemplates.service.js`, `visualCleanup.service.js` |
| Beta e instalación | `server/scripts/start-visual-beta.mjs`, `scripts/lib/visualBeta.js`, `build-render.mjs`, `install-visual-browser.mjs` |
| Pruebas | `client/src/pages/VisualProposal.test.jsx`, `client/src/hooks/useVisualDraft.test.jsx`, `server/scripts/visual-*.test.mjs` |
| Prototipos y CI | `server/scripts/visual-pdf-prototype.mjs`, `.github/workflows/ci.yml` |

Para verificar futuros cambios, usar `npm test` y `npm run build` en `client`; en `server`, preparar Chromium con `npm run browser:install` y ejecutar `npm test`. Los 26 prototipos se ejecutan desde `server` con `node scripts/visual-pdf-prototype.mjs`. CI instala además las dependencias del sistema en Linux. No ejecutar scripts de reinicio/semilla sobre una base real.

## 13. Material y documentos conservados

- `docs/plantillas-visuales-propuesta-v1.md`: propuesta original.
- `docs/plantillas-visuales-implementacion.md`: implementación.
- `docs/plantillas-visuales-beta-despliegue.md`: pasos de despliegue beta.
- `docs/plantillas-visuales-casos-y-publicacion.md`: matriz de escenarios y evidencia.
- `output/qa-user-pdfs/`: imágenes locales de revisión de los PDF aportados; no versionadas.
- PDF originales del usuario: `C:\Users\maxro\Downloads\propuesta-rumbia-v1.pdf`, `propuesta-rumbia-v1 (1).pdf` y `propuesta-rumbia-v1 (2).pdf`.

Los datos de despliegues, ramas, CI y dominios son una fotografía de esta fecha. Comprobar su estado actual al retomar; no tratar esta guía como evidencia de que siguen iguales indefinidamente.

## 14. Mensaje listo para retomar en otro momento

> Continúa el trabajo de plantillas visuales de Rumbia. Lee primero `C:\Users\maxro\.codex\worktrees\plantillas-beta\Rumbo\docs\plantillas-visuales-continuidad.md` y la matriz de casos. Trabaja en `codex/plantillas-beta`, PR #128, sin mezclar P02. La revisión de borrado de plantillas `00ee475` pasó CI y prueba remota del usuario. Después se añadió Eliminar imágenes de biblioteca con confirmación y protección de uso e historial: consultar git log, CI y Vercel para esa nueva revisión. El usuario confirmó recuperación del borrador, cancelación del reemplazo, emisión, eliminación de plantilla y foto propia mostrada en PDF en unos 10 segundos o menos. Falta probar borrado de una foto desechable sin referencias contra Cloudinary real, medir estabilidad y preparar respaldo y agencia piloto. Verifica qué cambió desde entonces y completa lo pendiente siguiendo el orden de publicación, sin asumir que la función ya está activa en producción.
