'use client'

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/UI/Button";
import { API, errorText } from "@/core/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
};

const inputClass = "w-full p-2 rounded bg-secondary text-subtle focus:outline-hidden focus:ring-2 focus:ring-zinc-800";

export function CreatePoolModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [yearStart, setYearStart] = useState<number | null>(new Date().getFullYear());
  const [yearEnd, setYearEnd] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await API("/api/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description.trim() || null,
          yearStart,
          yearEnd,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorText(data));
        return;
      }
      onClose();
      onCreated(data.id);
    } catch {
      setError("The server could not be reached.");
    } finally {
      setSaving(false);
    }
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
            <h2 className="text-xl font-bold mb-1">Create New Pool</h2>
            <p className="text-xs text-subtle mb-4">
              Artists, tags and safety are filled in automatically from the posts you add.
            </p>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                required
                maxLength={128}
              />
              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
                maxLength={2048}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Start Year"
                  value={yearStart ?? ""}
                  onChange={(e) => setYearStart(e.target.value ? parseInt(e.target.value) : null)}
                  className={inputClass}
                  min={1000}
                  max={3000}
                  required
                />
                <input
                  type="number"
                  placeholder="End Year"
                  value={yearEnd ?? ""}
                  onChange={(e) => setYearEnd(e.target.value ? parseInt(e.target.value) : null)}
                  disabled={yearEnd === null}
                  className={`${inputClass} disabled:opacity-40`}
                  min={1000}
                  max={3000}
                />
              </div>
              <label className="text-sm text-subtle flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={yearEnd === null}
                  onChange={(e) => setYearEnd(e.target.checked ? null : yearStart ?? new Date().getFullYear())}
                  className="accent-accent cursor-pointer"
                />
                Present (no end year)
              </label>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-subtle transition hover:text-white mr-2 cursor-pointer"
                >
                  Cancel
                </button>
                <Button type="submit" variant="primary" loading={saving}>
                  Create
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
