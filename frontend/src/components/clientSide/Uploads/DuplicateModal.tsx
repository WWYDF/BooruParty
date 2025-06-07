'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { Post } from '@/core/types/posts'
import { useState } from 'react'

type Props = {
  isOpen: boolean
  onClose: () => void
  currentPreview: string
  originalPost: Post
  onCancelUpload: () => void
  onProceedAnyway: (copyTags: boolean, addRelation: boolean) => void;
  onCopyTags: () => void
}

export default function DuplicateModal({
  isOpen,
  onClose,
  currentPreview,
  originalPost,
  onCancelUpload,
  onProceedAnyway,
  onCopyTags,
}: Props) {
  const [copyTagsChecked, setCopyTagsChecked] = useState(false)
  const [addRelationChecked, setAddRelationChecked] = useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl max-w-3xl w-full p-6 relative text-white"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
          >
            <button onClick={onClose} className="absolute top-3 right-3 text-subtle hover:text-white">
              <X size={24} />
            </button>

            <h2 className="text-xl font-bold mb-4">Possible Duplicate Detected</h2>
            <div className="flex flex-col sm:flex-row gap-8 items-center justify-center mt-4">
              <div className="flex flex-col items-center">
                <img
                  src={currentPreview}
                  className="rounded-lg w-40 h-40 object-contain border border-zinc-800"
                  alt="New upload"
                />
                <span className="text-xs mt-1 text-subtle">Your Upload</span>
              </div>

              <div className="text-3xl text-subtle">→</div>

              <div className="flex flex-col items-center">
                <a
                  href={`/post/${originalPost.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  <img
                    src={originalPost.previewPath}
                    className="rounded-lg w-40 h-40 object-contain border border-zinc-800 hover:opacity-80 transition"
                    alt={`Post ${originalPost.id}`}
                  />
                </a>
                <span className="text-xs mt-1 text-subtle">
                  Original Post #{originalPost.id}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-4">
              <div className="flex flex-wrap justify-center gap-6">
                <label className="flex items-center gap-2 text-sm text-subtle">
                  <input
                    type="checkbox"
                    checked={addRelationChecked}
                    onChange={(e) => setAddRelationChecked(e.target.checked)}
                    className="accent-accent"
                  />
                  Add relation
                </label>

                <label className="flex items-center gap-2 text-sm text-subtle">
                  <input
                    type="checkbox"
                    checked={copyTagsChecked}
                    onChange={(e) => setCopyTagsChecked(e.target.checked)}
                    className="accent-accent"
                  />
                  Also copy tags
                </label>
              </div>

              <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <button
                  onClick={onCancelUpload}
                  className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-800/50 text-red-400 transition"
                >
                  Cancel Upload
                </button>

                <button
                  onClick={() => onProceedAnyway(copyTagsChecked, addRelationChecked)}
                  className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-800/50 text-yellow-300 transition"
                >
                  Proceed Anyway
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
