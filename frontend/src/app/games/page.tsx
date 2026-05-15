'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { PuzzlePieceIcon, CaretRightIcon, QuestionIcon } from '@phosphor-icons/react';

// We'll use this page if we add more games later idk

const games = [
  {
    id: 'jigsaw',
    name: 'Jigsaw Puzzle',
    description: 'Challenge yourself with dynamic jigsaw puzzles',
    icon: PuzzlePieceIcon,
    href: '/games/jigsaw',
    color: 'from-purple-500 to-pink-500',
    bgGlow: 'bg-purple-500/20',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function GamesPage() {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Available Games
          </h1>
        </motion.div>

        {/* Games Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {games.map((game) => {
            const Icon = game.icon;
            return (
              <motion.div key={game.id} variants={item}>
                <Link href={game.href}>
                  <motion.div
                    whileHover={{ scale: 1.02, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    className="group relative bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:border-zinc-600 hover:shadow-2xl"
                  >
                    {/* Glow effect */}
                    <div className={`absolute inset-0 ${game.bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-2xl`} />
                    
                    {/* Content */}
                    <div className="relative z-10">
                      {/* Icon */}
                      <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center mb-4 shadow-lg`}>
                        <Icon className="w-8 h-8 text-white" weight="duotone" />
                      </div>

                      {/* Text */}
                      <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-purple-400 group-hover:to-pink-400 transition-all">
                        {game.name}
                      </h3>
                      <p className="text-zinc-400 mb-4">
                        {game.description}
                      </p>

                      {/* Play button */}
                      <div className="flex items-center text-purple-400 font-semibold group-hover:text-pink-400 transition-colors">
                        Play Now
                        <CaretRightIcon className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" weight="bold" />
                      </div>
                    </div>

                    {/* Decorative corner gradient */}
                    <div className={`absolute -bottom-8 -right-8 w-32 h-32 bg-gradient-to-br ${game.color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}

          {/* Coming Soon Card */}
          <motion.div variants={item}>
            <div className="relative bg-zinc-800/30 backdrop-blur-sm border border-zinc-700/50 border-dashed rounded-2xl p-6 h-full flex flex-col items-center justify-center text-center min-h-[280px]">
              <div className="w-16 h-16 rounded-xl bg-zinc-700/50 flex items-center justify-center mb-4">
                <div className="text-4xl text-zinc-500"><QuestionIcon /></div>
              </div>
              <h3 className="text-xl font-bold text-zinc-500 mb-2">
                More Games
              </h3>
              <p className="text-zinc-600 text-sm">
                Coming soon...
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}