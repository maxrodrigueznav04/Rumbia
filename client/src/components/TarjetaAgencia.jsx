import { useRef, useState } from 'react';
import { agencyApi, authApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import Icono from './Icono.jsx';
import { Boton, Campo, Tarjeta, Aviso, Insignia, ModalConfirmar, Cargando, ErrorCarga } from './ui.jsx';

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

  return data.esDueno ? (
    <VistaDueno
      agencia={data.agency}
      miembros={data.miembros}
      actualizarUsuario={actualizarUsuario}
      recargar={recargar}
    />
  ) : (
    <VistaMiembro agencia={data.agency} actualizarUsuario={actualizarUsuario} />
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
