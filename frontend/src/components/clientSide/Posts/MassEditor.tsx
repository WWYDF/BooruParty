"use client";

import { useEffect, useState } from "react";
import type { Tag } from "@/core/types/tags";
import MassTagger from "../MassTagger";
import RelatedPostInput from "./Individual/PostRelation";
import ConfirmModal from "../ConfirmModal";
import { useToast } from "../Toast";
import { sleep } from "@/core/importer/importUtils";
import { Posts } from "@/core/types/posts";


export default function MassEditor({
  open,
  onClose,
  selectedPosts,
  setSelectedPostIds,
  setSelectionMode,
}: {
  open: boolean;
  onClose: () => void;
  selectedPosts: Posts[];
  setSelectedPostIds: React.Dispatch<React.SetStateAction<number[]>>;
  setSelectionMode: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [safety, setSafety] = useState<"SAFE" | "SKETCHY" | "UNSAFE" | "">("");
  const [relatedPosts, setRelatedPosts] = useState<number[]>([]);
  const [pools, setPools] = useState<number[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [preRelatedPosts, setPreRelatedPosts] = useState<number[]>([]);
  const [prePools, setPrePools] = useState<number[]>([]);
  const [preTags, setPreTags] = useState<Tag[]>([]);
;
  const toast = useToast();
  const postIds = selectedPosts.map(p => p.id);

  // Pre-fill matching data
  useEffect(() => {
    if (!open || selectedPosts.length === 0) return;
  
    const getTags = (post: Posts) => post.tags ?? [];
    const getPools = (post: Posts) => post.pools.map(p => p.poolId);
    const getRelated = (post: Posts) => post.relatedFrom.map(r => r.toId);
  
    const first = selectedPosts[0];
  
    const sharedTags = getTags(first).filter(tag =>
      selectedPosts.every(p =>
        getTags(p).some(t => t.id === tag.id)
      )
    );
  
    const sharedPools = getPools(first).filter(poolId =>
      selectedPosts.every(p =>
        getPools(p).includes(poolId)
      )
    );
  
    const sharedRelated = getRelated(first).filter(toId =>
      selectedPosts.every(p =>
        getRelated(p).includes(toId)
      )
    );
  
    setPreTags(sharedTags);
    setPrePools(sharedPools);
    setPools(sharedPools);
    setPreRelatedPosts(sharedRelated);
    setRelatedPosts(sharedRelated);
  }, [open, selectedPosts]);


  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleApply = async () => {
    setIsSubmitting(true);
  
    // Immediately deselect
    setSelectedPostIds([]);
    setSelectionMode(false);
  
    // Handle Deletion First
    if (pendingDelete) {
      const res = await fetch("/api/posts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ postIds }),
      });
  
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        toast(`Delete failed (${res.status})${msg?.error ? `: ${msg.error}` : ""}`, "error");
      } else {
        toast(`Deleted ${postIds.length} post${postIds.length > 1 ? "s" : ""}`, "success");
  
        // Refresh the page to reflect deletions
        await sleep(1000);
        window.location.reload();
      }
  
      setIsSubmitting(false);
      onClose();
      return;
    }
  
    // Otherwise: Patch posts in parallel
    let results: { id: string | number; ok: boolean }[] = [];

    // figure out which pools actually changed
    const addedPools   = pools.filter(id => !prePools.includes(id));
    const removedPools = prePools.filter(id => !pools.includes(id));
    const changedPools = [...addedPools, ...removedPools];   // order doesn’t matter to the endpoint

    if (changedPools.length > 0) {
      const poolResponses = await Promise.allSettled(
        changedPools.map(async (poolId) => {
          const res = await fetch(`/api/pools/${poolId}`, {
            method: "POST",                        // ← always POST
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postIds }),     // endpoint adds or removes
          });

          if (!res.ok) {
            const msg = await res.json().catch(() => ({}));
            toast(
              `Pool ${poolId} toggle failed (${res.status})${msg?.error ? `: ${msg.error}` : ""}`,
              "error"
            );
            throw new Error(`Failed to toggle pool ${poolId}`);
          }

          return { poolId, ok: true };
        })
      );

      results.push(
        ...poolResponses.map((r, i) => ({
          id: `pool-${changedPools[i]}`,
          ok: r.status === "fulfilled",
        }))
      );
    }

    const preIds     = preTags.map(t => t.id);
    const finalIds   = tags.map(t => t.id);
    
    const addedIds   = finalIds.filter(id => !preIds.includes(id));
    const removedIds = preIds.filter(id => !finalIds.includes(id));
    
    const preRelIds   = preRelatedPosts;
    const finalRelIds = relatedPosts;
    
    const addedRel    = finalRelIds.filter(id => !preRelIds.includes(id));
    const removedRel  = preRelIds.filter(id => !finalRelIds.includes(id));
    
    const postTagMap = new Map(selectedPosts.map(p => [p.id, p.tags.map(t => t.id)]));
    const postRelMap = new Map(selectedPosts.map(p => [p.id, p.relatedFrom.map(r => r.toId)]));
    
    // Patch each post with other fields (pools already handled)
    for (const id of postIds) {
      try {
        const currentTags = postTagMap.get(id) ?? [];
        let nextTags = currentTags.filter(tid => !removedIds.includes(tid));
        for (const aid of addedIds) if (!nextTags.includes(aid)) nextTags.push(aid);
    
        const currentRel = postRelMap.get(id) ?? [];
        let nextRel = currentRel.filter(rid => !removedRel.includes(rid));   // removals
        for (const rid of addedRel) if (!nextRel.includes(rid)) nextRel.push(rid); // additions
    
        const res = await fetch(`/api/posts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tags: nextTags,
            safety: safety || undefined,
            relatedPosts: nextRel,
            pools: undefined, // already handled
          }),
        });
    
        if (!res.ok) {
          const msg = await res.json().catch(() => ({}));
          toast(`Post ${id} failed (${res.status})${msg?.error ? `: ${msg.error}` : ""}`, 'error');
        }
    
        results.push({ id, ok: res.ok });
      } catch {
        toast(`Post ${id} failed (network error)`, 'error');
        results.push({ id, ok: false });
      }
    }
    
    const successful = results.filter((r) => r.ok).length;
    if (successful > 0) {
      toast(`Updated ${successful} post${successful > 1 ? "s" : ""}`, "success");
    }
    
    setIsSubmitting(false);
    onClose();
    window.location.reload(); // not elegant, but we need to refresh the posts list that includes the tags.
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-2xl shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">
              Mass Edit {postIds.length} post{postIds.length > 1 ? "s" : ""}
            </h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-red-400">✕</button>
          </div>

          <div className="space-y-5">
            {/* Tags */}
            <div>
            <MassTagger
              value={tags}
              onChange={setTags}
              label="Tags"
              preSelected={preTags}
            />
            </div>

            {/* Safety */}
            <div>
              <label className="block text-sm font-medium text-white mb-1">Safety</label>
              <div className="flex gap-4">
                {["SAFE", "SKETCHY", "UNSAFE"].map((lvl) => (
                  <label key={lvl} className="text-sm text-white flex items-center gap-1">
                    <input
                      type="radio"
                      name="safety"
                      value={lvl}
                      checked={safety === lvl}
                      onChange={() => setSafety(lvl as any)}
                    />
                    {lvl}
                  </label>
                ))}
                <label className="text-sm text-zinc-400 ml-4">
                  <input
                    type="radio"
                    name="safety"
                    value=""
                    checked={safety === ""}
                    onChange={() => setSafety("")}
                  />{" "}
                  (Leave unchanged)
                </label>
              </div>
            </div>

            {/* Relations */}
            <div>
              <label className="text-sm font-medium text-white block mb-1">Related Posts</label>
              <RelatedPostInput
                value={relatedPosts}
                onChange={setRelatedPosts}
              />
              <p className="text-xs text-subtle mt-1">Press Enter or Space to add a post ID.</p>
            </div>

            {/* Pools */}
            <div>
              <label className="text-sm font-medium text-white block mb-1">Pools</label>
              <RelatedPostInput
                value={pools}
                onChange={setPools}
              />
              <p className="text-xs text-subtle mt-1">Press Enter or Space to add a pool ID.</p>
            </div>

            {/* Delete */}
            <div className="pt-2 border-t border-zinc-700">
              <label className="text-sm font-medium text-red-400 mb-1 block">Delete Posts</label>
              <button
                onClick={() => setConfirmDeleteOpen(true)}
                className={`px-3 py-2 mt-1 rounded text-sm border transition-colors
                  ${pendingDelete
                    ? "bg-red-600 border-red-500 text-white hover:bg-red-500"
                    : "bg-zinc-800 border-secondary-border text-red-400 hover:text-red-200"}
                `}
              >
                Permanently delete {postIds.length} post{postIds.length > 1 ? "s" : ""}
              </button>
              {pendingDelete && (
                <p className="text-xs text-red-400 mt-1">
                  Deletion confirmed — will delete on Apply.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-6 gap-2">
            <button
              onClick={() => {
                onClose(); // closes the modal
                setPendingDelete(false);
                setTags([]);
                setRelatedPosts([]);
                setPools([]);
                setSafety("");
              }}
              className="bg-zinc-700 px-4 py-2 rounded hover:bg-zinc-600"
            >
              Cancel
            </button>
            <button
              className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded text-white disabled:opacity-50"
              onClick={handleApply}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Applying..." : "Apply Changes"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setPendingDelete(true);
          setConfirmDeleteOpen(false);
        }}
        title={`Delete ${postIds.length} post${postIds.length > 1 ? "s" : ""}?`}
        description="This cannot be undone. Deletion will occur when you press Apply."
        confirmText="Mark for Deletion"
      />
    </>
  );
}
