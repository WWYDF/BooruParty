import { FileType } from "../dictionary";
import { Tag, TagGroup } from "./tags";
import { UserSimpleSummary } from "./users";

export type Safety = 'SAFE' | 'QUESTIONABLE' | 'EXPLICIT';

// Returned when searching an individual post
// Has new sturcture, but will be phased out over time in favor of PostDetail
export type Post = {
  id: number,
  type: FileType,
  safety: Safety,
  fileKey: string,
  aspectRatio: number,
  sources: string[],
  notes: string | null,
  
  fileSize: number, // bytes
  previewSize: number, // bytes
  duration: number | null,
  hasAudio: boolean,

  score: number,
  tags: [],

  createdAt: Date,
  uploader: UserSimpleSummary,

  originalPath: string,
  previewPath: string,
  thumbnails: {
    small: string,
    med: string,
    large: string,
  }
}

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
  commentCount: number,

  related: Posts[],   // feed-card summaries, oldest link first; only posts this viewer may see
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

// GET /api/posts/:id/navigate. null = nothing that way (end of the search, or order:random)
export type PostNavigatorType = {
  previousPostId: number | null;
  nextPostId: number | null;
}


// Fastify Response
export type FastifyUpload = {
  status: string,
  postId: number,
  type: FileType,
  previewScale: number | null,
  aspectRatio: number,
  deletedPreview?: boolean,
  fileName?: string
  assignedExt: 'mp4' | 'webm' | 'mkv' | 'webp' | 'gif' | null,
  transType?: FileType,
  finalExt: 'mp4' | 'webm' | 'mkv' | 'webp' | 'gif',
  fileSize: number,
  previewSize?: number,
  previewPath: string,
  originalPath: string,
  duration?: number,
  hasAudio: boolean,
}