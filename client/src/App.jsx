import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import LimiteDeError from './components/LimiteDeError.jsx';
import AvisoServidor from './components/AvisoServidor.jsx';
import Layout from './components/Layout.jsx';
import RutaProtegida, { RutaPublica } from './components/RutaProtegida.jsx';
import Entrar from './pages/Entrar.jsx';
import Registro from './pages/Registro.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NuevoViaje from './pages/NuevoViaje.jsx';
import DetalleViaje from './pages/DetalleViaje.jsx';
import Itinerario from './pages/Itinerario.jsx';
import Perfil from './pages/Perfil.jsx';
import Privacidad from './pages/Privacidad.jsx';
import Cookies from './pages/Cookies.jsx';
import { Vacio } from './components/ui.jsx';

function NoEncontrado() {
  return (
    <div className="pagina contenedor">
      <Vacio
        icono="🧭"
        titulo="Esta ruta no existe"
        accion={
          <Link to="/viajes" className="boton">
            Ir a mis viajes
          </Link>
        }
      >
        Revisa la direccion o vuelve al inicio.
      </Vacio>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LimiteDeError>
        <AuthProvider>
          <AvisoServidor />
          <Routes>
            {/* Publicas: redirigen al dashboard si ya hay sesion. */}
            <Route
              path="/entrar"
              element={
                <RutaPublica>
                  <Entrar />
                </RutaPublica>
              }
            />
            <Route
              path="/registro"
              element={
                <RutaPublica>
                  <Registro />
                </RutaPublica>
              }
            />

            {/* Privadas: comparten el layout con navegacion. */}
            <Route
              element={
                <RutaProtegida>
                  <Layout />
                </RutaProtegida>
              }
            >
              <Route path="/viajes" element={<Dashboard />} />
              <Route path="/viajes/nuevo" element={<NuevoViaje />} />
              <Route path="/viajes/:id" element={<DetalleViaje />} />
              <Route path="/viajes/:id/itinerario" element={<Itinerario />} />
              <Route path="/perfil" element={<Perfil />} />
            </Route>

            {/* Legales: sin guardia. Se tienen que poder leer antes de
                registrarse y también con la sesión abierta. */}
            <Route path="/privacidad" element={<Privacidad />} />
            <Route path="/cookies" element={<Cookies />} />

            <Route path="/" element={<Navigate to="/viajes" replace />} />
            <Route path="*" element={<NoEncontrado />} />
          </Routes>
        </AuthProvider>
      </LimiteDeError>
    </BrowserRouter>
  );
}
