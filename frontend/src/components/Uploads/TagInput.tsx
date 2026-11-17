'use client';

import { useEffect, useRef, useState } from 'react';
import { PlusIcon, XIcon } from '@phosphor-icons/react';
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

// GET /api/tags/:name -> allImplications item
type ImpliedTag = { id: number; name: string; categoryId: number };

type Props = {
  value: TagChip[];
  onChange: (tags: TagChip[]) => void;
  placeholder?: string;
  disabled?: boolean;
  withImplications?: boolean;                             // picking a tag also adds everything it implies
  colorFor?: (categoryId: number) => string | undefined;  // colors for implied tags (they only come with a categoryId)
  allowNew?: boolean;                                     // offer "Add new tag" for names that don't exist yet
  showChips?: boolean;                                    // false = the parent renders the picked tags itself
};

// Mirrors the server's normalizeTagName closely enough for display; the server has the final say
const normalize = (input: string) =>
  input.normalize('NFC').trim().toLowerCase().replace(/\s+/g, '_').replace(/_+/g, '_');

export default function TagInput({
  value,
  onChange,
  placeholder = 'Add a tag...',
  disabled,
  withImplications = false,
  colorFor,
  allowNew = false,
  showChips = true,
}: Props) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<TagResult[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [focused, setFocused] = useState(false);
  const [searched, setSearched] = useState(false); // a search finished for the current text

  // Latest value, for async work that finishes after the user has changed the list again
  const valueRef = useRef(value);
  valueRef.current = value;

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

  // "Add new tag" row: only once the search finished and nothing matches the name or one of its aliases
  const newName = normalize(text);
  const offerNew =
    allowNew &&
    searched &&
    newName !== '' &&
    !value.some((v) => v.name === newName) &&
    !results.some((r) => r.name === newName || r.names?.some((n) => n.name === newName));
  const optionCount = results.length + (offerNew ? 1 : 0);

  const clearInput = () => {
    setText('');
    setResults([]);
  };

  // A pick is one change: [picked tag, ...everything it implies], so the parent sees them as one batch
  const add = async (tag: TagResult) => {
    clearInput();
    const picked: TagChip = { name: tag.name, color: tag.category.color, postCount: tag.postCount };
    if (!withImplications) {
      onChange([...value, picked]);
      return;
    }

    let implied: TagChip[] = [];
    try {
      const res = await API(`/api/tags/${encodeURIComponent(tag.name)}`);
      if (res.ok) {
        const data: { allImplications: ImpliedTag[] } = await res.json();
        implied = data.allImplications.map((i) => ({ name: i.name, color: colorFor?.(i.categoryId) }));
      }
    } catch {
      // implications are a convenience; still add the picked tag
    }

    // The user may have changed the list while this loaded; build on the latest one
    const current = valueRef.current;
    if (current.some((t) => t.name === picked.name)) return; // already added meanwhile
    onChange([...current, picked, ...implied.filter((i) => !current.some((t) => t.name === i.name))]);
  };

  const addNew = () => {
    clearInput();
    onChange([...value, { name: newName, isNew: true }]);
  };

  const choose = (index: number) => {
    if (index < results.length) add(results[index]);
    else if (offerNew) addNew();
  };

  const remove = (name: string) => onChange(value.filter((t) => t.name !== name));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && optionCount) {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % optionCount);
    } else if (e.key === 'ArrowUp' && optionCount) {
      e.preventDefault();
      setHighlighted((i) => (i <= 0 ? optionCount - 1 : i - 1));
    } else if ((e.key === 'Enter' || e.key === 'Tab') && text.trim()) {
      e.preventDefault();
      choose(highlighted);
    } else if (e.key === 'Backspace' && showChips && !text && value.length) {
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
        {showChips && value.map((tag) => (
          <span
            key={tag.name}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm ${
              tag.isNew ? 'border border-dashed border-zinc-500 bg-transparent' : 'bg-secondary'
            }`}
            style={{ color: tag.color ?? '#fff' }}
            title={tag.isNew ? 'New tag: created when you save' : undefined}
          >
            {tag.isNew && <PlusIcon size={10} weight="bold" className="text-subtle" />}
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
          placeholder={showChips && value.length ? '' : placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm text-white focus:outline-none"
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-secondary-border bg-secondary shadow-md">
          {optionCount === 0 && (
            <p className="px-3 py-2 text-sm text-subtle">No tag starting with &quot;{text.trim()}&quot;</p>
          )}

          {results.map((tag, i) => {
            const alias = tag.names?.some((n) => n.name === tag.name) ? undefined : tag.names?.[0]?.name;
            return (
              <div
                key={tag.id}
                // mousedown + preventDefault keeps focus in the input, so blur doesn't close the list first
                onMouseDown={(e) => { e.preventDefault(); choose(i); }}
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
          })}

          {offerNew && (
            <div
              onMouseDown={(e) => { e.preventDefault(); choose(results.length); }}
              onMouseEnter={() => setHighlighted(results.length)}
              className={`flex cursor-pointer items-center gap-2 border-t border-secondary-border px-3 py-2 text-sm ${
                highlighted === results.length ? 'bg-zinc-700 text-white' : ''
              }`}
            >
              <PlusIcon size={12} weight="bold" className="shrink-0 text-subtle" />
              <span className="truncate">
                Add new tag <span className="text-white">&quot;{newName}&quot;</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
