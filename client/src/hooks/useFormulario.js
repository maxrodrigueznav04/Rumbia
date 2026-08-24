import { useCallback, useMemo, useState } from 'react';
import { validarFormulario } from '../utils/validacion.js';

/**
 * Estado de formulario con validación en vivo.
 *
 * El error de un campo solo se muestra después de que el usuario lo tocó (blur)
 * o de intentar enviar: validar mientras escribe la primera letra y gritarle
 * "email inválido" es hostil.
 */
export function useFormulario(valoresIniciales, validadores = {}) {
  const [valores, setValores] = useState(valoresIniciales);
  const [tocados, setTocados] = useState({});
  const [intentoEnvio, setIntentoEnvio] = useState(false);
  const [errorServidor, setErrorServidor] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const erroresTodos = useMemo(
    () => validarFormulario(valores, validadores),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valores]
  );

  // Errores visibles = los de campos tocados, más los del servidor.
  const errores = useMemo(() => {
    const visibles = {};
    for (const [campo, msg] of Object.entries(erroresTodos)) {
      if (tocados[campo] || intentoEnvio) visibles[campo] = msg;
    }
    for (const [campo, msg] of Object.entries(errorServidor?.porCampo || {})) {
      visibles[campo] = msg;
    }
    return visibles;
  }, [erroresTodos, tocados, intentoEnvio, errorServidor]);

  const cambiar = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setValores((v) => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
    // Al corregir, se limpia el error que había mandado el servidor para ese campo.
    setErrorServidor((prev) => {
      if (!prev?.porCampo?.[name]) return prev;
      const { [name]: _, ...resto } = prev.porCampo;
      return { ...prev, porCampo: resto };
    });
  }, []);

  const marcarTocado = useCallback((e) => {
    setTocados((t) => ({ ...t, [e.target.name]: true }));
  }, []);

  const fijar = useCallback((campo, valor) => {
    setValores((v) => ({ ...v, [campo]: valor }));
  }, []);

  const props = useCallback(
    (campo) => ({
      name: campo,
      value: valores[campo] ?? '',
      onChange: cambiar,
      onBlur: marcarTocado,
      error: errores[campo],
    }),
    [valores, cambiar, marcarTocado, errores]
  );

  /**
   * Envuelve el submit: valida todo, y si pasa llama a `alEnviar`.
   * Traduce los `details` del backend a errores por campo.
   */
  const enviar = useCallback(
    (alEnviar) => async (e) => {
      e?.preventDefault?.();
      setIntentoEnvio(true);
      setErrorServidor(null);

      if (Object.keys(erroresTodos).length > 0) return;

      setEnviando(true);
      try {
        await alEnviar(valores);
      } catch (err) {
        const porCampo = {};
        for (const d of err.details || []) {
          // El backend manda rutas tipo "destination.name"; se usa la hoja.
          const campo = String(d.field).split('.').pop();
          porCampo[campo] = d.message;
        }
        setErrorServidor({ mensaje: err.message, status: err.status, porCampo });
      } finally {
        setEnviando(false);
      }
    },
    [valores, erroresTodos]
  );

  return {
    valores,
    errores,
    props,
    cambiar,
    fijar,
    setValores,
    enviar,
    enviando,
    errorServidor,
    esValido: Object.keys(erroresTodos).length === 0,
  };
}

export default useFormulario;
