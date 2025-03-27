"use client";

import { useState } from "react";

type TagOption = {
  id: number;
  name: string;
};

type Props = {
  selected: TagOption[];
  onChange: (tags: TagOption[]) => void;
  label: string;
};

export default function TagMultiSelect({ selected, onChange, label }: Props) {
  const [search, setSearch] = useState("");

  // Placeholder static data, later fetch from /api/tags/search?q=
  const fakeResults: TagOption[] = [
    { id: 1, name: "fox" },
    { id: 2, name: "furry" },
    { id: 3, name: "tail" },
  ].filter((tag) => tag.name.includes(search) && !selected.some((t) => t.id === tag.id));

  const addTag = (tag: TagOption) => {
    onChange([...selected, tag]);
    setSearch("");
  };

  const removeTag = (id: number) => {
    onChange(selected.filter((tag) => tag.id !== id));
  };

  return (
    <div className="space-y-2">
      <label className="block text-subtle text-sm mb-1">{label}</label>
      <div className="flex flex-wrap gap-2">
        {selected.map((tag) => (
          <div
            key={tag.id}
            className="bg-secondary-border px-2 py-1 rounded text-sm flex items-center gap-1"
          >
            {tag.name}
            <button
              className="text-red-500 hover:underline text-xs"
              onClick={() => removeTag(tag.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <input
        className="bg-secondary w-full p-2 rounded border border-secondary-border"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search for tags..."
      />
      {search && (
        <div className="bg-secondary-border p-2 rounded mt-1 space-y-1 text-sm">
          {fakeResults.length > 0 ? (
            fakeResults.map((tag) => (
              <div
                key={tag.id}
                className="cursor-pointer hover:text-accent"
                onClick={() => addTag(tag)}
              >
                {tag.name}
              </div>
            ))
          ) : (
            <div className="italic text-muted-foreground">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}
