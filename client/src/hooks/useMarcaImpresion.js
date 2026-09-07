import { useEffect } from 'react';
import { estiloPersonalizado } from '../components/HojaImpresion.jsx';

// Las reglas de impresion calculan color, fuente, escala y fondo en html/body.
// Las variables del contenedor del itinerario no se heredan hacia sus padres.
// Publicarlas solo al imprimir tambien cubre Ctrl+P y el enlace compartido.
export default function useMarcaImpresion(marca) {
  useEffect(() => {
    const variables = estiloPersonalizado(marca) || {};
    const raiz = document.documentElement.style;
    let anteriores;

    const restaurar = () => {
      if (!anteriores) return;
      for (const [nombre, valor, prioridad] of anteriores) {
        if (valor) raiz.setProperty(nombre, valor, prioridad);
        else raiz.removeProperty(nombre);
      }
      anteriores = undefined;
    };
    const preparar = () => {
      restaurar();
      anteriores = Object.keys(variables).map((nombre) => [
        nombre, raiz.getPropertyValue(nombre), raiz.getPropertyPriority(nombre),
      ]);
      for (const [nombre, valor] of Object.entries(variables)) {
        raiz.setProperty(nombre, valor);
      }
    };

    window.addEventListener('beforeprint', preparar);
    window.addEventListener('afterprint', restaurar);
    return () => {
      window.removeEventListener('beforeprint', preparar);
      window.removeEventListener('afterprint', restaurar);
      restaurar();
    };
  }, [marca?.marcaBlanca, marca?.colorAcento, marca?.fuentePdf, marca?.densidadPdf, marca?.fondoPdf]);
}
