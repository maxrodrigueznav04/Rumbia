import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/index.js';
import { tokenStore, SESION_EXPIRADA } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // "cargando" cubre el arranque: hay token en localStorage pero aun no sabemos si es valido.
  const [cargando, setCargando] = useState(Boolean(tokenStore.get()));
  // Distingue "cerraste sesion tu" de "se te vencio el token", para el aviso del login.
  const [sesionExpirada, setSesionExpirada] = useState(false);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setSesionExpirada(false);
  }, []);

  // Rehidratar la sesion al abrir la app.
  useEffect(() => {
    if (!tokenStore.get()) {
      setCargando(false);
      return undefined;
    }

    const controlador = new AbortController();
    authApi
      .me({ signal: controlador.signal })
      .then((data) => setUser(data.user))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        // Token vencido o invalido: se limpia y se avisa en la pantalla de login.
        tokenStore.clear();
        setUser(null);
        setSesionExpirada(true);
      })
      .finally(() => {
        // Si la peticion se aborto todavia hay otra en curso (StrictMode monta el
        // efecto dos veces, y el usuario puede navegar rapido). Apagar "cargando"
        // aqui dejaria user en null por un instante: la ruta protegida rebotaria
        // al login y se perderia el enlace directo al viaje que se abrio.
        if (!controlador.signal.aborted) setCargando(false);
      });

    return () => controlador.abort();
  }, []);

  // El cliente HTTP avisa cuando el backend responde 401 con un token ya guardado.
  useEffect(() => {
    const alExpirar = () => {
      setUser(null);
      setSesionExpirada(true);
    };
    window.addEventListener(SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(SESION_EXPIRADA, alExpirar);
  }, []);

  const login = useCallback(async (credenciales) => {
    const data = await authApi.login(credenciales);
    tokenStore.set(data.token);
    setUser(data.user);
    setSesionExpirada(false);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload);
    tokenStore.set(data.token);
    setUser(data.user);
    setSesionExpirada(false);
    return data.user;
  }, []);

  // Mismo patron que login y register: el backend ya devuelve token y usuario,
  // asi que se entra directo. Mandar a la persona al login a reescribir la
  // contrasena que acaba de elegir seria pedirsela dos veces seguidas.
  const restablecer = useCallback(async (payload) => {
    const data = await authApi.resetPassword(payload);
    tokenStore.set(data.token);
    setUser(data.user);
    setSesionExpirada(false);
    return data.user;
  }, []);

  const actualizarUsuario = useCallback((parcial) => {
    setUser((prev) => (prev ? { ...prev, ...parcial } : prev));
  }, []);

  const valor = useMemo(
    () => ({
      user,
      cargando,
      sesionExpirada,
      autenticado: Boolean(user),
      login,
      register,
      restablecer,
      logout,
      actualizarUsuario,
    }),
    [user, cargando, sesionExpirada, login, register, restablecer, logout, actualizarUsuario]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
}
