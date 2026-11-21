'use client';

import { useState } from "react";
import { FloppyDiskIcon, StarIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import { useToast } from "@/components/UI/Toast";
import { UserTagLists } from "@/core/types/tags";
import { TagChip } from "@/core/types/uploads";
import { AccountDetails, AccountPreferences } from "@/core/types/users";
import { AccountCard, CardActions, Field, inputClass } from "./AccountCard";
import AvatarPicker from "./AvatarPicker";
import TagListField, { sameNames, toChip } from "./TagListField";
import { useSend } from "./useSend";

// Same rules as the API's schemas
const USERNAME = /^[a-zA-Z0-9_.-]{3,32}$/;
const ABOUT_MAX = 64;

// Username + about live on the account (/api/me), the background is a preference (/api/me/preferences),
// favorite tags are their own list (/api/me/tags/favorites). One Save button sends whichever actually changed.
export default function ProfileCard({ me, canEditAvatar, canChangeBackground, tagLists, onSaved, onTagListsSaved }: {
  me: AccountDetails;
  canEditAvatar: boolean;
  canChangeBackground: boolean;
  tagLists: UserTagLists | null; // null = couldn't be loaded (the picker says so)
  onSaved: (updated: Partial<AccountDetails>) => void;
  onTagListsSaved: (lists: UserTagLists) => void;
}) {
  const send = useSend();
  const toast = useToast();
  const savedBackground = me.preferences?.profileBackground ?? null;

  const [username, setUsername] = useState(me.username);
  const [about, setAbout] = useState(me.about ?? "");
  const [background, setBackground] = useState(savedBackground ? String(savedBackground) : "");
  const [favorites, setFavorites] = useState<TagChip[]>(tagLists?.favorites.map(toChip) ?? []);
  const [saving, setSaving] = useState(false);

  const trimmedName = username.trim();
  const trimmedAbout = about.trim() || null; // empty clears it
  const backgroundId = background.trim() ? Number(background) : null;

  const nameChanged = trimmedName !== me.username;
  const aboutChanged = trimmedAbout !== (me.about ?? null);
  const backgroundChanged = canChangeBackground && backgroundId !== savedBackground;
  const favoritesChanged = !!tagLists && !sameNames(favorites, tagLists.favorites.map(toChip));
  const dirty = nameChanged || aboutChanged || backgroundChanged || favoritesChanged;

  const save = async () => {
    if (nameChanged && !USERNAME.test(trimmedName)) return toast("Usernames are 3-32 characters: letters, numbers, _ . and -", "error");
    if (backgroundChanged && backgroundId !== null && (!Number.isInteger(backgroundId) || backgroundId < 1)) {
      return toast("The background must be a post ID.", "error");
    }

    setSaving(true);
    const updates: Partial<AccountDetails> = {};
    let failed = false;

    // PATCH semantics: only what changed
    if (nameChanged || aboutChanged) {
      const body: { username?: string; about?: string | null } = {};
      if (nameChanged) body.username = trimmedName;
      if (aboutChanged) body.about = trimmedAbout;

      const updated = await send<AccountDetails>("/api/me", "PATCH", body);
      if (updated) {
        setAbout(updated.about ?? "");
        updates.username = updated.username;
        updates.about = updated.about;
      } else failed = true;
    }

    if (backgroundChanged) {
      const prefs = await send<AccountPreferences>("/api/me/preferences", "PATCH", { profileBackground: backgroundId });
      if (prefs) updates.preferences = prefs;
      else failed = true;
    }

    if (favoritesChanged) {
      const lists = await send<UserTagLists>("/api/me/tags/favorites", "PUT", { names: favorites.map((t) => t.name) });
      if (lists) {
        setFavorites(lists.favorites.map(toChip)); // the server's version: aliases resolved, sorted
        onTagListsSaved(lists);
      } else failed = true;
    }

    setSaving(false);
    if (Object.keys(updates).length) onSaved(updates); // keep whatever did save, even if another part failed
    if (!failed) toast("Profile saved", "success"); // failures were already toasted by send()
  };

  return (
    <AccountCard title="Profile" description="How other people see you around the site.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (dirty) save(); }}>
        <AvatarPicker avatar={me.avatar ?? null} canEdit={canEditAvatar} onChange={(avatar) => onSaved({ avatar })} />

        <Field label="Username" hint="3-32 characters: letters, numbers, _ . and -">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={32}
            autoComplete="username"
            spellCheck={false}
            className={inputClass}
          />
        </Field>

        <Field label="About me" counter={{ value: about.length, max: ABOUT_MAX }}>
          <input
            type="text"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            maxLength={ABOUT_MAX}
            placeholder="A short line about yourself"
            className={inputClass}
          />
        </Field>

        {canChangeBackground && (
          <Field label="Profile background" hint="A post ID to use as your profile's backdrop. Leave empty for none.">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="None"
              className={inputClass}
            />
          </Field>
        )}

        <TagListField
          label="Favorite tags"
          description="Shown on your profile, grouped by category."
          value={favorites}
          onChange={setFavorites}
          max={tagLists?.limits.favorites ?? null}
          blocked={tagLists?.blacklist.map((t) => t.name) ?? []}
          blockedLabel="blacklist"
          offText="Favorite tags are turned off on this site."
          placeholder="Add a favorite tag..."
          disabled={saving}
          flip={true} /* show description below textbox instead (to match other Profile inputs) */
        />

        <CardActions>
          <Button type="submit" size="lg" variant="success" icon={<FloppyDiskIcon size={16} />} loading={saving} disabled={!dirty}>
            Save profile
          </Button>
        </CardActions>
      </form>
    </AccountCard>
  );
}
