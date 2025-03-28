"use client";

import { useState, useEffect, useRef } from "react";
import TagSelector, { TagResult } from "@/components/clientSide/Tags/Selector";
import { motion, AnimatePresence } from "framer-motion";

export default function EditPost({
  post,
  onClose,
  onSuccess = () => {},
}: {
  post: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tags, setTags] = useState<TagResult[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [sources, setSources] = useState(post.sources.join(", "));
  const [notes, setNotes] = useState(post.notes || "");
  const [safety, setSafety] = useState(post.safety);
  const [anonymous, setAnonymous] = useState(post.anonymous);
  const [saving, setSaving] = useState(false);
  const initialState = useRef({
    tags: post.tags ?? [],
    sources: post.sources.join(", "),
    notes: post.notes || "",
    safety: post.safety,
    anonymous: post.anonymous,
  });

  useEffect(() => {
    const fetchFullTagData = async () => {
      if (!Array.isArray(post.tags)) return;
  
      const result: TagResult[] = [];
  
      for (const tagName of post.tags) {
        const res = await fetch(`/api/tags?search=${encodeURIComponent(tagName)}`);
        const matches: TagResult[] = await res.json();
        const exact = matches.find((m) => m.name === tagName);
        if (exact) result.push(exact);
      }
  
      setTags(result);
    };
  
    fetchFullTagData();
  }, [post.tags]);  

  const handleSave = async () => {
    setSaving(true);

    for (const name of newTags) {
      await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    }

    const canonicalNames = tags.map((t) => t.name);

    await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tags: canonicalNames,
        sources: sources.split(",").map((s: any) => s.trim()).filter(Boolean),
        notes,
        safety,
        anonymous,
      }),
    });

    setSaving(false);
    onSuccess();
    onClose();
  };

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;

    const hasChanges =
      notes !== initialState.current.notes ||
      sources !== initialState.current.sources ||
      safety !== initialState.current.safety ||
      anonymous !== initialState.current.anonymous ||
      newTags.length > 0 ||
      tags.map(t => t.name).sort().join(",") !== initialState.current.tags.sort().join(",");

    if (!hasChanges) onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleOutsideClick}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md mx-auto p-6 rounded-2xl bg-secondary shadow-xl"
        >
          <h2 className="text-lg font-semibold text-accent mb-4">Edit Post</h2>

          <div className="mb-4">
            <label className="text-sm text-subtle block mb-1">Tags</label>
            <TagSelector
              initialTags={tags}
              onChange={(selected, newOnes) => {
                setTags(selected);
                setNewTags(newOnes);
              }}
            />
          </div>

          <div className="mb-4">
            <label className="text-sm text-subtle block mb-1">Sources (comma separated)</label>
            <input
              value={sources}
              onChange={(e) => setSources(e.target.value)}
              className="w-full p-2 rounded bg-secondary-border text-subtle text-sm"
            />
          </div>

          <div className="mb-4">
            <label className="text-sm text-subtle block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full p-2 rounded bg-secondary-border text-subtle text-sm"
            />
          </div>

          <div className="mb-4">
            <label className="text-sm text-subtle block mb-1">Safety:</label>
            <select
              value={safety}
              onChange={(e) => setSafety(e.target.value)}
              className="bg-secondary-border p-2 rounded text-sm text-subtle"
            >
              <option value="safe">Safe</option>
              <option value="sketchy">Sketchy</option>
              <option value="nsfw">NSFW</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="inline-flex items-center text-sm text-subtle">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="mr-2"
              />
              Post is Anonymous
            </label>
          </div>

          <div className="flex justify-end gap-4">
            <button
              onClick={onClose}
              className="text-sm text-subtle"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-accent text-white text-sm px-4 py-1.5 rounded-xl disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
