import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Tarjeta, Vacio, Aviso } from './ui.jsx';
import { formatoMoneda, traducirDominio, COLORES_CATEGORIA } from '../utils/format.js';

/** Desglose del presupuesto: dona + lineas por categoria + barra contra el limite. */
export default function ResumenPresupuesto({ resumen }) {
  const { t } = useTranslation('viaje');
  const { t: tDominio } = useTranslation('dominio');
  const td = (slug) => traducirDominio(tDominio, slug);
  if (!resumen) return null;

  const { breakdown, chartData, totals, budget, currency, itineraryEstimate, conversion } = resumen;
  const hayGastos = chartData?.length > 0;

  if (!hayGastos) {
    return (
      <Tarjeta titulo={t('resumenPresupuesto.titulo')}>
        <Vacio icono="💰" titulo={t('resumenPresupuesto.sinGastos')}>
          {t('resumenPresupuesto.sinGastosTexto')}
        </Vacio>
      </Tarjeta>
    );
  }

  const porcentaje = budget.usedPercent ?? 0;
  const claseBarra = budget.isOver ? 'excedido' : porcentaje > 80 ? 'alerta' : '';

  return (
    <Tarjeta titulo={t('resumenPresupuesto.titulo')}>
      {conversion?.sinConvertir?.length > 0 && (
        <Aviso tipo="alerta" titulo={t('resumenPresupuesto.gastosFueraDeLaSuma')}>
          {t('resumenPresupuesto.gastosFueraDeLaSumaTexto', { monedas: conversion.sinConvertir.join(', ') })}
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
              formatter={(valor, nombre) => [formatoMoneda(valor, currency), td(nombre)]}
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
          <span className="etiqueta">{t('resumenPresupuesto.total')}</span>
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
              {td(d.category)}
            </span>
            <span className="numero">{formatoMoneda(d.value, currency)}</span>
          </div>
        ))}
      </div>

      {budget.isSet && (
        <div style={{ marginTop: 16 }}>
          <div className="fila-entre" style={{ marginBottom: 6 }}>
            <span className="etiqueta">{t('resumenPresupuesto.contraTuPresupuesto')}</span>
            <span className="tenue">
              {t('resumenPresupuesto.porcentajeDe', { porcentaje, monto: formatoMoneda(budget.amount, currency) })}
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
              ? t('resumenPresupuesto.tePasaste', { monto: formatoMoneda(Math.abs(budget.remaining), currency) })
              : t('resumenPresupuesto.teQuedan', { monto: formatoMoneda(budget.remaining, currency) })}
          </p>
        </div>
      )}

      <div className="rejilla rejilla-2" style={{ gap: 10, marginTop: 16 }}>
        <div className="tarjeta-plana">
          <div className="etiqueta">{t('resumenPresupuesto.porViajero')}</div>
          <div className="numero">{formatoMoneda(totals.perTraveler, currency)}</div>
        </div>
        <div className="tarjeta-plana">
          <div className="etiqueta">{t('resumenPresupuesto.porDia')}</div>
          <div className="numero">{formatoMoneda(totals.perDay, currency)}</div>
        </div>
      </div>

      {itineraryEstimate && (
        <p className="tenue" style={{ margin: '12px 0 0' }}>
          {t('resumenPresupuesto.sugerenciaPre')}{' '}
          <strong>{formatoMoneda(itineraryEstimate.perTraveler, currency)}</strong>{' '}
          {t('resumenPresupuesto.sugerenciaPost', {
            totalGrupo: formatoMoneda(itineraryEstimate.allTravelers, currency),
            cantidad: itineraryEstimate.activityCount,
          })}
        </p>
      )}
    </Tarjeta>
  );
}
