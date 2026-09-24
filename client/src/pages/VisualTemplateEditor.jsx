import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { visualTemplatesApi } from '../api/index.js';
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

function CanvasElement({ element, selected, onPointerDown, t }) {
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
      color: style.color || '#172b48', background: element.type === 'shape' ? (style.background || '#f4eee5') : undefined,
      fontSize: `${((style.fontSize || 18) / 595) * 100}cqw`,
      fontFamily: (style.fontSize || 0) >= 25 ? 'Georgia, serif' : 'Arial, sans-serif',
      fontWeight: style.weight || 'normal', textAlign: style.align || 'left',
    }}
    onPointerDown={(event) => onPointerDown(event, element.id, 'move')}
    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') event.preventDefault(); }}
  >
    {element.type !== 'shape' && content}
    {selected && <span className="visual-resize" aria-hidden="true" onPointerDown={(event) => onPointerDown(event, element.id, 'resize')} />}
  </div>;
}

export default function VisualTemplateEditor() {
  const { t } = useTranslation('visualTemplates');
  const { id } = useParams();
  const { user } = useAuth();
  const { data, cargando, error, recargar } = useFetch(({ signal }) => visualTemplatesApi.get(id, { signal }), [id]);
  const [template, setTemplate] = useState(null);
  const [name, setName] = useState('');
  const [history, setHistory] = useState({ past: [], present: null, future: [] });
  const [pageId, setPageId] = useState('cover');
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const present = history.present;
  const pageIndex = present?.pages.findIndex((page) => page.id === pageId) ?? -1;
  const page = pageIndex >= 0 ? present.pages[pageIndex] : null;
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
      id, type, ...(type === 'field' ? { field: 'trip.title' } : { text: type === 'text' ? 'Tu texto aquí' : '' }),
      x: 100, y: 430, width: 500, height: 80,
      style: type === 'shape' ? { background: '#f4eee5' } : { color: next.theme.ink, fontSize: 22 },
    }));
    setSelectedId(id);
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
      <div className="fila" style={{ gap: 8 }}>
        <Boton variante="secundario" onClick={undo} disabled={!canEdit || !history.past.length}>{t('editor.undo')}</Boton>
        <Boton variante="secundario" onClick={redo} disabled={!canEdit || !history.future.length}>{t('editor.redo')}</Boton>
        <Boton onClick={save} cargando={saving} disabled={!canEdit || !dirty || !name.trim()}>{t('editor.save')}</Boton>
      </div>
    </header>
    <Aviso tipo="info">{t('editor.draftNotice')}</Aviso>
    {saveError && <Aviso tipo="error">{saveError}</Aviso>}
    {saved && <Aviso tipo="exito">{t('editor.saved')}</Aviso>}
    <div className="visual-editor-layout">
      <aside className="visual-editor-tools">
        <Campo label={t('name')} value={name} maxLength={80} disabled={!canEdit} onChange={(event) => setName(event.target.value)} />
        <div className="visual-pages">
          {present.pages.map((item) => <button type="button" key={item.id} className={item.id === pageId ? 'active' : ''} onClick={() => { setPageId(item.id); setSelectedId(null); }}>{item.label}</button>)}
        </div>
        {canEdit && <div className="visual-tool-buttons">
          <Boton chico variante="secundario" onClick={() => addElement('text')} disabled={page.elements.length >= 50}>{t('editor.addText')}</Boton>
          <Boton chico variante="secundario" onClick={() => addElement('field')} disabled={page.elements.length >= 50}>{t('editor.addField')}</Boton>
          <Boton chico variante="secundario" onClick={() => addElement('shape')} disabled={page.elements.length >= 50}>{t('editor.addShape')}</Boton>
          <Boton chico variante="secundario" onClick={addPage} disabled={present.pages.length >= 5}>{t('editor.addPage')}</Boton>
        </div>}
        <p className="suave" style={{ fontSize: '.85rem' }}>{t('editor.imageOptional')}</p>
        <fieldset className="visual-itinerary-settings"><legend>{t('editor.itinerary')}</legend>
          <label><input type="checkbox" checked={present.itinerary.showTimes} disabled={!canEdit} onChange={(event) => commit((next) => { next.itinerary.showTimes = event.target.checked; })} /> {t('editor.showTimes')}</label>
          <label><input type="checkbox" checked={present.itinerary.showDescriptions} disabled={!canEdit} onChange={(event) => commit((next) => { next.itinerary.showDescriptions = event.target.checked; })} /> {t('editor.showDescriptions')}</label>
        </fieldset>
      </aside>
      <div className="visual-canvas-wrap">
        <div ref={canvasRef} className="visual-canvas" style={{ background: page.background }} onPointerDown={() => setSelectedId(null)}>
          {page.elements.map((item) => <CanvasElement key={item.id} element={item} selected={item.id === selectedId} onPointerDown={onPointerDown} t={t} />)}
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
          {element.type !== 'shape' && <><Campo label={t('editor.fontSize')} type="number" min="7" max="80" value={element.style.fontSize || 18} disabled={!canEdit} onChange={(event) => updateStyle('fontSize', clamp(Number(event.target.value) || 7, 7, 80))} /><Campo label={t('editor.color')} type="color" value={element.style.color || '#172b48'} disabled={!canEdit} onChange={(event) => updateStyle('color', event.target.value)} /></>}
          {element.type === 'shape' && <Campo label={t('editor.color')} type="color" value={element.style.background || '#f4eee5'} disabled={!canEdit} onChange={(event) => updateStyle('background', event.target.value)} />}
          {['x', 'y', 'width', 'height'].map((key) => <Campo key={key} label={t(`editor.${key}`)} type="number" min={key === 'x' || key === 'y' ? 0 : 10} max="1000" value={element[key]} disabled={!canEdit} onChange={(event) => {
            const max = key === 'x' ? 1000 - element.width : key === 'y' ? 1000 - element.height : key === 'width' ? 1000 - element.x : 1000 - element.y;
            updateElement(key, Math.round(clamp(Number(event.target.value) || 0, key === 'x' || key === 'y' ? 0 : 10, max)));
          }} />)}
          {canEdit && <Boton chico variante="peligro-texto" onClick={() => { commit((next) => { next.pages[pageIndex].elements = next.pages[pageIndex].elements.filter((item) => item.id !== selectedId); }); setSelectedId(null); }}>{t('editor.removeElement')}</Boton>}
        </> : <p className="suave">{t('editor.noElement')}</p>}
      </aside>
    </div>
  </div>;
}
