'use client';

import PostDisplay from '@/components/clientSide/Posts/Individual/PostDisplay';
import { Post } from '@/core/types/posts';
import { LEGIBLE_VERSION } from '@/core/constants/version';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useSearchBarLogic } from '@/core/searchBarLogic';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [post, setPost] = useState<Post | null>(null);
  const [postCount, setPostCount] = useState<number>(0);
  const [input, setInput] = useState('');
  const router = useRouter();

  const onSubmit = (query?: string) => {
    const searchQuery = query || input;
    if (searchQuery.trim()) {
      router.push(`/posts?query=${encodeURIComponent(searchQuery)}`);
    }
  };

  const {
    suggestions,
    highlightedIndex,
    isFocused,
    inputRef,
    handleKeyDown,
    handleChange,
    handleSuggestionClick,
    handleSubmit,
    handleFocus,
    handleBlur,
  } = useSearchBarLogic({ input, setInput, onSubmit });

  const handleSearch = (e: any) => {
    e.preventDefault();
    handleSubmit();
  };

  const handleLucky = async (e: any) => {
    e.preventDefault();
    const res = await fetch('/api/posts/random');
    const resJson = await res.json();
    const postId = resJson.post.id;
    router.push(`/post/${postId}`)
  };

  useEffect(() => {
    const fetchFeaturedPost = async () => {
      const res = await fetch('/api/posts/featured');
      const resJson = await res.json();
      setPost(resJson?.data?.post ?? null);
    };
    fetchFeaturedPost();
  }, []);

  useEffect(() => {
    const fetchPostCount = async () => {
      const res = await fetch('/api/system/stats');
      const resJson = await res.json();
      setPostCount(Number(resJson?.totalPosts) ?? 0);
    };
    fetchPostCount();
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

      <section>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className='flex justify-center'
        >
          <form onSubmit={handleSearch} className="w-full max-w-2xl space-y-6">
            {/* Search Bar */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full px-6 py-4 bg-zinc-900 text-white text-lg rounded-xl shadow-xl focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                placeholder={`Search ${postCount} posts...`}
                autoComplete="off"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <MagnifyingGlassIcon size={20} className='text-zinc-300' />
              </div>

              {/* Autocomplete dropdown */}
              {isFocused && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-full bg-zinc-900/50 border border-zinc-800 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto"
                >
                  {suggestions.map((tag, idx) => (
                    <div
                      key={tag.id}
                      onClick={() => handleSuggestionClick(tag.name)}
                      className={`flex items-center px-6 py-3 text-sm cursor-pointer transition-colors ${
                        highlightedIndex === idx
                          ? "bg-zinc-800/50 text-white"
                          : "hover:bg-zinc-700/50"
                      }`}
                    >
                      <div
                        className="mr-3"
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: tag.category.color,
                        }}
                      />
                      <span>
                        {input.trim().split(/\s+/).pop()?.startsWith("-")
                          ? `-${tag.name}`
                          : tag.name}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="submit"
                className="px-6 py-3 bg-zinc-900 text-zinc-200 rounded-md hover:bg-zinc-800 transition-all font-medium"
              >
                Search Posts
              </button>
              <button
                type="button"
                onClick={handleLucky}
                className="px-6 py-3 bg-zinc-900 text-zinc-200 rounded-md hover:bg-zinc-800 transition-all font-medium"
              >
                I'm Feeling Lucky
              </button>
            </div>
          </form>
        </motion.div>
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
