"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TagSelector from "@/components/clientSide/TagSelector";
import { useToast } from "@/components/clientSide/Toast";
import { Tag, TagCategory } from "@/core/types/tags";


export default function TagEditPage() {
  const { name } = useParams<{ name: string }>();
  const [tag, setTag] = useState<Tag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [description, setDescription] = useState<string>("");
  const [implications, setImplications] = useState<Tag[]>([]);
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [pendingImplicationNames, setPendingImplicationNames] = useState<string[]>([]);
  const [pendingSuggestionNames, setPendingSuggestionNames] = useState<string[]>([]);
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
      .then((data: TagCategory[]) => setCategories(data))
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
      // Step 1: combine + dedupe pending names
      const toCreate = Array.from(new Set([
        ...pendingImplicationNames.map((n) => n.toLowerCase()),
        ...pendingSuggestionNames.map((n) => n.toLowerCase()),
      ]));
  
      const createdTags: Tag[] = [];
  
      // Step 2: create each tag sequentially
      for (const name of toCreate) {
        const res = await fetch("/api/tags/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, categoryId: categoryId ?? categories[0].id }),
        });
  
        const data = await res.json();
        if (res.ok && data?.created) {
          createdTags.push(data.created);
        } else {
          toast(`Failed to create tag "${name}"`, "error");
        }
      }
  
      // Step 3: build resolved implication/suggestion arrays
      const updatedImplications = implications.map((i) => {
        const found = createdTags.find((t) => t.name.toLowerCase() === i.name.toLowerCase());
        return found?.id ?? i.id;
      });
  
      const updatedSuggestions = suggestions.map((s) => {
        const found = createdTags.find((t) => t.name.toLowerCase() === s.name.toLowerCase());
        return found?.id ?? s.id;
      });
  
      // Step 4: submit final tag patch
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
          implications: updatedImplications,
          suggestions: updatedSuggestions,
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

  const handleTagSelect = (tag: Tag, type: "implication" | "suggestion") => {
    console.log(tag)
    const [list, setList, pendingNames, setPending] =
      type === "implication"
        ? [implications, setImplications, pendingImplicationNames, setPendingImplicationNames]
        : [suggestions, setSuggestions, pendingSuggestionNames, setPendingSuggestionNames];
  
    const lowerName = tag.name.toLowerCase();
  
    const alreadyInList = list.some(
      (t) => t.id === tag.id || t.name.toLowerCase() === lowerName
    );
    if (alreadyInList) return;
  
    setList((prev) => [tag, ...prev]);
  
    if (tag.id < 0 && !pendingNames.includes(lowerName)) {
      setPending([...pendingNames, lowerName]);
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
            <option value="" disabled >(none)</option>
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
            onSelect={(tag) => handleTagSelect(tag, "implication")}
            disabledTags={implications}
            addPendingTagName={(name) => {
              const normalized = name.toLowerCase();
              if (pendingImplicationNames.includes(normalized)) return;

              const fakeTag: Tag = {
                id: -(pendingImplicationNames.length + 1),
                name,
                aliases: [],
                description: null,
                category: categories.find((c) => c.isDefault)!,
                _count: { posts: 0 },
              };

              setPendingImplicationNames((prev) => [...prev, normalized]);
              setImplications((prev) => [fakeTag, ...prev]);
            }}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {implications.map((imp) => (
              <div
                key={imp.id}
                className={`flex items-center border px-2 py-1 rounded text-zinc-100 text-sm
                  ${imp.id < 0 ? "border-zinc-800 bg-zinc-900" : "border-secondary-border"}
                  bg-secondary
                `}
              >
                <a
                  href={`/tags/${encodeURIComponent(imp.name)}`}
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
            onSelect={(tag) => handleTagSelect(tag, "suggestion")}
            disabledTags={suggestions}
            addPendingTagName={(name) => {
              const normalized = name.toLowerCase();
              if (pendingSuggestionNames.includes(normalized)) return;

              const fakeTag: Tag = {
                id: -(pendingSuggestionNames.length + 1),
                name,
                aliases: [],
                description: null,
                category: categories.find((c) => c.isDefault)!,
                _count: { posts: 0 },
              };

              setPendingSuggestionNames((prev) => [...prev, normalized]);
              setSuggestions((prev) => [fakeTag, ...prev]);
            }}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((sugg) => (
              <div
                key={sugg.id}
                className={`flex items-center border px-2 py-1 rounded text-zinc-100 text-sm
                  ${sugg.id < 0 ? "border-zinc-800 bg-zinc-900" : "border-secondary-border"}
                  bg-secondary
                `}
              >
                <a
                  href={`/tags/${encodeURIComponent(sugg.name)}`}
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
