'use client';

import { useState } from "react";
import { FloppyDiskIcon, ShieldCheckIcon, ShieldIcon, ShieldWarningIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import { FullCheckbox, FullCheckboxGroup } from "@/components/UI/FullCheckbox";
import { useToast } from "@/components/UI/Toast";
import { Safety } from "@/core/types/posts";
import { AccountDetails, AccountPreferences } from "@/core/types/users";
import { AccountCard, CardActions, Field, inputClass } from "./AccountCard";
import { useSend } from "./useSend";

// What the server uses when the user has no Preferences row yet
const DEFAULT_PREFS: AccountPreferences = { blurUnsafeEmbeds: true, defaultSafety: ["SAFE"], profileBackground: null };

const SAFETY_OPTIONS: { value: Safety; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "SAFE", label: "Safe", description: "Fine for anyone.", icon: <ShieldCheckIcon size={18} /> },
  { value: "QUESTIONABLE", label: "Questionable", description: "Suggestive, but not explicit.", icon: <ShieldIcon size={18} /> },
  { value: "EXPLICIT", label: "Explicit", description: "Adult content.", icon: <ShieldWarningIcon size={18} /> },
];

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export default function ContentCard({ me, canChangeBackground, onSaved }: {
  me: AccountDetails;
  canChangeBackground: boolean;
  onSaved: (prefs: AccountPreferences) => void;
}) {
  const send = useSend();
  const toast = useToast();
  const saved = me.preferences ?? DEFAULT_PREFS;

  const [blur, setBlur] = useState(saved.blurUnsafeEmbeds);
  const [safety, setSafety] = useState<Safety[]>(saved.defaultSafety);
  const [background, setBackground] = useState(saved.profileBackground ? String(saved.profileBackground) : "");
  const [saving, setSaving] = useState(false);

  const backgroundId = background.trim() ? Number(background) : null;
  const backgroundChanged = backgroundId !== saved.profileBackground;
  const dirty = blur !== saved.blurUnsafeEmbeds || !sameSet(safety, saved.defaultSafety) || (canChangeBackground && backgroundChanged);

  const save = async () => {
    if (safety.length === 0) return toast("Pick at least one safety level.", "error");
    if (backgroundId !== null && (!Number.isInteger(backgroundId) || backgroundId < 1)) return toast("The background must be a post ID.", "error");

    // PATCH semantics: only what changed
    const body: Partial<AccountPreferences> = {};
    if (blur !== saved.blurUnsafeEmbeds) body.blurUnsafeEmbeds = blur;
    if (!sameSet(safety, saved.defaultSafety)) body.defaultSafety = safety;
    if (canChangeBackground && backgroundChanged) body.profileBackground = backgroundId;

    setSaving(true);
    const prefs = await send<AccountPreferences>("/api/me/preferences", "PATCH", body);
    setSaving(false);
    if (!prefs) return;
    onSaved(prefs);
    toast("Preferences saved", "success");
  };

  return (
    <AccountCard title="Content" description="Saved to your account, so they follow you to every device.">
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
      </div>

      <CardActions>
        <Button size="lg" variant="success" icon={<FloppyDiskIcon size={16} />} loading={saving} disabled={!dirty} onClick={save}>
          Save preferences
        </Button>
      </CardActions>
    </AccountCard>
  );
}
