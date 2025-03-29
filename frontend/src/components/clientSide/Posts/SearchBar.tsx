"use client";

import { useState } from "react";
import { systemTagHandlers } from "@/components/serverSide/PostSearching/systemTags";
import { MagnifyingGlass } from "@phosphor-icons/react";

export default function SearchBar() {
  const [input, setInput] = useState("");

  const parseSearch = (query: string) => {
    const tokens = query.trim().split(/\s+/);
    const include: string[] = [];
    const exclude: string[] = [];
    const options: Record<string, any> = {};

    for (const token of tokens) {
      if (token.startsWith("-")) {
        exclude.push(token.slice(1));
      } else if (token.includes(":")) {
        const [key, val] = token.split(":");
        if (key && val && key in systemTagHandlers) {
          options[key] = systemTagHandlers[key](val);
        }
      } else {
        include.push(token);
      }
    }

    return { include, exclude, options };
  };

  const handleSearch = async () => {
    const parsed = parseSearch(input);
    try {
      const res = await fetch("/api/posts/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) throw new Error("Search failed");

      const posts = await res.json();
      console.log("Search results:", posts);
      // TODO: pass results to parent component or trigger UI update
    } catch (err) {
      console.error("Error during search:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="flex items-center gap-2 w-full md:max-w-md">
      <input
        type="text"
        placeholder="Search posts..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 px-4 py-2 rounded-2xl border border-secondary-border bg-secondary text-base text-subtle"
      />
      <button
        onClick={handleSearch}
        className="p-2 text-subtle hover:text-accent"
        aria-label="Search"
      >
        <MagnifyingGlass size={20} weight="bold" />
      </button>
    </div>
  );
}
