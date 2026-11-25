import { FileType } from "../dictionary";
import { BoostState, UserSimpleSummary } from "./users";
import { PoolSummary } from "./pools";

export type Safety = 'SAFE' | 'QUESTIONABLE' | 'EXPLICIT';

// Returned when searching the Posts page(s)
export type Posts = {
  id: number,
  type: FileType,
  safety: Safety,
  fileKey: string,
  aspectRatio: number,
  sources: string[],
  notes: string | null,
  previewPath: string | null,
  
  duration: number | null,
  hasAudio: boolean,

  score: number,
  favoriteCount: number,
  boostCount: number,
  commentCount: number,
  createdAt: Date,
  viewer?: PostViewerState | null, // feed only (null for guests); related posts on the post page don't carry it

  thumbnails: {
    small: string,
    med: string,
    large: string,
  }
}

// Matches formatPostDetail from API
export type PostDetail = {
  id: number,
  type: FileType,
  safety: Safety,
  fileKey: string,
  thumbKey: string | null, // set = custom thumbnail (can be reset); null = automatic thumbnails
  aspectRatio: number,
  sources: string[],
  notes: string | null,
  
  fileSize: number, // bytes
  previewSize: number | null, // bytes
  duration: number | null,
  hasAudio: boolean | null,

  score: number,
  tags: {
    id: number,
    name: string,
    categoryId: number,
    postCount: number,
  }[],

  createdAt: Date,
  updatedAt: Date,
  uploader: UserSimpleSummary,

  originalPath: string,
  previewPath: string | null, // generated preview was larger than original
  thumbnails: {
    small: string,
    med: string,
    large: string,
  },

  favoriteCount: number,
  boostCount: number,
  commentCount: number,

  related: Posts[],   // feed-card summaries, oldest link first; only posts this viewer may see
  pools: PoolSummary[], // pools holding this post, by name
  featured: boolean,  // is this the site's featured post?
  viewer: PostViewerState | null, // the logged-in viewer's own state; null for guests
}

export type VoteValue = -1 | 0 | 1; // dislike, none, like

export type PostViewerState = {
  vote: VoteValue,
  favorited: boolean,
}

// PUT /api/posts/:id/vote
export type VoteResponse = { score: number, myVote: VoteValue };

// PUT /api/posts/:id/favorite (a new favorite may also like the post, so the vote and score come back too)
export type FavoriteResponse = { favorited: boolean, favoriteCount: number, score: number, myVote: VoteValue };

// PUT (boost) and DELETE (undo) /api/posts/:id/boost
export type BoostResponse = BoostState & { boostCount: number };

// 429 from PUT /api/posts/:id/boost
export type BoostCooldownError = { error: string, hint?: string, nextBoostAt: string };

// Every /api/posts/bulk route (vote, favorite, PATCH edit, DELETE).
// skipped = posts left alone: hidden, missing, or not yours to edit/delete
export type BulkResult = { updated: number[], skipped: number[] };

// PATCH /api/posts/bulk body. Tags are a diff; relateTo and relateEachOther are mutually exclusive
export type BulkEditBody = {
  postIds: number[],
  addTags?: string[],
  removeTags?: string[],
  safety?: Safety,
  relateTo?: number,
  relateEachOther?: true,
};

export const MAX_BULK_POSTS = 250; // backend MAX_BULK_EDITS (pool and collection batches allow the same)

// Mass editor "Related posts": leave alone, relate all to one post (relateTo), or to each other (relateEachOther)
export type RelateMode = 'none' | 'one' | 'all';

// What the feed has to do after a mass edit: drop deleted posts, reload after an edit,
// or patch its cards' viewer state after a bulk vote/favorite (ids = the updated ones only)
export type MassEditChange = {
  deleted?: number[],
  edited?: boolean,
  voted?: { ids: number[], value: VoteValue },
  favorited?: { ids: number[], favorited: boolean, autoLike: boolean }, // autoLike: new favorites were also liked
};

// GET /api/posts/:id/navigate. null = nothing that way (end of the search, or order:random)
export type PostNavigatorType = {
  previousPostId: number | null;
  nextPostId: number | null;
}