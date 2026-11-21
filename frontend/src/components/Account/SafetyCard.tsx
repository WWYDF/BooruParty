'use client';

import { useState } from "react";
import { EyeSlashIcon, FloppyDiskIcon, ShieldCheckIcon, ShieldIcon, ShieldWarningIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import { FullCheckbox, FullCheckboxGroup } from "@/components/UI/FullCheckbox";
import { useToast } from "@/components/UI/Toast";
import { Safety } from "@/core/types/posts";
import { AccountDetails, AccountPreferences } from "@/core/types/users";
import { AccountCard, CardActions } from "./AccountCard";
import { useSend } from "./useSend";

// What the server uses when the user has no Preferences row yet
const DEFAULT_PREFS: AccountPreferences = { blurUnsafeEmbeds: true, defaultSafety: ["SAFE"], profileBackground: null };

const SAFETY_OPTIONS: { value: Safety; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "SAFE", label: "Safe", description: "Fine for anyone.", icon: <ShieldCheckIcon size={18} /> },
  { value: "QUESTIONABLE", label: "Questionable", description: "Suggestive, but not explicit.", icon: <ShieldIcon size={18} /> },
  { value: "EXPLICIT", label: "Explicit", description: "Adult content.", icon: <ShieldWarningIcon size={18} /> },
];

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

// Safety + blur are preferences (/api/me/preferences); private is on the account (/api/me).
// One Save button sends whichever of the two actually changed.
export default function ContentCard({ me, onSaved }: {
  me: AccountDetails;
  onSaved: (updated: Partial<AccountDetails>) => void;
}) {
  const send = useSend();
  const toast = useToast();
  const saved = me.preferences ?? DEFAULT_PREFS;

  const [blur, setBlur] = useState(saved.blurUnsafeEmbeds);
  const [safety, setSafety] = useState<Safety[]>(saved.defaultSafety);
  const [isPrivate, setIsPrivate] = useState(me.private);
  const [saving, setSaving] = useState(false);

  const prefsChanged = blur !== saved.blurUnsafeEmbeds || !sameSet(safety, saved.defaultSafety);
  const privateChanged = isPrivate !== me.private;
  const dirty = prefsChanged || privateChanged;

  const save = async () => {
    if (safety.length === 0) return toast("Pick at least one safety level.", "error");

    setSaving(true);
    const updates: Partial<AccountDetails> = {};
    let failed = false;

    // PATCH semantics: only what changed
    if (prefsChanged) {
      const body: Partial<AccountPreferences> = {};
      if (blur !== saved.blurUnsafeEmbeds) body.blurUnsafeEmbeds = blur;
      if (!sameSet(safety, saved.defaultSafety)) body.defaultSafety = safety;

      const prefs = await send<AccountPreferences>("/api/me/preferences", "PATCH", body);
      if (prefs) updates.preferences = prefs;
      else failed = true;
    }

    if (privateChanged) {
      const updated = await send<AccountDetails>("/api/me", "PATCH", { private: isPrivate });
      if (updated) updates.private = updated.private;
      else failed = true;
    }

    setSaving(false);
    if (Object.keys(updates).length) onSaved(updates); // keep whatever did save, even if the other half failed
    if (!failed) toast("Preferences saved", "success"); // failures were already toasted by send()
  };

  return (
    <AccountCard title="Safety">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs text-subtle">
            Safety levels shown by default (a <code className="text-zinc-400">safety:</code> search still overrides this):
          </p>
          <FullCheckboxGroup options={SAFETY_OPTIONS} value={safety} onChange={setSafety} />
        </div>

        <FullCheckbox
          checked={blur}
          onChange={setBlur}
          icon={<ShieldIcon size={18} />}
          label="Blur spicier embeds"
          description="In comments, blur embedded posts that are more explicit than the post they're on."
        />

        <FullCheckbox
          checked={isPrivate}
          onChange={setIsPrivate}
          icon={<EyeSlashIcon size={18} />}
          label="Private account"
          description="Your account and posts are hidden from everyone. Admins can still see your old posts for moderation purposes."
        />
      </div>

      <CardActions>
        <Button size="lg" variant="success" icon={<FloppyDiskIcon size={16} />} loading={saving} disabled={!dirty} onClick={save}>
          Save preferences
        </Button>
      </CardActions>
    </AccountCard>
  );
}
