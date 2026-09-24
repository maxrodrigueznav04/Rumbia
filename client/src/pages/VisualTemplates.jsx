import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { visualTemplatesApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Aviso, Boton, Campo, ErrorCarga, Esqueleto, Tarjeta, Vacio } from '../components/ui.jsx';

export default function VisualTemplates() {
  const { t } = useTranslation('visualTemplates');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, cargando, error, recargar } = useFetch(({ signal }) => visualTemplatesApi.list({ signal }), []);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [actionError, setActionError] = useState('');
  const templates = data?.templates || [];
  const canEdit = Boolean(data?.canEdit);
  const activeCount = templates.filter((item) => item.status !== 'archived').length;

  const create = async (event) => {
    event.preventDefault();
    setSaving(true);
    setActionError('');
    try {
      const result = await visualTemplatesApi.create({ name: name.trim() });
      navigate(`/plantillas-visuales/${result.template._id}`);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (item, action) => {
    setActionId(item._id);
    setActionError('');
    try {
      if (action === 'duplicate') await visualTemplatesApi.duplicate(item._id);
      else await visualTemplatesApi.update(item._id, {
        revision: item.revision,
        status: action === 'archive' ? 'archived' : 'draft',
      });
      recargar();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionId(null);
    }
  };

  return <div className="pila">
    <div><Link className="volver" to="/plantillas">{t('back')}</Link>
      <h1>{t('title')}</h1><p className="suave">{t('subtitle')}</p>
    </div>
    {!user?.agency && <Aviso tipo="info">{t('agencyOnly')}</Aviso>}
    {error && <ErrorCarga error={error} onReintentar={recargar} />}
    {cargando && <Esqueleto alto={110} />}
    {data && user?.agency && <>
      <p className="suave" style={{ margin: 0 }}>{t('quota', { count: activeCount, limit: data.limit })}</p>
      {actionError && <Aviso tipo="error">{actionError}</Aviso>}
      {canEdit && <Tarjeta titulo={t('newTitle')}>
        <form onSubmit={create} className="fila" style={{ gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}><Campo label={t('name')} value={name} maxLength={80} required onChange={(event) => setName(event.target.value)} /></div>
          <Boton type="submit" cargando={saving} disabled={!name.trim() || activeCount >= data.limit}>{t('create')}</Boton>
        </form>
      </Tarjeta>}
      {!canEdit && <Aviso tipo="info">{t('readOnly')}</Aviso>}
      {!templates.length && <Vacio icono="🎨" titulo={t('emptyTitle')}>{t('emptyText')}</Vacio>}
      <div className="rejilla rejilla-2">
        {templates.map((item) => <Tarjeta key={item._id} titulo={item.name}>
          <p className="suave">{t(`status.${item.status}`)} · {t('revision', { number: item.revision })}</p>
          <div className="fila" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Link className="boton secundario chico" to={`/plantillas-visuales/${item._id}`}>{canEdit ? t('edit') : t('view')}</Link>
            {canEdit && <>
              <Boton chico variante="secundario" onClick={() => runAction(item, 'duplicate')} cargando={actionId === item._id} disabled={activeCount >= data.limit}>{t('duplicate')}</Boton>
              <Boton chico variante="secundario" onClick={() => runAction(item, item.status === 'archived' ? 'restore' : 'archive')} cargando={actionId === item._id} disabled={item.status === 'archived' && activeCount >= data.limit}>{item.status === 'archived' ? t('restore') : t('archive')}</Boton>
            </>}
          </div>
        </Tarjeta>)}
      </div>
    </>}
  </div>;
}
