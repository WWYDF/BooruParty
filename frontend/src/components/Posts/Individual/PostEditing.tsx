'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowCounterClockwiseIcon,
  FileArrowUpIcon,
  FloppyDiskIcon,
  ImageSquareIcon,
  TagIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react';
import { formatCounts } from '@/core/formats';
import Button from '@/components/UI/Button';
import ConfirmModal from '@/components/UI/Modals/ConfirmModal';
import { useToast } from '@/components/UI/Toast';
import { useUser } from '@/components/UserProvider';
import TagInput from '@/components/Uploads/TagInput';
import RelatedPostInput from './PostRelation';
import AutoTaggerModal from './AutoTaggerModal';
import { autoTaggerHas, useAddons } from '@/core/hooks/useAddons';
import { CategoryInfo } from '@/core/types/tags';
import { API, APIUpload, UploadResponse, errorText } from '@/core/api';
import { PostDetail, Safety } from '@/core/types/posts';
import { SAFETY_LEVELS, SAFETY_STYLES, TagChip, parseSources } from '@/core/types/uploads';

type Props = {
  post: PostDetail;
  categories: Map<number, CategoryInfo>;
  onSaved: () => void;   // reload the post; PATCH returns 204, so there's nothing to show from it
  onDeleted: () => void;
};

// Thumbnail change, staged until Save: a new image, or back to the automatic ones
type ThumbChange = { kind: 'replace'; file: File } | { kind: 'reset' } | null;

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const sameSet = (a: string[], b: string[]) => sameList([...a].sort(), [...b].sort());

const inputClass =
  'w-full resize-y rounded-lg border border-secondary-border bg-zinc-900 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-zinc-600';

// The error from a multipart upload, including which post a duplicate matches
function uploadError(res: UploadResponse) {
  if (res.status === 409 && res.data?.duplicateOf) return `Duplicate of post #${res.data.duplicateOf}`;
  return errorText(res.data ?? {});
}

