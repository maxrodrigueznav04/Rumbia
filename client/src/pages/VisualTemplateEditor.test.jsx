import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VisualTemplateEditor from './VisualTemplateEditor.jsx';
import { visualTemplatesApi, visualAssetsApi } from '../api/index.js';

vi.mock('../api/index.js', () => ({
  visualTemplatesApi: { get: vi.fn(), update: vi.fn(), artUrl: vi.fn() },
  visualAssetsApi: { list: vi.fn(), remove: vi.fn(), upload: vi.fn() },
}));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: { _id: 'owner', agency: { _id: 'agency', owner: 'owner' } } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, values) => key === 'editor.imageNumber' ? `Imagen ${values.number}` : key }) }));

const image = { _id: 'photo', url: 'https://example.test/photo.jpg' };
const design = () => ({ schemaVersion: 1, pageSize: 'A4',
  theme: { ink: '#172b48', accent: '#bc6954', muted: '#5e6c7d', headingFont: 'editorial', bodyFont: 'modern' },
  pages: [{ id: 'cover', kind: 'cover', label: 'Portada', background: '#ffffff', elements: [
    { id: 'title', type: 'field', field: 'trip.title', x: 70, y: 100, width: 800, height: 120, style: { fontSize: 30 } },
  ] }],
  itinerary: { accent: '#bc6954', heading: 'El viaje', headingFontSize: 30, dayFontSize: 18, bodyFontSize: 8, showTimes: true, showDescriptions: true },
});
const template = () => ({ _id: 'master', name: 'Editorial', status: 'published', revision: 1, design: design() });
const view = () => render(<MemoryRouter initialEntries={['/plantillas-visuales/master']}><Routes><Route path="/plantillas-visuales/:id" element={<VisualTemplateEditor />} /></Routes></MemoryRouter>);
const removePhoto = () => screen.getByRole('button', { name: 'editor.deleteImage: Imagen 1' });

beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear();
  visualTemplatesApi.get.mockResolvedValue({ template: template(), canEdit: true });
  visualAssetsApi.list.mockResolvedValue({ assets: [image] });
});

describe('eliminar imágenes de la biblioteca', () => {
  it('cancelar conserva la foto; confirmar elimina solo la imagen elegida', async () => {
    visualAssetsApi.remove.mockResolvedValue({});
    view(); await screen.findByRole('button', { name: 'editor.deleteImage: Imagen 1' });
    fireEvent.click(removePhoto());
    expect(screen.getByText('editor.deleteImageWarning')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'comun:botones.cancelar' }));
    expect(visualAssetsApi.remove).not.toHaveBeenCalled();
    visualAssetsApi.list.mockResolvedValue({ assets: [] });
    fireEvent.click(removePhoto());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'delete' }));
    await waitFor(() => expect(visualAssetsApi.remove).toHaveBeenCalledWith('photo'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'editor.deleteImage: Imagen 1' })).not.toBeInTheDocument());
    expect(screen.getByText('editor.imageDeleted')).toBeInTheDocument();
  });

  it('bloquea la imagen usada en el diseño y no permite recuperarla con Deshacer tras borrarla', async () => {
    visualAssetsApi.remove.mockResolvedValue({});
    view(); await screen.findByRole('button', { name: 'editor.insertImage: Imagen 1' });
    fireEvent.click(screen.getByRole('button', { name: 'editor.insertImage: Imagen 1' }));
    expect(removePhoto()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'editor.removeElement' }));
    expect(removePhoto()).toBeEnabled();
    expect(screen.getByRole('button', { name: /editor.undo/ })).toBeEnabled();
    visualAssetsApi.list.mockResolvedValue({ assets: [] });
    fireEvent.click(removePhoto());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'delete' }));
    await screen.findByText('editor.imageDeleted');
    fireEvent.click(screen.getByRole('button', { name: /editor.undo/ }));
    expect(screen.queryByRole('button', { name: 'editor.element: image' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editor.undo/ })).toBeDisabled();
  });

  it('si la API indica uso en otro documento conserva la imagen y muestra el motivo', async () => {
    visualAssetsApi.remove.mockRejectedValue(new Error('Esta imagen forma parte de una propuesta ya emitida'));
    view(); await screen.findByRole('button', { name: 'editor.deleteImage: Imagen 1' });
    fireEvent.click(removePhoto());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'delete' }));
    expect(await screen.findByText('Esta imagen forma parte de una propuesta ya emitida')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'editor.insertImage: Imagen 1' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('no muestra borrado de biblioteca en un editor sin permiso', async () => {
    visualTemplatesApi.get.mockResolvedValue({ template: template(), canEdit: false });
    view(); await screen.findByRole('heading', { name: 'Editorial' });
    expect(screen.getByLabelText('name')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'editor.deleteImage: Imagen 1' })).not.toBeInTheDocument();
  });
});
