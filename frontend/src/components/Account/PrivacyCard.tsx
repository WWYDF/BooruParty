'use client';

import { useRef, useState } from "react";
import { EyeSlashIcon } from "@phosphor-icons/react";
import { FullCheckbox } from "@/components/UI/FullCheckbox";
import { useToast } from "@/components/UI/Toast";
import { AccountDetails } from "@/core/types/users";
import { AccountCard } from "./AccountCard";
import { useSend } from "./useSend";

export default function PrivacyCard({ me, onSaved }: { me: AccountDetails; onSaved: (updated: Partial<AccountDetails>) => void }) {
  const send = useSend();
  const toast = useToast();
  // Optimistic: flips on click instead of waiting for the server (and doesn't dim via `disabled` meanwhile)
  const [isPrivate, setIsPrivate] = useState(me.private);
  const saving = useRef(false);

  const toggle = async (value: boolean) => {
    if (saving.current) return;
    saving.current = true;
    setIsPrivate(value);

    const updated = await send<AccountDetails>("/api/me", "PATCH", { private: value });
    saving.current = false;

    if (!updated) return setIsPrivate(!value); // already toasted, put it back
    onSaved({ private: updated.private });
    toast(updated.private ? "Your account is now private" : "Your account is now public", "success");
  };

  return (
    <AccountCard title="Privacy" description="Changes apply immediately.">
      <FullCheckbox
        checked={isPrivate}
        onChange={toggle}
        icon={<EyeSlashIcon size={18} />}
        label="Private account"
        description="Your account and posts are instantly hidden from everyone. Admins can still see your posts for moderation purposes."
      />
    </AccountCard>
  );
}
