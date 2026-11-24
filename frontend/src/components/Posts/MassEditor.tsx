'use client';

import { useEffect, useState } from 'react';
import {
  CircleNotchIcon, HeartBreakIcon, HeartIcon, LightningIcon, LockSimpleIcon, PlusCircleIcon, PlusSquareIcon,
  ThumbsDownIcon, ThumbsUpIcon, TrashIcon, WarningIcon, XIcon,
} from '@phosphor-icons/react';
import InfoModal from '@/components/UI/Modals/InfoModal';
import Button from '@/components/UI/Button';
import TagInput from '@/components/Uploads/TagInput';
import { useToast } from '@/components/UI/Toast';
import { useUser } from '@/components/UserProvider';
import { API, errorText } from '@/core/api';
import { BulkEditBody, BulkResult, MassEditChange, MAX_BULK_POSTS, Safety, VoteValue } from '@/core/types/posts';
import { CategoryInfo } from '@/core/types/tags';
import { CollectionSummary } from '@/core/types/collections';
import { PoolList, PoolSummary } from '@/core/types/pools';
import { SAFETY_LEVELS, SAFETY_STYLES, TagChip } from '@/core/types/uploads';

type Props = {
  open: boolean;
  onClose: () => void;
  postIds: number[]; // selected posts, in the order the feed shows them (pools append in this order)
  onApplied: (change: MassEditChange) => void;
};

type Tab = 'editors' | 'users';
type Toast = ReturnType<typeof useToast>;

const MAX_RELATED = 100; // backend MAX_RELATED_POSTS: related links per post
const POOL_RESULTS = 50; // pools listed per search (the list now has room for them)

const plural = (n: number) => `${n} post${n === 1 ? '' : 's'}`;

// JSON request that never throws: network failures come back as ok: false with an error body
async function send(path: string, method: string, body: unknown): Promise<{ ok: boolean; data: any }> {
  try {
    const res = await API(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { error: 'The server could not be reached' } };
  }
}

// One toast for every bulk route: "Liked 12 posts (3 skipped)"
function reportBulk(toast: Toast, verb: string, result: BulkResult) {
  const skipped = result.skipped.length ? ` (${result.skipped.length} skipped: hidden, missing, or not yours)` : '';
  if (result.updated.length === 0) toast(`No posts changed${skipped}`, 'error');
  else toast(`${verb} ${plural(result.updated.length)}${skipped}`, 'success');
}

