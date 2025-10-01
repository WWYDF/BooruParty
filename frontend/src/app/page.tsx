'use client';

import PostDisplay from '@/components/clientSide/Posts/Individual/PostDisplay';
import { Post } from '@/core/types/posts';
import { LEGIBLE_VERSION } from '@/core/version';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => {
    const fetchFeaturedPost = async () => {
      const res = await fetch('/api/posts/featured');
      const resJson = await res.json();
      setPost(resJson?.data?.post ?? null);
    };
    fetchFeaturedPost();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <section className="pt-12 pb-6 px-4 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-4xl font-bold mb-2"
        >
          Welcome to {process.env.NEXT_PUBLIC_SITE_NAME ?? 'Imageboard'}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-lg text-gray-300 max-w-lg mx-auto"
        >
          A Modern "Booru" Board utilizing the latest technology for the best experience. Please enjoy your stay :)
          <br /><br />
          Currently running <a href='https://github.com/WWYDF/BooruParty' className='hover:underline text-accent'>BooruParty</a> {LEGIBLE_VERSION}!
        </motion.p>
      </section>

      {post && (
        <section className="px-4 pb-12 mt-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Featured Post</h2>
          <Link href={`/post/${post.id}`} className="inline-block">
            <PostDisplay post={post} showVoting={false} disableFullscreen={true} />
          </Link>
        </section>
      )}
    </main>
  );
}
