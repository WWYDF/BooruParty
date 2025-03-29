"use client";

import { useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { systemTagHandlers } from "@/components/serverSide/PostSearching/systemTags";
import SearchTagSelector, { TokenizedTag } from "./SearchTags";

export default function SearchBar({ onResults }: { onResults: (posts: any[]) => void }) {
  const [tokens, setTokens] = useState<TokenizedTag[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    const include: string[] = [];
    const exclude: string[] = [];
    const options: Record<string, any> = {};

    for (const token of tokens) {
      if (token.type === "include") include.push(token.value);
      else if (token.type === "exclude") exclude.push(token.value);
      else if (token.type === "system") {
        const [key, val] = token.value.split(":");
        if (key && val && key in systemTagHandlers) {
          options[key] = systemTagHandlers[key](val);
        }
      }
    }

    try {
      const res = await fetch("/api/posts/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ include, exclude, options }),
      });

      if (!res.ok) throw new Error("Search failed");

      const posts = await res.json();
      onResults(posts);
    } catch (err) {
      console.error("Error during search:", err);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full md:max-w-md">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SearchTagSelector
            onChange={setTokens}
            onFocusChange={setSelectorOpen}
            inputRef={inputRef}
            onSearch={handleSearch}
          />
        </div>
        <button
          onClick={handleSearch}
          className="p-2 rounded bg-accent text-black hover:opacity-90"
          aria-label="Search"
        >
          <MagnifyingGlass size={20} weight="bold" />
        </button>
      </div>
    </div>
  );
}
