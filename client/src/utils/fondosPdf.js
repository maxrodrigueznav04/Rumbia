/**
 * Catalogo de fondos de pagina del PDF (beneficio Agencia/Pro). Los ids
 * tienen que coincidir uno a uno con FONDOS_PDF en
 * server/src/models/Agency.js -- ahi se valida cual id existe, aqui vive el
 * color real de cada uno.
 *
 * Paleta curada a proposito, no un selector de color libre: el fondo cubre
 * TODA la hoja detras de las tarjetas blancas, asi que un tono mal elegido
 * (muy oscuro, muy saturado) se traga el documento entero -- a diferencia
 * del color de acento (libre), que solo pinta detalles chicos y tolera
 * cualquier eleccion. Todos estos son pasteles muy claros (>=95% de luz), lo
 * bastante palidos para que el texto oscuro del PDF (#0f172a/#475569) siga
 * leyendose sin problema encima.
 */
export const FONDOS_PDF = [
  { id: '', etiqueta: 'Blanco (predeterminado)', color: null },
  { id: 'azul', etiqueta: 'Azul cielo', color: '#E9F2FB' },
  { id: 'amarillo', etiqueta: 'Amarillo suave', color: '#FBF6E2' },
  { id: 'morado', etiqueta: 'Lavanda', color: '#F3EEFA' },
  { id: 'verde', etiqueta: 'Verde salvia', color: '#EEF5EC' },
  { id: 'beige', etiqueta: 'Beige cálido', color: '#F8F1E3' },
  { id: 'rosa', etiqueta: 'Rosa pastel', color: '#FBEEF1' },
  { id: 'gris', etiqueta: 'Gris perla', color: '#F1F3F6' },
];

export const obtenerFondo = (id) => FONDOS_PDF.find((f) => f.id === id) || FONDOS_PDF[0];
