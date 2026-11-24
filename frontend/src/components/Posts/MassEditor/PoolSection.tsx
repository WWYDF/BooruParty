'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/UI/Toast';
import { API, useSend } from '@/core/api';
import { PoolList, PoolSummary } from '@/core/types/pools';
import Section from './Section';
import PickList from './PickList';
import { plural } from './shared';

const POOL_RESULTS = 50; // pools listed per search

export default function PoolSection({ postIds, className = '' }: { postIds: number[]; className?: string }) {
  const toast = useToast();
  const send = useSend();
  const [query, setQuery] = useState('');
  const [pools, setPools] = useState<PoolSummary[] | null>(null);
  const [busy, setBusy] = useState<{ id: number; action: 'add' | 'remove' } | null>(null);
  const [reload, setReload] = useState(0); // bumped after a removal to refetch the counts

  // Plain API() here, not useSend: typing aborts the previous search, and useSend would toast every abort
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: query.trim(), limit: String(POOL_RESULTS) });
        const res = await API(`/api/pools?${params}`, { signal: controller.signal });
        const data: PoolList | null = res.ok ? await res.json() : null;
        setPools(data?.pools ?? []);
      } catch {
        // aborted because the user kept typing
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, reload]);

  // Appends in the order postIds are given (the feed's order)
  const add = async (pool: PoolSummary) => {
    setBusy({ id: pool.id, action: 'add' });
    const data = await send<{ added: number[] }>(`/api/pools/${pool.id}/posts`, 'POST', { postIds });
    setBusy(null);
    if (!data) return;

    const added = data.added.length;
    toast(added ? `Added ${plural(added)} to ${pool.name}` : `All of these are already in ${pool.name}`, added ? 'success' : 'error');
    setPools((prev) => prev?.map((p) => (p.id === pool.id ? { ...p, postCount: p.postCount + added } : p)) ?? prev);
  };

  // The remove route answers 204 without a count, so refetch for the new totals
  const remove = async (pool: PoolSummary) => {
    setBusy({ id: pool.id, action: 'remove' });
    const data = await send(`/api/pools/${pool.id}/posts`, 'DELETE', { postIds });
    setBusy(null);
    if (!data) return;

    toast(`Removed the selected posts from ${pool.name}`, 'success');
    setReload((n) => n + 1);
  };

  return (
    <Section
      title="Pools"
      hint="Added posts go to the end of the pool, in feed order. Posts not in a pool are skipped when removing."
      instant
      grow
      className={className}
    >
      <PickList
        items={pools}
        query={query}
        onQuery={setQuery}
        placeholder="Search pools..."
        empty="No pools found"
        meta={(p) => plural(p.postCount)}
        busy={busy}
        onAdd={add}
        onRemove={remove}
      />
    </Section>
  );
}
