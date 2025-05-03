"use client";

import { useState } from "react";
import { PoolCard } from "@/components/clientSide/Pools/PoolCard";
import { PoolEditForm } from "./EditMetadata";
import { PoolReorderGrid } from "./PoolReorderGrid";
import { motion } from "framer-motion";
import { useToast } from "../../Toast";

export type PoolItem = {
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
  const [poolData, setPoolData] = useState(pool);
  const [name, setName] = useState(poolData.name);
  const [artist, setArtist] = useState(poolData.artist || "");
  const [description, setDescription] = useState(poolData.description || "");
  const [order, setOrder] = useState<{ id: number; index: number }[] | null>(null);
  const toast = useToast();

  const handleSave = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/pools/${pool.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        artist,
        description,
        order: order ?? undefined
      })
    });
  
    if (!res.ok) {
      console.error("Failed to save pool");
      toast('Failed to save changes.', 'error');
      return;
    }
  
    const refreshed = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/pools/${pool.id}`);
    if (refreshed.ok) {
      setPoolData(await refreshed.json());
      setEditMode(false);
      setOrder(null);
      toast('Saved Changes!', 'success');
    }
  };

  return (
    <main className="w-full">
      {/* Hero Section */}
      <motion.section
        className="relative h-48 sm:h-64 md:h-72 lg:h-80 w-full overflow-hidden"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {pool.items[0]?.post.previewPath && (
          <img
            src={pool.items[0].post.previewPath}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />

        {/* Header content */}
        <div className="relative z-20 h-full flex flex-col justify-end px-4 pb-4 max-w-screen-2xl mx-auto">
          {editMode ? (
            <PoolEditForm
              name={name}
              artist={artist}
              description={description}
              onNameChange={setName}
              onArtistChange={setArtist}
              onDescriptionChange={setDescription}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-x-3 mb-1">
                <h1 className="text-3xl font-bold text-white">{poolData.name}</h1>
                {poolData.artist && (
                  <div className="text-sm text-white/80 font-medium">by {poolData.artist}</div>
                )}
                <button
                  onClick={() => setEditMode(true)}
                  className="text-xs px-2 py-1 border rounded bg-black/40 text-white ml-auto hover:bg-white/10"
                >
                  Edit
                </button>
              </div>
              {poolData.description && (
                <p className="text-sm text-white/80 max-w-2xl">{poolData.description}</p>
              )}
            </>
          )}
        </div>
      </motion.section>

      {/* Edit Mode Buttons */}
      {editMode && (
        <div className="max-w-screen-2xl mx-auto px-4 mt-4 flex gap-3">
          <button
            onClick={handleSave}
            className="bg-green-600 text-white px-4 py-1.5 rounded text-sm"
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditMode(false);
              setName(poolData.name);
              setArtist(poolData.artist || "");
              setDescription(poolData.description || "");
              setOrder(null);
            }}
            className="bg-neutral-700 text-white px-4 py-1.5 rounded text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Post Grid */}
      <section className="max-w-screen-2xl mx-auto px-2 sm:px-4 py-6">
        {editMode ? (
          <PoolReorderGrid items={poolData.items} onReorderDone={setOrder} />
        ) : (
          <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {poolData.items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
              >
                <PoolCard
                  id={item.post.id}
                  name={`#${item.index + 1}`}
                  artist={null}
                  coverUrl={item.post.previewPath}
                  safety={item.post.safety}
                  showOverlay={false}
                  linkTo={`/post/${item.post.id}`}
                />
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
