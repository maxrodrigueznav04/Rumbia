import { useState } from 'react';
import { clientsApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import useDebounce from '../hooks/useDebounce.js';
import { Aviso, Boton, Campo, ErrorCarga } from './ui.jsx';

export default function ClienteDelViaje({ value, onChange }) {
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
  return <section className="cliente-del-viaje pila-sm" aria-label="Cliente de la propuesta">
    <strong>Cliente de la propuesta</strong>
    {value.id ? <div className="fila-entre"><span>{value.nombre} · {value.contacto || 'Sin contacto'}</span><Boton type="button" chico variante="secundario" onClick={() => onChange({ id: '', nombre: '', contacto: '' })}>Cambiar cliente</Boton></div> : <>
      <Campo label="Buscar cliente existente" type="search" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPage(1); }} placeholder="Nombre, teléfono o correo" />
      {req.error && <ErrorCarga error={req.error} onReintentar={req.recargar} />}
      {!req.cargando && req.data?.clientes?.length > 0 && <Campo label="Seleccionar cliente"><select value="" onChange={(e) => { const c = req.data.clientes.find((item) => item._id === e.target.value); if (c) elegir(c); }}>
        <option value="">Elige de tu cartera</option>{req.data.clientes.map((c) => <option key={c._id} value={c._id}>{c.nombre} · {c.telefono || c.email || 'Sin contacto'}</option>)}
      </select></Campo>}
      {!req.cargando && !req.error && req.data?.clientes?.length === 0 && <p className="tenue">{q ? 'No hay coincidencias. Puedes registrar al cliente aquí.' : 'Tu cartera está vacía. Registra tu primer cliente aquí.'}</p>}
      {req.data?.pagination?.pages > 1 && <div className="fila"><Boton type="button" chico variante="secundario" disabled={page <= 1 || req.cargando} onClick={() => setPage(page - 1)}>Anterior</Boton><span>Página {page} de {req.data.pagination.pages}</span><Boton type="button" chico variante="secundario" disabled={page >= req.data.pagination.pages || req.cargando} onClick={() => setPage(page + 1)}>Siguiente</Boton></div>}
      <div className="campos-2">
        <Campo label="Nombre del cliente o familia" maxLength={120} value={value.nombre} onChange={(e) => onChange({ ...value, nombre: e.target.value })} />
        <Campo label="Teléfono o correo" maxLength={254} value={value.contacto} onChange={(e) => onChange({ ...value, contacto: e.target.value })} />
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div><Boton type="button" variante="secundario" chico cargando={guardando} disabled={value.nombre.trim().length < 2} onClick={registrar}>Guardar cliente en la cartera</Boton></div>
      <p className="campo-ayuda">También puedes continuar con estos datos solo para este viaje.</p>
    </>}
  </section>;
}
