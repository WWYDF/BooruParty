"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PoolCard } from "@/components/clientSide/Pools/PoolCard";
import { CreatePoolModal } from "./CreateModal";
import { Pool } from "@/core/types/pools";
import PoolPagination from "./PoolPagination";
import { useRouter, useSearchParams } from "next/navigation";


export function ClientPoolGrid() {
  const [allPools, setAllPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const pageParam = searchParams.get("page");
    if (pageParam) setCurrentPage(parseInt(pageParam));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
  
    fetch(`/api/pools?search=${encodeURIComponent(debouncedQuery)}&page=${currentPage}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        setAllPools(data.pools || []);
        setTotalPages(Math.ceil((data.total || 0) / (data.limit || 25)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  
    return () => controller.abort();
  }, [debouncedQuery, currentPage]);

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
        {allPools.map((pool, i) => (
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

      <div className="flex justify-center mt-6">
        <PoolPagination
          page={currentPage}
          totalPages={totalPages}
          setPage={(page) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("page", page.toString());
        
            router.replace(`?${params.toString()}`);
            setCurrentPage(page);
            setLoading(true);
          }}
        />
      </div>

      <CreatePoolModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
