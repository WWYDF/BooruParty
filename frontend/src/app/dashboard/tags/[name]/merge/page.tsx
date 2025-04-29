"use client";

import TagSelector from "@/components/clientSide/TagSelector";
import { useToast } from "@/components/clientSide/Toast";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

type TagType = {
  id: number;
  name: string;
  description?: string;
  category: {
    id: number;
    name: string;
    color: string;
  };
  aliases: { id: number; alias: string }[];
};


export default function MergeTagPage() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();

  const [targetName, setTargetName] = useState("");
  const [makeAlias, setMakeAlias] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [merging, setMerging] = useState(false);
  const [target, setTarget] = useState<TagType | null>(null);
  const toast = useToast();

  const handleMerge = async () => {
    if (!confirm || !target || !name) return;
  
    setMerging(true);
  
    try {
      const res = await fetch(`/api/tags/${encodeURIComponent(name)}/merge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetId: target.id,
          makeAlias,
        }),
      });
  
      if (res.ok) {
        toast("Tag merged successfully!", "success");
        router.push(`/dashboard/tags/${encodeURIComponent(target.name)}`);
      } else {
        const data = await res.json();
        toast(data.error || "Failed to merge tag.", "error");
      }
    } catch (err) {
      console.error(err);
      toast("Failed to merge tag.", "error");
    } finally {
      setMerging(false);
    }
  };  

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="text-zinc-600 text-sm">Target tag</label>
          <TagSelector
            onSelect={(tag) => {
              setTarget(tag);
            }}
            placeholder="Search for target tag..."
            disabledTags={[]}
          />
          {target && (
            <div className="mt-2 text-zinc-100 text-sm">
              Selected:{" "}
              <span style={{ color: target.category.color }}>
                {target.name}
              </span>
            </div>
          )}
        </div>

        <p className="text-zinc-600 text-sm">
          Usages in posts, suggestions, and implications will be merged.<br />
          Category is not merged automatically and must be handled manually.
        </p>

        <label className="flex items-center space-x-2 text-sm text-zinc-200">
          <input
            type="checkbox"
            checked={makeAlias}
            onChange={() => setMakeAlias(!makeAlias)}
          />
          <span>Make this tag an alias of the target tag.</span>
        </label>

        <label className="flex items-center space-x-2 text-sm text-zinc-200">
          <input
            type="checkbox"
            checked={confirm}
            onChange={() => setConfirm(!confirm)}
          />
          <span>I confirm that I want to merge this tag.</span>
        </label>

        <button
          onClick={handleMerge}
          disabled={!confirm || !target || merging}
          className="bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
        >
          {merging ? "Merging..." : "Merge tag"}
        </button>
      </div>
    </div>
  );
}
