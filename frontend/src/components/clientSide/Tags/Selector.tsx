"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";

export type TagResult = {
  name: string;
  category: {
    name: string;
    color: string;
  } | null;
};

export default function TagSelector({
  initialTags = [],
  onChange,
}: {
  initialTags: TagResult[];
  onChange: (selected: TagResult[], newTags: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TagResult[]>(initialTags);
  const [newOnes, setNewOnes] = useState<string[]>([]);
  const [results, setResults] = useState<TagResult[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const didInit = useRef(false);

  useEffect(() => {
    const fetchTags = async () => {
      if (!query) return setResults([]);
      const res = await fetch(`/api/tags?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(
        data.map((tag: any) => ({
          name: tag.name,
          category: tag.parentTag?.category ?? null,
        }))
      );
    };
    fetchTags();
  }, [query]);

  useEffect(() => {
    if (didInit.current) {
      onChange(selected, newOnes);
    } else {
      didInit.current = true;
    }
  }, [selected, newOnes]);

  const addTag = (tag: TagResult | string) => {
    if (typeof tag === "string") {
      if (!newOnes.includes(tag)) setNewOnes([...newOnes, tag]);
      if (!selected.some((t) => t.name === tag)) {
        setSelected([...selected, { name: tag, category: null }]);
      }
    } else {
      if (!selected.some((t) => t.name === tag.name)) {
        setSelected([...selected, tag]);
      }
    }
    setQuery("");
    setResults([]);
  };

  const removeTag = (name: string) => {
    setSelected((prev) => prev.filter((t) => t.name !== name));
    setNewOnes((prev) => prev.filter((n) => n !== name));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      setHighlight((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      setHighlight((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      if (results[highlight]) addTag(results[highlight]);
      else if (query.trim()) addTag(query.trim());
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a tag..."
          className="w-full p-2 rounded bg-secondary text-sm text-white"
        />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 bg-secondary-border w-full rounded shadow max-h-60 overflow-y-auto">
            {results.map((tag, i) => (
              <li
                key={tag.name}
                onClick={() => addTag(tag)}
                className={`px-3 py-1 cursor-pointer text-sm hover:bg-secondary ${
                  highlight === i ? "bg-secondary" : ""
                }`}
                style={{ color: tag.category?.color || "#aaa" }}
              >
                {tag.name} <span className="ml-2 text-xs italic">{tag.category?.name || "(uncategorized)"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
