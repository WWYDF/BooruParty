import { Prisma } from "../../../prisma/client";


// Fields that anyone can see about a user
export const publicUserSelect = {
  id: true,
  username: true,
  private: true,
  lastLogin: true,
  createdAt: true,
  role: {
    select: {
      name: true,
      color: true,
      index: true
    }
  },
  preferences: {
    select: {
      profileBackground: true
    }
  }
} satisfies Prisma.UserSelect;