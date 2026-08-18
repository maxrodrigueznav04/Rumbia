import { useState } from 'react';
import { authApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Boton, Campo, Tarjeta, Aviso } from '../components/ui.jsx';

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
  const { user, actualizarUsuario } = useAuth();

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
    </div>
  );
}
