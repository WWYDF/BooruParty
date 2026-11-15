"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { List } from "phosphor-react";

type Role = {
  id: number;
  name: string;
  color: string | null;
};

type Props = {
  role: Role;
};

export default function SortableRoleCard({ role }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: role.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const safeColor = (clr: string | null | undefined) =>
    clr && /^#([0-9a-f]{3}){1,2}$/i.test(clr) ? clr : "#ffffff";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex items-center gap-4"
    >
      {/* Drag handle */}
      <button
        {...listeners}
        className="cursor-grab text-zinc-400 hover:text-white"
        aria-label="Drag handle"
      >
        <List size={20} />
      </button>

      {/* Role info */}
      <div className="flex items-center gap-3">
        <span
          className="w-4 h-4 rounded-full border border-zinc-600"
          style={{ backgroundColor: safeColor(role.color) }}
        />
        <span className="text-white font-medium">{role.name}</span>
      </div>
    </div>
  );
}
