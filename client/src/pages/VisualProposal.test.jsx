import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VisualProposal from './VisualProposal.jsx';
import { visualProposalsApi, visualTemplatesApi, visualAssetsApi } from '../api/index.js';

vi.mock('../api/index.js', () => ({
  visualProposalsApi: { get: vi.fn(), select: vi.fn(), update: vi.fn(), preview: vi.fn(), issue: vi.fn(), pdfUrl: (_trip, issue) => `/pdf/${issue}` },
  visualTemplatesApi: { list: vi.fn() }, visualAssetsApi: { list: vi.fn() },
}));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: { _id: 'owner', agency: { _id: 'agency' } } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));

const draftKey = 'rumbia:visual-draft:owner:agency:proposal:trip';
const design = () => ({ pages: [
  { kind: 'cover', elements: [{ id: 'title', type: 'field', field: 'trip.title' }] },
  { id: 'intro', elements: [{ id: 'intro-heading', type: 'text', text: 'Nuestro recorrido' }] },
] });
const proposal = () => ({ template: 'master', revision: 1, design: design() });
const view = () => render(<MemoryRouter initialEntries={['/viajes/trip/propuesta']}><Routes><Route path="/viajes/:id/propuesta" element={<VisualProposal />} /></Routes></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear();
  visualProposalsApi.get.mockResolvedValue({ proposal: proposal(), issues: [{ _id: 'old-pdf', sequence: 1 }], canEdit: true });
  visualTemplatesApi.list.mockResolvedValue({ templates: [{ _id: 'master', name: 'Editorial', status: 'published' }, { _id: 'other', name: 'Otra', status: 'published' }] });
  visualAssetsApi.list.mockResolvedValue({ assets: [] });
});

