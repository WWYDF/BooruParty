"use client";

import { useState } from "react";

type Props = {
  post: {
    id: number;
    tags: string[];
    sources: string[];
    notes: string | null;
    safety: string;
    anonymous: boolean;
  };
  onClose: () => void;
  onSuccess: () => void;
};

export default function EditPostModal({ post, onClose, onSuccess }: Props) {
  const [tags, setTags] = useState(post.tags.join(", "));
  const [sources, setSources] = useState(post.sources.join(", "));
  const [notes, setNotes] = useState(post.notes || "");
  const [safety, setSafety] = useState(post.safety);
  const [anonymous, setAnonymous] = useState(post.anonymous);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tags: tags.split(",").map(t => t.trim()),
        sources: sources.split(",").map(s => s.trim()),
        notes,
        safety,
        anonymous,
      }),
    });

    setLoading(false);
    if (res.ok) {
      onSuccess();
      onClose();
    } else {
      alert("Failed to update post.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-secondary p-6 rounded-2xl w-full max-w-lg shadow-xl space-y-4">
        <h2 className="text-xl text-accent font-semibold">Edit Post</h2>

        <div className="space-y-2">
          <label className="block text-sm text-subtle">Tags (comma separated)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full p-2 rounded bg-secondary-border text-subtle text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-subtle">Sources (comma separated)</label>
          <input
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            className="w-full p-2 rounded bg-secondary-border text-subtle text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-subtle">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2 rounded bg-secondary-border text-subtle text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-subtle">Safety:</label>
          <select
            value={safety}
            onChange={(e) => setSafety(e.target.value)}
            className="bg-secondary-border text-sm text-subtle rounded p-1"
          >
            <option value="safe">Safe</option>
            <option value="nsfw">NSFW</option>
            <option value="questionable">Questionable</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            id="anon"
          />
          <label htmlFor="anon" className="text-sm text-subtle">Post is Anonymous</label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="text-sm text-subtle hover:underline">
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={handleSave}
            className="bg-accent text-sm px-4 py-1.5 rounded-xl text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
