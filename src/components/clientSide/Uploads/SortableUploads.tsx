'use client'

import { motion } from 'framer-motion'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Props = {
  id: string
  preview: string
  name: string
  isUploading?: boolean
}

export const SortableUploads = ({ id, preview, name, isUploading }: Props) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <motion.li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-4 p-3 bg-secondary-border rounded-xl shadow"
    >
      <img src={preview} alt={name} className="w-16 h-16 object-cover rounded-lg" />
      <span className="text-sm text-subtle">{name}</span>

      {isUploading && (
        <div className="ml-auto text-accent animate-pulse text-sm">Uploading…</div>
      )}
    </motion.li>
  )
}
