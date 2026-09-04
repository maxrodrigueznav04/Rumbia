import { useState } from 'react';
import { expensesApi } from '../api/index.js';
import FormGasto from './formularios/FormGasto.jsx';
import { Boton, Tarjeta, Vacio, ModalConfirmar, Insignia, Aviso } from './ui.jsx';
import { formatoMoneda, formatoFechaCorta, humanizar } from '../utils/format.js';

const ICONOS = {
  comida: '🍽️',
  actividades: '🎟️',
  compras: '🛍️',
  transporte: '✈️',
  hospedaje: '🏨',
  'transporte-local': '🚕',
  otros: '📌',
};

export default function ListaGastos({ viaje, gastos = [], onCambio }) {
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [porEliminar, setPorEliminar] = useState(null);
  const [error, setError] = useState(null);
  const moneda = viaje.budget?.currency || 'MXN';

  const abrirNuevo = () => {
    setEditando(null);
    setFormAbierto(true);
  };

  const abrirEdicion = (gasto) => {
    setEditando(gasto);
    setFormAbierto(true);
  };

  const alternarPagado = async (gasto) => {
    setError(null);
    try {
      await expensesApi.update(gasto._id, { isPaid: !gasto.isPaid });
      onCambio();
    } catch (err) {
      // Sin esto, si la peticion fallaba el check simplemente no cambiaba y
      // no habia ninguna pista de que algo salio mal.
      setError(err.message);
    }
  };

  const total = gastos.reduce((s, g) => s + g.amount, 0);
  const pagado = gastos.filter((g) => g.isPaid).reduce((s, g) => s + g.amount, 0);

  return (
    <>
      <Tarjeta
        titulo={
          <h3 className="fila" style={{ gap: 8 }}>
            <span aria-hidden="true">🧾</span> Gastos sueltos
          </h3>
        }
        accion={
          <Boton chico variante="secundario" onClick={abrirNuevo}>
            + Agregar
          </Boton>
        }
      >
        {error && <Aviso tipo="error">{error}</Aviso>}
        {gastos.length === 0 ? (
          <Vacio icono="🧾" titulo="Sin gastos registrados">
            Comidas, entradas, souvenirs, propinas: lo que no cabe en transporte ni hospedaje va
            aquí.
          </Vacio>
        ) : (
          <>
            <div>
              {gastos.map((g) => (
                <div className="linea-gasto" key={g._id}>
                  <button
                    type="button"
                    className="gasto-check"
                    onClick={() => alternarPagado(g)}
                    aria-pressed={g.isPaid}
                    aria-label={g.isPaid ? 'Marcar como pendiente' : 'Marcar como pagado'}
                    title={g.isPaid ? 'Marcar como pendiente' : 'Marcar como pagado'}
                  >
                    {g.isPaid ? '✓' : ''}
                  </button>

                  <span className="crece" style={{ minWidth: 0 }}>
                    <strong style={{ textDecoration: g.isPaid ? 'line-through' : 'none' }}>
                      <span aria-hidden="true">{ICONOS[g.category]}</span> {g.description}
                    </strong>
                    <span className="tenue" style={{ display: 'block', fontSize: '0.8rem' }}>
                      {humanizar(g.category)} · {formatoFechaCorta(g.date)}
                      {g.notes ? ` · ${g.notes}` : ''}
                    </span>
                  </span>

                  <span className="numero">{formatoMoneda(g.amount, moneda)}</span>

                  <span className="fila" style={{ gap: 0, flexWrap: 'nowrap' }}>
                    <Boton
                      variante="fantasma"
                      chico
                      onClick={() => abrirEdicion(g)}
                      aria-label={`Editar ${g.description}`}
                      title="Editar"
                    >
                      ✎
                    </Boton>
                    <Boton
                      variante="fantasma"
                      chico
                      onClick={() => setPorEliminar(g)}
                      aria-label={`Eliminar ${g.description}`}
                      title="Eliminar"
                    >
                      ✕
                    </Boton>
                  </span>
                </div>
              ))}
            </div>

            <div className="fila-entre" style={{ marginTop: 14 }}>
              <Insignia color={pagado === total ? 'exito' : ''}>
                {formatoMoneda(pagado, moneda)} pagado de {formatoMoneda(total, moneda)}
              </Insignia>
              <span className="tenue">
                {gastos.length} {gastos.length === 1 ? 'gasto' : 'gastos'}
              </span>
            </div>
          </>
        )}
      </Tarjeta>

      {formAbierto && (
        <FormGasto
          abierto={formAbierto}
          onCerrar={() => setFormAbierto(false)}
          viaje={viaje}
          gasto={editando}
          onGuardado={onCambio}
        />
      )}

      <ModalConfirmar
        abierto={Boolean(porEliminar)}
        onCerrar={() => setPorEliminar(null)}
        onConfirmar={async () => {
          await expensesApi.remove(porEliminar._id);
          onCambio();
        }}
        titulo="Eliminar gasto"
        mensaje={`Se va a borrar "${porEliminar?.description}". Esta acción no se puede deshacer.`}
      />
    </>
  );
}
