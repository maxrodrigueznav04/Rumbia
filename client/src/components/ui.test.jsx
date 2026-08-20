import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Campo, Modal, Aviso, Insignia } from './ui.jsx';

describe('Campo', () => {
  it('liga la etiqueta con un input propio', async () => {
    const user = userEvent.setup();
    render(<Campo label="Destino" name="destino" />);

    await user.click(screen.getByText('Destino'));
    expect(screen.getByLabelText('Destino')).toHaveFocus();
  });

  /**
   * Regresion: cuando el control va como hijo (select, textarea) el `name` vive
   * en el hijo, no en Campo. Antes se calculaba el id solo desde props.name, se
   * quedaba en undefined y el htmlFor apuntaba a un elemento inexistente: ni el
   * clic en la etiqueta ni el lector de pantalla funcionaban.
   */
  it('tambien la liga cuando el control es un hijo', async () => {
    const user = userEvent.setup();
    render(
      <Campo label="Categoria">
        <select name="categoria">
          <option value="comida">Comida</option>
        </select>
      </Campo>
    );

    const select = screen.getByLabelText('Categoria');
    expect(select.tagName).toBe('SELECT');

    await user.click(screen.getByText('Categoria'));
    expect(select).toHaveFocus();
  });

  it('anuncia el error y lo enlaza al control', () => {
    render(<Campo label="Email" name="email" error="Ese email no se ve bien." />);

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Ese email no se ve bien.');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });

  it('esconde la ayuda cuando hay error, para no encimar dos mensajes', () => {
    const { rerender } = render(<Campo label="Monto" name="monto" ayuda="En MXN." />);
    expect(screen.getByText('En MXN.')).toBeInTheDocument();

    rerender(<Campo label="Monto" name="monto" ayuda="En MXN." error="Escribe el monto." />);
    expect(screen.queryByText('En MXN.')).not.toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('no pinta nada mientras esta cerrado', () => {
    render(
      <Modal abierto={false} onCerrar={vi.fn()} titulo="Editar">
        <p>contenido</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('se anuncia como dialogo y toma su titulo', () => {
    render(
      <Modal abierto onCerrar={vi.fn()} titulo="Editar viaje">
        <p>contenido</p>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Editar viaje');
  });

  it('cierra con Escape', async () => {
    const user = userEvent.setup();
    const onCerrar = vi.fn();
    render(
      <Modal abierto onCerrar={onCerrar} titulo="Editar">
        <p>contenido</p>
      </Modal>
    );

    await user.keyboard('{Escape}');
    expect(onCerrar).toHaveBeenCalled();
  });

  it('cierra al picar el fondo, pero no al picar dentro', async () => {
    const user = userEvent.setup();
    const onCerrar = vi.fn();
    const { container } = render(
      <Modal abierto onCerrar={onCerrar} titulo="Editar">
        <p>contenido</p>
      </Modal>
    );

    await user.click(screen.getByText('contenido'));
    expect(onCerrar).not.toHaveBeenCalled();

    await user.click(container.querySelector('.modal-fondo'));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('bloquea el scroll de atras mientras esta abierto y lo devuelve al cerrar', () => {
    const { unmount } = render(
      <Modal abierto onCerrar={vi.fn()} titulo="Editar">
        <p>contenido</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

describe('Aviso', () => {
  it('el error interrumpe al lector de pantalla; el resto solo informa', () => {
    const { rerender } = render(<Aviso tipo="error">Algo salio mal</Aviso>);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(<Aviso tipo="info">Solo un dato</Aviso>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('Insignia', () => {
  it('aplica el color como clase sin perder el texto', () => {
    render(<Insignia color="ambar">En curso</Insignia>);
    const chip = screen.getByText('En curso');
    expect(chip).toHaveClass('insignia', 'ambar');
  });
});
