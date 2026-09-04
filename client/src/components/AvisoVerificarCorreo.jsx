import { useState } from 'react';
import { authApi } from '../api/index.js';
import { Aviso, Boton } from './ui.jsx';

/**
 * Aparece en toda la app mientras el usuario no haya confirmado su correo
 * (ver requireEmailVerificado.js en el servidor: generar con IA, usar el
 * chat y crear una agencia quedan bloqueados hasta entonces).
 */
export default function AvisoVerificarCorreo() {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState(null);

  const reenviar = async () => {
    setError(null);
    setEnviando(true);
    try {
      await authApi.resendVerification();
      setEnviado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Aviso tipo="alerta" titulo="Verifica tu correo">
      <div className="fila-entre" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 4 }}>
        <span>
          {enviado
            ? 'Te reenviamos el correo. Revisa tu bandeja de entrada (o spam) y pulsa el enlace.'
            : 'Te mandamos un enlace al crear tu cuenta. Actívalo para poder generar itinerarios con IA, usar el chat y crear una agencia.'}
        </span>
        {!enviado && (
          <Boton chico variante="secundario" onClick={reenviar} cargando={enviando}>
            Reenviar correo
          </Boton>
        )}
      </div>
      {error && (
        <p className="campo-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
    </Aviso>
  );
}
