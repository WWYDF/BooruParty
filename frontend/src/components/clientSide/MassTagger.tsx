"use client";

import { useEffect, useState } from "react";
import TagSelector from "./TagSelector";
import type { Tag } from "@/core/types/tags";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  label?: string;
  placeholder?: string;
  compactBelow?: boolean;
};

export default function MassTagger({ value, onChange, label, placeholder, compactBelow }: Props) {
  const [loadingImplications, setLoadingImplications] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const addTagWithImplications = async (tag: Tag) => {
    if (value.some((t) => t.id === tag.id)) return;

    const updated = [...value, tag];
    onChange(updated);

    setLoadingImplications(true);
    try {
      const res = await fetch(`/api/tags/${tag.name}`);
      const data = await res.json();
      const impliedTags: Tag[] = data.implications ?? [];

      const all = [...updated];
      for (const implied of impliedTags) {
        if (!all.some((t) => t.id === implied.id)) {
          all.push(implied);
        }
      }

      onChange(all);
    } catch (err) {
      console.error("Failed to fetch implications", err);
    } finally {
      setLoadingImplications(false);
    }
  };

  const removeTag = (id: number) => {
    const filtered = value.filter((t) => t.id !== id);
    onChange(filtered);
  };

  useEffect(() => {
    if (!showModal) return;
  
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
  
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showModal]);
  

  return (
    <div className="w-full">
      {!compactBelow ? (
        <div className="flex items-center justify-between text-xs text-subtle mb-1">
          <label>{label}</label>
          <button
            onClick={() => setShowModal(true)}
            className="text-zinc-400 hover:text-white underline"
          >
            {value.length} tag{value.length !== 1 ? "s" : ""} selected
          </button>
        </div>
      ) : null}

      <TagSelector
        onSelect={addTagWithImplications}
        disabledTags={value}
        placeholder={placeholder ?? "Add a tag..."}
      />

      {compactBelow && (
        <div className="flex items-center justify-between text-xs text-subtle mt-1">
          <label>{label}</label>
          <button
            onClick={() => setShowModal(true)}
            className="text-zinc-400 hover:text-white underline"
          >
            {value.length} tag{value.length !== 1 ? "s" : ""} selected
          </button>
        </div>
      )}

      {loadingImplications && <p className="text-xs text-zinc-400 mt-1">Loading implications...</p>}

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 w-full max-w-md shadow-xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-white font-semibold text-lg">Selected Tags</h2>
                <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-zinc-800">
                  ✕
                </button>
              </div>

              {value.length === 0 ? (
                <p className="text-zinc-400 text-sm">No tags selected yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                  {value.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center bg-secondary border border-secondary-border px-2 py-1 rounded text-zinc-100 text-sm"
                    >
                      <span
                        className="truncate font-medium"
                        style={{ color: tag.category.color }}
                      >
                        {tag.name}
                      </span>
                      <button
                        onClick={() => removeTag(tag.id)}
                        className="ml-2 text-red-400 hover:text-red-500"
                        title="Remove tag"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
