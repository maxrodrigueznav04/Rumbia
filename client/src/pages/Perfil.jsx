import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Boton, Campo, Tarjeta, Aviso, Modal, CampoPassword } from '../components/ui.jsx';

const ESTILOS = [
  'aventura', 'cultura', 'relax', 'gastronomia',
  'naturaleza', 'vida-nocturna', 'compras', 'familia',
];
const RITMOS = [
  { valor: 'relajado', texto: 'Relajado (3 actividades al día)' },
  { valor: 'moderado', texto: 'Moderado (4 actividades al día)' },
  { valor: 'intenso', texto: 'Intenso (5 actividades al día)' },
];

export default function Perfil() {
  const { user, actualizarUsuario, logout } = useAuth();
  const navigate = useNavigate();

  // Baja de cuenta: modal aparte, con la contraseña como confirmación.
  const [bajaAbierta, setBajaAbierta] = useState(false);
  const [passwordBaja, setPasswordBaja] = useState('');
  const [errorBaja, setErrorBaja] = useState(null);
  const [borrando, setBorrando] = useState(false);

  const eliminarCuenta = async (e) => {
    e.preventDefault();
    setErrorBaja(null);
    setBorrando(true);
    try {
      await authApi.deleteAccount({ password: passwordBaja });
      // La cuenta ya no existe: se limpia la sesión antes de navegar para que
      // la ruta protegida no intente rehidratarla con un token muerto.
      logout();
      navigate('/entrar', { replace: true });
    } catch (err) {
      setErrorBaja(err);
    } finally {
      setBorrando(false);
    }
  };

  const [form, setForm] = useState({
    name: user?.name || '',
    homeCity: user?.preferences?.homeCity || '',
    currency: user?.preferences?.currency || 'MXN',
    pace: user?.preferences?.pace || 'moderado',
    budgetLevel: user?.preferences?.budgetLevel || 'medio',
  });
  const [estilos, setEstilos] = useState(user?.preferences?.travelStyles || []);
  const [estado, setEstado] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const alternar = (valor) =>
    setEstilos((prev) =>
      prev.includes(valor)
        ? prev.filter((v) => v !== valor)
        : prev.length < 5
          ? [...prev, valor]
          : prev
    );

  const guardar = async (e) => {
    e.preventDefault();
    setEstado(null);
    setGuardando(true);
    try {
      const data = await authApi.updateProfile({
        name: form.name,
        preferences: {
          travelStyles: estilos,
          homeCity: form.homeCity,
          currency: form.currency,
          pace: form.pace,
          budgetLevel: form.budgetLevel,
        },
      });
      actualizarUsuario(data.user);
      setEstado({ tipo: 'exito', mensaje: 'Preferencias guardadas.' });
    } catch (err) {
      setEstado({ tipo: 'error', mensaje: err.message });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="pila" style={{ maxWidth: 620, margin: '0 auto' }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>Tu perfil</h1>
        <p className="suave" style={{ margin: 0 }}>
          La IA usa estas preferencias para personalizar los itinerarios que te propone.
        </p>
      </div>

      <Tarjeta>
        <form onSubmit={guardar} className="pila" noValidate>
          {estado && <Aviso tipo={estado.tipo}>{estado.mensaje}</Aviso>}

          <Campo label="Nombre" name="name" value={form.name} onChange={cambiar} required />

          <Campo label="Email">
            <input value={user?.email || ''} disabled />
          </Campo>

          <div className="rejilla rejilla-2">
            <Campo
              label="Ciudad de origen"
              name="homeCity"
              placeholder="Monterrey"
              value={form.homeCity}
              onChange={cambiar}
              ayuda="Se usa como origen por defecto."
            />
            <Campo label="Moneda">
              <select name="currency" value={form.currency} onChange={cambiar}>
                {['MXN', 'USD', 'EUR', 'COP', 'ARS', 'CLP', 'PEN'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div className="campo">
            <label>Estilos de viaje (hasta 5)</label>
            <div className="fila" style={{ gap: 6 }}>
              {ESTILOS.map((valor) => {
                const activo = estilos.includes(valor);
                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => alternar(valor)}
                    aria-pressed={activo}
                    className={`insignia ${activo ? 'marca' : ''}`}
                    style={{ cursor: 'pointer', padding: '7px 12px', fontFamily: 'inherit' }}
                  >
                    {valor.replace('-', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          <Campo label="Ritmo de viaje">
            <select name="pace" value={form.pace} onChange={cambiar}>
              {RITMOS.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.texto}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Nivel de gasto">
            <select name="budgetLevel" value={form.budgetLevel} onChange={cambiar}>
              <option value="bajo">Bajo — mochilero, lo económico</option>
              <option value="medio">Medio — cómodo sin excesos</option>
              <option value="alto">Alto — sin fijarse mucho en el precio</option>
            </select>
          </Campo>

          <Boton type="submit" cargando={guardando}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </Boton>
        </form>
      </Tarjeta>

      <Tarjeta titulo="Eliminar mi cuenta" className="zona-peligro">
        <p className="suave">
          Se borran tu cuenta y <strong>todos tus viajes, itinerarios y gastos</strong>. La
          eliminación es inmediata y no se puede deshacer: no hay papelera ni forma de recuperarlos
          después.
        </p>
        <Boton variante="peligro" onClick={() => setBajaAbierta(true)}>
          Eliminar mi cuenta
        </Boton>
      </Tarjeta>

      <Modal
        abierto={bajaAbierta}
        onCerrar={() => {
          setBajaAbierta(false);
          setPasswordBaja('');
          setErrorBaja(null);
        }}
        titulo="¿Eliminar tu cuenta?"
        ancho={440}
      >
        <form onSubmit={eliminarCuenta} className="pila" noValidate>
          <Aviso tipo="alerta" titulo="Esto no se puede deshacer">
            Vas a borrar tu cuenta y todo lo que has guardado en ella. Si solo quieres dejar de
            usarla por ahora, puedes cerrar sesión y volver cuando quieras.
          </Aviso>

          {errorBaja && <Aviso tipo="error">{errorBaja.message}</Aviso>}

          <CampoPassword
            label="Escribe tu contraseña para confirmar"
            name="passwordBaja"
            value={passwordBaja}
            onChange={(e) => setPasswordBaja(e.target.value)}
            autoComplete="current-password"
            required
          />

          <div className="modal-acciones">
            <Boton
              variante="secundario"
              type="button"
              onClick={() => {
                setBajaAbierta(false);
                setPasswordBaja('');
                setErrorBaja(null);
              }}
            >
              Cancelar
            </Boton>
            <Boton variante="peligro" type="submit" cargando={borrando} disabled={!passwordBaja}>
              Sí, eliminar todo
            </Boton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
