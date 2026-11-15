'use client';

import { TrashIcon } from '@phosphor-icons/react';
import { formatStorageFromBytes } from '@/core/formats';
import TagInput from './TagInput';
import { SAFETY_LEVELS, SAFETY_STYLES, TagChip, UploadItem, parseSources } from '../../core/types/uploads';

type Props = {
  items: UploadItem[];  // the selected files that can still be edited
  lockedCount: number;  // selected files that are uploading/uploaded (shown, but not editable)
  onPatch: (patch: (item: UploadItem) => Partial<UploadItem>) => void;
  onRemove: () => void;
};

const sameTag = (a: TagChip, b: TagChip) => a.name === b.name;

export default function UploadEditor({ items, lockedCount, onPatch, onRemove }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-secondary-border bg-secondary p-4 text-sm text-subtle space-y-2">
        <p className="text-white font-medium">Nothing selected</p>
        <p>Click a file to edit its safety, tags, sources and notes.</p>
        <p className="text-xs">Shift-click selects a range. Ctrl/⌘-click adds to the selection.</p>
        {lockedCount > 0 && <p className="text-xs">Files that are uploading or done can&apos;t be edited.</p>}
      </div>
    );
  }

  const single = items.length === 1 ? items[0] : null;
  const commonSafety = items.every((i) => i.safety === items[0].safety) ? items[0].safety : null;

  // Tags every selected file has; editing these adds/removes on all of them
  const commonTags = items[0].tags.filter((t) => items.every((i) => i.tags.some((x) => sameTag(x, t))));
  const partialTags = new Set(items.flatMap((i) => i.tags.map((t) => t.name)));
  commonTags.forEach((t) => partialTags.delete(t.name));

  const changeTags = (next: TagChip[]) => {
    const added = next.filter((t) => !commonTags.some((c) => sameTag(c, t)));
    const removed = commonTags.filter((c) => !next.some((t) => sameTag(t, c)));
    onPatch((item) => ({
      tags: [
        ...item.tags.filter((t) => !removed.some((r) => sameTag(r, t))),
        ...added.filter((a) => !item.tags.some((t) => sameTag(t, a))),
      ],
    }));
  };

  const invalidSources = single ? parseSources(single.sourcesText).invalid : [];

  return (
    <div className="rounded-xl border border-secondary-border bg-secondary p-4 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        {single?.thumbnail && (
          <img src={single.thumbnail} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-white" title={single?.file.name}>
            {single ? single.file.name : `${items.length} files selected`}
          </p>
          <p className="text-xs text-subtle">
            {single
              ? `${formatStorageFromBytes(single.file.size)} · ${single.file.type || 'unknown type'}`
              : 'Changes apply to every selected file'}
          </p>
          {lockedCount > 0 && (
            <p className="text-xs text-yellow-400">
              {lockedCount} more selected {lockedCount === 1 ? 'file is' : 'files are'} uploading or done and won&apos;t change
            </p>
          )}
        </div>
      </div>

      {/* Safety */}
      <div>
        <label className="mb-1.5 block text-xs text-subtle">
          Safety {commonSafety === null && <span className="text-yellow-400">(mixed)</span>}
        </label>
        <div className="grid grid-cols-3 gap-1">
          {SAFETY_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => onPatch(() => ({ safety: level }))}
              className={`rounded px-2 py-1.5 text-xs transition ${
                commonSafety === level ? SAFETY_STYLES[level].active : 'bg-secondary-border text-subtle hover:text-white'
              }`}
            >
              {SAFETY_STYLES[level].label}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1.5 block text-xs text-subtle">Tags</label>
        <TagInput value={commonTags} onChange={changeTags} />
        {partialTags.size > 0 && (
          <p className="mt-1 text-xs text-subtle" title={[...partialTags].join(', ')}>
            +{partialTags.size} tag{partialTags.size === 1 ? '' : 's'} on only some of these files
          </p>
        )}
      </div>

      {/* Sources + notes: one file at a time */}
      {single ? (
        <>
          <div>
            <label className="mb-1.5 block text-xs text-subtle">Sources (one URL per line)</label>
            <textarea
              value={single.sourcesText}
              onChange={(e) => onPatch(() => ({ sourcesText: e.target.value }))}
              rows={3}
              placeholder="https://..."
              className="w-full resize-y rounded-lg border border-secondary-border bg-zinc-900 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
            {invalidSources.length > 0 && (
              <p className="mt-1 text-xs text-red-400">
                Not a valid http(s) URL: {invalidSources.join(', ')}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-subtle">Notes</label>
            <textarea
              value={single.notes}
              onChange={(e) => onPatch(() => ({ notes: e.target.value }))}
              rows={3}
              maxLength={2048}
              className="w-full resize-y rounded-lg border border-secondary-border bg-zinc-900 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </div>
        </>
      ) : (
        <p className="text-xs text-subtle">Select a single file to edit its sources and notes.</p>
      )}

      <button
        onClick={onRemove}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-900 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-900/30"
      >
        <TrashIcon size={14} /> Remove {single ? 'file' : `${items.length} files`}
      </button>
    </div>
  );
}
