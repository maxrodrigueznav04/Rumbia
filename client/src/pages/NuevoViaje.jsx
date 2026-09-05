import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { tripsApi, weatherApi, clientsApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Boton, Campo, Tarjeta, Aviso } from '../components/ui.jsx';
import CampoFechas from '../components/CampoFechas.jsx';
import CampoDestino from '../components/CampoDestino.jsx';
import CampoParadas, { paradasAPayload } from '../components/CampoParadas.jsx';

const hoy = new Date().toISOString().slice(0, 10);

const ESTILOS = [
  'aventura', 'cultura', 'relax', 'gastronomia',
  'naturaleza', 'vida-nocturna', 'compras', 'familia',
];
const RITMOS = [
  { valor: 'relajado', texto: 'Relajado (3 actividades al día)' },
  { valor: 'moderado', texto: 'Moderado (4 actividades al día)' },
  { valor: 'intenso', texto: 'Intenso (5 actividades al día)' },
];

export default function NuevoViaje() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const esAgencia = user?.preferences?.perfilUso !== 'personal';
  const [searchParams] = useSearchParams();

  const clientIdParam = searchParams.get('clientId');
  const clientNameParam = searchParams.get('clientName');
  const clientContactParam = searchParams.get('clientContact');

  // Vienen de Registro.jsx cuando alguien probó el generador sin cuenta
  // (Probar.jsx) y se acaba de registrar: se prellena con lo mismo que ya
  // había escrito ahí, en vez de hacerlo retecleario todo.
  const destinoParam = searchParams.get('destino') || '';
  const startDateParam = searchParams.get('startDate') || '';
  const endDateParam = searchParams.get('endDate') || '';
  const travelersParam = searchParams.get('travelers');
  const estilosParam = searchParams.get('estilos');

  const [clienteId, setClienteId] = useState(clientIdParam || '');
  const [clienteNombre, setClienteNombre] = useState(clientNameParam || '');
  const [clienteContacto, setClienteContacto] = useState(clientContactParam || '');
  const [listaClientes, setListaClientes] = useState([]);

  useEffect(() => {
    clientsApi.list({ limit: 50 }).then((res) => {
      setListaClientes(res.clientes || []);
    }).catch(() => {});
  }, []);

  const seleccionarCliente = (id) => {
    setClienteId(id);
    if (!id) return;
    const encontrado = listaClientes.find((c) => c._id === id);
    if (encontrado) {
      setClienteNombre(encontrado.nombre);
      setClienteContacto(encontrado.telefono || encontrado.email || '');
    }
  };

  const [form, setForm] = useState({
    title: '',
    destino: destinoParam,
    origen: user?.preferences?.homeCity || '',
    startDate: startDateParam,
    endDate: endDateParam,
    travelers: travelersParam ? Number(travelersParam) || 1 : 1,
    presupuesto: '',
  });
  // Gustos del viajero de ESTE viaje, no del perfil de quien lo crea: para
  // una agencia, cada viaje es de un cliente distinto con su propio gusto.
  // Vacios por defecto (a diferencia del perfil) porque no siempre se
  // conocen todavia al crear el viaje — la IA cae al perfil si se dejan asi.
  const [estilos, setEstilos] = useState(estilosParam ? estilosParam.split(',').filter(Boolean) : []);
  const [pace, setPace] = useState('');
  const [budgetLevel, setBudgetLevel] = useState('');

  const alternarEstilo = (valor) =>
    setEstilos((prev) =>
      prev.includes(valor)
        ? prev.filter((v) => v !== valor)
        : prev.length < 5
          ? [...prev, valor]
          : prev
    );
  const [error, setError] = useState(null);
  const [detalles, setDetalles] = useState([]);
  const [enviando, setEnviando] = useState(false);
  // Coordenadas de la sugerencia elegida, si eligió una: asi no hay que
  // volver a geocodificar al guardar, y el mapa/clima arrancan exactos.
  const [lugarElegido, setLugarElegido] = useState(null);
  const [paradas, setParadas] = useState([]);

  const cambiar = (e) => {
    if (e.target.name === 'destino') setLugarElegido(null);
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setDetalles([]);
    setEnviando(true);

    try {
      // Si ya eligió una sugerencia del autocompletado, esas coordenadas ya
      // son las correctas: no hace falta geocodificar de nuevo. Si no eligió
      // ninguna (escribió y ya), se intenta igual al guardar, como antes.
      let coords = {};
      if (lugarElegido) {
        coords = { lat: lugarElegido.lat, lng: lugarElegido.lng, country: lugarElegido.country };
      } else {
        try {
          const geo = await weatherApi.geocode(form.destino);
          coords = { lat: geo.place.lat, lng: geo.place.lng, country: geo.place.country };
        } catch {
          coords = {};
        }
      }

      // Si vino de una sugerencia, el nombre que se guarda es solo el lugar
      // ("Guadalajara"): el estado y el país ya viajan aparte en `coords`, y
      // la pantalla los vuelve a pegar al mostrarlo. Guardar la etiqueta
      // completa duplicaría el país ("Guadalajara, Jalisco, Mexico, Mexico").
      const nombreDestino = lugarElegido?.name || form.destino.trim();

      const viaje = await tripsApi.create({
        title: form.title.trim() || `Viaje a ${nombreDestino}`,
        destination: { name: nombreDestino, ...coords },
        additionalDestinations: paradasAPayload(paradas),
        origin: form.origen.trim() ? { name: form.origen.trim() } : undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        travelers: Number(form.travelers) || 1,
        budget: {
          amount: Number(form.presupuesto) || 0,
          currency: user?.preferences?.currency || 'MXN',
        },
        client: clienteId || undefined,
        cliente:
          clienteNombre.trim() || clienteContacto.trim()
            ? { nombre: clienteNombre.trim(), contacto: clienteContacto.trim() }
            : undefined,
        interests: estilos,
        pace: pace || undefined,
        budgetLevel: budgetLevel || undefined,
      });

      navigate(`/viajes/${viaje.trip._id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setDetalles(err.details || []);
    } finally {
      setEnviando(false);
    }
  };

  // "destination.name" no matchea con endsWith('destination'): terminaba en
  // "name", no en "destination". startsWith(campo + '.') si atrapa un campo
  // anidado sin matchear otro que por casualidad termine en el mismo texto.
  const errorDe = (campo) =>
    detalles.find((d) => d.field === campo || d.field.startsWith(`${campo}.`))?.message;

  return (
    <div className="pila" style={{ maxWidth: 620, margin: '0 auto' }}>
      <div>
        <Link to="/viajes" className="volver">
          ← Volver a mis viajes
        </Link>
        <h1 style={{ marginTop: 8 }}>Nuevo viaje</h1>
        <p className="suave" style={{ margin: 0 }}>
          {esAgencia
            ? 'Con el destino y las fechas basta para empezar. El cliente y el margen los agregas después, desde "Editar".'
            : 'Con el destino y las fechas basta para empezar. Lo demás lo vas llenando después.'}
        </p>
      </div>

      <Tarjeta>
        <form onSubmit={enviar} className="pila" noValidate>
          {error && <Aviso tipo="error">{error}</Aviso>}

          <CampoDestino
            label="¿A dónde vas?"
            name="destino"
            placeholder="Oaxaca de Juárez, Lisboa, Tokio..."
            value={form.destino}
            onChange={cambiar}
            onSeleccionar={setLugarElegido}
            error={errorDe('destination')}
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

          {/* Cliente del viaje / Cotización */}
          <div
            style={{
              background: 'var(--surface-alt)',
              padding: '14px 16px',
              borderRadius: 'var(--radio)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="fila-entre" style={{ alignItems: 'center', marginBottom: 10 }}>
              <span className="etiqueta" style={{ margin: 0 }}>Cliente / Cotización (opcional)</span>
              {listaClientes.length > 0 && (
                <span className="tenue" style={{ fontSize: '0.78rem' }}>
                  {listaClientes.length} en CRM
                </span>
              )}
            </div>

            {listaClientes.length > 0 && (
              <div className="campo" style={{ marginBottom: 10 }}>
                <label>Seleccionar de la cartera de clientes</label>
                <select
                  value={clienteId}
                  onChange={(e) => seleccionarCliente(e.target.value)}
                >
                  <option value="">-- Escribir cliente nuevo o sin asignar --</option>
                  {listaClientes.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.nombre} {c.telefono ? `(${c.telefono})` : c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="rejilla rejilla-2" style={{ gap: 10 }}>
              <Campo
                label="Nombre del cliente o familia"
                placeholder="Ej. Familia González"
                value={clienteNombre}
                onChange={(e) => {
                  setClienteNombre(e.target.value);
                  if (clienteId) setClienteId('');
                }}
                style={{ marginBottom: 0 }}
              />
              <Campo
                label="WhatsApp / Contacto"
                placeholder="55 1234 5678"
                value={clienteContacto}
                onChange={(e) => setClienteContacto(e.target.value)}
                style={{ marginBottom: 0 }}
              />
            </div>
          </div>

          <CampoFechas
            inicio={form.startDate}
            fin={form.endDate}
            minimo={hoy}
            onCambio={({ inicio, fin }) =>
              setForm((f) => ({ ...f, startDate: inicio, endDate: fin }))
            }
            errorInicio={errorDe('startDate')}
            errorFin={errorDe('endDate')}
          />

          <CampoParadas
            paradas={paradas}
            onCambio={setParadas}
            tripStart={form.startDate}
            tripEnd={form.endDate}
          />

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

          <div className="campo">
            <label>Gustos de quien viaja (opcional)</label>
            <p className="campo-ayuda" style={{ marginTop: 0 }}>
              {esAgencia
                ? 'Son del cliente, no los tuyos: si los dejas vacíos, la IA usa tu perfil como respaldo al generar.'
                : 'Si los dejas vacíos, usamos lo que configuraste en tu perfil.'}
            </p>
            <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
              {ESTILOS.map((valor) => {
                const activo = estilos.includes(valor);
                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => alternarEstilo(valor)}
                    aria-pressed={activo}
                    className={`insignia ${activo ? 'marca' : ''}`}
                    style={{ cursor: 'pointer', padding: '7px 12px', fontFamily: 'inherit' }}
                  >
                    {valor.replace(/-/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rejilla rejilla-2">
            <Campo label="Ritmo de viaje">
              <select value={pace} onChange={(e) => setPace(e.target.value)}>
                <option value="">Usar el de mi perfil</option>
                {RITMOS.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.texto}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Nivel de gasto">
              <select value={budgetLevel} onChange={(e) => setBudgetLevel(e.target.value)}>
                <option value="">Usar el de mi perfil</option>
                <option value="bajo">Bajo — mochilero, lo económico</option>
                <option value="medio">Medio — cómodo sin excesos</option>
                <option value="alto">Alto — sin fijarse mucho en el precio</option>
              </select>
            </Campo>
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
