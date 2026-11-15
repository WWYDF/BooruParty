'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import SortableUploads from './SortableUploads'
import { useToast } from '../Toast'
import { Tag } from '@/core/types/tags'
import MassTagger from '../MassTagger'
import DuplicateModal from './DuplicateModal'
import { Post } from '@/core/types/posts'

type UploadFile = {
  id: string
  file: File
  preview: string
  safety: 'SAFE' | 'SKETCHY' | 'UNSAFE'
  duplicatePostId?: number
}

interface Props {
  canDupe: boolean
  showAutoTag: boolean
}

export default function UploadQueue({ canDupe, showAutoTag }: Props) {
  const [queue, setQueue] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const idCounter = useRef(0)
  const [anonymous, setAnonymous] = useState(false)
  const [autoTag, setAutoTag] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [bulkSafety, setBulkSafety] = useState<"SAFE" | "SKETCHY" | "UNSAFE">("SAFE");
  const [globalTags, setGlobalTags] = useState<Tag[]>([]);
  const [dupeModalOpen, setDupeModalOpen] = useState(false);
  const [dupeItem, setDupeItem] = useState<UploadFile | null>(null);
  const [dupeOriginalPost, setDupeOriginalPost] = useState<Post | null>(null);
  const toast = useToast();

  const moveItem = (index: number, direction: 'up' | 'down') => {
    setQueue((prev) => {
      const newQueue = [...prev]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= newQueue.length) return prev
  
      const temp = newQueue[index]
      newQueue[index] = newQueue[targetIndex]
      newQueue[targetIndex] = temp
      return newQueue
    })
  }

  const onDrop = (acceptedFiles: File[]) => {
    const validTypes = ['image/', 'video/', 'media/'];
    const maxPreviewSize = 30 * 1024 * 1024; // 30 MB
  
    const newItems = acceptedFiles
      .filter((file) => validTypes.some(type => file.type.startsWith(type)) || file.type === 'image/gif')
      .map((file) => {
        const isImage = file.type.startsWith('image/');
        const isTooLarge = file.size > maxPreviewSize;
  
        return {
          id: `${idCounter.current++}`,
          file,
          preview: (!isImage || isTooLarge)
            ? '/i/speed.png' // Fallback image in /public/i
            : URL.createObjectURL(file),
          safety: 'SAFE' as const, // default
        };
      });
  
    setQueue((prev) => [...prev, ...newItems]);
  };  

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'image/*': [],
      'video/*': [],
      'image/gif': [],
    },
  })

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = queue.findIndex(item => item.id === active.id)
      const newIndex = queue.findIndex(item => item.id === over.id)
      setQueue(arrayMove(queue, oldIndex, newIndex))
    }
  }

  const handleRemove = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSubmit = async () => {
    if (uploading || queue.length === 0) return;
  
    setUploading(true);
  
    let i = 0;
    while (i < queue.length) {
      const item = queue[i];
      setUploadingId(item.id);
  
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('anonymous', anonymous.toString());
      formData.append('safety', item.safety);
      formData.append("tags", JSON.stringify(globalTags.map((t) => t.name)));
  
      try {
        const res = await fetch(`/api/posts/create${autoTag ? '?autoTag=true' : ''}`, {
          method: 'POST',
          body: formData,
        });
  
        if (res.status === 409) {
          const result = await res.json();
          if (result.duplicate && result.post) {
            setUploading(false);
            setUploadingId(null);
            setDupeItem(item);
            setDupeOriginalPost(result.post);
            setDupeModalOpen(true);
            return; // pause upload flow for user decision
          } else {
            toast('Duplicate upload but no postId returned.', 'error');
            break;
          }
        }
  
        if (!res.ok) {
          const result = await res.json();
          toast(`Upload failed: ${result.error || res.statusText}`, 'error');
          break;
        }
  
        // Upload successful
        setQueue((prev) => prev.filter((f) => f.id !== item.id));
  
        i++; // Manually move to next file after success
  
      } catch (err) {
        console.error(`Failed to upload ${item.file.name}`, err);
        toast(`Upload failed: ${item.file.name}`, 'error');
        break;
      }
    }
  
    setUploading(false);
    setUploadingId(null);
  };
  
  const handleBulkSafetyChange = (newSafety: "SAFE" | "SKETCHY" | "UNSAFE") => {
    setBulkSafety(newSafety);
    setQueue((prev) =>
      prev.map((item) => ({
        ...item,
        safety: newSafety,
      }))
    );
    // toast(`Marked all as ${newSafety.toUpperCase()}.`, 'success');
  };

  const handleCancelUpload = () => {
    if (dupeItem) handleRemove(dupeItem.id);
    setDupeModalOpen(false);
  };
  
  const handleProceedAnyway = async (copyTags: boolean, addRelation: boolean) => {
    if (!dupeItem || !dupeOriginalPost) return;
  
    setDupeModalOpen(false);
    setUploading(true);
    setUploadingId(dupeItem.id);
  
    const formData = new FormData();
    formData.append('file', dupeItem.file);
    formData.append('anonymous', anonymous.toString());
    formData.append('safety', dupeItem.safety);
  
    // Use tag names only if tags exist
    if (copyTags && dupeOriginalPost?.tags?.length > 0) {
      const tagNames = Array.from(
        new Set(
          dupeOriginalPost.tags
            .flatMap((group) => group.tags)
            .map((tag) => tag.name.toLowerCase())
        )
      );
      if (tagNames.length > 0) {
        formData.append('tags', JSON.stringify(tagNames));
      }
    }
    
    // Add relation if checked
    if (addRelation && dupeOriginalPost?.id) {
      formData.append('relatedPosts', JSON.stringify([dupeOriginalPost.id]));
    }
  
    try {
      const res = await fetch(`/api/posts/create?skipDupes=true${autoTag ? '&autoTag=true' : ''}`, {
        method: 'POST',
        body: formData,
      });
  
      if (!res.ok) {
        const err = await res.json();
        toast(`Upload failed: You lack permission to override duplicates!`, 'error');
      } else {
        setQueue((prev) => prev.filter((f) => f.id !== dupeItem.id));
      }
    } catch (err) {
      toast(`Upload failed: ${dupeItem.file.name}`, 'error');
    }
  
    setUploading(false);
    setUploadingId(null);
    setDupeItem(null);
  };
  
  const handleCopyTags = async () => {
    if (!dupeOriginalPost) return;
  
    try {
      const res = await fetch(`/api/posts/${dupeOriginalPost.id}`);
      const data = await res.json();
      if (data?.tags?.length) {
        const newTags = data.tags.filter((t: Tag) => !globalTags.some(g => g.id === t.id));
        setGlobalTags(prev => [...prev, ...newTags]);
        toast(`Copied ${newTags.length} tag(s) from duplicate.`, 'success');
      }
    } catch (err) {
      toast('Failed to copy tags.', 'error');
    }
  };


  const handleForceAllDupes = async () => {
    if (uploading || queue.length === 0) return;

    setUploading(true);

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      setUploadingId(item.id);

      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('anonymous', anonymous.toString());
      formData.append('safety', item.safety);
      formData.append('tags', JSON.stringify(globalTags.map((t) => t.name)));

      try {
        const res = await fetch(`/api/posts/create?skipDupes=true${autoTag ? '&autoTag=true' : ''}`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          toast(`Upload failed: ${err.error || item.file.name}`, 'error');
          break;
        }

        setQueue((prev) => prev.filter((f) => f.id !== item.id));
      } catch (err) {
        console.error(`Failed to force upload ${item.file.name}`, err);
        toast(`Upload failed: ${item.file.name}`, 'error');
        break;
      }
    }

    setUploading(false);
    setUploadingId(null);
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
          isDragActive ? 'border-accent bg-secondary' : 'border-secondary-border bg-secondary'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-subtle">Drag and drop your images, videos or gifs here</p>
      </div>

      <div className="mt-2 mb-2 flex items-start justify-between gap-4">
        <div className="grid grid-cols-2 md:grid-cols-3 items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            Upload anonymously
          </label>

          <div className="flex gap-1">
            {(["SAFE", "SKETCHY", "UNSAFE"] as const).map((level) => {
              const isActive = bulkSafety === level;
              const colorMap = {
                SAFE: "bg-green-600 text-white",
                SKETCHY: "bg-yellow-400 text-black",
                UNSAFE: "bg-red-600 text-white",
              };
              return (
                <motion.button
                  key={level}
                  onClick={() => handleBulkSafetyChange(level)}
                  className={`px-2 py-1 rounded text-xs transition-all duration-150 ${
                    isActive ? colorMap[level] : "bg-secondary-border text-subtle"
                  }`}
                  layout
                >
                  {level.charAt(0) + level.slice(1).toLowerCase()}
                </motion.button>
              );
            })}
          </div>

          <MassTagger
            value={globalTags}
            onChange={setGlobalTags}
            compactBelow
          />

          {showAutoTag && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoTag}
                onChange={(e) => setAutoTag(e.target.checked)}
              />
              AutoTag this batch
            </label>
          )}
        </div>
      </div>

      {queue.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="mt-6 px-4 py-2 rounded-xl border-2 border-green-800 text-zinc-200 hover:bg-green-800/30 transition disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      )}

      {canDupe && queue.length > 0 && (
        <button
          onClick={handleForceAllDupes}
          className="mt-4 ml-4 px-4 py-2 rounded-xl border-2 border-red-800 text-zinc-200 hover:bg-red-800/30 transition"
        >
          Force Duplicates
        </button>
      )}

      {queue.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={queue.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <motion.ul layout className="mt-6 space-y-3">
            {queue.map((item, i) => (
              <SortableUploads
                key={item.id}
                index={i}
                id={item.id}
                name={item.file.name}
                preview={item.preview}
                isUploading={uploadingId === item.id}
                safety={item.safety}
                onSafetyChange={(newSafety) => {
                  setQueue((prev) =>
                    prev.map((f) =>
                      f.id === item.id ? { ...f, safety: newSafety } : f
                    )
                  )
                }}
                onMove={moveItem}
                isFirst={i === 0}
                isLast={i === queue.length - 1}
                duplicatePostId={item.duplicatePostId}
                onRemove={handleRemove}
              />
            ))}

            </motion.ul>
          </SortableContext>
        </DndContext>
      )}

      <DuplicateModal
        isOpen={dupeModalOpen}
        onClose={() => setDupeModalOpen(false)}
        currentPreview={dupeItem?.preview || ''}
        originalPost={dupeOriginalPost!}
        onCancelUpload={handleCancelUpload}
        onProceedAnyway={(copy, rel) => handleProceedAnyway(copy, rel)}
        onCopyTags={handleCopyTags}
      />
    </div>
  )
}