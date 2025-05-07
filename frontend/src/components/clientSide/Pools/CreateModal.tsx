'use client'

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreatePoolModal({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");
  const [description, setDescription] = useState("");
  const [safety, setSafety] = useState<"" | "SAFE" | "UNSAFE" | "SKETCHY">("");
  const [yearStart, setYearStart] = useState<number | null>(null);
  const [yearEnd, setYearEnd] = useState<number | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/pools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, artist, description, safety }),
    });
    onClose(); // close after submit
    router.refresh();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal"
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            key="modal-content"
            className="bg-zinc-950 border border-secondary-border rounded-lg p-6 w-full max-w-md shadow-lg"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-xl font-bold mb-4">Create New Pool</h2>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 rounded bg-secondary text-subtle focus:outline-none focus:ring-2 focus:ring-zinc-800"
                required
              />
              <input
                type="text"
                placeholder="Artist (optional)"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full p-2 rounded bg-secondary text-subtle focus:outline-none focus:ring-2 focus:ring-zinc-800"
              />
              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 rounded bg-secondary text-subtle focus:outline-none focus:ring-2 focus:ring-zinc-800"
              />
              <select
                value={safety}
                onChange={(e) => setSafety(e.target.value as "SAFE" | "UNSAFE" | "SKETCHY")}
                className="w-full p-2 rounded bg-secondary text-subtle focus:outline-none focus:ring-2 focus:ring-zinc-800"
                required
              >
                <option value="" disabled >Choose Safety</option>
                <option value="SAFE">Safe</option>
                <option value="SKETCHY">Sketchy</option>
                <option value="UNSAFE">Unsafe</option>
              </select>
              <div className="flex gap-2">
              <input
                type="number"
                placeholder="Start Year"
                value={yearStart ?? ""}
                onChange={(e) =>
                  setYearStart(e.target.value ? parseInt(e.target.value) : null)
                }
                className="w-full p-2 rounded bg-secondary text-subtle focus:outline-none focus:ring-2 focus:ring-zinc-800"
              />
              <input
                type="number"
                placeholder="End Year"
                value={yearEnd ?? ""}
                onChange={(e) =>
                  setYearEnd(e.target.value ? parseInt(e.target.value) : null)
                }
                disabled={yearEnd === null}
                className="w-full p-2 rounded bg-secondary text-subtle focus:outline-none focus:ring-2 focus:ring-zinc-800 disabled:opacity-40"
              />
            </div>
            <label className="text-sm text-subtle flex items-center gap-2">
              <input
                type="checkbox"
                checked={yearEnd === null}
                onChange={(e) =>
                  setYearEnd(e.target.checked ? null : new Date().getFullYear())
                }
                className="accent-accent"
              />
              Present (no end year)
            </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-subtle transition hover:text-white mr-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-darkerAccent transition rounded text-white text-sm hover:bg-darkerAccent/80"
                >
                  Create
                </button>
              </div>
            </form>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
  );
}
