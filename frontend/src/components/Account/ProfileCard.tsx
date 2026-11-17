'use client';

import { useState } from "react";
import { FloppyDiskIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import { useToast } from "@/components/UI/Toast";
import { AccountDetails } from "@/core/types/users";
import { AccountCard, CardActions, Field, inputClass } from "./AccountCard";
import AvatarPicker from "./AvatarPicker";
import { useSend } from "./useSend";

// Same rule as the API's usernameSchema
const USERNAME = /^[a-zA-Z0-9_.-]{3,32}$/;

export default function ProfileCard({ me, canEditAvatar, onSaved }: {
  me: AccountDetails;
  canEditAvatar: boolean;
  onSaved: (updated: Partial<AccountDetails>) => void;
}) {
  const send = useSend();
  const toast = useToast();
  const [username, setUsername] = useState(me.username);
  const [saving, setSaving] = useState(false);

  const trimmed = username.trim();
  const dirty = trimmed !== me.username;

  const save = async () => {
    if (!USERNAME.test(trimmed)) return toast("Usernames are 3-32 characters: letters, numbers, _ . and -", "error");
    setSaving(true);
    const updated = await send<AccountDetails>("/api/me", "PATCH", { username: trimmed });
    setSaving(false);
    if (!updated) return;
    onSaved({ username: updated.username });
    toast("Username changed", "success");
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

        {/* No description field on User yet */}
        <Field label="About me" hint="Coming soon.">
          <textarea rows={3} disabled placeholder="Tell people a bit about yourself..." className={`${inputClass} resize-none`} />
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
