'use client';

import Link from 'next/link';
import { PostDetail } from '@/core/types/posts';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { MagnifyingGlassIcon, StarIcon } from '@phosphor-icons/react';
import { useSearchBarLogic } from '@/core/searchBarLogic';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/UserProvider';
import { useToast } from '@/components/UI/Toast';
import { API } from '@/core/api';

function NumberDisplay({ number, size = 'w-16' }: { number: number, size?: string }) {
  const digits = String(number).split('');

  return (
    <div className="flex items-center gap-1">
      {digits.map((digit, index) => (
        <img
          key={index}
          src={`/i/numbers/${digit}.webp`}
          alt={digit}
          className={`${size}`} // add bg-red-500 for debugging easier
        />
      ))}
    </div>
  );
}

export default function HomePage() {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [postCount, setPostCount] = useState<number>(0);
  const [input, setInput] = useState('');
  const [rolling, setRolling] = useState(false);
  const { user } = useUser();
  const router = useRouter();
  const toast = useToast();

  // Same rule as the Navbar: guests always see browse stuff; the API answers 401 if guest access is off
  const canBrowse = user ? user.permissions.includes('posts.view') : true;

  const onSubmit = (query?: string) => {
    const searchQuery = (query ?? input).trim();
    if (searchQuery) router.push(`/posts?query=${encodeURIComponent(searchQuery)}`);
  };

  const {
    suggestions,
    highlightedIndex,
    setHighlightedIndex,
    isFocused,
    inputRef,
    applySuggestion,
    handleKeyDown,
    handleChange,
    handleSelect,
    handleSubmit,
    handleFocus,
    handleBlur,
  } = useSearchBarLogic({ input, setInput, onSubmit });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  // One random post the viewer is allowed to see (the feed's own order:random handles safety + privacy)
  const handleLucky = async () => {
    setRolling(true);
    try {
      const params = new URLSearchParams({ q: 'order:random', limit: '1' });
      const res = await API(`/api/posts?${params}`);
      const data = res.ok ? await res.json() : null;
      const id: number | undefined = data?.posts?.[0]?.id;
      if (id) router.push(`/post/${id}`);
      else toast(res.status === 401 ? 'Log in to view posts' : 'No posts to pick from yet', 'error');
    } catch {
      toast('The server could not be reached', 'error');
    } finally {
      setRolling(false);
    }
  };

  // Featured post: /featured gives the summary (or null), then the full post for its file paths
  useEffect(() => {
    if (user === undefined) return; // wait for the session, so a logged-in viewer gets their own safety rules
    let cancelled = false;

    (async () => {
      try {
        const res = await API('/api/posts/featured');
        if (!res.ok) return;
        const { post: featured } = await res.json();
        if (!featured) { if (!cancelled) setPost(null); return; }

        const detailRes = await API(`/api/posts/${featured.id}`);
        if (detailRes.ok && !cancelled) setPost(await detailRes.json());
      } catch {
        // no featured post on screen is fine
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    API('/api/system/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((stats) => setPostCount(Number(stats?.postCount) || 0))
      .catch(() => {});
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
          Welcome to {process.env.NEXT_PUBLIC_SITE_NAME ?? 'BooruParty'}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-lg text-gray-300 max-w-lg mx-auto"
        >
          A Modern "Booru" Board utilizing the latest technology for the best experience. Please enjoy your stay! ❤️
        </motion.p>
      </section>

      {/* Post Numbers */}
      {canBrowse && postCount > 0 && (
        <section>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className='flex justify-center'
          >
            <div className='w-full max-w-1/2 flex justify-center'>
              <NumberDisplay number={postCount} size='w-24 md:w-48'/>
            </div>
          </motion.div>
        </section>
      )}

      {/* Search Bar + Buttons */}
      <section className="px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className='flex justify-center mt-6'
        >
          <form onSubmit={handleSearch} className="w-full max-w-2xl space-y-6">
            {/* Search Bar */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleChange}
                onSelect={handleSelect}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full px-6 py-4 bg-zinc-900 text-white text-lg rounded-xl shadow-xl focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                placeholder={postCount > 0 ? `Search ${postCount.toLocaleString()} posts...` : 'Search posts...'}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                className="absolute right-6 top-1/2 -translate-y-1/2 cursor-pointer text-zinc-300 hover:text-white transition-colors"
                title="Search"
              >
                <MagnifyingGlassIcon size={20} />
              </button>

              {/* Autocomplete dropdown (same suggestions as the posts page search bar) */}
              {isFocused && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-full bg-zinc-900/95 border border-zinc-800 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto"
                >
                  {suggestions.map((s, idx) => (
                    <div
                      key={s.key}
                      // mousedown + preventDefault keeps focus in the input, so blur doesn't close the list first
                      onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`flex items-center gap-3 px-6 py-3 text-sm cursor-pointer transition-colors ${
                        highlightedIndex === idx ? 'bg-zinc-800/80 text-white' : 'hover:bg-zinc-800/50'
                      }`}
                    >
                      {s.color ? (
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-500" /> // system term
                      )}

                      <span className="truncate">
                        {s.alias && <span className="text-subtle">{s.alias} → </span>}
                        {s.label}
                      </span>

                      {s.count !== undefined && (
                        <span className="ml-auto text-xs text-subtle shrink-0">{s.count.toLocaleString()}</span>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="submit"
                className="px-6 py-3 cursor-pointer bg-zinc-900 text-zinc-200 rounded-md hover:bg-zinc-800 transition-colors font-medium"
              >
                Search Posts
              </button>
              <button
                type="button"
                onClick={handleLucky}
                disabled={rolling}
                className="px-6 py-3 cursor-pointer bg-zinc-900 text-zinc-200 rounded-md hover:bg-zinc-800 transition-colors font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                I'm Feeling Lucky
              </button>
            </div>
          </form>
        </motion.div>
      </section>

      {/* Featured Post */}
      {post && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="px-4 pb-12 mt-12 flex flex-col items-center"
        >
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-semibold">
            <StarIcon size={22} weight="fill" className="text-yellow-400" />
            Featured Post
            <StarIcon size={22} weight="fill" className="text-yellow-400" />
          </h2>
          {/* aspectRatio reserves the space before the file loads, so the page doesn't jump */}
          <Link
            href={`/post/${post.id}`}
            className="block max-h-[70vh] w-full max-w-3xl overflow-hidden rounded-xl"
            style={{ aspectRatio: post.aspectRatio }}
          >
            {post.type === 'VIDEO' ? (
              // Muted + playsInline are required for browsers to allow autoplay
              <video
                src={post.previewPath ?? post.originalPath}
                poster={post.thumbnails.large}
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              <img
                src={post.previewPath ?? post.originalPath}
                alt={`Featured post #${post.id}`}
                className="h-full w-full object-contain"
              />
            )}
          </Link>
        </motion.section>
      )}
    </main>
  );
}
