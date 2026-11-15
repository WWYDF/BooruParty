"use client";

import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useState } from "react";
import SortableRoleCard from "./SortableRoleCard";

type Role = {
  id: number;
  name: string;
  color: string | null;
  index: number;
  permissions: { id: number; name: string }[];
};

type Props = {
  roles: Role[];
  onSave: (roles: Role[]) => void;
  onCancel: () => void;
};

export default function RoleReorderer({ roles: initialRoles, onSave, onCancel }: Props) {
  const [roles, setRoles] = useState<Role[]>(
    [...initialRoles].sort((a, b) => a.index - b.index)
  );

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = roles.findIndex((r) => r.id === Number(active.id));
    const newIndex = roles.findIndex((r) => r.id === Number(over.id));

    const reordered = arrayMove(roles, oldIndex, newIndex).map((r, i) => ({
      ...r,
      index: i,
    }));

    setRoles(reordered);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={onCancel}
          className="text-sm text-white bg-zinc-600 hover:bg-zinc-700 px-4 py-2 rounded-lg"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(roles)}
          className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
        >
          Save Order
        </button>
      </div>

      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        sensors={sensors}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={roles.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          {roles.map((role) => (
            <SortableRoleCard key={role.id} role={role} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
