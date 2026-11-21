'use client';

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DotsThreeVerticalIcon,
  GlobeHemisphereWestIcon,
  LockSimpleIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import CollectionModal from "@/components/Collections/CollectionModal";
import Button from "@/components/UI/Button";
import ConfirmModal from "@/components/UI/Modals/ConfirmModal";
import { useToast } from "@/components/UI/Toast";
import { useUser } from "@/components/UserProvider";
import { API, errorText } from "@/core/api";
import { formatCounts } from "@/core/formats";
import { CollectionCard, CollectionList, CollectionSummary, collectionQuery } from "@/core/types/collections";

const PAGE_SIZE = 10;

type Props = {
  username: string;
  isOwner: boolean;
};

// A user's collections. Private ones only come back for their owner (the API filters them).
export default function ProfileCollections({ username, isOwner }: Props) {
  const toast = useToast();
  const { user } = useUser();
  const canManage = isOwner
    ? user?.permissions.includes("collections.manage.own") ?? false
    : user?.permissions.includes("collections.manage.others") ?? false;

  const [collections, setCollections] = useState<CollectionCard[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [modal, setModal] = useState<{ open: boolean, collection?: CollectionSummary }>({ open: false });
  const [deleting, setDeleting] = useState<CollectionCard | null>(null);

  const fetchPage = async (p: number): Promise<CollectionList | null> => {
    const params = new URLSearchParams({ owner: username, page: String(p), limit: String(PAGE_SIZE) });
    const res = await API(`/api/collections?${params}`);
    return res.ok ? res.json() : null;
  };

  useEffect(() => {
    let cancelled = false;
    setCollections(null);

    fetchPage(1)
      .then((data) => {
        if (cancelled) return;
        if (!data) return setCollections([]); // e.g. guest access off: just no section
        setCollections(data.collections);
        setTotal(data.total);
        setPage(1);
        setTotalPages(data.totalPages);
      })
      .catch(() => { if (!cancelled) setCollections([]); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await fetchPage(page + 1);
      if (!data) return toast("Could not load more collections", "error");
      // Skip ones we already have (a create/delete meanwhile shifts the pages)
      setCollections((prev) => {
        const have = new Set(prev?.map((c) => c.id));
        return [...(prev ?? []), ...data.collections.filter((c) => !have.has(c.id))];
      });
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      toast("The server could not be reached", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  // Edited -> merge into its card; created -> new card at the front
  const onSaved = (saved: CollectionSummary) => {
    if (collections?.some((c) => c.id === saved.id)) {
      setCollections((prev) => prev?.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)) ?? prev);
    } else {
      setCollections((prev) => [{ ...saved, cover: null }, ...(prev ?? [])]);
      setTotal((t) => t + 1);
    }
  };

  const togglePrivacy = async (c: CollectionCard) => {
    try {
      const res = await API(`/api/collections/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public: !c.isPublic }),
      });
      if (!res.ok) return toast(errorText(await res.json().catch(() => ({}))), "error");
      onSaved({ ...c, isPublic: !c.isPublic });
      toast(c.isPublic ? `"${c.name}" is now private` : `"${c.name}" is now public`, "success");
    } catch {
      toast("The server could not be reached", "error");
    }
  };

  const confirmDelete = async () => {
    const target = deleting;
    setDeleting(null);
    if (!target) return;
    try {
      const res = await API(`/api/collections/${target.id}`, { method: "DELETE" });
      if (!res.ok) return toast(errorText(await res.json().catch(() => ({}))), "error");
      setCollections((prev) => prev?.filter((c) => c.id !== target.id) ?? prev);
      setTotal((t) => Math.max(0, t - 1));
      toast(`Deleted "${target.name}"`, "success");
    } catch {
      toast("The server could not be reached", "error");
    }
  };

  if (!collections) return null;
  if (collections.length === 0 && !isOwner) return null; // nothing to show visitors

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          Collections <span className="text-sm text-subtle">({formatCounts(total)})</span>
        </h2>
        {isOwner && canManage && (
          <Button size="md" icon={<PlusIcon size={14} weight="bold" />} onClick={() => setModal({ open: true })}>
            New Collection
          </Button>
        )}
      </div>

      {collections.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700 px-4 py-6 text-center text-sm text-subtle">
          You don't have any collections yet. Make one here, or with the Collection button on any post.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {collections.map((c) => (
            <CollectionTile
              key={c.id}
              collection={c}
              canManage={canManage}
              onEdit={() => setModal({ open: true, collection: c })}
              onTogglePrivacy={() => togglePrivacy(c)}
              onDelete={() => setDeleting(c)}
            />
          ))}
        </div>
      )}

      {page < totalPages && (
        <Button className="mt-3" loading={loadingMore} onClick={loadMore}>
          Show more
        </Button>
      )}

      <CollectionModal
        open={modal.open}
        collection={modal.collection}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        onSaved={onSaved}
      />

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete collection?"
        description={`"${deleting?.name}" will be deleted. The posts in it are not affected.`}
        confirmText="Delete"
      />
    </section>
  );
}


type TileProps = {
  collection: CollectionCard;
  canManage: boolean;
  onEdit: () => void;
  onTogglePrivacy: () => void;
  onDelete: () => void;
};

// One card: cover + name + count, links to the feed filtered to this collection
function CollectionTile({ collection: c, canManage, onEdit, onTogglePrivacy, onDelete }: TileProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu on a click outside it, or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const pick = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  const menuItem = "flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-zinc-800";

  return (
    <div className="group relative">
      <Link
        href={`/posts?query=${encodeURIComponent(collectionQuery(c.id))}`}
        title={c.name}
        className="relative block overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 transition duration-200 hover:-translate-y-1.5 hover:border-darkerAccent hover:shadow-lg hover:shadow-accent/30"
      >
        {c.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.cover.thumbnails.small} alt={c.name} loading="lazy" className="aspect-4/3 w-full object-cover" />
        ) : (
          <div className="flex aspect-4/3 w-full items-center justify-center text-xs text-subtle">
            {c.itemCount === 0 ? "Empty" : "No preview"}
          </div>
        )}

        {/* Private marker (only the owner ever sees private ones) */}
        {!c.isPublic && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-2xs font-medium text-amber-300">
            <LockSimpleIcon size={11} weight="bold" />
            Private
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/70 to-transparent px-2 pb-1.5 pt-5">
          <div className="truncate text-sm font-semibold text-white">{c.name}</div>
          <div className="text-xs tabular-nums text-white/70">
            {formatCounts(c.itemCount)} {c.itemCount === 1 ? "post" : "posts"}
          </div>
        </div>
      </Link>

      {/* Sibling of the Link (not inside it), so opening the menu doesn't navigate */}
      {canManage && (
        <div ref={menuRef} className="absolute right-1.5 top-1.5 z-10">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Collection options"
            aria-expanded={menuOpen}
            className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-black/70 text-white transition hover:bg-black/90 ${
              menuOpen ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            }`}
          >
            <DotsThreeVerticalIcon size={16} weight="bold" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96, transition: { duration: 0.1 } }}
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                style={{ originX: 1, originY: 0 }}
                className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-secondary-border bg-zinc-950 p-1 text-xs text-zinc-200 shadow-lg"
              >
                <button type="button" onClick={pick(onEdit)} className={menuItem}>
                  <PencilSimpleIcon size={14} /> Edit
                </button>
                <button type="button" onClick={pick(onTogglePrivacy)} className={menuItem}>
                  {c.isPublic ? <LockSimpleIcon size={14} /> : <GlobeHemisphereWestIcon size={14} />}
                  {c.isPublic ? "Make private" : "Make public"}
                </button>
                <button type="button" onClick={pick(onDelete)} className={`${menuItem} text-red-400`}>
                  <TrashIcon size={14} /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
