"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TagMultiSelect from "@/components/clientSide/Tags/TagMultiSelect";

type Category = {
  id: number;
  name: string;
  color: string;
};

type Tag = {
  id: number;
  names: string[];
  categoryId: number;
  implications: { id: number; names: string[] }[];
  suggestions: { id: number; names: string[] }[];
};

type TagReference = {
  id: number;
  name: string;
};

type FormState = {
  canonical: string;
  aliases: string[];
  categoryId: number;
  implications: TagReference[];
  suggestions: TagReference[];
};

export default function EditTagPage() {
  const { name } = useParams<{ name: string }>();
  const [tag, setTag] = useState<Tag | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>({
    canonical: "",
    aliases: [],
    categoryId: 0,
    implications: [],
    suggestions: [],
  });

  useEffect(() => {
    const load = async () => {
      const [tagRes, catRes] = await Promise.all([
        fetch(`/api/tags/${name}`),
        fetch("/api/tag-categories"),
      ]);

      if (!tagRes.ok) return setTag(null);

      const tagData: Tag = await tagRes.json();
      const cats: Category[] = await catRes.json();

      setTag(tagData);
      setCategories(cats);
      setForm({
        canonical: tagData.names[0],
        aliases: tagData.names.slice(1),
        categoryId: tagData.categoryId,
        implications: tagData.implications.map((t) => ({
          id: t.id,
          name: t.names[0],
        })),
        suggestions: tagData.suggestions.map((t) => ({
          id: t.id,
          name: t.names[0],
        })),
      });
      setLoading(false);
    };

    load();
  }, [name]);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateAlias = (index: number, value: string) => {
    const updated = [...form.aliases];
    updated[index] = value;
    updateField("aliases", updated);
  };

  const addAlias = () => updateField("aliases", [...form.aliases, ""]);
  const removeAlias = (index: number) => {
    const updated = [...form.aliases];
    updated.splice(index, 1);
    updateField("aliases", updated);
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!tag) return <p className="text-red-500">Tag not found.</p>;

  return (
    <form className="space-y-6">
      <div>
        <label className="block text-subtle text-sm mb-1">Canonical Name</label>
        <input
          type="text"
          className="bg-secondary p-2 rounded w-full border border-secondary-border"
          value={form.canonical}
          onChange={(e) => updateField("canonical", e.target.value)}
        />
      </div>

      <div>
        <label className="block text-subtle text-sm mb-1">Aliases</label>
        <div className="space-y-2">
          {form.aliases.map((alias, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                className="bg-secondary p-2 rounded w-full border border-secondary-border"
                value={alias}
                onChange={(e) => updateAlias(i, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeAlias(i)}
                className="text-red-500 hover:underline text-sm"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addAlias}
            className="text-accent text-sm hover:underline"
          >
            + Add Alias
          </button>
        </div>
      </div>

      <div>
        <label className="block text-subtle text-sm mb-1">Category</label>
        <select
          value={form.categoryId}
          onChange={(e) => updateField("categoryId", parseInt(e.target.value))}
          className="bg-secondary p-2 rounded border border-secondary-border w-full"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id} style={{ color: cat.color }}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <TagMultiSelect
        label="Implications"
        selected={form.implications}
        onChange={(newTags) => updateField("implications", newTags)}
      />

      <TagMultiSelect
        label="Suggestions"
        selected={form.suggestions}
        onChange={(newTags) => updateField("suggestions", newTags)}
      />

      <button
        type="submit"
        className="bg-accent text-white px-4 py-2 rounded"
        disabled
      >
        Save Changes (Coming soon)
      </button>
    </form>
  );
}
