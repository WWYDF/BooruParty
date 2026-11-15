// Imported from side project

'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'

type FetchingIndicatorProps = {
  show: boolean
  showSpinner?: boolean
  showLabel?: boolean
  label?: string
  blur?: boolean
  blockScroll?: boolean
  zIndexClassName?: string
  panelClassName?: string
}

export default function LoadingOverlay({
  show,
  showSpinner = true,
  showLabel = true,
  label = 'Loading…',
  blur = true,
  blockScroll = false,
  zIndexClassName = 'z-[1000]',
  panelClassName = '',
}: FetchingIndicatorProps) {
  // Global ref count so multiple overlays can coexist
  const LOCK_KEY = '__cc_scroll_lock_count__';

  useEffect(() => {
    if (!blockScroll) return;

    const w = window as unknown as Record<string, number>;
    w[LOCK_KEY] = w[LOCK_KEY] ?? 0;

    if (show) {
      if (w[LOCK_KEY] === 0) document.body.style.overflow = 'hidden';
      w[LOCK_KEY] += 1;
    } else {
      // if we previously incremented, decrement
      if (w[LOCK_KEY] > 0) {
        w[LOCK_KEY] -= 1;
        if (w[LOCK_KEY] === 0) document.body.style.overflow = '';
      }
    }

    // Safety: if component unmounts while show=true, also decrement
    return () => {
      if (!blockScroll) return;
      if (show && w[LOCK_KEY] > 0) {
        w[LOCK_KEY] -= 1;
        if (w[LOCK_KEY] === 0) document.body.style.overflow = '';
      }
    };
  }, [show, blockScroll]);

  if (!show) return null; // important: render nothing when not showing

  return (
    <div
      role="presentation"
      className={clsx(
        'fixed inset-0 flex items-center justify-center p-6 bg-black/40',
        blur && 'backdrop-blur-sm',
        zIndexClassName
      )}
    >
      <AnimatePresence initial>
        {(showSpinner || (showLabel && !!label)) && (
          <motion.div
            key="panel"
            className={clsx(
              'flex items-center gap-4 rounded-xl bg-secondary/70 border border-secondary-border px-4 py-3',
              panelClassName
            )}
            initial={{ scale: 0.98, y: 6, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.98, y: 6, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.28 }}
            role="alert"
            aria-busy="true"
          >
            {showSpinner && (
              <span
                aria-hidden
                className="inline-block h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin"
              />
            )}
            {showLabel && !!label && (
              <span className="text-sm text-white/90">{label}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}