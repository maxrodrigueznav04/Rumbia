import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { visualProposalsApi, visualTemplatesApi, visualAssetsApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import { Aviso, Boton, Campo, ErrorCarga, Esqueleto, Tarjeta } from '../components/ui.jsx';

const clone = (value) => structuredClone(value);

export default function VisualProposal() {
  const { id } = useParams();
  const { t } = useTranslation('visualTemplates');
  const proposalReq = useFetch(({ signal }) => visualProposalsApi.get(id, { signal }), [id]);
  const templatesReq = useFetch(({ signal }) => visualTemplatesApi.list({ signal }), []);
  const assetsReq = useFetch(({ signal }) => visualAssetsApi.list({ signal }), []);
  const proposal = proposalReq.data?.proposal;
  const issues = proposalReq.data?.issues || [];
  const published = (templatesReq.data?.templates || []).filter((item) => item.status === 'published');
  const assets = assetsReq.data?.assets || [];
  const [templateId, setTemplateId] = useState('');
  const [design, setDesign] = useState(null);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const dirty = Boolean(proposal && design && JSON.stringify(design) !== JSON.stringify(proposal.design));
  const cover = design?.pages?.find((page) => page.kind === 'cover');
  const intro = design?.pages?.find((page) => page.id === 'intro');
  const coverTitle = cover?.elements.find((item) => item.id === 'title');
  const introHeading = intro?.elements.find((item) => item.id === 'intro-heading');
  const coverArt = cover?.elements.find((item) => item.type === 'artwork');
  const coverImage = coverArt || cover?.elements.find((item) => item.type === 'image');

  useEffect(() => {
    setDesign(proposal ? clone(proposal.design) : null);
    setTemplateId(proposal?.template || '');
    setPreview(null);
  }, [proposal]);

  const select = async () => {
    if (!templateId) return;
    setWorking('select'); setError('');
    try { await visualProposalsApi.select(id, templateId); proposalReq.recargar(); }
    catch (err) { setError(err.message); }
    finally { setWorking(''); }
  };

  const changeDesign = (change) => {
    setDesign((current) => { const next = clone(current); change(next); return next; });
    setPreview(null);
  };

  const changeTitle = (value) => changeDesign((next) => {
    const item = next.pages.find((page) => page.kind === 'cover')?.elements.find((entry) => entry.id === 'title');
    if (!item) return;
    if (value.trim()) { item.type = 'text'; item.text = value; delete item.field; }
    else { item.type = 'field'; item.field = 'trip.title'; delete item.text; }
  });

  const changeMessage = (value) => changeDesign((next) => {
    const item = next.pages.find((page) => page.id === 'intro')?.elements.find((entry) => entry.id === 'intro-heading');
    if (item) item.text = value;
  });

  const changeCoverImage = (assetId) => changeDesign((next) => {
    const page = next.pages.find((item) => item.kind === 'cover');
    if (!page) return;
    const artwork = page.elements.find((item) => item.type === 'artwork');
    if (artwork) {
      if (assetId) artwork.assetId = assetId;
      else delete artwork.assetId;
      return;
    }
    page.elements = page.elements.filter((item) => item.type !== 'image');
    if (assetId) page.elements.unshift({ id: `cover_${crypto.randomUUID().slice(0, 12)}`, type: 'image', assetId, x: 0, y: 0, width: 1000, height: 1000, style: {} });
  });

  const save = async () => {
    setWorking('save'); setError('');
    try { await visualProposalsApi.update(id, { design, revision: proposal.revision }); proposalReq.recargar(); }
    catch (err) { setError(err.message); }
    finally { setWorking(''); }
  };

  const showPreview = async () => {
    setWorking('preview'); setError('');
    try { setPreview(await visualProposalsApi.preview(id)); }
    catch (err) { setError(err.message); }
    finally { setWorking(''); }
  };

  const issue = async () => {
    setWorking('issue'); setError('');
    try { await visualProposalsApi.issue(id, proposal.revision, preview.previewHash); proposalReq.recargar(); }
    catch (err) { setError(err.message); }
    finally { setWorking(''); }
  };

  if (proposalReq.cargando && !proposalReq.data) return <Esqueleto alto={330} />;
  if (proposalReq.error) return <ErrorCarga error={proposalReq.error} onReintentar={proposalReq.recargar} />;

  return <div className="pila">
    <Link className="volver" to={`/viajes/${id}/itinerario`}>{t('proposal.back')}</Link>
    <div><h1>{t('proposal.title')}</h1><p className="suave">{t('proposal.subtitle')}</p></div>
    {error && <Aviso tipo="error">{error}</Aviso>}
    {templatesReq.error && <ErrorCarga error={templatesReq.error} onReintentar={templatesReq.recargar} />}
    <Tarjeta titulo={t('proposal.chooseTemplate')}>
      {!published.length && <p className="suave">{t('proposal.noPublished')} <Link to="/plantillas-visuales">{t('title')}</Link>.</p>}
      {!!published.length && <div className="fila" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <div style={{ flex: '1 1 260px' }}><Campo label={t('proposal.template')}><select value={templateId} onChange={(event) => setTemplateId(event.target.value)}><option value="">{t('proposal.selectOne')}</option>{published.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Campo></div>
        <Boton onClick={select} cargando={working === 'select'} disabled={!templateId || Boolean(working)}>{proposal ? t('proposal.changeTemplate') : t('proposal.useTemplate')}</Boton>
      </div>}
    </Tarjeta>
    {proposal && design && <>
      <Tarjeta titulo={t('proposal.adjustThisTrip')}>
        <p className="suave">{t('proposal.masterSafe')}</p>
        <div className="rejilla rejilla-2">
          {coverTitle && <Campo label={t('proposal.coverTitle')} ayuda={t('proposal.coverTitleHint')} value={coverTitle.type === 'text' ? coverTitle.text || '' : ''} maxLength={140} onChange={(event) => changeTitle(event.target.value)} />}
          {introHeading && <Campo label={t('proposal.introMessage')} value={introHeading.text || ''} maxLength={140} onChange={(event) => changeMessage(event.target.value)} />}
          {cover && <Campo label={t('proposal.coverImage')}><select value={coverImage?.assetId || ''} onChange={(event) => changeCoverImage(event.target.value)}><option value="">{t(coverArt ? 'proposal.includedArt' : 'proposal.noImage')}</option>{assets.map((asset, index) => <option key={asset._id} value={asset._id}>{t('proposal.imageNumber', { number: index + 1 })}</option>)}</select></Campo>}
        </div>
        {assetsReq.error && <Aviso tipo="error">{assetsReq.error.message}</Aviso>}
        <div className="fila" style={{ gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <Boton onClick={save} cargando={working === 'save'} disabled={!dirty || Boolean(working)}>{t('editor.save')}</Boton>
          <Boton variante="secundario" onClick={showPreview} cargando={working === 'preview'} disabled={dirty || Boolean(working)}>{t('proposal.preview')}</Boton>
          <Boton variante="secundario" onClick={issue} cargando={working === 'issue'} disabled={dirty || !preview || preview.proposalRevision !== proposal.revision || Boolean(working)}>{t('proposal.issuePdf')}</Boton>
        </div>
      </Tarjeta>
      {preview && <Tarjeta titulo={t('proposal.preview')}><iframe title={t('proposal.preview')} srcDoc={preview.html} sandbox="" style={{ width: '100%', height: 730, border: '1px solid var(--border)', background: '#fff' }} /></Tarjeta>}
      {!!issues.length && <Tarjeta titulo={t('proposal.issued')}><div className="pila-sm">{issues.map((item) => <a key={item._id} className="boton secundario" href={visualProposalsApi.pdfUrl(id, item._id)} style={{ width: 'fit-content' }}>{t('proposal.downloadVersion', { number: item.sequence })}</a>)}</div></Tarjeta>}
    </>}
  </div>;
}
