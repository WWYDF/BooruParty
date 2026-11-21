'use client';

import { useEffect, useState } from "react";
import { EyeIcon, FileVideoIcon, FloppyDiskIcon, ShieldCheckIcon, ShieldIcon, ShieldWarningIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import { FullCheckbox, FullCheckboxGroup } from "@/components/UI/FullCheckbox";
import { useToast } from "@/components/UI/Toast";
import { API, errorText } from "@/core/api";
import { Safety } from "@/core/types/posts";

// GET/PATCH /api/system/settings
type Settings = {
  guestAccess: boolean,
  guestSafety: Safety[],
  featuredPostId: number | null,
  convertShortVids: boolean,
  maxFavoriteTags: number,
  maxBlacklistTags: number,
};

// Same bounds as the API's schema (favorites also match the profile's 100-tag ceiling)
const TAG_LIMITS = {
  maxFavoriteTags: { min: 0, max: 100 },
  maxBlacklistTags: { min: 0, max: 1000 },
} as const;

const SAFETY_OPTIONS: { value: Safety; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "SAFE", label: "Safe", description: "Fine for anyone.", icon: <ShieldCheckIcon size={18} /> },
  { value: "QUESTIONABLE", label: "Questionable", description: "Suggestive, but not explicit.", icon: <ShieldIcon size={18} /> },
  { value: "EXPLICIT", label: "Explicit", description: "Adult content.", icon: <ShieldWarningIcon size={18} /> },
];

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const inputClass = "w-28 rounded-lg border border-secondary-border bg-zinc-900 px-3 py-2 text-sm text-zinc-200 tabular-nums focus:outline-hidden focus:ring-1 focus:ring-zinc-600 disabled:opacity-50";

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-secondary-border bg-zinc-900/40 p-5">
      <h2 className="text-sm font-medium text-zinc-200">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-subtle">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// A labelled whole-number box. The text is kept as typed; it's checked on save.
function NumberField({ label, hint, value, onChange, disabled }: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-wrap items-center justify-between gap-3">
      <span>
        <span className="block text-sm text-zinc-200">{label}</span>
        <span className="block text-xs text-subtle">{hint}</span>
      </span>
      <input
        type="number"
        inputMode="numeric"
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={inputClass}
      />
    </label>
  );
}

export default function AdminSettingsPage() {
  const toast = useToast();
  const [saved, setSaved] = useState<Settings | null>(null); // what the server has
  const [guestAccess, setGuestAccess] = useState(false);
  const [guestSafety, setGuestSafety] = useState<Safety[]>([]);
  const [convertShortVids, setConvertShortVids] = useState(false);
  const [maxFavoriteTags, setMaxFavoriteTags] = useState("");
  const [maxBlacklistTags, setMaxBlacklistTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (s: Settings) => {
    setSaved(s);
    setGuestAccess(s.guestAccess);
    setGuestSafety(s.guestSafety);
    setConvertShortVids(s.convertShortVids);
    setMaxFavoriteTags(String(s.maxFavoriteTags));
    setMaxBlacklistTags(String(s.maxBlacklistTags));
  };

  useEffect(() => {
    API("/api/system/settings")
      .then(async (res) => (res.ok ? apply(await res.json()) : setError("Could not load settings.")))
      .catch(() => setError("The server could not be reached."));
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!saved) return <p className="text-sm text-zinc-600">Loading...</p>;

  const favoritesNum = Number(maxFavoriteTags);
  const blacklistNum = Number(maxBlacklistTags);

  const dirty =
    guestAccess !== saved.guestAccess ||
    !sameSet(guestSafety, saved.guestSafety) ||
    convertShortVids !== saved.convertShortVids ||
    favoritesNum !== saved.maxFavoriteTags ||
    blacklistNum !== saved.maxBlacklistTags;

  // "Whole number within the API's bounds", or an error message
  const checkLimit = (key: keyof typeof TAG_LIMITS, text: string, label: string): string | null => {
    const n = Number(text);
    const { min, max } = TAG_LIMITS[key];
    if (text.trim() === "" || !Number.isInteger(n) || n < min || n > max) return `${label} must be a whole number from ${min} to ${max}.`;
    return null;
  };

  const handleSave = async () => {
    if (guestSafety.length === 0) {
      toast("Pick at least one safety level (turn off guest access to hide everything).", "error");
      return;
    }
    const limitError =
      checkLimit("maxFavoriteTags", maxFavoriteTags, "Favorite tags") ??
      checkLimit("maxBlacklistTags", maxBlacklistTags, "Blacklisted tags");
    if (limitError) return toast(limitError, "error");

    // PATCH semantics: only what changed
    const body: Partial<Settings> = {};
    if (guestAccess !== saved.guestAccess) body.guestAccess = guestAccess;
    if (!sameSet(guestSafety, saved.guestSafety)) body.guestSafety = guestSafety;
    if (convertShortVids !== saved.convertShortVids) body.convertShortVids = convertShortVids;
    if (favoritesNum !== saved.maxFavoriteTags) body.maxFavoriteTags = favoritesNum;
    if (blacklistNum !== saved.maxBlacklistTags) body.maxBlacklistTags = blacklistNum;

    setSaving(true);
    try {
      const res = await API("/api/system/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(errorText(data), "error");
        return;
      }
      apply(data);
      toast("Settings saved", "success");
    } catch {
      toast("The server could not be reached", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card title="Guests" description="What people who aren't logged in can see. Changes apply immediately, no restart.">
        <div className="space-y-4">
          <FullCheckbox
            checked={guestAccess}
            onChange={setGuestAccess}
            label="Allow guests to browse"
            description="Off: the feed and posts ask visitors to log in first."
            icon={<EyeIcon size={18} />}
            disabled={saving}
          />

          <div className={guestAccess ? "" : "pointer-events-none opacity-50"}>
            <p className="mb-2 text-xs text-subtle">Safety levels guests may see (a hard limit their searches can&apos;t go past):</p>
            <FullCheckboxGroup options={SAFETY_OPTIONS} value={guestSafety} onChange={setGuestSafety} disabled={saving || !guestAccess} />
          </div>
        </div>
      </Card>

      <Card title="Uploading" description="Various limits and config options.">
        <div className="space-y-4">
          <FullCheckbox
            checked={convertShortVids}
            onChange={setConvertShortVids}
            label="Convert short, muted videos to animations"
            description="Off: keep them as videos."
            icon={<FileVideoIcon size={18} />}
            disabled={saving}
          />
        </div>
      </Card>

      <Card title="Tags" description="Per-user list sizes. Lowering a limit never deletes anything; people over it just can't save until they're under it.">
        <div className="space-y-4">
          <NumberField
            label="Favorite tags per user"
            hint="Shown on their profile. 0 turns favorites off (max 100)."
            value={maxFavoriteTags}
            onChange={setMaxFavoriteTags}
            disabled={saving}
          />
          <NumberField
            label="Blacklisted tags per user"
            hint="Hidden from every list they see. 0 turns the blacklist off (max 1000)."
            value={maxBlacklistTags}
            onChange={setMaxBlacklistTags}
            disabled={saving}
          />
        </div>
      </Card>

      <div className="flex items-center gap-3 justify-end">
        <Button size="lg" variant="success" icon={<FloppyDiskIcon size={16} />} loading={saving} disabled={!dirty} onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
