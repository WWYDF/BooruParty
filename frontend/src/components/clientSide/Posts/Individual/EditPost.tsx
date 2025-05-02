"use client";

import { useEffect, useRef, useState } from "react";
import { X, Tag as TagIcon } from "@phosphor-icons/react";
import Link from "next/link";
import TagSelector, { TagType } from "../../TagSelector";
import TagSuggestionPopup from "../../Tags/SuggestionPopup";
import { AnimatePresence, motion } from "framer-motion";
import ConfirmModal from "../../ConfirmModal";

type PostType = {
  id: number;
  anonymous: boolean;
  safety: "SAFE" | "SKETCHY" | "UNSAFE";
  sources: string[];
  notes: string | null;
  tags: TagType[];
};

export default function EditPost({
  post,
  onSuccess = () => {},
}: {
  post: PostType;
  onSuccess: () => void;
}) {
  const [orderedTags, setOrderedTags] = useState<TagType[]>([]);
  const [sources, setSources] = useState(post.sources.join(", "));
  const [notes, setNotes] = useState(post.notes || "");
  const [safety, setSafety] = useState(post.safety);
  const [anonymous, setAnonymous] = useState(post.anonymous);
  const [saving, setSaving] = useState(false);
  const [activeSuggestionTag, setActiveSuggestionTag] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const initialized = useRef(false);
  const [initialOrderedTags, setInitialOrderedTags] = useState<TagType[]>([]);
  const [newlyAddedTags, setNewlyAddedTags] = useState<TagType[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // One-time init
  useEffect(() => {
    if (post.tags) {
      // preserve category-sorted order but flatten it
      const sorted = [...post.tags].sort((a, b) => {
        return a.category?.order ?? 0 - (b.category?.order ?? 0);
      });
      setInitialOrderedTags(sorted);
    }
  }, [post.tags]);

  const handleSave = async () => {
    setSaving(true);

    await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tags: [...newlyAddedTags, ...initialOrderedTags].map((t) => t.id),
        sources: sources.split(",").map((s) => s.trim()).filter(Boolean),
        notes,
        safety,
        anonymous,
      }),
    });

    setSaving(false);
    onSuccess();
  };

  const handleAddTag = async (tag: TagType, impliedEnabled = true) => {
    let allTags: TagType[] = [tag];
  
    if (impliedEnabled) {
      if (tag.allImplications?.length) {
        allTags = [tag, ...tag.allImplications];
      } else {
        // fallback fetch if no allImplications in search (e.g. from SuggestionPopup)
        const res = await fetch(`/api/tags/${encodeURIComponent(tag.name)}`);
        const data = await res.json();
        allTags = [tag, ...(data.allImplications ?? [])];
      }
    }
  
    setNewlyAddedTags((prev) => {
      const existingIds = new Set([...prev, ...initialOrderedTags].map((t) => t.id));
      const newTags = allTags.filter((t) => !existingIds.has(t.id));
      return [...newTags, ...prev];
    });
  };
  

  const handleRemoveTag = (tagId: number) => {
    setNewlyAddedTags((prev) => prev.filter((t) => t.id !== tagId));
    setInitialOrderedTags((prev) => prev.filter((t) => t.id !== tagId));
  };

  return (
    <div className="flex flex-col min-h-screen gap-4 text-sm text-subtle px-4 pt-4">
      {/* Save button */}
      <div className="w-full">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-accent text-black text-sm py-1.5 rounded-xl disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Form inputs */}
      <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-2">
        <div>
          <label className="text-white font-medium block mb-1">Safety</label>
          <select
            value={safety}
            onChange={(e) => setSafety(e.target.value as PostType["safety"])}
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

      {/* Tag selector */}
      <div className="mt-2">
        <TagSelector
          onSelect={handleAddTag}
          disabledTags={orderedTags}
          placeholder="Add tags..."
          addImpliedTags
        />
      </div>

      {/* Selected tags display */}
      {(newlyAddedTags.length > 0 || initialOrderedTags.length > 0) && (
        <div className="flex flex-col gap-2">
          {[...newlyAddedTags, ...initialOrderedTags].map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 border border-secondary-border px-3 py-1.5 rounded-lg"
              style={{ color: tag.category?.color || "#fff" }}
            >
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="hover:opacity-80"
              >
                <X size={16} />
              </button>

              <Link href={`/dashboard/tags/${tag.name}`} className="hover:opacity-80">
                <TagIcon size={16} />
              </Link>

              <button
                onClick={(e) => {
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  setPopupPosition({ x: rect.left, y: rect.bottom });
                  setActiveSuggestionTag(tag.name);
                }}
                className="hover:underline text-left"
              >
                {tag.name}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 bg-black pt-4 pb-4 -mx-4 px-4 z-10 border-t border-secondary-border">
        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-full text-center font-semibold"
        >
          Delete Post
        </button>
      </div>

      {activeSuggestionTag && popupPosition && (
        <div
          style={{
            position: "fixed",
            left: popupPosition.x,
            top: popupPosition.y + 4,
          }}
        >
          <TagSuggestionPopup
            tagName={activeSuggestionTag}
            onClose={() => setActiveSuggestionTag(null)}
            onAddTag={(tag) => {
              handleAddTag({
                ...tag,
                description: tag.description ?? undefined,
              });
              setActiveSuggestionTag(null);
            }}
          />
        </div>
      )}

      <ConfirmModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          await fetch("/api/posts/delete/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postIds: [post.id] }),
          });
          setShowDeleteModal(false);
          onSuccess();
        }}
        title="Delete Post?"
        description="This will permanently remove the post and its data. Are you sure?"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
