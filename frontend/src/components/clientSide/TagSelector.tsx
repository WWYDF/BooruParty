"use client";

import { useEffect, useState, useRef } from "react";

type TagType = {
  id: number;
  name: string;
  description?: string;
  category: {
    id: number;
    name: string;
    color: string;
  };
  aliases: { id: number; alias: string }[];
};

type TagSelectorProps = {
  onSelect: (tag: TagType) => void;
  onEnter?: (text: string) => void;
  placeholder?: string;
  disabledTags?: TagType[]; // Tags already added, hide from results
};

export default function TagSelector({
  onSelect,
  onEnter,
  placeholder = "Type to search...",
  disabledTags = [],
}: TagSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TagType[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (query.trim() === "") {
      setResults([]);
      setHighlightedIndex(-1);
      return;
    }

    debounceTimeout.current = setTimeout(() => {
      setIsSearching(true);

      fetch(`/api/tags/search?query=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data: TagType[]) => {
          // Filter out disabled tags if needed
          const filtered = data.filter(
            (tag) => !disabledTags.some((disabled) => disabled.id === tag.id)
          );
          setResults(filtered);
          setHighlightedIndex(filtered.length > 0 ? 0 : -1);
        })
        .catch(() => {
          setResults([]);
          setHighlightedIndex(-1);
        })
        .finally(() => setIsSearching(false));
    }, 450); // Debounce (ms)

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, disabledTags]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev === 0 ? results.length - 1 : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && results[highlightedIndex]) {
        onSelect(results[highlightedIndex]);
        setQuery("");
        setResults([]);
        setHighlightedIndex(-1);
      } else if (onEnter) {
        onEnter(query.trim());
      }
    } else if (e.key === "Escape") {
      setResults([]);
      setHighlightedIndex(-1);
    }
  };

  const handleClickResult = (tag: TagType) => {
    onSelect(tag);
    setQuery("");
    setResults([]);
    setHighlightedIndex(-1);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-secondary border border-secondary-border p-2 rounded text-zinc-100"
      />

      {results.length > 0 && (
        <div className="absolute mt-1 w-full bg-secondary border border-secondary-border rounded shadow-md z-10 max-h-60 overflow-y-auto">
          {results.map((tag, idx) => (
            <div
              key={tag.id}
              onClick={() => handleClickResult(tag)}
              className={`flex items-center px-3 py-2 text-sm cursor-pointer ${
                highlightedIndex === idx
                  ? "bg-accent text-white"
                  : "hover:bg-secondary-border"
              }`}
            >
              <div
                className="mr-2"
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: tag.category.color,
                }}
              />
              <span>{tag.name}</span>
            </div>
          ))}
        </div>
      )}

      {isSearching && (
        <div className="absolute mt-1 text-xs text-zinc-600">
          Searching...
        </div>
      )}
    </div>
  );
}
