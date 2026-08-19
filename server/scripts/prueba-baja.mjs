/** Prueba de la baja de cuenta contra la API local. */
const API = 'http://localhost:4000/api';
const PASS = 'prueba1234';
const EMAIL = `baja-${process.pid}@ejemplo.com`;

let fallos = 0;
const check = (ok, texto) => {
  console.log(`  ${ok ? 'ok  ' : 'FALLA'} ${texto}`);
  if (!ok) fallos += 1;
};

const req = async (metodo, ruta, { token, body } = {}) => {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

console.log('\n== Baja de cuenta ==');

// 1. Cuenta desechable con datos dentro.
const alta = await req('POST', '/auth/register', {
  body: { name: 'Cuenta De Prueba', email: EMAIL, password: PASS },
});
check(alta.status === 201 || alta.status === 200, `alta de ${EMAIL} -> ${alta.status}`);
const token = alta.json?.data?.token;

const viaje = await req('POST', '/trips', {
  token,
  body: {
    title: 'Viaje de prueba',
    destination: { name: 'Monterrey', country: 'MX', lat: 25.6866, lng: -100.3161 },
    startDate: '2026-12-01',
    endDate: '2026-12-04',
    travelers: 1,
  },
});
check(viaje.status === 201, `viaje creado -> ${viaje.status}`);
const tripId = viaje.json?.data?.trip?._id;

const itin = await req('POST', `/trips/${tripId}/itinerary`, { token });
check(itin.status === 201, `itinerario en blanco -> ${itin.status}`);

const gasto = await req('POST', '/expenses', {
  token,
  body: { trip: tripId, category: 'comida', description: 'Prueba', amount: 100, date: '2026-12-02' },
});
check(gasto.status === 201, `gasto creado -> ${gasto.status}`);

// 2. Contrasena incorrecta: no debe borrar nada.
const mala = await req('DELETE', '/auth/me', { token, body: { password: 'incorrecta' } });
check(mala.status === 401, `contrasena incorrecta -> ${mala.status} (se espera 401)`);

const sigue = await req('GET', '/auth/me', { token });
check(sigue.status === 200, `la cuenta sigue viva tras el intento fallido -> ${sigue.status}`);

// 3. Sin contrasena: lo rechaza el validador.
const vacia = await req('DELETE', '/auth/me', { token, body: {} });
check(vacia.status === 400, `sin contrasena -> ${vacia.status} (se espera 400)`);

// 4. Baja real.
const baja = await req('DELETE', '/auth/me', { token, body: { password: PASS } });
check(baja.status === 200, `baja -> ${baja.status}`);
check(baja.json?.data?.viajesEliminados === 1, `reporta 1 viaje eliminado -> ${baja.json?.data?.viajesEliminados}`);

// 5. El token ya no sirve y no se puede volver a entrar.
const despues = await req('GET', '/auth/me', { token });
check(despues.status === 401, `el token queda muerto -> ${despues.status}`);

const login = await req('POST', '/auth/login', { body: { email: EMAIL, password: PASS } });
check(login.status === 401, `ya no se puede entrar -> ${login.status}`);

// 6. La cuenta demo esta protegida.
const demo = await req('POST', '/auth/login', {
  body: { email: 'demo@rumbo.app', password: 'demo1234' },
});
if (demo.status === 200) {
  const intento = await req('DELETE', '/auth/me', {
    token: demo.json.data.token,
    body: { password: 'demo1234' },
  });
  check(intento.status === 403, `la cuenta demo NO se puede borrar -> ${intento.status} (se espera 403)`);
  const viva = await req('GET', '/auth/me', { token: demo.json.data.token });
  check(viva.status === 200, `la demo sigue viva -> ${viva.status}`);
} else {
  check(false, `no se pudo entrar a la demo para probar la proteccion -> ${demo.status}`);
}

console.log(fallos ? `\nFALLARON ${fallos}\n` : '\nTODO OK\n');
process.exit(fallos ? 1 : 0);
