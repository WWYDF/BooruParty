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
  updatedAt: true,
  uploader: { select: userSummarySelect },
  tags: {
    select: { tag: { select: tagSummarySelect } },
    orderBy: { tag: { name: 'asc' } },
  },
} satisfies Prisma.PostSelect;

export type PostDetail = Prisma.PostGetPayload<{ select: typeof postDetailSelect }>;