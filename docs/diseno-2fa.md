# Diseño de 2FA (TOTP) — listo para implementar, no construido todavía

## Por qué existe este documento en vez de código

Se pidió avanzar "todo lo que se pueda de código" en una sesión sin
supervisión, con deploy automático a producción en cuanto CI pasa (Render y
Cloudflare se despliegan solos con cada push a `main`, sin que nadie lo
revise antes). El login es el endpoint de mayor impacto de toda la
aplicación: si algo sale mal ahí, no es "una pantalla se ve rara", es
"nadie puede entrar a su cuenta". Con esas dos cosas juntas — el radio de
impacto más alto de la app, y ninguna oportunidad de probarlo en vivo con un
autenticador real antes de que llegara a producción — la decisión fue dejar
el diseño listo en vez de escribir el código a ciegas.

Cuando se implemente, debe hacerse en una sesión donde se pueda probar
manualmente contra un autenticador real (Google Authenticator, Authy, o
similar) **antes** de que el push llegue a main.

## Alcance

Aunque el pedido original fue "2FA en la cuenta admin", el diseño de abajo
no distingue esa cuenta de ninguna otra — es la misma cantidad de trabajo
ofrecerlo a cualquier usuario que quiera activarlo, y es estrictamente mejor
para la seguridad general de la app. La cuenta admin simplemente sería la
primera en usarlo.

**Principio rector: opt-in total.** Ninguna cuenta existente se ve afectada
por este cambio hasta que activa 2FA explícitamente desde Perfil. El login
de cualquier cuenta sin 2FA activo debe quedar **exactamente igual** que
hoy, sin ninguna rama de código nueva en su camino.

## Backend

### 1. Modelo — `User.js`

```js
twoFactor: {
  habilitado: { type: Boolean, default: false },
  // Secret TOTP en Base32, en texto plano (no se puede hashear como una
  // contraseña: el servidor necesita el valor original para calcular el
  // codigo esperado en cada verificacion). Vive en el mismo perimetro de
  // confianza que el resto de la base -- si eso preocupa mas adelante, se
  // puede cifrar con una ENCRYPTION_KEY simetrica nueva, pero es complejidad
  // extra que no se justifica para una primera version.
  secret: { type: String, select: false },
  // Codigos de un solo uso para cuando se pierde el telefono. Se guardan
  // HASHEADOS (bcrypt, igual que la contraseña) porque a diferencia del
  // secret TOTP, aqui si se puede comparar por hash sin necesitar el valor
  // original -- son de un solo uso, no hace falta "recalcularlos".
  codigosRespaldo: { type: [String], select: false, default: [] },
},
```

### 2. Utilidad TOTP — `server/src/utils/totp.js` (nuevo, sin dependencias nuevas del lado de la logica pura)

Usar la librería `otplib` (MIT, gratis, ~0 dependencias transitivas
pesadas). Funciones puras, testeables sin Mongo:

```js
export function generarSecret() // Base32 aleatorio
export function otpauthUri(secret, email) // "otpauth://totp/Rumbia:email?secret=...&issuer=Rumbia"
export function verificarCodigo(secret, codigo) // ventana ±1 paso (30s) de tolerancia
export function generarCodigosRespaldo(cantidad = 8) // strings tipo "XXXX-XXXX"
```

No se agrega una librería de QR: el secret se muestra como texto (Base32) y
como el URI `otpauth://` completo para copiar — la mayoría de apps de 2FA
aceptan "entrada manual" pegando esa clave. Menos una dependencia, menos una
superficie de bug en el primer intento.

### 3. Endpoints nuevos — `auth.controller.js` + `auth.routes.js`

- `POST /auth/2fa/iniciar` (protect) — genera un secret nuevo, lo guarda
  TEMPORALMENTE en una colección de corta duración o en el propio User con
  `habilitado: false` todavía, y devuelve `{ secret, otpauthUri }`. No activa
  nada todavía.
- `POST /auth/2fa/activar` (protect) — recibe `{ codigo }`, verifica contra
  el secret pendiente. Si es válido: `habilitado = true`, genera y devuelve
  los códigos de respaldo (se muestran **una sola vez**, el cliente debe
  guardarlos). Si no es válido: error, el secret pendiente no se activa.
- `POST /auth/2fa/desactivar` (protect) — requiere `{ password, codigo }`
  (ambos: la contraseña actual Y un código válido, no basta con estar
  logueado) — pone `habilitado = false`, borra `secret` y
  `codigosRespaldo`.
