import { useState, useEffect, useRef } from "react";

type TagType = {
  id: number;
  name: string;
  category: {
    id: number;
    name: string;
    color: string;
  };
};

type UseSearchBarLogicProps = {
  input: string;
  setInput: (input: string) => void;
  onSubmit: (query?: string) => void;
};

export function useSearchBarLogic({ input, setInput, onSubmit }: UseSearchBarLogicProps) {
  const [suggestions, setSuggestions] = useState<TagType[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autocomplete effect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!input.trim() || input.endsWith(" ")) {
      setSuggestions([]);
      return;
    }

    // Only fetch suggestions for the last "word" the user typed
    const lastWord = input.split(/\s+/).pop();
    if (!lastWord) return;

    debounceRef.current = setTimeout(() => {
      setIsSearching(true);

      fetch(`/api/tags/autocomplete?query=${encodeURIComponent(lastWord.replace("-", ""))}`)
        .then((res) => res.json())
        .then((data: TagType[]) => {
          const words = input.toLowerCase().trim().split(/\s+/);
          const finalizedTags = words.slice(0, -1).map(w => w.replace("-", ""));

          const filtered = data
            .filter((tag) => !finalizedTags.includes(tag.name.toLowerCase()))
            .slice(0, 10);

          setSuggestions(filtered);
          setHighlightedIndex(filtered.length > 0 ? 0 : -1);
        })
        .catch(() => {
          setSuggestions([]);
        })
        .finally(() => setIsSearching(false));
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [input]);

  const insertTag = (tagName: string) => {
    const parts = input.trim().split(/\s+/);
    const lastWord = parts.pop() || "";
    const negated = lastWord.startsWith("-");
    parts.push(negated ? `-${tagName}` : tagName);
    setInput(parts.join(" ") + " ");
    setSuggestions([]);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev === 0 ? suggestions.length - 1 : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        insertTag(suggestions[highlightedIndex].name);
      } else {
        onSubmit(input);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSuggestionClick = (tagName: string) => {
    insertTag(tagName);
  };

  const handleSubmit = () => {
    onSubmit(input);
  };

  const handleClear = () => {
    setInput("");
    onSubmit("");
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setTimeout(() => setIsFocused(false), 100);
  };

  return {
    // State
    suggestions,
    highlightedIndex,
    isSearching,
    isFocused,

    // Refs
    inputRef,

    // Handlers
    handleKeyDown,
    handleChange,
    handleSuggestionClick,
    handleSubmit,
    handleClear,
    handleFocus,
    handleBlur,

    // Direct state setters (if needed)
    setIsFocused,
  };
}

export type { TagType };
