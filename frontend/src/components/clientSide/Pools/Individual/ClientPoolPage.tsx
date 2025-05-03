"use client";

import { useState } from "react";
import { PoolCard } from "@/components/clientSide/Pools/PoolCard";

type PoolItem = {
  id: number;
  index: number;
  notes: string | null;
  post: {
    id: number;
    previewPath: string;
    safety: "SAFE" | "UNSAFE" | "SKETCHY";
    score: number;
    aspectRatio: number | null;
    uploadedById: string;
    createdAt: string;
    _count: {
      favoritedBy: number;
    };
  };
};

type Pool = {
  id: number;
  name: string;
  artist: string | null;
  description: string | null;
  lastEdited: string;
  createdAt: string;
  _count: {
    items: number;
  };
  items: PoolItem[];
};

export default function ClientPoolPage({ pool }: { pool: Pool }) {
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState(pool.name);
  const [artist, setArtist] = useState(pool.artist || "");
  const [description, setDescription] = useState(pool.description || "");

  return (
    <main className="max-w-screen-3xl mx-auto px-2 sm:px-4 py-4 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      {/* Sidebar */}
      <aside className="text-xs text-muted pr-1">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-lg font-semibold text-white">
            {editMode ? "Edit Pool" : name}
          </h1>
          <button
            onClick={() => setEditMode((v) => !v)}
            className="text-xs px-2 py-1 border rounded bg-secondary-border text-white hover:bg-white/10"
          >
            {editMode ? "Cancel" : "Edit"}
          </button>
        </div>

        {editMode ? (
          <div className="flex flex-col gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary px-2 py-1 rounded text-white border border-secondary-border"
              placeholder="Name"
            />
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="bg-secondary px-2 py-1 rounded text-white border border-secondary-border"
              placeholder="Artist"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="bg-secondary px-2 py-1 rounded text-white border border-secondary-border"
              placeholder="Description"
            />
          </div>
        ) : (
          <>
            <div className="mb-1">
              <span className="text-muted">Artist:</span> {artist || "Unknown"}
            </div>
            <div className="mb-1">
              <span className="text-muted">Posts:</span> {pool._count.items}
            </div>
            <div className="mb-1">
              <span className="text-muted">Created:</span>{" "}
              {new Date(pool.createdAt).toLocaleDateString()}
            </div>
            {description && (
              <div className="mt-3 text-subtle whitespace-pre-wrap">{description}</div>
            )}
          </>
        )}
      </aside>

      {/* Grid of posts */}
      <section className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {pool.items.map((item) => (
          <PoolCard
            key={item.id}
            id={item.post.id}
            name={`#${item.index + 1}`}
            artist={null}
            coverUrl={item.post.previewPath}
            safety={item.post.safety}
            showOverlay={false}
            linkTo={`/post/${item.post.id}`}
          />
        ))}
      </section>
    </main>
  );
}
