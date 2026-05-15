import { SafetyType } from "@prisma/client"
import { Tag } from "./tags"

// Contains sensitive information, be careful!
export type UserSelf = {
  id: string,
  email: string,
  username: string,
  avatar?: string,
  description?: string,
  lastLogin: Date,
  createdAt: Date,
  preferences: {
    layout: 'GRID' | 'COLLAGE',
    theme: 'DARK' | 'LIGHT',
    postsPerPage: number,
    blurUnsafeEmbeds: boolean,
    defaultSafety: SafetyType[],
    blacklistedTags: Tag[],
    flipNavigators: boolean,
    profileBackground: number,
    private: boolean,
    favoriteTags: Tag[],
  },
  role: {
    id: number,
    name: string,
    permissions: {
      id: number,
      name: string
    }[]
  }
}

// GET /api/users/[username]
export type UserPublic = {
  id: string,
  username: string,
  avatar?: string,
  description?: string,
  lastLogin: string,
  createdAt: Date,
  preferences: {
    layout: 'GRID' | 'COLLAGE',
    theme: 'DARK' | 'LIGHT',
    postsPerPage: number,
    blurUnsafeEmbeds: boolean,
    defaultSafety: SafetyType[],
    blacklistedTags: Tag[],
    favoriteTags: Tag[],
    profileBackground: number,
    private: boolean,
  },
  _count: {
    posts: number,
    comments: number,
    favorites: number,
    votes: number,
    collections: number,
  },
  posts: [
    {
      id: number,
      fileExt: string,
      score: number,
      createdAt: Date
    }
  ],
  favorites: [
    {
      postId: number
    }
  ],
  collections: [
    {
      ownerId: string,
      isPublic: boolean,
      name: string,
      items: {
        collectionId: string,
        postId: number,
        addedAt: Date
      },
      updatedAt: Date,
      createdAt: Date
    }
  ],
  comments: [
    {
      id: number,
      postId: number,
      content: string,
      createdAt: Date
    }
  ],
  role: {
    id: number,
    name: string,
    index: number,
    color: string,
    isDefault: boolean,
    permissions: {
      name: string
    }[]
  }
}

export type LocalUserPreferences = {
  layout: 'GRID' | 'COLLAGE',
  theme: 'DARK' | 'LIGHT',
  postsPerPage: number,
  flipNavigators: boolean,
}