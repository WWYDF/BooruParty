'use client';

import { useEffect, useState } from "react";
import AutoTaggerSection from "@/components/Dashboard/Addons/ConfigTagger";
import { useToast } from "@/components/UI/Toast";
import { API, errorText } from "@/core/api";
import { AddonsState, AutoTaggerMode } from "@/core/types/addons";

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const isHttpUrl = (s: string) => /^https?:\/\/.+/i.test(s);

export default function AddonsPage() {
  const toast = useToast();
  const [saved, setSaved] = useState<AddonsState | null>(null); // what the server has
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [modes, setModes] = useState<AutoTaggerMode[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (s: AddonsState) => {
    setSaved(s);
    setEnabled(s.enableAutoTagger);
    setUrl(s.autoTaggerUrl ?? "");
    setModes(s.autoTaggerMode);
  };

  useEffect(() => {
    API("/api/system/addons")
      .then(async (res) => (res.ok ? apply(await res.json()) : setError("Could not load addons.")))
      .catch(() => setError("The server could not be reached."));
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!saved) return <p className="text-sm text-zinc-600">Loading...</p>;

  const trimmedUrl = url.trim();
  const savedUrl = saved.autoTaggerUrl ?? "";
  const urlInvalid = enabled && !isHttpUrl(trimmedUrl); // the field is only visible while enabled

  // While disabled the body is collapsed, so half-finished values there are kept but not sent
  const sendUrl = trimmedUrl !== savedUrl && (trimmedUrl === "" || isHttpUrl(trimmedUrl));
  const sendModes = modes.length > 0 && !sameSet(modes, saved.autoTaggerMode);

  const dirty = enabled !== saved.enableAutoTagger || sendUrl || sendModes;
  const saveDisabled = saving || !dirty || (enabled && (urlInvalid || modes.length === 0));

  const handleSave = async () => {
    if (saveDisabled) return;

    // PATCH semantics: only what changed
    const body: Partial<AddonsState> = {};
    if (enabled !== saved.enableAutoTagger) body.enableAutoTagger = enabled;
    if (sendUrl) body.autoTaggerUrl = trimmedUrl || null;
    if (sendModes) body.autoTaggerMode = modes;

    setSaving(true);
    try {
      const res = await API("/api/system/addons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(`Error while saving! ${errorText(data)}`, "error");
        return;
      }
      apply(data);
      toast("Settings Saved!", "success");
    } catch {
      toast("The server could not be reached", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="space-y-6">
        <AutoTaggerSection
          enabled={enabled}
          url={url}
          mode={modes}
          onToggle={() => setEnabled((v) => !v)}
          onChangeUrl={setUrl}
          onChangeMode={setModes}
          urlInvalid={urlInvalid && trimmedUrl !== ""}
        />
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => apply(saved)}
          disabled={saving || !dirty}
          className="cursor-pointer rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveDisabled}
          className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          title={enabled && (urlInvalid || modes.length === 0) ? "Complete all required fields for enabled addons." : undefined}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
