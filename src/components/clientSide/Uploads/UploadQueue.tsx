'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableUploads } from './SortableUploads'

type UploadFile = {
  id: string
  file: File
  preview: string
}

export default function UploadQueue() {
  const [queue, setQueue] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const idCounter = useRef(0)
  const [anonymous, setAnonymous] = useState(false)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)

  const onDrop = (acceptedFiles: File[]) => {
    const validTypes = ['image/', 'video/']
    const newItems = acceptedFiles
      .filter((file) => validTypes.some(type => file.type.startsWith(type)) || file.type === 'image/gif')
      .map((file) => ({
        id: `${idCounter.current++}`,
        file,
        preview: URL.createObjectURL(file),
      }))
    setQueue((prev) => [...prev, ...newItems])
  }

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
  
      try {
        await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        })
  
        setQueue((prev) => prev.filter((f) => f.id !== item.id)) // safely remove
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
                  id={item.id}
                  preview={item.preview}
                  name={item.file.name}
                  isUploading={uploadingIndex === i}
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
          className="mt-6 px-4 py-2 rounded-xl bg-accent text-white disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Submit'}
        </button>
      )}
    </div>
  )
}