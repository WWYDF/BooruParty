"use client";

import { useEffect, useState } from "react";
import { PlusIcon, TagIcon } from "@phosphor-icons/react";
import InfoModal from "@/components/UI/Modals/InfoModal";
import Dropdown from "@/components/UI/Dropdown";
import Button from "@/components/UI/Button";
import { useToast } from "@/components/UI/Toast";
import { API, errorText } from "@/core/api";
import { CategoryInfo } from "@/core/types/tags";

type CreateTagModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (tag: { id: number; name: string; category: { color: string } }) => void;
  categories: (CategoryInfo & { isDefault?: boolean })[]; // already loaded by the page
  initialName?: string; // prefill, e.g. the name typed into a tag box
};

const MAX_DESCRIPTION = 4096;

const inputClass =
  "w-full rounded-lg border border-secondary-border bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-zinc-600";

export function CreateTagModal({ open, onClose, onCreated, categories, initialName = "" }: CreateTagModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Fresh form every time it opens, starting in the default category
  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setDescription("");
    setCategoryId(categories.find((c) => c.isDefault)?.id ?? categories[0]?.id ?? null);
  }, [open, categories, initialName]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast("The tag needs a name.", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await API("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ...(categoryId !== null && { categoryId }),
          ...(description.trim() && { description: description.trim() }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(errorText(data), "error");
        return;
      }
      toast(`Created "${data.name}"`, "success");
      onCreated(data);
      onClose();
    } catch {
      toast("The server could not be reached", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InfoModal
      open={open}
      onClose={onClose}
      icon={<TagIcon size={24} className="text-accent" />}
      title="New Tag"
      subtitle="Spaces become underscores. Aliases and implications can be added after."
      className="md:max-w-lg lg:max-w-lg"
      allowOverflow // the Category dropdown has to be able to open past the card's bottom edge
    >
      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-200">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="example_tag"
            maxLength={96}
            spellCheck={false}
            autoFocus
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-200">Category</label>
          <Dropdown
            value={categoryId}
            options={categories.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
            onChange={setCategoryId}
            disabled={saving}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-200">
            Description <span className="font-normal text-subtle">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={MAX_DESCRIPTION}
            placeholder="What this tag is for..."
            className={`${inputClass} resize-y`}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="success" icon={<PlusIcon size={16} />} loading={saving}>
            Create
          </Button>
        </div>
      </form>
    </InfoModal>
  );
}
