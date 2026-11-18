'use client';

import { AnimatePresence, motion } from 'framer-motion';
import SwitchIOS from '@/components/UI/SwitchIOS';

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
              <SwitchIOS
                checked={enabled}
                onChange={() => onToggle()}
                size="md"
                ariaLabel={`${title} toggle`}
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