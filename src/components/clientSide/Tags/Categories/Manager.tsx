"use client";

import { useState } from "react";
import { Reorder, motion } from "framer-motion";

type TagCategory = {
  id: number;
  name: string;
  color: string;
  order: number | null;
};

export default function TagCategoryManager({ initialData }: { initialData: TagCategory[] }) {
  const [categories, setCategories] = useState(initialData);
  const [form, setForm] = useState({ name: "", color: "#ffffff", order: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", color: "#ffffff", order: "" });

  const submit = async () => {
    const res = await fetch("/api/tag-categories", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        color: form.color,
        order: form.order ? parseInt(form.order) : null,
      }),
    });

    const data = await res.json();
    setCategories([...categories, data]);
    setForm({ name: "", color: "#ffffff", order: "" });
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
    const res = await fetch(`/api/tag-categories/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: editForm.name,
        color: editForm.color,
        order: editForm.order ? parseInt(editForm.order) : null,
      }),
    });

    const updated = await res.json();
    const updatedList = categories.map((cat) => (cat.id === id ? updated : cat));
    setCategories(updatedList);
    setEditingId(null);
  };

  const saveOrder = async () => {
    await Promise.all(
      categories.map((cat, idx) =>
        fetch(`/api/tag-categories/${cat.id}`, {
          method: "PUT",
          body: JSON.stringify({ order: idx }),
        })
      )
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="bg-secondary-border p-4 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-subtle">Create New Category</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Name"
            className="bg-secondary p-2 rounded border border-secondary-border"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            type="color"
            className="w-10 h-10 rounded border"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
          <input
            type="number"
            placeholder="Order (optional)"
            className="bg-secondary p-2 rounded border border-secondary-border"
            value={form.order}
            onChange={(e) => setForm({ ...form, order: e.target.value })}
          />
          <button onClick={submit} className="bg-darkerAccent text-white p-2 rounded">
            Add
          </button>
        </div>
      </div>

      <div className="bg-secondary-border p-4 rounded-xl space-y-4">
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
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
                    <input
                      className="bg-secondary-border p-2 rounded w-full sm:w-1/2"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                    <input
                      type="color"
                      value={editForm.color}
                      onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                    />
                    <input
                      type="number"
                      placeholder="Order"
                      className="bg-secondary-border p-2 rounded w-20"
                      value={editForm.order}
                      onChange={(e) => setEditForm({ ...editForm, order: e.target.value })}
                    />
                    <button
                      className="bg-accent text-white px-3 py-1 rounded"
                      onClick={() => saveEdit(cat.id)}
                    >
                      Save
                    </button>
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
    </div>
  );
}
