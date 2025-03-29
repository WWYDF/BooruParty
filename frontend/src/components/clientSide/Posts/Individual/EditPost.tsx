"use client";

import { useState } from "react";
import { X, Tag as TagIcon } from "@phosphor-icons/react";
import Link from "next/link";
import TagSelector, { TagResult } from "./EditPostTags";

export default function EditPost({
  post,
  onSuccess = () => {},
}: {
  post: any;
  onSuccess: () => void;
}) {
  const [tags, setTags] = useState<TagResult[]>(
    post.postTags.map((pt: any) => ({
      name: pt.tag.name,
      category: pt.tag.parentTag?.category || null,
    }))
  );
  const [newTags, setNewTags] = useState<string[]>([]);
  const [sources, setSources] = useState(post.sources.join(", "));
  const [notes, setNotes] = useState(post.notes || "");
  const [safety, setSafety] = useState(post.safety);
  const [anonymous, setAnonymous] = useState(post.anonymous);
  const [saving, setSaving] = useState(false);

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
  };

  const handleRemoveTag = (tagName: string) => {
    setTags(tags.filter((t) => t.name !== tagName));
    setNewTags(newTags.filter((t) => t !== tagName));
  };

  const handleAddTag = (incoming: TagResult[], added: string[]) => {
    const merged = [...tags];
    for (const tag of incoming) {
      if (!merged.find((t) => t.name === tag.name)) merged.push(tag);
    }
    setTags(merged);
    setNewTags([...newTags, ...added]);
  };

  return (
    <div className="flex flex-col gap-4 text-sm text-subtle">
      <div className="w-full">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-accent text-black text-sm py-1.5 rounded-xl disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-2">
        <div>
          <label className="text-white font-medium block mb-1">Safety</label>
          <select
            value={safety}
            onChange={(e) => setSafety(e.target.value)}
            className="bg-secondary p-2 rounded text-sm text-white w-full"
          >
            <option value="SAFE">Safe</option>
            <option value="SKETCHY">Sketchy</option>
            <option value="UNSAFE">Unsafe</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center text-sm">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="mr-2"
            />
            Post is Anonymous
          </label>
        </div>

        <div className="col-span-2">
          <label className="text-white font-medium block mb-1">Sources</label>
          <input
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            className="w-full p-2 rounded bg-secondary text-sm text-white"
          />
        </div>

        <div className="col-span-2">
          <label className="text-white font-medium block mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full p-2 rounded bg-secondary text-sm text-white"
          />
        </div>
      </div>

      <TagSelector
        initialTags={[]}
        onChange={handleAddTag}
      />

      {tags.length > 0 && (
        <div className="flex flex-col gap-4">
          {Object.entries(
            tags.reduce((acc: Record<string, TagResult[]>, tag) => {
              const category = tag.category?.name || "Uncategorized";
              if (!acc[category]) acc[category] = [];
              acc[category].push(tag);
              return acc;
            }, {})
          ).map(([category, grouped]) => (
            <div key={category}>
              <p className="text-white text-sm font-medium mb-1">{category}</p>
              <div className="flex flex-wrap gap-2">
                {grouped.map((tag, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 border border-secondary-border px-2 py-1 rounded-full"
                    style={{ color: tag.category?.color || "#fff" }}
                  >
                    <button onClick={() => handleRemoveTag(tag.name)} className="hover:opacity-80">
                      <X size={14} />
                    </button>
                    <Link href={`/dashboard/tags/${tag.name}`} className="hover:opacity-80">
                      <TagIcon size={14} />
                    </Link>
                    <button
                      onClick={() => console.log("todo: open suggestion popup", tag.name)}
                      className="hover:underline"
                    >
                      {tag.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}