'use client';

import { updateUser } from '@/components/serverSide/Users/updateUser';
import { useEffect, useState } from 'react';
import { useToast } from '../Toast';
import { UserSelf } from '@/core/types/users';
import { SafetyType } from '@prisma/client';
import { Tag } from '@/core/types/tags';
import TagSelector from '../TagSelector';
import { checkPermissions } from '@/core/permissions';

export default function ContentForm({ user }: { user: UserSelf }) {
  const [blurUnsafeEmbeds, setBlurUnsafeEmbeds] = useState(true);
  const [defaultSafety, setDefaultSafety] = useState<SafetyType[]>(['SAFE']);
  const [blacklistedTags, setBlacklistedTags] = useState<Tag[]>([]);
  const [profileBackground, setProfileBackground] = useState<number>(0);
  const [canChangeBG, setCanChangeBG] = useState<boolean>(false);
  const [privateProfile, setPrivateProfile] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const bgPerms = (await checkPermissions(['profile_edit_background']))['profile_edit_background'];
        setCanChangeBG(bgPerms)
        setBlurUnsafeEmbeds(user.preferences?.blurUnsafeEmbeds ?? true);
        setDefaultSafety(user.preferences?.defaultSafety ?? ['SAFE']);
        setBlacklistedTags(user.preferences?.blacklistedTags ?? []);;
        setProfileBackground(user.preferences?.profileBackground ?? 0)
        setPrivateProfile(user.preferences?.private ?? false)
      } catch (err) {
        toast('Could not load safety settings', 'error');
      }
    })();
  }, []);

  const save = async () => {
    try {
      await updateUser(user.username, { blurUnsafeEmbeds, defaultSafety, blacklistedTags: blacklistedTags.map((tag) => tag.id), profileBackground: Number(profileBackground), privateProfile});
      toast('Safety Settings Saved!', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const removeTag = (id: number) => {
    setBlacklistedTags((prev) => prev.filter((tag) => tag.id !== id));
  };

  return (
    <section className="bg-secondary p-4 rounded-2xl shadow space-y-4">
    <div className='mb-4'>
      <h2 className="text-xl font-semibold">Content Preferences</h2>
      <p className='mt-1 text-sm text-subtle'>These settings are saved in our database. (Not browser-specific)</p>
    </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <p className='text-xs text-subtle ital'>Blurs NSFW comments</p>
        </div>
        
        {canChangeBG && (
          <div className="flex-1">
            <label className="block mb-1 text-subtle">Profile BG Post #</label>
            <input
              type='number'
              value={profileBackground}
              onChange={(e) => setProfileBackground(Number(e.target.value))}
              className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
              min={1}
              max={100_000}
              step={1}
            />
            <p className='text-xs text-subtle'>Set to 0 to clear</p>
          </div>
        )}

        <div className="flex-1">
          <label className="block mb-1 text-subtle">Private Profile</label>
          <select
            value={privateProfile.toString()}
            onChange={(e) => setPrivateProfile(e.target.value === 'true')}
            className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
          <p className='text-xs text-subtle ital'>Hides your profile from others</p>
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

        <div className="flex-1 pb-2">
          <label className="block mb-1 text-subtle">Default Safety</label>
          <div className="space-y-1">
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
      </div>

      <button
        onClick={save}
        className="bg-darkerAccent hover:bg-darkerAccent/80 transition text-white px-4 py-2 rounded"
      >
        Save
      </button>
    </section>
  );
}
