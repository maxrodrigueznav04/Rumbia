import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VisualTemplates from './VisualTemplates.jsx';
import { visualTemplatesApi } from '../api/index.js';

vi.mock('../api/index.js', () => ({ visualTemplatesApi: { list: vi.fn(), remove: vi.fn(), artUrl: vi.fn() } }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: { _id: 'owner', agency: { _id: 'agency' } } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));

const active = { _id: 'active', name: 'Editorial', status: 'published', revision: 3 };
const archived = { _id: 'archived', name: 'Anterior', status: 'archived', revision: 2 };
const data = (changes = {}) => ({ templates: [active, archived], presets: [], canEdit: true, canDelete: true, canArchive: true, limit: 5, ...changes });
const view = () => render(<MemoryRouter><VisualTemplates /></MemoryRouter>);
const deleteButton = (name) => within(screen.getByText(name).closest('section')).getByRole('button', { name: 'delete' });

beforeEach(() => { vi.resetAllMocks(); visualTemplatesApi.list.mockResolvedValue(data()); });

describe('eliminar una plantilla completa', () => {
  it('cancelar conserva la plantilla y confirmar envía su revisión y actualiza la lista', async () => {
    visualTemplatesApi.remove.mockResolvedValue({});
    view(); await screen.findByText('Editorial');
    fireEvent.click(deleteButton('Editorial'));
    expect(screen.getByText('deleteWarning')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'comun:botones.cancelar' }));
    expect(visualTemplatesApi.remove).not.toHaveBeenCalled();
    expect(screen.getByText('Editorial')).toBeInTheDocument();
    visualTemplatesApi.list.mockResolvedValue(data({ templates: [archived] }));
    fireEvent.click(deleteButton('Editorial'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'delete' }));
    await waitFor(() => expect(visualTemplatesApi.remove).toHaveBeenCalledWith('active', 3));
    await waitFor(() => expect(screen.queryByText('Editorial')).not.toBeInTheDocument());
    expect(screen.getByText('Anterior')).toBeInTheDocument();
    expect(screen.getByText('deleted')).toBeInTheDocument();
  });

  it('permite al dueño eliminar una archivada aunque venza el plan', async () => {
    visualTemplatesApi.list.mockResolvedValue(data({ canEdit: false, limit: 0 }));
    visualTemplatesApi.remove.mockResolvedValue({});
    view(); await screen.findByText('Anterior');
    fireEvent.click(deleteButton('Anterior'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'delete' }));
    await waitFor(() => expect(visualTemplatesApi.remove).toHaveBeenCalledWith('archived', 2));
  });

  it('oculta eliminar si la API no concede permiso al agente', async () => {
    visualTemplatesApi.list.mockResolvedValue(data({ canEdit: false, canArchive: false, canDelete: false }));
    view(); await screen.findByText('Editorial');
    expect(screen.queryByRole('button', { name: 'delete' })).not.toBeInTheDocument();
  });

  it('un conflicto conserva la plantilla y muestra el error dentro de la confirmación', async () => {
    visualTemplatesApi.remove.mockRejectedValue(new Error('La plantilla cambió en otra pestaña'));
    view(); await screen.findByText('Editorial');
    fireEvent.click(deleteButton('Editorial'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'delete' }));
    expect(await screen.findByText('La plantilla cambió en otra pestaña')).toBeInTheDocument();
    expect(screen.getByText('Editorial')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
