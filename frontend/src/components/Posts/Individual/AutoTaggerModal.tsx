'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { CheckCircleIcon, PlusCircleIcon, RobotIcon, SpinnerGapIcon, XCircleIcon } from '@phosphor-icons/react';
import InfoModal from '@/components/UI/Modals/InfoModal';
import Button from '@/components/UI/Button';
import { API, errorText } from '@/core/api';
import { formatCounts } from '@/core/formats';
import { AutoTagResult } from '@/core/types/addons';
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

const percent = (score: number) => `${(score * 100).toFixed(1)}%`;

// PASSIVE mode: asks the server's AutoTagger about this post and lets the editor pick tags to add.
// Nothing is saved here; picked tags go into the editor like typed ones.
export default function AutoTaggerModal({ open, onClose, postId, previewUrl, colorFor, currentNames, canCreateTags, onAdd }: Props) {
  const [result, setResult] = useState<{ postId: number; data: AutoTagResult } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickedTags, setPickedTags] = useState<Set<number>>(new Set());
  const [pickedNew, setPickedNew] = useState<Set<string>>(new Set());

  // Fresh selection every time it opens
  useEffect(() => {
    if (!open) return;
    setPickedTags(new Set());
    setPickedNew(new Set());
  }, [open]);

  // One request per post: reopening the modal reuses the answer (the image didn't change)
  useEffect(() => {
    if (!open || result?.postId === postId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    API(`/api/posts/${postId}/autotag`, { method: 'POST' })
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

  const current = new Set(currentNames);
  const matches = (result?.data.matches ?? []).filter((m) => !current.has(m.tag.name));
  const missing = (result?.data.missing ?? []).filter((n) => !current.has(n.name));

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const allTagsPicked = matches.length > 0 && matches.every((m) => pickedTags.has(m.tag.id));
  const allNewPicked = missing.length > 0 && missing.every((n) => pickedNew.has(n.name));
  const total = pickedTags.size + pickedNew.size;

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

  return (
    <InfoModal
      open={open}
      onClose={onClose}
      icon={<RobotIcon size={22} className="text-accent" />}
      title="AutoTagger"
      subtitle="Pick the suggestions to add. Nothing changes until you save the post."
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Preview */}
        <div className="flex items-start justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={`Post #${postId}`}
            className="max-h-48 w-full rounded-lg border border-secondary-border object-contain md:max-h-[60vh]"
          />
        </div>

        {/* Suggestions */}
        <div className="min-w-0 space-y-4">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-subtle">
              <SpinnerGapIcon size={16} className="animate-spin" /> Asking the AutoTagger...
            </p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {!loading && !error && result && (
            <>
              <Section
                title="Existing tags"
                tone="text-green-400"
                empty={matches.length === 0}
                allPicked={allTagsPicked}
                onToggleAll={() => setPickedTags(allTagsPicked ? new Set() : new Set(matches.map((m) => m.tag.id)))}
              >
                {matches.map((m) => (
                  <Row
                    key={m.tag.id}
                    picked={pickedTags.has(m.tag.id)}
                    onClick={() => setPickedTags((s) => toggle(s, m.tag.id))}
                    label={m.tag.name}
                    color={colorFor(m.tag.categoryId)}
                    note={m.matchedName !== m.tag.name ? `via ${m.matchedName}` : undefined}
                    score={m.score}
                    count={m.tag.postCount}
                  />
                ))}
              </Section>

              <Section
                title="New tags"
                tone="text-yellow-300"
                empty={missing.length === 0}
                allPicked={allNewPicked}
                onToggleAll={canCreateTags ? () => setPickedNew(allNewPicked ? new Set() : new Set(missing.map((n) => n.name))) : undefined}
                hint={canCreateTags ? 'Created when you save the post.' : "You can't create tags, so these can't be added."}
              >
                {missing.map((n) => (
                  <Row
                    key={n.name}
                    picked={pickedNew.has(n.name)}
                    onClick={canCreateTags ? () => setPickedNew((s) => toggle(s, n.name)) : undefined}
                    label={n.name}
                    score={n.score}
                    dashed
                  />
                ))}
              </Section>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="success" icon={<PlusCircleIcon size={14} />} disabled={total === 0} onClick={handleAdd}>
          Add {total > 0 ? total : ''} tag{total === 1 ? '' : 's'}
        </Button>
      </div>
    </InfoModal>
  );
}

function Section({ title, tone, empty, allPicked, onToggleAll, hint, children }: {
  title: string;
  tone: string;
  empty: boolean;
  allPicked: boolean;
  onToggleAll?: () => void;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className={clsx('text-xs font-medium', tone)}>{title}</h3>
        {onToggleAll && !empty && (
          <button
            type="button"
            onClick={onToggleAll}
            className="inline-flex cursor-pointer items-center gap-1 text-xs text-accent hover:underline"
          >
            {allPicked ? <><XCircleIcon size={14} /> Deselect all</> : <><CheckCircleIcon size={14} /> Select all</>}
          </button>
        )}
      </div>
      {hint && !empty && <p className="mb-1.5 text-xs text-subtle">{hint}</p>}
      {empty ? (
        <p className="text-sm text-zinc-600">None.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">{children}</ul>
      )}
    </div>
  );
}

function Row({ picked, onClick, label, color, note, score, count, dashed }: {
  picked: boolean;
  onClick?: () => void; // undefined = can't be picked
  label: string;
  color?: string;
  note?: string;
  score: number;
  count?: number;
  dashed?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={picked}
        onClick={onClick}
        disabled={!onClick}
        className={clsx(
          'flex w-full items-center gap-3 rounded-lg border px-3 py-1.5 text-left text-sm transition-colors',
          dashed && 'border-dashed',
          picked ? 'border-accent/40 bg-accent/10' : 'border-secondary-border bg-zinc-900/40 hover:bg-zinc-900/80',
          onClick ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
        )}
      >
        <span className="min-w-0 flex-1 truncate" style={{ color: color ?? '#3c9aff' }} title={label}>
          {label}
          {note && <span className="ml-1.5 text-xs text-subtle">({note})</span>}
          {count !== undefined && <span className="ml-1.5 text-xs text-zinc-500">{formatCounts(count)}</span>}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-subtle">{percent(score)}</span>
      </button>
    </li>
  );
}
