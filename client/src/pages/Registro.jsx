import { useState } from 'react';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { despertarServidor } from '../api/index.js';
import useFormulario from '../hooks/useFormulario.js';
import { useMetaPagina } from '../hooks/useMetaPagina.js';
import { reglas } from '../utils/validacion.js';
import { Boton, Campo, CampoPassword, Aviso } from '../components/ui.jsx';
import Captcha from '../components/Captcha.jsx';

// Si no hay llave publica, el captcha esta desactivado: no tiene sentido
// bloquear el boton esperando un token que nunca va a llegar.
const CAPTCHA_ACTIVO = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

export default function Registro() {
  const { t } = useTranslation('auth');
  useMetaPagina({
    titulo: t('registro.meta.titulo'),
    descripcion: t('registro.meta.descripcion'),
    ruta: '/registro',
  });

  // Render duerme el plan gratuito: se despierta mientras el usuario escribe,
  // asi el login no carga con los ~50 s del arranque en frio.
  useEffect(() => {
    despertarServidor();
  }, []);

  const { register } = useAuth();
  const navigate = useNavigate();
  const [perfilUso, setPerfilUso] = useState('agencia');
  const [turnstileToken, setTurnstileToken] = useState('');

  const form = useFormulario(
    { name: '', email: '', password: '', referenciaContacto: '' },
    { name: reglas.nombre, email: reglas.email, password: reglas.password }
  );

  const crear = form.enviar(async (valores) => {
    await register({ ...valores, perfilUso, turnstileToken });

    // Si vino de probar el generador sin cuenta (Probar.jsx), se manda
    // directo a Nuevo viaje con lo que ya había escrito ahí -- no hay que
    // volver a teclear destino, fechas, viajeros y gustos desde cero justo
    // después de crear la cuenta.
    try {
      const crudo = localStorage.getItem('rumbia_borrador_invitado');
      if (crudo) {
        localStorage.removeItem('rumbia_borrador_invitado');
        const b = JSON.parse(crudo);
        const params = new URLSearchParams({
          destino: b.destino || '',
          startDate: b.inicio || '',
          endDate: b.fin || '',
          travelers: String(b.viajeros || 1),
          estilos: (b.estilos || []).join(','),
        });
        navigate(`/viajes/nuevo?${params.toString()}`, { replace: true });
        return;
      }
    } catch {
      /* borrador ilegible o localStorage no disponible: sigue el flujo normal */
    }

    navigate('/viajes', { replace: true });
  });

  return (
    <div className="auth-pantalla">
      <div className="auth-caja">
        <div className="auth-encabezado">
          <div className="marca" style={{ justifyContent: 'center', marginBottom: 10 }}>
            <span className="marca-punto" aria-hidden="true">
              R
            </span>
            Rumbia
          </div>
          <h1 style={{ fontSize: '1.35rem' }}>
            {perfilUso === 'agencia' ? t('registro.tituloAgencia') : t('registro.tituloPersonal')}
          </h1>
          <p>
            {perfilUso === 'agencia' ? t('registro.textoAgencia') : t('registro.textoPersonal')}
          </p>
        </div>

        <form onSubmit={crear} className="pila" noValidate>
          {/* Honeypot: invisible para una persona, tentador para un bot que
              rellena todo lo que encuentra en el formulario. Ver registerSchema
              y register() en el servidor. */}
          <input
            type="text"
            name="referenciaContacto"
            value={form.valores.referenciaContacto}
            onChange={form.cambiar}
            className="campo-senuelo"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

          <div className="campo">
            <label>{t('registro.comoVasAUsar')}</label>
            <div className="selector-perfil-uso">
              <button
                type="button"
                aria-pressed={perfilUso === 'agencia'}
                className={`opcion-perfil-uso ${perfilUso === 'agencia' ? 'activo' : ''}`}
                onClick={() => setPerfilUso('agencia')}
              >
                <strong>{t('registro.soyAgencia')}</strong>
                <span className="tenue">{t('registro.soyAgenciaTexto')}</span>
              </button>
              <button
                type="button"
                aria-pressed={perfilUso === 'personal'}
                className={`opcion-perfil-uso ${perfilUso === 'personal' ? 'activo' : ''}`}
                onClick={() => setPerfilUso('personal')}
              >
                <strong>{t('registro.viajoPorMiCuenta')}</strong>
                <span className="tenue">{t('registro.viajoPorMiCuentaTexto')}</span>
              </button>
            </div>
            <span className="campo-ayuda">{t('registro.cambiarDespues')}</span>
          </div>

          <Campo
            label={t('registro.nombre')}
            autoComplete="name"
            placeholder={t('registro.comoTeLlamas')}
            autoFocus
            {...form.props('name')}
          />

          <Campo
            label={t('registro.email')}
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            {...form.props('email')}
          />

          <CampoPassword
            label={t('registro.contrasena')}
            autoComplete="new-password"
            placeholder={t('registro.minimo8')}
            medidor
            ayuda={t('registro.minimo8Ayuda')}
            {...form.props('password')}
          />

          <Captcha onToken={setTurnstileToken} />

          <Boton
            type="submit"
            ancho
            cargando={form.enviando}
            disabled={CAPTCHA_ACTIVO && !turnstileToken}
          >
            {form.enviando ? t('registro.creandoCuenta') : t('registro.crearCuenta')}
          </Boton>

          {/* Antes de dar sus datos, el usuario tiene que poder leer qué se
              hace con ellos: por eso el enlace va junto al botón, no en el pie. */}
          <p className="tenue legal-nota">
            {t('registro.aceptasIntro')} <Link to="/terminos">{t('registro.terminosCondiciones')}</Link>,{' '}
            {t('registro.la')} <Link to="/privacidad">{t('registro.politicaPrivacidad')}</Link>{' '}
            {t('registro.yEl')} <Link to="/cookies">{t('registro.avisoCookies')}</Link>.
          </p>
        </form>

        <p className="auth-pie">
          {t('registro.yaTienesCuenta')} <Link to="/entrar">{t('registro.entraAqui')}</Link>
        </p>
      </div>
    </div>
  );
}
