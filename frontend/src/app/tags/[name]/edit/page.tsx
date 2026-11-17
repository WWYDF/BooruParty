"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FloppyDiskIcon, XIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import Checkbox from "@/components/UI/Checkbox";
import { useToast } from "@/components/UI/Toast";
import { useUser } from "@/components/UserProvider";
import TagInput from "@/components/Uploads/TagInput";
import { useTagDetail } from "@/components/Tags/useTagDetail";
import { API, errorText } from "@/core/api";
import { TagChip } from "@/core/types/uploads";
import { TagFlag } from "@/core/types/tags";

// Every flag a tag can carry, with what it does (keep in sync with the TagFlag enum)
const FLAG_OPTIONS: { flag: TagFlag; label: string; description: string }[] = [
  { flag: "REACTION", label: "Reaction image", description: "Posts with this tag show up in the comment reaction picker." },
];

const MAX_DESCRIPTION = 4096;

// Close enough to the server's normalizeTagName for the form; the server has the final say
const normalize = (input: string) =>
  input.normalize("NFC").trim().toLowerCase().replace(/\s+/g, "_").replace(/_+/g, "_");

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

const labelClass = "mb-1.5 block text-sm font-medium text-zinc-200";
const inputClass =
  "w-full rounded-lg border border-secondary-border bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600";

// Free-text name chips (aliases are NEW names, so this isn't a tag search)
function NameListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState("");

  const add = () => {
    const name = normalize(text);
    if (name && !value.includes(name)) onChange([...value, name]);
    setText("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-secondary-border bg-zinc-900 px-2 py-1.5 focus-within:ring-1 focus-within:ring-zinc-600">
      {value.map((name) => (
        <span key={name} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-sm text-zinc-300">
          {name}
          <button type="button" onClick={() => onChange(value.filter((n) => n !== name))} className="text-subtle hover:text-red-400" title={`Remove ${name}`}>
            <XIcon size={12} weight="bold" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === "," || e.key === " ") && text.trim()) { e.preventDefault(); add(); }
          else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => text.trim() && add()}
        placeholder={value.length ? "" : placeholder}
        spellCheck={false}
        className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm text-white focus:outline-none"
      />
    </div>
  );
}

