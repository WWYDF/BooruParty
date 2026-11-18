'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';

type IOSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;              // Visible text next to the switch
  ariaLabel?: string;          // Screen-reader name when there's no visible label
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  id?: string;
  className?: string;          // Extra wrapper classes
};

// Track size per variant. The knob is the track height minus 4px (2px gap each side),
// and slides by (width - height) so it lands the same 2px from the right edge.
const SIZES = {
  sm: { w: 36, h: 20 },
  md: { w: 48, h: 28 },
  lg: { w: 56, h: 32 },
} as const;

export default function SwitchIOS({
  checked,
  onChange,
  label,
  ariaLabel,
  size = 'md',
  disabled = false,
  id,
  className = '',
}: IOSwitchProps) {
  const { w, h } = SIZES[size];
  const knob = h - 4;

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      // Click and Space/Enter come free with a real <button>; arrows set a direction
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' && checked) onChange(false);
        if (e.key === 'ArrowRight' && !checked) onChange(true);
      }}
      className={clsx(
        'group inline-flex select-none items-center gap-2 rounded-full focus:outline-hidden align-bottom',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      {/* Track (focus ring sits here, so it hugs the switch and not the label) */}
      <span
        className={clsx(
          'relative shrink-0 rounded-full border transition-colors',
          'group-focus-visible:ring-2 group-focus-visible:ring-emerald-500/60',
          checked ? 'border-emerald-500/80 bg-emerald-500/90' : 'border-zinc-600 bg-zinc-700',
        )}
        style={{ width: w, height: h }}
      >
        <motion.span
          // vertically centered without translateY, so the spring only animates x
          className="pointer-events-none absolute inset-y-0 my-auto rounded-full bg-white shadow-sm ring-1 ring-black/10"
          style={{ left: 1, width: knob, height: knob }}
          animate={{ x: checked ? w - h : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          initial={false}
        />
      </span>

      {label && <span className="text-sm text-zinc-200">{label}</span>}
    </button>
  );
}
