"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FloppyDiskIcon, ListMagnifyingGlassIcon, PencilSimpleIcon, StarIcon, TrashIcon } from "@phosphor-icons/react";
import { PoolCard } from "../PoolCard";
import { PoolEditForm } from "./EditMetadata";
import { PoolReorderGrid } from "./PoolReorderGrid";
import RelatedPostInput from "@/components/Posts/Individual/PostRelation";
import Button from "@/components/UI/Button";
import ConfirmModal from "@/components/UI/Modals/ConfirmModal";
import { useToast } from "@/components/UI/Toast";
import { useUser } from "@/components/UserProvider";
import { API, errorText } from "@/core/api";
import { PoolDetail, PoolFavoriteResponse } from "@/core/types/pools";
import { Posts } from "@/core/types/posts";
import { CategoryInfo } from "@/core/types/tags";

const BATCH = 100;      // the API's max posts per add/remove request
const TAG_PREVIEW = 24; // tags shown before "Show all"

const chunks = <T,>(list: T[]) =>
  Array.from({ length: Math.ceil(list.length / BATCH) }, (_, i) => list.slice(i * BATCH, (i + 1) * BATCH));

const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export default function ClientPoolPage({ poolId }: { poolId: number }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useUser();
  const hasPerm = (perm: string) => user?.permissions.includes(perm) ?? false;

  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [colors, setColors] = useState<Map<number, string>>(new Map());
  const [showAllTags, setShowAllTags] = useState(false);
  const [favoriting, setFavoriting] = useState(false);

  // Edit mode (everything is staged until Save)
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [yearStart, setYearStart] = useState<number | null>(null);
  const [yearEnd, setYearEnd] = useState<number | null>(null);
  const [order, setOrder] = useState<Posts[]>([]);
  const [adding, setAdding] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [showConfirmDel, setShowConfirmDel] = useState(false);

  const resetEdits = (p: PoolDetail) => {
    setName(p.name);
    setDescription(p.description ?? "");
    setYearStart(p.yearStart);
    setYearEnd(p.yearEnd);
    setOrder(p.posts);
    setAdding([]);
  };

  const load = useCallback(async () => {
    try {
      const res = await API(`/api/pools/${poolId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(res.status === 404 ? "This pool doesn't exist, or you can't see any of its posts." : errorText(data));
        return null;
      }
      setError(null);
      setPool(data);
      resetEdits(data);
      return data as PoolDetail;
    } catch {
      setError("The server could not be reached.");
      return null;
    }
  }, [poolId]);

  useEffect(() => { load(); }, [load]);

  // Tag colors come from the categories
  useEffect(() => {
    API("/api/tag-categories")
      .then((res) => (res.ok ? res.json() : []))
      .then((cats: CategoryInfo[]) => setColors(new Map(cats.map((c) => [c.id, c.color]))))
      .catch(() => {});
  }, []);

  const handleFavorite = async () => {
    if (!pool?.viewer) return;
    setFavoriting(true);
    try {
      const res = await API(`/api/pools/${pool.id}/favorite`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: !pool.viewer.favorited }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(errorText(data), "error");
        return;
      }
      const { favorited, favoriteCount } = data as PoolFavoriteResponse;
      setPool({ ...pool, favoriteCount, viewer: { favorited } });
    } catch {
      toast("The server could not be reached", "error");
    } finally {
      setFavoriting(false);
    }
  };

  // PATCH details -> remove posts -> reorder -> add posts. Every step is safe to repeat,
  // so after a partial failure the user can just press Save again.
  const handleSave = async () => {
    if (!pool) return;
    const fail = (msg: string) => toast(`Couldn't save: ${msg}`, "error");
    const send = (path: string, method: string, body: unknown) =>
      API(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    setSaving(true);
    try {
      // 1. Details (only what changed)
      const body: Record<string, unknown> = {};
      if (name.trim() !== pool.name) body.name = name;
      const desc = description.trim() || null;
      if (desc !== pool.description) body.description = desc;
      if (yearStart !== pool.yearStart) {
        if (yearStart === null) return fail("a start year is required");
        body.yearStart = yearStart;
      }
      if (yearEnd !== pool.yearEnd) body.yearEnd = yearEnd;

      if (Object.keys(body).length) {
        const res = await send(`/api/pools/${pool.id}`, "PATCH", body);
        if (!res.ok) return fail(errorText(await res.json().catch(() => ({}))));
      }

      // 2. Removed posts
      const kept = new Set(order.map((p) => p.id));
      const removed = pool.posts.map((p) => p.id).filter((id) => !kept.has(id));
      for (const postIds of chunks(removed)) {
        const res = await send(`/api/pools/${pool.id}/posts`, "DELETE", { postIds });
        if (!res.ok) return fail(errorText(await res.json().catch(() => ({}))));
      }

      // 3. New order (only if the remaining posts moved)
      const newOrder = order.map((p) => p.id);
      const oldOrder = pool.posts.map((p) => p.id).filter((id) => kept.has(id));
      if (!sameList(newOrder, oldOrder)) {
        const res = await send(`/api/pools/${pool.id}/posts`, "PUT", { postIds: newOrder });
        if (!res.ok) return fail(errorText(await res.json().catch(() => ({}))));
      }

      // 4. Added posts go on the end, in the order they were typed
      const toAdd = adding.filter((id) => !kept.has(id));
      for (const postIds of chunks(toAdd)) {
        const res = await send(`/api/pools/${pool.id}/posts`, "POST", { postIds });
        if (!res.ok) return fail(errorText(await res.json().catch(() => ({}))));
      }

      toast("Saved changes!", "success");
      setEditMode(false);
      await load();
    } catch {
      fail("the server could not be reached");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pool) return;
    setShowConfirmDel(false);
    try {
      const res = await API(`/api/pools/${pool.id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Pool deleted!", "success");
        router.push("/pools");
        return;
      }
      toast(errorText(await res.json().catch(() => ({}))), "error");
    } catch {
      toast("The server could not be reached", "error");
    }
  };

  if (error) {
    return (
      <main className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-2xl font-bold text-red-400 mb-2">Pool unavailable</h1>
        <p className="text-subtle max-w-md">{error}</p>
        <Link href="/pools" className="mt-4 text-accent hover:underline">Back to pools</Link>
      </main>
    );
  }

  if (!pool) return null; // loading

  // Banner: the second page (the first is usually the cover), or the first if that's all there is
  const cover = (pool.posts[1] ?? pool.posts[0])?.thumbnails.large;
  const artists = pool.artists;
  const tags = showAllTags ? pool.tags : pool.tags.slice(0, TAG_PREVIEW);

  return (
    <main className="w-full">
      {/* Hero Section */}
      <motion.section
        className="relative h-48 sm:h-64 md:h-72 lg:h-80 w-full overflow-hidden"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {cover && (
          <img src={cover} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/60 to-transparent z-10" />

        {/* Header content */}
        <div className="relative z-20 h-full flex flex-col justify-end px-4 pb-4 max-w-(--breakpoint-2xl) mx-auto">
          {editMode ? (
            <PoolEditForm
              name={name}
              description={description}
              yearStart={yearStart}
              yearEnd={yearEnd}
              onNameChange={setName}
              onDescriptionChange={setDescription}
              onYearStartChange={setYearStart}
              onYearEndChange={setYearEnd}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 justify-between mb-1">
                {/* pool data on left */}
                <div className="flex flex-wrap items-end gap-x-3">
                  <h1 className="text-3xl font-bold text-white">{pool.name}</h1>
                  {artists.length > 0 && (
                    <div className="text-sm text-white/80 font-medium">
                      by{" "}
                      {artists.slice(0, 3).map((a, i) => (
                        <span key={a.id}>
                          {i > 0 && ", "}
                          <Link
                            href={`/posts?query=${encodeURIComponent(a.name)}`}
                            className="hover:underline"
                            style={{ color: colors.get(a.categoryId) }}
                          >
                            {a.name}
                          </Link>
                        </span>
                      ))}
                      {artists.length > 3 && <span className="text-white/50"> +{artists.length - 3} more</span>}
                    </div>
                  )}
                </div>

                {/* edit and favorite on right */}
                <div className="flex items-center gap-3">
                  {hasPerm("pool.manage") && (
                    <Button size="md" icon={<PencilSimpleIcon size={14} />} onClick={() => setEditMode(true)}>
                      Edit
                    </Button>
                  )}

                  {pool.viewer && hasPerm("pool.favorite") ? (
                    <button
                      onClick={handleFavorite}
                      disabled={favoriting}
                      title={pool.viewer.favorited ? "Remove from favorites" : "Add to favorites"}
                      className={`flex items-center gap-1.5 rounded px-2 py-1 transition cursor-pointer hover:bg-white/10 disabled:opacity-50 ${
                        pool.viewer.favorited ? "text-yellow-400" : "text-white/60"
                      }`}
                    >
                      <StarIcon size={20} weight={pool.viewer.favorited ? "fill" : "regular"} />
                      <span className="text-sm tabular-nums">{pool.favoriteCount}</span>
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2 py-1 text-white/60" title="Favorites">
                      <StarIcon size={20} />
                      <span className="text-sm tabular-nums">{pool.favoriteCount}</span>
                    </span>
                  )}
                </div>
              </div>
              {pool.description && (
                <p className="text-sm text-white/80 max-w-2xl mb-1 whitespace-pre-line">{pool.description}</p>
              )}
              <p className="text-xs text-zinc-400 max-w-2xl mb-1">
                (Contains {pool.posts.length} {pool.posts.length === 1 ? "page" : "pages"})
              </p>
              {pool.yearStart && (
                <p className="text-sm text-subtle font-medium">
                  {pool.yearStart}{" "}
                  <span className="mx-1 text-white/40">——</span>{" "}
                  {pool.yearEnd ?? "Present"}
                </p>
              )}
            </>
          )}
        </div>
      </motion.section>

      {/* Tags (from the pool's posts) */}
      {!editMode && pool.tags.length > 0 && (
        <section className="max-w-(--breakpoint-2xl) mx-auto px-4 pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/pools?search=${encodeURIComponent(tag.name)}`}
                title={`On ${tag.poolCount} of ${pool.posts.length} posts in this pool`}
                className="flex items-center gap-1.5 rounded-md border border-secondary-border bg-secondary px-2 py-0.5 text-xs transition hover:bg-zinc-800"
              >
                <span style={{ color: colors.get(tag.categoryId) }}>{tag.name}</span>
                <span className="text-zinc-500 tabular-nums">{tag.poolCount}</span>
              </Link>
            ))}
            {pool.tags.length > TAG_PREVIEW && (
              <button
                onClick={() => setShowAllTags(!showAllTags)}
                className="cursor-pointer px-2 py-0.5 text-xs text-accent hover:underline"
              >
                {showAllTags ? "Show less" : `Show all ${pool.tags.length}`}
              </button>
            )}
            <Link
              href={`/posts?query=${encodeURIComponent(`pool:${pool.id}`)}`}
              className="ml-auto flex items-center gap-1 text-xs text-subtle hover:text-accent"
            >
              <ListMagnifyingGlassIcon size={14} />
              Search in this pool
            </Link>
          </div>
        </section>
      )}

      {/* Edit Mode Buttons */}
      {editMode && (
        <div className="max-w-(--breakpoint-2xl) mx-auto px-4 pt-4 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-3">
              <Button variant="success" icon={<FloppyDiskIcon size={14} />} loading={saving} onClick={handleSave}>
                Save
              </Button>
              <Button
                disabled={saving}
                onClick={() => {
                  setEditMode(false);
                  resetEdits(pool);
                }}
              >
                Cancel
              </Button>
            </div>

            {hasPerm("pool.delete") && (
              <Button variant="danger" icon={<TrashIcon size={14} />} disabled={saving} onClick={() => setShowConfirmDel(true)}>
                Delete Pool
              </Button>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-white">
              Add posts <span className="text-xs font-normal text-subtle">(added to the end, in this order)</span>
            </label>
            <RelatedPostInput value={adding} onChange={setAdding} />
          </div>

          <p className="text-xs text-subtle">Drag posts to reorder them. Changes are only kept once you press Save.</p>
        </div>
      )}

      {/* Post Grid */}
      <section className="max-w-(--breakpoint-2xl) mx-auto px-2 sm:px-4 py-6">
        {editMode ? (
          <PoolReorderGrid posts={order} onChange={setOrder} />
        ) : pool.posts.length === 0 ? (
          <p className="py-12 text-center text-sm text-subtle">
            This pool is empty.{hasPerm("pool.manage") && " Press Edit to add posts."}
          </p>
        ) : (
          <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {pool.posts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i, 30) * 0.03 }}
              >
                <PoolCard
                  name={`#${i + 1}`}
                  coverUrl={post.thumbnails.med}
                  safety={post.safety}
                  showOverlay={false}
                  linkTo={`/post/${post.id}?pool=${pool.id}`}
                />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={showConfirmDel}
        onClose={() => setShowConfirmDel(false)}
        onConfirm={handleDelete}
        title="Delete this pool?"
        description={`This will permanently delete the pool, though not the posts associated.\nThis cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </main>
  );
}
