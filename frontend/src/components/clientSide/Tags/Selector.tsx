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

export type TokenizedTag = {
  type: "include" | "exclude" | "system";
  value: string;
  category?: { name: string; color: string } | null;
};

type TagSelectorProps =
  | {
      mode?: "edit";
      initialTags: TagResult[];
      onChange: (selected: TagResult[], newTags: string[]) => void;
    }
  | {
      mode: "search";
      initialTags: TagResult[];
      onChange: (tokens: TokenizedTag[]) => void;
    };

export default function TagSelector(props: TagSelectorProps) {
  const { initialTags, mode = "edit" } = props;

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TagResult[]>(initialTags);
  const [newOnes, setNewOnes] = useState<string[]>([]);
  const [results, setResults] = useState<TagResult[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const didInit = useRef(false);

  const isSearch = mode === "search";

  const tokens = query.split(" ");
  const activeToken = isSearch ? tokens[tokens.length - 1] || "" : "";

  useEffect(() => {
    if (!activeToken) {
      setResults([]);
      return;
    }

    const fetchTags = async () => {
      const res = await fetch(`/api/tags?search=${encodeURIComponent(activeToken)}`);
      const data = await res.json();
      setResults(data);
      setHighlight(0);
    };
    fetchTags();
  }, [activeToken]);

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      return;
    }

    if (!isSearch) {
      (props as Extract<TagSelectorProps, { mode?: "edit" }>).onChange(selected, newOnes);
    } else {
      const tokenList: TokenizedTag[] = tokens.filter(Boolean).map((token) => {
        if (token.startsWith("-")) {
          return { type: "exclude", value: token.slice(1) };
        } else if (token.includes(":")) {
          return { type: "system", value: token };
        } else {
          const found = results.find((r) => r.name === token);
          const category = found?.parentTag?.category || null;
          return { type: "include", value: token, category };
        }
      });
      (props as Extract<TagSelectorProps, { mode: "search" }>).onChange(tokenList);
    }
  }, [selected, newOnes, query, isSearch, results]);

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
    const parts = query.trim().split(" ");
    parts[parts.length - 1] = tag.name;
    const newQuery = parts.join(" ") + " ";
    setQuery(newQuery);
    setResults([]);
    setHighlight(0);
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
      {!isSearch && (
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
      )}
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by tags..."
          className="w-full p-2 rounded bg-secondary text-sm text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
        />
        {activeToken && results.length > 0 && (
          <ul className="absolute z-10 mt-1 bg-secondary-border w-full rounded shadow max-h-60 overflow-y-auto">
            {results.map((tag, i) => {
              const isHighlighted = highlight === i;
              return (
                <li
                  key={tag.name}
                  onClick={() => handleSuggestionClick(tag)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`px-3 py-1 cursor-pointer text-sm flex justify-between items-center rounded transition-colors ${
                    isHighlighted ? "bg-accent text-black" : "hover:bg-secondary-border/50"
                  }`}
                  style={{ color: isHighlighted ? undefined : tag.parentTag?.category?.color || "#aaa" }}
                >
                  <span>{tag.name}</span>
                  <span className="ml-2 text-xs italic text-white/50">
                    {tag.parentTag?.category?.name || "(uncategorized)"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
