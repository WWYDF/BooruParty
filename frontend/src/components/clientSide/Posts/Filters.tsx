"use client";

type FiltersProps = {
  selectedSafeties: string[];
  toggleSafety: (safety: string) => void;
  triggerSearch: () => void;
};

export default function Filters({ selectedSafeties, toggleSafety }: FiltersProps) {
  const safetyOptions = ["SAFE", "SKETCHY", "UNSAFE"];

  return (
    <div className="flex gap-2">
      {safetyOptions.map((safety) => (
        <button
          key={safety}
          onClick={() => toggleSafety(safety)}
          className={`px-3 py-1 rounded ${
            selectedSafeties.includes(safety)
              ? "bg-accent text-black"
              : "bg-secondary text-subtle"
          }`}
        >
          {safety}
        </button>
      ))}
    </div>
  );
}
