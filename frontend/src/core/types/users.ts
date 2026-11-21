import { Safety } from "./posts"
import { ColoredTag, Tag } from "./tags"

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
    defaultSafety: Safety[],
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
    defaultSafety: Safety[],
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
  poolVotes: { // only shows upvotes
    poolId: number,
    pool: {
      id: number,
      name: string,
      items: {
        index: number,
        postId: number
      }[],
      artist: string | null,
      safety: string,
      lastEdited: Date,
      createdAt: Date
    },
  }[],
  collections: UserCollection[],
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

export type UserCollection = {
  id: string,
  ownerId: string,
  isPublic: boolean,
  name: string,
  items: {
    collectionId: string,
    postId: number,
    addedAt: Date
  }[],
  updatedAt: Date,
  createdAt: Date
}

export type LocalUserPreferences = {
  layout: 'GRID' | 'COLLAGE',
  theme: 'DARK' | 'LIGHT',
  postsPerPage: number,
  flipNavigators: boolean,
}

// Basic Public Stuff
export type UserSimpleSummary = {
  id: string,
  username: string,
  avatar: string | null,
  about: string | null,
  private: boolean,
  lastSeen: string | null, // like last activity (e.g. "viewing post #33")
  updatedAt: Date,
  createdAt: Date,
  role: {
    name: string,
    color: string,
    index: number,
  }
}

// GET /api/users/:username
export type UserProfile = UserSimpleSummary & {
  preferences: { profileBackground: number | null } | null,
  favoriteTags: ColoredTag[], // by category order, then name; [] for private accounts (unless it's you or an admin)
}

// Private Stuff
export type UserPrivateSummary = UserSimpleSummary & {
  email: string,
  lastLogin: Date,
  permissions: string[],
  boost: BoostState,
}

// GET /api/me's `boost` (also returned by PUT/DELETE /api/posts/:id/boost). Both null = free to boost.
export type BoostState = {
  nextBoostAt: string | null,       // ISO time the cooldown ends
  activeBoostPostId: number | null, // the post whose boost can still be undone (null if it was deleted)
}

// PATCH /api/me/preferences (and GET /api/me's `preferences`)
export type AccountPreferences = {
  blurUnsafeEmbeds: boolean,
  defaultSafety: Safety[],
  profileBackground: number | null,
}

// GET /api/me (the parts the account page uses)
export type AccountDetails = {
  id: string,
  username: string,
  email: string,
  private: boolean,
  avatar: string | null, // URL, null = default avatar
  about: string | null,  // short bio, max 64 chars
  createdAt: string,
  role: { name: string, color: string },
  preferences?: AccountPreferences | null, // null/missing = no row yet, so the server defaults apply
}