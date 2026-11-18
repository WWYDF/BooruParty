'use client';

import { useEffect, useRef, useState } from "react";
import { Reorder } from "framer-motion";
import { CheckIcon, DotsSixVerticalIcon, PencilSimpleIcon, PlusIcon, StarIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import ConfirmModal from "@/components/UI/Modals/ConfirmModal";
import { useToast } from "@/components/UI/Toast";
import { API, errorText } from "@/core/api";
import { formatCounts } from "@/core/formats";
import { CategoryFlag } from "@/core/types/tags";

// GET /api/tag-categories
type Category = {
  id: number;
  name: string;
  color: string;
  index: number;
  isDefault: boolean;
  flags: CategoryFlag[];
  _count?: { tags: number };
};

const FLAG_OPTIONS: { value: CategoryFlag; label: string; title: string }[] = [
  { value: "CREATOR", label: "Creator", title: "Who made the post, e.g. an Artists category" },
  { value: "SUBJECT", label: "Subject", title: "Who or what is in the post, e.g. a Characters category" },
];

const sameFlags = (a: CategoryFlag[], b: CategoryFlag[]) => a.length === b.length && a.every((f) => b.includes(f));

// Toggle chips for a category's flags
function FlagPicker({ value, onChange }: { value: CategoryFlag[]; onChange: (v: CategoryFlag[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FLAG_OPTIONS.map((opt) => {
        const on = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={on}
            title={opt.title}
            onClick={() => onChange(on ? value.filter((f) => f !== opt.value) : [...value, opt.value])}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors ${
              on
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-secondary-border bg-zinc-900 text-subtle hover:text-zinc-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

const inputClass =
  "rounded-lg border border-secondary-border bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-zinc-600";

// Native color picker + hex text box, kept in sync
function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={HEX.test(value) ? value : "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 cursor-pointer rounded-lg border border-secondary-border bg-transparent p-0.5"
        title="Pick a color"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        maxLength={7}
        spellCheck={false}
        className={`${inputClass} w-24 font-mono`}
      />
    </div>
  );
}

export default function CategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3c9aff");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editFlags, setEditFlags] = useState<CategoryFlag[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const load = async () => {
    try {
      const res = await API("/api/tag-categories");
      if (!res.ok) throw new Error();
      const data: Category[] = await res.json();
      setCategories(data);
    } catch {
      toast("Could not load categories", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const defaultCategory = categories.find((c) => c.isDefault);

  // Shared request helper: sends JSON, toasts the API's error, returns the body on success
  const send = async (path: string, method: string, body?: object) => {
    try {
      const res = await API(path, {
        method,
        ...(body && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(errorText(data), "error");
        return null;
      }
      return data;
    } catch {
      toast("The server could not be reached", "error");
      return null;
    }
  };

  const create = async () => {
    if (!newName.trim()) return toast("The category needs a name.", "error");
    if (!HEX.test(newColor)) return toast("Color must look like #3c9aff.", "error");
    setCreating(true);
    const created = await send("/api/tag-categories", "POST", { name: newName.trim(), color: newColor });
    setCreating(false);
    if (!created) return;
    setNewName("");
    toast(`Created "${created.name}"`, "success");
    load();
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor(c.color);
    setEditFlags(c.flags ?? []);
  };

  const saveEdit = async (c: Category) => {
    if (!editName.trim()) return toast("The category needs a name.", "error");
    if (!HEX.test(editColor)) return toast("Color must look like #3c9aff.", "error");

    const body: { name?: string; color?: string; flags?: CategoryFlag[] } = {};
    if (editName.trim() !== c.name) body.name = editName.trim();
    if (editColor.toLowerCase() !== c.color.toLowerCase()) body.color = editColor;
    if (!sameFlags(editFlags, c.flags ?? [])) body.flags = editFlags; // the whole list; [] clears them
    if (!Object.keys(body).length) return setEditingId(null);

    setBusyId(c.id);
    const updated = await send(`/api/tag-categories/${c.id}`, "PATCH", body);
    setBusyId(null);
    if (!updated) return;
    setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...updated } : x)));
    setEditingId(null);
  };

  const makeDefault = async (c: Category) => {
    setBusyId(c.id);
    const ok = await send(`/api/tag-categories/${c.id}`, "PATCH", { isDefault: true });
    setBusyId(null);
    if (!ok) return;
    toast(`"${c.name}" is now the default category`, "success");
    // Only one default at a time: the server flipped the old one, so take its word for everything
    setCategories((prev) => prev.map((x) => ({ ...x, isDefault: x.id === c.id })));
  };

  // The latest order, for the drop handler (it can fire before React re-renders with the final position)
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  // Runs when a row is dropped: one PUT with every id in the new order
  const saveOrder = async () => {
    const current = categoriesRef.current;
    if (current.every((c, i) => c.index === i)) return; // dropped where it started

    setSavingOrder(true);
    const saved: Category[] | null = await send("/api/tag-categories/reorder", "PUT", { ids: current.map((c) => c.id) });
    setSavingOrder(false);

    // Saved: the response is the stored list (same order we're showing, so nothing jumps).
    // Failed, e.g. 409 because someone added/removed a category meanwhile (already toasted): reload the truth.
    if (saved) setCategories(saved);
    else load();
  };

  const confirmDelete = async () => {
    const c = deleting;
    setDeleting(null);
    if (!c) return;
    const result = await send(`/api/tag-categories/${c.id}`, "DELETE");
    if (!result) return;
    toast(`Deleted "${c.name}" (${formatCounts(result.movedTags)} tags moved to ${defaultCategory?.name ?? "the default"})`, "success");
    load();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Create */}
      <section className="rounded-xl border border-secondary-border bg-zinc-900/40 p-5">
        <h2 className="mb-3 text-sm font-medium text-zinc-200">New category</h2>
        {/* items-stretch: the Add button grows to the text box's height */}
        <form className="flex flex-wrap items-stretch gap-2" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            maxLength={32}
            className={`${inputClass} min-w-0 flex-1`}
          />
          <ColorField value={newColor} onChange={setNewColor} />
          <Button type="submit" variant="success" icon={<PlusIcon size={18} weight="bold" />} loading={creating} />
        </form>
      </section>

      {/* List */}
      <section className="rounded-xl border border-secondary-border bg-zinc-900/40 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">Categories</h2>
            <p className="text-xs text-subtle">Drag to reorder (saves when you drop): tags are grouped in this order on posts. New tags go in the default category.</p>
          </div>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-zinc-600">Loading...</p>
        ) : (
          <Reorder.Group axis="y" values={categories} onReorder={setCategories} className="space-y-2">
            {categories.map((c) => {
              const editing = editingId === c.id;
              return (
                <Reorder.Item
                  key={c.id}
                  value={c}
                  // Position only: animating size would scale (squish) the row's contents when edit mode changes its height
                  layout="position"
                  dragListener={!editing}
                  onDragEnd={saveOrder}
                  className="flex items-center gap-3 rounded-xl border border-secondary-border bg-secondary px-3 py-2.5"
                >
                  <DotsSixVerticalIcon size={18} className={`shrink-0 text-zinc-600 ${editing ? "" : "cursor-grab active:cursor-grabbing"}`} />

                  {editing ? (
                    <form
                      className="flex flex-1 flex-wrap items-center gap-2"
                      onSubmit={(e) => { e.preventDefault(); saveEdit(c); }}
                    >
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={32}
                        autoFocus
                        className={`${inputClass} min-w-0 flex-1`}
                      />
                      <ColorField value={editColor} onChange={setEditColor} />
                      <Button type="submit" size="sm" variant="success" icon={<CheckIcon size={14} />} loading={busyId === c.id}>Save</Button>
                      <Button size="sm" icon={<XIcon size={14} />} onClick={() => setEditingId(null)}>Cancel</Button>
                      <div className="flex w-full items-center gap-2">
                        <span className="text-xs text-subtle">Flags:</span>
                        <FlagPicker value={editFlags} onChange={setEditFlags} />
                      </div>
                    </form>
                  ) : (
                    <>
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="min-w-0 flex-1 truncate text-sm" style={{ color: c.color }}>{c.name}</span>

                      {FLAG_OPTIONS.filter((opt) => c.flags?.includes(opt.value)).map((opt) => (
                        <span
                          key={opt.value}
                          title={opt.title}
                          className="rounded-full border border-secondary-border bg-zinc-900 px-2 py-0.5 text-xs text-subtle"
                        >
                          {opt.label}
                        </span>
                      ))}
                      {c.isDefault && (
                        <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">Default</span>
                      )}
                      {c._count && (
                        <span className="w-16 text-right text-xs text-zinc-500 tabular-nums">{formatCounts(c._count.tags)} tags</span>
                      )}

                      <div className="flex items-center gap-1">
                        {!c.isDefault && (
                          <button
                            type="button"
                            onClick={() => makeDefault(c)}
                            disabled={busyId === c.id}
                            title="Make default"
                            className="cursor-pointer rounded-lg p-1.5 text-subtle transition-colors hover:bg-zinc-800 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <StarIcon size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          title="Edit"
                          className="cursor-pointer rounded-lg p-1.5 text-subtle transition-colors hover:bg-zinc-800 hover:text-white"
                        >
                          <PencilSimpleIcon size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(c)}
                          disabled={c.isDefault}
                          title={c.isDefault ? "The default category can't be deleted" : "Delete"}
                          className="cursor-pointer rounded-lg p-1.5 text-subtle transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        )}
      </section>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={`Delete "${deleting?.name}"?`}
        description={`Its ${formatCounts(deleting?._count?.tags ?? 0)} tags will move to the default category${defaultCategory ? ` (${defaultCategory.name})` : ""}. This can't be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
