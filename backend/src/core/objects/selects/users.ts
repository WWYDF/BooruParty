import { Prisma } from "../../../../prisma/client";
import { tagChipSelect, userSummarySelect } from "./summaries";

// Extended info about a user, used for their profile page
export const userProfileSelect = {
  ...userSummarySelect,
  preferences: { select: { profileBackground: true } },
  favoriteTags: {
    orderBy: [{ tag: { category: { index: 'asc' } } }, { tag: { name: 'asc' } }],
    take: 100, // hard ceiling regardless of maxFavoriteTags setting
    select: { tag: { select: tagChipSelect } }
  }
} satisfies Prisma.UserSelect;

export type UserProfile = Prisma.UserGetPayload<{ select: typeof userProfileSelect }>;