export default function TagEditPage() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useUser();
  const { tag, categories, error } = useTagDetail(name, "edit");

  const [primary, setPrimary] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [flags, setFlags] = useState<TagFlag[]>([]);
  const [implications, setImplications] = useState<TagChip[]>([]);
  const [suggestions, setSuggestions] = useState<TagChip[]>([]);
  const [saving, setSaving] = useState(false);

  const colorOf = (categoryId: number) => categories.find((c) => c.id === categoryId)?.color;

  // Fill the form once the tag (and category colors) arrive
  useEffect(() => {
    if (!tag) return;
    setPrimary(tag.name);
    setAliases(tag.aliases);
    setCategoryId(tag.categoryId);
    setDescription(tag.description ?? "");
    setFlags(tag.flags);
    setImplications(tag.implications.map((t) => ({ name: t.name, color: colorOf(t.categoryId) })));
    setSuggestions(tag.suggestions.map((t) => ({ name: t.name, color: colorOf(t.categoryId) })));
  }, [tag, categories]);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!tag || user === undefined) return <p className="text-sm text-zinc-600">Loading...</p>;
  if (!user?.permissions.includes("tags.edit")) {
    return <p className="text-sm text-red-400">You don&apos;t have permission to edit tags.</p>;
  }

  // A tag can't imply or suggest itself (under any of its names)
  const ownNames = new Set([tag.name, ...tag.aliases, normalize(primary), ...aliases]);
  const withoutSelf = (next: TagChip[], setter: (v: TagChip[]) => void) => {
    const self = next.find((t) => ownNames.has(t.name));
    if (self) toast(`A tag can't point at itself ("${self.name}").`, "error");
    setter(next.filter((t) => !ownNames.has(t.name)));
  };

  const toggleFlag = (flag: TagFlag, on: boolean) =>
    setFlags((prev) => (on ? [...prev, flag] : prev.filter((f) => f !== flag)));

  const handleSave = async () => {
    const newName = normalize(primary);
    if (!newName) {
      toast("The tag needs a name.", "error");
      return;
    }

    // PATCH semantics: only what changed
    const body: Record<string, unknown> = {};
    if (newName !== tag.name) body.name = newName;
    if (!sameSet(aliases, tag.aliases)) body.aliases = aliases.filter((a) => a !== newName);
    if (categoryId !== tag.categoryId) body.categoryId = categoryId;
    if (description.trim() !== (tag.description ?? "")) body.description = description.trim() || null;
    if (!sameSet(flags, tag.flags)) body.flags = flags;
    const impNames = implications.map((t) => t.name);
    if (!sameSet(impNames, tag.implications.map((t) => t.name))) body.implications = impNames;
    const sugNames = suggestions.map((t) => t.name);
    if (!sameSet(sugNames, tag.suggestions.map((t) => t.name))) body.suggestions = sugNames;

    if (!Object.keys(body).length) {
      toast("Nothing to save", "info");
      return;
    }

    setSaving(true);
    try {
      const res = await API(`/api/tags/${encodeURIComponent(tag.name)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(errorText(data), "error");
        return;
      }
      toast("Tag saved", "success");
      router.replace(`/tags/${encodeURIComponent(data.name ?? newName)}`); // may have been renamed
    } catch {
      toast("The server could not be reached", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Names */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            maxLength={96}
            spellCheck={false}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-500">Spaces become underscores. Renaming keeps every post tagged.</p>
        </div>

        <div>
          <label className={labelClass}>Category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} className={inputClass}>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Color:{" "}
            <span style={{ color: colorOf(categoryId) }}>■</span>{" "}
            {categories.find((c) => c.id === categoryId)?.name}
          </p>
        </div>
      </div>

      <div>
        <label className={labelClass}>Aliases</label>
        <NameListInput value={aliases} onChange={setAliases} placeholder="Other names that mean this tag..." />
        <p className="mt-1 text-xs text-zinc-500">Searching or tagging with an alias uses this tag instead. Enter, space or comma adds one.</p>
      </div>

      {/* Relations */}
      <div>
        <label className={labelClass}>Implies</label>
        <TagInput
          value={implications}
          onChange={(next) => withoutSelf(next, setImplications)}
          placeholder="Tags added automatically along with this one..."
        />
        <p className="mt-1 text-xs text-zinc-500">The post editor adds these when this tag is picked. Loops are refused by the server.</p>
      </div>

      <div>
        <label className={labelClass}>Suggests</label>
        <TagInput
          value={suggestions}
          onChange={(next) => withoutSelf(next, setSuggestions)}
          placeholder="Tags often used with this one..."
        />
      </div>

      {/* Flags */}
      <div>
        <label className={labelClass}>Flags</label>
        <div className="space-y-2 rounded-lg border border-secondary-border bg-zinc-900/40 p-3">
          {FLAG_OPTIONS.map(({ flag, label, description }) => (
            <div key={flag}>
              <Checkbox checked={flags.includes(flag)} onChange={(on) => toggleFlag(flag, on)} label={label} />
              <p className="ml-6 text-xs text-zinc-500">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          maxLength={MAX_DESCRIPTION}
          placeholder="What this tag is for, when to use it... Links are clickable."
          className={`${inputClass} resize-y`}
        />
        {description.length > MAX_DESCRIPTION * 0.8 && (
          <p className="mt-1 text-right text-xs text-subtle">{description.length} / {MAX_DESCRIPTION}</p>
        )}
      </div>

      <Button variant="success" icon={<FloppyDiskIcon size={16} />} loading={saving} onClick={handleSave}>
        Save Changes
      </Button>
    </div>
  );
}
