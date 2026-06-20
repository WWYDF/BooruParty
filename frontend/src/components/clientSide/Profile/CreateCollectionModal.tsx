'use client'

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { FolderSimple, MagicWand, X } from "phosphor-react";
import { useToast } from "@/components/clientSide/Toast";
import { ArrowLeftIcon } from "@phosphor-icons/react";

type Step = "type" | "standard";

type Props = {
  open: boolean;
  onClose: () => void;
};

const stepVariants = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
};

export function CreateCollectionModal({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>("type");
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  function goTo(next: Step, dir: 1 | -1) {
    setDirection(dir);
    setStep(next);
  }

  function handleClose() {
    onClose();
    setTimeout(() => {
      setStep("type");
      setName("");
    }, 200);
  }

  async function handleCreate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/collections/self", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    handleClose();
    toast("Collection created!", "success");
    setTimeout(() => window.location.reload(), 2000);
  }

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1000]">
          <motion.div
            key="overlay"
            className="fixed inset-0 bg-black/70"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <div className="fixed inset-0 flex items-center justify-center px-4">
            <motion.div
              key="modal"
              className="bg-zinc-950 border border-secondary-border rounded-lg p-6 w-full max-w-sm shadow-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold">
                  {step === "type" ? "New Collection" : "New Standard Collection"}
                </h2>
                <button onClick={handleClose} className="text-zinc-500 hover:text-white transition">
                  <X size={18} />
                </button>
              </div>

              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.18, ease: "easeInOut" }}
                >
                  {step === "type" && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => goTo("standard", 1)}
                        className="flex-1 flex flex-col items-center justify-center gap-2 aspect-square rounded-lg border border-zinc-800 hover:border-accent hover:bg-accent/5 transition p-4"
                      >
                        <FolderSimple size={36} weight="duotone" className="text-accent" />
                        <span className="text-sm font-medium">Standard</span>
                        <span className="text-xs text-zinc-500 text-center leading-tight">Add posts manually</span>
                      </button>
                      <button
                        disabled
                        className="flex-1 flex flex-col items-center justify-center gap-2 aspect-square rounded-lg border border-zinc-800 opacity-40 cursor-not-allowed p-4"
                      >
                        <MagicWand size={36} weight="duotone" className="text-zinc-400" />
                        <span className="text-sm font-medium">Smart</span>
                        <span className="text-xs text-zinc-500 text-center leading-tight">Auto-populated from tag combinations</span>
                      </button>
                    </div>
                  )}

                  {step === "standard" && (
                    <form onSubmit={handleCreate} className="space-y-4">
                      <input
                        type="text"
                        placeholder="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full p-2 rounded bg-secondary text-subtle focus:outline-none focus:ring-2 focus:ring-zinc-800"
                        required
                        maxLength={64}
                        autoFocus
                      />
                      <div className="flex justify-between items-center pt-1">
                        <button
                          type="button"
                          onClick={() => goTo("type", -1)}
                          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white transition"
                        >
                          <ArrowLeftIcon size={16} />
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={loading || !name.trim()}
                          className="px-4 py-1.5 bg-darkerAccent transition rounded text-white text-sm hover:bg-darkerAccent/80 disabled:opacity-50"
                        >
                          {loading ? "Creating..." : "Create"}
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
