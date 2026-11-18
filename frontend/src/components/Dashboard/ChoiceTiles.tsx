'use client';

import { motion } from 'framer-motion';
import { CheckCircleIcon, CircleIcon } from '@phosphor-icons/react';

export type ChoiceTileOption<T extends string> = {
  value: T;
  label: string;
  desc?: string;
  icon?: React.ReactNode;   // optional left icon
};

type ChoiceTilesProps<T extends string> = {
  value: T[];                              // current selection(s)
  onChange: (next: T[]) => void;
  options: ChoiceTileOption<T>[];
  multiple?: boolean;                      // default: true (acts like checkboxes)
  className?: string;
  size?: 'sm' | 'md';
};

export default function ChoiceTiles<T extends string>({
  value,
  onChange,
  options,
  multiple = true,
  className = '',
  size = 'md',
}: ChoiceTilesProps<T>) {
  const toggle = (v: T) => {
    if (multiple) {
      onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
    } else {
      onChange(value.includes(v) ? [] : [v]);
    }
  };

  const pad = size === 'sm' ? 'p-3' : 'p-4';
  const text = size === 'sm' ? 'text-sm' : 'text-base';

  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      {options.map(opt => {
        const chosen = value.includes(opt.value);
        return (
          <motion.button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            whileTap={{ scale: 0.98 }}
            aria-pressed={chosen}
            className={`w-full rounded-xl border text-left transition cursor-pointer ${pad}
              ${chosen ? 'border-emerald-600 bg-emerald-600/10' : 'border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/60'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {opt.icon ? <span className="mt-0.5">{opt.icon}</span> : null}
                <div>
                  <div className={`font-semibold text-zinc-100 ${text}`}>{opt.label}</div>
                  {opt.desc && (
                    <div className={`mt-1 text-sm ${chosen ? 'text-emerald-300' : 'text-zinc-400'}`}>
                      {opt.desc}
                    </div>
                  )}
                </div>
              </div>
              {chosen ? (
                <CheckCircleIcon size={20} weight="fill" className="shrink-0 text-emerald-400" />
              ) : (
                <CircleIcon size={20} weight="regular" className="shrink-0 text-zinc-500" />
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
