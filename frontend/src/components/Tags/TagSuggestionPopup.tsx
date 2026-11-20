'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PlusIcon } from '@phosphor-icons/react';
import { API } from '@/core/api';
import { RelatedTag, TagDetail } from '@/core/types/tags';
import { TagChip } from '@/core/types/uploads';

type Props = {
  tagName: string;
  currentNames: string[];                                // tags already on the post (hidden from the list)
  colorFor: (categoryId: number) => string | undefined;
  onAdd: (chips: TagChip[]) => void;                     // [suggested tag, ...everything it implies]
  onClose: () => void;
};

// Little dropdown under a tag chip: that tag's suggested tags, each with an Add button.
// Must be rendered inside the chip: clicks on the chip itself don't count as "outside".
export default function TagSuggestionPopup({ tagName, currentNames, colorFor, onAdd, onClose }: Props) {
  const [suggestions, setSuggestions] = useState<RelatedTag[] | null>(null); // null = loading
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    API(`/api/tags/${encodeURIComponent(tagName)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: TagDetail) => { if (!cancelled) setSuggestions(data.suggestions); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [tagName]);

  // Close on Escape or a click outside the chip (the chip's own name button toggles it instead)
  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      const chip = ref.current?.parentElement;
      if (chip && !chip.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Same as picking it in the tag input: the tag plus everything it implies
  const add = async (tag: RelatedTag) => {
    setAdding(tag.name);
    try {
      const res = await API(`/api/tags/${encodeURIComponent(tag.name)}`);
      if (!res.ok) throw new Error();
      const data: TagDetail = await res.json();
      onAdd([
        { name: data.name, color: data.category.color, postCount: data.postCount },
        ...data.allImplications.map((i) => ({ name: i.name, color: colorFor(i.categoryId) })),
      ]);
    } catch {
      // implications are a convenience; still add the tag itself
      onAdd([{ name: tag.name, color: colorFor(tag.categoryId) }]);
    } finally {
      setAdding(null);
      onClose(); // one pick per open; click the tag again for more
    }
  };

  const visible = suggestions?.filter((s) => !currentNames.includes(s.name)) ?? [];

  // One status line (loading / error / empty); keyed so switching between them cross-fades
  const status = failed
    ? { key: 'failed', text: 'Could not load suggestions.', className: 'text-red-400' }
    : suggestions === null
      ? { key: 'loading', text: 'Loading...', className: 'animate-pulse' }
      : visible.length === 0
        ? { key: 'empty', text: suggestions.length === 0 ? 'This tag has no suggestions.' : 'All suggestions are already added.', className: '' }
        : null;

  return (
    // Parent wraps this in <AnimatePresence> so `exit` plays on close
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.96, transition: { duration: 0.12 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      style={{ originX: 0, originY: 0 }} // grow out of the chip's corner
      layout
      className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-lg border border-secondary-border bg-zinc-950 p-2 text-xs text-subtle shadow-lg"
    >
      <motion.p layout="position" className="mb-1.5 px-1 font-medium text-white">Suggested tags</motion.p>

      <AnimatePresence mode="popLayout" initial={false}>
        {status && (
          <motion.p
            key={status.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`px-1 ${status.className}`}
          >
            {status.text}
          </motion.p>
        )}
      </AnimatePresence>

      {visible.length > 0 && (
        <ul className="flex max-h-60 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
          {/* An added row collapses and the rest slide up */}
          <AnimatePresence initial={false}>
            {visible.map((s) => (
              <motion.li
                key={s.id}
                layout
                exit={{ opacity: 0, x: 12, height: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.18 } }}
                className="flex items-center justify-between gap-2 rounded px-1 py-1"
              >
                <span className="truncate" style={{ color: colorFor(s.categoryId) ?? '#3c9aff' }}>{s.name}</span>
                <motion.button
                  type="button"
                  onClick={() => add(s)}
                  disabled={adding !== null}
                  whileTap={adding === null ? { scale: 0.9 } : undefined}
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-accent transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlusIcon size={12} weight="bold" />
                  {adding === s.name ? 'Adding...' : 'Add'}
                </motion.button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </motion.div>
  );
}
