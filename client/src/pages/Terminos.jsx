import { useTranslation } from 'react-i18next';
import { Tarjeta } from '../components/ui.jsx';
import PaginaLegal from '../components/PaginaLegal.jsx';
import { RESPONSABLE, CONTACTO_PRIVACIDAD } from '../config/legal.js';
import { ENLACE_WHATSAPP } from '../config/contacto.js';

/**
 * Términos y condiciones.
 *
 * Lo importante aquí no es cubrirse: es dejar claras dos cosas que la app hace
 * y que pueden causar un problema real —que la IA se equivoca, y que reservar
 * ocurre fuera de Rumbia—, para que nadie llegue al aeropuerto creyendo que
 * tenía un vuelo comprado.
 *
 * Mismo criterio que Privacidad.jsx sobre dangerouslySetInnerHTML: es texto
 * legal 100% estático, sin entrada de usuario de por medio.
 */
export default function Terminos() {
  const { t } = useTranslation('terminos');
  const html = (key, params) => ({ __html: t(key, params) });
  const contacto = { contacto: CONTACTO_PRIVACIDAD, whatsapp: ENLACE_WHATSAPP };

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
      <p>{t('s1.p1')}</p>
      <p dangerouslySetInnerHTML={html('s1.p2')} />
      <p>{t('s1.p3')}</p>
      <p>{t('s1.p4', { responsable: RESPONSABLE })}</p>

      <h2>{t('s2.titulo')}</h2>
      <p>{t('s2.p1')}</p>
      <p dangerouslySetInnerHTML={html('s2.p2')} />
      <p>{t('s2.p3')}</p>

      <h2>{t('s3.titulo')}</h2>
      <p dangerouslySetInnerHTML={html('s3.p1')} />
      <p dangerouslySetInnerHTML={html('s3.p2')} />

      <h2>{t('s4.titulo')}</h2>
      <ul>
        {t('s4.items', { returnObjects: true }).map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
        ))}
      </ul>

      <h2>{t('s5.titulo')}</h2>
      <p>{t('s5.intro')}</p>
      <ul>
        {t('s5.items', { returnObjects: true }).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      <p dangerouslySetInnerHTML={html('s5.p1')} />
      <p>{t('s5.p2')}</p>

      <h2>{t('s6.titulo')}</h2>
      <p dangerouslySetInnerHTML={html('s6.p1')} />
      <p dangerouslySetInnerHTML={html('s6.p2')} />
      <p dangerouslySetInnerHTML={html('s6.p3', contacto)} />
      <p>{t('s6.p4')}</p>
      <p>{t('s6.p5')}</p>

      <h2>{t('s7.titulo')}</h2>
      <p>{t('s7.p1')}</p>
      <p>{t('s7.p2')}</p>

      <h2>{t('s8.titulo')}</h2>
      <p>{t('s8.p1')}</p>

      <h2>{t('s9.titulo')}</h2>
      <p dangerouslySetInnerHTML={html('s9.p1')} />

      <h2>{t('s10.titulo')}</h2>
      <p>{t('s10.p1')}</p>

      <h2>{t('s11.titulo')}</h2>
      <p dangerouslySetInnerHTML={html('s11.p1', contacto)} />
    </PaginaLegal>
  );
}
