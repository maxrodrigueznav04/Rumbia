import { useState } from 'react';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { authApi, despertarServidor } from '../api/index.js';
import useFormulario from '../hooks/useFormulario.js';
import { reglas } from '../utils/validacion.js';
import { Boton, Campo, CampoPassword, Aviso } from '../components/ui.jsx';

const ESTILOS = [
  { valor: 'aventura', texto: 'Aventura', icono: '🧗' },
  { valor: 'cultura', texto: 'Cultura', icono: '🏛️' },
  { valor: 'relax', texto: 'Relax', icono: '🌴' },
  { valor: 'gastronomia', texto: 'Gastronomía', icono: '🍽️' },
  { valor: 'naturaleza', texto: 'Naturaleza', icono: '🌿' },
  { valor: 'vida-nocturna', texto: 'Vida nocturna', icono: '🌙' },
  { valor: 'compras', texto: 'Compras', icono: '🛍️' },
  { valor: 'familia', texto: 'Familia', icono: '👨‍👩‍👧' },
];

export default function Registro() {
  // Render duerme el plan gratuito: se despierta mientras el usuario escribe,
  // asi el login no carga con los ~50 s del arranque en frio.
  useEffect(() => {
    despertarServidor();
  }, []);

  const { register } = useAuth();
  const navigate = useNavigate();
  const [estilos, setEstilos] = useState([]);
  const [perfilUso, setPerfilUso] = useState('agencia');

  const form = useFormulario(
    { name: '', email: '', password: '', referenciaContacto: '' },
    { name: reglas.nombre, email: reglas.email, password: reglas.password }
  );

  // Máximo 5 estilos: es el límite que valida el backend.
  const alternarEstilo = (valor) =>
    setEstilos((prev) =>
      prev.includes(valor)
        ? prev.filter((v) => v !== valor)
        : prev.length < 5
          ? [...prev, valor]
          : prev
    );

  const crear = form.enviar(async (valores) => {
    await register({ ...valores, perfilUso });
    // Las preferencias se guardan aparte para no bloquear el alta si algo falla.
    if (estilos.length) {
      await authApi.updateProfile({ preferences: { travelStyles: estilos } }).catch(() => {});
    }
    navigate('/viajes', { replace: true });
  });

  return (
    <div className="auth-pantalla">
      <div className="auth-caja">
        <div className="auth-encabezado">
          <div className="marca" style={{ justifyContent: 'center', marginBottom: 10 }}>
            <span className="marca-punto" aria-hidden="true">
              R
            </span>
            Rumbo
          </div>
          <h1 style={{ fontSize: '1.35rem' }}>
            {perfilUso === 'agencia' ? 'Arma propuestas para tus clientes' : 'Planea tu próximo viaje'}
          </h1>
          <p>
            {perfilUso === 'agencia'
              ? 'Cliente, margen y tu marca en cada itinerario que armes.'
              : 'Transporte, hospedaje e itinerario en un solo lugar.'}
          </p>
        </div>

        <form onSubmit={crear} className="pila" noValidate>
          {/* Honeypot: invisible para una persona, tentador para un bot que
              rellena todo lo que encuentra en el formulario. Ver registerSchema
              y register() en el servidor. */}
          <input
            type="text"
            name="referenciaContacto"
            value={form.valores.referenciaContacto}
            onChange={form.cambiar}
            className="campo-senuelo"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

          <div className="campo">
            <label>¿Cómo vas a usar Rumbo?</label>
            <div className="selector-perfil-uso">
              <button
                type="button"
                aria-pressed={perfilUso === 'agencia'}
                className={`opcion-perfil-uso ${perfilUso === 'agencia' ? 'activo' : ''}`}
                onClick={() => setPerfilUso('agencia')}
              >
                <strong>Soy agencia o agente</strong>
                <span className="tenue">Armo viajes para clientes: cliente, margen, propuestas</span>
              </button>
              <button
                type="button"
                aria-pressed={perfilUso === 'personal'}
                className={`opcion-perfil-uso ${perfilUso === 'personal' ? 'activo' : ''}`}
                onClick={() => setPerfilUso('personal')}
              >
                <strong>Viajo por mi cuenta</strong>
                <span className="tenue">Planeo mis propios viajes, sin nada de agencia</span>
              </button>
            </div>
            <span className="campo-ayuda">Lo puedes cambiar después desde tu perfil.</span>
          </div>

          <Campo
            label="Nombre"
            autoComplete="name"
            placeholder="¿Cómo te llamas?"
            autoFocus
            {...form.props('name')}
          />

          <Campo
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            {...form.props('email')}
          />

          <CampoPassword
            label="Contraseña"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            medidor
            ayuda="Mínimo 8 caracteres. Una frase larga es más segura que símbolos raros."
            {...form.props('password')}
          />

          <div className="campo">
            <label>
              ¿Qué tipo de viajes te gustan?{' '}
              <span className="campo-ayuda" style={{ fontWeight: 400 }}>
                (opcional, hasta 5)
              </span>
            </label>
            <div className="fila" style={{ gap: 6 }}>
              {ESTILOS.map((e) => {
                const activo = estilos.includes(e.valor);
                const lleno = estilos.length >= 5 && !activo;
                return (
                  <button
                    key={e.valor}
                    type="button"
                    onClick={() => alternarEstilo(e.valor)}
                    aria-pressed={activo}
                    disabled={lleno}
                    className={`insignia ${activo ? 'marca' : ''}`}
                    style={{ opacity: lleno ? 0.45 : 1, cursor: lleno ? 'not-allowed' : 'pointer' }}
                  >
                    <span aria-hidden="true">{e.icono}</span>
                    {e.texto}
                  </button>
                );
              })}
            </div>
            <span className="campo-ayuda">
              La IA usa esto para sugerirte actividades que sí te interesen. Lo puedes cambiar
              después.
            </span>
          </div>

          <Boton type="submit" ancho cargando={form.enviando}>
            {form.enviando ? 'Creando cuenta...' : 'Crear cuenta'}
          </Boton>

          {/* Antes de dar sus datos, el usuario tiene que poder leer qué se
              hace con ellos: por eso el enlace va junto al botón, no en el pie. */}
          <p className="tenue legal-nota">
            Al crear tu cuenta aceptas los <Link to="/terminos">términos y condiciones</Link>, la{' '}
            <Link to="/privacidad">política de privacidad</Link> y el{' '}
            <Link to="/cookies">aviso de cookies</Link>.
          </p>
        </form>

        <p className="auth-pie">
          ¿Ya tienes cuenta? <Link to="/entrar">Entra aquí</Link>
        </p>
      </div>
    </div>
  );
}
