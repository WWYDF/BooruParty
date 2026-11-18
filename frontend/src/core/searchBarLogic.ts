import { useEffect, useRef, useState } from "react";
import { API } from "@/core/api";

export type Suggestion = {
  key: string;        // React key
  insert: string;     // replaces the token under the caret (any -/~ prefix is kept)
  label: string;      // what the dropdown shows
  alias?: string;     // the alias the user typed, shown as "alias → name"
  color?: string;     // category color dot
  count?: number;     // post count
  continues?: boolean; // true = no trailing space, the user keeps typing (e.g. "safety:")
};

// GET /api/tags item (only the fields used here)
type TagResult = {
  id: number;
  name: string;
  postCount: number;
  category: { color: string };
  names?: { name: string }[]; // only the names that matched the search
};

// Must match parseSearch() in backend/src/core/utilities/search.ts
const SORT_ORDERS = ["newest", "oldest", "score", "favorites", "boosts", "random"];
const SYSTEM_VALUES: Record<string, string[]> = {
  safety: ["safe", "questionable", "explicit"],
  type: ["image", "animated", "video"],
  flag: ["reaction"],  // TagFlag enum, lowercase
  flags: ["reaction"],
  order: SORT_ORDERS,
  sort: SORT_ORDERS,
};
const SYSTEM_KEYS = ["safety", "type", "flag", "order", "from", "score", "tagcount", "id"];

const DEBOUNCE_MS = 150;

// The whitespace-separated token the caret is inside, split into its -/~ prefix and body
function tokenAt(text: string, caret: number) {
  let start = caret;
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  let end = caret;
  while (end < text.length && !/\s/.test(text[end])) end++;

  const raw = text.slice(start, end);
  const prefix = /^[-~]/.test(raw) ? raw[0] : "";
  return { start, end, prefix, body: raw.slice(prefix.length).toLowerCase() };
}

// "safety:safe,expl" -> safety:safe,explicit (completes the last comma item)
function systemValueSuggestions(key: string, value: string): Suggestion[] {
  const parts = value.split(",");
  const last = parts.pop() ?? "";
  return SYSTEM_VALUES[key]
    .filter((v) => v.startsWith(last) && !parts.includes(v))
    .map((v) => {
      const full = `${key}:${[...parts, v].join(",")}`;
      return { key: full, insert: full, label: full };
    });
}

type UseSearchBarLogicProps = {
  input: string;
  setInput: (input: string) => void;
  onSubmit: (query?: string) => void;
};

export function useSearchBarLogic({ input, setInput, onSubmit }: UseSearchBarLogicProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1); // -1 = nothing picked, Enter searches
  const [isFocused, setIsFocused] = useState(false);
  const [caret, setCaret] = useState(input.length);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setSuggestions([]);
    setHighlightedIndex(-1);
  };

  // Autocomplete whatever token the caret is in
  useEffect(() => {
    if (!isFocused) return;

    const { start, end, body } = tokenAt(input, caret);
    const colon = body.indexOf(":");

    if (colon > 0) {
      const key = body.slice(0, colon);
      // Fixed-value system terms are completed locally, no request needed
      if (SYSTEM_VALUES[key]) {
        setSuggestions(systemValueSuggestions(key, body.slice(colon + 1)));
        setHighlightedIndex(-1);
        return;
      }
      // Free-form system terms (from:, score:, ...) have nothing to suggest
      if (SYSTEM_KEYS.includes(key)) return close();
      // Any other "key:" is a tag name like re:zero, so fall through to tag search
    }

    if (!body || body.includes("*")) return close();

    // "sa" -> "safety:" etc. Shown instantly, tags get added below them
    const keyMatches: Suggestion[] = colon === -1 && body.length >= 2
      ? SYSTEM_KEYS.filter((k) => k.startsWith(body)).map((k) => ({
          key: `sys:${k}`, insert: `${k}:`, label: `${k}:`, continues: true,
        }))
      : [];
    setSuggestions(keyMatches);
    setHighlightedIndex(-1);

    // Tags already in the search (not counting the one being typed) aren't suggested again
    const used = new Set(
      (input.slice(0, start) + " " + input.slice(end))
        .toLowerCase().split(/\s+/).map((t) => t.replace(/^[-~]/, "")),
    );

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: body, match: "prefix", sort: "popular", limit: "10" });
        const res = await API(`/api/tags?${params}`, { signal: controller.signal });
        if (!res.ok) return;
        const data: { tags: TagResult[] } = await res.json();

        const tags: Suggestion[] = data.tags
          .filter((t) => !used.has(t.name))
          .map((t) => {
            const alias = t.names?.find((n) => n.name !== t.name)?.name;
            const matchedOwnName = t.names?.some((n) => n.name === t.name);
            return {
              key: `tag:${t.id}`,
              insert: t.name, // always insert the real name, even when an alias matched
              label: t.name,
              alias: matchedOwnName ? undefined : alias,
              color: t.category.color,
              count: t.postCount,
            };
          });

        setSuggestions([...keyMatches, ...tags]);
      } catch {
        // aborted (user kept typing) or network error: keep what's shown
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort(); // drop the in-flight request when the token changes
    };
  }, [input, caret, isFocused]);

  const applySuggestion = (s: Suggestion) => {
    const { start, end, prefix } = tokenAt(input, caret);
    const before = input.slice(0, start);
    const after = input.slice(end).replace(/^\s+/, "");
    const insert = prefix + s.insert;
    const sep = s.continues ? (after ? " " : "") : " ";

    const next = before + insert + sep + after;
    const nextCaret = before.length + insert.length + (s.continues ? 0 : 1);

    setInput(next);
    setCaret(nextCaret);
    close();

    // Put the caret right after the inserted text once React has updated the input
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleSubmit = () => {
    close();
    onSubmit(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const open = suggestions.length > 0;

    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Tab" && open) {
      e.preventDefault(); // Tab accepts the highlighted suggestion, or the first one
      applySuggestion(suggestions[Math.max(highlightedIndex, 0)]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && highlightedIndex >= 0) applySuggestion(suggestions[highlightedIndex]);
      else handleSubmit();
    } else if (e.key === "Escape") {
      close();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setCaret(e.target.selectionStart ?? e.target.value.length);
  };

  // Fires when the caret moves without typing (arrow keys, clicking inside the text)
  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    setCaret(e.currentTarget.selectionStart ?? input.length);
  };

  const handleClear = () => {
    setInput("");
    setCaret(0);
    close();
    onSubmit("");
  };

  const handleFocus = () => setIsFocused(true);

  const handleBlur = () => {
    setIsFocused(false);
    close();
  };

  return {
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
  };
}
