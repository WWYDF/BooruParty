'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import {
  ArrowsLeftRightIcon,
  ArrowUpIcon,
  LightningIcon,
  StarIcon,
  ThumbsUpIcon,
  UserCircleIcon,
  XIcon,
} from '@phosphor-icons/react';
import SwitchIOS from '@/components/UI/SwitchIOS';
import { useUser } from '@/components/UserProvider';
import { PREFS_EVENT, readBrowserPref, writeBrowserPref } from '@/core/browserPrefs';

type Props = {
  // On /posts the feed only reads ?query= when it mounts, so it passes its own search here.
  // Elsewhere (e.g. /post/:id) searches open /posts instead.
  onSearch?: (text: string) => void;
};

const itemClass = 'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-800 hover:text-white';

// Floating quick-access button (bottom right) for the feed and post pages
export default function QuickMenu({ onSearch }: Props) {
  const { user } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [flipNavigators, setFlipNavigators] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Flip preference: read on mount, and follow changes made anywhere else (e.g. the Preferences page)
  useEffect(() => {
    const sync = () => setFlipNavigators(!!readBrowserPref('flipNavigators', false));
    sync();
    window.addEventListener(PREFS_EVENT, sync);
    return () => window.removeEventListener(PREFS_EVENT, sync);
  }, []);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const runSearch = (text: string) => {
    setOpen(false);
    if (onSearch) onSearch(text);
    else router.push(`/posts?query=${encodeURIComponent(text)}`);
  };

  const backToTop = () => {
    setOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFlip = (next: boolean) => {
    setFlipNavigators(next);
    writeBrowserPref('flipNavigators', next);
  };

  return (
    <div ref={rootRef} className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
      <AnimatePresence>
        {open && (
          <motion.div
            key="quick-menu"
            role="menu"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            style={{ transformOrigin: 'bottom right' }}
            className="absolute bottom-full right-0 mb-3 w-64 rounded-2xl border border-secondary-border bg-secondary/95 p-1.5 shadow-2xl backdrop-blur"
          >
            <button type="button" role="menuitem" onClick={backToTop} className={itemClass}>
              <ArrowUpIcon size={18} className="text-subtle" />
              Back to Top
            </button>

            {user && (
              <>
                <button type="button" role="menuitem" onClick={() => runSearch(`likes:${user.username}`)} className={itemClass}>
                  <ThumbsUpIcon size={18} className="text-green-400" />
                  Show Likes
                </button>
                <button type="button" role="menuitem" onClick={() => runSearch(`favorites:${user.username}`)} className={itemClass}>
                  <StarIcon size={18} className="text-yellow-400" />
                  Show Favorites
                </button>
              </>
            )}

            {/* The whole row toggles; the switch itself is just the indicator */}
            <div
              role="menuitemcheckbox"
              aria-checked={flipNavigators}
              tabIndex={0}
              onClick={() => toggleFlip(!flipNavigators)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleFlip(!flipNavigators);
                }
              }}
              className={clsx(itemClass, 'justify-between')}
            >
              <span className="flex items-center gap-3">
                <ArrowsLeftRightIcon size={18} className="text-subtle" />
                Flip Navigation
              </span>
              <span className="pointer-events-none" aria-hidden>
                <SwitchIOS checked={flipNavigators} onChange={() => {}} size="sm" ariaLabel="Flip navigation buttons" />
              </span>
            </div>

            {user && (
              <>
                <div className="mx-2 my-1 h-px bg-secondary-border" />
                <Link
                  href={`/users/${encodeURIComponent(user.username)}`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={itemClass}
                >
                  <UserCircleIcon size={18} className="text-accent" />
                  My Profile
                </Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.92 }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={open ? 'Close quick menu' : 'Open quick menu'}
        className={clsx(
          'flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-3 shadow-xl transition',
          'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50',
          'border-black bg-accent text-secondary hover:brightness-80'
        )}
      >
        <motion.span
          key={open ? 'close' : 'open'}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="flex"
        >
          {open ? <XIcon size={22} weight="bold" /> : <LightningIcon size={22} weight="fill" />}
        </motion.span>
      </motion.button>
    </div>
  );
}
