"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TagSelector from "@/components/clientSide/TagSelector";
import { useToast } from "@/components/clientSide/Toast";
import { Tag } from "@/core/types/tags";

type Category = {
  id: number;
  name: string;
  color: string;
  order: number;
};

export default function TagEditPage() {
  const { name } = useParams<{ name: string }>();
  const [tag, setTag] = useState<Tag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [description, setDescription] = useState<string>("");
  const [implications, setImplications] = useState<Tag[]>([]);
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/tags/${name}`)
      .then((res) => {
        if (!res.ok) throw new Error("Tag not found");
        return res.json();
      })
      .then((data) => {
        setTag(data);
        setNames([data.name, ...data.aliases.map((a: any) => a.alias)]);
        setDescription(data.description || "");
        setImplications(data.implications || []);
        setSuggestions(data.suggestions || []);
        setCategoryId(data.category?.id ?? null);
      })
      .catch((err) => setError(err.message))
  }, [name]);

  useEffect(() => {
    fetch("/api/tag-categories")
      .then((res) => res.json())
      .then((data: Category[]) => setCategories(data))
      .catch((err) => console.error("Failed to load categories", err));
  }, []);

  const handleSave = async () => {
    if (!tag) return;
    if (names.length === 0 || !names[0]) {
      toast("Primary name is required.", "error");
      return;
    }
  
    setSaving(true);
  
    try {
      const res = await fetch(`/api/tags/${encodeURIComponent(tag.name)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: names[0],
          aliases: names.slice(1),
          description: description.trim() || null,
          categoryId: categoryId ?? null,
          implications: implications.map((i) => i.id),
          suggestions: suggestions.map((s) => s.id),
        }),
      });
  
      if (res.ok) {
        toast("Tag updated successfully!", "success");
        router.replace(`/tags/${encodeURIComponent(names[0])}`);
      } else {
        const data = await res.json();
        toast(data.error || "Failed to save changes.", "error");
      }
    } catch (err) {
      console.error(err);
      toast("Failed to save changes.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="text-red-500 text-center mt-10">
        {error || "Something went wrong."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Form layout */}
      <div className="space-y-4">
        {/* Names */}
        <div>
          <label className="text-zinc-600 text-sm">Names</label>
          <input
            type="text"
            value={names.join(" ")}
            onChange={(e) => {
              const input = e.target.value;

              const sanitized = input
                .split(" ")

              setNames(sanitized);
            }}
            className="w-full bg-secondary border border-secondary-border p-2 rounded mt-1 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-800"
            placeholder="tag_name"
            maxLength={128}
          />
          <p className="text-zinc-600 text-xs mt-1">
            Separate names with spaces. First name is primary. No spaces allowed inside names (use underscores).
          </p>
        </div>



        {/* Category */}
        <div>
          <label className="text-zinc-600 text-sm">Category</label>
          <select
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            className="w-full bg-secondary border border-secondary-border p-2 rounded mt-1 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-800"
          >
            <option value="">(none)</option>
            {categories
              .sort((a, b) => a.order - b.order)
              .map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
          </select>
        </div>

        {/* Implications */}
        <div>
          <label className="text-zinc-600 text-sm">Implications</label>
          <TagSelector
            onSelect={(tag) => {
              if (!implications.some((t) => t.id === tag.id)) {
                setImplications((prev) => [...prev, tag]);
              }
            }}
            placeholder="Add an implication..."
            disabledTags={implications}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {implications.map((imp) => (
              <div
                key={imp.id}
                className="flex items-center bg-secondary border border-secondary-border px-2 py-1 rounded text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
              >
                <a
                  href={`/tag/${encodeURIComponent(imp.name)}`}
                  className="hover:underline"
                  style={{ color: imp.category.color }}
                >
                  {imp.name}
                </a>
                {/* Remove button */}
                <button
                  onClick={() =>
                    setImplications((prev) => prev.filter((i) => i.id !== imp.id))
                  }
                  className="ml-2 text-red-400 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Suggestions */}
        <div>
          <label className="text-zinc-600 text-sm">Suggestions</label>
          <TagSelector
            onSelect={(tag) => {
              if (!suggestions.some((t) => t.id === tag.id)) {
                setSuggestions((prev) => [...prev, tag]);
              }
            }}
            placeholder="Add a suggestion..."
            disabledTags={suggestions}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((sugg) => (
              <div
                key={sugg.id}
                className="flex items-center bg-secondary border border-secondary-border px-2 py-1 rounded text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
              >
                <a
                  href={`/tag/${encodeURIComponent(sugg.name)}`}
                  className="hover:underline"
                  style={{ color: sugg.category.color }}
                >
                  {sugg.name}
                </a>
                {/* Remove button */}
                <button
                  onClick={() =>
                    setSuggestions((prev) => prev.filter((s) => s.id !== sugg.id))
                  }
                  className="ml-2 text-red-400 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-subtle text-sm">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-secondary border border-secondary-border p-2 rounded mt-1 focus:outline-none focus:ring-2 focus:ring-zinc-800"
            rows={6}
            maxLength={500}
          />
        </div>

        {/* Save Changes */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-darkerAccent hover:bg-darkerAccent/80 transition text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

      </div>
    </div>
  );
}
