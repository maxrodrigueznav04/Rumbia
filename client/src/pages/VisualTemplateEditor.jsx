import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { visualTemplatesApi, visualAssetsApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Aviso, Boton, Campo, ErrorCarga, Esqueleto } from '../components/ui.jsx';
import './visualTemplateEditor.css';

const FIELDS = ['trip.title', 'trip.destination', 'trip.dates', 'trip.travelers', 'agency.name', 'agency.contact', 'proposal.price'];
const sample = {
  'trip.title': 'Del Pacífico a la magia',
  'trip.destination': 'San Diego y Anaheim',
  'trip.dates': '15—22 octubre 2026',
  'trip.travelers': '2 viajeros',
  'agency.name': 'Tu agencia',
  'agency.contact': 'Tu información de contacto',
  'proposal.price': '$41,158.80 MXN por persona',
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clone = (value) => structuredClone(value);
const newId = () => `e_${crypto.randomUUID().slice(0, 12)}`;

function CanvasElement({ element, selected, onPointerDown, onKeyDown, assetUrl, pageKind, theme, t }) {
  const { x, y, width, height, style = {} } = element;
  const content = element.type === 'field'
    ? sample[element.field] || t(`editor.fields.${element.field}`)
    : element.text || '';
  return <div
    role="button" tabIndex={0}
    aria-label={`${t('editor.element')}: ${content || element.type}`}
    className={`visual-element${selected ? ' selected' : ''}`}
    style={{
      left: `${x / 10}%`, top: `${y / 10}%`, width: `${width / 10}%`, height: `${height / 10}%`,
      color: style.color || '#172b48', background: ['shape', 'highlights'].includes(element.type) ? (style.background || '#f4eee5') : undefined,
      fontSize: `${((style.fontSize || 18) / 595) * 100}cqw`,
      fontFamily: (style.fontSize || 0) >= 25
        ? (theme.headingFont === 'modern' ? 'Arial, sans-serif' : 'Georgia, serif')
        : (theme.bodyFont === 'classic' ? 'Georgia, serif' : 'Arial, sans-serif'),
      fontWeight: style.weight || 'normal', textAlign: style.align || 'left',
    }}
    onPointerDown={(event) => onPointerDown(event, element.id, 'move')}
    onKeyDown={(event) => onKeyDown(event, element.id)}
  >
    {element.type === 'image' ? <img src={assetUrl} alt="" className="visual-element-image" style={{ filter: pageKind === 'cover' ? 'brightness(.58)' : undefined }} /> : element.type === 'artwork' ? <><img src={assetUrl || `/api/visual-templates/art/${element.artId}`} alt="" className="visual-element-image" />{style.overlay && <span className="visual-art-shade" />}</> : element.type === 'highlights' ? <div className={`visual-highlights${style.layout === 'stack' ? ' stack' : ''}`}><div><small>16 OCT</small><b>La Jolla Cove</b></div><div><small>18 OCT</small><b>Coronado</b></div><div><small>21 OCT</small><b>Galaxy’s Edge</b></div></div> : element.type !== 'shape' && content}
    {selected && <span className="visual-resize" aria-hidden="true" onPointerDown={(event) => onPointerDown(event, element.id, 'resize')} />}
  </div>;
}

export default function VisualTemplateEditor() {
  const { t } = useTranslation('visualTemplates');
  const { id } = useParams();
  const { user } = useAuth();
  const { data, cargando, error, recargar } = useFetch(({ signal }) => visualTemplatesApi.get(id, { signal }), [id]);
  const assetsReq = useFetch(({ signal }) => visualAssetsApi.list({ signal }), []);
  const [template, setTemplate] = useState(null);
  const [name, setName] = useState('');
  const [history, setHistory] = useState({ past: [], present: null, future: [] });
  const [pageId, setPageId] = useState('cover');
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [assetError, setAssetError] = useState('');
  const [file, setFile] = useState(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [origin, setOrigin] = useState('own');
  const [licenseRef, setLicenseRef] = useState('');
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const present = history.present;
  const pageIndex = present?.pages.findIndex((page) => page.id === pageId) ?? -1;
  const page = pageIndex >= 0 ? present.pages[pageIndex] : null;
  const assets = assetsReq.data?.assets || [];
  const assetUrls = Object.fromEntries(assets.map((asset) => [asset._id, asset.url]));
  const element = page?.elements.find((item) => item.id === selectedId);
  const canEdit = Boolean(data?.canEdit && user?.agency && String(user.agency.owner) === String(user._id) && template?.status !== 'archived');
  const dirty = Boolean(template && present && (name !== template.name || JSON.stringify(present) !== JSON.stringify(template.design)));

  useEffect(() => {
    if (!data?.template) return;
    setTemplate(data.template);
    setName(data.template.name);
    setHistory({ past: [], present: clone(data.template.design), future: [] });
    setPageId(data.template.design.pages[0]?.id || 'cover');
    setSelectedId(null);
  }, [data]);

  const commit = useCallback((change) => {
    setHistory((current) => {
      if (!current.present) return current;
      const next = clone(current.present);
      change(next);
      return { past: [...current.past.slice(-49), current.present], present: next, future: [] };
    });
    setSaved(false);
  }, []);

  const updatePage = (key, value) => commit((next) => { next.pages[pageIndex][key] = value; });
  const updateElement = (key, value) => commit((next) => {
    const item = next.pages[pageIndex].elements.find((entry) => entry.id === selectedId);
    if (item) item[key] = value;
  });
  const updateStyle = (key, value) => commit((next) => {
    const item = next.pages[pageIndex].elements.find((entry) => entry.id === selectedId);
    if (item) item.style[key] = value;
  });
  const updateItinerary = (key, value) => commit((next) => { next.itinerary[key] = value; });
  const updateTheme = (key, value) => commit((next) => { next.theme[key] = value; });
  const moveLayer = (direction) => commit((next) => {
    const items = next.pages[pageIndex].elements;
    const from = items.findIndex((item) => item.id === selectedId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= items.length) return;
    [items[from], items[to]] = [items[to], items[from]];
  });
  const alignElement = (axis) => commit((next) => {
    const item = next.pages[pageIndex].elements.find((entry) => entry.id === selectedId);
    if (!item) return;
    if (axis === 'left') item.x = 0;
    if (axis === 'center') item.x = Math.round((1000 - item.width) / 2);
    if (axis === 'right') item.x = 1000 - item.width;
    if (axis === 'top') item.y = 0;
    if (axis === 'middle') item.y = Math.round((1000 - item.height) / 2);
    if (axis === 'bottom') item.y = 1000 - item.height;
  });
  const onElementKeyDown = (event, elementId) => {
    if (!canEdit) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(elementId); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    setSelectedId(elementId);
    const step = event.shiftKey ? 10 : 1;
    commit((next) => {
      const item = next.pages[pageIndex].elements.find((entry) => entry.id === elementId);
      if (!item) return;
      if (event.key === 'ArrowLeft') item.x = clamp(item.x - step, 0, 1000 - item.width);
      if (event.key === 'ArrowRight') item.x = clamp(item.x + step, 0, 1000 - item.width);
      if (event.key === 'ArrowUp') item.y = clamp(item.y - step, 0, 1000 - item.height);
      if (event.key === 'ArrowDown') item.y = clamp(item.y + step, 0, 1000 - item.height);
    });
  };

  const onPointerDown = (event, elementId, mode) => {
    if (!canEdit || !canvasRef.current || !present) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(elementId);
    const item = page.elements.find((entry) => entry.id === elementId);
    dragRef.current = {
      base: present, pageIndex, elementId, mode,
      startX: event.clientX, startY: event.clientY,
      rect: canvasRef.current.getBoundingClientRect(),
      x: item.x, y: item.y, width: item.width, height: item.height,
    };
  };

  useEffect(() => {
    const move = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = ((event.clientX - drag.startX) / drag.rect.width) * 1000;
      const dy = ((event.clientY - drag.startY) / drag.rect.height) * 1000;
      const next = clone(drag.base);
      const item = next.pages[drag.pageIndex].elements.find((entry) => entry.id === drag.elementId);
      if (!item) return;
      if (drag.mode === 'resize') {
        item.width = Math.round(clamp(drag.width + dx, 10, 1000 - drag.x));
        item.height = Math.round(clamp(drag.height + dy, 10, 1000 - drag.y));
      } else {
        item.x = Math.round(clamp(drag.x + dx, 0, 1000 - drag.width));
        item.y = Math.round(clamp(drag.y + dy, 0, 1000 - drag.height));
      }
      setHistory((current) => ({ ...current, present: next }));
    };
    const end = () => {
      const drag = dragRef.current;
      if (!drag) return;
      setHistory((current) => ({ past: [...current.past.slice(-49), drag.base], present: current.present, future: [] }));
      dragRef.current = null;
      setSaved(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
  }, []);

  const addElement = (type) => {
    const id = newId();
    commit((next) => next.pages[pageIndex].elements.push({
      id, type, ...(type === 'field' ? { field: 'trip.title' } : ['text', 'shape'].includes(type) ? { text: type === 'text' ? 'Tu texto aquí' : '' } : {}),
      x: 100, y: 430, width: type === 'highlights' ? 800 : 500, height: type === 'highlights' ? 260 : 80,
      style: ['shape', 'highlights'].includes(type) ? { background: type === 'highlights' ? next.theme.ink : '#f4eee5', color: '#ffffff' } : { color: next.theme.ink, fontSize: 22 },
    }));
    setSelectedId(id);
  };

  const addImage = (assetId) => {
    const artwork = page.kind === 'cover' ? page.elements.find((item) => item.type === 'artwork') : null;
    if (artwork) {
      commit((next) => { next.pages[pageIndex].elements.find((item) => item.id === artwork.id).assetId = assetId; });
      setSelectedId(artwork.id);
      return;
    }
    const id = newId();
    commit((next) => {
      const target = next.pages[pageIndex];
      target.elements.unshift({
        id, type: 'image', assetId,
        x: target.kind === 'cover' ? 0 : 100,
        y: target.kind === 'cover' ? 0 : 430,
        width: target.kind === 'cover' ? 1000 : 800,
        height: target.kind === 'cover' ? 1000 : 350,
        style: {},
      });
    });
    setSelectedId(id);
  };

  const uploadImage = async (event) => {
    event.preventDefault();
    if (!file || !rightsConfirmed) return;
    const formElement = event.currentTarget;
    setUploading(true);
    setAssetError('');
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('origin', origin);
      form.append('licenseRef', licenseRef.trim());
      form.append('rightsConfirmed', 'true');
      const result = await visualAssetsApi.upload(form);
      await assetsReq.recargar();
      addImage(result.asset._id);
      setFile(null);
      setRightsConfirmed(false);
      setLicenseRef('');
      formElement.reset();
    } catch (err) {
      setAssetError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const addPage = () => {
    if (present.pages.length >= 5) return;
    const id = newId();
    commit((next) => next.pages.push({ id, label: t('editor.addPage'), kind: 'narrative', background: '#ffffff', elements: [] }));
    setPageId(id);
    setSelectedId(null);
  };

  const undo = () => setHistory((current) => current.past.length ? {
    past: current.past.slice(0, -1), present: current.past.at(-1), future: [current.present, ...current.future],
  } : current);
  const redo = () => setHistory((current) => current.future.length ? {
    past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1),
  } : current);

  const save = async () => {
    if (!dirty || !canEdit) return;
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const result = await visualTemplatesApi.update(id, { name: name.trim(), design: present, revision: template.revision });
      setTemplate(result.template);
      setSaved(true);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (cargando && !template) return <Esqueleto alto={500} />;
  if (error) return <ErrorCarga error={error} onReintentar={recargar} />;
  if (!present || !page) return null;

  return <div className="pila visual-editor">
    <Link to="/plantillas-visuales" className="volver">{t('editor.back')}</Link>
    <header className="visual-editor-header">
      <div><h1>{name}</h1><p className="suave">{t(`status.${template.status}`)} · {t('revision', { number: template.revision })}</p></div>
    </header>
    {saveError && <Aviso tipo="error">{saveError}</Aviso>}
    {saved && <Aviso tipo="exito">{t('editor.saved')}</Aviso>}
    <div className="visual-editor-layout">
      <aside className="visual-editor-tools">
        <Campo label={t('name')} value={name} maxLength={80} disabled={!canEdit} onChange={(event) => setName(event.target.value)} />
        <details className="visual-advanced"><summary>{t('editor.advanced')}</summary>
        <p className="suave" style={{ fontSize: '.85rem' }}>{t('editor.imageOptional')}</p>
        {canEdit && <div className="visual-assets">
          <strong>{t('editor.images')}</strong>
          {assetError && <Aviso tipo="error">{assetError}</Aviso>}
          {assetsReq.error && <Aviso tipo="error">{assetsReq.error.message}</Aviso>}
          <div className="visual-asset-list">{assets.map((asset) => <button type="button" key={asset._id} onClick={() => addImage(asset._id)} disabled={page.elements.length >= 50} title={t('editor.insertImage')}><img src={asset.url} alt="" /></button>)}</div>
          <form onSubmit={uploadImage} className="visual-upload-form">
            <Campo label={t('editor.uploadImage')} type="file" accept="image/png,image/jpeg" required onChange={(event) => setFile(event.target.files?.[0] || null)} />
            <Campo label={t('editor.imageOrigin')}><select value={origin} onChange={(event) => setOrigin(event.target.value)}><option value="own">{t('editor.ownImage')}</option><option value="licensed">{t('editor.licensedImage')}</option></select></Campo>
            {origin === 'licensed' && <Campo label={t('editor.licenseRef')} value={licenseRef} maxLength={300} required onChange={(event) => setLicenseRef(event.target.value)} />}
            <label className="visual-rights"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /> {t('editor.rights')}</label>
            <Boton chico type="submit" variante="secundario" cargando={uploading} disabled={!file || !rightsConfirmed || page.elements.length >= 50}>{t('editor.uploadAndInsert')}</Boton>
          </form>
        </div>}
        <fieldset className="visual-itinerary-settings"><legend>{t('editor.itinerary')}</legend>
          <Campo label={t('editor.itineraryHeading')} value={present.itinerary.heading || 'El viaje, día a día'} maxLength={80} disabled={!canEdit} onChange={(event) => updateItinerary('heading', event.target.value)} />
          <Campo label={t('editor.accent')} type="color" value={present.itinerary.accent} disabled={!canEdit} onChange={(event) => updateItinerary('accent', event.target.value)} />
          {[['headingFontSize', 18, 40], ['dayFontSize', 12, 28], ['bodyFontSize', 7, 14]].map(([key, min, max]) => <Campo key={key} label={t(`editor.${key}`)} type="number" min={min} max={max} value={present.itinerary[key] || (key === 'headingFontSize' ? 30 : key === 'dayFontSize' ? 18 : 8)} disabled={!canEdit} onChange={(event) => updateItinerary(key, clamp(Number(event.target.value) || min, min, max))} />)}
          <label><input type="checkbox" checked={present.itinerary.showTimes} disabled={!canEdit} onChange={(event) => updateItinerary('showTimes', event.target.checked)} /> {t('editor.showTimes')}</label>
          <label><input type="checkbox" checked={present.itinerary.showDescriptions} disabled={!canEdit} onChange={(event) => updateItinerary('showDescriptions', event.target.checked)} /> {t('editor.showDescriptions')}</label>
        </fieldset>
        <fieldset className="visual-itinerary-settings"><legend>{t('editor.typography')}</legend>
          <Campo label={t('editor.headingFont')}><select value={present.theme.headingFont} disabled={!canEdit} onChange={(event) => updateTheme('headingFont', event.target.value)}><option value="editorial">Editorial</option><option value="modern">Moderna</option><option value="classic">Clásica</option></select></Campo>
          <Campo label={t('editor.bodyFont')}><select value={present.theme.bodyFont} disabled={!canEdit} onChange={(event) => updateTheme('bodyFont', event.target.value)}><option value="modern">Moderna</option><option value="classic">Clásica</option></select></Campo>
        </fieldset>
        </details>
      </aside>
      <div className="visual-canvas-column">
        <div className="visual-editor-toolbar">
          <div className="visual-pages" aria-label={t('editor.pageOptions')}>
            {present.pages.map((item) => <button type="button" key={item.id} className={item.id === pageId ? 'active' : ''} onClick={() => { setPageId(item.id); setSelectedId(null); }}>{item.label}</button>)}
            {canEdit && <button type="button" onClick={addPage} disabled={present.pages.length >= 5}>+ {t('editor.addPage')}</button>}
          </div>
          <div className="visual-editor-toolbar-actions">
            <Boton chico variante="secundario" onClick={undo} aria-label={t('editor.undo')} title={t('editor.undo')} disabled={!canEdit || !history.past.length}>↶ <span className="visual-action-label">{t('editor.undo')}</span></Boton>
            <Boton chico variante="secundario" onClick={redo} aria-label={t('editor.redo')} title={t('editor.redo')} disabled={!canEdit || !history.future.length}>↷ <span className="visual-action-label">{t('editor.redo')}</span></Boton>
            <Boton chico onClick={save} cargando={saving} disabled={!canEdit || !dirty || !name.trim()}>{t('editor.save')}</Boton>
          </div>
        </div>
        {canEdit && <details className="visual-quick-add"><summary>+ {t('editor.add')}</summary><div className="visual-tool-buttons">
            <Boton chico variante="secundario" onClick={() => addElement('text')} disabled={page.elements.length >= 50}>{t('editor.addText')}</Boton>
            <Boton chico variante="secundario" onClick={() => addElement('field')} disabled={page.elements.length >= 50}>{t('editor.addField')}</Boton>
            <Boton chico variante="secundario" onClick={() => addElement('shape')} disabled={page.elements.length >= 50}>{t('editor.addShape')}</Boton>
            <Boton chico variante="secundario" onClick={() => addElement('highlights')} disabled={page.elements.length >= 50}>{t('editor.addHighlights')}</Boton>
          </div></details>}
        <div className="visual-canvas-wrap">
        <div ref={canvasRef} className="visual-canvas" style={{ background: page.background }} onPointerDown={() => setSelectedId(null)}>
          {page.elements.map((item) => <CanvasElement key={item.id} element={item} selected={item.id === selectedId} onPointerDown={onPointerDown} onKeyDown={onElementKeyDown} assetUrl={assetUrls[item.assetId]} pageKind={page.kind} theme={present.theme} t={t} />)}
        </div>
        </div>
      </div>
      <aside className="visual-editor-inspector">
        <Campo label={t('editor.pageLabel')} value={page.label} maxLength={60} disabled={!canEdit} onChange={(event) => updatePage('label', event.target.value)} />
        <Campo label={t('editor.background')} type="color" value={page.background} disabled={!canEdit} onChange={(event) => updatePage('background', event.target.value)} />
        {canEdit && page.kind !== 'cover' && <Boton chico variante="peligro-texto" onClick={() => { commit((next) => { next.pages.splice(pageIndex, 1); }); setPageId('cover'); setSelectedId(null); }}>{t('editor.removePage')}</Boton>}
        <hr />
        {element ? <>
          <h3>{t('editor.element')}</h3>
          {element.type === 'text' && <Campo label={t('editor.text')}><textarea value={element.text || ''} maxLength={700} disabled={!canEdit} onChange={(event) => updateElement('text', event.target.value)} /></Campo>}
          {element.type === 'field' && <Campo label={t('editor.field')}><select value={element.field} disabled={!canEdit} onChange={(event) => updateElement('field', event.target.value)}>{FIELDS.map((field) => <option key={field} value={field}>{t(`editor.fields.${field}`)}</option>)}</select></Campo>}
          {['text', 'field'].includes(element.type) && <><Campo label={t('editor.fontSize')} type="number" min="7" max="80" value={element.style.fontSize || 18} disabled={!canEdit} onChange={(event) => updateStyle('fontSize', clamp(Number(event.target.value) || 7, 7, 80))} /><Campo label={t('editor.color')} type="color" value={element.style.color || '#172b48'} disabled={!canEdit} onChange={(event) => updateStyle('color', event.target.value)} /></>}
          {['text', 'field'].includes(element.type) && <>
            <Campo label={t('editor.textAlign')}><select value={element.style.align || 'left'} disabled={!canEdit} onChange={(event) => updateStyle('align', event.target.value)}><option value="left">{t('editor.alignLeft')}</option><option value="center">{t('editor.alignCenter')}</option><option value="right">{t('editor.alignRight')}</option></select></Campo>
            <label><input type="checkbox" checked={element.style.weight === 'bold'} disabled={!canEdit} onChange={(event) => updateStyle('weight', event.target.checked ? 'bold' : 'normal')} /> {t('editor.bold')}</label>
          </>}
          {['shape', 'highlights'].includes(element.type) && <Campo label={t('editor.color')} type="color" value={element.style.background || '#f4eee5'} disabled={!canEdit} onChange={(event) => updateStyle('background', event.target.value)} />}
          {element.type === 'artwork' && element.assetId && canEdit && <Boton chico variante="secundario" onClick={() => commit((next) => { delete next.pages[pageIndex].elements.find((item) => item.id === selectedId).assetId; })}>{t('editor.restoreArtwork')}</Boton>}
          <details className="visual-advanced"><summary>{t('editor.positionLayers')}</summary>
          {canEdit && <><div className="visual-inspector-actions"><Boton chico variante="secundario" onClick={() => moveLayer(-1)} disabled={page.elements[0]?.id === selectedId}>{t('editor.layerBack')}</Boton><Boton chico variante="secundario" onClick={() => moveLayer(1)} disabled={page.elements.at(-1)?.id === selectedId}>{t('editor.layerFront')}</Boton></div><div className="visual-inspector-actions">{['left', 'center', 'right', 'top', 'middle', 'bottom'].map((axis) => <button type="button" key={axis} onClick={() => alignElement(axis)}>{t(`editor.align.${axis}`)}</button>)}</div></>}
          {['x', 'y', 'width', 'height'].map((key) => <Campo key={key} label={t(`editor.${key}`)} type="number" min={key === 'x' || key === 'y' ? 0 : 10} max="1000" value={element[key]} disabled={!canEdit} onChange={(event) => {
            const max = key === 'x' ? 1000 - element.width : key === 'y' ? 1000 - element.height : key === 'width' ? 1000 - element.x : 1000 - element.y;
            updateElement(key, Math.round(clamp(Number(event.target.value) || 0, key === 'x' || key === 'y' ? 0 : 10, max)));
          }} />)}
          </details>
          {canEdit && <Boton chico variante="peligro-texto" onClick={() => { commit((next) => { next.pages[pageIndex].elements = next.pages[pageIndex].elements.filter((item) => item.id !== selectedId); }); setSelectedId(null); }}>{t('editor.removeElement')}</Boton>}
        </> : <p className="suave">{t('editor.noElement')}</p>}
      </aside>
    </div>
  </div>;
}
