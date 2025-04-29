"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/clientSide/Toast";

type Tag = {
  id: number;
  name: string;
  aliases: { id: number; alias: string }[];
};

export default function TagDeletePage() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const [tag, setTag] = useState<Tag | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetch(`/api/tags/${name}`)
      .then((res) => {
        if (!res.ok) throw new Error("Tag not found");
        return res.json();
      })
      .then((data) => setTag(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [name]);

  const handleDelete = async () => {
    if (!tag) return;
    setDeleting(true);

    const res = await fetch(`/api/tags/${tag.name}`, {
      method: "DELETE",
    });

    if (res.ok) {
      toast(`Successfully deleted tag '${tag.name}'.`, 'success')
      router.push("/dashboard/tags");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to delete tag.");
      setDeleting(false);
    }
  };

  if (loading) return <p className="text-zinc-600">Loading...</p>;
  if (error || !tag) return <p className="text-red-500">{error || "Tag not found."}</p>;

  return (
    <div className="space-y-6">

      <p className="text-sm">
        This tag has <a className="text-accent hover:underline" href="#">0 usage(s)</a>.
      </p>

      <label className="flex items-center space-x-2 text-sm">
        <input
          type="checkbox"
          checked={confirm}
          onChange={() => setConfirm(!confirm)}
        />
        <span>I confirm that I want to delete this tag.</span>
      </label>

      <button
        onClick={handleDelete}
        disabled={!confirm || deleting}
        className="bg-red-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Delete tag"}
      </button>
    </div>
  );
}
