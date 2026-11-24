'use client';

import { useState } from "react";
import { KeyIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import { useToast } from "@/components/UI/Toast";
import { AccountCard, CardActions, Field, inputClass } from "./AccountCard";
import { useSend } from "@/core/api";

// Same limits as the API's passwordSchema (72 bytes is bcrypt's cap)
const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72;

export default function PasswordCard() {
  const send = useSend();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const ready = Boolean(currentPassword && password && confirm);
  const mismatch = confirm.length > 0 && password !== confirm;

  const save = async () => {
    if (password.length < PASSWORD_MIN) return toast(`New password must be at least ${PASSWORD_MIN} characters.`, "error");
    if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return toast("New password is too long.", "error");
    if (password !== confirm) return toast("The new passwords don't match.", "error");
    setSaving(true);
    const updated = await send("/api/me", "PATCH", { password, currentPassword });
    setSaving(false);
    if (!updated) return;
    setCurrentPassword("");
    setPassword("");
    setConfirm("");
    toast("Password changed. Other devices have been logged out.", "success");
  };

  return (
    <AccountCard title="Password" description="Changing it logs you out everywhere else.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (ready) save(); }}>
        <Field label="Current password">
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" hint={`At least ${PASSWORD_MIN} characters.`}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
          </Field>
          <Field label="Confirm new password" hint={mismatch ? <span className="text-red-400">Doesn&apos;t match.</span> : undefined}>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={inputClass} />
          </Field>
        </div>
        <CardActions>
          <Button type="submit" size="lg" variant="success" icon={<KeyIcon size={16} />} loading={saving} disabled={!ready || mismatch}>
            Change password
          </Button>
        </CardActions>
      </form>
    </AccountCard>
  );
}
