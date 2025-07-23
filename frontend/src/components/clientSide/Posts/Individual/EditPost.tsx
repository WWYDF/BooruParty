"use client";

import { useEffect, useState } from "react";
import { X, Tag as TagIcon } from "@phosphor-icons/react";
import Link from "next/link";
import TagSelector from "../../TagSelector";
import TagSuggestionPopup from "../../Tags/SuggestionPopup";
import ConfirmModal from "../../ConfirmModal";
import { useToast } from "../../Toast";
import { Tag, TagCategory } from "@/core/types/tags";
import RelatedPostInput from "./PostRelation";
import { useDropzone } from "react-dropzone";
import { Post } from "@/core/types/posts";
import { formatCounts } from "@/core/formats";
import { motion, AnimatePresence } from "framer-motion";

export default function EditPost({
  post,
  onSaveSuccess = () => {},
  onDeleteSuccess = () => {},
}: {
  post: Post;
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
  const [pools, setPools] = useState<number[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [featured, setFeatured] = useState(!!post.specialPosts?.find((sp: any) => sp.label === "topWeek"));
  const [highlightedTagId, setHighlightedTagId] = useState<number | null>(null);
  const [newTagIds, setNewTagIds] = useState<number[]>([]);
  const [pendingTagNames, setPendingTagNames] = useState<string[]>([]);
  const [defaultCategory, setDefaultCategory] = useState<TagCategory>({ id: 1, name: 'Default', color: '#3c9aff', order: 10, isDefault: true, updatedAt: new Date() });
  const toast = useToast();

  useEffect(() => {
    if (post.tags) {
      const sorted = [...post.tags]
      .sort((a, b) => (a.category.order ?? 0) - (b.category.order ?? 0))
      .flatMap(group => {
        const alphaSorted = [...group.tags].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        return alphaSorted;
      });
      setInitialOrderedTags(sorted);
      setOrderedTags(sorted);
    }

    const related = [
      ...post.relatedFrom.map(r => r.to.id),
      ...post.relatedTo.map(r => r.from.id),
    ];
    setRelatedPosts([...new Set(related)]);

    setPools(post.pools.map(p => p.pool.id));
  }, [post.tags, post.relatedFrom, post.relatedTo, post.pools]);

  useEffect(() => {
    const loadDefaultCategory = async () => {
      const res = await fetch("/api/tag-categories?default=true");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setDefaultCategory(data[0]);
      }
    };
  
    loadDefaultCategory();
  }, []);


  const handleSave = async () => {
    setSaving(true);
  
    let finalTags = [...newlyAddedTags, ...initialOrderedTags];
  
    if (pendingTagNames.length > 0) {
      // Create missing tags
      const created = await createMissingTags(pendingTagNames);
  
      // Remove fake tags
      finalTags = finalTags.filter(
        (tag) => !pendingTagNames.includes(tag.name.toLowerCase())
      );
  
      // Add real tags
      finalTags.push(...created);
  
      // Update state for UI *after*
      setOrderedTags(finalTags);
      setInitialOrderedTags((prev) =>
        [...prev.filter((t) => !pendingTagNames.includes(t.name.toLowerCase())), ...created]
      );
      setNewlyAddedTags((prev) =>
        [...created, ...prev.filter((t) => !pendingTagNames.includes(t.name.toLowerCase()))]
      );
      setPendingTagNames([]);
    }
  
    // Filter only real tags (with positive IDs) to submit
    const validTags = finalTags.filter((t) => t.id > 0).map((t) => t.id);
  
    await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tags: validTags,
        sources: sources.split(",").map((s) => s.trim()).filter(Boolean),
        notes,
        safety,
        anonymous,
        relatedPosts,
        pools,
      }),
    });

    const wasFeatured = !!post.specialPosts?.find((sp: any) => sp.label === "topWeek");
    if (featured && !wasFeatured) {
      // Mark as featured
      await fetch("/api/posts/featured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, type: "topWeek" }),
      });
    } else if (!featured && wasFeatured) {
      // Remove from featured
      await fetch("/api/posts/featured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "topWeek" }), // intentionally omit postId
      });
    }

    if (replacementFile) {
      const formData = new FormData();
      formData.append("file", replacementFile);
      formData.append("postId", post.id.toString());
  
      const res = await fetch("/api/posts/replace", {
        method: "POST",
        body: formData,
      });
  
      if (!res.ok) {
        toast(`Failed to replace file: ${(await res.json()).error}`, "error");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaveSuccess();
  };

  const handleSelectTag = async (tag: Tag, impliedEnabled = true) => {
    let allTags: Tag[] = [tag];

    if (impliedEnabled) {
      if (tag.allImplications?.length) {
        allTags = [tag, ...tag.allImplications];
      } else {
        const res = await fetch(`/api/tags/${encodeURIComponent(tag.name)}`);
        const data = await res.json();
        allTags = [tag, ...(data.allImplications ?? [])];
      }
    }

    setNewlyAddedTags((prev) => {
      const existingIds = new Set([...prev, ...initialOrderedTags].map((t) => t.id));
      const newTags = allTags.filter((t) => !existingIds.has(t.id));
      const next = [...newTags, ...prev];
      setOrderedTags([...initialOrderedTags, ...next]);
      
      // Track newly added tag IDs to mark them green
      setNewTagIds((prevIds) => [
        ...prevIds,
        ...newTags.map((t) => t.id).filter((id) => !prevIds.includes(id)),
      ]);

      return next;
    });
  };

  const handleRemoveTag = (tagId: number) => {
    const removed = orderedTags.find((t) => t.id === tagId);
    if (!removed) return;
  
    // Remove from pendingTagNames if it's a fake tag
    if (removed.id < 0) {
      setPendingTagNames((prev) =>
        prev.filter((name) => name.toLowerCase() !== removed.name.toLowerCase())
      );
      console.log(pendingTagNames)
    }
  
    const nextNew = newlyAddedTags.filter((t) => t.id !== tagId);
    const nextInitial = initialOrderedTags.filter((t) => t.id !== tagId);
  
    setNewlyAddedTags(nextNew);
    setInitialOrderedTags(nextInitial);
    setOrderedTags([...nextInitial, ...nextNew]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: {
      "image/*": [],
      "video/*": [],
    },
    onDrop: (acceptedFiles) => {
      if (!acceptedFiles.length) return;
      setReplacementFile(acceptedFiles[0]);
    }
  });

  async function createMissingTags(names: string[]): Promise<Tag[]> {
    const created: Tag[] = [];
  
    for (const name of names) {
      const res = await fetch("/api/tags/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
  
      if (res.status === 403) {
        toast("You don't have permission to create tags.", "error");
        continue;
      }
  
      if (!res.ok) {
        console.error(`Failed to create tag "${name}"`);
        continue;
      }
  
      const data = await res.json();
      const newTag = data.created;
      created.push(newTag);
    }
  
    return created;
  }

  const allTags = [...newlyAddedTags, ...initialOrderedTags];
  const uniqueTags = Array.from(new Map(allTags.map(t => [t.id, t])).values());

  const handleCopyTags = async () => {
    const tagNames = uniqueTags.map((t) => t.name).join("\n");
    await navigator.clipboard.writeText(tagNames);
    toast("Tags copied to clipboard!");
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

      <div className="flex items-center gap-4 mt-4">
        <label className="inline-flex items-center text-sm">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="mr-2"
          />
          Post is Anonymous
        </label>

        <label className="inline-flex items-center text-sm">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            className="mr-2"
          />
          Feature this post
        </label>
      </div>

      {/* Form inputs */}
      <div className="grid grid-cols-2 gap-y-4 gap-x-4 mt-2">
        <div>
          <label className="text-white font-medium block mb-1">Safety</label>
          <select
            value={safety}
            onChange={(e) => setSafety(e.target.value as Post["safety"])}
            className="bg-secondary p-2 rounded text-base text-white w-full focus:outline-none focus:ring-2 focus:ring-zinc-800"
          >
            <option value="SAFE">Safe</option>
            <option value="SKETCHY">Sketchy</option>
            <option value="UNSAFE">Unsafe</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="text-white font-medium block mb-1">Sources</label>
          <input
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            className="w-full p-2 rounded bg-secondary text-base text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
            // maxLength={128}
          />
        </div>

        <div className="col-span-2">
          <label className="text-white font-medium block mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full p-2 rounded bg-secondary text-base text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
            maxLength={500}
          />
        </div>
      </div>

      {/* Related Posts */}
      <div className="col-span-2">
        <label className="text-white font-medium block mb-1">Related Posts</label>
        <RelatedPostInput value={relatedPosts} onChange={setRelatedPosts} />
      </div>

      {/* Current Pools */}
      <div className="col-span-2">
        <label className="text-white font-medium block mb-1">Pools</label>
        {/* This component is actually reusable for this, might rename later */}
        <RelatedPostInput value={pools} onChange={setPools} />
      </div>

      {/* Tag selector */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <label className="text-white font-medium">Tags</label>
          <button
            type="button"
            onClick={handleCopyTags}
            className="text-xs text-accent hover:underline"
          >
            Copy to clipboard
          </button>
        </div>
        <TagSelector
          onSelect={handleSelectTag}
          disabledTags={orderedTags}
          placeholder="Add tags..."
          addImpliedTags
          onDuplicateSelect={(tag) => {
            setHighlightedTagId(tag.id);
            setTimeout(() => setHighlightedTagId(null), 2000);
          }}
          addPendingTagName={(name) => {
            const normalized = name.toLowerCase();
          
            // prevent duplicates
            if (pendingTagNames.includes(normalized)) return;
          
            setPendingTagNames((prev) => [...prev, normalized]);
          
            // Create a temporary tag object
            const fakeTag: Tag = {
              id: -(pendingTagNames.length + 1), // negative temporary ID
              name,
              description: null,
              aliases: [],
              category: defaultCategory,
              allImplications: [],
              _count: { posts: 0 },
            };
          
            setOrderedTags((prev) => [fakeTag, ...prev]);
            setNewlyAddedTags((prev) => [fakeTag, ...prev]);
          }}
        />
      </div>

      {/* Selected tags display */}
      {uniqueTags.length > 0 && (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {uniqueTags.map((tag) => (
              <motion.div
                key={tag.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className={`flex items-center gap-2 border px-3 py-1.5 rounded-2xl w-fit transition-all duration-500
                  ${tag.id === highlightedTagId ? "ring-2 ring-darkerAccent/80 bg-accent/10" : ""}
                  ${newlyAddedTags.some((t) => t.id === tag.id) ? "border-zinc-800 bg-zinc-900/60" : "border-zinc-900"}
                  ${newTagIds.includes(tag.id) ? "border-zinc-800 bg-zinc-900/60" : ""}
                `}
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

                <div className="flex items-center gap-1">
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
                  <span className="text-xs text-zinc-400 ml-1">
                    {formatCounts(tag._count?.posts ?? 0)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
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
              handleSelectTag({
                ...tag,
                description: tag.description ?? undefined,
              });
              setActiveSuggestionTag(null);
            }}
          />
        </div>
      )}

      <div className="w-full mt-4">
        <label className="text-white font-medium block mb-1">Replace Post File</label>
        <div
          {...getRootProps()}
          className="w-full h-28 border-2 border-dashed border-zinc-700 rounded-xl flex items-center justify-center text-sm text-subtle hover:border-zinc-400 cursor-pointer transition text-center px-4"
        >
          <input {...getInputProps()} />
          {replacementFile
            ? `Replacing with '${replacementFile.name}'`
            : isDragActive
              ? "Drop to replace"
              : "Drop or click to replace the file"}
        </div>
      </div>

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
