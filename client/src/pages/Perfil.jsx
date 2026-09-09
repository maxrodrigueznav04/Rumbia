import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import TarjetaAgencia from '../components/TarjetaAgencia.jsx';
import { Boton, Campo, Tarjeta, Aviso, Modal, CampoPassword } from '../components/ui.jsx';

const RITMOS = ['relajado', 'moderado', 'intenso'];

export default function Perfil() {
  const { t } = useTranslation('perfil');
  const { user, actualizarUsuario, logout } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const seccion = params.get('seccion') || (params.has('billing') || window.location.hash === '#plan-agencia' ? 'facturacion' : 'cuenta');
  const esDueno = user?.agency && String(user.agency.owner) === String(user._id);

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
      await logout();
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
    perfilUso: user?.preferences?.perfilUso || 'agencia',
  });
  const [estado, setEstado] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    setEstado(null);
    setGuardando(true);
    try {
      const data = await authApi.updateProfile({
        name: form.name,
        preferences: {
          homeCity: form.homeCity,
          currency: form.currency,
          pace: form.pace,
          budgetLevel: form.budgetLevel,
          perfilUso: form.perfilUso,
        },
      });
      actualizarUsuario(data.user);
      setEstado({ tipo: 'exito', mensaje: t('cambiosGuardados') });
    } catch (err) {
      setEstado({ tipo: 'error', mensaje: err.message });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="pila" style={{ maxWidth: 620, margin: '0 auto' }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>{t('titulo')}</h1>
        <p className="suave" style={{ margin: 0 }}>
          {t('subtitulo')}
        </p>
      </div>

      <nav className="secciones-perfil" aria-label={t('secciones.aria')}>
        {[['cuenta', t('secciones.cuenta')], ...(user?.preferences?.perfilUso !== 'personal' ? [['marca', t('secciones.marca')], ['equipo', t('secciones.equipo')], ...(esDueno ? [['facturacion', t('secciones.facturacion')]] : [])] : [])].map(([id, texto]) =>
          <Boton key={id} variante={seccion === id ? 'primario' : 'secundario'} aria-pressed={seccion === id} onClick={() => setParams({ seccion: id })}>{texto}</Boton>)}
      </nav>
      {seccion === 'cuenta' && <Tarjeta>
        <form onSubmit={guardar} className="pila" noValidate>
          {estado && <Aviso tipo={estado.tipo}>{estado.mensaje}</Aviso>}

          <div className="campo">
            <label>{t('comoUsas')}</label>
            <div className="selector-perfil-uso">
              <button
                type="button"
                aria-pressed={form.perfilUso === 'agencia'}
                className={`opcion-perfil-uso ${form.perfilUso === 'agencia' ? 'activo' : ''}`}
                onClick={() => setForm((f) => ({ ...f, perfilUso: 'agencia' }))}
              >
                <strong>{t('soyAgencia')}</strong>
                <span className="tenue">{t('soyAgenciaTexto')}</span>
              </button>
              <button
                type="button"
                aria-pressed={form.perfilUso === 'personal'}
                className={`opcion-perfil-uso ${form.perfilUso === 'personal' ? 'activo' : ''}`}
                onClick={() => setForm((f) => ({ ...f, perfilUso: 'personal' }))}
              >
                <strong>{t('viajoPorMiCuenta')}</strong>
                <span className="tenue">{t('viajoPorMiCuentaTexto')}</span>
              </button>
            </div>
          </div>

          <Campo label={t('nombre')} name="name" value={form.name} onChange={cambiar} required />

          <Campo label={t('email')}>
            <input value={user?.email || ''} disabled />
          </Campo>

          <div className="rejilla rejilla-2">
            <Campo
              label={t('ciudadOrigen')}
              name="homeCity"
              placeholder={t('ciudadOrigenPlaceholder')}
              value={form.homeCity}
              onChange={cambiar}
              ayuda={t('ciudadOrigenAyuda')}
            />
            <Campo label={t('moneda')}>
              <select name="currency" value={form.currency} onChange={cambiar}>
                {['MXN', 'USD', 'EUR', 'COP', 'ARS', 'CLP', 'PEN'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo label={t('ritmoDeViaje')}>
            <select name="pace" value={form.pace} onChange={cambiar}>
              {RITMOS.map((r) => (
                <option key={r} value={r}>
                  {t(`ritmos.${r}`)}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label={t('nivelDeGasto')}>
            <select name="budgetLevel" value={form.budgetLevel} onChange={cambiar}>
              <option value="bajo">{t('niveles.bajo')}</option>
              <option value="medio">{t('niveles.medio')}</option>
              <option value="alto">{t('niveles.alto')}</option>
            </select>
          </Campo>

          <Boton type="submit" cargando={guardando}>
            {guardando ? t('guardando') : t('guardarCambios')}
          </Boton>
        </form>
      </Tarjeta>}

      {form.perfilUso === 'agencia' && seccion !== 'cuenta' && (
        <TarjetaAgencia seccion={seccion} user={user} actualizarUsuario={actualizarUsuario} />
      )}

      {seccion === 'cuenta' && <Tarjeta titulo={t('eliminarCuentaTitulo')} className="zona-peligro">
        <p className="suave">
          {t('eliminarCuentaPre')}<strong>{t('eliminarCuentaBold')}</strong>{t('eliminarCuentaPost')}
        </p>
        <Boton variante="peligro" onClick={() => setBajaAbierta(true)}>
          {t('eliminarCuentaBoton')}
        </Boton>
      </Tarjeta>}

      <Modal
        abierto={bajaAbierta}
        onCerrar={() => {
          setBajaAbierta(false);
          setPasswordBaja('');
          setErrorBaja(null);
        }}
        titulo={t('modalEliminarTitulo')}
        ancho={440}
      >
        <form onSubmit={eliminarCuenta} className="pila" noValidate>
          <Aviso tipo="alerta" titulo={t('modalAvisoTitulo')}>
            {t('modalAvisoTexto')}
          </Aviso>

          {errorBaja && <Aviso tipo="error">{errorBaja.message}</Aviso>}

          <CampoPassword
            label={t('confirmaConTuContrasena')}
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
              {t('cancelar')}
            </Boton>
            <Boton variante="peligro" type="submit" cargando={borrando} disabled={!passwordBaja}>
              {t('siEliminarTodo')}
            </Boton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
