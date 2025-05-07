"use client";

import { CursorClick } from "@phosphor-icons/react";

export default function MassSelectionBar({
  selectionMode,
  selectedCount,
  onToggle,
  onEdit,
  onClear,
}: {
  selectionMode: boolean;
  selectedCount: number;
  onToggle: () => void;
  onEdit: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex justify-end items-center gap-2">
      {!selectionMode ? (
        <button
          className="w-10 h-10 flex items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 border border-secondary-border text-white"
          onClick={onToggle}
          title="Select Posts"
        >
          <CursorClick size={20} weight="duotone" />
        </button>
      ) : (
        <>
          <button
            className="bg-zinc-800 border border-secondary-border px-4 py-2 rounded hover:bg-zinc-700 transition"
            onClick={onClear}
          >
            Cancel
          </button>
          <button
            disabled={selectedCount === 0}
            className="bg-green-700 px-4 py-2 rounded disabled:opacity-50 hover:bg-green-600 transition"
            onClick={onEdit}
          >
            Edit Selected ({selectedCount})
          </button>
        </>
      )}
    </div>
  );
}
