'use client';

import { useEffect, useState } from 'react';
import { LockSimpleIcon } from '@phosphor-icons/react';
import { useToast } from '@/components/UI/Toast';
import { useSend } from '@/core/api';
import { CollectionSummary } from '@/core/types/collections';
import Section from './Section';
import PickList from './PickList';
import { plural } from './shared';

export default function CollectionSection({ postIds }: { postIds: number[] }) {
  const toast = useToast();
  const send = useSend();
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<{ id: string; action: 'add' | 'remove' } | null>(null);

  const load = async () => {
    const data = await send<{ collections: CollectionSummary[] }>('/api/collections/own', 'GET');
    setCollections((prev) => data?.collections ?? prev ?? []); // a failed reload keeps the list it had
  };

  useEffect(() => { load(); }, []);

  const add = async (c: CollectionSummary) => {
    setBusy({ id: c.id, action: 'add' });
    const data = await send<{ added: number }>(`/api/collections/${c.id}/posts`, 'POST', { postIds });
    setBusy(null);
    if (!data) return;

    toast(data.added ? `Added ${plural(data.added)} to ${c.name}` : `All of these are already in ${c.name}`, data.added ? 'success' : 'error');
    setCollections((prev) => prev?.map((p) => (p.id === c.id ? { ...p, itemCount: p.itemCount + data.added } : p)) ?? prev);
  };

  // The remove route answers 204 without a count, so reload the list for the new totals
  const remove = async (c: CollectionSummary) => {
    setBusy({ id: c.id, action: 'remove' });
    const data = await send(`/api/collections/${c.id}/posts`, 'DELETE', { postIds });
    setBusy(null);
    if (!data) return;

    toast(`Removed the selected posts from ${c.name}`, 'success');
    load();
  };

  const needle = query.trim().toLowerCase();
  const shown = collections?.filter((c) => c.name.toLowerCase().includes(needle)) ?? null;

  return (
    <Section title="Collections" hint="Add or remove every selected post. Ones already in (or not in) a collection are skipped." instant grow>
      <PickList
        items={shown}
        query={query}
        onQuery={setQuery}
        placeholder="Filter your collections..."
        empty={collections?.length ? 'No collection matches that' : "You don't have any collections yet"}
        meta={(c) => (
          <span className="inline-flex items-center gap-1">
            {!c.isPublic && <LockSimpleIcon size={12} />}
            {plural(c.itemCount)}
          </span>
        )}
        busy={busy}
        onAdd={add}
        onRemove={remove}
      />
    </Section>
  );
}
