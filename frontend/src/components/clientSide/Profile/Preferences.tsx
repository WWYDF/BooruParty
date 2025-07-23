'use client';

import { updateUser } from '@/components/serverSide/Users/updateUser';
import { useEffect, useState } from 'react';
import { useToast } from '../Toast';
import { UserSelf } from '@/core/types/users';
import { SafetyType } from '@prisma/client';
import { Tag } from '@/core/types/tags';
import TagSelector from '../TagSelector';

export default function PreferencesForm({ user }: { user: UserSelf }) {
  const [layout, setLayout] = useState<'GRID' | 'COLLAGE'>('GRID');
  const [theme, setTheme] = useState<'DARK' | 'LIGHT'>('DARK');
  const [postsPerPage, setPPP] = useState<number>(30);
  const [blurUnsafeEmbeds, setBlurUnsafeEmbeds] = useState(true);
  const [defaultSafety, setDefaultSafety] = useState<SafetyType[]>(['SAFE']);
  const [blacklistedTags, setBlacklistedTags] = useState<Tag[]>([]);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        setLayout(user.preferences?.layout || 'GRID');
        setTheme(user.preferences?.theme || 'DARK');
        setPPP(user.preferences?.postsPerPage || 30);
        setBlurUnsafeEmbeds(user.preferences?.blurUnsafeEmbeds ?? true);
        setDefaultSafety(user.preferences?.defaultSafety ?? ['SAFE']);
        setBlacklistedTags(user.preferences?.blacklistedTags ?? []);;
      } catch (err) {
        toast('Could not load preferences', 'error');
      }
    })();
  }, []);

  const save = async () => {
    try {
      await updateUser(user.username, { layout, theme, postsPerPage, blurUnsafeEmbeds, defaultSafety, blacklistedTags: blacklistedTags.map((tag) => tag.id), });
      toast('Preferences Saved!', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const removeTag = (id: number) => {
    setBlacklistedTags((prev) => prev.filter((tag) => tag.id !== id));
  };

  return (
    <section className="bg-secondary p-4 rounded-2xl shadow space-y-4">
      <h2 className="text-xl font-semibold">Preferences</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <label className="block mb-1 text-subtle">Blur Unsafe Embeds</label>
          <select
            value={blurUnsafeEmbeds.toString()}
            onChange={(e) => setBlurUnsafeEmbeds(e.target.value === 'true')}
            className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="block mb-1 text-subtle">Default Safety</label>
          <div className="space-y-2">
            {(['SAFE', 'SKETCHY', 'UNSAFE'] as const).map((level) => (
              <label key={level} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={defaultSafety.includes(level)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDefaultSafety([...defaultSafety, level]);
                    } else {
                      setDefaultSafety(defaultSafety.filter((s) => s !== level));
                    }
                  }}
                  className="accent-accent bg-zinc-800 rounded border-zinc-700"
                />
                <span className="text-white">{level}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <label className="block mb-1 text-subtle">Blacklisted Tags</label>

          <div className="space-y-2">
            <TagSelector
              onSelect={(tag) => {
                if (!blacklistedTags.find((t) => t.id === tag.id)) {
                  setBlacklistedTags((prev) => [...prev, tag]);
                }
              }}
              disabledTags={blacklistedTags}
              placeholder="Search tags..."
            />

            <div className="flex flex-wrap gap-2">
              {blacklistedTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-1 bg-zinc-800 text-sm px-2 py-1 rounded-full"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: tag.category.color }}
                  />
                  <span>{tag.name}</span>
                  <button
                    onClick={() => removeTag(tag.id)}
                    className="text-red-400 hover:text-red-200 ml-1"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button onClick={save} className="bg-darkerAccent hover:bg-darkerAccent/80 transition text-white px-4 py-2 rounded">Save Preferences</button>
    </section>
  );
}
