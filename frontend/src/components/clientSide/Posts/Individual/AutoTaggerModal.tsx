'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle, MinusCircle, PlusCircle, X, XCircle } from '@phosphor-icons/react';
import LoadingOverlay from '../../LoadingOverlay';

type MatchRow = {
  tag: {
    id: number;
    name: string;
    aliases?: { alias: string }[];
    category?: { color?: string | null } | null;
  };
  score: number;
  matchedName: string; // which predicted string matched this tag (name or alias)
};

type NonMatchedRow = {
  name: string;
  score: number;
};

type MatchedPick = { tagId: number; name: string; score: number; matchedName?: string };
type NewPick = { name: string; score: number };

export default function AutoTaggerModal({
  open,
  onClose,
  imageUrl,
  onSave,
  existingTagIds = [],
  existingNames = [],
}: {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  onSave: (payload: {
    matched: { tagId: number; name: string; score: number; matchedName?: string }[];
    create: { name: string; score: number }[];
  }) => void;
  existingTagIds?: number[];   // IDs already on the post
  existingNames?: string[];    // names + aliases already on the post (lowercased preferred)
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [nonMatched, setNonMatched] = useState<NonMatchedRow[]>([]);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [resultsMaxH, setResultsMaxH] = useState<number>(400);
  const [selectedMatched, setSelectedMatched] = useState<MatchedPick[]>([]);
  const [selectedNew, setSelectedNew] = useState<NewPick[]>([]);

  const isMatchedSelected = (tagId: number) =>
    selectedMatched.some((x) => x.tagId === tagId);

  const isNewSelected = (name: string) =>
    selectedNew.some((x) => x.name.toLowerCase() === name.toLowerCase());

  // handlers
  const toggleMatched = (m: { tagId: number; name: string; score: number; matchedName?: string }) => {
    setSelectedMatched((prev) => {
      const exists = prev.find((x) => x.tagId === m.tagId);
      if (exists) return prev.filter((x) => x.tagId !== m.tagId);
      return [...prev, m];
    });
  };

  const toggleNew = (n: { name: string; score: number }) => {
    setSelectedNew((prev) => {
      const idx = prev.findIndex((x) => x.name.toLowerCase() === n.name.toLowerCase());
      if (idx >= 0) return prev.filter((x) => x.name.toLowerCase() !== n.name.toLowerCase());
      return [...prev, n];
    });
  };

  // clear selections upon reopening modal
  useEffect(() => {
    if (open) {
      setSelectedMatched([]);
      setSelectedNew([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setMatches([]);
        setNonMatched([]);

        const r = await fetch('/api/addons/autotagger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || `proxy ${r.status}`);

        // Build exclusion sets
        const idSet = new Set<number>(existingTagIds);
        const nameSet = new Set<string>(existingNames.map(s => s.toLowerCase()));

        // Server already sorts by score, but we’ll re-filter here.
        const respMatches = (data.matches ?? []) as {
          tag: { id: number; name: string; aliases?: { alias: string }[]; category?: { color?: string | null } | null };
          score: number;
          matchedName: string;
        }[];

        const respNonMatched = (data.nonMatched ?? []) as { name: string; score: number }[];

        // 1) Filter out matched tags that are already on the post (by id)
        const filteredMatches = respMatches.filter(m => !idSet.has(m.tag.id));

        // 2) Filter out unresolved names that are already present by name or alias
        const filteredNonMatched = respNonMatched.filter(n => !nameSet.has(n.name.toLowerCase()));

        if (cancelled) return;
        setMatches(filteredMatches);
        setNonMatched(filteredNonMatched);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to fetch tags');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, imageUrl, existingTagIds, existingNames]);

  useEffect(() => {
    if (!open) return;
  
    const compute = () => {
      // Modal uses max-height: 90vh; compute actual available px from viewport
      const dialogCap = Math.floor(window.innerHeight * 0.9);
  
      const header = headerRef.current?.offsetHeight ?? 0;
      const footer = footerRef.current?.offsetHeight ?? 0;
      const preview = previewRef.current?.offsetHeight ?? 0;
  
      // p-4 adds 16px top + 16px bottom inside the body wrapper
      const bodyPadding = 32;
  
      // A little margin between preview and results (your mt-4 = 16px)
      const gap = 16;
  
      const available = dialogCap - header - footer - preview - bodyPadding - gap;
  
      setResultsMaxH(Math.max(160, available)); // clamp to a reasonable min
    };
  
    compute();
    const ro = new ResizeObserver(compute);
    if (dialogRef.current) ro.observe(dialogRef.current);
    if (previewRef.current) ro.observe(previewRef.current);
    if (headerRef.current) ro.observe(headerRef.current);
    if (footerRef.current) ro.observe(footerRef.current);
  
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [open]);

  if (!open) return null;

  const hasSelection = selectedMatched.length > 0 || selectedNew.length > 0;
  const totalSelected = selectedMatched.length + selectedNew.length;

  const allMatchedSelected =
    matches.length > 0 && matches.every((m) => selectedMatched.some((x) => x.tagId === m.tag.id));
  
  const allNewSelected =
    nonMatched.length > 0 && nonMatched.every((n) => selectedNew.some((x) => x.name.toLowerCase() === n.name.toLowerCase()));

  const toggleAllMatched = () => {
    if (allMatchedSelected) {
      setSelectedMatched([]);
    } else {
      // build unique picks by tag id
      const picks = matches.map((m) => ({
        tagId: m.tag.id,
        name: m.tag.name,
        score: m.score,
        matchedName: m.matchedName,
      }));
      // de-dupe by tagId just in case
      const map = new Map<number, MatchedPick>();
      for (const p of picks) map.set(p.tagId, p);
      setSelectedMatched(Array.from(map.values()));
    }
  };

  const toggleAllNew = () => {
    if (allNewSelected) {
      setSelectedNew([]);
    } else {
      // build unique picks by name (case-insensitive)
      const picks = nonMatched.map((n) => ({ name: n.name, score: n.score }));
      const map = new Map<string, NewPick>();
      for (const p of picks) map.set(p.name.toLowerCase(), p);
      setSelectedNew(Array.from(map.values()));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />

      <div
        ref={dialogRef}
        className="relative z-10 w-[min(100vw-2rem,64rem)] max-w-4xl max-h-[90vh] rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl flex flex-col"
      >
        {/* Header */}
        <div ref={headerRef} className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-none">
          <h3 className="text-base font-semibold text-white">Automatic Tagger — Manual Version</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 hover:bg-zinc-800 transition"
            aria-label="Close"
          >
            <X size={16}/>  
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden p-4">
          {/* Preview at the top (fixed within body) */}
          <div ref={previewRef} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs text-zinc-400 text-center">Post Preview</div>
            <img
              src={imageUrl}
              alt="Preview"
              className="mt-2 w-full max-h-[38vh] rounded object-contain"
            />
          </div>

          {/* Results: scrollable, with measured maxHeight */}
          <div
            className="mt-4 pr-1 overflow-y-auto"
            style={{ maxHeight: resultsMaxH }}
          >
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              {loading && <div className="text-sm text-zinc-300">Querying AutoTagger Service...</div>}
              {error && <div className="text-sm text-red-300">Error: {error}</div>}

              {!loading && !error && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* LEFT: Matches */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-emerald-300">Matches on server</div>
                      <button
                        type="button"
                        onClick={toggleAllMatched}
                        disabled={matches.length === 0}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs border transition ${
                          allMatchedSelected
                            ? 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                            : 'border-emerald-800 bg-emerald-600/10 text-emerald-300 hover:bg-emerald-600/20'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {allMatchedSelected ? (
                          <>
                            <XCircle size={14} /> Deselect All
                          </>
                        ) : (
                          <>
                            <CheckCircle size={14} /> Select All
                          </>
                        )}
                      </button>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {matches.length === 0 ? (
                        <li className="text-sm text-zinc-500">None.</li>
                      ) : (
                        matches.map((m) => {
                          const selected = isMatchedSelected(m.tag.id);
                          return (
                            <li
                              key={`${m.tag.id}-${m.matchedName}`}
                              className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1"
                            >
                              <div className="min-w-0">
                                <div
                                  className="truncate font-medium flex items-center gap-1"
                                  style={{ color: m.tag.category?.color || undefined }}
                                  title={m.tag.name}
                                >
                                  {m.tag.name}
                                  {m.matchedName && m.matchedName.toLowerCase() !== m.tag.name.toLowerCase() && (
                                    <span className="text-xs text-subtle">({m.matchedName})</span>
                                  )}
                                </div>
                                <div className="truncate text-xs text-zinc-500">
                                  Confidence: {(m.score * 100).toFixed(1)}%
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  toggleMatched({
                                    tagId: m.tag.id,
                                    name: m.tag.name,
                                    score: m.score,
                                    matchedName: m.matchedName,
                                  })
                                }
                                className="ml-3 shrink-0 inline-flex items-center rounded-md p-1.5 hover:bg-zinc-800"
                                aria-label={selected ? `Remove ${m.tag.name}` : `Add ${m.tag.name}`}
                                title={selected ? 'Remove' : 'Add'}
                              >
                                {selected ? (
                                  <MinusCircle size={18} className="text-red-400" weight="fill" />
                                ) : (
                                  <PlusCircle size={18} className="text-emerald-400" weight="fill" />
                                )}
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
  
                  {/* RIGHT: Non-matched */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-amber-300">Not found on server</div>
                      <button
                        type="button"
                        onClick={toggleAllNew}
                        disabled={nonMatched.length === 0}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs border transition ${
                          allNewSelected
                            ? 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                            : 'border-emerald-800 bg-emerald-600/10 text-emerald-300 hover:bg-emerald-600/20'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {allNewSelected ? (
                          <>
                            <XCircle size={14} /> Deselect All
                          </>
                        ) : (
                          <>
                            <CheckCircle size={14} /> Select All
                          </>
                        )}
                      </button>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {nonMatched.length === 0 ? (
                        <li className="text-sm text-zinc-500">None.</li>
                      ) : (
                        nonMatched.map((n) => {
                          const selected = isNewSelected(n.name);

                          return (
                          <li
                            key={n.name}
                            className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1"
                          >
                            <div className="min-w-0">
                              <span className="block truncate text-zinc-300" title={n.name}>
                                {n.name}
                              </span>
                              <span className="block truncate text-xs text-zinc-500">
                                Confidence: {(n.score * 100).toFixed(1)}%
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleNew({ name: n.name, score: n.score })}
                              className="ml-3 shrink-0 inline-flex items-center rounded-md p-1.5 hover:bg-zinc-800"
                              aria-label={selected ? `Remove ${n.name}` : `Create & add ${n.name}`}
                              title={selected ? 'Remove' : 'Create & add'}
                            >
                              {selected ? (
                                <MinusCircle size={18} className="text-red-400" weight="fill" />
                              ) : (
                                <PlusCircle size={18} className="text-emerald-400" weight="fill" />
                              )}
                            </button>
                          </li>
                        )})
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
  
        {/* Footer */}
        <div
          ref={footerRef}
          className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800 flex-none"
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-zinc-700 px-3 py-1.5 text-sm transition text-zinc-200 hover:bg-zinc-800"
          >
            Close
          </button>

          <button
            type="button"
            disabled={!hasSelection}
            onClick={() => {
              onSave({
                matched: selectedMatched,
                create: selectedNew,
              })
              setAdding(true)
            }}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium shadow transition ${
              hasSelection
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-emerald-600/40 text-white/70 cursor-not-allowed'
            }`}
          >
            Save {totalSelected > 0 && `(${totalSelected})`}
          </button>
        </div>
      </div>
      <LoadingOverlay show={adding} label='Adding Tags...' />
    </div>
  );
}
