"use client";

import { CursorClickIcon } from "@phosphor-icons/react";

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
          className="w-10 h-10 cursor-pointer flex items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 border border-secondary-border text-white focus:outline-none"
          onClick={onToggle}
          title="Select Posts"
        >
          <CursorClickIcon size={20} weight="duotone" />
        </button>
      ) : (
        <>
          <button
            className="bg-zinc-800 cursor-pointer border border-secondary-border px-4 py-2 rounded hover:bg-zinc-700 transition focus:outline-none"
            onClick={onClear}
          >
            Cancel
          </button>
          <button
            disabled={selectedCount === 0}
            className="bg-green-700 cursor-pointer px-4 py-2 rounded disabled:cursor-not-allowed disabled:opacity-50 hover:bg-green-600 transition focus:outline-none"
            onClick={onEdit}
          >
            Edit Selected ({selectedCount})
          </button>
        </>
      )}
    </div>
  );
}
