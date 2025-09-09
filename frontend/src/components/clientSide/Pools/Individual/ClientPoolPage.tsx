"use client";

import { useEffect, useState } from "react";
import { PoolCard } from "@/components/clientSide/Pools/PoolCard";
import { PoolEditForm } from "./EditMetadata";
import { PoolReorderGrid } from "./PoolReorderGrid";
import { motion } from "framer-motion";
import { useToast } from "../../Toast";
import { Pool } from "@/core/types/pools";
import ConfirmModal from "../../ConfirmModal";
import { useRouter } from "next/navigation";
import { ArrowFatDown, ArrowFatUp } from "phosphor-react";

export default function ClientPoolPage({ pool }: { pool: Pool }) {
  const [editMode, setEditMode] = useState(false);
  const [poolData, setPoolData] = useState(pool);
  const [name, setName] = useState(poolData.name);
  const [artist, setArtist] = useState(poolData.artist || "");
  const [description, setDescription] = useState(poolData.description || "");
  const [safety, setSafety] = useState(poolData.safety || "");
  const [order, setOrder] = useState<{ id: number; index: number }[] | null>(null);
  const [yearStart, setYearStart] = useState<number | null>(poolData.yearStart ?? null);
  const [yearEnd, setYearEnd] = useState<number | null>(poolData.yearEnd ?? null);
  const [showConfirmDel, setShowConfirmDel] = useState(false);
  const [currentVote, setCurrentVote] = useState<1 | -1 | 0>(pool.user.vote ?? 0);
  const [score, setScore] = useState(pool.score ?? 0);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    setCurrentVote(poolData.user.vote);
    setScore(poolData.score);
  }, [poolData.user.vote, poolData.score]);

  const handleSave = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/pools/${pool.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        artist,
        safety,
        description,
        yearStart,
        yearEnd,
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

  const handleVote = async (voteValue: 1 | -1) => {
    try {
      const res = await fetch(`/api/pools/${pool.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: voteValue }),
      });
  
      const data = await res.json();
      if (res.ok) {
        setCurrentVote(data.vote);  // set immediately
        setScore(data.score);       // set immediately
  
        // Optional: re-fetch full pool info to get updated .user.vote too
        const refreshed = await fetch(`/api/pools/${pool.id}`);
        if (refreshed.ok) {
          const fresh = await refreshed.json();
          setPoolData(fresh);
          setCurrentVote(fresh.user.vote); // ← critical for full refresh correctness
          setScore(fresh.score);
        }
      } else {
        toast(data.error || "Failed to vote", "error");
      }
    } catch (err) {
      console.error(err);
      toast("Voting failed", "error");
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
        {pool.items[1]?.post.previewPath && (
          <img
            src={pool.items[1].post.previewPath}
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
              safety={safety}
              yearStart={yearStart}
              yearEnd={yearEnd}
              onNameChange={setName}
              onArtistChange={setArtist}
              onDescriptionChange={setDescription}
              onSafetyChange={setSafety}
              onYearStartChange={setYearStart}
              onYearEndChange={setYearEnd}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 justify-between mb-1">
                {/* pool data on left */}
                <div className="flex flex-wrap items-end gap-x-3">
                  <h1 className="text-3xl font-bold text-white">{poolData.name}</h1>
                  {poolData.artist && (
                    <div className="text-sm text-white/80 font-medium">by {poolData.artist}</div>
                  )}
                </div>

                {/* edit and votes on right */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditMode(true)}
                    className="text-base px-2 py-1 border border-black rounded-lg bg-zinc-950 hover:bg-zinc-900 transition text-white"
                  >
                    Edit
                  </button>

                  {/* voting */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVote(1)}
                      className={`p-1 rounded hover:bg-white/10 transition ${
                        currentVote === 1 ? "text-accent" : "text-white/60"
                      }`}
                      title="Upvote"
                    >
                      <ArrowFatUp size={20} weight={currentVote === 1 ? "fill" : "regular"} />
                    </button>

                    <span className="text-sm text-subtle">{score}</span>

                    <button
                      onClick={() => handleVote(-1)}
                      className={`p-1 rounded hover:bg-white/10 transition ${
                        currentVote === -1 ? "text-accent" : "text-white/60"
                      }`}
                      title="Downvote"
                    >
                      <ArrowFatDown size={20} weight={currentVote === -1 ? "fill" : "regular"} />
                    </button>
                  </div>
                </div>
              </div>
              {poolData.description && (
                <p className="text-sm text-white/80 max-w-2xl mb-1">{poolData.description}</p>
              )}
              <p className="text-xs text-zinc-400 max-w-2xl mb-1">(Contains {poolData._count.items} pages)</p>
              {poolData.yearStart && (
                <p className="text-sm text-subtle font-medium">
                  {poolData.yearStart}{" "}
                  <span className="mx-1 text-white/40">——</span>{" "}
                  {poolData.yearEnd ?? "Present"}
                </p>
              )}
            </>
          )}
        </div>
      </motion.section>

      {/* Edit Mode Buttons */}
      {editMode && (
        <div className="max-w-screen-2xl mx-auto px-4 pt-4 flex justify-between items-center">
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 transition text-white px-4 py-1.5 rounded text-sm"
              >
              Save
            </button>
            <button
              onClick={() => {
                setEditMode(false);
                setName(poolData.name);
                setArtist(poolData.artist || "");
                setSafety(poolData.safety || "");
                setDescription(poolData.description || "");
                setOrder(null);
              }}
              className="bg-zinc-700 hover:bg-zinc-800 transition text-white px-4 py-1.5 rounded text-sm"
              >
              Cancel
            </button>
          </div>

          <button
            onClick={() => setShowConfirmDel(true)}
            className="text-sm text-red-500 border border-red-500 hover:bg-red-500 hover:text-white transition px-3 py-1.5 rounded"
          >
            Delete Pool
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
                  linkTo={`/post/${item.post.id}?pool=${pool.id}`}
                />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={showConfirmDel}
        onClose={() => setShowConfirmDel(false)}
        onConfirm={async () => {
          const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/pools/${pool.id}`, {
            method: "DELETE"
          });
          if (res.ok) {
            router.push('/pools');
            toast("Pool deleted!", "success");
          } else {
            toast("Failed to delete pool.", "error");
          }
        }}
        title="Delete this pool?"
        description={`This will permanently delete the pool, though not the posts associated.\nThis cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </main>
  );
}
