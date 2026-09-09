import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { agencyApi, authApi, billingApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import Icono from './Icono.jsx';
import { FUENTES_PDF, DENSIDADES_PDF } from '../utils/fuentesPdf.js';
import { FONDOS_PDF } from '../utils/fondosPdf.js';
import { localeDeFecha } from '../utils/format.js';
import { Boton, Campo, Tarjeta, Aviso, Insignia, ModalConfirmar, Cargando, ErrorCarga } from './ui.jsx';

/**
 * Precios de referencia, solo para mostrar en pantalla: lo que de verdad se
 * cobra lo decide Stripe con los Price que arma "npm run stripe:setup". Si
 * cambian ahi, hay que actualizar esto a mano para que no digan cosas
 * distintas.
 *
 * Inicio/Agencia/Pro tienen precio en las dos divisas que Rumbia cobra hoy
 * (mxn/usd, ver moneda en Agency.js). Los planes legado (mensual/anual/
 * vitalicio) solo existen para clientes que ya los tenian antes de este
 * cambio -- se muestran igual sin importar `moneda` porque nunca tuvieron
 * mas que una tarifa.
 */
const PLANES = {
  inicio_mensual: { agentesBase: 3, base: { mxn: '$190 MXN/mes', usd: '$10 USD/mes' } },
  inicio_anual: { agentesBase: 3, base: { mxn: '$1,950 MXN/año', usd: '$104 USD/año' } },
  agencia_mensual: { agentesBase: 8, base: { mxn: '$450 MXN/mes', usd: '$25 USD/mes' } },
  agencia_anual: { agentesBase: 8, base: { mxn: '$4,650 MXN/año', usd: '$260 USD/año' } },
  pro_mensual: { agentesBase: 15, permiteExtra: true, base: { mxn: '$750 MXN/mes', usd: '$40 USD/mes' }, agente: { mxn: '+$75 MXN/mes', usd: '+$4 USD/mes' }, agenteTipo: 'limite' },
  pro_anual: { agentesBase: 15, permiteExtra: true, base: { mxn: '$7,800 MXN/año', usd: '$416 USD/año' }, agente: { mxn: '+$780 MXN/año', usd: '+$42 USD/año' }, agenteTipo: 'limite' },
  mensual: { permiteExtra: true, base: { mxn: '$20 USD/mes', usd: '$20 USD/mes' }, agente: { mxn: '+$10 USD/mes', usd: '+$10 USD/mes' }, agenteTipo: 'simple' },
  anual: { permiteExtra: true, base: { mxn: '$200 USD/año', usd: '$200 USD/año' }, agente: { mxn: '+$100 USD/año', usd: '+$100 USD/año' }, agenteTipo: 'simple' },
  vitalicio: { base: { mxn: '$500 USD pago único', usd: '$500 USD pago único' }, agente: { mxn: '+$250 USD', usd: '+$250 USD' }, agenteTipo: 'unico' },
};

// Mismos montos que pro_mensual.agente/pro_anual.agente en PLANES de arriba
// (y que los STRIPE_PRICE_PRO_*_AGENTE_USD reales del servidor): duplicado a
// proposito en vez de parsear el texto de PLANES, para no depender de que su
// redaccion no cambie nunca.
const PRECIO_AGENTE_EXTRA_PRO = {
  mxn: { mensual: 75, anual: 780 },
  usd: { mensual: 4, anual: 42 },
};

function etiquetaPlan(t, planId) {
  return t(`planes.${planId}.etiqueta`, { defaultValue: planId });
}

function ayudaPlan(t, planId) {
  return t(`planes.${planId}.ayuda`, { defaultValue: '' });
}

function textoAgenteExtra(t, planId, moneda) {
  const plan = PLANES[planId];
  if (!plan?.agente) return undefined;
  const sufijo = t(`agenteExtraSufijo.${plan.agenteTipo}`);
  return `${plan.agente[moneda]} ${sufijo}`;
}

export const TIERS_SELECCION = [
  {
    id: 'inicio',
    monto: { mxn: { mensual: '$190', anual: '$1,950' }, usd: { mensual: '$10', anual: '$104' } },
  },
  {
    id: 'agencia',
    destacado: true,
    monto: { mxn: { mensual: '$450', anual: '$4,650' }, usd: { mensual: '$25', anual: '$260' } },
  },
  {
    id: 'pro',
    monto: { mxn: { mensual: '$750', anual: '$7,800' }, usd: { mensual: '$40', anual: '$416' } },
    permiteExtra: true,
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
export default function TarjetaAgencia({ user, actualizarUsuario, seccion = 'marca' }) {
  if (user?.agency) {
    return <VistaConAgencia seccion={seccion} actualizarUsuario={actualizarUsuario} />;
  }
  return <VistaSinAgencia seccion={seccion} user={user} actualizarUsuario={actualizarUsuario} />;
}

/* ------------------------------------------------------------------ */
/* Sin agencia: marca propia + opcion de crear o unirse                */
/* ------------------------------------------------------------------ */

function VistaSinAgencia({ user, actualizarUsuario, seccion }) {
  const { t } = useTranslation('agencia');
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
      setEstado({ tipo: 'exito', mensaje: t('marcaPdf.guardado') });
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
      {seccion === 'marca' && <Tarjeta titulo={t('marcaPdf.titulo')}>
        <p className="suave" style={{ marginTop: 0 }}>
          {t('marcaPdf.texto')}
        </p>

        {estado && (
          <Aviso tipo={estado.tipo} titulo={estado.tipo === 'exito' ? undefined : t('marcaPdf.noSeGuardo')}>
            {estado.mensaje}
          </Aviso>
        )}

        <form onSubmit={guardar} className="pila" noValidate>
          <Campo
            label={t('marcaPdf.nombreLabel')}
            name="agencyName"
            value={form.agencyName}
            onChange={cambiar}
            placeholder={t('marcaPdf.nombrePlaceholder')}
          />

          <div className="campo">
            <label>{t('marcaPdf.logoLabel')}</label>
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
                <Icono nombre="mas" tamano={14} /> {form.logoUrl ? t('marcaPdf.cambiarLogo') : t('marcaPdf.subirLogo')}
              </Boton>
              {form.logoUrl && (
                <Boton type="button" variante="peligro-texto" chico onClick={quitarLogo} cargando={subiendoLogo}>
                  {t('marcaPdf.quitar')}
                </Boton>
              )}
            </div>
            {errorLogo && (
              <span className="campo-error" role="alert">
                {errorLogo}
              </span>
            )}
            <span className="campo-ayuda">{t('marcaPdf.logoAyuda')}</span>
          </div>

          <Campo
            label={t('marcaPdf.logoUrlLabel')}
            name="logoUrl"
            type="url"
            value={form.logoUrl}
            onChange={cambiar}
            placeholder={t('marcaPdf.logoUrlPlaceholder')}
          />

          <Campo
            label={t('marcaPdf.contactoLabel')}
            name="contact"
            value={form.contact}
            onChange={cambiar}
            placeholder={t('marcaPdf.contactoPlaceholder')}
          />

          <div>
            <Boton type="submit" cargando={guardando}>
              {t('marcaPdf.guardar')}
            </Boton>
          </div>
        </form>
      </Tarjeta>}

      {seccion === 'equipo' && <UnirseOCrear actualizarUsuario={actualizarUsuario} />}
    </>
  );
}

/** Crear una agencia o unirse a una con un codigo. Solo aplica sin agencia. */
function UnirseOCrear({ actualizarUsuario }) {
  const { t } = useTranslation('agencia');
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
    <Tarjeta titulo={t('unirseOCrear.titulo')}>
      <p className="suave" style={{ marginTop: 0 }}>
        {t('unirseOCrear.texto')}
      </p>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="rejilla-detalle" style={{ gap: 20 }}>
        <form onSubmit={crear} className="pila-sm">
          <Campo
            label={t('unirseOCrear.crearLabel')}
            name="nombreAgencia"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={t('unirseOCrear.crearPlaceholder')}
          />
          <Boton type="submit" variante="secundario" chico cargando={creando} disabled={!nombre.trim()}>
            {t('unirseOCrear.crearBoton')}
          </Boton>
        </form>

        <form onSubmit={unirse} className="pila-sm">
          <Campo
            label={t('unirseOCrear.unirseLabel')}
            name="codigoAgencia"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder={t('unirseOCrear.unirsePlaceholder')}
          />
          <Boton type="submit" variante="secundario" chico cargando={uniendo} disabled={!codigo.trim()}>
            {t('unirseOCrear.unirseBoton')}
          </Boton>
        </form>
      </div>
    </Tarjeta>
  );
}

/* ------------------------------------------------------------------ */
/* Con agencia: marca de la agencia, editable solo si eres el dueño    */
/* ------------------------------------------------------------------ */

function VistaConAgencia({ actualizarUsuario, seccion }) {
  const { t } = useTranslation('agencia');
  const { data, cargando, error, recargar, setData } = useFetch(
    ({ signal }) => agencyApi.obtener({ signal }),
    []
  );
  const [avisoStripe, setAvisoStripe] = useState(null);

  // Vuelta de Stripe Checkout: se limpia el query param de la URL. El
  // webhook que activa el plan puede tardar unos segundos mas que la
  // redireccion del navegador, asi que NO se afirma "pago recibido" de
  // entrada -- se reintenta la carga de la agencia hasta confirmar
  // billing.status==='activa' antes de decir que ya se proceso.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get('billing');
    if (!resultado) return;

    window.history.replaceState({}, '', window.location.pathname);

    if (resultado === 'cancelado') {
      setAvisoStripe(t('stripe.cancelado'));
      return;
    }
    if (resultado !== 'exito') return;

    let cancelado = false;
    setAvisoStripe(t('stripe.verificando'));

    (async () => {
      for (const espera of [0, 2000, 4000]) {
        if (espera) await new Promise((r) => setTimeout(r, espera));
        if (cancelado) return;
        try {
          const fresca = await agencyApi.obtener();
          if (cancelado) return;
          setData(fresca);
          if (fresca?.agency?.billing?.status === 'activa') {
            setAvisoStripe(t('stripe.recibido'));
            setTimeout(() => !cancelado && setAvisoStripe(null), 3000);
            return;
          }
        } catch {
          // Se ignora: se reintenta en la siguiente vuelta.
        }
      }
      // Se agoto el reintento sin ver el plan activo todavia: se pide
      // paciencia en vez de afirmar algo que no se pudo confirmar.
      if (!cancelado) {
        setAvisoStripe(t('stripe.enProceso'));
      }
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cargando) {
    return (
      <Tarjeta titulo={t('marcaPdf.titulo')}>
        <Cargando texto={t('stripe.cargandoAgencia')} />
      </Tarjeta>
    );
  }
  if (error) {
    return (
      <Tarjeta titulo={t('marcaPdf.titulo')}>
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
          seccion={seccion}
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
  const { t } = useTranslation('agencia');
  const titulo = esTrialVencido
    ? t('avisoCongelada.tituloTrialVencido')
    : t('avisoCongelada.tituloInactivo');

  return (
    <Aviso tipo="alerta" titulo={titulo}>
      {paraDueno ? (
        <>
          {esTrialVencido ? (
            <>
              {t('avisoCongelada.duenoTrialVencidoTexto')}{' '}
              <a href="/perfil?seccion=facturacion#plan-agencia" style={{ fontWeight: 600 }}>
                {t('avisoCongelada.duenoTrialVencidoEnlace')}
              </a>
            </>
          ) : (
            <>
              {t('avisoCongelada.duenoInactivoTexto', {
                accion: t(yaTuvoPlan ? 'avisoCongelada.reactives' : 'avisoCongelada.actives'),
              })}{' '}
              <a href="/perfil?seccion=facturacion#plan-agencia" style={{ fontWeight: 600 }}>
                {t('avisoCongelada.duenoInactivoEnlace', {
                  accion: t(yaTuvoPlan ? 'avisoCongelada.reactivarlo' : 'avisoCongelada.activarlo'),
                })}
              </a>
            </>
          )}
        </>
      ) : (
        t('avisoCongelada.miembroTexto')
      )}
    </Aviso>
  );
}

function VistaMiembro({ agencia, actualizarUsuario }) {
  const { t } = useTranslation('agencia');
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
    <Tarjeta titulo={t('marcaPdf.titulo')}>
      <p className="suave" style={{ marginTop: 0 }}>
        {t('vistaMiembro.texto')}
      </p>

      {trial.enTrial && (
        <Aviso tipo="info" titulo={t('vistaMiembro.pruebaTitulo', { dias: trial.diasRestantes, diaLabel: t(trial.diasRestantes === 1 ? 'vistaMiembro.diaRestante' : 'vistaMiembro.diasRestantes') })}>
          {t('vistaMiembro.pruebaTexto')}
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
          {t('vistaMiembro.salir')}
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
  const { t } = useTranslation('agencia');
  const billing = agencia.billing || {};
  const moneda = billing.moneda || 'mxn';
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
        {t('ajusteAgentesExtra.ayudaPlan', { ayuda: ayudaPlan(t, billing.plan) })}
      </p>
    );
  }

  return (
    <form onSubmit={guardar} className="pila-sm" style={{ marginTop: 12 }}>
      <div className="fila" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Campo
          label={t('ajusteAgentesExtra.label')}
          type="number"
          min="0"
          step="1"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          ayuda={textoAgenteExtra(t, billing.plan, moneda)}
        />
        <Boton type="submit" variante="secundario" chico cargando={guardando} disabled={!cambiado}>
          {t('ajusteAgentesExtra.guardar')}
        </Boton>
      </div>
      {error && (
        <span className="campo-error" role="alert">
          {error}
        </span>
      )}
      {exito && (
        <span className="tenue" style={{ fontSize: '0.85rem' }}>
          {t('ajusteAgentesExtra.actualizado')}
        </span>
      )}
    </form>
  );
}

function PanelBilling({ agencia, totalAgentes, recargar }) {
  const { t } = useTranslation('agencia');
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
  // Divisa: 'mxn' | 'usd'. MXN sigue siendo el default -- muchas tarjetas
  // mexicanas (BBVA incluida) rechazan cargos en dolares, asi que nadie
  // termina en USD sin elegirlo a proposito.
  const [moneda, setMoneda] = useState(billing.moneda || 'mxn');

  const planClave = `${tier}_${frecuencia}`;
  const tierSeleccionado = TIERS_SELECCION.find((tr) => tr.id === tier) || TIERS_SELECCION[1];
  const periodoTexto = frecuencia === 'mensual' ? t('panelBilling.alMes') : t('panelBilling.alAnio');

  const [extraAgentes, setExtraAgentes] = useState(Math.max(0, totalAgentes - 15));

  // "Total a pagar" tiene que incluir los agentes extra: el checkout real
  // (irACheckout de abajo, y stripe.service.js del lado del servidor) sí les
  // agrega su propio renglon de Stripe -- mostrar solo el precio base del
  // tier subestimaba el cargo real en Pro con agentes extra.
  const extraAgentesNum = tier === 'pro' ? Number(extraAgentes) || 0 : 0;
  const costoExtra = extraAgentesNum * PRECIO_AGENTE_EXTRA_PRO[moneda][frecuencia];
  const precioBaseTexto = `${tierSeleccionado.monto[moneda][frecuencia]} ${moneda.toUpperCase()}`;
  const precioBaseNum = Number(precioBaseTexto.replace(/[^0-9]/g, ''));
  const precioActual =
    costoExtra > 0
      ? `$${(precioBaseNum + costoExtra).toLocaleString(moneda === 'mxn' ? 'es-MX' : 'en-US')} ${moneda.toUpperCase()}`
      : precioBaseTexto;
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
        moneda,
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
      titulo={t('panelBilling.titulo')}
      accion={
        billing.status && (
          <Insignia color={billing.status === 'activa' || trial.enTrial ? 'verde' : 'ambar'}>
            {billing.status === 'activa'
              ? t('panelBilling.estadoActivo')
              : trial.enTrial
              ? t('panelBilling.estadoPrueba', { dias: trial.diasRestantes })
              : trial.trialVencido
              ? t('panelBilling.estadoPruebaVencida')
              : billing.status === 'congelada'
              ? t('panelBilling.estadoVencido')
              : t('panelBilling.estadoSinActivar')}
          </Insignia>
        )
      }
    >
      {error && <Aviso tipo="error">{error}</Aviso>}

      {trial.enTrial && (
        <Aviso tipo="info" titulo={t('panelBilling.pruebaTitulo', { dias: trial.diasRestantes, diaLabel: t(trial.diasRestantes === 1 ? 'vistaMiembro.diaRestante' : 'vistaMiembro.diasRestantes') })}>
          {t('panelBilling.pruebaTexto', {
            hasta: billing.trialHasta
              ? t('panelBilling.pruebaHasta', { fecha: new Date(billing.trialHasta).toLocaleDateString(localeDeFecha(), { day: 'numeric', month: 'long' }) })
              : '',
          })}
        </Aviso>
      )}

      {billing.status === 'activa' && (
        <>
          <p className="suave" style={{ marginTop: 0 }}>
            {t('panelBilling.planActivoTexto', {
              plan: etiquetaPlan(t, billing.plan) || billing.plan,
              capacidad: agencia.capacidadAgentes,
              enUso: totalAgentes,
              periodo: billing.periodoHasta
                ? t(billing.cancelaAlFinalizarPeriodo ? 'panelBilling.periodoSeCancela' : 'panelBilling.periodoSeRenueva', {
                    fecha: new Date(billing.periodoHasta).toLocaleDateString(localeDeFecha()),
                  })
                : '',
            })}
          </p>
          {billing.plan === 'vitalicio' ? (
            <p className="tenue" style={{ marginTop: 0, fontSize: '0.85rem' }}>
              {t('panelBilling.vitalicioTexto')}
            </p>
          ) : (
            <AjusteAgentesExtra agencia={agencia} recargar={recargar} />
          )}
        </>
      )}

      {yaTuvoPlan ? (
        <Boton variante="secundario" chico cargando={cargando} onClick={irAlPortal}>
          {billing.status === 'activa' ? t('panelBilling.administrarPlan') : t('panelBilling.reactivarPlan')}
        </Boton>
      ) : billing.status === 'activa' ? (
        <p className="suave">{t('panelBilling.activoSinContratar')}</p>
      ) : (
        <>
          <p className="suave" style={{ marginTop: 0, marginBottom: 16 }}>
            {t('panelBilling.elegirPlanTexto')}
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
                {t('panelBilling.pagoMensual')}
              </button>
              <button
                type="button"
                className={`boton chico ${frecuencia === 'anual' ? '' : 'secundario'}`}
                onClick={() => setFrecuencia('anual')}
              >
                {t('panelBilling.pagoAnual')} <Insignia color="verde" style={{ marginLeft: 6 }}>{t('panelBilling.ahorra')}</Insignia>
              </button>
            </div>

            {/* Selector de divisa */}
            <div>
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
                  className={`boton chico ${moneda === 'mxn' ? '' : 'secundario'}`}
                  onClick={() => setMoneda('mxn')}
                >
                  {t('panelBilling.pesos')}
                </button>
                <button
                  type="button"
                  className={`boton chico ${moneda === 'usd' ? '' : 'secundario'}`}
                  onClick={() => setMoneda('usd')}
                >
                  {t('panelBilling.dolares')}
                </button>
              </div>
              <p className="tenue" style={{ fontSize: '0.78rem', margin: '6px 0 0' }}>
                {t('panelBilling.divisaAyuda')}
              </p>
            </div>

            {/* 3 Tarjetas visuales de selección de plan */}
            <div className="rejilla rejilla-3" style={{ gap: 14 }}>
              {TIERS_SELECCION.map((tierItem) => {
                const activo = tier === tierItem.id;
                const monto = tierItem.monto[moneda][frecuencia];
                const periodo = frecuencia === 'mensual' ? t('panelBilling.sufijoMes') : t('panelBilling.sufijoAnio');

                return (
                  <div
                    key={tierItem.id}
                    onClick={() => setTier(tierItem.id)}
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
                            onChange={() => setTier(tierItem.id)}
                            style={{ margin: 0, cursor: 'pointer', accentColor: 'var(--verde)' }}
                          />
                          <strong style={{ fontSize: '1.02rem', color: 'var(--texto)' }}>{t(`tiers.${tierItem.id}.nombre`)}</strong>
                        </div>
                        {tierItem.destacado && <Insignia color="verde" style={{ fontSize: '0.72rem', fontWeight: 700 }}>{t('panelBilling.popular')}</Insignia>}
                      </div>

                      <div style={{ margin: '8px 0 10px', display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span className="numero" style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--marca)' }}>
                          {monto}
                        </span>
                        <span className="suave" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          {moneda.toUpperCase()} {periodo}
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
                        {t('panelBilling.capacidadIcono', { capacidad: t(`tiers.${tierItem.id}.capacidad`) })}
                      </div>

                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: 'var(--texto-suave)', lineHeight: 1.45 }}>
                        {t(`tiers.${tierItem.id}.puntos`, { returnObjects: true }).map((pt, idx) => (
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
                  label={t('panelBilling.masDe15Label')}
                  type="number"
                  min="0"
                  step="1"
                  value={extraAgentes}
                  onChange={(e) => setExtraAgentes(e.target.value)}
                  ayuda={t('panelBilling.porAgenteExtraAyuda', {
                    monto: PRECIO_AGENTE_EXTRA_PRO[moneda][frecuencia],
                    moneda: moneda.toUpperCase(),
                    periodo: frecuencia === 'mensual' ? t('panelBilling.sufijoMes') : t('panelBilling.sufijoAnio'),
                  })}
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
                  {t('panelBilling.planResumen', {
                    nombre: t(`tiers.${tierSeleccionado.id}.nombre`),
                    frecuencia: frecuencia === 'mensual' ? t('panelBilling.mensual') : t('panelBilling.anual'),
                  })}
                </strong>
                <span className="tenue" style={{ fontSize: '0.82rem' }}>
                  {t('panelBilling.totalAPagar')}<strong style={{ color: 'var(--marca)' }}>{precioActual} {periodoTexto}</strong> · {t(`tiers.${tierSeleccionado.id}.capacidad`)}
                </span>
              </div>
              <Boton type="submit" cargando={cargando}>
                {t('panelBilling.continuarStripe')}
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
export function ReporteAgencia() {
  const { t } = useTranslation('agencia');
  const { data, cargando, error, recargar } = useFetch(({ signal }) => agencyApi.reporte({ signal }), []);

  return (
    <Tarjeta titulo={t('reporte.titulo')}>
      {cargando && <Cargando texto={t('reporte.cargando')} />}
      {error && <ErrorCarga error={error} onReintentar={recargar} />}
      {data && (
        <>
          <p className="suave" style={{ marginTop: 0 }}>
            {data.totalMes === 0
              ? t('reporte.nadie')
              : t('reporte.totalMes', { cantidad: data.totalMes })}
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

function VistaDueno({ agencia, miembros, actualizarUsuario, recargar, seccion }) {
  const { t } = useTranslation('agencia');
  const [form, setForm] = useState({
    agencyName: agencia.agencyName,
    contact: agencia.contact || '',
    colorAcento: agencia.colorAcento || '',
    fuentePdf: agencia.fuentePdf || '',
    densidadPdf: agencia.densidadPdf || 'normal',
    fondoPdf: agencia.fondoPdf || '',
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
      const data = await agencyApi.actualizar(form);
      // Sin esto, el cambio (color, fuente, nombre...) solo se veía tras
      // cerrar sesion y volver a entrar: actualizarUsuario refresca la
      // agencia en el contexto, que es de donde HojaImpresion.jsx y el resto
      // de la app leen la marca, no solo esta pantalla.
      actualizarUsuario({ agency: data.agency });
      recargar();
      setEstado({ tipo: 'exito', mensaje: t('dueno.actualizada') });
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
      actualizarUsuario({ agency: data.agency });
      recargar();
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
      const data = await agencyApi.actualizar({ logoUrl: '' });
      setLogoUrl('');
      actualizarUsuario({ agency: data.agency });
      recargar();
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
          titulo={t('dueno.pruebaTitulo', { dias: trial.diasRestantes, diaLabel: t(trial.diasRestantes === 1 ? 'vistaMiembro.diaRestante' : 'vistaMiembro.diasRestantes') })}
        >
          {t('dueno.pruebaTexto')}
        </Aviso>
      )}

      {congelada && (
        <AvisoCongelada
          paraDueno
          yaTuvoPlan={agencia.billing?.status === 'congelada'}
          esTrialVencido={trial.trialVencido}
        />
      )}

      {seccion === 'marca' && <Tarjeta titulo={t('dueno.marcaTitulo')} accion={<Insignia color="verde">{t('dueno.insigniaDueno')}</Insignia>}>
        <p className="suave" style={{ marginTop: 0 }}>
          {t('dueno.marcaTexto')}
        </p>

        {estado && <Aviso tipo={estado.tipo}>{estado.mensaje}</Aviso>}

        <form onSubmit={guardar} className="pila" noValidate>
          <Campo label={t('dueno.nombreLabel')} name="agencyName" value={form.agencyName} onChange={cambiar} />

          <div className="campo">
            <label>{t('dueno.logoLabel')}</label>
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
                <Icono nombre="mas" tamano={14} /> {logoUrl ? t('dueno.cambiarLogo') : t('dueno.subirLogo')}
              </Boton>
              {logoUrl && (
                <Boton type="button" variante="peligro-texto" chico onClick={quitarLogo} cargando={subiendoLogo}>
                  {t('dueno.quitar')}
                </Boton>
              )}
            </div>
            <span className="campo-ayuda">{t('dueno.logoAyuda')}</span>
          </div>

          <Campo label={t('dueno.contactoLabel')} name="contact" value={form.contact} onChange={cambiar} />

          {agencia.marcaBlanca ? (
            <div className="campo">
              <label htmlFor="colorAcento">{t('dueno.colorAcentoLabel')}</label>
              <div className="fila" style={{ gap: 10, alignItems: 'center' }}>
                <input
                  id="colorAcento"
                  type="color"
                  name="colorAcento"
                  value={form.colorAcento || COLOR_RUMBIA}
                  onChange={cambiar}
                  style={{ width: 44, height: 36, padding: 2, cursor: 'pointer' }}
                />
                <span className="tenue">{form.colorAcento || t('dueno.colorPredeterminado')}</span>
                {form.colorAcento && (
                  <Boton
                    type="button"
                    variante="fantasma"
                    chico
                    onClick={() => setForm((f) => ({ ...f, colorAcento: '' }))}
                  >
                    {t('dueno.restablecer')}
                  </Boton>
                )}
              </div>
              <span className="campo-ayuda">
                {t('dueno.colorAyuda')}
              </span>
            </div>
          ) : null}

          {agencia.marcaBlanca ? (
            <Campo label={t('dueno.tipografiaLabel')} name="fuentePdf">
              <select name="fuentePdf" value={form.fuentePdf} onChange={cambiar}>
                {FUENTES_PDF.map((f) => (
                  <option key={f.id} value={f.id}>
                    {t(`fuentesPdf.${f.id || 'default'}`)}
                  </option>
                ))}
              </select>
            </Campo>
          ) : null}

          {agencia.marcaBlanca ? (
            <Campo label={t('dueno.tamanoTextoLabel')} name="densidadPdf">
              <select name="densidadPdf" value={form.densidadPdf} onChange={cambiar}>
                {DENSIDADES_PDF.map((d) => (
                  <option key={d.id} value={d.id}>
                    {t(`densidadesPdf.${d.id}`)}
                  </option>
                ))}
              </select>
            </Campo>
          ) : null}

          {agencia.marcaBlanca ? (
            <div className="campo">
              <label>{t('dueno.fondoLabel')}</label>
              {/* Paleta curada, sin selector de color libre a proposito: el
                  fondo cubre toda la hoja detras de las tarjetas blancas, y
                  un tono mal elegido se traga el documento entero. */}
              <div className="fila" style={{ gap: 8, flexWrap: 'wrap' }}>
                {FONDOS_PDF.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, fondoPdf: f.id }))}
                    title={t(`fondosPdf.${f.id || 'default'}`)}
                    aria-label={t(`fondosPdf.${f.id || 'default'}`)}
                    aria-pressed={form.fondoPdf === f.id}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: f.color || '#ffffff',
                      border:
                        form.fondoPdf === f.id
                          ? '3px solid var(--marca)'
                          : '1px solid var(--border-fuerte)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
              <span className="campo-ayuda">{t(`fondosPdf.${form.fondoPdf || 'default'}`)}</span>
            </div>
          ) : (
            <Aviso tipo="info" titulo={t('dueno.personalizacionTitulo')}>
              {t('dueno.personalizacionTexto')}
              <Link to="/acerca">{t('dueno.compararPlanes')}</Link>.
            </Aviso>
          )}

          <div>
            <Boton type="submit" cargando={guardando}>
              {t('dueno.guardarCambios')}
            </Boton>
          </div>
        </form>
      </Tarjeta>}

      {seccion === 'facturacion' && <PanelBilling agencia={agencia} totalAgentes={miembros.length + 1} recargar={recargar} />}

      {seccion === 'equipo' && <>

      <Tarjeta titulo={t('dueno.codigoInvitacionTitulo')}>
        <p className="suave" style={{ marginTop: 0 }}>
          {t('dueno.codigoInvitacionTexto')}
        </p>
        <div className="fila" style={{ gap: 8, alignItems: 'center' }}>
          <code className="enlace-compartir" style={{ flex: 'unset', fontWeight: 700, letterSpacing: '0.04em' }}>
            {agencia.inviteCode}
          </code>
          <Boton chico onClick={copiarCodigo}>
            {copiado ? t('dueno.copiado') : t('dueno.copiar')}
          </Boton>
          <Boton variante="secundario" chico onClick={regenerarCodigo} cargando={regenerando}>
            {t('dueno.regenerar')}
          </Boton>
        </div>
      </Tarjeta>

      <Tarjeta titulo={t('dueno.agentesTitulo', { cantidad: miembros.length })}>
        {miembros.length === 0 ? (
          <p className="suave" style={{ margin: 0 }}>
            {t('dueno.sinAgentes')}
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
                  {t('dueno.quitar2')}
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
            ? t('dueno.zonaPeligroConMiembros')
            : t('dueno.zonaPeligroSinMiembros')}
        </p>
        <Boton variante="peligro-texto" chico onClick={salir} cargando={saliendo} disabled={miembros.length > 0}>
          {t('dueno.salir')}
        </Boton>
      </Tarjeta>

      </>}
      <ModalConfirmar
        abierto={Boolean(porEliminar)}
        onCerrar={() => setPorEliminar(null)}
        onConfirmar={eliminarMiembro}
        titulo={t('dueno.quitarAgenteTitulo')}
        mensaje={t('dueno.quitarAgenteMensaje', { nombre: porEliminar?.name })}
        textoConfirmar={t('dueno.quitarConfirmar')}
      />
    </>
  );
}
