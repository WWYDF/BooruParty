import { Prisma } from "../../../../prisma/client";

// Basic fields anyone can see about a user (surface level stuff)
export const userSummarySelect = {
  id: true,
  username: true,
  avatarKey: true,
  about: true,
  private: true,
  lastSeen: true,
  updatedAt: true,
  createdAt: true,
  role: { select: { name: true, color: true, index: true } },
} satisfies Prisma.UserSelect;

// Advanced fields anyone can see about a user (profile specific stuff)
export const userDetailedSelect = {
  id: true,
  username: true,
  avatarKey: true,
  private: true,
  lastSeen: true,
  updatedAt: true,
  createdAt: true,
  role: { select: { name: true, color: true, index: true } },
} satisfies Prisma.UserSelect;

// A tag as it appears on a post or in a list: enough to render a colored chip
export const tagSummarySelect = {
  id: true,
  name: true,
  categoryId: true,
  postCount: true,
} satisfies Prisma.TagSelect;

// A post as it appears in a feed grid: enough to render a thumbnail card
export const postSummarySelect = {
  id: true,
  type: true,
  safety: true,
  fileKey: true,      // automatic thumbnail URLs are derived from this
  thumbKey: true,     // custom thumbnail URLs are derived from this
  previewPath: true,
  aspectRatio: true,
  duration: true,
  hasAudio: true,
  score: true,
  favoriteCount: true,
  _count: { select: { comments: true } },
  createdAt: true,
} satisfies Prisma.PostSelect;

export type UserSummary = Prisma.UserGetPayload<{ select: typeof userSummarySelect }>;
export type TagSummary  = Prisma.TagGetPayload<{ select: typeof tagSummarySelect }>;
export type PostSummary = Prisma.PostGetPayload<{ select: typeof postSummarySelect }>;
