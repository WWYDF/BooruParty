'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';

export type DropdownOption<T extends string | number> = {
  value: T;
  label: string;
  color?: string;     // dot to the left + colored label (e.g. tag categories)
  disabled?: boolean;
};

type Props<T extends string | number> = {
  value: T | null;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string; // extra classes on the wrapper (width etc.)
};

function OptionLabel<T extends string | number>({ option }: { option: DropdownOption<T> }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {option.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />}
      <span className="truncate" style={option.color ? { color: option.color } : undefined}>{option.label}</span>
    </span>
  );
}

// A <select> replacement that can show colors. Keyboard: arrows, Home/End, Enter/Space, Esc, type-to-jump.
export default function Dropdown<T extends string | number>({ value, options, onChange, placeholder = 'Select...', disabled, className = '' }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapper = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const listId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  // Close when clicking anywhere else
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted option visible while arrowing through a long list
  useEffect(() => {
    if (open && highlighted >= 0) optionRefs.current[highlighted]?.scrollIntoView({ block: 'nearest' });
  }, [open, highlighted]);

  const openList = () => {
    if (disabled) return;
    setHighlighted(selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled));
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };

  // Next enabled option in a direction, wrapping around
  const step = (from: number, dir: 1 | -1) => {
    for (let i = 1; i <= options.length; i++) {
      const next = (from + dir * i + options.length) % options.length;
      if (!options[next].disabled) return next;
    }
    return from;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setHighlighted((i) => step(i, 1)); break;
      case 'ArrowUp':   e.preventDefault(); setHighlighted((i) => step(i, -1)); break;
      case 'Home':      e.preventDefault(); setHighlighted(step(-1, 1)); break;
      case 'End':       e.preventDefault(); setHighlighted(step(options.length, -1)); break;
      case 'Enter':
      case ' ':         e.preventDefault(); choose(highlighted); break;
      case 'Escape':    e.preventDefault(); setOpen(false); break;
      case 'Tab':       setOpen(false); break;
      default:
        // Type a letter to jump to the next option starting with it
        if (e.key.length === 1) {
          const letter = e.key.toLowerCase();
          for (let i = 1; i <= options.length; i++) {
            const idx = (highlighted + i) % options.length;
            if (!options[idx].disabled && options[idx].label.toLowerCase().startsWith(letter)) { setHighlighted(idx); break; }
          }
        }
    }
  };

  return (
    <div ref={wrapper} className={clsx('relative', className)}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={clsx(
          'flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-secondary-border bg-zinc-900 px-3 py-2 text-left text-sm',
          'transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600',
          open && 'ring-1 ring-zinc-600',
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-zinc-600',
        )}
      >
        {selected ? <OptionLabel option={selected} /> : <span className="text-zinc-500">{placeholder}</span>}
        <CaretDownIcon size={14} className={clsx('shrink-0 text-subtle transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
      {open && (
        <motion.ul
          id={listId}
          role="listbox"
          // Unfolds from the button, and folds back up on close
          initial={{ opacity: 0, y: -4, scaleY: 0.96 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          exit={{ opacity: 0, y: -4, scaleY: 0.96 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          style={{ transformOrigin: 'top' }}
          // Inside a <label>, the click after choosing would be forwarded to the toggle button and reopen the list
          onClick={(e) => e.preventDefault()}
          className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-secondary-border bg-secondary shadow-lg"
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;
            return (
              <li
                key={String(option.value)}
                ref={(el) => { optionRefs.current[i] = el; }}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                // mousedown + preventDefault keeps focus on the button
                onMouseDown={(e) => { e.preventDefault(); choose(i); }}
                onMouseEnter={() => !option.disabled && setHighlighted(i)}
                className={clsx(
                  'flex items-center justify-between gap-2 px-3 py-2 text-sm',
                  option.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                  i === highlighted && 'bg-zinc-800',
                )}
              >
                <OptionLabel option={option} />
                {isSelected && <CheckIcon size={14} weight="bold" className="shrink-0 text-accent" />}
              </li>
            );
          })}
        </motion.ul>
      )}
      </AnimatePresence>
    </div>
  );
}
