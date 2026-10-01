import { beforeEach, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import useVisualDraft from './useVisualDraft.js';

beforeEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

it('un borrador de otra cuenta o agencia no se ofrece a la cuenta actual', async () => {
  sessionStorage.setItem('account-a:agency-a:template', JSON.stringify({ schema: 1, revision: 1, value: { name: 'Privado A' } }));
  const { result } = renderHook(() => useVisualDraft({ storageKey: 'account-b:agency-b:template', ready: true, revision: 1, dirty: false, value: {} }));
  expect(result.current.draft).toBeNull();
  expect(sessionStorage.getItem('account-a:agency-a:template')).toContain('Privado A');
});

it('guardar correctamente retira el borrador y el aviso de salida', async () => {
  const { result, rerender } = renderHook((props) => useVisualDraft(props), { initialProps: { storageKey: 'mine', ready: true, revision: 1, dirty: true, value: { name: 'Cambio' } } });
  await waitFor(() => expect(sessionStorage.getItem('mine')).toContain('Cambio'));
  const unsavedEvent = new Event('beforeunload', { cancelable: true });
  act(() => window.dispatchEvent(unsavedEvent));
  expect(unsavedEvent.defaultPrevented).toBe(true);
  rerender({ storageKey: 'mine', ready: true, revision: 2, dirty: false, value: { name: 'Cambio' } });
  expect(sessionStorage.getItem('mine')).toBeNull();
  const savedEvent = new Event('beforeunload', { cancelable: true });
  act(() => window.dispatchEvent(savedEvent));
  expect(savedEvent.defaultPrevented).toBe(false);
  expect(result.current.draft).toBeNull();
});

it('si el navegador rechaza el borrador, avisa sin bloquear la edición', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
  const { result } = renderHook(() => useVisualDraft({ storageKey: 'mine', ready: true, revision: 1, dirty: true, value: { name: 'Cambio' } }));
  expect(result.current.storageUnavailable).toBe(true);
  expect(result.current.draft).toBeNull();
});
