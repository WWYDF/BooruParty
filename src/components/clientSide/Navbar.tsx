'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full px-6 py-4 flex items-center justify-between bg-secondary border-b border-secondary-border shadow-md"
    >
      <Link href="/" className="text-2xl font-bold text-accent tracking-tight">
        Imageboard
      </Link>
      <div className="flex gap-6 text-sm text-subtle font-medium">
        <Link href="/upload" className="hover:text-accent transition">
          Upload
        </Link>
        <Link href="/dashboard" className="hover:text-accent transition">
          Dashboard
        </Link>
      </div>
    </motion.nav>
  );
}
