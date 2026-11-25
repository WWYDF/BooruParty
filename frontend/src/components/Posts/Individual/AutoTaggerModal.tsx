'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircleIcon, MinusCircleIcon, PlusCircleIcon, XCircleIcon, XIcon } from '@phosphor-icons/react';
import LoadingInline from '@/components/UI/LoadingInline';
import { useLockBodyScroll } from '@/core/hooks/bodyScroll';
import { API, errorText } from '@/core/api';
import { AutoTagMatch, AutoTagResult } from '@/core/types/addons';
import { TagChip } from '@/core/types/uploads';

type Props = {
  open: boolean;
  onClose: () => void;
  postId: number;
  previewUrl: string;
  colorFor: (categoryId: number) => string | undefined;
  currentNames: string[];  // tags already in the editor, hidden from the suggestions
  canCreateTags: boolean;  // without tags.create, unknown names are shown but can't be picked
  onAdd: (chips: TagChip[]) => void;
};

type NewRow = { name: string; score: number };

const confidence = (score: number) => `Confidence: ${(score * 100).toFixed(1)}%`;

// PASSIVE mode: asks the server's AutoTagger about this post and lets the editor pick tags to add.
// Nothing is saved here; picked tags go into the editor like typed ones.
export default function AutoTaggerModal({ open, onClose, postId, previewUrl, colorFor, currentNames, canCreateTags, onAdd }: Props) {
  const [result, setResult] = useState<{ postId: number; data: AutoTagResult } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickedTags, setPickedTags] = useState<Set<number>>(new Set());
  const [pickedNew, setPickedNew] = useState<Set<string>>(new Set());
  const [mobileTab, setMobileTab] = useState<'matches' | 'new'>('matches');

  useLockBodyScroll(open);

  // Fresh selection every time it opens
  useEffect(() => {
    if (!open) return;
    setPickedTags(new Set());
    setPickedNew(new Set());
    setMobileTab('matches');
  }, [open]);

  // One request per post: reopening the modal reuses the answer (the image didn't change)
  useEffect(() => {
    if (!open || result?.postId === postId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    API(`/api/posts/${postId}/autotag`, { method: 'GET' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) setResult({ postId, data });
        else setError(errorText(data));
      })
      .catch(() => { if (!cancelled) setError('The server could not be reached'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, postId, result?.postId]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const current = new Set(currentNames);
  const matches = (result?.data.matches ?? []).filter((m) => !current.has(m.tag.name));
  const missing = (result?.data.missing ?? []).filter((n) => !current.has(n.name));

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const allMatchedSelected = matches.length > 0 && matches.every((m) => pickedTags.has(m.tag.id));
  const allNewSelected = missing.length > 0 && missing.every((n) => pickedNew.has(n.name));
  const toggleAllMatched = () => setPickedTags(allMatchedSelected ? new Set() : new Set(matches.map((m) => m.tag.id)));
  const toggleAllNew = () => setPickedNew(allNewSelected ? new Set() : new Set(missing.map((n) => n.name)));

  const totalSelected = pickedTags.size + pickedNew.size;

  const handleAdd = () => {
    const chips: TagChip[] = [
      ...matches
        .filter((m) => pickedTags.has(m.tag.id))
        .map((m) => ({ name: m.tag.name, color: colorFor(m.tag.categoryId), postCount: m.tag.postCount })),
      ...(canCreateTags ? missing.filter((n) => pickedNew.has(n.name)).map((n) => ({ name: n.name, isNew: true })) : []),
    ];
    onAdd(chips);
    onClose();
  };

  const status = (
    <>
      <LoadingInline show={loading} label="Querying AutoTagger Service..." className="text-sm text-zinc-300" animatedExit={false} />
      {error && <div className="text-sm text-red-300">Error: {error}</div>}
    </>
  );

  const matchesColumn = (
    <MatchesColumn
      matches={matches}
      picked={pickedTags}
      allSelected={allMatchedSelected}
      onToggleAll={toggleAllMatched}
      onToggle={(id) => setPickedTags((s) => toggle(s, id))}
      colorFor={colorFor}
    />
  );

  const newColumn = (
    <NewColumn
      rows={missing}
      picked={pickedNew}
      allSelected={allNewSelected}
      onToggleAll={toggleAllNew}
      onToggle={(name) => setPickedNew((s) => toggle(s, name))}
      canCreate={canCreateTags}
    />
  );

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="autotagger-modal"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed inset-0 z-1000 flex items-stretch justify-center md:items-center"
        >
          <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Automatic Tagger"
            className="relative z-10 flex h-dvh w-full flex-col rounded-none border border-zinc-800 bg-zinc-900/90 shadow-xl
              md:h-auto md:max-h-[90vh] md:w-[80%] md:rounded-2xl"
          >
            {/* Header */}
            <div className="flex flex-none items-center justify-between border-b border-zinc-800 px-4 py-3">
              <h3 className="text-base font-semibold text-white">Automatic Tagger — Manual Version</h3>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded p-2 transition hover:bg-zinc-800"
                aria-label="Close"
              >
                <XIcon size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
              {/* MOBILE: preview on top, tabs between the two lists */}
              <div className="flex h-full min-h-0 flex-col md:hidden">
                <div className="flex-none rounded-xl p-3">
                  <div className="h-[24dvh] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Preview" className="h-full w-full rounded object-contain" />
                  </div>
                </div>

                <div className="mt-3 grid flex-none grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileTab('matches')}
                    className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm transition ${
                      mobileTab === 'matches'
                        ? 'border-emerald-800 bg-emerald-600/10 text-emerald-300'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    Matches
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileTab('new')}
                    className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm transition ${
                      mobileTab === 'new'
                        ? 'border-amber-800 bg-amber-600/10 text-amber-300'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    New
                  </button>
                </div>

                <div
                  className="mt-3 min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain rounded-xl border border-zinc-800 bg-zinc-950 p-3"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {status}
                  {!loading && !error && result && (mobileTab === 'matches' ? matchesColumn : newColumn)}
                </div>
              </div>

              {/* DESKTOP: preview left, the two lists side by side on the right */}
              <div className="hidden h-full gap-4 md:flex">
                <div className="flex w-[40%] shrink-0 flex-col items-center rounded-xl p-3">
                  <div className="mb-2 text-xs text-zinc-400">Post Preview</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-[70vh] w-full rounded border border-black object-contain shadow-xl"
                  />
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/75 p-3">
                    {status}
                    {!loading && !error && result && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex min-h-0 flex-col">{matchesColumn}</div>
                        <div className="flex min-h-0 flex-col">{newColumn}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-none items-center justify-end gap-2 border-t border-zinc-800 px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-xl bg-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
              >
                Close
              </button>
              <button
                type="button"
                disabled={totalSelected === 0}
                onClick={handleAdd}
                className={`rounded-xl px-3 py-1.5 text-sm font-medium shadow-sm transition ${
                  totalSelected > 0
                    ? 'cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'cursor-not-allowed bg-emerald-600/40 text-white/70'
                }`}
              >
                Add {totalSelected > 0 && `(${totalSelected})`}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function SelectAllButton({ allSelected, disabled, onClick }: { allSelected: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs transition ${
        allSelected
          ? 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
          : 'border-emerald-800 bg-emerald-600/10 text-emerald-300 hover:bg-emerald-600/20'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {allSelected ? <><XCircleIcon size={14} /> Deselect All</> : <><CheckCircleIcon size={14} /> Select All</>}
    </button>
  );
}

function PickButton({ selected, onClick, disabled, addTitle, name }: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  addTitle: string;
  name: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ml-3 inline-flex shrink-0 cursor-pointer items-center rounded-md p-1.5 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      aria-label={selected ? `Remove ${name}` : `${addTitle} ${name}`}
      title={disabled ? "You can't create tags" : selected ? 'Remove' : addTitle}
    >
      {selected
        ? <MinusCircleIcon size={18} className="text-red-400" weight="fill" />
        : <PlusCircleIcon size={18} className="text-emerald-400" weight="fill" />}
    </button>
  );
}

function MatchesColumn({ matches, picked, allSelected, onToggleAll, onToggle, colorFor }: {
  matches: AutoTagMatch[];
  picked: Set<number>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggle: (tagId: number) => void;
  colorFor: (categoryId: number) => string | undefined;
}) {
  return (
    <>
      <div className="flex flex-none items-center justify-between">
        <div className="text-xs font-medium text-emerald-300">Matches on server</div>
        <SelectAllButton allSelected={allSelected} disabled={matches.length === 0} onClick={onToggleAll} />
      </div>
      <div className="mt-2 max-h-[75vh] flex-1 overflow-y-auto pr-1">
        <ul className="space-y-2">
          {matches.length === 0 ? (
            <li className="text-sm text-zinc-500">None.</li>
          ) : matches.map((m) => (
            <li key={m.tag.id} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1">
              <div className="min-w-0">
                <div
                  className="flex items-center gap-1 truncate font-medium"
                  style={{ color: colorFor(m.tag.categoryId) }}
                  title={m.tag.name}
                >
                  {m.tag.name}
                  {m.matchedName !== m.tag.name && <span className="text-xs text-subtle">({m.matchedName})</span>}
                </div>
                <div className="truncate text-xs text-zinc-500">{confidence(m.score)}</div>
              </div>
              <PickButton selected={picked.has(m.tag.id)} onClick={() => onToggle(m.tag.id)} addTitle="Add" name={m.tag.name} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function NewColumn({ rows, picked, allSelected, onToggleAll, onToggle, canCreate }: {
  rows: NewRow[];
  picked: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggle: (name: string) => void;
  canCreate: boolean;
}) {
  return (
    <>
      <div className="flex flex-none items-center justify-between">
        <div className="text-xs font-medium text-amber-300">Not found on server</div>
        <SelectAllButton allSelected={allSelected} disabled={rows.length === 0 || !canCreate} onClick={onToggleAll} />
      </div>
      {!canCreate && rows.length > 0 && (
        <p className="mt-1 text-xs text-zinc-500">You don&apos;t have permission to create tags.</p>
      )}
      <div className="mt-2 max-h-[75vh] flex-1 overflow-y-auto pr-1">
        <ul className="space-y-2">
          {rows.length === 0 ? (
            <li className="text-sm text-zinc-500">None.</li>
          ) : rows.map((n) => (
            <li key={n.name} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1">
              <div className="min-w-0">
                <span className="block truncate text-zinc-300" title={n.name}>{n.name}</span>
                <span className="block truncate text-xs text-zinc-500">{confidence(n.score)}</span>
              </div>
              <PickButton
                selected={picked.has(n.name)}
                onClick={() => onToggle(n.name)}
                disabled={!canCreate}
                addTitle="Create & add"
                name={n.name}
              />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
