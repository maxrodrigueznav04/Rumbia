import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { agencyApi, authApi, billingApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import Icono from './Icono.jsx';
import { FUENTES_PDF, DENSIDADES_PDF } from '../utils/fuentesPdf.js';
import { Boton, Campo, Tarjeta, Aviso, Insignia, ModalConfirmar, Cargando, ErrorCarga } from './ui.jsx';

/**
 * Precios de referencia, solo para mostrar en pantalla: lo que de verdad se
 * cobra lo decide Stripe con los Price que arma "npm run stripe:setup". Si
 * cambian ahi, hay que actualizar esto a mano para que no digan cosas
 * distintas.
 */
const PLANES = {
  inicio_mensual: { etiqueta: 'Inicio / Solo (Mensual)', base: '$190 MXN/mes', agentesBase: 3, ayuda: 'De 1 a 3 agentes incluidos' },
  inicio_anual: { etiqueta: 'Inicio / Solo (Anual)', base: '$1,950 MXN/año', agentesBase: 3, ayuda: 'De 1 a 3 agentes incluidos (ahorra 1.5 meses)' },
  agencia_mensual: { etiqueta: 'Agencia (Mensual)', base: '$450 MXN/mes', agentesBase: 8, ayuda: 'De 4 a 8 agentes incluidos' },
  agencia_anual: { etiqueta: 'Agencia (Anual)', base: '$4,650 MXN/año', agentesBase: 8, ayuda: 'De 4 a 8 agentes incluidos (ahorra 1.5 meses)' },
  pro_mensual: { etiqueta: 'Agencia Pro (Mensual)', base: '$750 MXN/mes', agentesBase: 15, agente: '+$75 MXN/mes por agente extra (16+)', permiteExtra: true },
  pro_anual: { etiqueta: 'Agencia Pro (Anual)', base: '$7,800 MXN/año', agentesBase: 15, agente: '+$780 MXN/año por agente extra (16+)', permiteExtra: true },
  mensual: { etiqueta: 'Mensual (Legacy)', base: '$20 USD/mes', agente: '+$10 USD/mes por agente extra', permiteExtra: true },
  anual: { etiqueta: 'Anual (Legacy)', base: '$200 USD/año', agente: '+$100 USD/año por agente extra', permiteExtra: true },
  vitalicio: { etiqueta: 'De por vida (Legacy)', base: '$500 USD pago único', agente: '+$250 USD único por agente extra' },
};

export const TIERS_SELECCION = [
  {
    id: 'inicio',
    nombre: 'Inicio / Solo',
    capacidad: '1 a 3 agentes incluidos',
    montoMensual: '$190',
    montoAnual: '$1,950',
    precioMensual: '$190 MXN',
    precioAnual: '$1,950 MXN',
    puntos: [
      'De 1 a 3 agentes incluidos',
      '25 itinerarios inteligentes al mes',
      'Viajes manuales y PDFs ilimitados',
      'Datos de contacto del asesor',
    ],
  },
  {
    id: 'agencia',
    nombre: 'Agencia',
    destacado: true,
    capacidad: '4 a 8 agentes incluidos',
    montoMensual: '$450',
    montoAnual: '$4,650',
    precioMensual: '$450 MXN',
    precioAnual: '$4,650 MXN',
    puntos: [
      'De 4 a 8 agentes incluidos',
      '150 itinerarios inteligentes al mes',
      'Logo y membrete oficial en PDF',
      'Margen de ganancia automático',
      'Ocultar desglose de precios',
      'Reporte de productividad por agente',
    ],
  },
  {
    id: 'pro',
    nombre: 'Agencia Pro',
    capacidad: 'Hasta 15 agentes incluidos',
    montoMensual: '$750',
    montoAnual: '$7,800',
    precioMensual: '$750 MXN',
    precioAnual: '$7,800 MXN',
    permiteExtra: true,
    puntos: [
      'Hasta 15 agentes incluidos',
      '500 itinerarios inteligentes al mes',
      'Marca blanca (sin pie de Rumbia)',
      'Soporte prioritario por WhatsApp',
      'Asistente virtual de viaje ilimitado',
    ],
  },
];

/**
 * La marca del PDF, en sus tres estados posibles: sin agencia (marca propia,
 * como siempre), miembro de una agencia (marca de la agencia, de solo
 * lectura), o dueño de una agencia (marca editable + gestion de quien mas
 * pertenece).
 *
 * Vive aparte de Perfil.jsx porque los tres estados ya son bastante logica
 * como para no meterla en un archivo que ya tiene el formulario de
 * preferencias y la baja de cuenta.
 */
export default function TarjetaAgencia({ user, actualizarUsuario }) {
  if (user?.agency) {
    return <VistaConAgencia actualizarUsuario={actualizarUsuario} />;
  }
  return <VistaSinAgencia user={user} actualizarUsuario={actualizarUsuario} />;
}

/* ------------------------------------------------------------------ */
/* Sin agencia: marca propia + opcion de crear o unirse                */
/* ------------------------------------------------------------------ */

function VistaSinAgencia({ user, actualizarUsuario }) {
  const [form, setForm] = useState({
    agencyName: user?.branding?.agencyName || '',
    logoUrl: user?.branding?.logoUrl || '',
    contact: user?.branding?.contact || '',
  });
  const [estado, setEstado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState(null);
  const inputLogoRef = useRef(null);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    setEstado(null);
    setGuardando(true);
    try {
      const data = await authApi.updateProfile({ branding: form });
      actualizarUsuario(data.user);
      setEstado({ tipo: 'exito', mensaje: 'Marca guardada.' });
    } catch (err) {
      setEstado({ tipo: 'error', mensaje: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const subirLogo = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setErrorLogo(null);
    setSubiendoLogo(true);
    try {
      const data = await authApi.uploadLogo(archivo);
      actualizarUsuario(data.user);
      setForm((f) => ({ ...f, logoUrl: data.user.branding.logoUrl }));
    } catch (err) {
      setErrorLogo(err.message);
    } finally {
      setSubiendoLogo(false);
    }
  };

  const quitarLogo = async () => {
    setErrorLogo(null);
    setSubiendoLogo(true);
    try {
      const data = await authApi.updateProfile({ branding: { logoUrl: '' } });
      actualizarUsuario(data.user);
      setForm((f) => ({ ...f, logoUrl: '' }));
    } catch (err) {
      setErrorLogo(err.message);
    } finally {
      setSubiendoLogo(false);
    }
  };

  return (
    <>
      <Tarjeta titulo="Marca en el PDF">
        <p className="suave" style={{ marginTop: 0 }}>
          Si armas itinerarios para otras personas, esto es lo que aparece en el membrete cuando
          descargas el PDF. Déjalo vacío y sale la marca de Rumbia.
        </p>

        {estado && (
          <Aviso tipo={estado.tipo} titulo={estado.tipo === 'exito' ? undefined : 'No se pudo guardar'}>
            {estado.mensaje}
          </Aviso>
        )}

        <form onSubmit={guardar} className="pila" noValidate>
          <Campo
            label="Nombre de tu agencia o negocio"
            name="agencyName"
            value={form.agencyName}
            onChange={cambiar}
            placeholder="Viajes del Sur"
          />

          <div className="campo">
            <label>Logo</label>
            <div className="fila" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {form.logoUrl && (
                <img
                  src={form.logoUrl}
                  alt=""
                  style={{
                    height: 40,
                    maxWidth: 120,
                    objectFit: 'contain',
                    borderRadius: 'var(--radio-xs)',
                    border: '1px solid var(--border)',
                  }}
                />
              )}
              <input
                ref={inputLogoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={subirLogo}
                style={{ display: 'none' }}
                tabIndex={-1}
                aria-hidden="true"
              />
              <Boton
                type="button"
                variante="secundario"
                chico
                cargando={subiendoLogo}
                onClick={() => inputLogoRef.current?.click()}
              >
                <Icono nombre="mas" tamano={14} /> {form.logoUrl ? 'Cambiar logo' : 'Subir logo'}
              </Boton>
              {form.logoUrl && (
                <Boton type="button" variante="peligro-texto" chico onClick={quitarLogo} cargando={subiendoLogo}>
                  Quitar
                </Boton>
              )}
            </div>
            {errorLogo && (
              <span className="campo-error" role="alert">
                {errorLogo}
              </span>
            )}
            <span className="campo-ayuda">PNG, JPEG o WebP, hasta 2 MB.</span>
          </div>

          <Campo
            label="O pega la URL de un logo que ya esté publicado"
            name="logoUrl"
            type="url"
            value={form.logoUrl}
            onChange={cambiar}
            placeholder="https://tusitio.com/logo.png"
          />

          <Campo
            label="Contacto que aparece bajo el logo"
            name="contact"
            value={form.contact}
            onChange={cambiar}
            placeholder="ventas@viajesdelsur.mx · 55 1234 5678"
          />

          <div>
            <Boton type="submit" cargando={guardando}>
              Guardar marca
            </Boton>
          </div>
        </form>
      </Tarjeta>

      <UnirseOCrear actualizarUsuario={actualizarUsuario} />
    </>
  );
}

/** Crear una agencia o unirse a una con un codigo. Solo aplica sin agencia. */
function UnirseOCrear({ actualizarUsuario }) {
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [creando, setCreando] = useState(false);
  const [uniendo, setUniendo] = useState(false);
  const [error, setError] = useState(null);

  const crear = async (e) => {
    e.preventDefault();
    setError(null);
    setCreando(true);
    try {
      const data = await agencyApi.crear({ agencyName: nombre });
      actualizarUsuario(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  };

  const unirse = async (e) => {
    e.preventDefault();
    setError(null);
    setUniendo(true);
    try {
      const data = await agencyApi.unirse({ inviteCode: codigo });
      actualizarUsuario(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setUniendo(false);
    }
  };

  return (
    <Tarjeta titulo="¿Trabajas con más agentes?">
      <p className="suave" style={{ marginTop: 0 }}>
        Una agencia comparte la misma marca en el PDF entre varios agentes, cada uno con su propia
        cuenta y sus propios viajes.
      </p>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="rejilla-detalle" style={{ gap: 20 }}>
        <form onSubmit={crear} className="pila-sm">
          <Campo
            label="Crear una agencia nueva"
            name="nombreAgencia"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la agencia"
          />
          <Boton type="submit" variante="secundario" chico cargando={creando} disabled={!nombre.trim()}>
            Crear agencia
          </Boton>
        </form>

        <form onSubmit={unirse} className="pila-sm">
          <Campo
            label="Unirme con un código"
            name="codigoAgencia"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código que te dio tu agencia"
          />
          <Boton type="submit" variante="secundario" chico cargando={uniendo} disabled={!codigo.trim()}>
            Unirme
          </Boton>
        </form>
      </div>
    </Tarjeta>
  );
}

/* ------------------------------------------------------------------ */
/* Con agencia: marca de la agencia, editable solo si eres el dueño    */
/* ------------------------------------------------------------------ */

function VistaConAgencia({ actualizarUsuario }) {
  const { data, cargando, error, recargar } = useFetch(({ signal }) => agencyApi.obtener({ signal }), []);
  const [avisoStripe, setAvisoStripe] = useState(null);

  // Vuelta de Stripe Checkout: se limpia el query param de la URL y se
  // refresca la agencia. El webhook puede tardar un par de segundos mas que
  // la redirección del navegador, asi que se recarga una segunda vez.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get('billing');
    if (!resultado) return;

    window.history.replaceState({}, '', window.location.pathname);

    if (resultado === 'exito') {
      setAvisoStripe('Pago recibido. Activando tu plan...');
      recargar();
      const t = setTimeout(() => {
        recargar();
        setAvisoStripe(null);
      }, 2500);
      return () => clearTimeout(t);
    }
    if (resultado === 'cancelado') {
      setAvisoStripe('No se completó el pago: no se hizo ningún cargo.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cargando) {
    return (
      <Tarjeta titulo="Marca en el PDF">
        <Cargando texto="Cargando tu agencia..." />
      </Tarjeta>
    );
  }
  if (error) {
    return (
      <Tarjeta titulo="Marca en el PDF">
        <ErrorCarga error={error} onReintentar={recargar} />
      </Tarjeta>
    );
  }
  if (!data) return null;

  return (
    <>
      {avisoStripe && <Aviso tipo="info">{avisoStripe}</Aviso>}
      {data.esDueno ? (
        <VistaDueno
          agencia={data.agency}
          miembros={data.miembros}
          actualizarUsuario={actualizarUsuario}
          recargar={recargar}
        />
      ) : (
        <VistaMiembro agencia={data.agency} actualizarUsuario={actualizarUsuario} />
      )}
    </>
  );
}

/**
 * Aparece cuando la agencia no tiene un plan activo — incluye al dueño solo,
 * sin nadie más unido: crear una agencia es gratis, pero usarla (crear o
 * editar viajes) ya requiere un plan activo desde el primer agente. Nadie
 * pierde datos: solo no se puede crear ni editar hasta activarla.
 */
function calcularTrial(billing) {
  if (!billing) return { enTrial: false, diasRestantes: 0, trialVencido: false };
  const ahora = Date.now();
  const fin = billing.trialHasta ? new Date(billing.trialHasta).getTime() : 0;
  const diasRestantes = Math.max(0, Math.ceil((fin - ahora) / (1000 * 60 * 60 * 24)));
  const enTrial = billing.status === 'trial' && diasRestantes > 0;
  const trialVencido = billing.status === 'trial' && diasRestantes === 0;
  return { enTrial, diasRestantes, trialVencido };
}

function AvisoCongelada({ paraDueno, yaTuvoPlan, esTrialVencido }) {
  const titulo = esTrialVencido
    ? 'Tu prueba gratuita de 7 días ha finalizado'
    : 'El plan de esta agencia no está activo';

  return (
    <Aviso tipo="alerta" titulo={titulo}>
      {paraDueno ? (
        <>
          {esTrialVencido ? (
            <>
              Tus viajes y propuestas siguen a salvo en tu cuenta. Para continuar creando y editando
              itinerarios oficiales con tu logo y margen, activa tu suscripción.{' '}
              <a href="#plan-agencia" style={{ fontWeight: 600 }}>
                Elegir y activar plan →
              </a>
            </>
          ) : (
            <>
              Tus viajes y los de tus agentes siguen ahí, pero nadie puede crear ni editar nada hasta
              que {yaTuvoPlan ? 'reactives' : 'actives'} el plan.{' '}
              <a href="#plan-agencia" style={{ fontWeight: 600 }}>
                Ir a {yaTuvoPlan ? 'reactivarlo' : 'activarlo'} →
              </a>
            </>
          )}
        </>
      ) : (
        `Tus viajes siguen ahí, pero no puedes crear ni editar nada hasta que el dueño de la agencia active o reactive el plan.`
      )}
    </Aviso>
  );
}

function VistaMiembro({ agencia, actualizarUsuario }) {
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState(null);

  const trial = calcularTrial(agencia.billing);
  const congelada = !trial.enTrial && agencia.billing?.status && agencia.billing.status !== 'activa';

  const salir = async () => {
    setError(null);
    setSaliendo(true);
    try {
      const data = await agencyApi.salir();
      actualizarUsuario(data.user);
    } catch (err) {
      setError(err.message);
      setSaliendo(false);
    }
  };

  return (
    <Tarjeta titulo="Marca en el PDF">
      <p className="suave" style={{ marginTop: 0 }}>
        Perteneces a una agencia: tus PDF salen con su marca, no con la tuya. Solo quien la creó
        puede editarla.
      </p>

      {trial.enTrial && (
        <Aviso tipo="info" titulo={`Prueba gratuita activa (${trial.diasRestantes} ${trial.diasRestantes === 1 ? 'día restante' : 'días restantes'})`}>
          Tu agencia está disfrutando del periodo de prueba gratuita de 7 días con acceso completo.
        </Aviso>
      )}

      {congelada && (
        <AvisoCongelada
          paraDueno={false}
          yaTuvoPlan={agencia.billing.status === 'congelada'}
          esTrialVencido={trial.trialVencido}
        />
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="fila" style={{ gap: 14, alignItems: 'center' }}>
        {agencia.logoUrl && (
          <img
            src={agencia.logoUrl}
            alt=""
            style={{
              height: 44,
              maxWidth: 130,
              objectFit: 'contain',
              borderRadius: 'var(--radio-xs)',
              border: '1px solid var(--border)',
            }}
          />
        )}
        <div>
          <strong>{agencia.agencyName}</strong>
          {agencia.contact && <div className="tenue">{agencia.contact}</div>}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Boton variante="peligro-texto" chico cargando={saliendo} onClick={salir}>
          Salir de la agencia
        </Boton>
      </div>
    </Tarjeta>
  );
}

/**
 * Plan de la agencia: solo lo ve y lo maneja el dueño, es su tarjeta la que
 * se cobra. Si ya hay un plan (activo o vencido) manda al portal de Stripe
 * para cambiarlo o cancelarlo; si nunca hubo uno, arma una sesión de
 * Checkout nueva con el plan y los agentes extra que elija.
 */
/**
 * Solo aparece con una suscripción activa (mensual/anual): sube o baja los
 * agentes extra sin cancelar el plan. "vitalicio" es pago único y no tiene
 * suscripción que ajustar, así que PanelBilling ni la monta para ese caso.
 */
function AjusteAgentesExtra({ agencia, recargar }) {
  const billing = agencia.billing || {};
  const [valor, setValor] = useState(billing.extraAgentes ?? 0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);

  const cambiado = Number(valor) !== (billing.extraAgentes ?? 0);

  const guardar = async (e) => {
    e.preventDefault();
    setError(null);
    setExito(false);
    setGuardando(true);
    try {
      await billingApi.cambiarAgentes({ extraAgentes: Number(valor) || 0 });
      setExito(true);
      recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (billing.plan && !PLANES[billing.plan]?.permiteExtra) {
    return (
      <p className="tenue" style={{ marginTop: 8, fontSize: '0.85rem' }}>
        ℹ️ {PLANES[billing.plan]?.ayuda}. Para ampliar agentes o cambiar de plan, usa &quot;Administrar plan&quot;.
      </p>
    );
  }

  return (
    <form onSubmit={guardar} className="pila-sm" style={{ marginTop: 12 }}>
      <div className="fila" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Campo
          label="Agentes extra"
          type="number"
          min="0"
          step="1"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          ayuda={PLANES[billing.plan]?.agente}
        />
        <Boton type="submit" variante="secundario" chico cargando={guardando} disabled={!cambiado}>
          Guardar cambio
        </Boton>
      </div>
      {error && (
        <span className="campo-error" role="alert">
          {error}
        </span>
      )}
      {exito && (
        <span className="tenue" style={{ fontSize: '0.85rem' }}>
          Actualizado. El ajuste se prorratea en tu próxima factura.
        </span>
      )}
    </form>
  );
}

function PanelBilling({ agencia, totalAgentes, recargar }) {
  const billing = agencia.billing || {};
  const yaTuvoPlan = Boolean(billing.stripeCustomerId);

  // Frecuencia: 'mensual' | 'anual'
  const [frecuencia, setFrecuencia] = useState(
    billing.plan?.endsWith('anual') ? 'anual' : 'mensual'
  );
  // Tier seleccionado: 'inicio' | 'agencia' | 'pro'
  const [tier, setTier] = useState(() => {
    if (billing.plan?.startsWith('inicio')) return 'inicio';
    if (billing.plan?.startsWith('pro')) return 'pro';
    return 'agencia';
  });

  const planClave = `${tier}_${frecuencia}`;
  const tierSeleccionado = TIERS_SELECCION.find((t) => t.id === tier) || TIERS_SELECCION[1];
  const precioActual = frecuencia === 'mensual' ? tierSeleccionado.precioMensual : tierSeleccionado.precioAnual;
  const periodoTexto = frecuencia === 'mensual' ? 'al mes' : 'al año (10.5 meses)';

  const [extraAgentes, setExtraAgentes] = useState(Math.max(0, totalAgentes - 15));
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const irACheckout = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const data = await billingApi.checkout({
        plan: planClave,
        extraAgentes: tier === 'pro' ? Number(extraAgentes) || 0 : 0,
      });
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  };

  const irAlPortal = async () => {
    setError(null);
    setCargando(true);
    try {
      const data = await billingApi.portal();
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  };

  const trial = calcularTrial(billing);

  return (
    <Tarjeta
      id="plan-agencia"
      titulo="Plan de la agencia"
      accion={
        billing.status && (
          <Insignia color={billing.status === 'activa' || trial.enTrial ? 'verde' : 'ambar'}>
            {billing.status === 'activa'
              ? 'Activo'
              : trial.enTrial
              ? `Prueba (${trial.diasRestantes}d)`
              : trial.trialVencido
              ? 'Prueba vencida'
              : billing.status === 'congelada'
              ? 'Vencido'
              : 'Sin activar'}
          </Insignia>
        )
      }
    >
      {error && <Aviso tipo="error">{error}</Aviso>}

      {trial.enTrial && (
        <Aviso tipo="info" titulo={`Prueba gratuita activa · ${trial.diasRestantes} ${trial.diasRestantes === 1 ? 'día restante' : 'días restantes'}`}>
          Tu agencia tiene acceso libre a todas las funciones profesionales
          {billing.trialHasta ? ` hasta el ${new Date(billing.trialHasta).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}` : ''}.
          Puedes activar tu plan en cualquier momento para asegurar el servicio continuo.
        </Aviso>
      )}

      {billing.status === 'activa' && (
        <>
          <p className="suave" style={{ marginTop: 0 }}>
            Plan {PLANES[billing.plan]?.etiqueta || billing.plan}, {agencia.capacidadAgentes} agente(s)
            de cupo ({totalAgentes} en uso)
            {billing.periodoHasta && ` · se renueva el ${new Date(billing.periodoHasta).toLocaleDateString('es-MX')}`}.
          </p>
          {billing.plan === 'vitalicio' ? (
            <p className="tenue" style={{ marginTop: 0, fontSize: '0.85rem' }}>
              El plan De por vida es un pago único: para sumar más agentes, contáctanos.
            </p>
          ) : (
            <AjusteAgentesExtra agencia={agencia} recargar={recargar} />
          )}
        </>
      )}

      {yaTuvoPlan ? (
        <Boton variante="secundario" chico cargando={cargando} onClick={irAlPortal}>
          {billing.status === 'activa' ? 'Administrar plan' : 'Reactivar plan'}
        </Boton>
      ) : (
        <>
          <p className="suave" style={{ marginTop: 0, marginBottom: 16 }}>
            Elige el plan que mejor se adapte al tamaño de tu equipo para activar tus propuestas,
            itinerarios inteligentes y cotizaciones oficiales:
          </p>

          <form onSubmit={irACheckout} className="pila" style={{ gap: 16 }}>
            {/* Selector de frecuencia */}
            <div
              className="fila"
              style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)',
                padding: '4px',
                borderRadius: 'var(--radio)',
                display: 'inline-flex',
                alignSelf: 'flex-start',
                gap: 4,
              }}
            >
              <button
                type="button"
                className={`boton chico ${frecuencia === 'mensual' ? '' : 'secundario'}`}
                onClick={() => setFrecuencia('mensual')}
              >
                Pago Mensual
              </button>
              <button
                type="button"
                className={`boton chico ${frecuencia === 'anual' ? '' : 'secundario'}`}
                onClick={() => setFrecuencia('anual')}
              >
                Pago Anual <Insignia color="verde" style={{ marginLeft: 6 }}>Ahorra 1.5 meses</Insignia>
              </button>
            </div>

            {/* 3 Tarjetas visuales de selección de plan */}
            <div className="rejilla rejilla-3" style={{ gap: 14 }}>
              {TIERS_SELECCION.map((t) => {
                const activo = tier === t.id;
                const monto = frecuencia === 'mensual' ? t.montoMensual : t.montoAnual;
                const periodo = frecuencia === 'mensual' ? '/mes' : '/año';

                return (
                  <div
                    key={t.id}
                    onClick={() => setTier(t.id)}
                    style={{
                      border: activo ? '2px solid var(--verde)' : '1px solid var(--border)',
                      borderRadius: 'var(--radio)',
                      padding: '18px 16px',
                      cursor: 'pointer',
                      background: activo ? 'var(--surface-alt)' : 'var(--surface)',
                      boxShadow: activo ? '0 0 0 1px var(--verde), 0 4px 14px rgba(0,0,0,0.12)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                  >
                    <div>
                      <div className="fila-entre" style={{ alignItems: 'center', marginBottom: 8 }}>
                        <div className="fila" style={{ gap: 8, alignItems: 'center' }}>
                          <input
                            type="radio"
                            name="tier_agencia"
                            checked={activo}
                            onChange={() => setTier(t.id)}
                            style={{ margin: 0, cursor: 'pointer', accentColor: 'var(--verde)' }}
                          />
                          <strong style={{ fontSize: '1.02rem', color: 'var(--texto)' }}>{t.nombre}</strong>
                        </div>
                        {t.destacado && <Insignia color="verde" style={{ fontSize: '0.72rem', fontWeight: 700 }}>Popular</Insignia>}
                      </div>

                      <div style={{ margin: '8px 0 10px', display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span className="numero" style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--marca)' }}>
                          {monto}
                        </span>
                        <span className="suave" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          MXN {periodo}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: 'var(--texto)',
                          marginBottom: 12,
                          padding: '4px 8px',
                          borderRadius: 'var(--radio-xs)',
                          background: 'var(--surface-alt)',
                          border: '1px solid var(--border)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          width: 'fit-content',
                        }}
                      >
                        👥 {t.capacidad}
                      </div>

                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: 'var(--texto-suave)', lineHeight: 1.45 }}>
                        {t.puntos.map((pt, idx) => (
                          <li key={idx} style={{ marginBottom: 4 }}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Agentes extra solo para Pro si tiene más de 15 */}
            {tier === 'pro' && (
              <div style={{ maxWidth: 420, marginTop: 2 }}>
                <Campo
                  label="¿Tienes más de 15 agentes? Agentes adicionales (16+)"
                  type="number"
                  min="0"
                  step="1"
                  value={extraAgentes}
                  onChange={(e) => setExtraAgentes(e.target.value)}
                  ayuda={frecuencia === 'mensual' ? '+$75 MXN/mes por cada agente extra' : '+$780 MXN/año por cada agente extra'}
                />
              </div>
            )}

            {/* Resumen de compra y botón de acción */}
            <div
              className="fila-entre"
              style={{
                marginTop: 6,
                padding: '14px 18px',
                background: 'var(--surface-alt)',
                borderRadius: 'var(--radio)',
                border: '1px solid var(--border)',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--texto)' }}>
                  Plan {tierSeleccionado.nombre} ({frecuencia === 'mensual' ? 'Mensual' : 'Anual'})
                </strong>
                <span className="tenue" style={{ fontSize: '0.82rem' }}>
                  Total a pagar: <strong style={{ color: 'var(--marca)' }}>{precioActual} {periodoTexto}</strong> · {tierSeleccionado.capacidad}
                </span>
              </div>
              <Boton type="submit" cargando={cargando}>
                Continuar al pago seguro con Stripe →
              </Boton>
            </div>
          </form>
        </>
      )}
    </Tarjeta>
  );
}

/**
 * Cuantos viajes armo cada agente este mes (dueno incluido). Se carga aparte
 * del resto de la pantalla: es lo menos urgente de ver y no tiene por que
 * bloquear ni volver a pedir todo lo demas si falla.
 */
function ReporteAgencia() {
  const { data, cargando, error, recargar } = useFetch(({ signal }) => agencyApi.reporte({ signal }), []);

  return (
    <Tarjeta titulo="Reporte del mes">
      {cargando && <Cargando texto="Cargando reporte..." />}
      {error && <ErrorCarga error={error} onReintentar={recargar} />}
      {data && (
        <>
          <p className="suave" style={{ marginTop: 0 }}>
            {data.totalMes === 0
              ? 'Nadie ha armado un viaje todavía este mes.'
              : `${data.totalMes} viaje(s) armado(s) este mes en total.`}
          </p>
          <div className="pila-sm">
            {data.porAgente.map((a) => (
              <div key={a.userId} className="fila-entre">
                <span>{a.name}</span>
                <Insignia color={a.cantidad > 0 ? 'marca' : ''}>{a.cantidad}</Insignia>
              </div>
            ))}
          </div>
        </>
      )}
    </Tarjeta>
  );
}

// Verde de marca de Rumbia (--verde en global.css): punto de partida del
// selector de color cuando la agencia todavia no eligio uno propio. input
// type="color" no acepta un valor vacio, necesita un hex de 7 caracteres si o si.
const COLOR_RUMBIA = '#1F6F5C';

function VistaDueno({ agencia, miembros, actualizarUsuario, recargar }) {
  const [form, setForm] = useState({
    agencyName: agencia.agencyName,
    contact: agencia.contact || '',
    colorAcento: agencia.colorAcento || '',
    fuentePdf: agencia.fuentePdf || '',
    densidadPdf: agencia.densidadPdf || 'normal',
  });
  const [logoUrl, setLogoUrl] = useState(agencia.logoUrl || '');
  const [estado, setEstado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [porEliminar, setPorEliminar] = useState(null);
  const [saliendo, setSaliendo] = useState(false);
  const inputLogoRef = useRef(null);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    setEstado(null);
    setGuardando(true);
    try {
      await agencyApi.actualizar(form);
      setEstado({ tipo: 'exito', mensaje: 'Agencia actualizada.' });
    } catch (err) {
      setEstado({ tipo: 'error', mensaje: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const subirLogo = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setEstado(null);
    setSubiendoLogo(true);
    try {
      const data = await agencyApi.subirLogo(archivo);
      setLogoUrl(data.agency.logoUrl);
    } catch (err) {
      setEstado({ tipo: 'error', mensaje: err.message });
    } finally {
      setSubiendoLogo(false);
    }
  };

  const quitarLogo = async () => {
    setEstado(null);
    setSubiendoLogo(true);
    try {
      await agencyApi.actualizar({ logoUrl: '' });
      setLogoUrl('');
    } catch (err) {
      setEstado({ tipo: 'error', mensaje: err.message });
    } finally {
      setSubiendoLogo(false);
    }
  };

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(agencia.inviteCode);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* si el navegador no da permiso de portapapeles, no pasa nada grave */
    }
  };

  const regenerarCodigo = async () => {
    setRegenerando(true);
    try {
      await agencyApi.regenerarCodigo();
      recargar();
    } catch (err) {
      setEstado({ tipo: 'error', mensaje: err.message });
    } finally {
      setRegenerando(false);
    }
  };

  const eliminarMiembro = async () => {
    await agencyApi.eliminarMiembro(porEliminar._id);
    recargar();
  };

  const salir = async () => {
    setEstado(null);
    setSaliendo(true);
    try {
      const data = await agencyApi.salir();
      actualizarUsuario(data.user);
    } catch (err) {
      setEstado({ tipo: 'error', mensaje: err.message });
      setSaliendo(false);
    }
  };

  const trial = calcularTrial(agencia.billing);
  const congelada = !trial.enTrial && agencia.billing?.status !== 'activa';

  return (
    <>
      {trial.enTrial && (
        <Aviso
          tipo="info"
          titulo={`Prueba gratuita de 7 días activa (${trial.diasRestantes} ${trial.diasRestantes === 1 ? 'día restante' : 'días restantes'})`}
        >
          Tienes acceso completo a todas las funciones profesionales: crea itinerarios ilimitados, genera cotizaciones en PDF con tu logo y añade márgenes comerciales a tus propuestas.
        </Aviso>
      )}

      {congelada && (
        <AvisoCongelada
          paraDueno
          yaTuvoPlan={agencia.billing?.status === 'congelada'}
          esTrialVencido={trial.trialVencido}
        />
      )}

      <Tarjeta titulo="Marca en el PDF" accion={<Insignia color="verde">Dueño de la agencia</Insignia>}>
        <p className="suave" style={{ marginTop: 0 }}>
          Esta marca la ven todos los agentes de tu agencia en sus PDF. Solo tú puedes editarla.
        </p>

        {estado && <Aviso tipo={estado.tipo}>{estado.mensaje}</Aviso>}

        <form onSubmit={guardar} className="pila" noValidate>
          <Campo label="Nombre de la agencia" name="agencyName" value={form.agencyName} onChange={cambiar} />

          <div className="campo">
            <label>Logo</label>
            <div className="fila" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt=""
                  style={{
                    height: 40,
                    maxWidth: 120,
                    objectFit: 'contain',
                    borderRadius: 'var(--radio-xs)',
                    border: '1px solid var(--border)',
                  }}
                />
              )}
              <input
                ref={inputLogoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={subirLogo}
                style={{ display: 'none' }}
                tabIndex={-1}
                aria-hidden="true"
              />
              <Boton
                type="button"
                variante="secundario"
                chico
                cargando={subiendoLogo}
                onClick={() => inputLogoRef.current?.click()}
              >
                <Icono nombre="mas" tamano={14} /> {logoUrl ? 'Cambiar logo' : 'Subir logo'}
              </Boton>
              {logoUrl && (
                <Boton type="button" variante="peligro-texto" chico onClick={quitarLogo} cargando={subiendoLogo}>
                  Quitar
                </Boton>
              )}
            </div>
            <span className="campo-ayuda">PNG, JPEG o WebP, hasta 2 MB.</span>
          </div>

          <Campo label="Contacto que aparece bajo el logo" name="contact" value={form.contact} onChange={cambiar} />

          {agencia.marcaBlanca ? (
            <div className="campo">
              <label htmlFor="colorAcento">Color de acento del PDF</label>
              <div className="fila" style={{ gap: 10, alignItems: 'center' }}>
                <input
                  id="colorAcento"
                  type="color"
                  name="colorAcento"
                  value={form.colorAcento || COLOR_RUMBIA}
                  onChange={cambiar}
                  style={{ width: 44, height: 36, padding: 2, cursor: 'pointer' }}
                />
                <span className="tenue">{form.colorAcento || 'Verde de Rumbia (predeterminado)'}</span>
                {form.colorAcento && (
                  <Boton
                    type="button"
                    variante="fantasma"
                    chico
                    onClick={() => setForm((f) => ({ ...f, colorAcento: '' }))}
                  >
                    Restablecer
                  </Boton>
                )}
              </div>
              <span className="campo-ayuda">
                Se usa en la insignia, los marcadores de día y las actividades del PDF. Con tu plan,
                además, el pie ya no menciona a Rumbia — el documento sale con tu marca, punto.
              </span>
            </div>
          ) : null}

          {agencia.marcaBlanca ? (
            <Campo label="Tipografía del PDF" name="fuentePdf">
              <select name="fuentePdf" value={form.fuentePdf} onChange={cambiar}>
                {FUENTES_PDF.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
          ) : null}

          {agencia.marcaBlanca ? (
            <Campo label="Tamaño de texto del PDF" name="densidadPdf">
              <select name="densidadPdf" value={form.densidadPdf} onChange={cambiar}>
                {DENSIDADES_PDF.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
          ) : (
            <Aviso tipo="info" titulo="Personalización completa disponible en Agencia y Agencia Pro">
              Elige tu propio color de acento para el PDF y quita la mención a Rumbia del pie —{' '}
              <Link to="/acerca">compara los planes</Link>.
            </Aviso>
          )}

          <div>
            <Boton type="submit" cargando={guardando}>
              Guardar cambios
            </Boton>
          </div>
        </form>
      </Tarjeta>

      <PanelBilling agencia={agencia} totalAgentes={miembros.length + 1} recargar={recargar} />

      <Tarjeta titulo="Código de invitación">
        <p className="suave" style={{ marginTop: 0 }}>
          Compártelo con tus agentes; lo escriben en su perfil para unirse a esta agencia.
        </p>
        <div className="fila" style={{ gap: 8, alignItems: 'center' }}>
          <code className="enlace-compartir" style={{ flex: 'unset', fontWeight: 700, letterSpacing: '0.04em' }}>
            {agencia.inviteCode}
          </code>
          <Boton chico onClick={copiarCodigo}>
            {copiado ? 'Copiado' : 'Copiar'}
          </Boton>
          <Boton variante="secundario" chico onClick={regenerarCodigo} cargando={regenerando}>
            Regenerar
          </Boton>
        </div>
      </Tarjeta>

      <Tarjeta titulo={`Agentes (${miembros.length})`}>
        {miembros.length === 0 ? (
          <p className="suave" style={{ margin: 0 }}>
            Todavía nadie se ha unido con el código.
          </p>
        ) : (
          <div className="pila-sm">
            {miembros.map((m) => (
              <div key={m._id} className="fila-entre">
                <div>
                  <strong>{m.name}</strong>
                  <span className="tenue" style={{ display: 'block', fontSize: '0.85rem' }}>
                    {m.email}
                  </span>
                </div>
                <Boton variante="peligro-texto" chico onClick={() => setPorEliminar(m)}>
                  Quitar
                </Boton>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>

      <ReporteAgencia />

      <Tarjeta className="zona-peligro">
        <p className="suave" style={{ marginTop: 0 }}>
          {miembros.length > 0
            ? 'Mientras haya otros agentes en tu agencia no puedes salir: primero tienen que salir ellos, o los quitas tú desde la lista de arriba.'
            : 'Al salir, la agencia se elimina porque ya no tendría dueño.'}
        </p>
        <Boton variante="peligro-texto" chico onClick={salir} cargando={saliendo} disabled={miembros.length > 0}>
          Salir de la agencia
        </Boton>
      </Tarjeta>

      <ModalConfirmar
        abierto={Boolean(porEliminar)}
        onCerrar={() => setPorEliminar(null)}
        onConfirmar={eliminarMiembro}
        titulo="Quitar agente"
        mensaje={`${porEliminar?.name} deja de ver la marca de la agencia. Su cuenta y sus viajes no se tocan.`}
        textoConfirmar="Quitar"
      />
    </>
  );
}
