'use client';

import { getCurrentUser } from '@/components/serverSide/Users/getCurrentUser';
import { updateUser } from '@/components/serverSide/Users/updateUser';
import { useEffect, useState } from 'react';

export default function PreferencesForm() {
    const [layout, setLayout] = useState<'GRID' | 'COLLAGE'>('GRID');
    const [theme, setTheme] = useState<'DARK' | 'LIGHT'>('DARK');
    const [status, setStatus] = useState('');
  
    useEffect(() => {
      (async () => {
        try {
          const user = await getCurrentUser();
          setLayout(user.preferences?.layout || 'GRID');
          setTheme(user.preferences?.theme || 'DARK');
        } catch (err) {
          setStatus('Could not load preferences');
        }
      })();
    }, []);
  
    const save = async () => {
      setStatus('Saving...');
      try {
        await updateUser({ layout, theme });
        setStatus('Preferences saved ✅');
      } catch (err: any) {
        setStatus(err.message);
      }
    };

    return (
        <section className="bg-secondary p-4 rounded-2xl shadow space-y-4">
        <h2 className="text-xl font-semibold">Preferences</h2>

        <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
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
            <label className="block mb-1 text-subtle">Theme</label>
            <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'DARK' | 'LIGHT')}
                className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
            >
                <option value="DARK">Dark</option>
                <option value="LIGHT">Light</option>
            </select>
            </div>
        </div>

        <button onClick={save} className="bg-darkerAccent text-white px-4 py-2 rounded">Save Preferences</button>
        <p className="text-sm text-subtle">{status}</p>
        </section>
    );
}
