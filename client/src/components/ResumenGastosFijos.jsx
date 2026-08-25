import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Tarjeta, Vacio } from './ui.jsx';
import { formatoMoneda, humanizar, porPersonas, COLORES_CATEGORIA } from '../utils/format.js';

/**
 * Dona de transporte + hospedaje + transporte local — lo que ya se sabe que
 * se va a pagar, capturado en el viaje mismo. A propósito NO incluye los
 * gastos sueltos (comida, compras, etc.): esos son variables y ya se
 * registran uno por uno en "Presupuesto"; mezclarlos aquí haría que dividir
 * por persona distorsionara dinero que ya se gastó de verdad.
 *
 * Responde al mismo selector de personas que el resto de la página: los tres
 * montos vienen capturados como total del grupo, así que se escalan igual
 * que en las tarjetas de arriba.
 */
export default function ResumenGastosFijos({ viaje, personas }) {
  const moneda = viaje.budget?.currency || 'MXN';
  const travelers = viaje.travelers || 1;
  const paraCuantos = personas || travelers;
  const core = viaje.coreCosts || { transport: 0, lodging: 0, localTransport: 0 };

  const categorias = [
    { key: 'transporte', valor: core.transport },
    { key: 'hospedaje', valor: core.lodging },
    { key: 'transporte-local', valor: core.localTransport },
  ]
    .map((c) => ({ ...c, valor: Number(porPersonas(c.valor, travelers, paraCuantos).toFixed(2)) }))
    .filter((c) => c.valor > 0);

  const titulo =
    paraCuantos !== travelers ? `Gastos fijos y seguros · para ${paraCuantos} de ${travelers}` : 'Gastos fijos y seguros';

  if (categorias.length === 0) {
    return (
      <Tarjeta titulo={titulo}>
        <Vacio icono="🔒" titulo="Sin capturar todavía">
          Transporte y hospedaje: lo que ya sabes que vas a pagar, sin importar cómo salga lo demás.
        </Vacio>
      </Tarjeta>
    );
  }

  const total = categorias.reduce((s, c) => s + c.valor, 0);

  return (
    <Tarjeta titulo={titulo}>
      <div className="dona">
        <div className="dona-grafica">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categorias}
                dataKey="valor"
                nameKey="key"
                innerRadius={44}
                outerRadius={64}
                paddingAngle={2}
                stroke="none"
              >
                {categorias.map((c) => (
                  <Cell key={c.key} fill={COLORES_CATEGORIA[c.key] || '#b8ccb3'} />
                ))}
              </Pie>
              <Tooltip
                formatter={(valor, nombre) => [formatoMoneda(valor, moneda), humanizar(nombre)]}
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
          <span className="numero">{formatoMoneda(total, moneda)}</span>
        </div>
      </div>

      <div>
        {categorias.map((c) => (
          <div className="linea-gasto" key={c.key}>
            <span className="fila" style={{ gap: 8 }}>
              <span
                className="punto-color"
                style={{ background: COLORES_CATEGORIA[c.key] || '#b8ccb3' }}
                aria-hidden="true"
              />
              {humanizar(c.key)}
            </span>
            <span className="numero">{formatoMoneda(c.valor, moneda)}</span>
          </div>
        ))}
      </div>

      <p className="tenue" style={{ margin: '12px 0 0', fontSize: '0.8rem' }}>
        Solo lo capturado en transporte y hospedaje. No incluye comida, compras ni otros gastos
        sueltos — esos ya se registran aparte en Presupuesto.
      </p>
    </Tarjeta>
  );
}
