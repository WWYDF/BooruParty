"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GitMergeIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import Checkbox from "@/components/UI/Checkbox";
import { useToast } from "@/components/UI/Toast";
import { useUser } from "@/components/UserProvider";
import TagInput from "@/components/Uploads/TagInput";
import { useTagDetail } from "@/components/Tags/useTagDetail";
import { API, errorText } from "@/core/api";
import { formatCounts } from "@/core/formats";
import { TagChip } from "@/core/types/uploads";

export default function MergeTagPage() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useUser();
  const { tag, error } = useTagDetail(name, "merge");

  const [target, setTarget] = useState<TagChip | null>(null);
  const [keepNames, setKeepNames] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [merging, setMerging] = useState(false);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!tag || user === undefined) return <p className="text-sm text-zinc-600">Loading...</p>;
  if (!user?.permissions.includes("tags.delete")) {
    return <p className="text-sm text-red-400">You don&apos;t have permission to merge tags.</p>;
  }

  const ownNames = new Set([tag.name, ...tag.aliases]);

  // Single pick: the newest chip wins
  const pickTarget = (chips: TagChip[]) => {
    const picked = chips[chips.length - 1] ?? null;
    if (picked && ownNames.has(picked.name)) {
      toast("A tag can't be merged into itself.", "error");
      return;
    }
    setTarget(picked);
    setConfirmed(false); // re-confirm for a different target
  };

  const handleMerge = async () => {
    if (!target || !confirmed) return;
    setMerging(true);
    try {
      const res = await API(`/api/tags/${encodeURIComponent(tag.name)}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ into: target.name, keepNames }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(errorText(data), "error");
        return;
      }
      toast(`Merged "${data.merged}" into "${data.tag.name}" (${formatCounts(data.movedPosts)} posts moved)`, "success");
      router.replace(`/tags/${encodeURIComponent(data.tag.name)}`);
    } catch {
      toast("The server could not be reached", "error");
    } finally {
      setMerging(false);
    }
  };

  const allNames = [tag.name, ...tag.aliases];

  return (
    <div className="space-y-6 text-sm">
      <p className="text-subtle">
        Moves everything from <span className="text-zinc-200">{tag.name}</span> onto another tag, then deletes{" "}
        <span className="text-zinc-200">{tag.name}</span>.
      </p>

      <div>
        <label className="mb-1.5 block font-medium text-zinc-200">Merge into</label>
        <TagInput value={target ? [target] : []} onChange={pickTarget} placeholder="Search for the tag to keep..." />
      </div>

      <Checkbox
        checked={keepNames}
        onChange={setKeepNames}
        label={
          <>
            Keep {allNames.length === 1 ? "the name" : "the names"}{" "}
            <span className="text-zinc-400">{allNames.join(", ")}</span> as aliases of the target
          </>
        }
      />

      {target && (
        <div className="space-y-1 rounded-xl border border-secondary-border bg-zinc-900/40 px-4 py-3 text-zinc-300">
          <p className="font-medium text-zinc-200">This will:</p>
          <ul className="list-disc space-y-0.5 pl-5 text-subtle">
            <li>
              Tag {formatCounts(tag.postCount)} {tag.postCount === 1 ? "post" : "posts"} with{" "}
              <span style={{ color: target.color }}>{target.name}</span> instead
            </li>
            <li>Move its implications and suggestions over (both directions)</li>
            <li>
              {keepNames
                ? <>Make <span className="text-zinc-300">{allNames.join(", ")}</span> point to {target.name}</>
                : <>Remove the name{allNames.length === 1 ? "" : "s"} <span className="text-zinc-300">{allNames.join(", ")}</span></>}
            </li>
            <li>Delete <span className="text-zinc-300">{tag.name}</span>. Its category and description are not carried over.</li>
          </ul>
        </div>
      )}

      <Checkbox
        checked={confirmed}
        onChange={setConfirmed}
        disabled={!target}
        label="I understand this can't be undone"
      />

      <Button
        variant="danger"
        icon={<GitMergeIcon size={16} />}
        loading={merging}
        disabled={!target || !confirmed}
        onClick={handleMerge}
      >
        Merge tag
      </Button>
    </div>
  );
}
