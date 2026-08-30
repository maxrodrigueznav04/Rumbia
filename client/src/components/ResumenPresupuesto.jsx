import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Tarjeta, Vacio, Aviso } from './ui.jsx';
import { formatoMoneda, humanizar, COLORES_CATEGORIA } from '../utils/format.js';

/** Desglose del presupuesto: dona + lineas por categoria + barra contra el limite. */
export default function ResumenPresupuesto({ resumen }) {
  if (!resumen) return null;

  const { breakdown, chartData, totals, budget, currency, itineraryEstimate, conversion } = resumen;
  const hayGastos = chartData?.length > 0;

  if (!hayGastos) {
    return (
      <Tarjeta titulo="Presupuesto">
        <Vacio icono="💰" titulo="Sin gastos capturados">
          Conforme registres transporte, hospedaje y gastos sueltos, aquí vas a ver el desglose.
        </Vacio>
      </Tarjeta>
    );
  }

  const porcentaje = budget.usedPercent ?? 0;
  const claseBarra = budget.isOver ? 'excedido' : porcentaje > 80 ? 'alerta' : '';

  return (
    <Tarjeta titulo="Presupuesto">
      {conversion?.sinConvertir?.length > 0 && (
        <Aviso tipo="alerta" titulo="Hay gastos fuera de esta suma">
          No se pudo obtener el tipo de cambio de {conversion.sinConvertir.join(', ')}, así que esos
          gastos no entran en el total. Vuelve a cargar en un momento.
        </Aviso>
      )}

      <div className="dona">
        <div className="dona-grafica">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="category"
              innerRadius={44}
              outerRadius={64}
              paddingAngle={2}
              stroke="none"
            >
              {chartData.map((d) => (
                <Cell key={d.category} fill={COLORES_CATEGORIA[d.category] || '#b8ccb3'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(valor, nombre) => [formatoMoneda(valor, currency), humanizar(nombre)]}
              contentStyle={{
                borderRadius: 10,
                border: '1px solid #dcdedb',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        </div>

        <div className="dona-centro">
          <span className="etiqueta">Total</span>
          <span className="numero">{formatoMoneda(totals.total, currency)}</span>
        </div>
      </div>

      <div>
        {chartData.map((d) => (
          <div className="linea-gasto" key={d.category}>
            <span className="fila" style={{ gap: 8 }}>
              <span
                className="punto-color"
                style={{ background: COLORES_CATEGORIA[d.category] || '#b8ccb3' }}
                aria-hidden="true"
              />
              {humanizar(d.category)}
            </span>
            <span className="numero">{formatoMoneda(d.value, currency)}</span>
          </div>
        ))}
      </div>

      {budget.isSet && (
        <div style={{ marginTop: 16 }}>
          <div className="fila-entre" style={{ marginBottom: 6 }}>
            <span className="etiqueta">Contra tu presupuesto</span>
            <span className="tenue">
              {porcentaje}% de {formatoMoneda(budget.amount, currency)}
            </span>
          </div>
          <div
            className="barra"
            role="progressbar"
            aria-valuenow={Math.min(porcentaje, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={`barra-relleno ${claseBarra}`} style={{ width: `${Math.min(porcentaje, 100)}%` }} />
          </div>
          <p className={budget.isOver ? 'campo-error' : 'tenue'} style={{ margin: '7px 0 0' }}>
            {budget.isOver
              ? `Te pasaste por ${formatoMoneda(Math.abs(budget.remaining), currency)}.`
              : `Te quedan ${formatoMoneda(budget.remaining, currency)}.`}
          </p>
        </div>
      )}

      <div className="rejilla rejilla-2" style={{ gap: 10, marginTop: 16 }}>
        <div className="tarjeta-plana">
          <div className="etiqueta">Por viajero</div>
          <div className="numero">{formatoMoneda(totals.perTraveler, currency)}</div>
        </div>
        <div className="tarjeta-plana">
          <div className="etiqueta">Por día</div>
          <div className="numero">{formatoMoneda(totals.perDay, currency)}</div>
        </div>
      </div>

      {itineraryEstimate && (
        <p className="tenue" style={{ margin: '12px 0 0' }}>
          El itinerario sugiere <strong>{formatoMoneda(itineraryEstimate.perTraveler, currency)}</strong>{' '}
          por persona en actividades ({formatoMoneda(itineraryEstimate.allTravelers, currency)} en
          total del grupo, {itineraryEstimate.activityCount} actividad(es)). No se suma
          automáticamente: se cuenta cuando lo registras como gasto.
        </p>
      )}
    </Tarjeta>
  );
}
