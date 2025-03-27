'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full px-6 py-4 flex items-center justify-between bg-zinc-950 border-b border-zinc-800"
    >
      <Link href="/" className="text-xl font-semibold text-white">
        Imageboard
      </Link>
      <div className="flex gap-6 text-sm text-gray-400">
        <Link href="/upload" className="hover:text-white transition">Upload</Link>
        <Link href="/profile" className="hover:text-white transition">Profile</Link>
      </div>
    </motion.nav>
  );
}
