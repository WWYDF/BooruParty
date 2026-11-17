'use client';

import { useState } from "react";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import { useToast } from "@/components/UI/Toast";
import { AccountDetails } from "@/core/types/users";
import { AccountCard, CardActions, Field, inputClass } from "./AccountCard";
import { useSend } from "./useSend";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailCard({ me, onSaved }: { me: AccountDetails; onSaved: (updated: Partial<AccountDetails>) => void }) {
  const send = useSend();
  const toast = useToast();
  const [email, setEmail] = useState(me.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const trimmed = email.trim().toLowerCase();
  const dirty = trimmed !== me.email.toLowerCase();

  const save = async () => {
    if (!EMAIL.test(trimmed)) return toast("That doesn't look like an email address.", "error");
    if (!currentPassword) return toast("Enter your current password to change your email.", "error");
    setSaving(true);
    const updated = await send<AccountDetails>("/api/me", "PATCH", { email: trimmed, currentPassword });
    setSaving(false);
    if (!updated) return;
    setCurrentPassword("");
    onSaved({ email: updated.email });
    toast("Email changed", "success");
  };

  return (
    <AccountCard title="Email" description="Never shown publicly.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (dirty) save(); }}>
        <Field label="Email address">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            autoComplete="email"
            className={inputClass}
          />
        </Field>

        {/* The API only asks for it once the address actually changes */}
        {dirty && (
          <Field label="Current password" hint="Needed to confirm it's you.">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className={inputClass}
            />
          </Field>
        )}

        <CardActions>
          <Button type="submit" size="lg" variant="success" icon={<EnvelopeSimpleIcon size={16} />} loading={saving} disabled={!dirty}>
            Change email
          </Button>
        </CardActions>
      </form>
    </AccountCard>
  );
}
