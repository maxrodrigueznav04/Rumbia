import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import Icono from '../components/Icono.jsx';
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
    agencyName: user?.branding?.agencyName || '',
    logoUrl: user?.branding?.logoUrl || '',
    contact: user?.branding?.contact || '',
  });
  const [estilos, setEstilos] = useState(user?.preferences?.travelStyles || []);
  const [estado, setEstado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState(null);
  const inputLogoRef = useRef(null);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  /**
   * El logo se sube y se guarda de inmediato, aparte del boton "Guardar
   * marca". Es la misma logica que ya tenian el nombre y el contacto ahi
   * abajo, solo que si se esperara al submit habria que sostener el archivo en
   * memoria hasta entonces y el error de una subida fallida quedaria mezclado
   * con el de los otros campos.
   */
  const subirLogo = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // deja elegir el mismo archivo otra vez si hace falta
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
      // Solo logoUrl, nunca form entero: el backend hace un merge parcial, y
      // mandar los otros dos campos aqui perderia una edicion de nombre o
      // contacto que el usuario todavia no hubiera guardado.
      const data = await authApi.updateProfile({ branding: { logoUrl: '' } });
      actualizarUsuario(data.user);
      setForm((f) => ({ ...f, logoUrl: '' }));
    } catch (err) {
      setErrorLogo(err.message);
    } finally {
      setSubiendoLogo(false);
    }
  };

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
        branding: {
          agencyName: form.agencyName,
          logoUrl: form.logoUrl,
          contact: form.contact,
        },
      });
      actualizarUsuario(data.user);
      setEstado({ tipo: 'exito', mensaje: 'Cambios guardados.' });
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

      <Tarjeta titulo="Marca en el PDF">
        <p className="suave" style={{ marginTop: 0 }}>
          Si armas itinerarios para otras personas, esto es lo que aparece en el membrete cuando
          descargas el PDF. Déjalo vacío y sale la marca de Rumbo.
        </p>

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

              {/* display:none y no .oculto-visual: este input no debe entrar al
                  orden de tabulacion ni al arbol de accesibilidad, se dispara
                  solo por codigo desde el boton de al lado. */}
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
