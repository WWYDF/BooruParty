'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

type InfoModalProps = {
  open: boolean;
  onClose: () => void;

  icon?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;

  /** Main body content */
  children?: React.ReactNode;

  /** Extra classes for the content/body wrapper (inside the padded card) */
  bodyClassName?: string;

  /** Extra classes for the outer dialog card */
  className?: string;

  /** Close button text & classes */
  showBottomButton?: string;
  closeText?: string;
  closeButtonClassName?: string;

  /** Show a top-right dismiss X button */
  showCloseX?: boolean;

  /** Optional aria label when omitting visible title */
  ariaLabel?: string;
};

export default function InfoModal({
  open,
  onClose,
  icon,
  title,
  subtitle,
  children,
  bodyClassName,
  className,
  showBottomButton,
  closeText = 'Close',
  closeButtonClassName,
  showCloseX = true,
  ariaLabel,
}: InfoModalProps) {
  const initialFocusRef = useRef<HTMLButtonElement | null>(null);
  const titleId = 'info-modal-title';
  const descId = 'info-modal-subtitle';

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus button initially
  useEffect(() => {
    if (open && initialFocusRef.current) initialFocusRef.current.focus();
  }, [open]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1000]">
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Centering wrapper with reliable gutters */}
          <div className="fixed inset-0 flex items-center justify-center px-4 py-6 sm:px-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={subtitle ? descId : undefined}
              aria-label={!title ? ariaLabel : undefined}
              // Card: flex column, responsive width cap, internal padding, safe rounded edges
              className={clsx(
                'relative flex w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl flex-col',
                'rounded-2xl overflow-hidden bg-zinc-900 text-zinc-100 shadow-2xl ring-1 ring-zinc-800 p-6',
                // keep at least some vertical headroom and let body scroll if tall
                'max-h-[min(90vh,48rem)]',
                className
              )}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close X */}
              {showCloseX && (
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}

              {/* Header */}
              {(icon || title || subtitle) && (
                <div className="flex items-start gap-3">
                  {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
                  <div className="min-w-0">
                    {title && (
                      <h2 id={titleId} className="truncate text-xl font-semibold leading-6">
                        {title}
                      </h2>
                    )}
                    {subtitle && (
                      <p id={descId} className="mt-1 text-sm text-zinc-400">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Body (scroll region if content grows) */}
              <div className={clsx('mt-4 flex-1 overflow-y-auto', bodyClassName)}>
                {children}
              </div>

              {/* Footer */}
              {showBottomButton && (
                <div className="mt-6 flex justify-end">
                <button
                  ref={initialFocusRef}
                  onClick={onClose}
                  className={clsx(
                    'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium',
                    'text-zinc-50 bg-zinc-800 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-600',
                    closeButtonClassName
                  )}
                >
                  {closeText}
                </button>
              </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
