'use client';

import { useState } from "react";
import { FloppyDiskIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import { useToast } from "@/components/UI/Toast";
import { AccountDetails } from "@/core/types/users";
import { AccountCard, CardActions, Field, inputClass } from "./AccountCard";
import AvatarPicker from "./AvatarPicker";
import { useSend } from "./useSend";

// Same rules as the API's schemas
const USERNAME = /^[a-zA-Z0-9_.-]{3,32}$/;
const ABOUT_MAX = 64;

export default function ProfileCard({ me, canEditAvatar, onSaved }: {
  me: AccountDetails;
  canEditAvatar: boolean;
  onSaved: (updated: Partial<AccountDetails>) => void;
}) {
  const send = useSend();
  const toast = useToast();
  const [username, setUsername] = useState(me.username);
  const [about, setAbout] = useState(me.about ?? "");
  const [saving, setSaving] = useState(false);

  const trimmedName = username.trim();
  const trimmedAbout = about.trim() || null; // empty clears it
  const nameChanged = trimmedName !== me.username;
  const aboutChanged = trimmedAbout !== (me.about ?? null);
  const dirty = nameChanged || aboutChanged;

  const save = async () => {
    if (nameChanged && !USERNAME.test(trimmedName)) return toast("Usernames are 3-32 characters: letters, numbers, _ . and -", "error");

    // PATCH semantics: only what changed
    const body: { username?: string; about?: string | null } = {};
    if (nameChanged) body.username = trimmedName;
    if (aboutChanged) body.about = trimmedAbout;

    setSaving(true);
    const updated = await send<AccountDetails>("/api/me", "PATCH", body);
    setSaving(false);
    if (!updated) return;

    setAbout(updated.about ?? "");
    onSaved({ username: updated.username, about: updated.about });
    toast("Profile saved", "success");
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

        <Field label="About me" hint={`${about.length}/${ABOUT_MAX}`}>
          <input
            type="text"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            maxLength={ABOUT_MAX}
            placeholder="A short line about yourself"
            className={inputClass}
          />
        </Field>

        <CardActions>
          <Button type="submit" size="lg" variant="success" icon={<FloppyDiskIcon size={16} />} loading={saving} disabled={!dirty}>
            Save profile
          </Button>
        </CardActions>
      </form>
    </AccountCard>
  );
}
