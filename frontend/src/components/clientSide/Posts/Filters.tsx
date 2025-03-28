"use client";

export default function Filters() {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Placeholder for now, we'll add actual filters later */}
      <button className="px-3 py-1 rounded-xl bg-secondary-border text-sm text-subtle">Safe</button>
      <button className="px-3 py-1 rounded-xl bg-secondary-border text-sm text-subtle">NSFW</button>
    </div>
  );
}
