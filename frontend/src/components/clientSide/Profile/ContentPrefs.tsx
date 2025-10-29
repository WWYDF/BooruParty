'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserSelf } from '@/core/types/users';
import ContentPrefsModal from './ContentPrefsModal';

export default function ContentPrefsSection({ user }: { user: UserSelf }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl bg-secondary p-4">
      <div className="mb-3">
        <h2 className="text-xl font-semibold">Content Preferences</h2>
        <p className="mt-1 text-sm text-zinc-400">
          These settings are saved in our database. (Not browser-specific)
        </p>
      </div>

      <motion.button
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.98 }}
        className="cursor-pointer rounded bg-darkerAccent px-4 py-2 text-white transition hover:bg-darkerAccent/80 focus:outline-none"
      >
        Open Preferences
      </motion.button>

      <ContentPrefsModal user={user} open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
