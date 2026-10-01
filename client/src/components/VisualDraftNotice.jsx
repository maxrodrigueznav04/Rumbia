import { useTranslation } from 'react-i18next';
import { Aviso, Boton } from './ui.jsx';

export default function VisualDraftNotice({ backup, onRecover, canRecover = true }) {
  const { t } = useTranslation('visualTemplates');
  return <>
    {backup.storageUnavailable && <Aviso tipo="info">{t('draft.unavailable')}</Aviso>}
    {backup.draft && <Aviso tipo="info">
      <p>{t(backup.stale ? 'draft.stale' : 'draft.found')}</p>
      <div className="fila" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Boton chico onClick={onRecover} disabled={!canRecover}>{t('draft.recover')}</Boton>
        <Boton chico variante="secundario" onClick={backup.discard}>{t('draft.discard')}</Boton>
      </div>
    </Aviso>}
  </>;
}
