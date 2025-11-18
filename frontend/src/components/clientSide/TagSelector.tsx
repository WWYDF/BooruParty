"use client";

import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Tag } from "@/core/types/tags";
import { formatCounts } from "@/core/formats";
import AddButton from "./AddButton";

export type TagSelectorHandle = {
  applyPastedText: (text: string) => Promise<void>;
};

type TagSelectorProps = {
  onSelect: (tag: Tag, isNegated?: boolean, addImpliedTags?: boolean) => void;
  placeholder?: string;
  disabledTags?: Tag[];
  allowNegation?: boolean;
  addImpliedTags?: boolean;
  blacklist?: string[];
  onDuplicateSelect?: (tag: Tag) => void;
  addPendingTagName?: (name: string) => void;
};

export default forwardRef<TagSelectorHandle, TagSelectorProps>(function TagSelector(
  {
    onSelect,
    onDuplicateSelect,
    addPendingTagName,
    placeholder = "Type to search...",
    disabledTags = [],
    allowNegation = false,
    addImpliedTags = false,
    blacklist = [],
  }: TagSelectorProps,
  ref
) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Tag[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const lastFetchId = useRef(0);

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
      const fetchId = ++lastFetchId.current;
      setIsSearching(true);

      fetch(`/api/tags/autocomplete?query=${encodeURIComponent(cleanQuery)}`)
        .then((res) => res.json())
        .then((data: Tag[]) => {
          if (fetchId !== lastFetchId.current) return; // stale fetch, ignore

          const filtered = data.filter(
            (tag) =>
              !disabledTags.some((disabled) => disabled.id === tag.id) &&
              !blacklist.includes(encodeURIComponent(tag.name.toLowerCase()))
          );
          setResults(filtered);
          setHighlightedIndex(-1);
        })
        .catch(() => {
          if (fetchId !== lastFetchId.current) return; // stale fetch, ignore
          setResults([]);
          setHighlightedIndex(-1);
        })
        .finally(() => {
          if (fetchId === lastFetchId.current) {
            setIsSearching(false);
          }
        });
    }, 100);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, disabledTags, allowNegation]);

  useImperativeHandle(ref, () => ({
    applyPastedText: async (text: string) => {
      // Reuse the exact same logic as user paste+Enter
      // (this path ends up calling onSelect(tag, addImpliedTags), so implications are included when the prop is true)
      await processMultipleTags(text);
    },
  }));

  const processMultipleTags = async (input: string) => {
    const parts = input
      .split(/\s+/)
      .map(part => part.trim())
      .filter(Boolean);
  
    for (const part of parts) {
      const search = part.startsWith("-") ? part.slice(1) : part;
  
      const res = await fetch(`/api/tags?search=${encodeURIComponent(search)}`);
      const { tags } = await res.json();
      const exactMatch = tags.find(
        (r: any) =>
          r.name.toLowerCase() === search.toLowerCase() ||
          r.aliases?.some((a: any) => a.alias.toLowerCase() === search.toLowerCase())
      );
  
      if (exactMatch) {
        handleSelect(exactMatch);
      } else if (addPendingTagName) {
        addPendingTagName(search);
      }
    }
  
    setQuery("");
    setResults([]);
    setHighlightedIndex(-1);
  };

  const processTagInput = (rawInput: string, opts: { asButton?: boolean } = {}) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;
  
    const isNegated = allowNegation && trimmed.startsWith("-");
    const nameToMatch = isNegated ? trimmed.slice(1) : trimmed;
  
    const exactMatch = results.find(
      (r) =>
        r.name.toLowerCase() === nameToMatch.toLowerCase() ||
        r.aliases?.some((a) => a.alias.toLowerCase() === nameToMatch.toLowerCase())
    );
  
    let duplicate: typeof disabledTags[number] | undefined;
  
    if (highlightedIndex >= 0 && results[highlightedIndex]) {
      const highlighted = results[highlightedIndex];
      duplicate = disabledTags.find((tag) => tag.id === highlighted.id);
    } else {
      duplicate = disabledTags.find(
        (tag) =>
          tag.name.toLowerCase() === trimmed.toLowerCase() ||
          tag.aliases?.some((a) => a.alias.toLowerCase() === trimmed.toLowerCase())
      );
    }
  
    if (duplicate && results.length >= 0) {
      setQuery("");
      onDuplicateSelect?.(duplicate);
    } else if (!opts.asButton && highlightedIndex >= 0 && results[highlightedIndex]) {
      handleSelect(results[highlightedIndex]);
    } else if (exactMatch) {
      handleSelect(exactMatch);
    } else {
      if (addPendingTagName) {
        setQuery("");
        addPendingTagName(nameToMatch);
      }
    }
  
    setResults([]);
    setHighlightedIndex(-1);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " ") e.preventDefault();

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const max = Math.min(20, results.length);
      setHighlightedIndex((prev) => (prev + 1) % max);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const max = Math.min(20, results.length);
      setHighlightedIndex((prev) => (prev - 1 + max) % max);
    } else if (query !== "" && (e.key === "Enter" || (e.key === " " && highlightedIndex <= 0))) {
      e.preventDefault();
      if (query.includes(" ")) {
        processMultipleTags(query);
      } else {
        processTagInput(query);
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

  return (
    <div className="relative w-full">
      <div className="flex w-full gap-2 items-center">
        <input
          type="text"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          className="w-full text-base bg-secondary border border-secondary-border p-2 rounded text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-800"
        />

        <AddButton
          onAdd={() => processTagInput(query, { asButton: true })}
          className="md:hidden"
        />
      </div>

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
});
