'use client';

import { CheckIcon } from '@phosphor-icons/react';
import clsx from 'clsx';

interface FullCheckboxOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface FullCheckboxGroupProps<T extends string> {
  options: FullCheckboxOption<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  disabled?: boolean;
}

// Shared look for the card (both the group items and the standalone version)
const cardClass = (selected: boolean, disabled?: boolean) => clsx(
  // transition-colors, NOT transition-all: "all" also animates the focus outline from the
  // text color to transparent on click, which flashes a white border
  'flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition-colors',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
  selected
    ? 'border-accent/40 bg-accent/10'
    : 'border-secondary-border bg-zinc-900/40 hover:border-accent/20 hover:bg-zinc-900/80',
  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
);

function FullCheckboxIcon({ selected, icon }: { selected: boolean; icon: React.ReactNode }) {
  return (
    <div className={clsx(
      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors', // not size-9: Tailwind 3.3 lacks size-*
      selected ? 'bg-accent/20 text-accent' : 'bg-zinc-900 text-subtle',
    )}>
      {icon}
    </div>
  );
}

function FullCheckboxDot({ selected }: { selected: boolean }) {
  return (
    <div className={clsx(
      'flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors',
      selected ? 'border-accent bg-accent' : 'border-zinc-600 bg-transparent',
    )}>
      {/* black on the yellow accent reads better than white */}
      {selected && <CheckIcon size={10} weight="bold" className="text-black" />}
    </div>
  );
}

function FullCheckboxText({ label, description }: { label: string; description?: string }) {
  return (
    <div className="flex-1">
      <p className="text-sm font-medium text-zinc-200">{label}</p>
      {description && <p className="mt-0.5 text-xs text-subtle">{description}</p>}
    </div>
  );
}

export function FullCheckboxGroup<T extends string>({ options, value, onChange, disabled }: FullCheckboxGroupProps<T>) {
  function toggle(opt: T) {
    if (disabled) return;
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  }

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            role="checkbox"
            aria-checked={selected}
            onClick={() => toggle(opt.value)}
            disabled={disabled}
            className={cardClass(selected, disabled)}
          >
            {opt.icon && <FullCheckboxIcon selected={selected} icon={opt.icon} />}
            <FullCheckboxText label={opt.label} description={opt.description} />
            <FullCheckboxDot selected={selected} />
          </button>
        );
      })}
    </div>
  );
}

// Single standalone FullCheckbox for simpler use cases
interface FullCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export function FullCheckbox({ checked, onChange, label, description, icon, disabled }: FullCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cardClass(checked, disabled)}
    >
      {icon && <FullCheckboxIcon selected={checked} icon={icon} />}
      <FullCheckboxText label={label} description={description} />
      <FullCheckboxDot selected={checked} />
    </button>
  );
}
