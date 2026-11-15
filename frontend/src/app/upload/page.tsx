'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import SortableUploads from '@/components/Uploads/SortableUploads'
import DuplicateModal from '@/components/Uploads/DuplicateModal'
// import MassTagger from '@/components/Tags/MassTagger'
import { useToast } from '@/components/UI/Toast'
import { useUser } from '@/components/UserProvider'
import { API, errorText } from '@/core/api'
import { Tag } from '@/core/types/tags'
import { PostDetail, Safety } from '@/core/types/posts'

type UploadFile = {
  id: string
  file: File
  preview: string
  safety: Safety
  duplicatePostId?: number
}

type UploadResult =
  | { status: 'ok' }
  | { status: 'duplicate'; postId: number }
  | { status: 'error'; message: string }

const SAFETY_LEVELS: Safety[] = ['SAFE', 'QUESTIONABLE', 'EXPLICIT']
const SAFETY_COLORS: Record<Safety, string> = {
  SAFE: 'bg-green-600 text-white',
  QUESTIONABLE: 'bg-yellow-400 text-black',
  EXPLICIT: 'bg-red-600 text-white',
}
const MAX_PREVIEW_BYTES = 30 * 1024 * 1024 // don't make object URLs for huge files

export default function UploadPage() {
  const { user } = useUser()
  const toast = useToast()

  const [queue, setQueue] = useState<UploadFile[]>([])
  const queueRef = useRef<UploadFile[]>([]) // latest queue for async loops (state in closures goes stale)
  const [uploading, setUploading] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const idCounter = useRef(0)
  const [bulkSafety, setBulkSafety] = useState<Safety>('SAFE')
  const [globalTags, setGlobalTags] = useState<Tag[]>([])

  // Duplicate handling
  const [dupeModalOpen, setDupeModalOpen] = useState(false)
  const [dupeItem, setDupeItem] = useState<UploadFile | null>(null)
  const [dupeOriginalPost, setDupeOriginalPost] = useState<PostDetail | null>(null)

  useEffect(() => { queueRef.current = queue }, [queue])

  // Free object URLs for previews when the page unmounts
  useEffect(() => () => {
    queueRef.current.forEach((item) => item.preview.startsWith('blob:') && URL.revokeObjectURL(item.preview))
  }, [])

  const hasPerm = (perm: string) => user?.permissions.includes(perm) ?? false
  const canDupe = hasPerm('posts.create.dupes')

  const removeFromQueue = (id: string) => {
    setQueue((prev) => {
      const item = prev.find((f) => f.id === id)
      if (item?.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview)
      return prev.filter((f) => f.id !== id)
    })
  }

  const moveItem = (index: number, direction: 'up' | 'down') => {
    setQueue((prev) => {
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= prev.length) return prev
      return arrayMove(prev, index, target)
    })
  }

  const onDrop = (acceptedFiles: File[]) => {
    const newItems: UploadFile[] = acceptedFiles
      .filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'))
      .map((file) => ({
        id: `${idCounter.current++}`,
        file,
        preview: file.type.startsWith('image/') && file.size <= MAX_PREVIEW_BYTES
          ? URL.createObjectURL(file)
          : '/i/speed.png', // fallback image in /public/i
        safety: bulkSafety,
      }))

    setQueue((prev) => [...prev, ...newItems])
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: { 'image/*': [], 'video/*': [] },
  })

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setQueue((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id)
      const newIndex = prev.findIndex((item) => item.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  // One POST /api/posts/create. The backend only reads fields sent BEFORE the file, so the file goes last.
  const uploadOne = async (item: UploadFile, opts: { skipDupes?: boolean; tags: string[] }): Promise<UploadResult> => {
    const formData = new FormData()
    formData.append('safety', item.safety)
    formData.append('tags', JSON.stringify(opts.tags))
    if (opts.skipDupes) formData.append('skipDupes', 'true')
    formData.append('file', item.file) // must be last

    try {
      // No Content-Type header: the browser sets multipart/form-data with the right boundary itself
      const res = await API('/api/posts/create', { method: 'POST', body: formData })
      if (res.ok) return { status: 'ok' }

      const data = await res.json().catch(() => ({ error: res.statusText }))
      if (res.status === 409 && typeof data.duplicateOf === 'number') {
        return { status: 'duplicate', postId: data.duplicateOf }
      }
      return { status: 'error', message: errorText(data) }
    } catch {
      return { status: 'error', message: 'Could not reach the server' }
    }
  }

  // Uploads the queue top to bottom. Stops on an error, pauses on a duplicate.
  const runQueue = async (opts: { skipDupes?: boolean } = {}) => {
    if (uploading) return
    setUploading(true)
    const tags = globalTags.map((t) => t.name)

    for (const item of [...queueRef.current]) {
      setUploadingId(item.id)
      const result = await uploadOne(item, { skipDupes: opts.skipDupes, tags })

      if (result.status === 'ok') {
        removeFromQueue(item.id)
        continue
      }

      if (result.status === 'duplicate') {
        setQueue((prev) => prev.map((f) => (f.id === item.id ? { ...f, duplicatePostId: result.postId } : f)))
        await openDuplicateModal(item, result.postId)
        break // resumes after the user decides in the modal
      }

      toast(`${item.file.name}: ${result.message}`, 'error')
      break
    }

    setUploading(false)
    setUploadingId(null)
  }

  const openDuplicateModal = async (item: UploadFile, postId: number) => {
    try {
      const res = await API(`/api/posts/${postId}`)
      if (!res.ok) throw new Error()
      setDupeOriginalPost(await res.json())
      setDupeItem(item)
      setDupeModalOpen(true)
    } catch {
      // Can't show the comparison (e.g. the original is hidden from us), but the banner still links it
      toast(`${item.file.name} is a duplicate of post #${postId}`, 'error')
    }
  }

  const closeDuplicateModal = () => {
    setDupeModalOpen(false)
    setDupeItem(null)
    setDupeOriginalPost(null)
  }

  const handleCancelUpload = () => {
    if (dupeItem) removeFromQueue(dupeItem.id)
    closeDuplicateModal()
    // queueRef updates after the next render, so resume on the next tick
    setTimeout(() => { if (queueRef.current.length) runQueue() }, 0)
  }

  const handleProceedAnyway = async (copyTags: boolean) => {
    if (!dupeItem || !dupeOriginalPost) return
    const item = dupeItem
    const tags = new Set(globalTags.map((t) => t.name))
    if (copyTags) dupeOriginalPost.tags.forEach((t) => tags.add(t.name))
    closeDuplicateModal()

    setUploading(true)
    setUploadingId(item.id)
    const result = await uploadOne(item, { skipDupes: true, tags: [...tags] })
    setUploading(false)
    setUploadingId(null)

    if (result.status !== 'ok') {
      toast(`${item.file.name}: ${result.status === 'error' ? result.message : 'Still flagged as a duplicate'}`, 'error')
      return
    }

    removeFromQueue(item.id)
    setTimeout(() => { if (queueRef.current.length) runQueue() }, 0)
  }

  const handleBulkSafetyChange = (newSafety: Safety) => {
    setBulkSafety(newSafety)
    setQueue((prev) => prev.map((item) => ({ ...item, safety: newSafety })))
  }

  // Permission gates
  if (user === undefined) return null // still loading /api/me

  if (!user || !hasPerm('posts.create')) {
    return (
      <main className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 text-red-400">
        <h1 className="text-3xl font-bold mb-2">Unauthorized</h1>
        <p className="text-base text-subtle max-w-md">
          {user
            ? 'Sorry, but you are not allowed to create posts.'
            : <>Please <a className="text-accent hover:underline" href="/auth/login">log in</a> to upload.</>}
        </p>
      </main>
    )
  }

  return (
    <div className="p-8">
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
            <div className="flex gap-1">
              {SAFETY_LEVELS.map((level) => (
                <motion.button
                  key={level}
                  onClick={() => handleBulkSafetyChange(level)}
                  className={`px-2 py-1 rounded text-xs transition-all duration-150 ${
                    bulkSafety === level ? SAFETY_COLORS[level] : 'bg-secondary-border text-subtle'
                  }`}
                  layout
                >
                  {level.charAt(0) + level.slice(1).toLowerCase()}
                </motion.button>
              ))}
            </div>

            {/* <MassTagger value={globalTags} onChange={setGlobalTags} compactBelow /> */}
          </div>
        </div>

        {queue.length > 0 && (
          <button
            onClick={() => runQueue()}
            disabled={uploading}
            className="mt-6 px-4 py-2 rounded-xl border-2 border-green-800 text-zinc-200 hover:bg-green-800/30 transition disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        )}

        {canDupe && queue.length > 0 && (
          <button
            onClick={() => runQueue({ skipDupes: true })}
            disabled={uploading}
            className="mt-4 ml-4 px-4 py-2 rounded-xl border-2 border-red-800 text-zinc-200 hover:bg-red-800/30 transition disabled:opacity-50"
          >
            Force Duplicates
          </button>
        )}

        {queue.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={queue.map((item) => item.id)} strategy={verticalListSortingStrategy}>
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
                    onSafetyChange={(newSafety) =>
                      setQueue((prev) => prev.map((f) => (f.id === item.id ? { ...f, safety: newSafety } : f)))
                    }
                    onMove={moveItem}
                    isFirst={i === 0}
                    isLast={i === queue.length - 1}
                    duplicatePostId={item.duplicatePostId}
                    onRemove={removeFromQueue}
                  />
                ))}
              </motion.ul>
            </SortableContext>
          </DndContext>
        )}

        {dupeOriginalPost && (
          <DuplicateModal
            isOpen={dupeModalOpen}
            onClose={closeDuplicateModal}
            currentPreview={dupeItem?.preview || ''}
            originalPost={dupeOriginalPost}
            onCancelUpload={handleCancelUpload}
            onProceedAnyway={handleProceedAnyway}
            canDupe={canDupe}
          />
        )}
      </div>
    </div>
  )
}
