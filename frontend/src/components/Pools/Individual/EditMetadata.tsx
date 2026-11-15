"use client";

import { SafetyType } from "@prisma/client";

type Props = {
  name: string;
  artist: string;
  description: string;
  safety: SafetyType;
  yearStart: number | null;
  yearEnd: number | null;
  onNameChange: (v: string) => void;
  onArtistChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSafetyChange: (v: SafetyType) => void;
  onYearStartChange: (v: number | null) => void;
  onYearEndChange: (v: number | null) => void;
};

export function PoolEditForm({
  name,
  artist,
  description,
  safety,
  yearStart,
  yearEnd,
  onNameChange,
  onArtistChange,
  onDescriptionChange,
  onSafetyChange,
  onYearStartChange,
  onYearEndChange,
}: Props) {
  return (
    <div className="flex flex-col gap-2 w-1/2">
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
      <div className="flex gap-2">
        <input
          type="number"
          value={yearStart ?? ""}
          onChange={(e) =>
            onYearStartChange(e.target.value ? parseInt(e.target.value) : null)
          }
          placeholder="Start Year"
          className="flex-1 text-sm text-white bg-zinc-950 border border-white/30 px-2 py-1 rounded focus:outline-none"
        />
        <input
          type="number"
          value={yearEnd ?? ""}
          onChange={(e) =>
            onYearEndChange(e.target.value ? parseInt(e.target.value) : null)
          }
          placeholder="End Year"
          className="flex-1 text-sm text-white bg-zinc-950 border border-white/30 px-2 py-1 rounded focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-subtle mt-1">
          <input
            type="checkbox"
            checked={yearEnd === null}
            onChange={(e) => onYearEndChange(e.target.checked ? null : yearStart ?? new Date().getFullYear())}
            className="accent-accent"
          />
          Present (no end year)
        </label>
      </div>
    </div>
  );
}
