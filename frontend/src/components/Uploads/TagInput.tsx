'use client';

import { useEffect, useState } from 'react';
import { XIcon } from '@phosphor-icons/react';
import { API } from '@/core/api';
import { formatCounts } from '@/core/formats';
import { TagChip } from '../../core/types/uploads';

// GET /api/tags item (only the fields used here)
type TagResult = {
  id: number;
  name: string;
  postCount: number;
  category: { color: string };
  names?: { name: string }[]; // only the names that matched the search
};

type Props = {
  value: TagChip[];
  onChange: (tags: TagChip[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function TagInput({ value, onChange, placeholder = 'Add a tag...', disabled }: Props) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<TagResult[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [focused, setFocused] = useState(false);
  const [searched, setSearched] = useState(false); // a search finished for the current text

  useEffect(() => {
    const term = text.trim();
    setSearched(false);
    if (!term) { setResults([]); return; }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: term, match: 'prefix', sort: 'popular', limit: '8' });
        const res = await API(`/api/tags?${params}`, { signal: controller.signal });
        if (!res.ok) return;
        const data: { tags: TagResult[] } = await res.json();
        setResults(data.tags.filter((t) => !value.some((v) => v.name === t.name)));
        setHighlighted(0);
        setSearched(true);
      } catch {
        // aborted because the user kept typing
      }
    }, 150);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [text, value]);

  const add = (tag: TagResult) => {
    onChange([...value, { name: tag.name, color: tag.category.color }]);
    setText('');
    setResults([]);
  };

  const remove = (name: string) => onChange(value.filter((t) => t.name !== name));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault();
      setHighlighted((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if ((e.key === 'Enter' || e.key === 'Tab') && text.trim()) {
      e.preventDefault();
      if (results[highlighted]) add(results[highlighted]);
    } else if (e.key === 'Backspace' && !text && value.length) {
      remove(value[value.length - 1].name);
    } else if (e.key === 'Escape') {
      setText('');
    }
  };

  const showDropdown = focused && text.trim() && (results.length > 0 || searched);

  return (
    <div className="relative">
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-lg border border-secondary-border bg-zinc-900 px-2 py-1.5 ${
          disabled ? 'opacity-50' : 'focus-within:ring-1 focus-within:ring-zinc-600'
        }`}
      >
        {value.map((tag) => (
          <span
            key={tag.name}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-sm"
            style={{ color: tag.color ?? '#fff' }}
          >
            {tag.name}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(tag.name)}
                className="text-subtle hover:text-red-400"
                title={`Remove ${tag.name}`}
              >
                <XIcon size={12} weight="bold" />
              </button>
            )}
          </span>
        ))}

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={value.length ? '' : placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm text-white focus:outline-none"
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-secondary-border bg-secondary shadow-md">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-subtle">No tag starting with &quot;{text.trim()}&quot;</p>
          ) : (
            results.map((tag, i) => {
              const alias = tag.names?.some((n) => n.name === tag.name) ? undefined : tag.names?.[0]?.name;
              return (
                <div
                  key={tag.id}
                  // mousedown + preventDefault keeps focus in the input, so blur doesn't close the list first
                  onMouseDown={(e) => { e.preventDefault(); add(tag); }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                    i === highlighted ? 'bg-zinc-700 text-white' : ''
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.category.color }} />
                  <span className="truncate">
                    {alias && <span className="text-subtle">{alias} → </span>}
                    {tag.name}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-subtle">{formatCounts(tag.postCount)}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
