'use client';

import { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { AutoTaggerShape } from '@/core/types/dashboard';

export type PredictTag = {
  name: string;
  score: number;
};

function normalizeResponse(data: AutoTaggerShape): PredictTag[] {
  if (!Array.isArray(data) || data.length === 0) return [];
  const map = data[0].tags as Record<string, number>;
  return Object.entries(map).map(([name, score]) => ({ name, score }));
}

export default function AutoTaggerModal({
  open,
  onClose,
  imageUrl,
  autotaggerUrl,
}: {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  autotaggerUrl: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<PredictTag[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setTags([]);

        const resImg = await fetch(imageUrl, { credentials: 'include' });
        if (!resImg.ok) throw new Error(`image fetch ${resImg.status}`);
        const blob = await resImg.blob();

        const fd = new FormData();
        fd.append('file', new File([blob], 'preview', { type: blob.type || 'image/jpeg' }));
        fd.append('format', 'json');

        const res = await fetch('/api/addons/autotagger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl }),
        });
        const json: AutoTaggerShape = await res.json();
        if (!res.ok) throw new Error(`AutoTagger Proxy: ${res.status}`);

        const arr: PredictTag[] = normalizeResponse(json);
        // arr.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        if (!cancelled) setTags(arr);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to fetch tags');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, imageUrl, autotaggerUrl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">AutoTagger Preview</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-zinc-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs text-zinc-400">Preview image</div>
            <img src={imageUrl} alt="Preview" className="mt-2 max-h-48 w-full rounded object-contain" />
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs text-zinc-400">Predicted tags</div>

            {loading && <div className="mt-2 text-sm text-zinc-300">Querying autotagger…</div>}
            {error && <div className="mt-2 text-sm text-red-300">Error: {error}</div>}

            {!loading && !error && (
              <ul className="mt-2 grid grid-cols-2 gap-2 text-sm text-zinc-200">
                {tags.length === 0 ? (
                  <li className="col-span-2 text-zinc-400">No tags returned.</li>
                ) : (
                  tags.map((t, i) => (
                    <li key={`${t.name}-${i}`} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1">
                      <span className="truncate">{t.name}</span>
                      {typeof t.score === 'number' && (
                        <span className="ml-2 text-xs text-zinc-400">{t.score.toFixed(3)}</span>
                      )}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
