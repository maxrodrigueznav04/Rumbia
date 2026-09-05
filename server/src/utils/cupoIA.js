/**
 * Suma 1 a un contador mensual de uso de IA de forma atomica, sin el
 * read-then-save que usaban antes consumirCupoPersonal/consumirCupoChat
 * (itinerary.controller.js/chat.controller.js) y Agency.consumirCupoIA:
 * dos requests que terminan su generacion casi al mismo tiempo cargaban su
 * propia copia del documento, y el segundo save() pisaba el incremento del
 * primero (se perdia un uso real de cupo).
 *
 * El pipeline de update decide TODO (si el mes sigue vigente o hay que
 * reiniciar el contador, y el +1) dentro de la misma operacion atomica en
 * Mongo, sin leer el documento primero -- no hay ventana entre leer y
 * escribir en la que otra request pueda meterse.
 */
export async function incrementarUsoIAMensual(Model, filtro, basePath, campo, otroCampo) {
  const mesActual = new Date().toISOString().slice(0, 7);
  const mesVigente = { $eq: [`$${basePath}.mes`, mesActual] };
  await Model.updateOne(filtro, [
    {
      $set: {
        [basePath]: {
          mes: mesActual,
          [campo]: {
            $add: [{ $cond: [mesVigente, { $ifNull: [`$${basePath}.${campo}`, 0] }, 0] }, 1],
          },
          [otroCampo]: { $cond: [mesVigente, { $ifNull: [`$${basePath}.${otroCampo}`, 0] }, 0] },
        },
      },
    },
  ]);
}
