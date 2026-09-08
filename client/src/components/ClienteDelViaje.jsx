import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clientsApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import useDebounce from '../hooks/useDebounce.js';
import { Aviso, Boton, Campo, ErrorCarga } from './ui.jsx';

export default function ClienteDelViaje({ value, onChange }) {
  const { t } = useTranslation('viaje');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(busqueda, 300);
  const req = useFetch(({ signal }) => clientsApi.list({ q, page, limit: 20 }, { signal }), [q, page]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const elegir = (cliente) => onChange({ id: cliente._id, nombre: cliente.nombre, contacto: cliente.telefono || cliente.email || '' });
  const registrar = async () => {
    setGuardando(true); setError(null);
    try {
      const contacto = value.contacto.trim();
      const { cliente } = await clientsApi.create({ nombre: value.nombre.trim(), ...(contacto.includes('@') ? { email: contacto } : { telefono: contacto }) });
      elegir(cliente); req.recargar();
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };
  return <section className="cliente-del-viaje pila-sm" aria-label={t('clienteDelViaje.titulo')}>
    <strong>{t('clienteDelViaje.titulo')}</strong>
    {value.id ? <div className="fila-entre"><span>{value.nombre} · {value.contacto || t('clienteDelViaje.sinContacto')}</span><Boton type="button" chico variante="secundario" onClick={() => onChange({ id: '', nombre: '', contacto: '' })}>{t('clienteDelViaje.cambiarCliente')}</Boton></div> : <>
      <Campo label={t('clienteDelViaje.buscarCliente')} type="search" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPage(1); }} placeholder={t('clienteDelViaje.buscarPlaceholder')} />
      {req.error && <ErrorCarga error={req.error} onReintentar={req.recargar} />}
      {!req.cargando && req.data?.clientes?.length > 0 && <Campo label={t('clienteDelViaje.seleccionarCliente')}><select value="" onChange={(e) => { const c = req.data.clientes.find((item) => item._id === e.target.value); if (c) elegir(c); }}>
        <option value="">{t('clienteDelViaje.elegeDeTuCartera')}</option>{req.data.clientes.map((c) => <option key={c._id} value={c._id}>{c.nombre} · {c.telefono || c.email || t('clienteDelViaje.sinContacto')}</option>)}
      </select></Campo>}
      {!req.cargando && !req.error && req.data?.clientes?.length === 0 && <p className="tenue">{q ? t('clienteDelViaje.sinCoincidencias') : t('clienteDelViaje.carteraVacia')}</p>}
      {req.data?.pagination?.pages > 1 && <div className="fila"><Boton type="button" chico variante="secundario" disabled={page <= 1 || req.cargando} onClick={() => setPage(page - 1)}>{t('clienteDelViaje.anterior')}</Boton><span>{t('clienteDelViaje.paginaDe', { pagina: page, total: req.data.pagination.pages })}</span><Boton type="button" chico variante="secundario" disabled={page >= req.data.pagination.pages || req.cargando} onClick={() => setPage(page + 1)}>{t('clienteDelViaje.siguiente')}</Boton></div>}
      <div className="campos-2">
        <Campo label={t('clienteDelViaje.nombreDelCliente')} maxLength={120} value={value.nombre} onChange={(e) => onChange({ ...value, nombre: e.target.value })} />
        <Campo label={t('clienteDelViaje.telefonoOCorreo')} maxLength={254} value={value.contacto} onChange={(e) => onChange({ ...value, contacto: e.target.value })} />
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div><Boton type="button" variante="secundario" chico cargando={guardando} disabled={value.nombre.trim().length < 2} onClick={registrar}>{t('clienteDelViaje.guardarCliente')}</Boton></div>
      <p className="campo-ayuda">{t('clienteDelViaje.continuarSoloEsteViaje')}</p>
    </>}
  </section>;
}
