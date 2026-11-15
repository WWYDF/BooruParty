'use client';

import { useState } from 'react';
import FadeIn from '../Motion/FadeIn';
import { CheckIcon } from '@phosphor-icons/react';
import { useToast } from '../Toast';

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (sec > 0 || parts.length === 0) parts.push(`${sec}s`);
  return parts.join(' ');
}

export default function BoostCooldown({ initialValue }: { initialValue: number }) {
  const [value, setValue] = useState(String(initialValue));
  const [savedValue, setSavedValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const seconds = parseInt(value, 10);
  const isValid = !isNaN(seconds) && seconds >= 0;
  const isDirty = isValid && seconds !== savedValue;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/system/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boostCooldown: seconds }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `Request failed with status ${res.status}`);
      }

      toast("Saved", 'success');
      setSavedValue(seconds);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn>
      <div className="bg-secondary border border-secondary-border p-6 rounded-2xl shadow w-full">
        <h2 className="text-xl font-semibold mb-2">Boost Cooldown</h2>
        <p className="text-sm text-subtle mb-4">
          How long a user must wait before they can boost again, in seconds.
        </p>

        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            className="w-36 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-zinc-500"
          />
          {isValid && (
            <span className="text-xs text-subtle font-mono">= {formatSeconds(seconds)}</span>
          )}
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 transition bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 ml-auto"
            >
              <CheckIcon size={18} />
              <span>Save</span>
            </button>
          )}
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-400">{error}</div>
        )}
      </div>
    </FadeIn>
  );
}
