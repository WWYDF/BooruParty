"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";

export type TokenizedTag = {
  type: "include" | "exclude" | "system";
  value: string;
  category?: { name: string; color: string } | null;
};

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
  onChange: (tokens: TokenizedTag[]) => void;
  onFocusChange?: (active: boolean) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onSearch?: () => void;
};

export default function SearchTagSelector({ onChange, onFocusChange, inputRef, onSearch }: Props) {
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = inputRef || internalRef;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TagResult[]>([]);
  const [highlight, setHighlight] = useState(-1);

  const tokens = query.split(" ");
  const activeToken = tokens[tokens.length - 1] || "";

  useEffect(() => {
    if (!activeToken) {
      setResults([]);
      setHighlight(-1);
      return;
    }
    const fetchTags = async () => {
      const cleaned = activeToken.startsWith("-") ? activeToken.slice(1) : activeToken;
      if (!cleaned) return;
      const res = await fetch(`/api/tags?search=${encodeURIComponent(cleaned)}`);
      const data = await res.json();
      setResults(data);
      setHighlight(-1);
    };
    fetchTags();
  }, [activeToken]);

  useEffect(() => {
    const tokenList: TokenizedTag[] = tokens.filter(Boolean).map((token) => {
      if (token.startsWith("-")) return { type: "exclude", value: token.slice(1) };
      if (token.includes(":")) return { type: "system", value: token };
      const found = results.find((r) => r.name === token);
      return {
        type: "include",
        value: token,
        category: found?.parentTag?.category || null,
      };
    });
    onChange(tokenList);
  }, [query]);

  const handleSelect = (tag: TagResult) => {
    const parts = query.trim().split(" ");
    parts[parts.length - 1] = activeToken.startsWith("-") ? `-${tag.name}` : tag.name;
    setQuery(parts.join(" ") + " ");
    setResults([]);
    setHighlight(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((prev) => (prev - 1 + results.length) % results.length);
    } else if ((e.key === "Enter" || e.key === " ") && highlight >= 0 && results[highlight]) {
      e.preventDefault();
      handleSelect(results[highlight]);
    } else if (e.key === "Enter" && highlight === -1) {
      e.preventDefault();
      onSearch?.();
    }
  };

  return (
    <div className="relative">
      <input
        ref={ref}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        onKeyDown={handleKeyDown}
        placeholder="Search by tags..."
        className="w-full p-2 rounded bg-secondary text-sm text-white"
      />
      {activeToken && results.length > 0 && (
        <ul className="absolute z-10 mt-1 bg-secondary-border w-full rounded shadow max-h-60 overflow-y-auto">
          {results.map((tag, i) => (
            <li
              key={tag.name}
              onClick={() => handleSelect(tag)}
              onMouseEnter={() => setHighlight(i)}
              className={`px-3 py-1 cursor-pointer text-sm flex justify-between items-center rounded transition-colors ${
                highlight === i ? "bg-accent text-black" : "hover:bg-secondary-border/50"
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
  );
}
