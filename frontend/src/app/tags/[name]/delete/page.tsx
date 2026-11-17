"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TrashIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import Checkbox from "@/components/UI/Checkbox";
import { useToast } from "@/components/UI/Toast";
import { useUser } from "@/components/UserProvider";
import { useTagDetail } from "@/components/Tags/useTagDetail";
import { API, errorText } from "@/core/api";
import { formatCounts } from "@/core/formats";

export default function TagDeletePage() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useUser();
  const { tag, error } = useTagDetail(name, "delete");

  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!tag || user === undefined) return <p className="text-sm text-zinc-600">Loading...</p>;
  if (!user?.permissions.includes("tags.delete")) {
    return <p className="text-sm text-red-400">You don&apos;t have permission to delete tags.</p>;
  }

  const handleDelete = async () => {
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await API(`/api/tags/${encodeURIComponent(tag.name)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(errorText(data), "error");
        return;
      }
      toast(`Deleted "${data.deleted}" (removed from ${formatCounts(data.removedFromPosts)} posts)`, "success");
      router.push("/tags");
    } catch {
      toast("The server could not be reached", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 text-sm">
      <div className="space-y-1 rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-3 text-zinc-300">
        <p className="font-medium text-red-300">Deleting this tag will:</p>
        <ul className="list-disc space-y-0.5 pl-5 text-subtle">
          <li>
            Remove it from{" "}
            <Link href={`/posts?query=${encodeURIComponent(tag.name)}`} className="text-accent hover:underline">
              {formatCounts(tag.postCount)} {tag.postCount === 1 ? "post" : "posts"}
            </Link>
          </li>
          {tag.aliases.length > 0 && (
            <li>Delete its aliases too: <span className="text-zinc-300">{tag.aliases.join(", ")}</span></li>
          )}
          <li>Remove its implications and suggestions, in both directions</li>
        </ul>
      </div>

      <p className="text-subtle">
        Want to keep the posts tagged under another name instead?{" "}
        <Link href={`/tags/${encodeURIComponent(tag.name)}/merge`} className="text-accent hover:underline">Merge it</Link>.
      </p>

      <Checkbox checked={confirmed} onChange={setConfirmed} label={<>Delete <span className="text-zinc-100">{tag.name}</span> permanently</>} />

      <Button variant="danger" icon={<TrashIcon size={16} />} loading={deleting} disabled={!confirmed} onClick={handleDelete}>
        Delete tag
      </Button>
    </div>
  );
}
