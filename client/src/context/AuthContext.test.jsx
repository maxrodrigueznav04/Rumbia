import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { authApi } from '../api/index.js';
import { REVISION_SESION, sesionFlag } from '../api/client.js';
vi.mock('../api/index.js', () => ({ authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() } }));
function Vista() {
  const { user, cargando, errorSesion, sesionExpirada, login, logout } = useAuth();
  return <><span>{cargando ? 'Cargando' : user?.name || 'Sin sesión'}</span><span>{errorSesion}</span>{sesionExpirada && <span>Expirada</span>}<input aria-label="Borrador privado" /><button onClick={() => login({})}>Entrar</button><button onClick={() => logout()}>Salir</button></>;
}
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });
describe('sesiones entre pestañas', () => {
  it('un cierre voluntario en otra pestaña no se anuncia como expiración', async () => {
    sesionFlag.marcar(); authApi.me.mockResolvedValue({ user: { _id: 'a', name: 'Cuenta A' } });
    render(<AuthProvider><Vista /></AuthProvider>); await screen.findByText('Cuenta A');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: REVISION_SESION, newValue: 'cerrada:2' })));
    await screen.findByText('Sin sesión'); expect(screen.queryByText('Expirada')).not.toBeInTheDocument();
  });
  it('reemplaza identidad y descarta borradores al cambiar de cuenta en otra pestaña', async () => {
    sesionFlag.marcar(); authApi.me.mockResolvedValueOnce({ user: { _id: 'a', name: 'Cuenta A' } }).mockResolvedValueOnce({ user: { _id: 'b', name: 'Cuenta B' } });
    render(<AuthProvider><Vista /></AuthProvider>);
    await screen.findByText('Cuenta A');
    fireEvent.change(screen.getByLabelText('Borrador privado'), { target: { value: 'Datos A' } });
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: REVISION_SESION, newValue: '2' })));
    await screen.findByText('Cuenta B');
    expect(screen.getByLabelText('Borrador privado')).toHaveValue('');
  });
  it('un problema de red no borra la bandera de sesión ni finge una expiración', async () => {
    sesionFlag.marcar(); authApi.me.mockRejectedValue({ status: 0, message: 'Sin conexión' });
    render(<AuthProvider><Vista /></AuthProvider>);
    await screen.findByText('Sin conexión'); expect(sesionFlag.tuvoSesion()).toBe(true);
  });
  it('una respuesta vieja de arranque no reemplaza un login posterior', async () => {
    sesionFlag.marcar(); let resolver;
    authApi.me.mockImplementation(() => new Promise((resolve) => { resolver = resolve; }));
    authApi.login.mockResolvedValue({ user: { _id: 'b', name: 'Cuenta B' } });
    render(<AuthProvider><Vista /></AuthProvider>);
    fireEvent.click(screen.getByText('Entrar')); await screen.findByText('Cuenta B');
    await act(async () => resolver({ user: { _id: 'a', name: 'Cuenta A' } }));
    expect(screen.queryByText('Cuenta A')).not.toBeInTheDocument();
  });
  it('publica también cambios de sesión cuando la bandera ya estaba en 1', async () => {
    authApi.login.mockResolvedValue({ user: { _id: 'a', name: 'Cuenta A' } });
    render(<AuthProvider><Vista /></AuthProvider>); fireEvent.click(screen.getByText('Entrar'));
    await waitFor(() => expect(localStorage.getItem(REVISION_SESION)).toBeTruthy());
  });
});
