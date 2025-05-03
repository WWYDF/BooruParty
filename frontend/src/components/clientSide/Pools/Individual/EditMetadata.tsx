"use client";

import { SafetyType } from "@prisma/client";

type Props = {
  name: string;
  artist: string;
  description: string;
  safety: SafetyType;
  onNameChange: (v: string) => void;
  onArtistChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSafetyChange: (v: SafetyType) => void;
};

export function PoolEditForm({
  name,
  artist,
  description,
  safety,
  onNameChange,
  onArtistChange,
  onDescriptionChange,
  onSafetyChange
}: Props) {
  return (
    <div className="flex flex-col gap-2 max-w-lg">
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="text-2xl font-bold text-white bg-transparent border-b border-white/30 focus:outline-none"
      />
      <input
        value={artist}
        onChange={(e) => onArtistChange(e.target.value)}
        className="text-sm text-white bg-transparent border-b border-white/30 focus:outline-none"
        placeholder="Artist"
      />
      <textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        rows={2}
        className="text-sm text-white bg-zinc-950 border border-white/30 px-2 py-1 rounded resize-none focus:outline-none"
        placeholder="Description"
      />
      <select
        value={safety}
        onChange={(e) => onSafetyChange(e.target.value as SafetyType)}
        className="text-sm text-white bg-zinc-950 border border-white/30 px-2 py-1 rounded focus:outline-none"
      >
        <option value="SAFE">SAFE</option>
        <option value="UNSAFE">UNSAFE</option>
        <option value="SKETCHY">SKETCHY</option>
      </select>
    </div>
  );
}
