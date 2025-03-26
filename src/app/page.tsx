'use client';

import Navbar from '@/components/clientSide/Navbar';
import { motion } from 'framer-motion';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-900 text-white flex flex-col">
      <Navbar />
      <section className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-4xl font-bold mb-2"
        >
          Welcome to Imageboard
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-lg text-gray-300 max-w-xl"
        >
          Effortlessly upload, manage, and share your images. Built with modern tech and speed in mind.
        </motion.p>
      </section>
    </main>
  );
}
