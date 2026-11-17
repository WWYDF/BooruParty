'use client';

import { CheckIcon } from '@phosphor-icons/react';

type CheckboxProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  title?: string; // native tooltip, e.g. "Coming soon"
  className?: string; // extra classes on the wrapper
};

export default function Checkbox({ checked, onChange, label, disabled, title, className = '' }: CheckboxProps) {
  return (
    <label
      title={title}
      className={`inline-flex select-none items-center gap-2 text-sm
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        ${className}`}
    >
      {/* The real checkbox: invisible, but still focusable and toggled by Space */}
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />

      {/* What you actually see */}
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-zinc-600 bg-zinc-900 transition
          peer-checked:border-accent peer-checked:bg-accent
          peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50"
      >
        {checked && <CheckIcon size={12} weight="bold" className="text-white" />}
      </span>

      {label && <span className="text-zinc-200">{label}</span>}
    </label>
  );
}
