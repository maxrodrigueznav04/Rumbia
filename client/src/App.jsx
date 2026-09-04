import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LimiteDeError from './components/LimiteDeError.jsx';
import AvisoServidor from './components/AvisoServidor.jsx';
import Layout from './components/Layout.jsx';
import RutaProtegida, { RutaPublica } from './components/RutaProtegida.jsx';
import Entrar from './pages/Entrar.jsx';
import Recuperar from './pages/Recuperar.jsx';
import Restablecer from './pages/Restablecer.jsx';
import Registro from './pages/Registro.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NuevoViaje from './pages/NuevoViaje.jsx';
import DetalleViaje from './pages/DetalleViaje.jsx';
import Itinerario from './pages/Itinerario.jsx';
import Perfil from './pages/Perfil.jsx';
import Plantillas from './pages/Plantillas.jsx';
import Clientes from './pages/Clientes.jsx';
import Inicio from './pages/Inicio.jsx';
import Privacidad from './pages/Privacidad.jsx';
import Terminos from './pages/Terminos.jsx';
import ItinerarioCompartido from './pages/ItinerarioCompartido.jsx';
import Cookies from './pages/Cookies.jsx';
import Acerca from './pages/Acerca.jsx';
import { Vacio } from './components/ui.jsx';

function NoEncontrado() {
  // Alcanzable con o sin sesion (no vive bajo RutaProtegida): mandar a
  // quien no tiene sesion por /viajes solo lo rebota a /entrar de vuelta.
  const { autenticado } = useAuth();
  return (
    <div className="pagina contenedor">
      <Vacio
        icono="🧭"
        titulo="Esta ruta no existe"
        accion={
          <Link to={autenticado ? '/viajes' : '/'} className="boton">
            {autenticado ? 'Ir a mis viajes' : 'Ir al inicio'}
          </Link>
        }
      >
        Revisa la dirección o vuelve al inicio.
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

            <Route
              path="/recuperar"
              element={
                <RutaPublica>
                  <Recuperar />
                </RutaPublica>
              }
            />

            {/* Sin RutaPublica a proposito: quien recupera la contrasena puede
                tener todavia una sesion abierta —es justo el caso de "se metio
                alguien mas"— y la guardia lo mandaria al panel sin dejarlo
                restablecer nada. */}
            <Route path="/restablecer/:token" element={<Restablecer />} />

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
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/viajes/:id" element={<DetalleViaje />} />
              <Route path="/viajes/:id/itinerario" element={<Itinerario />} />
              <Route path="/plantillas" element={<Plantillas />} />
              <Route path="/perfil" element={<Perfil />} />
            </Route>

            {/* Legales: sin guardia. Se tienen que poder leer antes de
                registrarse y también con la sesión abierta. */}
            <Route path="/privacidad" element={<Privacidad />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/terminos" element={<Terminos />} />

            {/* Itinerario compartido: se abre con el token, sin sesion. */}
            <Route path="/i/:token" element={<ItinerarioCompartido />} />

            {/* Acerca de: explicacion de producto para viajeros y agencias */}
            <Route path="/acerca" element={<Acerca />} />
            <Route path="/acerca-de" element={<Navigate to="/acerca" replace />} />

            {/* La portada es publica: quien llega sin cuenta tiene que poder
                ver que hace la app y probarla antes de registrarse. */}
            <Route path="/" element={<Inicio />} />
            <Route path="*" element={<NoEncontrado />} />
          </Routes>
        </AuthProvider>
      </LimiteDeError>
    </BrowserRouter>
  );
}
