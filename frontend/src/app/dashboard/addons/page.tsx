'use client';

import ArtistProfileSection from '@/components/clientSide/Dashboard/ConfigArtists';
import AutoTaggerSection from '@/components/clientSide/Dashboard/ConfigTagger';
import LoadingOverlay from '@/components/clientSide/LoadingOverlay';
import { useToast } from '@/components/clientSide/Toast';
import { AutotagMode, AddonState } from '@/core/types/dashboard';
import { useEffect, useRef, useState } from 'react';

export default function AdminModulesPage() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<AddonState>({
    artistProfile: { enabled: false },
    autotagger: { enabled: false, url: '', mode: 'PASSIVE' },
  });
  const toast = useToast();

  // snapshot of last-loaded-from-server values
  const originalRef = useRef<AddonState | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/addons', { cache: 'no-store' });
        if (!res.ok) toast(`Error fetching addon settings! ${res.status}`, 'error');

        const data = await res.json();
        const hydrated: AddonState = {
          artistProfile: { enabled: !!data?.artistProfile?.enabled },
          autotagger: {
            enabled: !!data?.autotagger?.enabled,
            url: String(data?.autotagger?.url ?? ''),
            mode: (data?.autotagger?.mode ?? 'PASSIVE') as AutotagMode,
          },
        };

        if (!cancelled) {
          setState(hydrated);
          originalRef.current = hydrated;
        }
      } catch (e: any) {
        console.error('Something went wrong!', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const isAutotagUrlValid =
    !state.autotagger.enabled || /^https?:\/\/.+/i.test(state.autotagger.url.trim());

  const toggleArtist = () =>
    setState(s => ({ ...s, artistProfile: { ...s.artistProfile, enabled: !s.artistProfile.enabled } }));

  const toggleAutotagger = () =>
    setState(s => ({ ...s, autotagger: { ...s.autotagger, enabled: !s.autotagger.enabled } }));

  const setAutotagUrl = (url: string) =>
    setState(s => ({ ...s, autotagger: { ...s.autotagger, url } }));

  const setAutotagMode = (mode: AutotagMode) =>
    setState(s => ({ ...s, autotagger: { ...s.autotagger, mode } }));

  const handleSave = async () => {
    try {
      const payload = {
        artistProfileEnabled: state.artistProfile.enabled,
        autotagger: {
          enabled: state.autotagger.enabled,
          // API clears URL when disabled; send null in that case
          url: state.autotagger.enabled ? (state.autotagger.url || null) : null,
          mode: state.autotagger.mode, // 'PASSIVE' | 'AGGRESSIVE'
        },
      };

      const res = await fetch('/api/addons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const jayson = await res.json().catch(() => ({}));
        toast(`Error while saving! ${jayson?.error}`, 'error');
        throw new Error(jayson?.error || `PUT /api/addons → ${res.status}`);
      }

      const jayson = await res.json();

      // reflect server truth (in case it normalized anything)
      const serverState: AddonState = {
        artistProfile: { enabled: !!jayson?.addons?.artistProfile?.enabled },
        autotagger: {
          enabled: !!jayson?.addons?.autotagger?.enabled,
          url: String(jayson?.addons?.autotagger?.url ?? ''),
          mode: (jayson?.addons?.autotagger?.mode ?? 'PASSIVE') as AutotagMode,
        },
      };

      setState(serverState);
      originalRef.current = serverState;
      toast(`Settings Saved!`, 'success');
    } catch (e) {
      console.error('Something went wrong!', e);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Modules / Addons</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Enable extra features and manage how they behave.
        </p>
      </header>

      <div className="space-y-6">
        <ArtistProfileSection
          enabled={state.artistProfile.enabled}
          onToggle={toggleArtist}
        />

        <AutoTaggerSection
          enabled={state.autotagger.enabled}
          url={state.autotagger.url}
          mode={state.autotagger.mode}
          onToggle={toggleAutotagger}
          onChangeUrl={setAutotagUrl}
          onChangeMode={setAutotagMode}
          urlInvalid={!isAutotagUrlValid}
        />
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          type="button"
          className="rounded-xl border border-zinc-700 transition bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          onClick={() => window.location.reload()}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={state.autotagger.enabled && !isAutotagUrlValid}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold transition text-white shadow hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save changes
        </button>
      </div>
      <LoadingOverlay show={loading} label='Loading Addons...' />
    </main>
  );
}