- `POST /auth/login/2fa` (público, sin protect — es parte del flujo de
  login) — recibe `{ loginToken, codigo }`. Ver flujo completo abajo.

### 4. Flujo de login en dos pasos

**Hoy:** `POST /auth/login` con `{ email, password }` → si son correctos,
pone la cookie de sesión completa y devuelve el usuario.

**Con 2FA, solo para cuentas con `habilitado: true`:**

1. `POST /auth/login` con `{ email, password }`:
   - Si las credenciales son incorrectas: igual que hoy (401).
   - Si son correctas y el usuario **no** tiene 2FA activo: **exactamente
     igual que hoy** — cookie completa, usuario devuelto. Ninguna rama
     nueva en este camino.
   - Si son correctas y el usuario **sí** tiene 2FA activo: en vez de la
     cookie completa, se firma un JWT de un solo propósito y vida corta
     (`loginToken`, 5 minutos, payload `{ sub: user._id, proposito: '2fa-pendiente' }`,
     mismo `JWT_SECRET`) y se devuelve `{ requiere2FA: true, loginToken }`
     — **sin** poner ninguna cookie de sesión todavía.
2. `POST /auth/login/2fa` con `{ loginToken, codigo }`:
   - Verifica firma, expiración y `proposito` del `loginToken`.
   - Verifica `codigo` contra el secret del usuario (o contra un código de
     respaldo no usado — si es de respaldo, se marca consumido).
   - Si todo es válido: AHORA sí se pone la cookie de sesión completa,
     igual que el login normal de hoy.
   - Si no: 401, sin pistas de cuál de las dos cosas falló.

### 5. Validadores — `schemas.js`

```js
export const iniciar2FASchema = z.object({}); // nada en el body, solo protect
export const activar2FASchema = z.object({ codigo: z.string().length(6) });
export const desactivar2FASchema = z.object({
  password: z.string().min(1),
  codigo: z.string().length(6),
});
export const login2FASchema = z.object({
  loginToken: z.string().min(1),
  codigo: z.string().min(6).max(9), // 6 del TOTP, o el formato "XXXX-XXXX" de respaldo
});
```

## Frontend

### 6. Perfil.jsx — nueva sección "Seguridad"

- Si `!twoFactor.habilitado`: botón "Activar verificación en dos pasos" →
  llama a `/auth/2fa/iniciar`, muestra el secret Base32 y el URI
  `otpauth://` (con botón de copiar), un campo para el código de 6 dígitos,
  botón "Confirmar y activar". Al confirmar, muestra los códigos de
  respaldo en un aviso que dice explícitamente "guárdalos ahora, no se
  vuelven a mostrar".
- Si `twoFactor.habilitado`: muestra "Verificación en dos pasos activa" +
  botón "Desactivar" (pide contraseña + código).

### 7. Login.jsx / AuthContext.jsx — segundo paso

- `login()` en AuthContext: si la respuesta trae `requiere2FA: true`, no
  llama a `terminarEntrada` (no hay usuario todavía) — en su lugar
  devuelve `{ requiere2FA: true, loginToken }` a quien llamó.
- Login.jsx: si `login()` devuelve eso, cambia a una segunda pantalla
  (mismo formulario, un solo campo para el código) que llama a
  `authApi.login2FA({ loginToken, codigo })` y esa sí termina en
  `terminarEntrada`.

## Verificación antes de considerarlo listo para producción

- **Sin Mongo** (lo que sí se puede hacer sin supervisión): pruebas
  unitarias puras de `totp.js` — generar un secret, calcular el código
  esperado con la misma librería y verificar que `verificarCodigo` lo
  acepta; que un código de hace 2 pasos (60s) ya no es válido; que un
  código de respaldo se puede usar una sola vez.
- **Con Mongo y un autenticador real** (esto sí necesita supervisión en
  vivo, no se puede hacer a ciegas):
  1. Activar 2FA en una cuenta de prueba (nunca la primera vez en la
     cuenta admin real) con Google Authenticator o Authy de verdad.
  2. Cerrar sesión, volver a entrar, confirmar que pide el código y que un
     código incorrecto lo rechaza.
  3. Probar un código de respaldo, confirmar que ya no sirve una segunda
     vez.
  4. Desactivar 2FA, confirmar que el login vuelve a ser de un solo paso.
  5. Solo después de eso, activarlo en la cuenta admin real.
