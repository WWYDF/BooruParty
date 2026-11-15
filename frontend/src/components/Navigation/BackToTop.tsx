"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CaretUp } from "phosphor-react"; // ✅ phosphor-react!

export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > window.innerHeight);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-[9999] flex items-center justify-center rounded-full bg-accent border-4 border-secondary-border text-secondary-border hover:bg-darkerAccent transition-all
                     w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16"
          aria-label="Back to top"
        >
          <CaretUp
            weight="bold"
            className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7"
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
