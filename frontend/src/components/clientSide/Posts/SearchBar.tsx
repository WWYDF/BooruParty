"use client";

import { useState, useRef, useEffect } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import TagSelector, { TokenizedTag } from "@/components/clientSide/Tags/Selector";
import { systemTagHandlers } from "@/components/serverSide/PostSearching/systemTags";

export default function SearchBar({ onResults }: { onResults: (posts: any[]) => void }) {
  const [tokens, setTokens] = useState<TokenizedTag[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    };
    document.addEventListener("keydown", handleEnter);
    return () => document.removeEventListener("keydown", handleEnter);
  }, [tokens]);

  return (
    <div ref={containerRef} className="flex flex-col gap-2 w-full md:max-w-md">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TagSelector mode="search" initialTags={[]} onChange={setTokens} />
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
