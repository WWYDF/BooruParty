"use client";

import { useEffect, useRef, useState } from "react";
import { Tag as TagIcon, X } from "@phosphor-icons/react";
import Link from "next/link";

// Types
export type TagResult = {
  name: string; // canonical or alias
  tag: {
    id: number;
    category: {
      name: string;
      color: string;
      order: number;
    };
  };
};

export default function TagSelector({
  initialTags,
  onChange,
}: {
  initialTags: TagResult[];
  onChange: (tags: TagResult[], newTags: string[]) => void;
}) {
  const [selectedTags, setSelectedTags] = useState<TagResult[]>(initialTags);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TagResult[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const run = async () => {
      if (!query.trim()) return setSuggestions([]);
      const res = await fetch(`/api/tags?search=${encodeURIComponent(query)}`);
      const data: TagResult[] = await res.json();
      setSuggestions(data);
    };
    run();
  }, [query]);

  useEffect(() => {
    onChange(selectedTags, newTags);
  }, [selectedTags, newTags]);

  const addTag = (tag: TagResult) => {
    if (selectedTags.find((t) => t.name === tag.name)) return;
    setSelectedTags((prev) => [...prev, tag]);
    setQuery("");
    setActiveIndex(-1);
  };

  const addNewTag = (name: string) => {
    if (selectedTags.find((t) => t.name === name)) return;
    setSelectedTags((prev) => [
      ...prev,
      {
        name,
        tag: {
          id: -1,
          category: { name: "new", color: "#888", order: 999 },
        },
      },
    ]);
    setNewTags((prev) => [...prev, name]);
    setQuery("");
    setActiveIndex(-1);
  };

  const removeTag = (name: string) => {
    setSelectedTags((prev) => prev.filter((t) => t.name !== name));
    setNewTags((prev) => prev.filter((t) => t !== name));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const selected = suggestions[activeIndex];
      if (selected) addTag(selected);
      else if (query.trim()) addNewTag(query.trim());
    }
  };

  const sortedTags = [...selectedTags].sort(
    (a, b) => a.tag.category.order - b.tag.category.order
  );

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 mb-2">
        {sortedTags.map((tag) => (
          <div
            key={tag.name}
            className="flex items-center gap-1 rounded-full bg-secondary-border text-subtle text-sm px-3 py-1"
          >
            <button onClick={() => removeTag(tag.name)}>
              <X size={14} />
            </button>
            <Link href={`/dashboard/tags/${tag.name}`}>
              <TagIcon
                size={14}
                color={tag.tag.category.color}
                weight="bold"
                className="mt-[1px]"
              />
            </Link>
            <button
              className="underline hover:text-accent"
              onClick={() => alert(`Show suggestions for ${tag.name}`)} // placeholder
            >
              {tag.name}
            </button>
          </div>
        ))}
      </div>
  
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a tag..."
        className="w-full rounded-xl bg-secondary-border p-2 text-sm text-subtle outline-none"
      />
  
      {suggestions.length > 0 && (
        <ul className="mt-1 bg-secondary-border rounded shadow text-sm">
          {suggestions.map((s, i) => (
            <li
              key={s.name}
              onClick={() => addTag(s)}
              className={`px-3 py-1 cursor-pointer hover:bg-accent/20 ${
                activeIndex === i ? "bg-accent/10" : ""
              }`}
            >
              {s.name}{" "}
              <span style={{ color: s.tag.category.color }}>
                ({s.tag.category.name})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}