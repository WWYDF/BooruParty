"use client";

type Props = {
  name: string;
  description: string;
  yearStart: number | null;
  yearEnd: number | null;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onYearStartChange: (v: number | null) => void;
  onYearEndChange: (v: number | null) => void;
};

// Artist, tags and safety aren't editable: they come from the pool's posts
export function PoolEditForm({
  name,
  description,
  yearStart,
  yearEnd,
  onNameChange,
  onDescriptionChange,
  onYearStartChange,
  onYearEndChange,
}: Props) {
  return (
    <div className="flex flex-col gap-2 w-full sm:w-1/2">
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        maxLength={128}
        placeholder="Name"
        className="text-2xl font-bold text-white bg-transparent border-b border-white/30 focus:outline-hidden"
      />
      <textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        rows={2}
        maxLength={2048}
        className="text-sm text-white bg-zinc-950 border border-white/30 px-2 py-1 rounded resize-none focus:outline-hidden"
        placeholder="Description"
      />
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          value={yearStart ?? ""}
          onChange={(e) => onYearStartChange(e.target.value ? parseInt(e.target.value) : null)}
          placeholder="Start Year"
          min={1000}
          max={3000}
          className="flex-1 text-sm text-white bg-zinc-950 border border-white/30 px-2 py-1 rounded focus:outline-hidden"
        />
        <input
          type="number"
          value={yearEnd ?? ""}
          onChange={(e) => onYearEndChange(e.target.value ? parseInt(e.target.value) : null)}
          placeholder="End Year"
          min={1000}
          max={3000}
          disabled={yearEnd === null}
          className="flex-1 text-sm text-white bg-zinc-950 border border-white/30 px-2 py-1 rounded focus:outline-hidden disabled:opacity-40"
        />
        <label className="flex items-center gap-2 text-sm text-subtle mt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={yearEnd === null}
            onChange={(e) => onYearEndChange(e.target.checked ? null : yearStart ?? new Date().getFullYear())}
            className="accent-accent cursor-pointer"
          />
          Present (no end year)
        </label>
      </div>
    </div>
  );
}
