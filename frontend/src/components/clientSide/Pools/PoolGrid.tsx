"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PoolCard } from "@/components/clientSide/Pools/PoolCard";
import { CreatePoolModal } from "./CreateModal";

type Props = {
  pools: any[];
};

export function ClientPoolGrid({ pools }: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-white">Pools</h1>
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => setShowModal(true)}
          className="ml-4 px-4 py-2 rounded-md bg-darkerAccent text-white hover:bg-darkerAccent/80 transition"
        >
          + Add Pool
        </motion.button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pools.map((pool, i) => (
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
            />
          </motion.div>
        ))}
      </div>

      <CreatePoolModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
