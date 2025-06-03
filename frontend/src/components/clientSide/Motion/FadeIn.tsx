'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

export default function FadeIn({
  children,
  delay = 0,
  duration = 0.4,
  y = 20,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -y / 2 }}
      transition={{ duration, delay }}
    >
      {children}
    </motion.div>
  );
}
