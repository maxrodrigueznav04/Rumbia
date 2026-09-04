import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Cargando } from './ui.jsx';

/** Bloquea las rutas privadas hasta saber si hay sesion valida. */
export default function RutaProtegida({ children }) {
  const { autenticado, cargando } = useAuth();
  const location = useLocation();

  // Sin esta espera, un refresh con token valido parpadearia hacia el login.
  if (cargando) return <Cargando texto="Verificando tu sesión..." />;

  if (!autenticado) {
    // Se recuerda a donde iba para volver ahi despues de entrar.
    return <Navigate to="/entrar" replace state={{ desde: location.pathname }} />;
  }

  return children;
}

/** Lo inverso: si ya hay sesion, login y registro redirigen al dashboard. */
export function RutaPublica({ children }) {
  const { autenticado, cargando } = useAuth();

  if (cargando) return <Cargando texto="Cargando..." />;
  if (autenticado) return <Navigate to="/viajes" replace />;

  return children;
}
