'use client';

import { Post } from '@/core/types/posts';
import PostCard from './PostCard';
import Masonry from 'react-masonry-css';
import { motion } from "framer-motion";

type ViewMode = 'GRID' | 'COLLAGE';

export default function PostGrid({
  externalPosts = [],
  viewMode = 'GRID',
  selectionMode,
  selectedPostIds,
  toggleSelect
}: {
  externalPosts?: Post[];
  viewMode?: ViewMode;
  selectionMode: boolean;
  selectedPostIds: number[];
  toggleSelect: (postId: number, e: React.MouseEvent) => void;
}) {
  if (viewMode === 'COLLAGE') {
    const breakpointColumnsObj = {
      default: 4,
      3840: 10,
      2560: 8,
      1920: 6,
      1280: 4,
      768: 3,
      640: 2
    };

    // For COLLAGE view
    return (
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="flex gap-4"
        columnClassName="bg-clip-padding"
      >
        {externalPosts.map((post, index) => (
          <div key={`${post.id}-${index}`} className="mb-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.3 }}
            >
              <PostCard 
                key={`${post.id}`} 
                post={post} 
                viewMode="COLLAGE"
                selectionMode={selectionMode}
                isSelected={selectedPostIds.includes(post.id)}
                toggleSelect={(postId: number, e: any) => toggleSelect(postId, e)}
              />
            </motion.div>
          </div>
        ))}
      </Masonry>
    );
  }

  // For GRID view
  return (
    <div
      className="
        grid gap-4
        [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]
        sm:[grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]
      "
    >
      {externalPosts.map((post, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04, duration: 0.3 }}
        >
          <PostCard 
            key={`${post.id}`} 
            post={post} 
            viewMode="GRID"
            selectionMode={selectionMode}
            isSelected={selectedPostIds.includes(post.id)}
            toggleSelect={(postId: number, e: any) => toggleSelect(postId, e)}
          />
        </motion.div>
      ))}
    </div>
  );
}