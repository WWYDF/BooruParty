"use client";

import { useState } from "react";

type Props = {
  poolId: number;
  initial: {
    name: string;
    artist: string | null;
    description: string | null;
  };
  onDone: () => void;
  onRefresh: () => void;
};

export function PoolEditForm({ poolId, initial, onDone, onRefresh }: Props) {
  const [name, setName] = useState(initial.name);
  const [artist, setArtist] = useState(initial.artist || "");
  const [description, setDescription] = useState(initial.description || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/pools/${poolId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, artist, description })
    });

    setSaving(false);
    if (res.ok) {
      onRefresh();
      onDone();
    }
    else console.error("Failed to save pool metadata");
  };

  return (
    <div className="flex flex-col gap-2 max-w-lg">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="text-2xl font-bold text-white bg-transparent border-b border-white/30 focus:outline-none"
      />
      <input
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
        className="text-sm text-white bg-transparent border-b border-white/30 focus:outline-none"
        placeholder="Artist"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="text-sm text-white bg-transparent border border-white/30 px-2 py-1 rounded resize-none focus:outline-none"
        placeholder="Description"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs px-3 py-1 border rounded bg-secondary-border text-white hover:bg-white/10"
        >
          Save
        </button>
        <button
          onClick={onDone}
          className="text-xs px-3 py-1 border rounded bg-secondary-border text-white hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
