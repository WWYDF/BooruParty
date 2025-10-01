'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { KeyboardEvent } from 'react';
import clsx from 'clsx';

export function ToggleSwitch({
  checked,
  onChange,
  size = 'md',
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  label?: string;
}) {
  const dims = {
    sm: { w: 36, h: 20, knob: 16, p: 2 },
    md: { w: 48, h: 28, knob: 24, p: 2 },
    lg: { w: 64, h: 36, knob: 32, p: 2 },
  }[size];

  const handleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
    if (e.key === 'ArrowLeft') onChange(false);
    if (e.key === 'ArrowRight') onChange(true);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onKeyDown={handleKey}
      onClick={() => !disabled && onChange(!checked)}
      className={clsx(
        'relative inline-flex select-none items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
        checked ? 'bg-emerald-500/70' : 'bg-zinc-600/60',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
      style={{ width: dims.w, height: dims.h, padding: dims.p }}
    >
      {/* background gloss */}
      <span
        aria-hidden
        className={clsx(
          'absolute inset-0 rounded-full transition-opacity',
          checked ? 'opacity-100' : 'opacity-0',
          'bg-emerald-500/20'
        )}
      />
      {/* knob */}
      <span
        aria-hidden
        className={clsx(
          'block rounded-full bg-white shadow transition-transform',
          'will-change-transform'
        )}
        style={{
          width: dims.knob,
          height: dims.knob,
          transform: `translateX(${checked ? dims.w - dims.knob - dims.p * 2 : 0}px)`,
        }}
      />
    </button>
  );
}

export default function AddonSectionCard({
  icon,
  title,
  subtitle,
  enabled,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        <div className="mt-0.5 text-zinc-300">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>

            {/* iOS ahh switch */}
            <div className="flex items-center gap-2">
              <ToggleSwitch
                checked={enabled}
                onChange={() => onToggle()}
                size="md"
                label={`${title} toggle`}
              />
            </div>
          </div>
          {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
        </div>
      </div>

      {/* Collapsible body */}
      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 24 }}
            className="overflow-hidden border-t border-zinc-800"
          >
            <div className="p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}