export default function PostEditing({ post, categories, onSaved, onDeleted }: Props) {
  const { user } = useUser();
  const toast = useToast();

  const colorFor = (categoryId: number) => categories.get(categoryId)?.color;

  const [safety, setSafety] = useState<Safety>(post.safety);
  const [sourcesText, setSourcesText] = useState(post.sources.join('\n'));
  const [notes, setNotes] = useState(post.notes ?? '');
  // The post's tags in the same order the post page shows them: category index, then name
  const [originalOrder] = useState<string[]>(() =>
    [...post.tags]
      .sort((a, b) =>
        (categories.get(a.categoryId)?.index ?? Infinity) - (categories.get(b.categoryId)?.index ?? Infinity)
        || a.name.localeCompare(b.name))
      .map((t) => t.name),
  );

  const [tags, setTags] = useState<TagChip[]>(() => {
    const byName = new Map(post.tags.map((t) => [t.name, t]));
    return originalOrder.map((name) => {
      const t = byName.get(name)!;
      return { name: t.name, color: colorFor(t.categoryId), postCount: t.postCount };
    });
  });

  // Names added during this edit, newest batch first ("pikachu, pokemon, nintendo" stays together).
  // Local only: after a save the post reloads in normal order, and the next edit starts fresh.
  const [addOrder, setAddOrder] = useState<string[]>([]);

  // Latest tags, for callbacks that finish after a re-render (TagInput waits for implications)
  const tagsRef = useRef(tags);
  tagsRef.current = tags;

  const changeTags = (next: TagChip[]) => {
    const before = new Set(tagsRef.current.map((t) => t.name));
    const batch = next.map((t) => t.name).filter((name) => !before.has(name));
    if (batch.length) setAddOrder((order) => [...batch, ...order.filter((name) => !batch.includes(name))]);
    setTags(next);
  };

  const removeTag = (name: string) => {
    setTags((prev) => prev.filter((t) => t.name !== name));
    setAddOrder((order) => order.filter((n) => n !== name)); // re-adding it later puts it back on top
  };

  // Shown under the input: this edit's additions on top, then the remaining original tags
  const byName = new Map(tags.map((t) => [t.name, t]));
  const addedSet = new Set(addOrder);
  const displayTags = [...addOrder, ...originalOrder.filter((name) => !addedSet.has(name))]
    .map((name) => byName.get(name))
    .filter((t): t is TagChip => t !== undefined);

  // Related posts: the ones this user can see (the server keeps any hidden ones on save)
  const originalRelated = post.related.map((r) => r.id);
  const [relatedPosts, setRelatedPosts] = useState<number[]>(originalRelated);

  // No backend yet: renders and can be changed, but is never sent
  const [pools, setPools] = useState<number[]>([]);

  const [newFile, setNewFile] = useState<File | null>(null);
  const [thumb, setThumb] = useState<ThumbChange>(null);
  const [status, setStatus] = useState<string | null>(null); // non-null while saving/deleting; shown on the Save button
  const [showDelete, setShowDelete] = useState(false);
  const [showAutoTagger, setShowAutoTagger] = useState(false);
  const addons = useAddons();

  const fileInput = useRef<HTMLInputElement>(null);
  const thumbInput = useRef<HTMLInputElement>(null);

  const busy = status !== null;
  const hasPerm = (perm: string) => user?.permissions.includes(perm) ?? false;
  const isOwner = !!user && user.id === post.uploader.id;
  const canDelete = hasPerm('posts.delete.others') || (isOwner && hasPerm('posts.delete.own'));
  const canCreateTags = hasPerm('tags.create');
  const isVideo = post.type === 'VIDEO'; // only videos get a custom-thumbnail option

  const invalidSources = parseSources(sourcesText).invalid;

  const progressLabel = (what: string) => (fraction: number) =>
    setStatus(fraction >= 1 ? `Processing ${what}...` : `Uploading ${what}... ${Math.round(fraction * 100)}%`);

  const handleSave = async () => {
    const { valid: sources, invalid } = parseSources(sourcesText);
    if (invalid.length) {
      toast(`Not a valid http(s) URL: ${invalid.join(', ')}`, 'error');
      return;
    }

    // PATCH semantics: only send what changed
    const body: Record<string, unknown> = {};
    if (safety !== post.safety) body.safety = safety;
    if (!sameList(sources, post.sources)) body.sources = sources;
    if (notes.trim() !== (post.notes ?? '')) body.notes = notes.trim() || null;
    const tagNames = tags.map((t) => t.name);
    if (!sameSet(tagNames, post.tags.map((t) => t.name))) body.tags = tagNames;
    if (!sameSet(relatedPosts.map(String), originalRelated.map(String))) body.related = relatedPosts;

    const hasFields = Object.keys(body).length > 0;
    if (!hasFields && !newFile && !thumb) {
      toast('Nothing to save', 'info');
      return;
    }

    // Once the fields are saved, later failures say so, since the post did change
    let fieldsSaved = false;
    const fail = (message: string) => toast(fieldsSaved ? `Changes saved, but ${message}` : message, 'error');

    try {
      // 1. Fields + tags
      if (hasFields) {
        setStatus('Saving...');
        const res = await API(`/api/posts/${post.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) return fail(errorText(await res.json().catch(() => ({}))));
        fieldsSaved = true;
      }

      // 2. File
      if (newFile) {
        const form = new FormData();
        form.append('file', newFile);
        const res = await APIUpload(`/api/posts/${post.id}/file`, form, progressLabel('file'), 'PUT');
        if (res.status !== 204) return fail(`replacing the file failed: ${uploadError(res)}`);
        setNewFile(null);
        fieldsSaved = true;
      }

      // 3. Thumbnail
      if (thumb?.kind === 'replace') {
        const form = new FormData();
        form.append('file', thumb.file);
        const res = await APIUpload(`/api/posts/${post.id}/thumbnail`, form, progressLabel('thumbnail'), 'PUT');
        if (res.status !== 204) return fail(`replacing the thumbnail failed: ${uploadError(res)}`);
      } else if (thumb?.kind === 'reset') {
        setStatus('Resetting thumbnail...');
        const res = await API(`/api/posts/${post.id}/thumbnail`, { method: 'DELETE' });
        if (!res.ok) return fail(`resetting the thumbnail failed: ${errorText(await res.json().catch(() => ({})))}`);
      }

      toast('Post saved', 'success');
      onSaved();
    } catch {
      fail('the server could not be reached');
    } finally {
      setStatus(null);
    }
  };

  const handleDelete = async () => {
    setShowDelete(false);
    setStatus('Deleting...');
    try {
      const res = await API(`/api/posts/${post.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast(`Deleted post #${post.id}`, 'success');
        onDeleted();
        return;
      }
      toast(errorText(await res.json().catch(() => ({}))), 'error');
    } catch {
      toast('The server could not be reached', 'error');
    } finally {
      setStatus(null);
    }
  };

  const handleCopyTags = async () => {
    await navigator.clipboard.writeText(tags.map((t) => t.name).join('\n'));
    toast('Tags copied to clipboard!', 'success');
  };

  // Paste a list of names (spaces, commas or newlines). Existing tags and aliases resolve to the real tag;
  // unknown names become new tags if the user may create them. Implications are NOT added (same as before).
  const handlePasteTags = async () => {
    let raw: string;
    try {
      raw = await navigator.clipboard.readText();
    } catch {
      toast('Could not read from clipboard.', 'error');
      return;
    }

    const names = [...new Set(raw.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))]
      .filter((n) => !tags.some((t) => t.name === n));
    if (!names.length) return;

    const resolved = await Promise.all(
      names.map(async (name): Promise<TagChip | null> => {
        try {
          const res = await API(`/api/tags/${encodeURIComponent(name)}`);
          if (res.ok) {
            const data: { name: string; postCount?: number; category?: { color: string } } = await res.json();
            return { name: data.name, color: data.category?.color, postCount: data.postCount };
          }
          if (res.status === 404 && canCreateTags) return { name, isNew: true };
        } catch {
          // treated like an unknown tag
        }
        return null;
      }),
    );

    const skipped = names.filter((_, i) => resolved[i] === null);
    // Build on the latest list (the lookups took a moment), as one batch so they land on top together
    const next = [...tagsRef.current];
    for (const chip of resolved) {
      if (chip && !next.some((t) => t.name === chip.name)) next.push(chip);
    }
    changeTags(next);

    if (skipped.length) toast(`Skipped unknown tags: ${skipped.join(', ')}`, 'error');
  };

  return (
    <div className="flex flex-col gap-5 text-sm text-subtle">
      {/* Save / delete */}
      <div className="flex gap-2">
        <Button
          size='lg'
          variant="success"
          fullWidth
          icon={<FloppyDiskIcon size={16} />}
          loading={busy}
          onClick={handleSave}
        >
          {status ?? 'Save Changes'}
        </Button>
        {canDelete && (
          <Button size='lg' variant="danger" icon={<TrashIcon size={16} />} disabled={busy} onClick={() => setShowDelete(true)}>
            Delete
          </Button>
        )}
      </div>

      {/* File actions */}
      <div className="flex flex-col gap-2">
        {/* Replace buttons share the row evenly */}
        <div className="flex gap-2">
          <Button
            size="md"
            className="flex-1"
            icon={<FileArrowUpIcon size={14} />}
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            Replace Post
          </Button>
          {isVideo && (
            <Button
              size="md"
              className="flex-1"
              icon={<ImageSquareIcon size={14} />}
              disabled={busy}
              onClick={() => thumbInput.current?.click()}
            >
              Replace Thumbnail
            </Button>
          )}
        </div>

        {/* Only when there's a custom thumbnail to undo */}
        {post.thumbKey && thumb?.kind !== 'reset' && (
          <Button
            size="md"
            fullWidth
            variant='danger'
            icon={<ArrowCounterClockwiseIcon size={14} />}
            disabled={busy}
            onClick={() => setThumb({ kind: 'reset' })}
            title="Go back to the automatically generated thumbnail"
          >
            Reset Thumbnail
          </Button>
        )}

        {/* Hidden pickers; value is cleared so picking the same file again still fires onChange */}
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(e) => { setNewFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
        />
        <input
          ref={thumbInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setThumb({ kind: 'replace', file });
            e.target.value = '';
          }}
        />
      </div>

      {/* Staged file changes */}
      {(newFile || thumb) && (
        <div className="space-y-1 rounded-lg border border-secondary-border bg-zinc-900/60 px-3 py-2 text-xs">
          {newFile && <Staged label="Post" value={newFile.name} onClear={() => setNewFile(null)} disabled={busy} />}
          {thumb?.kind === 'replace' && (
            <Staged label="Thumbnail" value={thumb.file.name} onClear={() => setThumb(null)} disabled={busy} />
          )}
          {thumb?.kind === 'reset' && (
            <Staged label="Thumbnail" value="Reset to default" onClear={() => setThumb(null)} disabled={busy} />
          )}
          <p className="text-subtle">Staged changes will be applied when you save.</p>
        </div>
      )}

      {/* Safety */}
      <div>
        <label className="mb-1.5 block font-medium text-white">Safety</label>
        <div className="grid grid-cols-3 gap-1">
          {SAFETY_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setSafety(level)}
              className={`cursor-pointer rounded px-2 py-1.5 text-xs transition ${
                safety === level ? SAFETY_STYLES[level].active : 'bg-secondary-border text-subtle hover:text-white'
              }`}
            >
              {SAFETY_STYLES[level].label}
            </button>
          ))}
        </div>
      </div>

      {/* Sources */}
      <div>
        <label className="mb-1.5 block font-medium text-white">Sources (one URL per line)</label>
        <textarea
          value={sourcesText}
          onChange={(e) => setSourcesText(e.target.value)}
          rows={3}
          placeholder="https://..."
          className={inputClass}
        />
        {invalidSources.length > 0 && (
          <p className="mt-1 text-xs text-red-400">Not a valid http(s) URL: {invalidSources.join(', ')}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1.5 block font-medium text-white">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2048}
          className={inputClass}
        />
      </div>

      {/* Related posts (no backend yet) */}
      <div>
        <label className="mb-1.5 block font-medium text-white">Related Posts</label>
        <RelatedPostInput value={relatedPosts} onChange={setRelatedPosts} />
      </div>

      {/* Pools (no backend yet) */}
      <div>
        <label className="mb-1.5 block font-medium text-white">
          Pools <span className="text-xs font-normal text-subtle">(coming soon, not saved)</span>
        </label>
        <RelatedPostInput value={pools} onChange={setPools} placeholder="Add pool ID..." />
      </div>

      {/* Tags */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="font-medium text-white">Tags ({tags.length})</label>
          <div className="space-x-1 text-xs">
            {/* The AutoTagger's PASSIVE mode; hidden when the server has it off */}
            {autoTaggerHas(addons, 'PASSIVE') && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAutoTagger(true)}
                  disabled={busy}
                  className="cursor-pointer text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Suggested Tags
                </button>
                <span className="text-zinc-600">•</span>
              </>
            )}
            <button type="button" onClick={handlePasteTags} className="cursor-pointer text-accent hover:underline">
              Paste Tags
            </button>
            <span className="text-zinc-600">•</span>
            <button type="button" onClick={handleCopyTags} className="cursor-pointer text-accent hover:underline">
              Copy Tags
            </button>
          </div>
        </div>
        <TagInput
          value={tags}
          onChange={changeTags}
          placeholder="Add tags..."
          withImplications
          colorFor={colorFor}
          allowNew={canCreateTags}
          disabled={busy}
          showChips={false}
        />
        {tags.some((t) => t.isNew) && (
          <p className="mt-1 text-xs text-subtle">Dashed tags don't exist yet and will be created when you save.</p>
        )}

        {/* Picked tags: newest on top (highlighted), then the post's existing tags */}
        {displayTags.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {/* initial={false}: tags already there when the editor opens don't animate, only new ones */}
            <AnimatePresence initial={false}>
            {displayTags.map((tag) => {
              const isAdded = addedSet.has(tag.name);
              return (
                <motion.div
                  key={tag.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className={`flex w-fit items-center gap-2 rounded-2xl border px-3 py-1.5 transition-colors ${
                    tag.isNew
                      ? 'border-dashed border-zinc-600'
                      : isAdded
                        ? 'border-zinc-800 bg-zinc-900/60'
                        : 'border-zinc-900'
                  }`}
                  style={{ color: tag.color ?? '#3c9aff' }}
                  title={tag.isNew ? 'This tag will be created when you save' : undefined}
                >
                  <button
                    type="button"
                    onClick={() => removeTag(tag.name)}
                    disabled={busy}
                    className="cursor-pointer hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    title={`Remove ${tag.name}`}
                  >
                    <XIcon size={16} />
                  </button>

                  {!tag.isNew && (
                    <Link href={`/tags/${encodeURIComponent(tag.name)}`} className="hover:opacity-80" title="View tag">
                      <TagIcon size={16} />
                    </Link>
                  )}

                  <span>{tag.name}</span>
                  {tag.postCount !== undefined && (
                    <span className="ml-1 text-xs text-zinc-400">{formatCounts(tag.postCount)}</span>
                  )}
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AutoTaggerModal
        open={showAutoTagger}
        onClose={() => setShowAutoTagger(false)}
        postId={post.id}
        previewUrl={post.thumbnails.large}
        colorFor={colorFor}
        currentNames={tags.map((t) => t.name)}
        canCreateTags={canCreateTags}
        // One batch, so the picks land on top together like a paste
        onAdd={(chips) => changeTags([...tagsRef.current, ...chips.filter((c) => !tagsRef.current.some((t) => t.name === c.name))])}
      />

      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Post?"
        description="This will permanently remove the post and its files. Are you sure?"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}

// One staged change ("New file: cat.png  ✕")
function Staged({ label, value, onClear, disabled }: { label: string; value: string; onClear: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-white">{label}:</span>
      <span className="truncate" title={value}>{value}</span>
      <button
        type="button"
        onClick={onClear}
        disabled={disabled}
        className="ml-auto shrink-0 cursor-pointer text-subtle hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
        title="Undo"
      >
        <XIcon size={12} weight="bold" />
      </button>
    </div>
  );
}
