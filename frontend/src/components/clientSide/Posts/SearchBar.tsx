"use client";

import { useState, useEffect, useRef } from "react";

type TagType = {
  id: number;
  name: string;
  category: {
    id: number;
    name: string;
    color: string;
  };
};

type PostSearchBarProps = {
  input: string;
  setInput: (input: string) => void;
  onSubmit: (query?: string) => void;
};

export default function SearchBar({ input, setInput, onSubmit }: PostSearchBarProps) {
  const [suggestions, setSuggestions] = useState<TagType[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!input.trim()) {
      setSuggestions([]);
      return;
    }

    // Only fetch suggestions for the last "word" the user typed
    const lastWord = input.split(/\s+/).pop();
    if (!lastWord) return;

    debounceRef.current = setTimeout(() => {
      setIsSearching(true);

      fetch(`/api/tags/search?query=${encodeURIComponent(lastWord.replace("-", ""))}`)
        .then((res) => res.json())
        .then((data: TagType[]) => {
          setSuggestions(data.slice(0, 10)); // limit to 10
          setHighlightedIndex(data.length > 0 ? 0 : -1);
        })
        .catch(() => {
          setSuggestions([]);
        })
        .finally(() => setIsSearching(false));
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev === 0 ? suggestions.length - 1 : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        insertTag(suggestions[highlightedIndex].name);
      } else {
        onSubmit(input.trim());
      }
    }
  };

  const insertTag = (tagName: string) => {
    const parts = input.trim().split(/\s+/);
    const lastWord = parts.pop() || "";
    const negated = lastWord.startsWith("-");
    parts.push(negated ? `-${tagName}` : tagName);
    setInput(parts.join(" ") + " ");
    setSuggestions([]);
    setHighlightedIndex(-1);
  };

  const handleSuggestionClick = (tagName: string) => {
    insertTag(tagName);
  };

  const handleSubmit = () => {
    onSubmit(input.trim());
  };

  return (
    <div className="relative w-full md:w-1/3">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search by tags (example: cat -dog)"
        className="w-full bg-secondary border border-secondary-border p-2 rounded text-zinc-100 focus:outline-none focus:ring-1 focus:ring-darkerAccent"
      />

      {suggestions.length > 0 && (
        <div className="absolute mt-1 w-full bg-secondary border border-secondary-border rounded shadow-md z-10 max-h-60 overflow-y-auto">
          {suggestions.map((tag, idx) => (
            <div
              key={tag.id}
              onClick={() => handleSuggestionClick(tag.name)}
              className={`flex items-center px-3 py-2 text-sm cursor-pointer ${
                highlightedIndex === idx
                  ? "bg-zinc-700 text-white"
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
              <span>{input.trim().split(/\s+/).pop()?.startsWith("-") ? `-${tag.name}` : tag.name}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleSubmit}
        className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-100"
      >
        🔍
      </button>
    </div>
  );
}
