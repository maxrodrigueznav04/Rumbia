# Beta de plantillas visuales: pasos de publicación

Esta guía prepara una copia de Rumbia para probar las plantillas con datos ficticios. El servicio de prueba crea una cuenta, una agencia, dos viajes (3 y 15 días) y dos plantillas reutilizables. Conserva las ediciones en los siguientes despliegues.

Rama: `codex/plantillas-beta`. Repositorio: `maxrodrigueznav04/Rumbia`.

## 1. Base de datos de prueba en MongoDB Atlas

En el proyecto de Atlas donde está Rumbia:

1. Abre **Database Access → Add New Database User**. Elige autenticación por contraseña; crea un usuario exclusivo para la beta y guarda su contraseña en privado.
2. En **Database User Privileges / Specific Privileges**, concede `readWrite` únicamente a la base `rumbia_visual_beta`. Deja vacío el nombre de colección para cubrir sus colecciones. Evita roles que permitan escribir en todas las bases.
3. Abre el clúster existente → **Connect → Drivers**. Copia la conexión en privado y coloca el usuario y contraseña nuevos. Codifica los caracteres especiales de la contraseña para una URL si los tiene.
4. Después del dominio del clúster, el nombre de base debe ser `/rumbia_visual_beta`, antes de `?`. Conserva los parámetros indicados por Atlas. La aplicación creará las colecciones al iniciar.
5. En **Network Access**, permite los rangos de salida del nuevo servicio Render; aparecen en la información de **Outbound** del servicio. Añádelos sin quitar los que usa la API actual.

El arranque beta rechaza una conexión cuyo nombre de base sea otro. Esto no comprueba los permisos del usuario de Atlas: por eso el usuario exclusivo del paso 2 debe tener acceso solo a la beta.

Referencia: [usuarios de base de datos en Atlas](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).

## 2. API de prueba en Render

