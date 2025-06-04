"use client";

import { MagnifyingGlass, Trash } from "@phosphor-icons/react";
import { useState, useEffect, useRef } from "react";
import { motion } from 'framer-motion';

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
  const [isFocused, setIsFocused] = useState(false);

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

      fetch(`/api/tags/autocomplete?query=${encodeURIComponent(lastWord.replace("-", ""))}`)
        .then((res) => res.json())
        .then((data: TagType[]) => {
          const words = input.toLowerCase().trim().split(/\s+/);
          const finalizedTags = words.slice(0, -1).map(w => w.replace("-", ""));
        
          const filtered = data
            .filter((tag) => !finalizedTags.includes(tag.name.toLowerCase()))
            .slice(0, 10);
        
          setSuggestions(filtered);
          setHighlightedIndex(filtered.length > 0 ? 0 : -1);
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
        onSubmit(input);
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
    onSubmit(input);
  };

  const handleClear = () => {
    setInput("");
    onSubmit("");
  };

  return (
    <div className="relative w-full flex items-center gap-2">
      {/* Input + search button group */}
      <div className="relative flex items-center bg-secondary border border-secondary-border rounded w-full pl-3 pr-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 100)}
          placeholder="Search by tags (example: cat -dog)"
          className="w-full bg-secondary text-white py-2 text-sm focus:outline-none"
        />

        <button
          onClick={handleSubmit}
          className="ml-2 w-8 h-8 flex items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 border border-secondary-border text-zinc-300 shrink-0"
          title="Search"
        >
          <MagnifyingGlass size={16} weight="duotone" />
        </button>

        {/* Autocomplete dropdown */}
        {isFocused && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 w-full bg-secondary border border-secondary-border rounded shadow-md z-50 max-h-60 overflow-y-auto"
          >
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
                <span>
                  {input.trim().split(/\s+/).pop()?.startsWith("-")
                    ? `-${tag.name}`
                    : tag.name}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Trash button */}
      <button
        onClick={handleClear}
        className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-md bg-zinc-800 hover:bg-red-600 text-white transition-colors border border-secondary-border"
        title="Clear search"
      >
        <Trash size={18} weight="duotone" />
      </button>
    </div>
  );
}
