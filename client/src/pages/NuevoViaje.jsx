import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tripsApi, weatherApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Boton, Campo, Tarjeta, Aviso } from '../components/ui.jsx';

const hoy = new Date().toISOString().slice(0, 10);

export default function NuevoViaje() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState({
    title: '',
    destino: '',
    origen: user?.preferences?.homeCity || '',
    startDate: '',
    endDate: '',
    travelers: 1,
    presupuesto: '',
  });
  const [error, setError] = useState(null);
  const [detalles, setDetalles] = useState([]);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setDetalles([]);
    setEnviando(true);

    try {
      // Se intenta geocodificar el destino para tener mapa y clima desde el inicio.
      // Si falla (sin API key o lugar raro), el viaje se crea igual sin coordenadas.
      let coords = {};
      try {
        const geo = await weatherApi.geocode(form.destino);
        coords = { lat: geo.place.lat, lng: geo.place.lng, country: geo.place.country };
      } catch {
        coords = {};
      }

      const viaje = await tripsApi.create({
        title: form.title.trim() || `Viaje a ${form.destino}`,
        destination: { name: form.destino.trim(), ...coords },
        origin: form.origen.trim() ? { name: form.origen.trim() } : undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        travelers: Number(form.travelers) || 1,
        budget: {
          amount: Number(form.presupuesto) || 0,
          currency: user?.preferences?.currency || 'MXN',
        },
      });

      navigate(`/viajes/${viaje.trip._id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setDetalles(err.details || []);
    } finally {
      setEnviando(false);
    }
  };

  const errorDe = (campo) => detalles.find((d) => d.field === campo || d.field.endsWith(campo))?.message;

  return (
    <div className="pila" style={{ maxWidth: 620, margin: '0 auto' }}>
      <div>
        <Link to="/viajes" className="tenue">
          ← Volver a mis viajes
        </Link>
        <h1 style={{ marginTop: 8 }}>Nuevo viaje</h1>
        <p className="suave" style={{ margin: 0 }}>
          Con el destino y las fechas basta para empezar. Lo demás lo vas llenando después.
        </p>
      </div>

      <Tarjeta>
        <form onSubmit={enviar} className="pila" noValidate>
          {error && <Aviso tipo="error">{error}</Aviso>}

          <Campo
            label="¿A dónde vas?"
            name="destino"
            placeholder="Oaxaca de Juarez, Lisboa, Tokio..."
            value={form.destino}
            onChange={cambiar}
            error={errorDe('destination')}
            required
          />

          <Campo
            label="¿Cómo se llama el viaje?"
            name="title"
            placeholder={form.destino ? `Viaje a ${form.destino}` : 'Escapada de fin de semana'}
            value={form.title}
            onChange={cambiar}
            error={errorDe('title')}
            ayuda="Si lo dejas vacío usamos el destino."
          />

          <div className="rejilla rejilla-2">
            <Campo
              label="Salida"
              name="startDate"
              type="date"
              min={hoy}
              value={form.startDate}
              onChange={cambiar}
              error={errorDe('startDate')}
              required
            />
            <Campo
              label="Regreso"
              name="endDate"
              type="date"
              min={form.startDate || hoy}
              value={form.endDate}
              onChange={cambiar}
              error={errorDe('endDate')}
              required
            />
          </div>

          <Campo
            label="¿Desde dónde sales?"
            name="origen"
            placeholder="Monterrey"
            value={form.origen}
            onChange={cambiar}
            ayuda="Lo usamos para armar las búsquedas de vuelos y autobuses."
          />

          <div className="rejilla rejilla-2">
            <Campo
              label="¿Cuántos viajan?"
              name="travelers"
              type="number"
              min="1"
              max="30"
              value={form.travelers}
              onChange={cambiar}
              error={errorDe('travelers')}
            />
            <Campo
              label="Presupuesto estimado"
              name="presupuesto"
              type="number"
              min="0"
              step="100"
              placeholder="Opcional"
              value={form.presupuesto}
              onChange={cambiar}
              ayuda={`En ${user?.preferences?.currency || 'MXN'}.`}
            />
          </div>

          <div className="fila" style={{ marginTop: 4 }}>
            <Boton type="submit" cargando={enviando}>
              {enviando ? 'Creando...' : 'Crear viaje'}
            </Boton>
            <Link to="/viajes" className="boton secundario">
              Cancelar
            </Link>
          </div>
        </form>
      </Tarjeta>
    </div>
  );
}
