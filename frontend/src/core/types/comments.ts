import { Posts } from './posts';
import { UserSimpleSummary } from './users';

// Parsed by the server from `content`. Only these are embeds; any other link is plain text.
type CommentEmbeds = {
  postIds: number[]; // ":123:" tokens, unique, in order of appearance
  media: string[];   // https URLs on the server's media allowlist (GIFs etc.)
};

// One comment, as returned by GET/POST/PATCH
export type PostComment = {
  id: number;
  content: string;
  editedAt: string | null; // null = never edited
  createdAt: string;
  author: UserSimpleSummary;
  embeds: CommentEmbeds;
};

// Embedded posts this viewer may see, keyed by id. A missing id = deleted or hidden (render "unavailable").
export type EmbeddedPosts = Record<number, Posts>;

// GET /api/posts/:id/comments (newest first)
export type CommentPage = {
  comments: PostComment[];
  nextCursor: number | null;
  embeddedPosts: EmbeddedPosts;
};

// GET /api/users/:username/comments: each comment also carries the post it's on (only posts the viewer would see listed)
export type UserComment = PostComment & { post: Posts };

export type UserCommentPage = {
  comments: UserComment[];
  nextCursor: number | null; // pass back as ?cursor= for the next (older) page
  embeddedPosts: EmbeddedPosts;
};

// POST /api/posts/:id/comments and PATCH /api/comments/:commentId
export type CommentWriteResponse = {
  comment: PostComment;
  embeddedPosts: EmbeddedPosts;
};
