"use client";

import {
  DndContext,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { XIcon } from "@phosphor-icons/react";
import { PoolCard } from "../PoolCard";
import { Posts } from "@/core/types/posts";

type Props = {
  posts: Posts[];                      // current order (controlled by the parent)
  onChange: (posts: Posts[]) => void;  // after a drag or a removal
};

export function PoolReorderGrid({ posts, onChange }: Props) {
  const [activeId, setActiveId] = useState<number | null>(null);

  // A small move is needed before a drag starts, so clicks (the remove button) still work
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = posts.findIndex((p) => p.id === active.id);
    const newIndex = posts.findIndex((p) => p.id === over.id);
    onChange(arrayMove(posts, oldIndex, newIndex));
  };

  const activeIndex = activeId != null ? posts.findIndex((p) => p.id === activeId) : -1;
  const activePost = activeIndex >= 0 ? posts[activeIndex] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => setActiveId(Number(event.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={posts.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {posts.map((post, i) => (
            <SortablePoolItem
              key={post.id}
              post={post}
              position={i + 1}
              activeId={activeId}
              onRemove={() => onChange(posts.filter((p) => p.id !== post.id))}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activePost ? (
          <PoolCard
            name={`#${activeIndex + 1}`}
            coverUrl={activePost.thumbnails.med}
            showOverlay={false}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortablePoolItem({ post, position, activeId, onRemove }: {
  post: Posts;
  position: number;
  activeId: number | null;
  onRemove: () => void;
}) {
  const isDragging = activeId === post.id;
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: post.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: transform ? 999 : undefined,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative cursor-grab active:cursor-grabbing">
      <PoolCard
        name={`#${position}`}
        coverUrl={post.thumbnails.med}
        showOverlay={false}
      />

      {/* Position */}
      <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white tabular-nums">
        #{position}
      </span>

      {/* Remove from pool (staged until Save) */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        title={`Remove post #${post.id} from this pool`}
        className="absolute top-2 right-2 cursor-pointer rounded-full bg-black/70 p-1 text-white transition hover:bg-red-600"
      >
        <XIcon size={14} weight="bold" />
      </button>
    </div>
  );
}
