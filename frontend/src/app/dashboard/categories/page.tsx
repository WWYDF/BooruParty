'use client';

import { useState, useEffect } from "react";
import { Reorder, motion } from "framer-motion";
import { useToast } from "@/components/clientSide/Toast";
import { Trash } from "@phosphor-icons/react";
import ConfirmModal from "@/components/clientSide/ConfirmModal";

type TagCategory = {
  id: number;
  name: string;
  color: string;
  order: number | null;
};

export default function Page() {
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [form, setForm] = useState({ name: "", color: "#ffffff", order: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", color: "#ffffff", order: "" });
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [purgeChoice, setPurgeChoice] = useState("keep");
  const toast = useToast();

  // Fetch categories once
  useEffect(() => {
    const fetchCategories = async () => {
      const res = await fetch('/api/tag-categories', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    };
    fetchCategories();
  }, []);

  const submit = async () => {
    try {
      const res = await fetch("/api/tag-categories", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          color: form.color,
          order: form.order ? parseInt(form.order) : null,
        }),
      });
  
      if (res.ok) {
        const data = await res.json();
        setCategories([...categories, data]);
        setForm({ name: "", color: "#ffffff", order: "" });
        toast("Category added successfully!", 'success');
      } else {
        toast("Failed to add category.", 'error');
      }
    } catch (e) {
      toast("Error adding category.", 'error');
    }
  };

  const startEditing = (cat: TagCategory) => {
    setEditingId(cat.id);
    setEditForm({
      name: cat.name,
      color: cat.color,
      order: cat.order?.toString() || "",
    });
  };

  const saveEdit = async (id: number) => {
    try {
      const res = await fetch(`/api/tag-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          color: editForm.color,
          order: editForm.order ? parseInt(editForm.order) : null,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        const updatedList = categories.map((cat) => (cat.id === id ? updated : cat));
        setCategories(updatedList);
        setEditingId(null);
      } else {
        toast("Failed to edit category.", 'error');
      }
    } catch (e) {
      toast("Failed to edit category.", 'error');
    }
  };

  const saveOrder = async () => {
    try {
      const res = await fetch("/api/tag-categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orders: categories.map((cat, idx) => ({
            id: cat.id,
            order: idx,
          })),
        }),
      });
  
      if (res.ok) {
        toast("Order saved successfully!", "success");
      } else {
        toast("Failed to save order.", "error");
      }
    } catch (error) {
      toast("Error saving order.", "error");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Create New Category */}
      <div className="bg-zinc-900 p-4 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-subtle">Create New Category</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Name"
            className="bg-secondary p-2 rounded border border-secondary-border focus:outline-none focus:ring-2 focus:ring-darkerAccent"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            type="color"
            className="w-10 h-10 rounded bg-transparent"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
          <input
            type="number"
            placeholder="Order (optional)"
            className="bg-secondary p-2 rounded border border-secondary-border focus:outline-none focus:ring-2 focus:ring-darkerAccent"
            value={form.order}
            onChange={(e) => setForm({ ...form, order: e.target.value })}
          />
          <button onClick={submit} className="bg-darkerAccent text-white p-2 rounded">
            Add
          </button>
        </div>
      </div>

      {/* Existing Categories */}
      <div className="bg-zinc-900 p-4 rounded-xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-subtle">Existing Categories</h2>
          <button
            onClick={saveOrder}
            className="bg-darkerAccent text-white px-3 py-1 rounded text-sm"
          >
            Save Order
          </button>
        </div>

        <Reorder.Group
          axis="y"
          values={categories}
          onReorder={setCategories}
          className="space-y-3"
        >
          {categories.map((cat) => (
            <Reorder.Item
              key={cat.id}
              value={cat}
              className="cursor-grab active:cursor-grabbing"
            >
              <motion.div
                layout
                className="bg-secondary p-4 rounded-2xl shadow flex justify-between items-center"
              >
                {editingId === cat.id ? (
                  <div className="flex justify-between items-center w-full gap-2">
                  {/* Left side: Inputs */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      className="bg-secondary-border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-darkerAccent"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      maxLength={64}
                    />
                    <input
                      type="color"
                      className="w-10 h-10 rounded-lg bg-transparent"
                      value={editForm.color}
                      onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                    />
                    <input
                      type="number"
                      placeholder="Order"
                      className="bg-secondary-border p-2 rounded-lg w-20 focus:outline-none focus:ring-2 focus:ring-darkerAccent"
                      value={editForm.order}
                      onChange={(e) => setEditForm({ ...editForm, order: e.target.value })}
                    />
                  </div>
                
                  {/* Right side: Save + Delete buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg transition-colors"
                      onClick={() => saveEdit(cat.id)}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setShowConfirm(true);
                      }}
                      className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg flex items-center justify-center transition-colors"
                    >
                      <Trash size={20} />
                    </button>
                  </div>
                </div>                
                ) : (
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => startEditing(cat)}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span>{cat.name}</span>
                  </div>
                )}
              </motion.div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
      <ConfirmModal
        open={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setSelectedCategoryId(null);
          setPurgeChoice("keep");
        }}
        onConfirm={async () => {
          if (!selectedCategoryId) return;
          const res = await fetch(`/api/tag-categories/${selectedCategoryId}?purgeTags=${purgeChoice === "purge"}`,
            { method: "DELETE" }
          );
          if (res.ok) {
            setCategories(categories.filter((cat) => cat.id !== selectedCategoryId));
            toast("Category deleted!", "success");
          } else {
            toast("Failed to delete category.", "error");
          }
          setShowConfirm(false);
          setSelectedCategoryId(null);
        }}
        title="Delete Tag Category?"
        description={`Should we delete just the category, or also remove all tags associated with it?\nThis cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        radioOptions={[
          { label: "Only delete the category", value: "keep", color: "orange" },
          { label: "Delete category and all tags", value: "purge", color: "red" },
        ]}
        selectedRadio={purgeChoice}
        setSelectedRadio={setPurgeChoice}
      />
    </div>
  );
}
