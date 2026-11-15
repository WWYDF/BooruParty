"use client";

import { Plus } from "@phosphor-icons/react";

type Props = {
  onAdd: () => void;
  className?: string;
  visible?: boolean;
};

export default function AddButton({ onAdd, className = "", visible = true }: Props) {
  if (!visible) return null;

  return (
    <button
      onClick={onAdd}
      type="button"
      title="Add"
      className={`h-[42px] aspect-square flex items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-500 ${className}`}
    >
      <Plus size={18} />
    </button>
  );
}
