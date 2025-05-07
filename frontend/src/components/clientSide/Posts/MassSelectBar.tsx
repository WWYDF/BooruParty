"use client";

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
    <div className="flex justify-end items-center gap-2 my-4">
      {!selectionMode ? (
        <button
          className="bg-zinc-800 border border-secondary-border px-4 py-2 rounded hover:bg-zinc-700 transition"
          onClick={onToggle}
        >
          Select Posts
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
