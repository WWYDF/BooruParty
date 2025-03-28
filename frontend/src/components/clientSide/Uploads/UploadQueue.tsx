'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import SortableUploads from './SortableUploads'

type UploadFile = {
  id: string
  file: File
  preview: string
  safety: 'SAFE' | 'SKETCHY' | 'UNSAFE'
  duplicatePostId?: number
}

export default function UploadQueue() {
  const [queue, setQueue] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const idCounter = useRef(0)
  const [anonymous, setAnonymous] = useState(false)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)

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
    const validTypes = ['image/', 'video/'];
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
            ? '/speed.png' // Fallback image in /public
            : URL.createObjectURL(file),
          safety: 'SAFE' as const, // default
        };
      });
  
    setQueue((prev) => [...prev, ...newItems]);
  };  

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    noClick: true,
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
    if (uploading || queue.length === 0) return
  
    setUploading(true)
    const queueCopy = [...queue] // avoid modifying original while looping
  
    for (let i = 0; i < queueCopy.length; i++) {
      const item = queueCopy[i]
      setUploadingIndex(i)
  
      const formData = new FormData()
      formData.append('file', item.file)
      formData.append('anonymous', anonymous.toString())
      formData.append('safety', item.safety)
  
      try {
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        })
  
        const result = await res.json()

        if (result.duplicate && result.postId) {
          setQueue((prev) =>
            prev.map((f) =>
              f.id === item.id ? { ...f, duplicatePostId: result.postId } : f
            )
          )
          break;
        }
      
        // continue with normal removal
        setQueue((prev) => prev.filter((f) => f.id !== item.id))
        i--
        
        } catch (err) {
        console.error(`Failed to upload ${item.file.name}`, err)
      }
    }
  
    setUploading(false)
    setUploadingIndex(null)
  }

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

      <div className="mt-4 mb-2 flex items-center gap-2">
        <input
          type="checkbox"
          id="anonymous"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          className="accent"
        />
        <label htmlFor="anonymous" className="text-subtle">
          Upload anonymously
        </label>
      </div>

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
                isUploading={uploadingIndex === i}
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

      {queue.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="mt-6 px-4 py-2 rounded-xl bg-darkerAccent text-white disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Submit'}
        </button>
      )}
    </div>
  )
}