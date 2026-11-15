"use client";

import { MagnifyingGlass, Trash, HashStraight, Question } from "@phosphor-icons/react";
import { useState } from "react";
import { motion } from 'framer-motion';
import { useToast } from "../Toast";
import InfoModal from "../InfoModal";
import { useSearchBarLogic } from "../../../core/searchBarLogic";

type PostSearchBarProps = {
  input: string;
  setInput: (input: string) => void;
  onSubmit: (query?: string) => void;
};

export default function SearchBar({ input, setInput, onSubmit }: PostSearchBarProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const toast = useToast();

  const {
    suggestions,
    highlightedIndex,
    isFocused,
    inputRef,
    handleKeyDown,
    handleChange,
    handleSuggestionClick,
    handleSubmit,
    handleClear,
    handleFocus,
    handleBlur,
  } = useSearchBarLogic({ input, setInput, onSubmit });

  const showPostCount = () => {
    const postCount = sessionStorage.getItem("postCount")
    toast(`There are ${postCount} posts matching this search.`);
  };

  return (
    <div className="relative w-full flex items-center gap-2">
      {/* Input + search button group */}
      <div className="relative flex items-center bg-secondary border border-secondary-border rounded w-full pl-3 pr-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search by tags (example: cat -dog)"
          className="w-full bg-secondary text-white py-2 text-base focus:outline-none"
        />

        <button
          onClick={showPostCount}
          className="ml-2 w-8 h-8 flex items-center transition-colors justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 border border-secondary-border text-zinc-300 shrink-0"
          title="Search"
        >
          <HashStraight size={18} weight="duotone" />
        </button>

        <button
          onClick={handleSubmit}
          className="ml-2 w-8 h-8 flex items-center transition-colors justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 border border-secondary-border text-zinc-300 shrink-0"
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
        className="w-8 h-8 md:w-10 md:h-10 hidden md:flex items-center justify-center rounded-md bg-zinc-800 hover:bg-red-600 text-white transition-colors border border-secondary-border"
        title="Clear search"
      >
        <Trash size={18} weight="duotone" />
      </button>
      
      {/* Help button */}
      <button
        onClick={() => setHelpOpen(true)}
        className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 text-white transition-colors border border-secondary-border"
        title="Clear search"
      >
        <Question size={18} weight="duotone" />
      </button>

      <InfoModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Searching Cheat Sheet"
        subtitle="Below are some examples of stuff you can search for."
        bodyClassName="text-sm leading-6"
        closeText="Thanks"
      >
        <p className="mb-2">
          You can use the search bar to search for curated tags or system tags.
          You can use the <code>-</code> <a className="text-subtle">(hyphen)</a> to negate any tag.<br />
          Below is a list some examples of both:
        </p>
        <div className="mb-3">
          <label>Curated Tags</label>
          <ul className="list-disc pl-5 text-zinc-300">
            <li><code>cat</code> <a className="text-subtle">· Posts containing the "cat" tag.</a></li>
            <li><code>cat dog</code><a className="text-subtle">· Posts containing both the "cat" and "dog" tags.</a></li>
            <li><code>cat -dog</code> <a className="text-subtle">· Posts containing the "cat" tag, but not the "dog" tag.</a></li>
          </ul>
        </div>
        
        <div className="mb-2">
          <label>System Tags</label>
          <p className="text-subtle text-xs">All of these allow inverse sorting by appending with <code>_asc</code>.</p>
          <ul className="list-disc pl-5 text-zinc-300">
            <li><code>posts:{'<username>'}</code> <a className="text-subtle">· Posts uploaded by a specific user.</a></li>
            <li><code>likes:{'<username>'}</code> <a className="text-subtle">· Posts liked by a specific user.</a></li>
            <li><code>favorites:{'<username>'}</code> <a className="text-subtle">· Posts favorited by a specific user.</a></li>
            <li><code>pool:{'<id>'}</code> <a className="text-subtle">· Posts that are part of a specific pool.</a></li>
            <li><code>order:tags/score/favorites/boosts/date</code> <a className="text-subtle">· Changes the order from default (date).</a></li>
            <li><code>filter:tumbleweeds</code> <a className="text-subtle">· Posts with no tags.</a></li>
            <li><code>type:image/video/gif</code> <a className="text-subtle">· Posts of only the select format.</a></li>
          </ul>
        </div>
      </InfoModal>
    </div>
  );
}
