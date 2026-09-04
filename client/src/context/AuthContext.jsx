import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/index.js';
import { sesionFlag, SESION_EXPIRADA } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // "cargando" cubre el arranque: la cookie de sesion es httpOnly, invisible
  // para JS, asi que no hay forma de saber si existe sin preguntarle al
  // servidor -- sesionFlag es la unica pista que SI puede leer este codigo
  // ("¿este navegador inicio sesion antes?"), y evita ese viaje al servidor
  // (con el arranque en frio de Render de por medio) para un visitante que
  // nunca se registro.
  const [cargando, setCargando] = useState(sesionFlag.tuvoSesion());
  // Distingue "cerraste sesion tu" de "se te vencio el token", para el aviso del login.
  const [sesionExpirada, setSesionExpirada] = useState(false);

  const logout = useCallback(() => {
    sesionFlag.limpiar();
    setUser(null);
    setSesionExpirada(false);
    // Best-effort: borra la cookie en el servidor. Si falla (sin red, lo que
    // sea), la cookie vence sola en 7 dias y el estado local ya quedo limpio.
    authApi.logout().catch(() => {});
  }, []);

  // Rehidratar la sesion al abrir la app.
  useEffect(() => {
    if (!sesionFlag.tuvoSesion()) {
      setCargando(false);
      return undefined;
    }

    const controlador = new AbortController();
    authApi
      .me({ signal: controlador.signal })
      .then((data) => setUser(data.user))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setUser(null);
        // Solo un 401 de verdad es "la sesion expiro" -- cualquier otro error
        // (sin red, un 503 del arranque en frio de Render, timeout) no
        // significa que el token sea invalido. Antes esto trataba CUALQUIER
        // error igual, y mandaba a alguien con sesion valida a la pantalla
        // de login diciendole que expiro, solo porque el servidor tardo en
        // despertar.
        if (err.status === 401) {
          sesionFlag.limpiar();
          setSesionExpirada(true);
        }
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
    sesionFlag.marcar();
    setUser(data.user);
    setSesionExpirada(false);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload);
    sesionFlag.marcar();
    setUser(data.user);
    setSesionExpirada(false);
    return data.user;
  }, []);

  // Mismo patron que login y register: el backend ya deja la cookie puesta y
  // devuelve el usuario, asi que se entra directo. Mandar a la persona al
  // login a reescribir la contrasena que acaba de elegir seria pedirsela dos
  // veces seguidas.
  const restablecer = useCallback(async (payload) => {
    const data = await authApi.resetPassword(payload);
    sesionFlag.marcar();
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