Abre [Render](https://dashboard.render.com/) → **New → Web Service** y selecciona el repositorio Rumbia. Crea un servicio nuevo con estos valores:

| Campo | Valor |
| --- | --- |
| Name | `rumbia-api-beta` |
| Branch | `codex/plantillas-beta` |
| Language / Runtime | Node |
| Root Directory | `server` |
| Build Command | `npm ci && npm run build:render` |
| Start Command | `npm run beta:start` |
| Instance Type | Free |
| Health Check Path | `/api/health` |

En **Environment**, añade:

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `MONGO_URI` | La conexión privada de Atlas del paso 1, base `rumbia_visual_beta` |
| `JWT_SECRET` | Un valor aleatorio nuevo; usa **Generate** si aparece, mínimo 32 caracteres |
| `CLIENT_URL` | `https://beta.rumbiamx.com` |
| `VISUAL_TEMPLATES_ENABLED` | `true` |
| `BETA_OWNER_EMAIL` | El correo que usarás para entrar en esta copia |
| `BETA_OWNER_PASSWORD` | Una contraseña privada y exclusiva de al menos 12 caracteres |
| `CLOUDINARY_CLOUD_NAME` | Cloud name de tu cuenta Cloudinary |
| `CLOUDINARY_API_KEY` | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary |

Introduce los secretos directamente en el panel. No los pegues en el chat, en capturas o en GitHub. No copies las claves de Stripe; el arranque de la beta las rechaza. Esta prueba usa itinerarios preparados manualmente y no necesita claves de generación con IA.

La cuenta se crea verificada y la agencia tiene acceso de prueba equivalente al plan Agencia, solo dentro de esta base. No se hace un cobro ni se modifica una suscripción real. La API autoriza automáticamente a esa agencia para usar las plantillas; no necesitas capturar su ID.

**Resultado esperado del despliegue:** el build instala Chromium y muestra `[visual-pdf] PDF OK` y `Chromium disponible`. Después, el inicio muestra `[beta] Cuenta de prueba preparada`. Si falta un acceso a Atlas o Chromium, envía el mensaje del error ocultando credenciales.

Referencia: [configuración de servicios Render](https://render.com/docs/web-services), [variables privadas](https://render.com/docs/configure-environment-variables).

### Dominio de la API

En el servicio nuevo → **Settings → Custom Domains**, añade `api-beta.rumbiamx.com`. Render indica el registro DNS exacto.

En Cloudflare → dominio `rumbiamx.com` → **DNS**, crea el registro para `api-beta` con ese destino. Usa **DNS only** durante la configuración y espera a que Render confirme el dominio y el certificado. Comprueba que `https://api-beta.rumbiamx.com/api/health` abre correctamente.

Referencia: [dominios personalizados en Render](https://render.com/docs/custom-domains).

## 3. Web de prueba en Vercel

Abre [Vercel](https://vercel.com/dashboard) → **Add New → Project**, importa otra vez el repositorio y crea un proyecto separado llamado `rumbia-beta`.

| Campo | Valor |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | `client` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Production Branch del proyecto beta | `codex/plantillas-beta` |

Si Vercel inicialmente importa `main`, cambia la rama del proyecto beta en **Settings → Environments → Production → Branch Tracking** (en algunas vistas aparece como **Settings → Git → Production Branch**) y crea un nuevo despliegue desde `codex/plantillas-beta`.

En **Settings → Environment Variables**, para el entorno **Production del proyecto beta**, añade:

| Variable | Valor |
| --- | --- |
| `VITE_API_URL` | `https://api-beta.rumbiamx.com/api` |
| `VITE_ENABLE_VISUAL_TEMPLATES` | `true` |

En el proyecto beta, **Production** significa su propio sitio de prueba. Los valores se incorporan durante el build: haz **Redeploy** después de configurarlos.

En **Settings → Domains**, añade `beta.rumbiamx.com`. Crea en Cloudflare el registro DNS que Vercel indique y espera a que confirme la configuración. Entra por `https://beta.rumbiamx.com/entrar`.

La web y la API usan subdominios de `rumbiamx.com` para que la sesión funcione con las cookies actuales. Una web `vercel.app` conectada directamente a una API `onrender.com` puede fallar al conservar la sesión.

El archivo `client/vercel.json` incluye las rutas para abrir o recargar páginas internas y las cabeceras de seguridad que permiten la vista previa.

Referencia: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [ramas y despliegues Git](https://vercel.com/docs/git), [dominios de Vercel](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting).

## 4. Prueba completa

1. Entra con `BETA_OWNER_EMAIL` y la contraseña elegida. Debes ver la agencia de prueba, los viajes de Oaxaca y Yucatán y dos plantillas.
2. En Plantillas, abre una plantilla visual, cambia una frase y el nombre, guarda y recarga. Comprueba que se conservaron.
3. Sube una fotografía propia con derechos de uso confirmados y úsala como portada. Guarda y vuelve a abrirla. No hace falta añadir una imagen interior.
4. Abre Oaxaca → itinerario → propuesta visual. Selecciona la plantilla, abre la vista previa y emite el PDF. Revisa que texto y foto coincidan.
5. Usa la misma plantilla en Yucatán. Cambia el mensaje de ese viaje. Confirma que la maestra y la propuesta de Oaxaca conservan su texto.
6. Emite y descarga el PDF de 15 días. Revisa títulos completos, acentos, saltos de página y ausencia de recortes o páginas vacías inesperadas.
7. Vuelve a descargar una revisión anterior: debe conservar exactamente su contenido aunque luego edites el viaje o la plantilla.
8. Reinicia el servicio de Render. Los nombres y frases editados deben seguir iguales; la cuenta beta no se vuelve a crear y su contraseña no se reinicia.
9. Prueba desde móvil. Registra cuánto tarda cada PDF y revisa los eventos de reinicio o falta de memoria en Render durante la prueba.

Cambiar `BETA_OWNER_PASSWORD` en Render no cambia una cuenta ya creada; usa la función de cambio de contraseña de Rumbia. Conserva el mismo correo en los siguientes despliegues.

Render gratuito puede suspender servicios por inactividad y comparte el cupo gratuito de horas del espacio de trabajo. Una segunda API consume ese mismo cupo; detén la beta después de probarla si no la vas a usar. Antes de ofrecer el PDF a clientes, hay que medir su rendimiento real y decidir si conviene un servicio de pago. [Límites del plan gratuito de Render](https://render.com/docs/free).

## 5. Paso posterior a producción

Pendiente: validar el arranque y consumo en Render, Cloudinary real y la sesión en los dominios beta. Las pruebas locales y las de GitHub no sustituyen esos pasos.

Cuando pase la prueba, se puede integrar la rama y habilitar una agencia piloto con `VISUAL_TEMPLATES_AGENCIES=<id>`. El servicio real usa `npm start`, conserva su base y sus suscripciones, y requiere un build nuevo con `VISUAL_TEMPLATES_ENABLED=true` para instalar Chromium. La web necesita un build con `VITE_ENABLE_VISUAL_TEMPLATES=true`. Las agencias fuera de la lista no ven la función.

Para suspender la función: establece `VISUAL_TEMPLATES_ENABLED=false` y vuelve a desplegar la API. No se borran las plantillas ni las revisiones archivadas. La impresión anterior y el enlace público siguen disponibles.
