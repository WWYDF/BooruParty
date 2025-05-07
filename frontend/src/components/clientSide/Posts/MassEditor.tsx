"use client";

import { useEffect, useState } from "react";
import type { Tag } from "@/core/types/tags";
import MassTagger from "../MassTagger";
import RelatedPostInput from "./Individual/PostRelation";
import ConfirmModal from "../ConfirmModal";
import { useToast } from "../Toast";
import { sleep } from "@/core/importer/importUtils";


export default function MassEditor({
  open,
  onClose,
  postIds,
  setSelectedPostIds,
  setSelectionMode,
}: {
  open: boolean;
  onClose: () => void;
  postIds: number[];
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
  const toast = useToast();

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
    const results = await Promise.allSettled(
      postIds.map(async (id) => {
        try {
          const res = await fetch(`/api/posts/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tags: tags.length > 0 ? tags.map((t) => t.id) : undefined,
              safety: safety || undefined,
              relatedPosts: relatedPosts.length > 0 ? relatedPosts : undefined,
              pools: pools.length > 0 ? pools : undefined,
            }),
          });
  
          if (!res.ok) {
            const msg = await res.json().catch(() => ({}));
            toast(
              `Post ${id} failed (${res.status})${msg?.error ? `: ${msg.error}` : ""}`,
              "error"
            );
          }
  
          return { id, ok: res.ok };
        } catch (err) {
          toast(`Post ${id} failed (network error)`, "error");
          return { id, ok: false };
        }
      })
    );
  
    const successful = results.filter((r) => r.status === "fulfilled" && r.value?.ok).length;
    if (successful > 0) {
      toast(`Updated ${successful} post${successful > 1 ? "s" : ""}`, "success");
    }
  
    setIsSubmitting(false);
    onClose();
  };

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
              <MassTagger value={tags} onChange={setTags} label="Tags" />
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
              <RelatedPostInput value={relatedPosts} onChange={setRelatedPosts} />
              <p className="text-xs text-subtle mt-1">Press Enter or Space to add a post ID.</p>
            </div>

            {/* Pools */}
            <div>
              <label className="text-sm font-medium text-white block mb-1">Pools</label>
              <RelatedPostInput value={pools} onChange={setPools} placeholder="Add pool ID..." />
              <p className="text-xs text-subtle mt-1">Press Enter or Space to add a pool ID.</p>
            </div>

            {/* Delete */}
            <div className="pt-2 border-t border-zinc-700">
              <label className="text-sm font-medium text-red-400 mb-1 block">Delete Posts</label>
              <button
                onClick={() => setConfirmDeleteOpen(true)}
                className="text-sm text-red-500 hover:text-red-300"
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
            <button onClick={onClose} className="bg-zinc-700 px-4 py-2 rounded hover:bg-zinc-600">
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
