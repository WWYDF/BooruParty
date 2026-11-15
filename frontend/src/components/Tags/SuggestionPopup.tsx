"use client";

import { Plus } from "phosphor-react";
import { useEffect, useState } from "react";

export type SuggestionTag = {
  id: number;
  name: string;
  description: string | null;
  category: {
    id: number;
    name: string;
    color: string;
  };
};

export default function TagSuggestionPopup({
  tagName,
  onClose,
  onAddTag,
}: {
  tagName: string;
  onClose: () => void;
  onAddTag: (tag: SuggestionTag) => void;
}) {
  const [suggestions, setSuggestions] = useState<SuggestionTag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tags/${encodeURIComponent(tagName)}`)
      .then((res) => res.json())
      .then((data) => {
        setSuggestions(data.suggestions || []);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [tagName]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".tag-suggestion-popup")) {
        onClose();
      }
    };
  
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);  

  return (
    <div className="absolute z-50 mt-1 bg-zinc-900 border border-secondary-border rounded p-2 shadow-lg w-64 tag-suggestion-popup">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-white">Suggestions for <code>{tagName}</code></span>
        <button onClick={onClose} className="text-subtle hover:text-accent text-sm">✕</button>
      </div>

      {loading ? (
        <p className="text-subtle text-xs">Loading...</p>
      ) : suggestions.length === 0 ? (
        <p className="text-subtle text-xs">No suggestions available.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {suggestions.map((tag) => (
            <li
              key={tag.id}
              className="flex items-start gap-2 border border-secondary-border p-2 rounded"
            >
              <button
                title="Add tag"
                onClick={() => onAddTag(tag)}
                className="text-accent hover:brightness-125"
              >
                <Plus size={16} weight="bold" />
              </button>

              <div className="flex-1">
                <p className="flex justify-between">
                  <span className="font-medium">{tag.name}</span>
                  <span
                    className="text-xs"
                    style={{ color: tag.category.color }}
                  >
                    {tag.category.name}
                  </span>
                </p>
                {tag.description && (
                  <p className="text-xs text-subtle mt-1">{tag.description}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
