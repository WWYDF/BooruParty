'use client';

import { useToast } from "@/components/UI/Toast";
import TagInput from "@/components/Uploads/TagInput";
import { ColoredTag } from "@/core/types/tags";
import { TagChip } from "@/core/types/uploads";

export const toChip = (t: ColoredTag): TagChip => ({ name: t.name, color: t.category.color, postCount: t.postCount });
export const sameNames = (a: TagChip[], b: TagChip[]) => a.length === b.length && a.every((x) => b.some((y) => y.name === x.name));

type Props = {
  label: string;
  description: string;
  value: TagChip[];
  onChange: (tags: TagChip[]) => void;
  max: number | null;          // null = the lists couldn't be loaded
  blocked: string[];           // names on the user's OTHER saved list (a tag can't be on both)
  blockedLabel: string;        // "blacklist" / "favorite tags", for the toast
  offText: string;             // shown when the site set the limit to 0
  placeholder: string;
  disabled?: boolean;
  flip?: boolean;              // description under the picker (like Field's hint) instead of above it
};

// One tag list inside an account card (favorites in Profile, blacklist in Safety): label + counter + picker.
// Saving is up to the card, so it goes out with the card's own Save button.
export default function TagListField({
  label, description, value, onChange, max, blocked, blockedLabel, offText, placeholder, disabled, flip = false,
}: Props) {
  const toast = useToast();

  const change = (next: TagChip[]) => {
    if (max !== null && next.length > max) return toast(`You can have up to ${max} here`, "error");
    const clash = next.filter((t) => blocked.includes(t.name) && !value.some((v) => v.name === t.name));
    if (clash.length) {
      return toast(`${clash.map((t) => t.name).join(", ")} ${clash.length === 1 ? "is" : "are"} on your ${blockedLabel}. Remove it there first.`, "error");
    }
    onChange(next);
  };

  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
        {label}
        {max !== null && max > 0 && (
          <span className={`ml-auto text-2xs tabular-nums ${value.length >= max ? "text-amber-400" : "text-zinc-600"}`}>
            {value.length} / {max}
          </span>
        )}
      </p>
      {!flip && <p className="mb-2 text-xs text-zinc-600">{description}</p>}

      {max === null ? (
        <p className="text-xs text-red-400">Could not load this list.</p>
      ) : max === 0 ? (
        <p className="text-xs text-subtle">{offText}</p>
      ) : (
        <TagInput value={value} onChange={change} placeholder={placeholder} disabled={disabled} />
      )}

      {/* Same spacing + color as Field's hint, so it lines up with the inputs above it */}
      {flip && <p className="mt-1 text-xs text-zinc-600">{description}</p>}
    </div>
  );
}
