"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { motion } from "framer-motion";

export default function PostNavigator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-between items-center w-full"
    >
      <button
        onClick={() => console.log("Prev post")}
        className="flex items-center gap-1 text-subtle hover:text-accent"
      >
        <CaretLeft size={28} weight="bold" />
        <span className="text-sm">Previous</span>
      </button>

      <button
        onClick={() => console.log("Next post")}
        className="flex items-center gap-1 text-subtle hover:text-accent"
      >
        <span className="text-sm">Next</span>
        <CaretRight size={28} weight="bold" />
      </button>
    </motion.div>
  );
}