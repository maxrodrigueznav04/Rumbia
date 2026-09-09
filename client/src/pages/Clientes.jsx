import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clientsApi, ApiError } from '../api/index.js';
import { useMetaPagina } from '../hooks/useMetaPagina.js';
import { Boton, Campo, Tarjeta, Modal, Aviso, Insignia, Vacio } from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';
import { rangoFechas, formatoMoneda, ETIQUETAS_ESTADO } from '../utils/format.js';

const ORIGENES_COMUNES = ['WhatsApp', 'Instagram', 'Recomendación', 'Página Web', 'Facebook', 'Feria de Viajes', 'Otro'];

export default function Clientes() {
  const { t } = useTranslation('clientes');
  const { t: tDominio } = useTranslation('dominio');
  useMetaPagina({
    titulo: t('meta.titulo'),
    descripcion: t('meta.descripcion'),
    ruta: '/clientes',
  });

  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [etiquetaFiltro, setEtiquetaFiltro] = useState('');

  // Modal Crear / Editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoCliente, setEditandoCliente] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    notas: '',
    origen: '',
    etiquetasStr: '',
  });

  // Modal Ver Detalle / Historial
  const [clienteDetalle, setClienteDetalle] = useState(null);
  const [viajesCliente, setViajesCliente] = useState([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargarClientes = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const params = {};
      if (busqueda.trim()) params.q = busqueda.trim();
      if (etiquetaFiltro) params.etiqueta = etiquetaFiltro;
      const res = await clientsApi.list(params);
      setClientes(res.clientes || []);
    } catch (err) {
      setError(err.message || t('noSePudieronCargar'));
    } finally {
      setCargando(false);
    }
  }, [busqueda, etiquetaFiltro]);

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarClientes();
    }, 250);
    return () => clearTimeout(timer);
  }, [cargarClientes]);

  const abrirCrear = () => {
    setEditandoCliente(null);
    setForm({
      nombre: '',
      email: '',
      telefono: '',
      notas: '',
      origen: 'WhatsApp',
      etiquetasStr: '',
    });
    setFormError(null);
    setModalAbierto(true);
  };

  const abrirEditar = (cliente, e) => {
    e?.stopPropagation();
    setEditandoCliente(cliente);
    setForm({
      nombre: cliente.nombre || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      notas: cliente.notas || '',
      origen: cliente.origen || '',
      etiquetasStr: (cliente.etiquetas || []).join(', '),
    });
    setFormError(null);
    setModalAbierto(true);
  };

  const abrirDetalle = async (cliente) => {
    setClienteDetalle(cliente);
    setCargandoDetalle(true);
    try {
      const res = await clientsApi.get(cliente._id);
      setClienteDetalle(res.cliente);
      setViajesCliente(res.viajes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditandoCliente(null);
    setFormError(null);
  };

  const guardarCliente = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      setFormError(t('modal.nombreObligatorio'));
      return;
    }

    setGuardando(true);
    setFormError(null);

    const payload = {
      nombre: form.nombre.trim(),
      email: form.email.trim(),
      telefono: form.telefono.trim(),
      notas: form.notas.trim(),
      origen: form.origen.trim(),
      etiquetas: form.etiquetasStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      if (editandoCliente) {
        await clientsApi.update(editandoCliente._id, payload);
      } else {
        await clientsApi.create(payload);
      }
      cerrarModal();
      cargarClientes();
      if (clienteDetalle && editandoCliente && clienteDetalle._id === editandoCliente._id) {
        abrirDetalle({ ...clienteDetalle, ...payload });
      }
    } catch (err) {
      setFormError(err.message || t('modal.errorGuardar'));
    } finally {
      setGuardando(false);
    }
  };

  const eliminarCliente = async (cliente, e) => {
    e?.stopPropagation();
    if (!window.confirm(t('confirmarEliminar', { nombre: cliente.nombre }))) {
      return;
    }
    try {
      await clientsApi.remove(cliente._id);
      if (clienteDetalle?._id === cliente._id) {
        setClienteDetalle(null);
      }
      cargarClientes();
    } catch (err) {
      alert(err.message || t('noSePudoEliminar'));
    }
  };

  const crearViajeParaCliente = (cliente, e) => {
    e?.stopPropagation();
    navigate(`/viajes/nuevo?clientId=${cliente._id}&clientName=${encodeURIComponent(cliente.nombre)}&clientContact=${encodeURIComponent(cliente.telefono || cliente.email || '')}`);
  };

  // Extraer todas las etiquetas presentes para los chips de filtro
  const todasEtiquetas = Array.from(
    new Set(clientes.flatMap((c) => c.etiquetas || []))
  );

  return (
    <div className="pagina contenedor">
      {/* Encabezado */}
      <div className="fila-entre" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <span className="etiqueta">{t('gestionComercial')}</span>
          <h1 style={{ margin: '4px 0 6px', fontSize: '2rem' }}>{t('titulo')}</h1>
          <p className="suave" style={{ margin: 0 }}>
            {t('subtitulo')}
          </p>
        </div>
        <Boton onClick={abrirCrear}>
          <Icono nombre="mas" tamano={16} /> {t('nuevoCliente')}
        </Boton>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* Barra de Búsqueda y Filtros */}
      <Tarjeta style={{ marginBottom: 20, padding: '14px 18px' }}>
        <div className="fila" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
            <Campo
              type="search"
              placeholder={t('buscarPlaceholder')}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </div>

          {todasEtiquetas.length > 0 && (
            <div className="fila" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="tenue" style={{ fontSize: '0.82rem' }}>{t('etiquetas')}</span>
              <button
                type="button"
                className={`boton chico ${!etiquetaFiltro ? '' : 'fantasma'}`}
                style={{ padding: '3px 10px', fontSize: '0.8rem' }}
                onClick={() => setEtiquetaFiltro('')}
              >
                {t('todas')}
              </button>
              {todasEtiquetas.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`boton chico ${etiquetaFiltro === tag ? '' : 'fantasma'}`}
                  style={{ padding: '3px 10px', fontSize: '0.8rem' }}
                  onClick={() => setEtiquetaFiltro(etiquetaFiltro === tag ? '' : tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </Tarjeta>

      {/* Lista / Rejilla de Clientes */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
          <p className="suave" style={{ marginTop: 12 }}>{t('cargandoClientes')}</p>
        </div>
      ) : clientes.length === 0 ? (
        <Vacio
          icono="👥"
          titulo={busqueda || etiquetaFiltro ? t('sinResultados') : t('sinClientes')}
          accion={
            <Boton onClick={abrirCrear}>
              <Icono nombre="mas" tamano={16} /> {t('registrarPrimerCliente')}
            </Boton>
          }
        >
          {busqueda || etiquetaFiltro
            ? t('sinResultadosTexto')
            : t('sinClientesTexto')}
        </Vacio>
      ) : (
        <div className="rejilla rejilla-3" style={{ gap: 16 }}>
          {clientes.map((c) => {
            const inicial = (c.nombre || 'C').charAt(0).toUpperCase();
            return (
              <div
                key={c._id}
                onClick={() => abrirDetalle(c)}
                className="tarjeta"
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div>
                  <div className="fila-entre" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
                    <div className="fila" style={{ gap: 10, alignItems: 'center' }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: 'var(--verde-100, #E6F4EA)',
                          color: 'var(--verde-800, #135F49)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                        }}
                      >
                        {inicial}
                      </div>
                      <div>
                        <strong style={{ fontSize: '1.05rem', display: 'block', color: 'var(--texto)' }}>
                          {c.nombre}
                        </strong>
                        {c.origen && (
                          <span className="tenue" style={{ fontSize: '0.78rem' }}>
                            {t('origen', { origen: c.origen })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="fila" style={{ gap: 4 }}>
                      <button
                        type="button"
                        className="boton fantasma chico"
                        style={{ padding: '4px 8px' }}
                        title={t('editarCliente')}
                        onClick={(e) => abrirEditar(c, e)}
                      >
                        <Icono nombre="lapiz" tamano={15} />
                      </button>
                    </div>
                  </div>

                  {/* Datos de contacto */}
                  <div className="pila-sm" style={{ fontSize: '0.85rem', marginBottom: 14 }}>
                    {c.telefono && (
                      <div className="fila" style={{ gap: 6, alignItems: 'center' }}>
                        <span className="tenue">📱</span>
                        <a
                          href={`https://wa.me/${c.telefono.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: 'var(--marca)', fontWeight: 500 }}
                        >
                          {c.telefono}
                        </a>
                      </div>
                    )}
                    {c.email && (
                      <div className="fila" style={{ gap: 6, alignItems: 'center' }}>
                        <span className="tenue">✉️</span>
                        <a
                          href={`mailto:${c.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="suave"
                          style={{ wordBreak: 'break-all' }}
                        >
                          {c.email}
                        </a>
                      </div>
                    )}
                    {c.notas && (
                      <p
                        className="tenue"
                        style={{
                          margin: '6px 0 0',
                          fontSize: '0.82rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {c.notas}
                      </p>
                    )}
                  </div>

                  {/* Etiquetas */}
                  {c.etiquetas && c.etiquetas.length > 0 && (
                    <div className="fila" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                      {c.etiquetas.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 7px',
                            borderRadius: 'var(--radio-xs)',
                            background: 'var(--surface-alt)',
                            color: 'var(--texto-suave)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer de la tarjeta con contador y acción */}
                <div
                  className="fila-entre"
                  style={{
                    paddingTop: 10,
                    borderTop: '1px solid var(--border)',
                    alignItems: 'center',
                    marginTop: 6,
                  }}
                >
                  <span className="tenue" style={{ fontSize: '0.8rem' }}>
                    {c.viajesCount === 1 ? t('propuesta') : t('propuestas', { cantidad: c.viajesCount || 0 })}
                  </span>
                  <button
                    type="button"
                    className="boton secundario chico"
                    style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                    onClick={(e) => crearViajeParaCliente(c, e)}
                    title={t('crearPropuestaTitulo')}
                  >
                    {t('nuevaPropuesta')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar Cliente */}
      <Modal
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        titulo={editandoCliente ? t('modal.editarTitulo') : t('modal.nuevoTitulo')}
      >
        {formError && <Aviso tipo="error">{formError}</Aviso>}

        <form onSubmit={guardarCliente} className="pila" style={{ gap: 14 }}>
          <Campo
            label={t('modal.nombreLabel')}
            placeholder={t('modal.nombrePlaceholder')}
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
            autoFocus
          />

          <div className="rejilla rejilla-2" style={{ gap: 12 }}>
            <Campo
              label={t('modal.telefonoLabel')}
              placeholder={t('modal.telefonoPlaceholder')}
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
            <Campo
              label={t('modal.emailLabel')}
              type="email"
              placeholder={t('modal.emailPlaceholder')}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="campo">
            <label>{t('modal.origenLabel')}</label>
            <div className="fila" style={{ gap: 8, alignItems: 'center' }}>
              <select
                value={ORIGENES_COMUNES.includes(form.origen) ? form.origen : 'Otro'}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm({ ...form, origen: v === 'Otro' ? '' : v });
                }}
                style={{ flex: 1 }}
              >
                {ORIGENES_COMUNES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              {!ORIGENES_COMUNES.slice(0, -1).includes(form.origen) && (
                <input
                  type="text"
                  placeholder={t('modal.origenOtroPlaceholder')}
                  value={form.origen}
                  onChange={(e) => setForm({ ...form, origen: e.target.value })}
                  style={{ flex: 1 }}
                />
              )}
            </div>
          </div>

          <Campo
            label={t('modal.etiquetasLabel')}
            placeholder={t('modal.etiquetasPlaceholder')}
            value={form.etiquetasStr}
            onChange={(e) => setForm({ ...form, etiquetasStr: e.target.value })}
            ayuda={t('modal.etiquetasAyuda')}
          />

          <div className="campo">
            <label>{t('modal.notasLabel')}</label>
            <textarea
              rows="3"
              placeholder={t('modal.notasPlaceholder')}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
            />
          </div>

          <div className="fila-entre" style={{ marginTop: 8, alignItems: 'center' }}>
            {editandoCliente ? (
              <button
                type="button"
                className="boton peligro chico"
                onClick={(e) => eliminarCliente(editandoCliente, e)}
              >
                {t('modal.eliminarCliente')}
              </button>
            ) : <span />}

            <div className="fila" style={{ gap: 8 }}>
              <Boton type="button" variante="secundario" onClick={cerrarModal}>
                {t('modal.cancelar')}
              </Boton>
              <Boton type="submit" cargando={guardando}>
                {editandoCliente ? t('modal.guardarCambios') : t('modal.registrarCliente')}
              </Boton>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Detalle del Cliente + Historial de Viajes */}
      <Modal
        abierto={Boolean(clienteDetalle)}
        onCerrar={() => setClienteDetalle(null)}
        titulo={clienteDetalle?.nombre || t('detalle.tituloPorDefecto')}
        ancho={640}
      >
        {clienteDetalle && (
          <div className="pila" style={{ gap: 18 }}>
            {/* Ficha rápida */}
            <div
              style={{
                background: 'var(--surface-alt)',
                padding: '14px 18px',
                borderRadius: 'var(--radio)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="fila-entre" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div className="fila" style={{ gap: 8, alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{clienteDetalle.nombre}</h3>
                    {clienteDetalle.origen && (
                      <Insignia color="verde">{clienteDetalle.origen}</Insignia>
                    )}
                  </div>
                  <div className="fila" style={{ gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: '0.88rem' }}>
                    {clienteDetalle.telefono && (
                      <a
                        href={`https://wa.me/${clienteDetalle.telefono.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--marca)', fontWeight: 600 }}
                      >
                        📱 {clienteDetalle.telefono}
                      </a>
                    )}
                    {clienteDetalle.email && (
                      <a href={`mailto:${clienteDetalle.email}`} className="suave">
                        ✉️ {clienteDetalle.email}
                      </a>
                    )}
                  </div>
                </div>

                <div className="fila" style={{ gap: 6 }}>
                  <Boton
                    variante="secundario"
                    chico
                    onClick={(e) => abrirEditar(clienteDetalle, e)}
                  >
                    <Icono nombre="lapiz" tamano={14} /> {t('detalle.editar')}
                  </Boton>
                  <Boton
                    chico
                    onClick={(e) => crearViajeParaCliente(clienteDetalle, e)}
                  >
                    {t('detalle.nuevoViaje')}
                  </Boton>
                </div>
              </div>

              {clienteDetalle.notas && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                  <span className="tenue" style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    {t('detalle.notasYPreferencias')}
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--texto-suave)', whiteSpace: 'pre-wrap' }}>
                    {clienteDetalle.notas}
                  </p>
                </div>
              )}
            </div>

            {/* Historial de Propuestas y Viajes */}
            <div>
              <div className="fila-entre" style={{ alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem' }}>
                  {t('detalle.historial', { cantidad: viajesCliente.length })}
                </h4>
                <Link
                  to={`/viajes/nuevo?clientId=${clienteDetalle._id}&clientName=${encodeURIComponent(clienteDetalle.nombre)}`}
                  className="suave"
                  style={{ fontSize: '0.82rem', fontWeight: 600 }}
                >
                  {t('detalle.armarNuevaPropuesta')}
                </Link>
              </div>

              {cargandoDetalle ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <span className="spinner" style={{ width: 24, height: 24 }} />
                </div>
              ) : viajesCliente.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '24px 16px',
                    border: '1.5px dashed var(--border)',
                    borderRadius: 'var(--radio)',
                  }}
                >
                  <p className="suave" style={{ margin: '0 0 10px', fontSize: '0.9rem' }}>
                    {t('detalle.sinViajes')}
                  </p>
                  <Boton chico onClick={(e) => crearViajeParaCliente(clienteDetalle, e)}>
                    {t('detalle.crearPrimeraPropuesta')}
                  </Boton>
                </div>
              ) : (
                <div className="pila" style={{ gap: 10 }}>
                  {viajesCliente.map((v) => {
                    const estadoInfo = ETIQUETAS_ESTADO[v.status] || ETIQUETAS_ESTADO.borrador;
                    const textoEstado = tDominio(`estadoViaje.${v.status}`, { defaultValue: estadoInfo.texto });
                    return (
                      <Link
                        key={v._id}
                        to={`/viajes/${v._id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: 'var(--radio-sm)',
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          textDecoration: 'none',
                          color: 'inherit',
                          transition: 'border-color 0.15s ease',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="fila" style={{ gap: 8, alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--texto)' }}>
                              {v.title || v.destination?.name}
                            </strong>
                            <Insignia color={estadoInfo.color} style={{ fontSize: '0.72rem' }}>
                              {textoEstado}
                            </Insignia>
                          </div>
                          <span className="tenue" style={{ fontSize: '0.8rem', display: 'block', marginTop: 3 }}>
                            {rangoFechas(v.startDate, v.endDate)} · {v.destination?.name}
                          </span>
                        </div>

                        {v.budget?.amount > 0 && (
                          <div style={{ textAlign: 'right', marginLeft: 12 }}>
                            <span className="numero" style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--marca)' }}>
                              {formatoMoneda(v.budget.amount, v.budget.currency)}
                            </span>
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
