'use client';

import { useState } from 'react';
import FadeIn from '../Motion/FadeIn';
import { ListChecks } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'phosphor-react';

type IntegrityResponse = {
  missing: string[];
  totalChecked: number;
  totalMissing: number;
  percMissing: number;
};

export default function IntegrityCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<IntegrityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const runIntegrityCheck = async () => {
    setIsChecking(true);
    setError(null);
    setResult(null);
    setModalOpen(false);

    try {
      const res = await fetch('/api/system/checks/integrity', { method: 'GET' });
      if (!res.ok) { throw new Error(`Request failed with status ${res.status}`) }

      const data: IntegrityResponse = await res.json();
      setResult(data);

      if (data.totalMissing > 0) {
        setModalOpen(true);
      }
    } catch (err: any) {
      console.error('[IntegrityCheck] Failed:', err);
      setError(err?.message ?? 'Failed to run integrity check.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <>
      <FadeIn>
        <div className="bg-secondary border border-secondary-border p-6 rounded-2xl shadow w-full">
          <h2 className="text-xl font-semibold mb-2">File Integrity Check</h2>
          <p className="text-sm text-subtle mb-4">
            Verifies that every post has a corresponding original file in{' '}
            <code className="font-mono bg-zinc-900 py-1 px-2 rounded-md">data/uploads/</code>.
          </p>

          {/* Trigger button */}
          <button
            onClick={runIntegrityCheck}
            disabled={isChecking}
            className="flex items-center gap-2 transition bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <ListChecks size={18} />
            <span>{isChecking ? 'Checking…' : 'Run Integrity Check'}</span>
          </button>

          {/* Error state */}
          {error && (
            <div className="mt-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Summary result (always inline) */}
          {result && !error && (
            <div className="mt-4 space-y-2 text-sm">
              <div>
                <span className="text-subtle">Total posts checked:</span>{' '}
                <span className="font-mono">{result.totalChecked}</span>
              </div>
              <div>
                <span className="text-subtle">Missing files:</span>{' '}
                <span className="font-mono text-amber-400">{result.totalMissing}</span>
              </div>
              <div>
                <span className="text-subtle">Missing percentage:</span>{' '}
                <span
                  className={[
                    "font-mono",
                    result.percMissing === 0
                      ? "text-emerald-400"
                      : result.percMissing < 1
                      ? "text-amber-400"
                      : "text-red-400"
                  ].join(" ")}
                >
                  {result.percMissing.toFixed(2)}%
                </span>
              </div>

              {result.totalMissing === 0 && (
                <div className="text-emerald-400 mt-1 flex gap-1 items-center">
                  <Check weight='fill' /> All posts have matching files. Test Passed.
                </div>
              )}
            </div>
          )}
        </div>
      </FadeIn>

      {/* Missing Posts Modal */}
      <AnimatePresence>
        {modalOpen && result && result.totalMissing > 0 && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl bg-secondary border border-secondary-border p-6 shadow-xl"
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-3xl font-semibold mb-4 text-center text-red-500">Oh no!</h3>
              <p className="text-sm text-subtle mb-4 text-center">
                There are{' '}
                <span className="font-bold text-red-400">
                  {result.totalMissing}
                </span>{' '}
                files missing!
              </p>

              <div className="text-xs text-subtle mb-2">
                Missing post IDs:
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-xs font-mono space-y-1">
                {result.missing.map((id) => (
                  <div key={id}>Post #{id}</div>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-sm transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
