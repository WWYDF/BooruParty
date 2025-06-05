'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CURRENT_VERSION } from '@/core/version';
import FadeIn from '../Motion/FadeIn';
import { CursorClick } from '@phosphor-icons/react';
import { ArrowRight } from 'phosphor-react';

type UpdateResponse = {
  latest: string;
  url: string;
  changelog: string;
  needsUpdate: boolean;
};

export default function UpdaterBox() {
  const [update, setUpdate] = useState<UpdateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch(`https://booru.party/api/update/${CURRENT_VERSION}`);
        const data = await res.json();
        // const data = {  // Testing data
        //   latest: "1.9.0",
        //   url: "https://docs.booru.party/updating",
        //   changelog: "",
        //   needsUpdate: true
        // }
        setUpdate(data);
      } catch (e) {
        setError('Failed to check for updates.');
      }
    };

    checkUpdate();
  }, []);

  return (
    <FadeIn>
      <div className="bg-secondary border border-secondary-border p-6 rounded-2xl shadow w-full">
        <h2 className="text-xl font-semibold mb-4">Updater</h2>

        {!update && !error && <p className="text-subtle">Checking for updates...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {update && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <p className="text-sm text-subtle">Current version: <b>{CURRENT_VERSION}</b></p>
            <p className="text-sm text-subtle">Latest version: <b>{update.latest}</b></p>

            {update.needsUpdate ? (
              <div className="mt-3 bg-yellow-900 text-yellow-300 p-3 rounded-lg border border-yellow-700">
                <p className="font-semibold mb-2">Update Available!</p>
                <p className="text-sm whitespace-pre-wrap">{update.changelog}</p>
                <a
                  href={update.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-sm font-bold hover:text-yellow-400"
                >
                  Learn how to update to {update.latest}
                  <ArrowRight size={14} weight="bold" />
                </a>
              </div>
            ) : (
              <p className="text-green-400 font-medium mt-2">You're up to date.</p>
            )}
          </motion.div>
        )}
      </div>
    </FadeIn>
  );
}
