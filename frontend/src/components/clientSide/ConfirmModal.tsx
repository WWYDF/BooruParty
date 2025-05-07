"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;

  // Optional radio select support
  radioOptions?: RadioOption[];
  selectedRadio?: string;
  setSelectedRadio?: (val: string) => void;
};

type RadioOption = {
  label: string;
  value: string;
  color?: string; // optional accent color
};

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  radioOptions,
  selectedRadio,
  setSelectedRadio,
}: ConfirmModalProps) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-zinc-900 border border-secondary-border rounded-xl p-6 w-full max-w-sm text-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-white text-lg font-semibold mb-4">{title}</h2>
          <p className="text-subtle whitespace-pre-line mb-6">{description}</p>

          {radioOptions && radioOptions?.length > 0 && selectedRadio !== undefined && setSelectedRadio && (
            <fieldset className="space-y-2 mb-6 text-left">
              {radioOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 text-sm text-subtle"
                >
                  <input
                    type="radio"
                    name="confirm-choice"
                    value={opt.value}
                    checked={selectedRadio === opt.value}
                    onChange={() => setSelectedRadio(opt.value)}
                    className={`accent-${opt.color ?? "zinc"}-500`}
                  />
                  {opt.label}
                </label>
              ))}
            </fieldset>
          )}

          <div className="flex gap-4 justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 transition rounded-md text-white"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 transition rounded-md text-white font-semibold"
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}