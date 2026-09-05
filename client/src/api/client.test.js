import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, { sesionFlag, ApiError, SESION_EXPIRADA, TIMEOUT_IA_MS, fijarUsuarioSesion, CAMBIO_SESION } from './client.js';

const respuesta = (body, { status = 200 } = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
});

beforeEach(() => {
  sesionFlag.limpiar();
  fijarUsuarioSesion(null);
});

describe('cliente HTTP', () => {
  it('fija la cuenta esperada en lecturas y cambios privados, pero no en la revalidación ni enlaces públicos', async () => {
    fijarUsuarioSesion('cuenta-a');
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ data: {} }));
    vi.stubGlobal('fetch', fetchMock);
    await api.patch('/auth/me', { name: 'Nombre' });
    await api.get('/trips');
    await api.get('/auth/me');
    await api.get('/public/itinerary/token', { auth: false });
    expect(fetchMock.mock.calls.map((c) => c[1].headers['X-Rumbia-User'])).toEqual(['cuenta-a', 'cuenta-a', undefined, undefined]);
  });
  it('un conflicto de identidad solicita revalidación y no reintenta la escritura', async () => {
    const oyente = vi.fn(); window.addEventListener(CAMBIO_SESION, oyente);
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ message: 'La cuenta activa cambió. Actualiza la sesión antes de continuar.' }, { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.patch('/trips/1', { title: 'Otro' })).rejects.toMatchObject({ status: 409 });
    expect(oyente).toHaveBeenCalledOnce(); expect(fetchMock).toHaveBeenCalledOnce();
    window.removeEventListener(CAMBIO_SESION, oyente);
  });
  it('devuelve directamente el data del sobre del backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ success: true, data: { trips: [1, 2] } })));
    await expect(api.get('/trips')).resolves.toEqual({ trips: [1, 2] });
  });

  it('manda credentials:include para que el navegador adjunte la cookie de sesion', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/trips');

    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('convierte el error del backend en ApiError con status y details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respuesta({ message: 'Datos invalidos.', details: [{ field: 'email', message: 'mal' }] }, { status: 400 })
      )
    );

    const err = await api.post('/trips', {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Datos invalidos.');
    expect(err.details).toHaveLength(1);
  });

  it('con 401 y bandera de sesion previa avisa que vencio', async () => {
    sesionFlag.marcar();
    const oyente = vi.fn();
    window.addEventListener(SESION_EXPIRADA, oyente);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ message: 'No autenticado.' }, { status: 401 })));

    await api.get('/auth/me').catch(() => {});

    expect(sesionFlag.tuvoSesion()).toBe(false);
    expect(oyente).toHaveBeenCalled();
    window.removeEventListener(SESION_EXPIRADA, oyente);
  });

  it('no dispara el aviso de sesion vencida si nunca hubo sesion', async () => {
    const oyente = vi.fn();
    window.addEventListener(SESION_EXPIRADA, oyente);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ message: 'No autenticado.' }, { status: 401 })));

    await api.get('/auth/me').catch(() => {});

    expect(oyente).not.toHaveBeenCalled();
    window.removeEventListener(SESION_EXPIRADA, oyente);
  });

  it('traduce la caida de red a un mensaje util, no a "Failed to fetch"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const err = await api.get('/trips').catch((e) => e);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/conexi/i);
  });

  it('devuelve null en 204 sin intentar parsear', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(undefined, { status: 204 })));
    await expect(api.delete('/trips/1')).resolves.toBeNull();
  });

  it('el DELETE puede llevar cuerpo: la baja de cuenta manda la contrasena', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await api.delete('/auth/me', { body: { password: 'secreta' } });

    const opciones = fetchMock.mock.calls[0][1];
    expect(opciones.method).toBe('DELETE');
    expect(JSON.parse(opciones.body)).toEqual({ password: 'secreta' });
    expect(opciones.headers['Content-Type']).toBe('application/json');
  });

  it('la generacion con IA usa un timeout mayor que el del servidor', () => {
    // El servidor le da 90 s a Gemini: si el cliente cortara antes, el
    // itinerario quedaria guardado y el usuario veria un error.
    expect(TIMEOUT_IA_MS).toBeGreaterThan(90000);
  });
});
