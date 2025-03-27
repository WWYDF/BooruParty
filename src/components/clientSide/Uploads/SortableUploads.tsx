'use client'

import { motion } from 'framer-motion'

type Props = {
  index: number
  id: string
  preview: string
  name: string
  isUploading?: boolean
  safety: 'safe' | 'sketchy' | 'unsafe'
  onSafetyChange: (safety: 'safe' | 'sketchy' | 'unsafe') => void
  onMove: (index: number, direction: 'up' | 'down') => void
  isFirst: boolean
  isLast: boolean
}

const safetyOptions: {
  label: string
  value: 'safe' | 'sketchy' | 'unsafe'
  color: string
}[] = [
  { label: 'Safe', value: 'safe', color: 'bg-green-800' },
  { label: 'Sketchy', value: 'sketchy', color: 'bg-yellow-800' },
  { label: 'Unsafe', value: 'unsafe', color: 'bg-red-600' },
]

export default function SortableUploads({
  index,
  preview,
  name,
  isUploading,
  safety,
  onSafetyChange,
  onMove,
  isFirst,
  isLast,
}: Props) {

  return (
    <li className="flex items-center justify-between gap-4 p-3 bg-secondary rounded-xl shadow">
      <div className="flex items-center gap-4">
        <img src={preview} alt={name} className="w-16 h-16 object-cover rounded-lg" />
        <span className="text-sm text-subtle max-w-[300px] truncate">{name}</span>
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
  
        {isUploading && (
          <div className="text-accent animate-pulse text-sm ml-4">Uploading…</div>
        )}
      </div>
    </li>
  )
}  