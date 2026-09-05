import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../api/index.js';
import { sesionFlag, SESION_EXPIRADA, CAMBIO_SESION, REVISION_SESION, fijarUsuarioSesion, anunciarSesion } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(sesionFlag.tuvoSesion());
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const [errorSesion, setErrorSesion] = useState(null);
  const secuencia = useRef(0);
  const aplicarUsuario = useCallback((usuario) => {
    fijarUsuarioSesion(usuario?._id);
    setUser(usuario);
  }, []);

  const verificarSesion = useCallback(async ({ signal, bloquear = true } = {}) => {
    const turno = ++secuencia.current;
    if (bloquear) setCargando(true);
    setErrorSesion(null);
    try {
      const data = await authApi.me({ signal });
      if (signal?.aborted || turno !== secuencia.current) return;
      aplicarUsuario(data.user);
      sesionFlag.marcar();
      setSesionExpirada(false);
    } catch (err) {
      if (signal?.aborted || turno !== secuencia.current) return;
      if (err.status === 401) {
        aplicarUsuario(null);
        sesionFlag.limpiar();
        setSesionExpirada(true);
      } else setErrorSesion(err.message);
    } finally {
      if (!signal?.aborted && turno === secuencia.current) setCargando(false);
    }
  }, [aplicarUsuario]);

  useEffect(() => {
    const controlador = new AbortController();
    if (sesionFlag.tuvoSesion()) verificarSesion({ signal: controlador.signal });
    else setCargando(false);
    return () => { controlador.abort(); ++secuencia.current; };
  }, [verificarSesion]);

  useEffect(() => {
    const alCambiar = (event) => {
      if (event.type === 'storage' && event.key === REVISION_SESION && event.newValue?.startsWith('cerrada:')) {
        ++secuencia.current;
        aplicarUsuario(null);
        setCargando(false);
        setErrorSesion(null);
        setSesionExpirada(false);
        return;
      }
      if (event.type !== 'storage' || event.key === REVISION_SESION) verificarSesion();
    };
    const alVolver = () => {
      if (document.visibilityState === 'visible' && sesionFlag.tuvoSesion()) verificarSesion({ bloquear: false });
    };
    const alExpirar = () => {
      // Invalida respuestas antiguas; la comprobación que recibió el 401 puede seguir en vuelo.
      ++secuencia.current;
      aplicarUsuario(null);
      setCargando(false);
      setSesionExpirada(true);
    };
    window.addEventListener('storage', alCambiar);
    window.addEventListener(CAMBIO_SESION, alCambiar);
    window.addEventListener(SESION_EXPIRADA, alExpirar);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.removeEventListener('storage', alCambiar);
      window.removeEventListener(CAMBIO_SESION, alCambiar);
      window.removeEventListener(SESION_EXPIRADA, alExpirar);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [aplicarUsuario, verificarSesion]);

  const terminarEntrada = useCallback((data) => {
    ++secuencia.current;
    aplicarUsuario(data.user);
    sesionFlag.marcar();
    setSesionExpirada(false);
    setErrorSesion(null);
    setCargando(false);
    anunciarSesion();
    return data.user;
  }, [aplicarUsuario]);
  const login = useCallback(async (payload) => terminarEntrada(await authApi.login(payload)), [terminarEntrada]);
  const register = useCallback(async (payload) => terminarEntrada(await authApi.register(payload)), [terminarEntrada]);
  const restablecer = useCallback(async (payload) => terminarEntrada(await authApi.resetPassword(payload)), [terminarEntrada]);
  const logout = useCallback(async () => {
    await authApi.logout();
    ++secuencia.current;
    aplicarUsuario(null);
    sesionFlag.limpiar();
    setSesionExpirada(false);
    setErrorSesion(null);
    setCargando(false);
    anunciarSesion('cerrada');
  }, [aplicarUsuario]);
  const actualizarUsuario = useCallback((parcial) => {
    setUser((prev) => (prev ? { ...prev, ...parcial } : prev));
  }, []);
  const valor = useMemo(() => ({ user, cargando, sesionExpirada, errorSesion, verificarSesion,
    autenticado: Boolean(user), login, register, restablecer, logout, actualizarUsuario }),
    [user, cargando, sesionExpirada, errorSesion, verificarSesion, login, register, restablecer, logout, actualizarUsuario]);

  // Un cambio de identidad desmonta formularios, chat y datos de la cuenta anterior.
  return <AuthContext.Provider value={valor}><Fragment key={user?._id || 'publico'}>{children}</Fragment></AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
}
