'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GlobeHemisphereWestIcon, LockSimpleIcon, MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react';
import Button from '@/components/UI/Button';
import Checkbox from '@/components/UI/Checkbox';
import { useToast } from '@/components/UI/Toast';
import { API, errorText } from '@/core/api';
import { CollectionSummary, OwnCollection } from '@/core/types/collections';

export const MAX_COLLECTION_NAME = 32; // backend MAX_COLLECTION_NAME_LENGTH

type Props = {
  postId: number;
  collections: OwnCollection[] | null; // null = still loading
  failed: boolean;                     // the parent's GET /own failed
  onChange: (update: (prev: OwnCollection[]) => OwnCollection[]) => void; // functional, so quick toggles don't overwrite each other
  onClose: () => void;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Little popup above the Collection button: tick a collection to save this post to it (instantly), search, or make a new one.
// Must be rendered inside the same relative wrapper as the button: clicks on the button itself don't count as "outside".
export default function CollectionPopup({ postId, collections, failed, onChange, onClose }: Props) {
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<string[]>([]); // collection ids with a request in flight

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Close on Escape or a click outside the wrapper (the button toggles it instead)
  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      const wrapper = ref.current?.parentElement;
      if (wrapper && !wrapper.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? (collections ?? []).filter((c) => c.name.toLowerCase().includes(term)) : (collections ?? []);
  }, [collections, search]);

  const setHasPost = (id: string, hasPost: boolean) =>
    onChange((prev) => prev.map((c) => (c.id === id ? { ...c, hasPost, itemCount: c.itemCount + (hasPost ? 1 : -1) } : c)));

  // Optimistic: tick right away, put it back if the server says no
  const toggle = async (c: OwnCollection) => {
    if (pending.includes(c.id)) return;
    const next = !c.hasPost;
    setPending((p) => [...p, c.id]);
    setHasPost(c.id, next);

    try {
      const res = await API(`/api/collections/${c.id}/posts`, {
        method: next ? 'POST' : 'DELETE',
        headers: JSON_HEADERS,
        body: JSON.stringify({ postIds: [postId] }),
      });
      if (!res.ok) {
        setHasPost(c.id, !next);
        toast(errorText(await res.json().catch(() => ({}))), 'error');
      }
    } catch {
      setHasPost(c.id, !next);
      toast('The server could not be reached', 'error');
    } finally {
      setPending((p) => p.filter((id) => id !== c.id));
    }
  };

  // The search text is usually the name they were looking for
  const openCreate = () => {
    setName(search.trim().slice(0, MAX_COLLECTION_NAME));
    setCreating(true);
  };

  // Create it, then save this post into it
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);

    try {
      const res = await API('/api/collections', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ name: trimmed, public: !isPrivate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast(errorText(data), 'error');
      const created = data as CollectionSummary;

      let added = false;
      try {
        const addRes = await API(`/api/collections/${created.id}/posts`, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ postIds: [postId] }),
        });
        added = addRes.ok;
      } catch { /* reported below */ }
      if (!added) toast(`Created "${created.name}", but couldn't add this post to it`, 'error');

      onChange((prev) => [{ ...created, hasPost: added, itemCount: added ? 1 : 0 }, ...prev]);
      setCreating(false);
      setName('');
      setIsPrivate(false);
      setSearch('');
    } catch {
      toast('The server could not be reached', 'error');
    } finally {
      setSaving(false);
    }
  };

  const total = collections?.length ?? 0;
  const exactMatch = (collections ?? []).some((c) => c.name.toLowerCase() === search.trim().toLowerCase());

  // One status line (loading / error / empty); keyed so switching between them cross-fades
  const status = failed
    ? { key: 'failed', text: 'Could not load your collections.', className: 'text-red-400' }
    : collections === null
      ? { key: 'loading', text: 'Loading...', className: 'animate-pulse' }
      : total === 0
        ? { key: 'none', text: "You don't have any collections yet.", className: '' }
        : shown.length === 0
          ? { key: 'nomatch', text: 'No collections match.', className: '' }
          : null;

  return (
    // Positioning lives on a plain div: framer-motion owns `transform` on the animated one
    <div ref={ref} className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2">
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.96, transition: { duration: 0.12 } }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        style={{ originY: 1 }} // grow up out of the button
        className="w-72 overflow-hidden rounded-lg border border-secondary-border bg-zinc-950 p-2 text-xs text-subtle shadow-lg"
      >
        {total > 0 && (
          <label className="mb-1.5 flex items-center gap-1.5 rounded-md border border-secondary-border bg-zinc-900 px-2 py-1.5 focus-within:border-zinc-600">
            <MagnifyingGlassIcon size={14} className="shrink-0 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your collections"
              autoFocus
              className="w-full bg-transparent text-zinc-200 placeholder:text-zinc-500 focus:outline-hidden"
            />
          </label>
        )}

        <AnimatePresence mode="popLayout" initial={false}>
          {status && (
            <motion.p
              key={status.key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={`px-1 py-1 ${status.className}`}
            >
              {status.text}
            </motion.p>
          )}
        </AnimatePresence>

        {shown.length > 0 && (
          <ul className="flex max-h-60 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
            {shown.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-zinc-900">
                <Checkbox
                  checked={c.hasPost}
                  onChange={() => toggle(c)}
                  className="min-w-0 flex-1"
                  label={
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{c.name}</span>
                      {!c.isPublic && <LockSimpleIcon size={12} className="shrink-0 text-zinc-500" aria-label="Private" />}
                    </span>
                  }
                />
                <span className="shrink-0 tabular-nums text-zinc-500">{c.itemCount}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Create: a button that opens a small inline form */}
        {collections !== null && !failed && (
          <div className="mt-1.5 border-t border-secondary-border pt-1.5">
            {creating ? (
              <form onSubmit={create} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Collection name"
                    maxLength={MAX_COLLECTION_NAME}
                    autoFocus
                    className="min-w-0 flex-1 rounded-md border border-secondary-border bg-zinc-900 px-2 py-1.5 text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPrivate((p) => !p)}
                    title={isPrivate ? 'Private: only you can see it' : 'Public: anyone can see it'}
                    aria-pressed={isPrivate}
                    className={`flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 py-1.5 transition-colors ${
                      isPrivate
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                        : 'border-secondary-border bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {isPrivate ? <LockSimpleIcon size={14} /> : <GlobeHemisphereWestIcon size={14} />}
                    {isPrivate ? 'Private' : 'Public'}
                  </button>
                </div>
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" onClick={() => setCreating(false)}>Cancel</Button>
                  <Button size="sm" type="submit" variant="primary" loading={saving} disabled={!name.trim()}>
                    Create & Save
                  </Button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={openCreate}
                className="flex w-full cursor-pointer items-center gap-1.5 rounded px-1 py-1 text-accent transition-colors hover:bg-zinc-900"
              >
                <PlusIcon size={12} weight="bold" />
                <span className="truncate">
                  {search.trim() && !exactMatch ? `New collection "${search.trim()}"` : 'New Collection'}
                </span>
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
