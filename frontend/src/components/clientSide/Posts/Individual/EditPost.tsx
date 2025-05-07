"use client";

import { useEffect, useState } from "react";
import { X, Tag as TagIcon } from "@phosphor-icons/react";
import Link from "next/link";
import TagSelector from "../../TagSelector";
import TagSuggestionPopup from "../../Tags/SuggestionPopup";
import ConfirmModal from "../../ConfirmModal";
import { useToast } from "../../Toast";
import { Tag } from "@/core/types/tags";
import RelatedPostInput from "./PostRelation";

type PostType = {
  id: number;
  anonymous: boolean;
  safety: "SAFE" | "SKETCHY" | "UNSAFE";
  sources: string[];
  notes: string | null;
  tags: Tag[];
  relatedFrom: {
    to: { id: number };
  }[];
  relatedTo: {
    from: { id: number };
  }[];
};

export default function EditPost({
  post,
  onSaveSuccess = () => {},
  onDeleteSuccess = () => {},
}: {
  post: PostType;
  onSaveSuccess?: () => void;
  onDeleteSuccess?: () => void;
}) {
  const [orderedTags, setOrderedTags] = useState<Tag[]>([]);
  const [sources, setSources] = useState(post.sources.join(", "));
  const [notes, setNotes] = useState(post.notes || "");
  const [safety, setSafety] = useState(post.safety);
  const [anonymous, setAnonymous] = useState(post.anonymous);
  const [saving, setSaving] = useState(false);
  const [activeSuggestionTag, setActiveSuggestionTag] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [initialOrderedTags, setInitialOrderedTags] = useState<Tag[]>([]);
  const [newlyAddedTags, setNewlyAddedTags] = useState<Tag[]>([]);
  const [relatedPosts, setRelatedPosts] = useState<number[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const toast = useToast();

  // One-time init
  useEffect(() => {
    if (post.tags) {
      // preserve category-sorted order but flatten it
      const sorted = [...post.tags].sort((a, b) => {
        return a.category?.order ?? 0 - (b.category?.order ?? 0);
      });
      setInitialOrderedTags(sorted);
    }

  // Initialize related post IDs
  const related = [
    ...post.relatedFrom.map(r => r.to.id),
    ...post.relatedTo.map(r => r.from.id),
  ];
  setRelatedPosts([...new Set(related)]);

  }, [post.tags, post.relatedFrom, post.relatedTo]);

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
        relatedPosts,
      }),
    });

    setSaving(false);
    onSaveSuccess();
  };

  const handleAddTag = async (tag: Tag, impliedEnabled = true) => {
    let allTags: Tag[] = [tag];
  
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
    <div className="flex flex-col gap-4 text-sm text-subtle">
      {/* Save button */}
      <div className="w-full">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 transition text-white text-sm py-1.5 rounded-xl disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="w-full">
        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 rounded-xl disabled:opacity-50"
        >
          Delete Post
        </button>
      </div>

      {/* Form inputs */}
      <div className="grid grid-cols-2 gap-y-4 gap-x-4 mt-2">
        <div>
          <label className="text-white font-medium block mb-1">Safety</label>
          <select
            value={safety}
            onChange={(e) => setSafety(e.target.value as PostType["safety"])}
            className="bg-secondary p-2 rounded text-sm text-white w-full focus:outline-none focus:ring-2 focus:ring-zinc-800"
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
            className="w-full p-2 rounded bg-secondary text-sm text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
          />
        </div>

        <div className="col-span-2">
          <label className="text-white font-medium block mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full p-2 rounded bg-secondary text-sm text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
          />
        </div>
      </div>

      {/* Related Posts */}
      <div className="col-span-2">
        <label className="text-white font-medium block mb-1">Related Posts</label>
        <RelatedPostInput value={relatedPosts} onChange={setRelatedPosts} />
      </div>

      {/* Tag selector */}
      <div className="mt-2">
      <label className="text-white font-medium block mb-1">Tags</label>
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
              className="flex items-center gap-2 border border-zinc-900 px-3 py-1.5 rounded-2xl w-fit"
              style={{ color: tag.category?.color || "#fff" }}
            >
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="hover:opacity-80"
              >
                <X size={16} />
              </button>

              <Link href={`/tags/${tag.name}`} className="hover:opacity-80">
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
          const res = await fetch("/api/posts", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postIds: [post.id] }),
          });
        
          const result = await res.json();
        
          setShowDeleteModal(false);
        
          if (res.ok && result.deleted?.includes(post.id)) {
            onDeleteSuccess();
          } else {
            console.warn("Delete failed or unauthorized:", result);
            toast(`Failed to delete Post #${post.id}.`, 'error');
          }
        }}
        title="Delete Post?"
        description="This will permanently remove the post and its data. Are you sure?"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
