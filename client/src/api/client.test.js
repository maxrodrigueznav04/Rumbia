import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, { tokenStore, ApiError, SESION_EXPIRADA, TIMEOUT_IA_MS } from './client.js';

const respuesta = (body, { status = 200 } = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
});

beforeEach(() => {
  tokenStore.clear();
});

describe('cliente HTTP', () => {
  it('devuelve directamente el data del sobre del backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ success: true, data: { trips: [1, 2] } })));
    await expect(api.get('/trips')).resolves.toEqual({ trips: [1, 2] });
  });

  it('adjunta el token cuando hay sesion', async () => {
    tokenStore.set('abc123');
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/trips');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer abc123');
  });

  it('no lo adjunta cuando la llamada es publica', async () => {
    tokenStore.set('abc123');
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await api.post('/auth/login', { email: 'a@b.com' }, { auth: false });

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
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

  it('con 401 y token guardado limpia la sesion y avisa', async () => {
    tokenStore.set('vencido');
    const oyente = vi.fn();
    window.addEventListener(SESION_EXPIRADA, oyente);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ message: 'No autenticado.' }, { status: 401 })));

    await api.get('/auth/me').catch(() => {});

    expect(tokenStore.get()).toBeNull();
    expect(oyente).toHaveBeenCalled();
    window.removeEventListener(SESION_EXPIRADA, oyente);
  });

  it('no dispara el aviso de sesion vencida si no habia token', async () => {
    const oyente = vi.fn();
    window.addEventListener(SESION_EXPIRADA, oyente);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ message: 'No autenticado.' }, { status: 401 })));

    await api.post('/auth/login', {}, { auth: false }).catch(() => {});

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
    tokenStore.set('abc');
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
