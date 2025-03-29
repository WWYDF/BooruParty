"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";

export type TagResult = {
  name: string;
  parentTag?: {
    category?: {
      name: string;
      color: string;
    };
  };
};

type Props = {
  initialTags: TagResult[];
  onChange: (selected: TagResult[], newTags: string[]) => void;
  onFocusChange?: (active: boolean) => void;
};

export default function EditPostTags({ initialTags, onChange, onFocusChange }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TagResult[]>(initialTags);
  const [newOnes, setNewOnes] = useState<string[]>([]);
  const [results, setResults] = useState<TagResult[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const didInit = useRef(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const fetchTags = async () => {
      const res = await fetch(`/api/tags?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
      setHighlight(0);
    };
    fetchTags();
  }, [query]);

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      return;
    }
    onChange(
      selected.map((tag) => ({
        name: tag.name,
        category: tag.parentTag?.category ?? null,
      })),
      newOnes
    );
  }, [selected, newOnes]);

  const addTag = (tag: TagResult | string) => {
    if (typeof tag === "string") {
      if (!newOnes.includes(tag)) setNewOnes([...newOnes, tag]);
      if (!selected.some((t) => t.name === tag)) {
        setSelected([...selected, { name: tag }]);
      }
    } else {
      if (!selected.some((t) => t.name === tag.name)) {
        setSelected([...selected, tag]);
      }
    }
    setQuery("");
    setResults([]);
  };

  const handleSuggestionClick = (tag: TagResult) => {
    addTag(tag);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((prev) => (prev - 1 + results.length) % results.length);
    } else if ((e.key === "Enter" || e.key === " ") && results[highlight]) {
      e.preventDefault();
      handleSuggestionClick(results[highlight]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {selected.map((tag) => (
          <span
            key={tag.name}
            className="flex items-center gap-1 border border-secondary-border px-2 py-1 rounded-full text-sm"
            style={{ color: tag.parentTag?.category?.color || "#999" }}
          >
            {tag.name}
            <button onClick={() => setSelected((prev) => prev.filter((t) => t.name !== tag.name))}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onKeyDown={handleKeyDown}
          placeholder="Add tags..."
          className="w-full p-2 rounded bg-secondary text-sm text-white"
        />
        {query && results.length > 0 && (
          <ul className="absolute z-10 mt-1 bg-secondary-border w-full rounded shadow max-h-60 overflow-y-auto">
            {results.map((tag, i) => (
              <li
                key={tag.name}
                onClick={() => handleSuggestionClick(tag)}
                onMouseEnter={() => setHighlight(i)}
                className={`px-3 py-1 cursor-pointer text-sm flex justify-between items-center rounded transition-colors ${
                  highlight === i
                    ? "bg-accent text-black"
                    : selected.some((t) => t.name === tag.name)
                    ? "bg-secondary-border/70"
                    : "hover:bg-secondary-border/50"
                }`}
                style={{ color: highlight === i ? undefined : tag.parentTag?.category?.color || "#aaa" }}
              >
                <span>{tag.name}</span>
                <span className="ml-2 text-xs italic text-white/50">
                  {tag.parentTag?.category?.name || "(uncategorized)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
