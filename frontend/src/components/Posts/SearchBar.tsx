"use client";

import { HashStraightIcon, MagnifyingGlassIcon, TrashIcon, QuestionIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { motion } from 'framer-motion';
import { useToast } from "../UI/Toast";
import { useSearchBarLogic } from "@/core/searchBarLogic";
import InfoModal from "../UI/Modals/InfoModal";

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
    setHighlightedIndex,
    isFocused,
    inputRef,
    applySuggestion,
    handleKeyDown,
    handleChange,
    handleSelect,
    handleSubmit,
    handleClear,
    handleFocus,
    handleBlur,
  } = useSearchBarLogic({ input, setInput, onSubmit });

  const showPostCount = () => {
    const postCount = Number(sessionStorage.getItem("postCount") ?? 0); // written by PostsPage
    toast(`There are ${postCount.toLocaleString()} posts matching this search.`);
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
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search by tags (example: cat -dog)"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-secondary text-white py-2 text-base focus:outline-none"
        />

        <button
          onClick={showPostCount}
          className="ml-2 w-8 h-8 flex items-center transition-colors justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 border border-secondary-border text-zinc-300 shrink-0"
          title="Post count"
        >
          <HashStraightIcon size={18} weight="duotone" />
        </button>

        <button
          onClick={handleSubmit}
          className="ml-2 w-8 h-8 flex items-center transition-colors justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 border border-secondary-border text-zinc-300 shrink-0"
          title="Search"
        >
          <MagnifyingGlassIcon size={16} weight="duotone" />
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
            {suggestions.map((s, idx) => (
              <div
                key={s.key}
                // mousedown + preventDefault keeps focus in the input, so blur doesn't close the list first
                onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${
                  highlightedIndex === idx ? "bg-zinc-700 text-white" : "hover:bg-secondary-border"
                }`}
              >
                {s.color ? (
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-500" /> // system term
                )}

                <span className="truncate">
                  {s.alias && <span className="text-subtle">{s.alias} → </span>}
                  {s.label}
                </span>

                {s.count !== undefined && (
                  <span className="ml-auto text-xs text-subtle shrink-0">{s.count.toLocaleString()}</span>
                )}
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
        <TrashIcon size={18} weight="duotone" />
      </button>

      {/* Help button */}
      <button
        onClick={() => setHelpOpen(true)}
        className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 text-white transition-colors border border-secondary-border"
        title="Search help"
      >
        <QuestionIcon size={18} weight="duotone" />
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
          Separate terms with spaces. Put <code>-</code> <a className="text-subtle">(hyphen)</a> in front of a term to exclude it.
          Press <code>Tab</code> to accept a suggestion.
        </p>

        <div className="mb-3">
          <label>Tags</label>
          <ul className="list-disc pl-5 text-zinc-300">
            <li><code>cat</code> <a className="text-subtle">· Posts tagged "cat".</a></li>
            <li><code>cat dog</code> <a className="text-subtle">· Posts tagged both "cat" and "dog".</a></li>
            <li><code>cat -dog</code> <a className="text-subtle">· Posts tagged "cat", but not "dog".</a></li>
            <li><code>~cat ~dog</code> <a className="text-subtle">· Posts tagged "cat" or "dog" (at least one).</a></li>
            <li><code>blue_*</code> <code>*_sky</code> <code>*blue*</code> <a className="text-subtle">· Tags starting with, ending with, or containing a word.</a></li>
          </ul>
        </div>

        <div className="mb-2">
          <label>System Terms</label>
          <ul className="list-disc pl-5 text-zinc-300">
            <li><code>safety:safe,questionable</code> <a className="text-subtle">· Only these safeties (safe, questionable, explicit).</a></li>
            <li><code>type:image</code> <a className="text-subtle">· Only these file types (image, animated, video).</a></li>
            <li><code>from:{'<username>'}</code> <a className="text-subtle">· Posts uploaded by a user.</a></li>
            <li><code>score:{'>'}10</code> <a className="text-subtle">· Score filter. Also works with <code>{'>='}</code>, <code>{'<'}</code>, <code>{'<='}</code>, or an exact number.</a></li>
            <li><code>tagcount:{'<'}5</code> <a className="text-subtle">· Posts with fewer than 5 tags (same comparisons as score).</a></li>
            <li><code>id:{'>'}1000</code> <a className="text-subtle">· Filter by post id (same comparisons as score).</a></li>
            <li><code>order:newest/oldest/score/random</code> <a className="text-subtle">· Changes the order (default: newest).</a></li>
          </ul>
        </div>
      </InfoModal>
    </div>
  );
}
