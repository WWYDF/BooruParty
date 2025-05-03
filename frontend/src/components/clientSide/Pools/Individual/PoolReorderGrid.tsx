
// @/components/clientSide/Pools/PoolReorderGrid.tsx
"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { PoolCard } from "@/components/clientSide/Pools/PoolCard";

type PoolItem = {
  id: number;
  index: number;
  notes: string | null;
  post: {
    id: number;
    previewPath: string;
    safety: string;
  };
};

type Props = {
  items: PoolItem[];
  onReorderDone: (newOrder: { id: number; index: number }[]) => void;
};

export function PoolReorderGrid({ items, onReorderDone }: Props) {
  const [localItems, setLocalItems] = useState(items);
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = localItems.findIndex((item) => item.id === active.id);
    const newIndex = localItems.findIndex((item) => item.id === over.id);

    const updated = arrayMove(localItems, oldIndex, newIndex);
    setLocalItems(updated);

    const payload = updated.map((item, index) => ({
      id: item.id,
      index: index + 1
    }));

    onReorderDone(payload);
  };

  const activeItem = activeId != null ? localItems.find((i) => i.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => setActiveId(Number(event.active.id))}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={localItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {localItems.map((item) => (
            <SortablePoolItem key={item.id} item={item} />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeItem ? (
          <PoolCard
            id={activeItem.post.id}
            name={`#${activeItem.index + 1}`}
            artist={null}
            coverUrl={activeItem.post.previewPath}
            safety={activeItem.post.safety as "SAFE" | "UNSAFE" | "SKETCHY"}
            showOverlay={false}
            linkTo={undefined}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortablePoolItem({ item }: { item: PoolItem }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: transform ? 999 : undefined,
    pointerEvents: transform ? "none" : undefined
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PoolCard
        id={item.post.id}
        name={`#${item.index + 1}`}
        artist={null}
        coverUrl={item.post.previewPath}
        safety={item.post.safety as "SAFE" | "UNSAFE" | "SKETCHY"}
        showOverlay={false}
        linkTo={undefined}
      />
    </div>
  );
}
