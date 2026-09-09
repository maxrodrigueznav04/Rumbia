import { useTranslation } from 'react-i18next';
import { Tarjeta } from '../components/ui.jsx';
import PaginaLegal from '../components/PaginaLegal.jsx';
import { CONTACTO_PRIVACIDAD } from '../config/legal.js';

/**
 * Aviso de cookies y rastreo de terceros.
 *
 * Rumbia SI coloca una cookie propia: la de sesion (tecnica, estrictamente
 * necesaria, httpOnly -- nada de analitica ni publicidad). El resto sigue
 * igual: no hay rastreo propio, pero los sitios de reserva a los que sales
 * si usan las suyas.
 *
 * Mismo criterio que Privacidad.jsx sobre dangerouslySetInnerHTML: es texto
 * legal 100% estático, sin entrada de usuario de por medio.
 */
export default function Cookies() {
  const { t } = useTranslation('cookies');
  const html = (key, params) => ({ __html: t(key, params) });
  const contacto = { contacto: CONTACTO_PRIVACIDAD };

  return (
    <PaginaLegal titulo={t('meta.titulo')} entrada={t('meta.entrada')}>
      <Tarjeta titulo={t('resumen.titulo')}>
        <ul>
          {t('resumen.puntos', { returnObjects: true }).map((punto, i) => (
            <li key={i}>{punto}</li>
          ))}
        </ul>
      </Tarjeta>

      <h2>{t('s1.titulo')}</h2>
      <p dangerouslySetInnerHTML={html('s1.p1')} />
      <p>{t('s1.p2')}</p>
      <p dangerouslySetInnerHTML={html('s1.p3')} />

      <h2>{t('s2.titulo')}</h2>
      <p dangerouslySetInnerHTML={html('s2.p1')} />
      <ul>
        {t('s2.items', { returnObjects: true }).map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
        ))}
      </ul>
      <p dangerouslySetInnerHTML={html('s2.p2')} />
      <p dangerouslySetInnerHTML={html('s2.p3')} />

      <h2>{t('s3.titulo')}</h2>
      <p>{t('s3.p1')}</p>
      <p dangerouslySetInnerHTML={html('s3.p2')} />
      <p>{t('s3.p3')}</p>

      <h2>{t('s4.titulo')}</h2>
      <p>{t('s4.p1')}</p>
      <p>{t('s4.intro')}</p>
      <ul>
        {t('s4.items', { returnObjects: true }).map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
        ))}
      </ul>
      <p>{t('s4.p2')}</p>

      <h2>{t('s5.titulo')}</h2>
      <p dangerouslySetInnerHTML={html('s5.p1', contacto)} />
    </PaginaLegal>
  );
}
