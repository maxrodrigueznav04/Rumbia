import { useEffect, useRef, useState } from 'react';

// Drafts stay in this tab and are scoped to the authenticated account and agency.
// They never replace the saved design without an explicit recovery action.
export default function useVisualDraft({ storageKey, ready, revision, value, dirty }) {
  const [draft, setDraft] = useState(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const loadedKey = useRef(null);
  const pending = useRef(null);

  useEffect(() => {
    if (!ready || !storageKey || loadedKey.current === storageKey) return;
    loadedKey.current = storageKey;
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      pending.current = stored?.schema === 1 && stored.value ? stored : null;
      setDraft(pending.current);
    } catch { setStorageUnavailable(true); }
  }, [ready, storageKey]);

  useEffect(() => {
    if (!ready || !storageKey || loadedKey.current !== storageKey || pending.current) return;
    try {
      if (dirty) sessionStorage.setItem(storageKey, JSON.stringify({ schema: 1, revision, value }));
      else sessionStorage.removeItem(storageKey);
    } catch { setStorageUnavailable(true); }
  }, [ready, storageKey, revision, value, dirty]);

  useEffect(() => {
    if (!dirty && !draft) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, draft]);

  const discard = () => {
    pending.current = null;
    setDraft(null);
    try { sessionStorage.removeItem(storageKey); } catch { setStorageUnavailable(true); }
  };
  const recover = () => {
    const value = pending.current?.value;
    pending.current = null;
    setDraft(null);
    return value;
  };
  return { draft, stale: Boolean(draft && draft.revision !== revision), recover, discard, storageUnavailable };
}
