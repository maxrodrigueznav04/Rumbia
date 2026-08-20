import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFormulario } from './useFormulario.js';
import { reglas } from '../utils/validacion.js';

/** Formulario minimo para ejercitar el hook desde fuera, como lo usa la app. */
function FormularioDePrueba({ alEnviar }) {
  const form = useFormulario(
    { email: '', password: '' },
    { email: reglas.email, password: reglas.password }
  );

  return (
    <form onSubmit={form.enviar(alEnviar)} noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" {...form.props('email')} />
      {form.errores.email && <span role="alert">{form.errores.email}</span>}

      <label htmlFor="password">Contraseña</label>
      <input id="password" type="password" {...form.props('password')} />
      {form.errores.password && <span role="alert">{form.errores.password}</span>}

      {form.errorServidor && <p data-testid="error-servidor">{form.errorServidor.mensaje}</p>}
      <button type="submit">Entrar</button>
    </form>
  );
}

describe('useFormulario', () => {
  it('no grita el error mientras escribes la primera letra', async () => {
    const user = userEvent.setup();
    render(<FormularioDePrueba alEnviar={vi.fn()} />);

    await user.type(screen.getByLabelText('Email'), 'a');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra el error al salir del campo (blur)', async () => {
    const user = userEvent.setup();
    render(<FormularioDePrueba alEnviar={vi.fn()} />);

    await user.type(screen.getByLabelText('Email'), 'no-sirve');
    await user.tab();

    expect(await screen.findByText(/no se ve bien/i)).toBeInTheDocument();
  });

  it('al intentar enviar saca todos los errores aunque no hayas tocado los campos', async () => {
    const user = userEvent.setup();
    const alEnviar = vi.fn();
    render(<FormularioDePrueba alEnviar={alEnviar} />);

    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(alEnviar).not.toHaveBeenCalled();
  });

  it('envia los valores cuando la validacion pasa', async () => {
    const user = userEvent.setup();
    const alEnviar = vi.fn().mockResolvedValue(undefined);
    render(<FormularioDePrueba alEnviar={alEnviar} />);

    await user.type(screen.getByLabelText('Email'), 'ana@ejemplo.com');
    await user.type(screen.getByLabelText('Contraseña'), 'contrasena123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(alEnviar).toHaveBeenCalledWith({
      email: 'ana@ejemplo.com',
      password: 'contrasena123',
    });
  });

  it('traduce los details del backend a errores por campo', async () => {
    const user = userEvent.setup();
    const alEnviar = vi.fn().mockRejectedValue(
      Object.assign(new Error('Datos invalidos.'), {
        // El backend manda rutas: se usa la hoja del camino.
        details: [{ field: 'body.email', message: 'Ese email ya está registrado.' }],
      })
    );
    render(<FormularioDePrueba alEnviar={alEnviar} />);

    await user.type(screen.getByLabelText('Email'), 'ana@ejemplo.com');
    await user.type(screen.getByLabelText('Contraseña'), 'contrasena123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Ese email ya está registrado.')).toBeInTheDocument();
    expect(screen.getByTestId('error-servidor')).toHaveTextContent('Datos invalidos.');
  });

  it('limpia el error del servidor en cuanto corriges ese campo', async () => {
    const user = userEvent.setup();
    const alEnviar = vi.fn().mockRejectedValue(
      Object.assign(new Error('Datos invalidos.'), {
        details: [{ field: 'email', message: 'Ese email ya está registrado.' }],
      })
    );
    render(<FormularioDePrueba alEnviar={alEnviar} />);

    await user.type(screen.getByLabelText('Email'), 'ana@ejemplo.com');
    await user.type(screen.getByLabelText('Contraseña'), 'contrasena123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Ese email ya está registrado.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'x');
    expect(screen.queryByText('Ese email ya está registrado.')).not.toBeInTheDocument();
  });
});
