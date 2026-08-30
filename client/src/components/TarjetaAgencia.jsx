import { useEffect, useRef, useState } from 'react';
import { agencyApi, authApi, billingApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import Icono from './Icono.jsx';
import { Boton, Campo, Tarjeta, Aviso, Insignia, ModalConfirmar, Cargando, ErrorCarga } from './ui.jsx';

/**
 * Precios de referencia, solo para mostrar en pantalla: lo que de verdad se
 * cobra lo decide Stripe con los Price que arma "npm run stripe:setup". Si
 * cambian ahi, hay que actualizar esto a mano para que no digan cosas
 * distintas.
 */
const PLANES = {
  mensual: { etiqueta: 'Mensual', base: '$20 USD/mes', agente: '+$10 USD/mes por agente extra' },
  anual: { etiqueta: 'Anual', base: '$200 USD/año', agente: '+$100 USD/año por agente extra' },
  vitalicio: { etiqueta: 'De por vida', base: '$500 USD pago único', agente: '+$250 USD único por agente extra' },
};

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
          descargas el PDF. Déjalo vacío y sale la marca de Rumbo.
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
function AvisoCongelada({ paraDueno, yaTuvoPlan }) {
  return (
    <Aviso tipo="alerta" titulo="El plan de esta agencia no está activo">
      {paraDueno
        ? `Tus viajes y los de tus agentes siguen ahí, pero nadie puede crear ni editar nada hasta que ${yaTuvoPlan ? 'reactives' : 'actives'} el plan más abajo.`
        : `Tus viajes siguen ahí, pero no puedes crear ni editar nada hasta que el dueño de la agencia ${yaTuvoPlan ? 'reactive' : 'active'} el plan.`}
    </Aviso>
  );
}

function VistaMiembro({ agencia, actualizarUsuario }) {
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState(null);

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

      {agencia.billing?.status && agencia.billing.status !== 'activa' && (
        <AvisoCongelada paraDueno={false} yaTuvoPlan={agencia.billing.status === 'congelada'} />
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

  const [plan, setPlan] = useState(billing.plan || 'mensual');
  // El 3 espeja AGENTES_INCLUIDOS en server/src/models/Agency.js: es solo el
  // valor inicial del formulario, la capacidad real la calcula el backend.
  const [extraAgentes, setExtraAgentes] = useState(Math.max(0, totalAgentes - 3));
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const irACheckout = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const data = await billingApi.checkout({ plan, extraAgentes: Number(extraAgentes) || 0 });
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

  return (
    <Tarjeta
      titulo="Plan de la agencia"
      accion={
        billing.status && (
          <Insignia color={billing.status === 'activa' ? 'verde' : 'ambar'}>
            {billing.status === 'activa' ? 'Activo' : billing.status === 'congelada' ? 'Vencido' : 'Sin activar'}
          </Insignia>
        )
      }
    >
      {error && <Aviso tipo="error">{error}</Aviso>}

      {billing.status === 'activa' && (
        <>
          <p className="suave" style={{ marginTop: 0 }}>
            Plan {PLANES[billing.plan]?.etiqueta.toLowerCase() || billing.plan}, {agencia.capacidadAgentes} agente(s)
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
          <p className="suave" style={{ marginTop: 0 }}>
            Mientras seas la única persona en la agencia, Rumbo es gratis. En cuanto quieras que se te
            una un agente, activa un plan.
          </p>
          <form onSubmit={irACheckout} className="pila-sm">
            <div className="campos-2">
              <Campo label="Plan">
                <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                  {Object.entries(PLANES).map(([valor, p]) => (
                    <option key={valor} value={valor}>
                      {p.etiqueta} — {p.base}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo
                label="Agentes extra"
                type="number"
                min="0"
                step="1"
                value={extraAgentes}
                onChange={(e) => setExtraAgentes(e.target.value)}
                ayuda={PLANES[plan]?.agente}
              />
            </div>
            <div>
              <Boton type="submit" cargando={cargando}>
                Suscribirme
              </Boton>
            </div>
          </form>
        </>
      )}
    </Tarjeta>
  );
}

function VistaDueno({ agencia, miembros, actualizarUsuario, recargar }) {
  const [form, setForm] = useState({ agencyName: agencia.agencyName, contact: agencia.contact || '' });
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

  return (
    <>
      {agencia.billing?.status !== 'activa' && (
        <AvisoCongelada paraDueno yaTuvoPlan={agencia.billing?.status === 'congelada'} />
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
