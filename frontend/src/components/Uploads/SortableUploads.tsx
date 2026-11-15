'use client'

import { XCircle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

type Props = {
  index: number
  id: string
  preview: string
  name: string
  isUploading?: boolean
  safety: 'SAFE' | 'SKETCHY' | 'UNSAFE'
  onSafetyChange: (safety: 'SAFE' | 'SKETCHY' | 'UNSAFE') => void
  onMove: (index: number, direction: 'up' | 'down') => void
  isFirst: boolean
  isLast: boolean
  duplicatePostId?: number
  onRemove: (id: string) => void
}

const safetyOptions: {
  label: string
  value: 'SAFE' | 'SKETCHY' | 'UNSAFE'
  color: string
}[] = [
  { label: 'Safe', value: 'SAFE', color: 'bg-green-800' },
  { label: 'Sketchy', value: 'SKETCHY', color: 'bg-yellow-800' },
  { label: 'Unsafe', value: 'UNSAFE', color: 'bg-red-600' },
]

export default function SortableUploads({
  id,
  index,
  preview,
  name,
  isUploading,
  safety,
  onSafetyChange,
  onMove,
  isFirst,
  isLast,
  duplicatePostId,
  onRemove,
}: Props) {

  return (
    <>
      {duplicatePostId && (
        <div className="w-full -mb-2 px-1 sm:px-0">
          <div className="bg-red-900 border border-red-600 text-red-200 text-sm rounded-t-md px-4 py-2 shadow">
            ⚠️ Duplicate of post{' '}
            <a
              href={`/post/${duplicatePostId}`}
              className="text-accent underline"
              target="_blank"
              rel="noreferrer"
            >
              #{duplicatePostId}
            </a>
          </div>
        </div>
      )}

      <li className="flex relative items-center justify-between gap-4 p-3 bg-secondary rounded-xl shadow">
        <div className="flex items-center gap-4">
          <img src={preview} alt={name} className="w-16 h-16 object-cover rounded-lg" />
          <div className="flex flex-col">
            <span className="text-sm text-subtle max-w-[300px] truncate">{name}</span>
            {isUploading && (
              <span className="text-accent animate-pulse text-xs mt-1">Uploading…</span>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          {/* Safety Selector */}
          <div className="p-1 rounded-md bg-neutral-950 flex items-center relative w-[200px]">
            {safetyOptions.map((opt) => {
              const isSelected = opt.value === safety
    
              return (
                <button
                  key={opt.value}
                  onClick={() => onSafetyChange(opt.value)}
                  disabled={isUploading}
                  className={`relative z-10 flex-1 py-1 text-sm text-center transition-colors ${
                    isSelected ? 'text-white' : 'text-subtle'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
    
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`absolute z-0 inset-y-0 w-1/3 rounded-md ${
                safetyOptions.find((opt) => opt.value === safety)?.color
              }`}
              style={{
                left: `${safetyOptions.findIndex((opt) => opt.value === safety) * 33.3333}%`,
              }}
            />
          </div>
    
          {/* Move Arrows */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onMove(index, 'up')}
              disabled={isFirst}
              className="text-sm text-subtle hover:text-accent disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => onMove(index, 'down')}
              disabled={isLast}
              className="text-sm text-subtle hover:text-accent disabled:opacity-30"
              title="Move down"
            >
              ↓
            </button>
          </div>
    
          <div className="flex flex-col">
            
          </div>
        </div>

        <button
          onClick={() => onRemove(id)}
          className="absolute -top-2 -right-2 bg-secondary border border-secondary-border text-red-900 hover:text-red-800 rounded-full p-1 shadow transition hover:scale-105"
          title="Remove"
        >
          <XCircle size={20} weight="fill" className='' />
        </button>
      </li>
    </>
  )
}  