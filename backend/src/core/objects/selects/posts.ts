import { Prisma } from "../../../../prisma/client";
import { postSummarySelect, tagSummarySelect, userSummarySelect } from "./summaries";

// Everything the single post needs
export const postDetailSelect = {
  ...postSummarySelect,
  originalPath: true,
  previewPath: true,
  sources: true,
  notes: true,
  fileSize: true,
  previewSize: true,
  score: true,
  favoriteCount: true,
  boostCount: true,
  updatedAt: true,
  uploader: { select: userSummarySelect },
  tags: {
    select: { tag: { select: tagSummarySelect } },
    orderBy: { tag: { name: 'asc' } },
  },
} satisfies Prisma.PostSelect;

// The fields isHiddenFrom needs. Spread it into any post select: { ...postVisibilitySelect, score: true }
export const postVisibilitySelect = {
  safety: true,
  uploader: { select: { id: true, private: true } },
} satisfies Prisma.PostSelect;

export type PostDetail = Prisma.PostGetPayload<{ select: typeof postDetailSelect }>;