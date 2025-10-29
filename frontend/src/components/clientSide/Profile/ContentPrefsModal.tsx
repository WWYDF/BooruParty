'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { updateUser } from '@/components/serverSide/Users/updateUser';
import { useToast } from '@/components/clientSide/Toast';
import { UserSelf } from '@/core/types/users';
import { SafetyType } from '@prisma/client';
import { Tag } from '@/core/types/tags';
import TagSelector from '../TagSelector';
import SwitchIOS from '../SwitchIOS';
import { checkPermissions } from '@/core/permissions';

type Props = {
  user: UserSelf;
  open: boolean;
  onClose: () => void;
};

export default function ContentPrefsModal({ user, open, onClose }: Props) {
  const [blurUnsafeEmbeds, setBlurUnsafeEmbeds] = useState(true);
  const [defaultSafety, setDefaultSafety] = useState<SafetyType[]>(['SAFE']);
  const [blacklistedTags, setBlacklistedTags] = useState<Tag[]>([]);
  const [favoriteTags, setFavoriteTags] = useState<Tag[]>([]);
  const [profileBackground, setProfileBackground] = useState<number>(0);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [canChangeBG, setCanChangeBG] = useState(false);
  const [saving, setSaving] = useState(false);

  const toast = useToast();
  const firstFocusRef = useRef<HTMLInputElement | HTMLButtonElement | null>(null);

  // Load initial values/permissions on open
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const bgPerm = (await checkPermissions(['profile_edit_background']))['profile_edit_background'];
        setCanChangeBG(bgPerm);
        setBlurUnsafeEmbeds(user.preferences?.blurUnsafeEmbeds ?? true);
        setDefaultSafety(user.preferences?.defaultSafety ?? (['SAFE'] as SafetyType[]));
        setBlacklistedTags(user.preferences?.blacklistedTags ?? []);
        setFavoriteTags(user.preferences?.favoriteTags ?? []);
        setProfileBackground(user.preferences?.profileBackground ?? 0);
        setPrivateProfile(user.preferences?.private ?? false);
      } catch {
        toast('Could not load safety settings', 'error');
      }
    })();
  }, [open, user.preferences, toast]);

  // ESC to close, scroll lock, initial focus
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent | KeyboardEventInit | any) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey as any);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => firstFocusRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey as any);
    };
  }, [open, onClose]);

  const save = async () => {
    try {
      setSaving(true);
      await updateUser(user.username, {
        blurUnsafeEmbeds,
        defaultSafety,
        blacklistedTags: blacklistedTags.map((t) => t.id),
        favoriteTags: favoriteTags.map((t) => t.id),
        profileBackground: Number(profileBackground),
        privateProfile,
      });
      toast('Safety Settings Saved!', 'success');
      onClose();
    } catch (err: any) {
      toast(err?.message ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleSafety = (level: SafetyType) =>
    setDefaultSafety((prev) =>
      prev.includes(level) ? prev.filter((s) => s !== level) : [...prev, level],
    );

  const removeBlacklist = (id: number) => setBlacklistedTags((prev) => prev.filter((t) => t.id !== id));
  const removeFavorite = (id: number) => setFavoriteTags((prev) => prev.filter((t) => t.id !== id));

  // Safety pill
  const SafetyPill = ({ level }: { level: SafetyType }) => {
    const active = defaultSafety.includes(level);
    return (
      <button
        onClick={() => toggleSafety(level)}
        className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition
        ${active ? 'border-darkerAccent bg-accent/10 text-accent' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'}`}
      >
        {level}
      </button>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {/* Title */}
            <div className="border-b border-zinc-800 px-5 py-4">
              <h3 className="text-lg font-semibold">Content Preferences</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Saved to your account in our database.
              </p>
            </div>

            {/* Body */}
            <div className="max-h-[70vh] overflow-auto px-5 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Profile Visibility */}
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <h4 className="mb-1 font-medium">Profile Visibility</h4>
                  <p className="mb-3 text-xs text-zinc-400">
                    Should others be able to view your profile?
                  </p>
                  <SwitchIOS
                    checked={privateProfile}
                    onChange={setPrivateProfile}
                    label={privateProfile ? 'Private Profile: Enabled' : 'Private Profile: Disabled'}
                    className="rounded-xl bg-zinc-900/30 py-2"
                  />
                </section>

                {/* Embeds */}
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <h4 className="mb-1 font-medium">Post Embedding</h4>
                  <p className="mb-3 text-xs text-zinc-400">
                    Blur UNSAFE comment embeds inside SAFE posts.
                  </p>
                  <SwitchIOS
                    checked={blurUnsafeEmbeds}
                    onChange={setBlurUnsafeEmbeds}
                    label={blurUnsafeEmbeds ? 'Blur Unsafe Embeds: On' : 'Blur Unsafe Embeds: Off'}
                    className="rounded-xl bg-zinc-900/30 py-2"
                  />
                </section>

                {/* Safety */}
                <section className="md:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <h4 className="mb-1 font-medium">Default Safety</h4>
                  <p className="mb-3 text-xs text-zinc-400">
                    Choose which ratings are shown by default in search.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(['SAFE', 'SKETCHY', 'UNSAFE'] as const).map((lvl) => (
                      <motion.div key={lvl} layout>
                        <SafetyPill level={lvl} />
                      </motion.div>
                    ))}
                  </div>
                </section>

                {/* Profile background (permission-gated) */}
                {canChangeBG && (
                  <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                    <h4 className="mb-1 font-medium">Profile Background</h4>
                    <p className="mb-3 text-xs text-zinc-400">
                      Use a post ID as your profile backdrop. Set to <span className="text-zinc-300">0</span> to clear.
                    </p>
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      step={1}
                      value={profileBackground}
                      onChange={(e) => setProfileBackground(Number(e.target.value))}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-700"
                    />
                  </section>
                )}

                {/* Tags */}
                <section className="md:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <h4 className="mb-1 font-medium">Tags</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Blacklist */}
                    <div>
                      <div className="mb-2 text-sm text-zinc-300">Blacklisted Tags</div>
                      <TagSelector
                        onSelect={(tag) => {
                          if (!blacklistedTags.find((t) => t.id === tag.id)) {
                            setBlacklistedTags((prev) => [...prev, tag]);
                          }
                        }}
                        disabledTags={blacklistedTags}
                        placeholder="Search tags…"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {blacklistedTags.map((tag) => (
                          <motion.div
                            key={tag.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                          >
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: tag.category.color }}
                            />
                            <span>{tag.name}</span>
                            <button
                              onClick={() => removeBlacklist(tag.id)}
                              className="cursor-pointer pl-1 text-red-400 hover:text-red-200"
                              aria-label={`Remove ${tag.name}`}
                              title="Remove"
                            >
                              ×
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Favorites */}
                    <div>
                      <div className="mb-2 text-sm text-zinc-300">Favorite Tags (shows on profile)</div>
                      <TagSelector
                        onSelect={(tag) => {
                          if (favoriteTags.length >= 10) {
                            toast('You can only have up to 10 favorite tags.', 'error');
                            return;
                          }
                          if (!favoriteTags.find((t) => t.id === tag.id)) {
                            setFavoriteTags((prev) => [...prev, tag]);
                          }
                        }}
                        disabledTags={favoriteTags}
                        placeholder="Search tags…"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {favoriteTags.map((tag) => (
                          <motion.div
                            key={tag.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                          >
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: tag.category.color }}
                            />
                            <span>{tag.name}</span>
                            <button
                              onClick={() => removeFavorite(tag.id)}
                              className="cursor-pointer pl-1 text-red-400 hover:text-red-200"
                              aria-label={`Remove ${tag.name}`}
                              title="Remove"
                            >
                              ×
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-4">
              <button
                onClick={onClose}
                className="cursor-pointer rounded px-4 py-2 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <motion.button
                onClick={save}
                disabled={saving}
                whileTap={{ scale: 0.98 }}
                className="cursor-pointer rounded bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-600/90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
