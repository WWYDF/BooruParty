'use client';

import { useEffect, useState } from 'react';
import { FolderSimpleIcon, GlobeHemisphereWestIcon, LockSimpleIcon } from '@phosphor-icons/react';
import Button from '@/components/UI/Button';
import InfoModal from '@/components/UI/Modals/InfoModal';
import { useToast } from '@/components/UI/Toast';
import { API, errorText } from '@/core/api';
import { CollectionSummary } from '@/core/types/collections';
import { MAX_COLLECTION_NAME } from './CollectionPopup';

type Props = {
  open: boolean;
  onClose: () => void;
  collection?: CollectionSummary;                    // given = edit it; missing = create a new one
  onSaved: (collection: CollectionSummary) => void;  // the created one, or the edited one with its new values
};

// Create a collection, or rename / change the privacy of one
export default function CollectionModal({ open, onClose, collection, onSaved }: Props) {
  const toast = useToast();
  const editing = !!collection;

  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fresh fields every time it opens
  useEffect(() => {
    if (!open) return;
    setName(collection?.name ?? '');
    setIsPublic(collection?.isPublic ?? true);
  }, [open, collection]);

  const trimmed = name.trim();
  const changed = !editing || trimmed !== collection.name || isPublic !== collection.isPublic;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || !changed || saving) return;
    setSaving(true);

    try {
      if (editing) {
        // PATCH wants only what changed (and at least one field)
        const body: { name?: string, public?: boolean } = {};
        if (trimmed !== collection.name) body.name = trimmed;
        if (isPublic !== collection.isPublic) body.public = isPublic;

        const res = await API(`/api/collections/${collection.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) return toast(errorText(await res.json().catch(() => ({}))), 'error');
        onSaved({ ...collection, name: trimmed, isPublic, updatedAt: new Date().toISOString() });
      } else {
        const res = await API('/api/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed, public: isPublic }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return toast(errorText(data), 'error');
        onSaved(data as CollectionSummary);
      }
      onClose();
    } catch {
      toast('The server could not be reached', 'error');
    } finally {
      setSaving(false);
    }
  };

  const privacyOption = (value: boolean, icon: React.ReactNode, label: string, hint: string) => (
    <button
      type="button"
      onClick={() => setIsPublic(value)}
      aria-pressed={isPublic === value}
      className={`flex flex-1 cursor-pointer flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors ${
        isPublic === value
          ? 'border-accent bg-accent/10'
          : 'border-secondary-border bg-zinc-900 hover:border-zinc-600'
      }`}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-100">{icon}{label}</span>
      <span className="text-xs text-subtle">{hint}</span>
    </button>
  );

  return (
    <InfoModal
      open={open}
      onClose={onClose}
      icon={<FolderSimpleIcon size={24} weight="duotone" className="text-accent" />}
      title={editing ? 'Edit collection' : 'New collection'}
      className="sm:max-w-md md:max-w-md lg:max-w-md"
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-subtle">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_COLLECTION_NAME}
            placeholder="e.g. Wallpapers"
            autoFocus
            required
            className="rounded-lg border border-secondary-border bg-zinc-900 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-hidden"
          />
        </label>

        <div className="flex gap-2">
          {privacyOption(true, <GlobeHemisphereWestIcon size={16} />, 'Public', 'Shown on your profile')}
          {privacyOption(false, <LockSimpleIcon size={16} />, 'Private', 'Only you can see it')}
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!trimmed || !changed}>
            {editing ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </InfoModal>
  );
}
