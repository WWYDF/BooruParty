'use client';

import { useEffect, useState } from 'react';
import { useToast } from '../Toast';
import { UserSelf } from '@/core/types/users';

const LS_KEY = 'browserPreferences';

export default function PreferencesForm({ user }: { user: UserSelf }) {
  const [layout, setLayout] = useState<'GRID' | 'COLLAGE'>('GRID');
  const [theme, setTheme] = useState<'DARK' | 'LIGHT'>('DARK');
  const [postsPerPage, setPPP] = useState<number>(30);
  const [flipNavigators, setFlipNavigators] = useState(false);
  const toast = useToast();

  // Load saved preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
      if (saved) {
        const p = JSON.parse(saved) as {
          layout?: 'GRID' | 'COLLAGE';
          theme?: 'DARK' | 'LIGHT';
          postsPerPage?: number;
          flipNavigators?: boolean;
        };
        if (p.layout) setLayout(p.layout);
        if (p.theme) setTheme(p.theme);
        if (typeof p.postsPerPage === 'number') setPPP(p.postsPerPage);
        if (typeof p.flipNavigators === 'boolean') setFlipNavigators(p.flipNavigators);
      }
    } catch {
      toast('Could not load preferences', 'error');
    }
  }, [toast]);

  // Save ONLY when clicking the button
  const save = async () => {
    try {
      const payload = { layout, theme, postsPerPage, flipNavigators };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
      toast('Preferences Saved!', 'success');
    } catch (err: any) {
      toast(err?.message ?? 'Failed to save preferences', 'error');
    }
  };

  return (
    <section className="bg-secondary p-4 rounded-2xl shadow">
      <h2 className="text-xl font-semibold">Browser Preferences</h2>
      <p className='mt-1 text-sm text-subtle'>These settings are browser specific.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 space-y-4">
        
        <div className="flex-1 my-4">
          <label className="block mb-1 text-subtle">Layout</label>
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as 'GRID' | 'COLLAGE')}
            className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
          >
            <option value="GRID">Grid</option>
            <option value="COLLAGE">Collage</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block mb-1 text-subtle">Posts Per Page</label>
          <input
            type="number"
            value={postsPerPage}
            onChange={(e) => setPPP(Number(e.target.value))}
            className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
            min={1}
            max={100}
            step={1}
          />
        </div>

        <div className="flex-1">
          <label className="block mb-1 text-subtle">Flip Navigation Buttons</label>
          <select
            value={flipNavigators.toString()}
            onChange={(e) => setFlipNavigators(e.target.value === 'true')}
            className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
          >
            <option value="false">Disabled</option>
            <option value="true">Enabled</option>
          </select>
        </div>
      </div>

      <button
        onClick={save}
        className="bg-darkerAccent hover:bg-darkerAccent/80 transition text-white px-4 py-2 rounded"
      >
        Save Preferences
      </button>
    </section>
  );
}
