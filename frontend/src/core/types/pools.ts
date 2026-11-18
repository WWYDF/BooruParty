import { Posts, Safety } from "./posts";

// A tag as the API's tagSummarySelect returns it
export type TagSummary = {
  id: number;
  name: string;
  categoryId: number;
  postCount: number; // site-wide
};

// A tag on a pool page: poolCount = how many of the pool's posts (that you can see) carry it
export type PoolTag = TagSummary & { poolCount: number };

// poolSummarySelect
type PoolBase = {
  id: number;
  name: string;
  description: string | null;
  yearStart: number | null;
  yearEnd: number | null; // null with a yearStart = ongoing
  favoriteCount: number;
  updatedAt: string;
  createdAt: string;
};

// Pool card: GET /api/pools items and PostDetail.pools.
// Everything past PoolBase only counts posts the viewer can see.
export type PoolSummary = PoolBase & {
  postCount: number;
  safety: Safety | null;      // most unsafe visible post; null = empty
  cover: Posts | null;        // first visible post
  artist: TagSummary | null;  // CREATOR tag on the most posts
};

// GET /api/pools/:id
export type PoolDetail = PoolBase & {
  safety: Safety | null;
  artists: PoolTag[];  // most common first; [0] is the primary artist
  tags: PoolTag[];     // every tag on the pool's posts, most common first
  posts: Posts[];      // in pool order
  viewer: { favorited: boolean } | null; // null for guests
};

export type PoolSort = 'updated' | 'newest' | 'oldest' | 'favorites' | 'size' | 'name';

// GET /api/pools
export type PoolList = {
  pools: PoolSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// GET /api/pools/:id/navigate. null = nothing that way
export type PoolNavigation = {
  previousPostId: number | null;
  nextPostId: number | null;
  position: number; // 1-based, among posts you can see
  total: number;
};

// PUT /api/pools/:id/favorite
export type PoolFavoriteResponse = { favorited: boolean; favoriteCount: number };
