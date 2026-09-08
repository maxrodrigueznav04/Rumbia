import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tripsApi, weatherApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Boton, Campo, Tarjeta, Aviso } from '../components/ui.jsx';
import ClienteDelViaje from '../components/ClienteDelViaje.jsx';
import CampoFechas from '../components/CampoFechas.jsx';
import CampoDestino from '../components/CampoDestino.jsx';
import CampoParadas, { paradasAPayload } from '../components/CampoParadas.jsx';
import { traducirDominio } from '../utils/format.js';

const hoy = new Date().toISOString().slice(0, 10);

const ESTILOS = [
  'aventura', 'cultura', 'relax', 'gastronomia',
  'naturaleza', 'vida-nocturna', 'compras', 'familia',
];
const RITMOS = ['relajado', 'moderado', 'intenso'];

export default function NuevoViaje() {
  const { t } = useTranslation('nuevoViaje');
  const { t: tDominio } = useTranslation('dominio');
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
  // conocen al crear el viaje. Para agencias se usa un respaldo equilibrado.
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
        title: form.title.trim() || t('comoSeLlamaPlaceholder', { destino: nombreDestino }),
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
          {t('volver')}
        </Link>
        <h1 style={{ marginTop: 8 }}>{t('titulo')}</h1>
        <p className="suave" style={{ margin: 0 }}>
          {esAgencia ? t('introAgencia') : t('introPersonal')}
        </p>
      </div>

      <Tarjeta>
        <form onSubmit={enviar} className="pila" noValidate>
          {error && <Aviso tipo="error">{error}</Aviso>}

          <CampoDestino
            label={t('aDondeVas')}
            name="destino"
            placeholder={t('aDondeVasPlaceholder')}
            value={form.destino}
            onChange={cambiar}
            onSeleccionar={setLugarElegido}
            error={errorDe('destination')}
          />

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

            <Campo
              label={t('cuantosViajan')}
              name="travelers"
              type="number"
              min="1"
              max="30"
              value={form.travelers}
              onChange={cambiar}
              error={errorDe('travelers')}
            />
          {esAgencia && <details className="opciones-formulario" open={Boolean(clienteId) || undefined}>
            <summary>{t('clienteOpcional')}</summary>
            <ClienteDelViaje value={{ id: clienteId, nombre: clienteNombre, contacto: clienteContacto }} onChange={(c) => { setClienteId(c.id); setClienteNombre(c.nombre); setClienteContacto(c.contacto); }} />
          </details>}
          <details className="opciones-formulario" open={detalles.some((d) => !['destination', 'startDate', 'endDate', 'travelers'].some((campo) => d.field?.startsWith(campo))) || undefined}><summary>{t('personalizar')}</summary><div className="pila">
          <Campo
            label={t('comoSeLlama')}
            name="title"
            placeholder={form.destino ? t('comoSeLlamaPlaceholder', { destino: form.destino }) : t('comoSeLlamaPlaceholderDefault')}
            value={form.title}
            onChange={cambiar}
            error={errorDe('title')}
            ayuda={t('comoSeLlamaAyuda')}
          />

          <CampoParadas
            paradas={paradas}
            onCambio={setParadas}
            tripStart={form.startDate}
            tripEnd={form.endDate}
          />

          <Campo
            label={t('desdeDondeSales')}
            name="origen"
            placeholder={t('desdeDondeSalesPlaceholder')}
            value={form.origen}
            onChange={cambiar}
            ayuda={t('desdeDondeSalesAyuda')}
          />

          <div className="rejilla rejilla-2">
            <Campo
              label={t('presupuestoEstimado')}
              name="presupuesto"
              type="number"
              min="0"
              step="100"
              placeholder={t('opcional')}
              value={form.presupuesto}
              onChange={cambiar}
              ayuda={t('presupuestoAyuda', { moneda: user?.preferences?.currency || 'MXN' })}
            />
          </div>

          <div className="campo">
            <label>{t('gustosDeQuienViaja')}</label>
            <p className="campo-ayuda" style={{ marginTop: 0 }}>
              {esAgencia ? t('gustosAyudaAgencia') : t('gustosAyudaPersonal')}
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
                    {traducirDominio(tDominio, valor)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rejilla rejilla-2">
            <Campo label={t('ritmoDeViaje')}>
              <select value={pace} onChange={(e) => setPace(e.target.value)}>
                <option value="">{esAgencia ? t('equilibrado') : t('usarDeMiPerfil')}</option>
                {RITMOS.map((valor) => (
                  <option key={valor} value={valor}>
                    {t(`ritmos.${valor}`)}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label={t('nivelDeGasto')}>
              <select value={budgetLevel} onChange={(e) => setBudgetLevel(e.target.value)}>
                <option value="">{esAgencia ? t('equilibrado') : t('usarDeMiPerfil')}</option>
                <option value="bajo">{t('nivelesGasto.bajo')}</option>
                <option value="medio">{t('nivelesGasto.medio')}</option>
                <option value="alto">{t('nivelesGasto.alto')}</option>
              </select>
            </Campo>
          </div>

          </div></details>
          <div className="fila" style={{ marginTop: 4 }}>
            <Boton type="submit" cargando={enviando}>
              {enviando ? t('creando') : t('crearViaje')}
            </Boton>
            <Link to="/viajes" className="boton secundario">
              {t('cancelar')}
            </Link>
          </div>
        </form>
      </Tarjeta>
    </div>
  );
}
