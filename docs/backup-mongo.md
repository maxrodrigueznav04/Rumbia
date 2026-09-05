# Backup automático de MongoDB — guía paso a paso

El tier gratuito de Atlas (M0) no ofrece Cloud Backup ni point-in-time
recovery en absoluto. `.github/workflows/mongo-backup.yml` corre un
`mongodump` diario gratis en GitHub Actions, lo cifra y lo sube como
artifact — no sustituye un backup real de un cluster de pago, pero es
infinitamente mejor que no tener ninguna red si un `deleteMany` mal
apuntado o un bug borra algo.

Esta guía es para dejarlo funcionando la primera vez. El workflow ya está
escrito y probado en cuanto a su lógica (140 pruebas del servidor pasan y el
propio job se auto-verifica cada corrida, ver paso 4) — lo único que falta
es configuración que solo alguien con acceso a los dashboards de GitHub y
Atlas puede hacer.

## 1. Reunir los dos valores que hacen falta

**`MONGO_URI`** — la misma cadena de conexión que ya usa Render hoy:

- En el [dashboard de Render](https://dashboard.render.com): entra al
  servicio del backend → pestaña **Environment** → busca la variable
  `MONGO_URI` y copia su valor (el ícono de ojo la revela).
- Si prefieres tomarla directo de Atlas en vez de copiarla de Render:
  [dashboard de Atlas](https://cloud.mongodb.com) → tu cluster → **Connect**
  → **Drivers** → copia el connection string y sustituye `<password>` por la
  contraseña real del usuario de base de datos.

**`BACKUP_PASSPHRASE`** — una frase larga, exclusiva para este backup (no
reutilices ninguna contraseña real: si esta se filtra, lo único que se
compromete son los propios backups cifrados, nada más). Genera una con:

```
openssl rand -base64 36
```

(en Mac/Linux, en cualquier terminal; en Windows funciona igual dentro de
Git Bash o WSL). Cópiala directo de ahí a GitHub en el paso 2 y guárdala
además en un gestor de contraseñas — es la única forma de descifrar un
backup el día que haga falta restaurar uno, y no queda guardada en ningún
otro lado (nunca la pegues en un archivo del repo, ni en un commit, ni en un
issue).

## 2. Agregar los dos secrets en GitHub

1. Entra al repo en GitHub → **Settings** → **Secrets and variables** →
   **Actions**.
2. **New repository secret** → Name: `MONGO_URI` → Value: pega la cadena del
   paso 1 → **Add secret**.
3. Repite: **New repository secret** → Name: `BACKUP_PASSPHRASE` → Value:
   pega la passphrase del paso 1 → **Add secret**.

Los nombres deben quedar exactamente así (mayúsculas incluidas) — el
workflow los busca por ese nombre exacto.

## 3. Confirmar que Atlas acepta conexiones desde cualquier IP

Los runners de GitHub Actions no tienen una IP fija, así que Atlas tiene que
aceptar conexiones desde cualquier IP para que este job funcione — es
exactamente lo mismo que Render ya necesita hoy para conectarse (tampoco
tiene IP fija en su plan actual).

En Atlas: **Network Access** (menú lateral) → si ya existe una entrada
`0.0.0.0/0` (Render la necesita), no hace falta nada más. Si no existe:
**Add IP Address** → **Allow Access from Anywhere** → **Confirm**.

Si en el futuro se restringe el access list a IPs fijas, este job se rompe
y hay que resolverlo aparte (por ejemplo, corriendo el backup desde un
servidor con IP fija en vez de GitHub Actions).

## 4. Probar el workflow a mano antes de confiar en el cron

No hace falta esperar a las 3am (hora Culiacán) para saber si quedó bien
configurado:

1. En GitHub: pestaña **Actions** → en la lista de la izquierda,
   **Backup diario de MongoDB** → botón **Run workflow** → rama `main` →
   **Run workflow**.
2. Espera 1-2 minutos y entra a la corrida que acaba de aparecer.
3. Si el job **mongodump + cifrar + subir** queda en verde, el backup de hoy
   ya se hizo y — gracias al paso de auto-verificación que descifra el
   archivo y lo compara contra el original antes de subirlo — un check
   verde significa que el backup realmente se puede restaurar, no solo que
   el job no truena.
4. Opcional: baja al final de la corrida, en **Artifacts**, y confirma que
   aparece un archivo `rumbia-FECHA.archive.gz.gpg`.

Una vez que esta corrida manual sale verde, el cron diario (`0 9 * * *` UTC
= 3am Culiacán) sigue solo, sin que nadie tenga que revisarlo a diario.

## 5. Si algo falla

- **"Falta el secret MONGO_URI" / "...BACKUP_PASSPHRASE"** — el secret no se
  guardó, o el nombre no coincide exactamente. Repite el paso 2.
- **Timeout o error de conexión en el paso `mongodump`** — casi siempre es
  el paso 3 (Atlas todavía no acepta `0.0.0.0/0`), o `MONGO_URI` tiene un
  typo (usuario/password/nombre de cluster).
- **"El respaldo cifrado no coincide con el original al descifrarlo de
  prueba"** — muy raro; súbelo a mano de nuevo (**Run workflow**). Si vuelve
  a pasar dos veces seguidas, es una señal real de que algo anda mal (por
  ejemplo, el runner se quedó sin disco a medio cifrado) y vale la pena
  investigarlo en vez de ignorarlo.
- GitHub avisa por correo al dueño del repo cuando un workflow programado
  falla — no hace falta entrar a diario a revisar que siga en verde.

## 6. Cómo restaurar un backup

Restaurar es **a mano a propósito** — nunca debería poder pasar sin que
alguien lo decida explícitamente, así que no hay ningún botón ni automatismo
para esto:

1. En la corrida de Actions cuyo backup quieres (la de hoy, o cualquiera
   de los últimos 90 días), baja a **Artifacts** y descarga
   `rumbia-FECHA.archive.gz.gpg`.
2. Descífralo con la passphrase del paso 1:
   ```
   gpg --batch --yes --decrypt --passphrase "LA_PASSPHRASE" \
     --output rumbia.archive.gz rumbia-FECHA.archive.gz.gpg
   ```
3. Restaura contra el cluster de destino:
   ```
   mongorestore --uri="LA_MONGO_URI_DE_DESTINO" --gzip --archive=rumbia.archive.gz
   ```
   Agrega `--drop` antes de `--gzip` si quieres que lo restaurado
   **reemplace** todo lo que ya exista en destino, en vez de solo agregarse
   encima. Sin `--drop`, un documento con el mismo `_id` que uno ya
   existente falla en vez de sobreescribirlo (mongorestore no pisa datos por
   accidente).
4. Restaura primero contra un cluster de prueba si tienes dudas, nunca
   directo a producción como primer intento.
