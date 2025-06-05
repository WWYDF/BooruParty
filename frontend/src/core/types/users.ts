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
    postsPerPage: number
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

export type UserPublic = {
  id: string,
  username: string,
  avatar?: string,
  description?: string,
  lastLogin: Date,
  createdAt: Date,
  preferences: {
    layout: 'GRID' | 'COLLAGE',
    theme: 'DARK' | 'LIGHT',
    postsPerPage: number,
  },
  _count: {
    posts: number,
    comments: number,
    favorites: number,
    votes: number
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