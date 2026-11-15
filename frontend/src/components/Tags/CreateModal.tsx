import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useToast } from "../Toast";

type CreateTagModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

type TagCategory = {
  id: number;
  name: string;
  color: string;
  order: number;
};

export function CreateTagModal({ open, onClose, onCreated }: CreateTagModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      fetch("/api/tag-categories?default=true")
        .then((res) => res.json())
        .then((data: TagCategory[]) => {
          setCategories(data);
          if (data.length > 0) {
            setCategoryId(data[0].id); // 👈 set first category as default
          }
        })
        .catch((err) => console.error("Failed to load categories", err));
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!name || !categoryId) {
      toast("Name and category are required.", "error");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/tags/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description.trim() || null,
          categoryId,
        }),
      });

      if (res.ok) {
        toast("Tag created successfully!", "success");
        onCreated();
        onClose();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to create tag.", "error");
      }
    } catch (err) {
      console.error(err);
      toast("Failed to create tag.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-secondary border border-secondary-border p-6 rounded-lg w-full max-w-md"
          >
            <h2 className="text-xl font-bold text-accent mb-4">Create New Tag</h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-zinc-600 text-sm">Name</label>
                <input
                  type="text"
                  className="w-full bg-secondary border border-secondary-border p-2 rounded mt-1 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                  placeholder="example_tag"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={64}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-zinc-600 text-sm">Description (optional)</label>
                <textarea
                  className="w-full bg-secondary border border-secondary-border p-2 rounded mt-1 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                  placeholder="Describe the tag here..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-zinc-600 text-sm">Category</label>
                <select
                  value={categoryId ?? ""}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="w-full bg-secondary border border-secondary-border p-2 rounded mt-1 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                  required
                >
                  <option value="" disabled>Select category</option>
                  {categories
                    .sort((a, b) => a.order - b.order)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-700 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}