export default function MassEditor({ open, onClose, postIds, onApplied }: Props) {
  const { user } = useUser();
  const hasPerm = (perm: string) => user?.permissions.includes(perm) ?? false;

  const canUsers = hasPerm('posts.vote') || hasPerm('posts.favorite') || hasPerm('collections.manage.own');
  const canEditors =
    hasPerm('posts.edit.own') || hasPerm('posts.edit.others') ||
    hasPerm('posts.delete.own') || hasPerm('posts.delete.others') ||
    hasPerm('pool.manage');

  // Editors come first for anyone who can edit; everyone else only gets Users
  const tabs: Tab[] = [...(canEditors ? ['editors' as const] : []), ...(canUsers ? ['users' as const] : [])];
  const [tab, setTab] = useState<Tab | null>(null); // null = the first tab this user has
  const activeTab = tab && tabs.includes(tab) ? tab : tabs[0];

  const tooMany = postIds.length > MAX_BULK_POSTS;

  return (
    <InfoModal
      open={open}
      onClose={onClose}
      title={`Edit ${plural(postIds.length)}`}
      // Most of the screen in both directions. The body is a flex column so the lists can stretch into the spare height
      className="sm:max-w-2xl! md:max-w-4xl! lg:max-w-272! max-h-[90vh]! md:h-[84vh]"
      bodyClassName="flex flex-col"
    >
      {tabs.length === 0 ? (
        <p className="text-sm text-subtle">Your account doesn't have permission to change posts in bulk.</p>
      ) : (
        <>
          {tabs.length > 1 && (
            <div className="mb-4 flex shrink-0 gap-1 border-b border-secondary-border">
              {tabs.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm transition ${
                    activeTab === t ? 'border-accent text-white' : 'border-transparent text-subtle hover:text-white'
                  }`}
                >
                  {t === 'editors' ? 'Editors' : 'Users'}
                </button>
              ))}
            </div>
          )}

          {tooMany ? (
            <p className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-300">
              <WarningIcon size={16} className="shrink-0" />
              You can change at most {MAX_BULK_POSTS} posts at once. Deselect {postIds.length - MAX_BULK_POSTS} to continue.
            </p>
          ) : activeTab === 'users' ? (
            <UsersTab postIds={postIds} hasPerm={hasPerm} />
          ) : (
            <EditorsTab postIds={postIds} hasPerm={hasPerm} onApplied={onApplied} onClose={onClose} />
          )}
        </>
      )}
    </InfoModal>
  );
}

// Marks a section whose buttons take effect on click, with no Apply step
function InstantBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-2xs font-medium text-amber-300">
      <LightningIcon size={10} weight="fill" />
      Applies instantly
    </span>
  );
}

// grow = take the leftover height (for sections holding a PickList)
function Section({
  title, hint, instant = false, grow = false, className = '', children,
}: {
  title: string;
  hint?: string;
  instant?: boolean;
  grow?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex flex-col gap-2 ${grow ? 'min-h-0 flex-1' : ''} ${className}`}>
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium text-white">
          {title}
          {instant && <InstantBadge />}
        </h3>
        {hint && <p className="text-xs text-subtle">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// Searchable list with a green "+" per row (collections and pools). Fills the height its section gets.
function PickList<T extends { id: string | number; name: string }>({
  items, query, onQuery, placeholder, empty, meta, busyId, onPick,
}: {
  items: T[] | null; // null = loading
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  empty: string;
  meta: (item: T) => React.ReactNode;
  busyId: T['id'] | null;
  onPick: (item: T) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full shrink-0 rounded-lg border border-secondary-border bg-zinc-900 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-zinc-600"
      />
      {/* min-h-48: still usable when the modal is short (phones), where the whole body scrolls instead */}
      <div className="min-h-48 flex-1 overflow-y-auto rounded-lg border border-secondary-border">
        {items === null ? (
          <p className="px-3 py-2 text-sm text-subtle">Loading...</p>
        ) : items.length === 0 ? (
          <p className="px-3 py-2 text-sm text-subtle">{empty}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 border-b border-secondary-border px-3 py-1.5 last:border-b-0">
              <span className="truncate text-sm text-white">{item.name}</span>
              <span className="shrink-0 text-xs text-subtle">{meta(item)}</span>
              <button
                type="button"
                onClick={() => onPick(item)}
                disabled={busyId !== null}
                aria-label={`Add to ${item.name}`}
                title={`Add to ${item.name}`}
                className="ml-auto shrink-0 cursor-pointer text-green-500 transition hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyId === item.id
                  ? <CircleNotchIcon size={22} className="animate-spin" />
                  : <PlusCircleIcon size={22} weight="fill" />}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Users (votes, favorites, collections. Each button applies right away and the modal stays open)
function UsersTab({ postIds, hasPerm }: { postIds: number[]; hasPerm: (perm: string) => boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null); // which button is running

  const canCollect = hasPerm('collections.manage.own');
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null);
  const [collectionQuery, setCollectionQuery] = useState('');

  useEffect(() => {
    if (!canCollect) return;
    API('/api/collections/own')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { collections: CollectionSummary[] }) => setCollections(data.collections))
      .catch(() => { setCollections([]); toast('Could not load your collections', 'error'); });
  }, [canCollect]);

  const vote = async (value: VoteValue, verb: string) => {
    setBusy(`vote${value}`);
    const { ok, data } = await send('/api/posts/mass/vote', 'PUT', { postIds, value });
    setBusy(null);
    if (ok) reportBulk(toast, verb, data);
    else toast(errorText(data), 'error');
  };

  const favorite = async (favorited: boolean) => {
    setBusy(favorited ? 'fav' : 'unfav');
    const { ok, data } = await send('/api/posts/mass/favorite', 'PUT', { postIds, favorited });
    setBusy(null);
    if (ok) reportBulk(toast, favorited ? 'Favorited' : 'Unfavorited', data);
    else toast(errorText(data), 'error');
  };

  const addToCollection = async (c: CollectionSummary) => {
    setBusy(`collection:${c.id}`);
    const { ok, data } = await send(`/api/collections/${c.id}/posts`, 'POST', { postIds });
    setBusy(null);
    if (!ok) return toast(errorText(data), 'error');

    const added: number = data.added;
    toast(added ? `Added ${plural(added)} to ${c.name}` : `All of these are already in ${c.name}`, added ? 'success' : 'error');
    setCollections((prev) => prev?.map((p) => (p.id === c.id ? { ...p, itemCount: p.itemCount + added } : p)) ?? prev);
  };

  const shownCollections = collections?.filter((c) => c.name.toLowerCase().includes(collectionQuery.trim().toLowerCase())) ?? null;
  const collectionBusy = busy?.startsWith('collection:') ? busy.slice('collection:'.length) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <p className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
        <LightningIcon size={16} weight="fill" className="shrink-0 text-amber-300" />
        Everything on this tab applies the moment you click it. There's no Apply button.
      </p>

      <div className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row">
        <div className="shrink-0 space-y-6 md:w-1/2">
          {hasPerm('posts.vote') && (
            <Section title="Vote" instant>
              <div className="flex flex-wrap gap-2">
                <Button icon={<ThumbsUpIcon size={16} />} loading={busy === 'vote1'} disabled={busy !== null} onClick={() => vote(1, 'Liked')}>
                  Like all
                </Button>
                <Button icon={<ThumbsDownIcon size={16} />} loading={busy === 'vote-1'} disabled={busy !== null} onClick={() => vote(-1, 'Disliked')}>
                  Dislike all
                </Button>
                <Button icon={<XIcon size={16} />} loading={busy === 'vote0'} disabled={busy !== null} onClick={() => vote(0, 'Cleared your vote on')}>
                  Clear votes
                </Button>
              </div>
            </Section>
          )}

          {hasPerm('posts.favorite') && (
            <Section title="Favorite" hint="New favorites also like the post, same as favoriting one at a time." instant>
              <div className="flex flex-wrap gap-2">
                <Button icon={<HeartIcon size={16} />} loading={busy === 'fav'} disabled={busy !== null} onClick={() => favorite(true)}>
                  Favorite all
                </Button>
                <Button icon={<HeartBreakIcon size={16} />} loading={busy === 'unfav'} disabled={busy !== null} onClick={() => favorite(false)}>
                  Unfavorite all
                </Button>
              </div>
            </Section>
          )}
        </div>

        {canCollect && (
          <Section title="Add to collection" hint="Posts already in the collection are skipped." instant grow>
            <PickList
              items={shownCollections}
              query={collectionQuery}
              onQuery={setCollectionQuery}
              placeholder="Filter your collections..."
              empty={collections?.length ? 'No collection matches that' : "You don't have any collections yet"}
              meta={(c) => (
                <span className="inline-flex items-center gap-1">
                  {!c.isPublic && <LockSimpleIcon size={12} />}
                  {plural(c.itemCount)}
                </span>
              )}
              busyId={collectionBusy}
              onPick={addToCollection}
            />
          </Section>
        )}
      </div>
    </div>
  );
}

// Editors (tags / safety / related (apply), plus pools and delete (instant))
type RelateMode = 'none' | 'one' | 'all';

function EditorsTab({
  postIds, hasPerm, onApplied, onClose,
}: {
  postIds: number[];
  hasPerm: (perm: string) => boolean;
  onApplied: (change: MassEditChange) => void;
  onClose: () => void;
}) {
  const toast = useToast();

  const canEdit = hasPerm('posts.edit.own') || hasPerm('posts.edit.others');
  const canDelete = hasPerm('posts.delete.own') || hasPerm('posts.delete.others');
  const canPools = hasPerm('pool.manage');

  // Colors for implied tags (TagInput only gets their category id)
  const [categories, setCategories] = useState<Map<number, CategoryInfo>>(new Map());
  useEffect(() => {
    if (!canEdit) return;
    API('/api/tag-categories')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: CategoryInfo[]) => setCategories(new Map(list.map((c) => [c.id, c]))))
      .catch(() => {}); // implied tags just show uncolored
  }, [canEdit]);
  const colorFor = (categoryId: number) => categories.get(categoryId)?.color;

  // --- Apply form ---
  const [addTags, setAddTags] = useState<TagChip[]>([]);
  const [removeTags, setRemoveTags] = useState<TagChip[]>([]);
  const [safety, setSafety] = useState<Safety | null>(null); // null = leave unchanged
  const [relateMode, setRelateMode] = useState<RelateMode>('none');
  const [relateTo, setRelateTo] = useState('');
  const [applying, setApplying] = useState(false);

  const clash = addTags.filter((a) => removeTags.some((r) => r.name === a.name)).map((t) => t.name);
  const relateId = /^\d+$/.test(relateTo.trim()) ? Number(relateTo.trim()) : null;
  const relateValid = relateMode !== 'one' || (relateId !== null && relateId > 0);
  const eachOtherTooMany = postIds.length - 1 > MAX_RELATED;
  const hasChanges = addTags.length > 0 || removeTags.length > 0 || safety !== null || relateMode !== 'none';
  const canApply = hasChanges && clash.length === 0 && relateValid && !(relateMode === 'all' && eachOtherTooMany);

  const apply = async () => {
    const body: BulkEditBody = { postIds };
    if (addTags.length) body.addTags = addTags.map((t) => t.name);
    if (removeTags.length) body.removeTags = removeTags.map((t) => t.name);
    if (safety) body.safety = safety;
    if (relateMode === 'one' && relateId !== null) body.relateTo = relateId;
    if (relateMode === 'all') body.relateEachOther = true;

    setApplying(true);
    const { ok, data } = await send('/api/posts/mass', 'PATCH', body);
    setApplying(false);
    if (!ok) return toast(errorText(data), 'error');

    reportBulk(toast, 'Updated', data);
    if ((data as BulkResult).updated.length) {
      onApplied({ edited: true });
      onClose();
    }
  };

  // Pools (instant)
  const [poolQuery, setPoolQuery] = useState('');
  const [pools, setPools] = useState<PoolSummary[] | null>(null);
  const [poolBusy, setPoolBusy] = useState<number | null>(null);

  useEffect(() => {
    if (!canPools) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: poolQuery.trim(), limit: String(POOL_RESULTS) });
        const res = await API(`/api/pools?${params}`, { signal: controller.signal });
        const data: PoolList | null = res.ok ? await res.json() : null;
        setPools(data?.pools ?? []);
      } catch {
        // aborted because the user kept typing
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [poolQuery, canPools]);

  const addToPool = async (pool: PoolSummary) => {
    setPoolBusy(pool.id);
    const { ok, data } = await send(`/api/pools/${pool.id}/posts`, 'POST', { postIds });
    setPoolBusy(null);
    if (!ok) return toast(errorText(data), 'error');

    const added: number = data.added.length;
    toast(added ? `Added ${plural(added)} to ${pool.name}` : `All of these are already in ${pool.name}`, added ? 'success' : 'error');
    setPools((prev) => prev?.map((p) => (p.id === pool.id ? { ...p, postCount: p.postCount + added } : p)) ?? prev);
  };

  // Delete (instant, after an inline confirm)
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteAll = async () => {
    setDeleting(true);
    const { ok, data } = await send('/api/posts/mass', 'DELETE', { postIds });
    setDeleting(false);
    setConfirmDelete(false);
    if (!ok) return toast(errorText(data), 'error');

    reportBulk(toast, 'Deleted', data);
    const deleted = (data as BulkResult).updated;
    if (deleted.length) {
      onApplied({ deleted });
      onClose();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {canEdit && (
        <div className="shrink-0 space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: tags */}
            <div className="space-y-6">
              <Section title="Add tags" hint="Picking a tag also adds what it implies. Remove any you don't want.">
                <TagInput
                  value={addTags}
                  onChange={setAddTags}
                  placeholder="Tags to add..."
                  withImplications
                  colorFor={colorFor}
                  allowNew={hasPerm('tags.create')}
                  disabled={applying}
                />
                {addTags.some((t) => t.isNew) && (
                  <p className="text-xs text-subtle">Dashed tags don't exist yet and will be created when you apply.</p>
                )}
              </Section>

              <Section title="Remove tags">
                <TagInput value={removeTags} onChange={setRemoveTags} placeholder="Tags to remove..." disabled={applying} />
                {clash.length > 0 && (
                  <p className="text-xs text-red-400">In both lists: {clash.join(', ')}</p>
                )}
              </Section>
            </div>

            {/* Right: safety + related */}
            <div className="space-y-6">
              <Section title="Safety">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSafety(null)}
                    className={`cursor-pointer rounded px-2 py-1.5 text-xs transition ${
                      safety === null ? 'bg-zinc-200 text-black' : 'bg-secondary-border text-subtle hover:text-white'
                    }`}
                  >
                    Leave unchanged
                  </button>
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
              </Section>

              <Section title="Related posts" hint="Adds links only. Existing related posts are kept.">
                <div className="space-y-1.5 text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="relate" checked={relateMode === 'none'} onChange={() => setRelateMode('none')} className="cursor-pointer" />
                    Leave unchanged
                  </label>
                  <label className="flex cursor-pointer flex-wrap items-center gap-2">
                    <input type="radio" name="relate" checked={relateMode === 'one'} onChange={() => setRelateMode('one')} className="cursor-pointer" />
                    Relate every selected post to post #
                    <input
                      type="text"
                      inputMode="numeric"
                      value={relateTo}
                      onChange={(e) => { setRelateTo(e.target.value); setRelateMode('one'); }}
                      placeholder="id"
                      className="w-24 rounded border border-secondary-border bg-zinc-900 px-2 py-0.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-zinc-600"
                    />
                  </label>
                  <label className={`flex items-center gap-2 ${eachOtherTooMany ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      name="relate"
                      checked={relateMode === 'all'}
                      disabled={eachOtherTooMany}
                      onChange={() => setRelateMode('all')}
                      className="cursor-pointer disabled:cursor-not-allowed"
                    />
                    Relate the selected posts to each other
                    {eachOtherTooMany && <span className="text-xs text-subtle">(at most {MAX_RELATED + 1} posts)</span>}
                  </label>
                </div>
              </Section>
            </div>
          </div>

          {/* The divider closes off the Apply form, so the instant sections below read as separate */}
          <div className="flex justify-end border-b border-secondary-border pb-4">
            <Button variant="primary" size="lg" loading={applying} disabled={!canApply} onClick={apply}>
              Apply to {plural(postIds.length)}
            </Button>
          </div>
        </div>
      )}

      {(canPools || canDelete) && (
        <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
          {canPools && (
            <Section title="Add to pool" hint="Added to the end of the pool, in the order they appear in the feed." instant grow>
              <PickList
                items={pools}
                query={poolQuery}
                onQuery={setPoolQuery}
                placeholder="Search pools..."
                empty="No pools found"
                meta={(p) => plural(p.postCount)}
                busyId={poolBusy}
                onPick={addToPool}
              />
            </Section>
          )}

          {canDelete && (
            <Section
              title="Delete posts"
              hint="Posts you aren't allowed to delete are skipped."
              instant
              className={canPools ? 'shrink-0 lg:w-96' : ''}
            >
              {!confirmDelete ? (
                <div>
                  <Button variant="danger" icon={<TrashIcon size={16} />} onClick={() => setConfirmDelete(true)}>
                    Delete {plural(postIds.length)}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-red-900/50 bg-red-950/20 p-3">
                  <p className="text-sm text-red-300">Permanently delete {plural(postIds.length)}? This can't be undone.</p>
                  <div className="flex gap-2">
                    <Button onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
                    <Button variant="danger" icon={<TrashIcon size={16} />} loading={deleting} onClick={deleteAll}>
                      Delete {plural(postIds.length)}
                    </Button>
                  </div>
                </div>
              )}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
