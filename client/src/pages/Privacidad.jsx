import { useTranslation } from 'react-i18next';
import { Tarjeta } from '../components/ui.jsx';
import PaginaLegal from '../components/PaginaLegal.jsx';
import { RESPONSABLE, CONTACTO_PRIVACIDAD, DOMICILIO } from '../config/legal.js';

/**
 * Política de privacidad.
 *
 * El contenido describe lo que el código hace hoy, ni más ni menos: los campos
 * salen de los modelos (User, Trip, Itinerary, Expense) y los terceros de los
 * servicios que realmente se llaman. Si cambia alguno de esos archivos, hay que
 * actualizar esta página.
 *
 * El texto trae HTML embebido (<strong>, <code>, <a>) en vez de fragmentarse en
 * decenas de claves pre/negrita/post: es contenido legal 100% estático (no hay
 * entrada de usuario de por medio), así que dangerouslySetInnerHTML no implica
 * ningún riesgo de XSS aquí.
 */
export default function Privacidad() {
  const { t } = useTranslation('privacidad');
  const html = (key, params) => ({ __html: t(key, params) });
  const contacto = { responsable: RESPONSABLE, domicilio: DOMICILIO, contacto: CONTACTO_PRIVACIDAD };

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
      <p dangerouslySetInnerHTML={html('s1.p1', contacto)} />
      <p dangerouslySetInnerHTML={html('s1.p2')} />

      <h2>{t('s2.titulo')}</h2>
      <p>{t('s2.intro')}</p>

      <h3>{t('s2.cuenta.titulo')}</h3>
      <ul>
        {t('s2.cuenta.items', { returnObjects: true }).map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
        ))}
      </ul>

      <h3>{t('s2.preferencias.titulo')}</h3>
      <ul>
        {t('s2.preferencias.items', { returnObjects: true }).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      <p className="tenue">{t('s2.preferencias.nota')}</p>

      <h3>{t('s2.viajes.titulo')}</h3>
      <ul>
        {t('s2.viajes.items', { returnObjects: true }).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>

      <h3>{t('s2.itinerariosGastos.titulo')}</h3>
      <ul>
        {t('s2.itinerariosGastos.items', { returnObjects: true }).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>

      <h3>{t('s2.medicionEnlaces.titulo')}</h3>
      <p dangerouslySetInnerHTML={html('s2.medicionEnlaces.p1')} />
      <p dangerouslySetInnerHTML={html('s2.medicionEnlaces.p2')} />

      <h3>{t('s2.datosTecnicos.titulo')}</h3>
      <p>{t('s2.datosTecnicos.p1')}</p>

      <h2>{t('s3.titulo')}</h2>
      <p>{t('s3.p1')}</p>
      <p dangerouslySetInnerHTML={html('s3.p2')} />

      <h2>{t('s4.titulo')}</h2>
      <p>{t('s4.intro')}</p>

      <h3>{t('s4.gemini.titulo')}</h3>
      <p dangerouslySetInnerHTML={html('s4.gemini.p1')} />
      <p dangerouslySetInnerHTML={html('s4.gemini.p2')} />
      <p dangerouslySetInnerHTML={html('s4.gemini.p3')} />

      <h3>{t('s4.clima.titulo')}</h3>
      <p dangerouslySetInnerHTML={html('s4.clima.p1')} />

      <h3>{t('s4.stripe.titulo')}</h3>
      <p dangerouslySetInnerHTML={html('s4.stripe.p1')} />

      <h3>{t('s4.infra.titulo')}</h3>
      <p>{t('s4.infra.p1')}</p>

      <h3>{t('s4.resend.titulo')}</h3>
      <p dangerouslySetInnerHTML={html('s4.resend.p1')} />

      <h3>{t('s4.cloudinary.titulo')}</h3>
      <p>{t('s4.cloudinary.p1')}</p>

      <h3>{t('s4.clientesCrm.titulo')}</h3>
      <p dangerouslySetInnerHTML={html('s4.clientesCrm.p1')} />

      <h3>{t('s4.registroAgencia.titulo')}</h3>
      <p dangerouslySetInnerHTML={html('s4.registroAgencia.p1')} />

      <h3>{t('s4.afiliados.titulo')}</h3>
      <p dangerouslySetInnerHTML={html('s4.afiliados.p1')} />
      <p dangerouslySetInnerHTML={html('s4.afiliados.p2')} />
      <p dangerouslySetInnerHTML={html('s4.afiliados.p3')} />

      <h2>{t('s5.titulo')}</h2>
      <p>{t('s5.p1')}</p>
      <ul>
        {t('s5.items', { returnObjects: true, ...contacto }).map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
        ))}
      </ul>
      <p className="tenue">{t('s5.notaBackup')}</p>

      <h2>{t('s6.titulo')}</h2>
      <p>{t('s6.p1')}</p>
      <ul>
        {t('s6.items', { returnObjects: true, ...contacto }).map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
        ))}
      </ul>
      <p dangerouslySetInnerHTML={html('s6.p2', contacto)} />

      <h2>{t('s7.titulo')}</h2>
      <p>{t('s7.p1')}</p>
      <ul>
        {t('s7.items', { returnObjects: true }).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      <p dangerouslySetInnerHTML={html('s7.p2')} />
      <p>{t('s7.p3')}</p>

      <h2>{t('s8.titulo')}</h2>
      <p dangerouslySetInnerHTML={html('s8.p1', contacto)} />

      <h2>{t('s9.titulo')}</h2>
      <p>{t('s9.p1')}</p>
    </PaginaLegal>
  );
}
