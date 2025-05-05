"use client";

import { useEffect, useState, useRef } from "react";
import { useToast } from "./Toast";
import { Tag } from "@/core/types/tags";

// export type Tag = {
//   id: number;
//   name: string;
//   description?: string;
//   category: {
//     id: number;
//     name: string;
//     color: string;
//     order?: number;
//   };
//   aliases?: { id: number; alias: string }[];
//   suggestions?: Tag[];
//   implications?: Tag[];
//   allImplications?: Tag[];
// };

type TagSelectorProps = {
  onSelect: (tag: Tag, isNegated?: boolean, addImpliedTags?: boolean) => void;
  onEnter?: (text: string) => void;
  placeholder?: string;
  disabledTags?: Tag[];
  allowNegation?: boolean;
  addImpliedTags?: boolean;
};

export default function TagSelector({
  onSelect,
  onEnter,
  placeholder = "Type to search...",
  disabledTags = [],
  allowNegation = false,
  addImpliedTags = false,
}: TagSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Tag[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const toast = useToast();

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    const cleanQuery = allowNegation && query.startsWith("-") ? query.slice(1) : query;

    if (cleanQuery.trim() === "") {
      setResults([]);
      setHighlightedIndex(-1);
      return;
    }

    debounceTimeout.current = setTimeout(() => {
      setIsSearching(true);

      fetch(`/api/tags/autocomplete?query=${encodeURIComponent(cleanQuery)}`)
        .then((res) => res.json())
        .then((data: Tag[]) => {
          const filtered = data.filter(
            (tag) => !disabledTags.some((disabled) => disabled.id === tag.id)
          );
          setResults(filtered);
          setHighlightedIndex(-1);
        })
        .catch(() => {
          setResults([]);
          setHighlightedIndex(-1);
        })
        .finally(() => setIsSearching(false));
    }, 450);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, disabledTags, allowNegation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const max = Math.min(5, results.length);
      setHighlightedIndex((prev) => (prev + 1) % max);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const max = Math.min(5, results.length);
      setHighlightedIndex((prev) => (prev - 1 + max) % max);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && results[highlightedIndex]) {
        handleSelect(results[highlightedIndex]);
      } else {
        const trimmed = query.trim();
        const isNegated = allowNegation && trimmed.startsWith("-");
        const nameToCreate = isNegated ? trimmed.slice(1) : trimmed;
    
        const exists = results.some(r => r.name.toLowerCase() === nameToCreate.toLowerCase());
        if (!exists) {
          tryCreateTag(nameToCreate);
        } else if (onEnter) {
          onEnter(query.trim());
        }
      }
    } else if (e.key === "Escape") {
      setResults([]);
      setHighlightedIndex(-1);
    }
  };

  const handleSelect = (tag: Tag) => {
    const isNegated = allowNegation && query.trim().startsWith("-");
    
    // If negation is allowed, we prioritize that logic
    if (allowNegation && isNegated) {
      onSelect(tag, true);
    } else {
      onSelect(tag, addImpliedTags ?? false);
    }
  
    setQuery("");
    setResults([]);
    setHighlightedIndex(-1);
  };

  const handleClickResult = (tag: Tag) => {
    handleSelect(tag);
  };

  const tryCreateTag = async (name: string) => {
    try {
      const res = await fetch("/api/tags/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
  
      if (res.status === 403) {
        toast("You don't have permission to create tags.", "error");
        return;
      }
  
      if (!res.ok) {
        toast("Failed to create tag.", "error");
        return;
      }
  
      const created: Tag = await res.json();
      handleSelect(created);
    } catch {
      toast("Failed to create tag.", "error");
    }
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
        className="w-full bg-secondary border border-secondary-border p-2 rounded text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-800"
      />

      {results.length > 0 && (
        <div className="absolute mt-1 w-full bg-secondary border border-secondary-border rounded shadow-md z-10 max-h-60 overflow-y-auto">
          {results.slice(0, 5).map((tag, idx) => (
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
