'use client';

import { motion } from 'framer-motion';
import { useCallback } from 'react';

type IOSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;            // Optional inline label
  disabled?: boolean;
  id?: string;
  className?: string;        // Extra wrapper classes
};

export default function SwitchIOS({
  checked,
  onChange,
  label,
  disabled,
  id,
  className = '',
}: IOSwitchProps) {
  const toggle = useCallback(() => {
    if (!disabled) onChange(!checked);
  }, [checked, disabled, onChange]);

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
      className={`group inline-flex items-center gap-2 cursor-pointer select-none
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}`}
    >
      {/* Track */}
      <motion.span
        className={`relative h-6 w-11 rounded-full border transition
          ${checked ? 'bg-emerald-500/90 border-emerald-500/80' : 'bg-zinc-700 border-zinc-600'}`}
        layout
      >
        <motion.span
          // vertically center without translateY; anchor the base at left:2
          className="absolute top-0 bottom-0 my-auto h-5 w-5 rounded-full bg-white shadow ring-1 ring-black/10 pointer-events-none"
          style={{ left: 2 }}
          animate={{ x: checked ? 20 : 0 }}   // <- precise delta
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          initial={false}
        />
      </motion.span>

      {label && (
        <span className="text-sm text-zinc-200">{label}</span>
      )}
    </button>
  );
}
