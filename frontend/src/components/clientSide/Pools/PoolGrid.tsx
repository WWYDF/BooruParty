"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PoolCard } from "@/components/clientSide/Pools/PoolCard";
import { CreatePoolModal } from "./CreateModal";

type Props = {
  pools: any[];
};

export function ClientPoolGrid({ pools }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  const query = debouncedQuery.toLowerCase();
  const yearMatch = query.match(/year:(\d{4})/);
  const orderMatch = query.match(/order:(score_asc|score)/);

  const queryText = query
    .replace(/year:\d{4}/, "")
    .replace(/order:(score_asc|score)/, "")
    .trim();

  const filteredPools = pools
    .filter((pool) => {
      const matchesText =
        (pool.name + " " + (pool.artist ?? "")).toLowerCase().includes(queryText);

      const matchesYear =
        !yearMatch || pool.yearStart?.toString() === yearMatch[1];

      return matchesText && matchesYear;
    })
    .sort((a, b) => {
      if (!orderMatch) return 0;
      return orderMatch[1] === "score_asc"
        ? a.score - b.score
        : b.score - a.score;
    });


  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250); // adjust debounce delay here
  
    return () => clearTimeout(timeout);
  }, [searchQuery]);
  

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-4">Pools</h1>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
        <motion.input
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search pools..."
          className="w-full sm:max-w-xs px-3 py-2 rounded-md bg-secondary border border-secondary-border text-subtle focus:outline-none focus:ring-2 focus:ring-zinc-800"
        />

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => setShowModal(true)}
          className="w-full sm:w-auto px-4 py-2 rounded-md bg-darkerAccent text-white hover:bg-darkerAccent/80 transition"
        >
          + Add Pool
        </motion.button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filteredPools.map((pool, i) => (
          <motion.div
            key={pool.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
          >
            <PoolCard
              id={pool.id}
              name={pool.name}
              artist={pool.artist ?? "Unknown"}
              coverUrl={pool.items?.[0]?.post?.previewPath}
              safety={pool.safety}
              linkTo={`/pools/${pool.id}`}
              yearStart={pool.yearStart}
              yearEnd={pool.yearEnd}
              score={pool.score}
            />
          </motion.div>
        ))}
      </div>

      <CreatePoolModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
