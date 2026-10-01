import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { visualTemplatesApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Aviso, Boton, Campo, ErrorCarga, Esqueleto, Tarjeta, Vacio } from '../components/ui.jsx';
import './visualTemplates.css';
import { visualHeadingFonts, visualBodyFonts } from '../config/visualFonts.js';
import { fittedFieldFontSize } from '../config/visualFieldSizing.js';

const previewFields = {
  'agency.name': 'TU AGENCIA',
  'trip.destination': 'Tu próximo destino',
  'trip.dates': 'Octubre 2026',
};

const presetCategories = {
  editorial: 'versatile', minimal: 'versatile', aventura: 'experiences',
  romance: 'getaways', familia: 'occasions', lujo: 'occasions', costa: 'getaways',
  ciudad: 'getaways', naturaleza: 'experiences', sabores: 'experiences',
  celebracion: 'occasions', ruta: 'experiences', bienestar: 'getaways',
};
const categoryIds = ['all', 'getaways', 'experiences', 'occasions', 'versatile'];

function PresetPreview({ design, sampleTitle }) {
  const cover = design.pages[0];
  return <div className="visual-preset-preview"><div className="visual-preset-page" style={{ background: cover.background }}>
    {cover.elements.map((item) => <div key={item.id} className="visual-preset-element" style={{
      left: `${item.x / 10}%`, top: `${item.y / 10}%`, width: `${item.width / 10}%`, height: `${item.height / 10}%`,
      background: item.type === 'shape' ? item.style.background : undefined,
      color: item.style.color || design.theme.ink,
      fontSize: `${(fittedFieldFontSize(item, item.field === 'trip.title' ? sampleTitle : previewFields[item.field]) / 595) * 100}cqw`,
      fontFamily: (item.style.fontSize || 0) >= 25
        ? visualHeadingFonts[design.theme.headingFont]
        : visualBodyFonts[design.theme.bodyFont],
      fontWeight: item.style.weight || 'normal',
    }}>{item.type === 'artwork' ? <><img className="visual-preset-art" src={visualTemplatesApi.artUrl(item.artId)} crossOrigin="use-credentials" alt="" loading="lazy" />{item.style.overlay && <span className="visual-art-shade" />}</> : item.type === 'field' ? (item.field === 'trip.title' ? sampleTitle : previewFields[item.field] || '') : item.type === 'text' ? item.text : null}</div>)}
  </div></div>;
}

export default function VisualTemplates() {
  const { t } = useTranslation('visualTemplates');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, cargando, error, recargar } = useFetch(({ signal }) => visualTemplatesApi.list({ signal }), []);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [createdPreset, setCreatedPreset] = useState(null);
  const [category, setCategory] = useState('all');
  const templates = data?.templates || [];
  const canEdit = Boolean(data?.canEdit);
  const activeCount = templates.filter((item) => item.status !== 'archived').length;
  const canCreate = canEdit && activeCount < (data?.limit || 0);
  const visiblePresets = (data?.presets || []).filter((preset) => category === 'all' || (presetCategories[preset.id] || 'versatile') === category);

  const createPreset = async (preset) => {
    setActionId(`preset-${preset.id}`);
    setActionError('');
    setCreatedPreset(null);
    try {
      const result = await visualTemplatesApi.create({
        name: t(`presets.${preset.id}.name`), presetId: preset.id, status: 'published',
      });
      setCreatedPreset({ name: result.template.name, id: result.template._id });
      recargar();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionId(null);
    }
  };

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
        status: action === 'archive' ? 'archived' : action === 'publish' ? 'published' : 'draft',
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
      {activeCount > data.limit && <Aviso tipo="info">{t('overLimit', { count: activeCount - data.limit })}</Aviso>}
      {actionError && <Aviso tipo="error">{actionError}</Aviso>}
      {createdPreset && <Aviso tipo="exito">{t('presetReady', { name: createdPreset.name })} <Link to={`/plantillas-visuales/${createdPreset.id}`}>{t('editCopy')}</Link> · <Link to="/viajes">{t('goToTrips')}</Link></Aviso>}
      {canEdit && <section className="pila-sm">
        <div><h2>{t('readyDesigns')}</h2><p className="suave">{t('readyDesignsHint')}</p></div>
        <div className="visual-preset-filters" aria-label={t('categories.label')}>{categoryIds.map((id) => <button type="button" key={id} className={category === id ? 'active' : ''} aria-pressed={category === id} onClick={() => setCategory(id)}>{t(`categories.${id}`)}</button>)}</div>
        <div className="visual-preset-gallery">{visiblePresets.map((preset) => <article className="visual-preset-card" key={preset.id}>
          <PresetPreview design={preset.design} sampleTitle={t(`presets.${preset.id}.sampleTitle`)} />
          <div className="visual-preset-copy"><h3>{t(`presets.${preset.id}.name`)}</h3><p className="suave">{t(`presets.${preset.id}.description`)}</p>
            <Boton onClick={() => createPreset(preset)} cargando={actionId === `preset-${preset.id}`} disabled={!canCreate || Boolean(actionId)}>{t('useReadyDesign')}</Boton>
          </div>
        </article>)}</div>
        <details className="visual-from-scratch"><summary>{t('fromScratch')}</summary>
          <form onSubmit={create} className="fila" style={{ gap: 12, alignItems: 'end', flexWrap: 'wrap', paddingTop: 16 }}>
            <div style={{ flex: '1 1 240px' }}><Campo label={t('name')} value={name} maxLength={80} required onChange={(event) => setName(event.target.value)} /></div>
            <Boton type="submit" cargando={saving} disabled={!name.trim() || !canCreate}>{t('create')}</Boton>
          </form>
        </details>
      </section>}
      {!canEdit && <Aviso tipo="info">{t('readOnly')}</Aviso>}
      {!templates.length && <Vacio icono="🎨" titulo={t('emptyTitle')}>{t('emptyText')}</Vacio>}
      {!!templates.length && <h2>{t('yourTemplates')}</h2>}
      <div className="rejilla rejilla-2">
        {templates.map((item) => <Tarjeta key={item._id} titulo={item.name}>
          <p className="suave">{t(`status.${item.status}`)} · {t('revision', { number: item.revision })}</p>
          <div className="fila" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Link className="boton secundario chico" to={`/plantillas-visuales/${item._id}`}>{canEdit && item.status !== 'archived' ? t('edit') : t('view')}</Link>
            {canEdit && <>
              {item.status !== 'archived' && <Boton chico variante="secundario" onClick={() => runAction(item, item.status === 'published' ? 'draft' : 'publish')} cargando={actionId === item._id}>{item.status === 'published' ? t('unpublish') : t('publish')}</Boton>}
              <Boton chico variante="secundario" onClick={() => runAction(item, 'duplicate')} cargando={actionId === item._id} disabled={activeCount >= data.limit}>{t('duplicate')}</Boton>
              <Boton chico variante="secundario" onClick={() => runAction(item, item.status === 'archived' ? 'restore' : 'archive')} cargando={actionId === item._id} disabled={item.status === 'archived' && activeCount >= data.limit}>{item.status === 'archived' ? t('restore') : t('archive')}</Boton>
            </>}
            {!canEdit && data.canArchive && item.status !== 'archived' && <Boton chico variante="secundario" onClick={() => runAction(item, 'archive')} cargando={actionId === item._id}>{t('archive')}</Boton>}
          </div>
        </Tarjeta>)}
      </div>
    </>}
  </div>;
}
