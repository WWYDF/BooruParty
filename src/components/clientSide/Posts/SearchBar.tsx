"use client";

export default function SearchBar() {
  return (
    <input
      type="text"
      placeholder="Search posts..."
      className="w-full md:max-w-md px-4 py-2 rounded-2xl border border-secondary-border bg-secondary text-base text-subtle"
    />
  );
}