describe('decisiones del agente al preparar una propuesta', () => {
  it('sin selección conserva una salida al PDF habitual y no emite automáticamente', async () => {
    visualProposalsApi.get.mockResolvedValue({ proposal: null, issues: [], canEdit: true });
    view();
    expect(await screen.findByRole('link', { name: 'proposal.classicPdf' })).toHaveAttribute('href', '/viajes/trip/itinerario');
    expect(screen.getByRole('button', { name: 'proposal.useTemplate' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'proposal.issuePdf' })).not.toBeInTheDocument();
    expect(visualProposalsApi.issue).not.toHaveBeenCalled();
  });

  it('cancelar el reemplazo conserva los ajustes y confirmar envía la revisión vista', async () => {
    visualProposalsApi.select.mockResolvedValue({ proposal: { ...proposal(), template: 'other', revision: 2 } });
    view();
    const title = await screen.findByLabelText('proposal.coverTitle');
    fireEvent.change(title, { target: { value: 'Mi propuesta personalizada' } });
    fireEvent.change(screen.getByLabelText('proposal.template'), { target: { value: 'other' } });
    fireEvent.click(screen.getByRole('button', { name: 'proposal.changeTemplate' }));
    expect(await screen.findByText('proposal.replaceWarning')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'comun:botones.cancelar' }));
    expect(title).toHaveValue('Mi propuesta personalizada');
    expect(visualProposalsApi.select).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'proposal.changeTemplate' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click([...dialog.querySelectorAll('button')].find((b) => b.textContent === 'proposal.changeTemplate'));
    await waitFor(() => expect(visualProposalsApi.select).toHaveBeenCalledWith('trip', 'other', 1));
    expect(screen.getByRole('link', { name: 'proposal.downloadVersion' })).toHaveAttribute('href', '/pdf/old-pdf');
  });

  it('un fallo de guardado conserva el borrador y permite recuperarlo después de volver', async () => {
    visualProposalsApi.update.mockRejectedValue(new Error('Sin conexión'));
    const first = view();
    fireEvent.change(await screen.findByLabelText('proposal.coverTitle'), { target: { value: 'Texto que no quiero perder' } });
    fireEvent.click(screen.getByRole('button', { name: 'editor.save' }));
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument();
    expect(screen.getByLabelText('proposal.coverTitle')).toHaveValue('Texto que no quiero perder');
    expect(sessionStorage.getItem(draftKey)).toContain('Texto que no quiero perder');
    first.unmount(); view();
    expect(await screen.findByText('draft.found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'draft.recover' }));
    expect(screen.getByLabelText('proposal.coverTitle')).toHaveValue('Texto que no quiero perder');
    expect(screen.getByRole('button', { name: 'proposal.preview' })).toBeDisabled();
  });

  it('avisa si la versión del servidor cambió y descartar no la sobrescribe', async () => {
    sessionStorage.setItem(draftKey, JSON.stringify({ schema: 1, revision: 0, value: { design: design() } }));
    view();
    expect(await screen.findByText('draft.stale')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'draft.discard' }));
    expect(sessionStorage.getItem(draftKey)).toBeNull();
    expect(visualProposalsApi.update).not.toHaveBeenCalled();
  });

  it('después de un conflicto exige una vista previa nueva', async () => {
    visualProposalsApi.preview.mockResolvedValue({ html: '<p>Propuesta</p>', proposalRevision: 1, previewHash: 'hash' });
    visualProposalsApi.issue.mockRejectedValue(Object.assign(new Error('El viaje cambió'), { status: 409 }));
    view(); await screen.findByLabelText('proposal.coverTitle');
    fireEvent.click(screen.getByRole('button', { name: 'proposal.preview' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'proposal.issuePdf' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'proposal.issuePdf' }));
    expect(await screen.findByText('El viaje cambió')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'proposal.issuePdf' })).toBeDisabled();
  });

  it('reintentar una emisión con respuesta perdida utiliza el mismo identificador', async () => {
    visualProposalsApi.preview.mockResolvedValue({ html: '<p>Propuesta</p>', proposalRevision: 1, previewHash: 'hash' });
    visualProposalsApi.issue.mockRejectedValueOnce(new Error('Respuesta perdida')).mockResolvedValue({ issue: { _id: 'new-pdf' } });
    view(); await screen.findByLabelText('proposal.coverTitle');
    fireEvent.click(screen.getByRole('button', { name: 'proposal.preview' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'proposal.issuePdf' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'proposal.issuePdf' }));
    await screen.findByText('Respuesta perdida');
    fireEvent.click(screen.getByRole('button', { name: 'proposal.issuePdf' }));
    await waitFor(() => expect(visualProposalsApi.issue).toHaveBeenCalledTimes(2));
    expect(visualProposalsApi.issue.mock.calls[0][3]).toBe(visualProposalsApi.issue.mock.calls[1][3]);
  });

  it('con acceso vencido mantiene las descargas y desactiva los cambios', async () => {
    visualProposalsApi.get.mockResolvedValue({ proposal: proposal(), issues: [{ _id: 'old-pdf', sequence: 1 }], canEdit: false });
    view();
    expect(await screen.findByText('proposal.readOnly')).toBeInTheDocument();
    expect(screen.getByLabelText('proposal.coverTitle')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'proposal.issuePdf' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'proposal.downloadVersion' })).toBeInTheDocument();
  });

  it('una plantilla archivada no impide usar la copia del viaje y un cupo excedido se explica', async () => {
    visualTemplatesApi.list.mockResolvedValue({ templates: [{ _id: 'master', status: 'archived' }], limit: 1 });
    visualProposalsApi.preview.mockResolvedValue({ html: '<p>Propuesta</p>', proposalRevision: 1, previewHash: 'hash' });
    const first = view(); await screen.findByLabelText('proposal.coverTitle');
    fireEvent.click(screen.getByRole('button', { name: 'proposal.preview' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'proposal.issuePdf' })).toBeEnabled());
    first.unmount();
    visualTemplatesApi.list.mockResolvedValue({ templates: [{ _id: 'master', status: 'published' }, { _id: 'other', status: 'published' }], limit: 1 });
    view(); expect(await screen.findByText('proposal.overQuota')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'proposal.issuePdf' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'proposal.downloadVersion' })).toBeInTheDocument();
  });
});
