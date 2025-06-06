"use client";

import { useEffect, useState, useRef } from "react";
import { useToast } from "./Toast";
import { Tag } from "@/core/types/tags";
import { formatCounts } from "@/core/formats";

type TagSelectorProps = {
  onSelect: (tag: Tag, isNegated?: boolean, addImpliedTags?: boolean) => void;
  onEnter?: (text: string) => void;
  placeholder?: string;
  disabledTags?: Tag[];
  allowNegation?: boolean;
  addImpliedTags?: boolean;
  blacklist?: string[];
  onDuplicateSelect?: (tag: Tag) => void;
};

export default function TagSelector({
  onSelect,
  onEnter,
  onDuplicateSelect,
  placeholder = "Type to search...",
  disabledTags = [],
  allowNegation = false,
  addImpliedTags = false,
  blacklist = [],
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
            (tag) =>
              !disabledTags.some((disabled) => disabled.id === tag.id) &&
              !blacklist.includes(encodeURIComponent(tag.name.toLowerCase()))
          );
          setResults(filtered);
          setHighlightedIndex(-1);
        })
        .catch(() => {
          setResults([]);
          setHighlightedIndex(-1);
        })
        .finally(() => setIsSearching(false));
    }, 100);

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
    } else if (e.key === "Enter" || (e.key === " " && highlightedIndex >= 0)) {
      e.preventDefault();
    
      const trimmed = query.trim();
      const isNegated = allowNegation && trimmed.startsWith("-");
      const nameToMatch = isNegated ? trimmed.slice(1) : trimmed;
    
      // Check for exact match in results (by name or alias)
      const exactMatch = results.find(
        (r) =>
          r.name.toLowerCase() === nameToMatch.toLowerCase() ||
          r.aliases?.some((a) => a.alias.toLowerCase() === nameToMatch.toLowerCase())
      );
    
      // Check if tag already selected (name or alias match)
      const duplicate = disabledTags.find(
        (tag) =>
          tag.name.toLowerCase() === nameToMatch.toLowerCase() ||
          tag.aliases?.some((a) => a.alias.toLowerCase() === nameToMatch.toLowerCase())
      );
    
      if (
        duplicate &&
        results.length > 0 &&
        results[0].name.toLowerCase() === nameToMatch.toLowerCase()
      ) {
        // Only call duplicate if the thing typed directly is the one already added
        onDuplicateSelect?.(duplicate);
      } else if (highlightedIndex >= 0 && results[highlightedIndex]) {
        handleSelect(results[highlightedIndex]);
      } else if (exactMatch) {
        handleSelect(exactMatch);
      } else if (onEnter) {
        onEnter(trimmed);
      } else {
        tryCreateTag(nameToMatch);
      }
    
      setResults([]);
      setHighlightedIndex(-1);
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
        <div className="absolute mt-1 w-full bg-secondary border border-secondary-border rounded shadow-md z-10 max-h-80 overflow-y-auto">
          {results.slice(0, 20).map((tag, idx) => (
            <div
              key={tag.id}
              onClick={() => handleClickResult(tag)}
              className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer ${
                highlightedIndex === idx
                  ? "bg-accent/40 text-white"
                  : "hover:bg-secondary-border"
              }`}
            >
              {/* name */}
              <div className="flex items-center gap-2">
                <div
                  className="rounded-full"
                  style={{
                    width: "10px",
                    height: "10px",
                    backgroundColor: tag.category.color,
                  }}
                />
                <span>{tag.name}</span>
              </div>

              {/* post count */}
              <span className="text-xs text-zinc-400">
              {formatCounts(tag._count?.posts ?? 0)}
              </span>
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
